# app.py
import os
import json
import re # For slugifying names
from flask import Flask, request, jsonify, render_template
from bson import ObjectId, json_util
from pydantic import ValidationError
import traceback # For more detailed error logging

from config import config as app_config
from database import db_connector
from models import NPCProfile, DialogueRequest, DialogueResponse, MemoryItem, NPCProfileWithHistory
from ai_service import ai_service_instance

app = Flask(__name__)
app.secret_key = app_config.FLASK_SECRET_KEY

mongo_db = db_connector.get_db()

# Define the path to the history directory relative to this app.py file
HISTORY_DATA_DIR = os.path.join(os.path.dirname(__file__), 'data', 'history')
PRIMARY_DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
VTT_IMPORT_DIR = os.path.join(os.path.dirname(__file__), 'data', 'vtt_imports')


def parse_json(data):
    return json.loads(json_util.dumps(data))

def slugify(text):
    text = str(text).lower() # Ensure text is a string
    text = re.sub(r'\s+', '-', text) 
    text = re.sub(r'[^\w-]+', '', text) 
    return text

def find_fvtt_file(character_name, vtt_import_dir_abs):
    slug_name = slugify(character_name)
    if not os.path.isdir(vtt_import_dir_abs):
        return None
    for filename in os.listdir(vtt_import_dir_abs):
        if filename.startswith(f"fvtt-Actor-{slug_name}") and filename.endswith('.json'):
            return os.path.join(vtt_import_dir_abs, filename)
    return None

def load_history_content_for_npc(npc_doc):
    """Loads content for associated history files and adds it to the npc_doc."""
    history_contents_loaded = {}
    combined_content_parts = []
    if 'associated_history_files' in npc_doc and npc_doc['associated_history_files']:
        for history_filename in npc_doc['associated_history_files']:
            file_path = os.path.join(HISTORY_DATA_DIR, secure_filename(history_filename)) # Use secure_filename
            if os.path.exists(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        history_contents_loaded[history_filename] = content
                        # Add a separator or a note about the source file for clarity in combined content
                        combined_content_parts.append(f"--- From: {history_filename} ---\n{content}\n")
                except Exception as e:
                    print(f"Error reading history file {history_filename} for NPC {npc_doc.get('name', 'Unknown')}: {e}")
                    history_contents_loaded[history_filename] = f"[Error loading content for {history_filename}]"
                    combined_content_parts.append(f"--- From: {history_filename} ---\n[Error loading content]\n")
            else:
                print(f"Warning: History file '{history_filename}' not found at '{file_path}' for NPC {npc_doc.get('name', 'Unknown')}.")
                history_contents_loaded[history_filename] = "[File not found]"
                combined_content_parts.append(f"--- From: {history_filename} ---\n[File not found]\n")
                
    npc_doc['history_contents_loaded'] = history_contents_loaded # Store individual file contents for potential display

    npc_doc['combined_history_content'] = "\n".join(combined_content_parts).strip() if combined_content_parts else "" # MODIFIED LINE
    return npc_doc



def sync_data_from_files():
    if mongo_db is None:
        print("[Data Sync] Skipping: Database not available.")
        return

    print("\n" + "-"*50)
    print(f"[Data Sync] Starting character data synchronization from '{PRIMARY_DATA_DIR}', '{VTT_IMPORT_DIR}', and '{HISTORY_DATA_DIR}'...")

    if not os.path.isdir(PRIMARY_DATA_DIR):
        print(f"[Data Sync] Warning: Primary data directory '{PRIMARY_DATA_DIR}' not found. Skipping.")
        return
    
    characters_collection = mongo_db.npcs
    synced_count = 0
    updated_count = 0
    new_count = 0

    for filename in os.listdir(PRIMARY_DATA_DIR):
        if filename.endswith('.json'):
            primary_file_path = os.path.join(PRIMARY_DATA_DIR, filename)
            try:
                with open(primary_file_path, 'r', encoding='utf-8') as f:
                    primary_char_data = json.load(f)

                temp_profile_for_name = NPCProfile(**primary_char_data)
                char_name = temp_profile_for_name.name
                
                fvtt_system_data = None
                fvtt_file_path = find_fvtt_file(char_name, VTT_IMPORT_DIR)
                if fvtt_file_path:
                    print(f"[Data Sync] -> Found and loaded VTT data for {char_name} from {fvtt_file_path}")
                    with open(fvtt_file_path, 'r', encoding='utf-8') as f_vtt:
                        fvtt_json_data = json.load(f_vtt)
                    if 'system' in fvtt_json_data:
                        fvtt_system_data = fvtt_json_data['system']
                else:
                    print(f"[Data Sync] -> No matching VTT file found for {char_name} (searched for slug: {slugify(char_name)}).")


                # Initialize associated_history_files if not present in JSON
                if 'associated_history_files' not in primary_char_data:
                    primary_char_data['associated_history_files'] = []

                # Default history file association (if it exists and not already listed)
                potential_history_filename = f"{char_name}.txt"
                history_file_path_abs = os.path.join(HISTORY_DATA_DIR, secure_filename(potential_history_filename))
                if os.path.exists(history_file_path_abs):
                    if potential_history_filename not in primary_char_data['associated_history_files']:
                        primary_char_data['associated_history_files'].append(potential_history_filename)
                        print(f"[Data Sync] -> Default history file '{potential_history_filename}' added for association with {char_name}.")
                    print(f"[Data Sync] -> Found history file for {char_name}: {potential_history_filename}")
                else:
                     print(f"[Data Sync] -> No matching default history file found for {char_name} (searched for: {potential_history_filename}).")

                
                combined_data = primary_char_data.copy()
                if fvtt_system_data:
                    combined_data['vtt_data'] = fvtt_system_data
                
                # Create an NPCProfile instance to leverage Pydantic's default factory for missing fields.
                # This ensures fields like 'memories' are initialized if not in the JSON.
                validated_profile = NPCProfile(**combined_data)
                mongo_doc = validated_profile.model_dump(mode='json', by_alias=True, exclude_none=True) # Use by_alias=True for 'class_str'
                
                existing_char_in_db = characters_collection.find_one({"name": char_name})

                if existing_char_in_db:
                    update_payload = {k: v for k, v in mongo_doc.items() if k != '_id'}
                    is_changed = False
                    # More robust change detection
                    current_db_state = existing_char_in_db.copy()
                    del current_db_state['_id'] # Don't compare ObjectId

                    if json.dumps(current_db_state, sort_keys=True) != json.dumps(update_payload, sort_keys=True):
                        is_changed = True
                    
                    if is_changed:
                        characters_collection.update_one({"_id": existing_char_in_db['_id']}, {"$set": update_payload})
                        print(f"[Data Sync] -> Updated character in DB: {char_name}")
                        updated_count += 1
                    else:
                        print(f"[Data Sync] -> Character already up-to-date in DB: {char_name}")

                else:
                    characters_collection.insert_one(mongo_doc)
                    print(f"[Data Sync] -> Loaded new character to DB: {char_name}")
                    new_count += 1
                synced_count +=1

            except ValidationError as e:
                print(f"[Data Sync] Error: Validation failed for {filename}. Details: {e.errors()}")
            except Exception as e:
                print(f"[Data Sync] Error: Unexpected error with {filename}: {e}")
                traceback.print_exc()
    
    print(f"[Data Sync] Finished. Processed: {synced_count} | New: {new_count} | Updated: {updated_count}")
    print("-" * 50 + "\n")


@app.route('/')
def serve_index():
    return render_template('index.html')

@app.route('/api/npcs', methods=['POST'])
def create_npc_api(): # Renamed to avoid conflict with Python's built-in create_npc
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        data = request.get_json()
        if not data: return jsonify({"error": "Invalid JSON payload"}), 400
        
        # Ensure 'associated_history_files' is present, default to empty list if not
        data.setdefault('associated_history_files', [])
        
        character_profile_data = NPCProfile(**data) 
    except ValidationError as e:
        return jsonify({"error": "Validation Error", "details": e.errors()}), 400
    
    try:
        characters_collection = mongo_db.npcs 
        character_dict = character_profile_data.model_dump(mode='json', by_alias=True, exclude_none=True)
        result = characters_collection.insert_one(character_dict)
        created_character_from_db = characters_collection.find_one({"_id": result.inserted_id})
        
        if created_character_from_db: # Check if document was found
            created_character_from_db = load_history_content_for_npc(created_character_from_db)
            return jsonify({"message": f"{created_character_from_db.get('character_type', 'Character')} created", 
                            "character": parse_json(created_character_from_db)}), 201
        else:
            return jsonify({"error": "Failed to retrieve created character from DB"}), 500
            
    except Exception as e:
        print(f"Error in create_npc_api: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Could not create character: {str(e)}"}), 500

@app.route('/api/npcs', methods=['GET'])
def get_all_npcs_api(): # Renamed
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        characters_cursor = mongo_db.npcs.find({})
        characters_list = []
        for char_doc in characters_cursor:
            char_doc['_id'] = str(char_doc['_id'])
            char_doc.setdefault('associated_history_files', []) 
            char_doc.setdefault('combined_history_content', '') # Ensure this field exists for frontend
            characters_list.append(char_doc)
        return jsonify(characters_list), 200
    except Exception as e:
        print(f"Error in get_all_npcs_api: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Could not retrieve characters: {str(e)}"}), 500

@app.route('/api/npcs/<npc_id_str>', methods=['GET'])
def get_npc_api(npc_id_str: str): # Renamed
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception:
        return jsonify({"error": "Invalid Character ID format"}), 400

    npc_data = mongo_db.npcs.find_one({"_id": npc_id_obj})
    if not npc_data:
        return jsonify({"error": "Character not found"}), 404
    
    npc_data.setdefault('associated_history_files', [])
    npc_data_with_history = load_history_content_for_npc(npc_data)
    
    return jsonify(parse_json(npc_data_with_history)), 200

@app.route('/api/npcs/<npc_id_str>', methods=['PUT'])
def update_npc_api(npc_id_str: str): # Renamed
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid Character ID format"}), 400
    
    existing_npc_data = mongo_db.npcs.find_one({"_id": npc_id_obj})
    if not existing_npc_data: return jsonify({"error": "Character not found for update"}), 404

    try:
        update_data_req = request.get_json()
        if not update_data_req: return jsonify({"error": "Invalid JSON payload"}), 400

        # Preserve ObjectId for Pydantic validation if it's not in the request
        # Pydantic models usually don't include _id
        current_data_for_validation = {k:v for k,v in existing_npc_data.items() if k != '_id'}
        merged_for_validation = {**current_data_for_validation, **update_data_req}
        
        validated_update_profile = NPCProfile(**merged_for_validation)
        
        update_doc_set = validated_update_profile.model_dump(
            mode='json', 
            by_alias=True, # Important for fields like 'class_str' (aliased as 'class')
            exclude={'_id', 'id', 'memories', 'linked_lore_ids', 'associated_history_files'}, # Exclude fields not directly updatable this way
            exclude_none=True 
        )
        
        # Specifically handle gm_notes if it's intended to be cleared
        if 'gm_notes' in update_data_req:
            final_set_payload = update_doc_set
            final_set_payload['gm_notes'] = update_data_req['gm_notes'] # Ensure empty string is set if provided
        else:
            final_set_payload = update_doc_set

        if not final_set_payload: return jsonify({"message": "No valid fields to update"}), 200

    except ValidationError as e:
        return jsonify({"error": "Validation Error during update", "details": e.errors()}), 400
    
    try:
        mongo_db.npcs.update_one({"_id": npc_id_obj}, {"$set": final_set_payload})
        updated_npc_data_from_db = mongo_db.npcs.find_one({"_id": npc_id_obj})
        if updated_npc_data_from_db: # Check if document was found
            updated_npc_data_from_db = load_history_content_for_npc(updated_npc_data_from_db) 
            return jsonify({"message": "Character updated", "character": parse_json(updated_npc_data_from_db)}), 200
        else: # Should not happen if update_one succeeded on a matched doc
            return jsonify({"error": "Failed to retrieve updated character"}), 500
    except Exception as e:
        print(f"Error updating NPC {npc_id_str}: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Could not update character: {str(e)}"}), 500

@app.route('/api/history_files', methods=['GET'])
def list_history_files_api(): # Renamed
    if not os.path.isdir(HISTORY_DATA_DIR):
        print(f"Warning: History directory not found at {HISTORY_DATA_DIR}. Creating it.")
        os.makedirs(HISTORY_DATA_DIR, exist_ok=True)
        return jsonify([]), 200 # Return empty list if dir was just created
    try:
        files = [f for f in os.listdir(HISTORY_DATA_DIR) if f.endswith('.txt') and os.path.isfile(os.path.join(HISTORY_DATA_DIR, f))]
        return jsonify(sorted(files)), 200
    except Exception as e:
        print(f"Error listing history files: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Could not list history files: {str(e)}"}), 500

@app.route('/api/character/<npc_id_str>/associate_history', methods=['POST'])
def associate_history_file_with_npc_api(npc_id_str: str): # Renamed
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid Character ID format"}), 400

    data = request.get_json()
    history_filename_from_req = data.get('history_file')
    if not history_filename_from_req: return jsonify({"error": "history_file not provided"}), 400
    
    # Sanitize filename
    history_filename = secure_filename(history_filename_from_req)

    history_file_path = os.path.join(HISTORY_DATA_DIR, history_filename)
    if not os.path.exists(history_file_path): 
        print(f"Attempted to associate non-existent history file: {history_file_path}")
        return jsonify({"error": f"History file '{history_filename}' not found on server."}), 404

    try:
        update_result = mongo_db.npcs.update_one(
            {"_id": npc_id_obj},
            {"$addToSet": {"associated_history_files": history_filename}}
        )
        if update_result.matched_count == 0: return jsonify({"error": "Character not found"}), 404
        
        npc_doc = mongo_db.npcs.find_one({"_id": npc_id_obj})
        if npc_doc: # Check if document was found
            npc_doc_with_history = load_history_content_for_npc(npc_doc) 
            return jsonify({
                "message": f"History file '{history_filename}' associated.",
                "character": parse_json(npc_doc_with_history) # Send back the updated character object
            }), 200
        else: # Should ideally not happen if update_one matched
             return jsonify({"error": "Failed to retrieve updated character after history association"}), 500
    except Exception as e:
        print(f"Error associating history for {npc_id_str}: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Could not associate history: {str(e)}"}), 500

@app.route('/api/character/<npc_id_str>/dissociate_history', methods=['POST'])
def dissociate_history_file_from_npc_api(npc_id_str: str): # Renamed
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid Character ID format"}), 400

    data = request.get_json()
    history_filename_from_req = data.get('history_file')
    if not history_filename_from_req: return jsonify({"error": "history_file not provided"}), 400

    history_filename = secure_filename(history_filename_from_req)

    try:
        update_result = mongo_db.npcs.update_one(
            {"_id": npc_id_obj},
            {"$pull": {"associated_history_files": history_filename}}
        )
        if update_result.matched_count == 0: return jsonify({"error": "Character not found"}), 404
        
        npc_doc = mongo_db.npcs.find_one({"_id": npc_id_obj})
        if npc_doc: # Check if document was found
            npc_doc_with_history = load_history_content_for_npc(npc_doc)
            
            message = f"History file '{history_filename}' dissociated."
            if update_result.modified_count == 0:
                 message = f"File '{history_filename}' was not associated or already removed."
            
            return jsonify({
                "message": message,
                "character": parse_json(npc_doc_with_history) # Send back the updated character
            }), 200
        else: # Should not happen
            return jsonify({"error": "Failed to retrieve updated character after history dissociation"}), 500
            
    except Exception as e:
        print(f"Error dissociating history for {npc_id_str}: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Could not dissociate history: {str(e)}"}), 500


@app.route('/api/npcs/<npc_id_str>/memory', methods=['POST'])
def add_npc_memory_api(npc_id_str: str): # Renamed
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try: npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid ID format"}), 400
    
    npc_check = mongo_db.npcs.find_one({"_id": npc_id_obj})
    if not npc_check: return jsonify({"error": "NPC not found"}), 404
    if npc_check.get("character_type") != "NPC":
        return jsonify({"error": "Memories can only be added to NPCs"}), 400
    
    try:
        memory_data = MemoryItem(**request.get_json())
    except ValidationError as e: return jsonify({"error": "Validation Error for MemoryItem", "details": e.errors()}), 400
    
    mongo_db.npcs.update_one({"_id": npc_id_obj}, {"$push": {"memories": memory_data.model_dump(mode='json')}})
    updated_npc = mongo_db.npcs.find_one({"_id": npc_id_obj})
    if updated_npc: # Check if document was found
        return jsonify({"message": "Memory added", "updated_memories": parse_json(updated_npc.get("memories", []))}), 200
    else:
        return jsonify({"error": "Failed to retrieve updated NPC after adding memory"}), 500

@app.route('/api/npcs/<npc_id_str>/memory/<memory_id_str_path>', methods=['DELETE']) # Renamed memory_id_str
def delete_npc_memory_api(npc_id_str: str, memory_id_str_path: str): # Renamed
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try: npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid NPC ID"}), 400
    
    result = mongo_db.npcs.update_one({"_id": npc_id_obj}, {"$pull": {"memories": {"memory_id": memory_id_str_path}}})
    if result.matched_count == 0: return jsonify({"error": "NPC not found"}), 404
    if result.modified_count == 0: return jsonify({"error": "Memory not found or already deleted"}), 404
    
    updated_npc = mongo_db.npcs.find_one({"_id": npc_id_obj})
    if updated_npc: # Check if document was found
        return jsonify({"message": "Memory deleted", "updated_memories": parse_json(updated_npc.get("memories", []))}), 200
    else:
        return jsonify({"error": "Failed to retrieve updated NPC after deleting memory"}), 500

@app.route('/api/npcs/<npc_id_str>/dialogue', methods=['POST'])
def generate_dialogue_for_npc_api(npc_id_str: str): # Renamed
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    if ai_service_instance is None or ai_service_instance.model is None:
        return jsonify({"error": "AI Service not available"}), 503
    
    try: npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid NPC ID"}), 400
    
    npc_data_from_db = mongo_db.npcs.find_one({"_id": npc_id_obj})
    if not npc_data_from_db: return jsonify({"error": "NPC not found"}), 404
    if npc_data_from_db.get('character_type', 'NPC') != 'NPC':
        return jsonify({"error": "Dialogue for PCs not supported"}), 400
    
    npc_data_with_history = load_history_content_for_npc(npc_data_from_db)

    try:
        npc_profile = NPCProfile(**parse_json(npc_data_with_history))
    except ValidationError as e:
        print(f"Pydantic validation error for NPC {npc_id_str}: {e.errors()}")
        return jsonify({"error": "NPC data invalid", "details": e.errors()}), 500
    
    try:
        dialogue_req_payload = request.get_json()
        # Ensure npc_history is handled if it's part of the DialogueRequest model or explicitly passed
        # For now, we assume DialogueRequest doesn't include npc_history, it's passed separately to AI service
        dialogue_req_data = DialogueRequest(**dialogue_req_payload)
    except ValidationError as e:
        return jsonify({"error": "Dialogue request invalid", "details": e.errors()}), 400
    
    # Get the combined history from the loaded document
    combined_history = npc_data_with_history.get('combined_history_content', '')
    
    # If frontend also sends npc_history in payload, decide which to use or combine.
    # For now, we use the one loaded from the DB record (which should be up-to-date)
    # If frontend payload *should* be the source of truth for history for this call:
    # combined_history = dialogue_req_payload.get('npc_history', npc_data_with_history.get('combined_history_content', ''))


    print(f"DEBUG: Generating dialogue for {npc_profile.name}. History to be passed to AI: '{combined_history[:100]}...' (length: {len(combined_history)})")

    try:
        generated_response = ai_service_instance.generate_npc_dialogue(
            npc=npc_profile, 
            dialogue_request=dialogue_req_data, 
            world_lore_summary=None, 
            detailed_character_history=combined_history # Pass the loaded and combined history
        )
        # The AI service should return a string (the dialogue)
        # If it returns a dict with error, handle it
        if isinstance(generated_response, dict) and "error" in generated_response:
             return jsonify(generated_response), 500 # Propagate AI service error

        generated_text = generated_response

    except Exception as e:
        print(f"Error calling AI service for {npc_profile.name}: {e}")
        traceback.print_exc()
        return jsonify({"error": "Dialogue generation failed internally.", "details": str(e)}), 500

    
    memory_suggestions = []
    if dialogue_req_data.player_utterance and generated_text and not generated_text.startswith("Error:"):
        summarized_memory = ai_service_instance.summarize_interaction_for_memory(
            dialogue_req_data.player_utterance, generated_text
        )
        memory_suggestions.append(summarized_memory)

    response_data_model = DialogueResponse(
        npc_id=npc_id_str, 
        npc_dialogue=generated_text,
        new_memory_suggestions=memory_suggestions, 
        generated_topics=[] # Placeholder for now
    )
    return jsonify(response_data_model.model_dump(mode='json')), 200

if __name__ == '__main__':
    for dir_path in [PRIMARY_DATA_DIR, VTT_IMPORT_DIR, HISTORY_DATA_DIR]:
        if not os.path.exists(dir_path):
            os.makedirs(dir_path)
            print(f"Created directory: {dir_path}")
    
    print(f"Data directories: Primary='{PRIMARY_DATA_DIR}', VTT='{VTT_IMPORT_DIR}', History='{HISTORY_DATA_DIR}'")

    # Perform initial data sync
    # This will also run on Werkzeug reloads if debug=True
    if mongo_db is not None: 
        sync_data_from_files()
    else: 
        print("CRITICAL: MongoDB connection failed. Data sync skipped.")
    
    if ai_service_instance is None or ai_service_instance.model is None:
        print("CRITICAL: AI Service not initialized. Dialogue generation will fail.")
    
    print("-" * 50)
    print(f"Flask Secret Key: {'Set' if app_config.FLASK_SECRET_KEY != 'a_default_secret_key' else 'Using Default (Unsafe for Production)'}")
    print(f"Gemini API Key: {'Set' if app_config.GEMINI_API_KEY else 'NOT SET'}")
    print(f"Mongo URI: {app_config.MONGO_URI}")
    print("-" * 50)
    
    print(">>> Attempting to start Flask development server...")
    print(">>> If the server starts, you will see 'Running on...' messages below.")
    print(">>> If the script exits back to the command prompt, there is a critical error during startup.")
    print("-" * 50)
    
    app.run(debug=True, host='0.0.0.0', port=5000)
# app.py
import os
import json
import re # For slugifying names
from flask import Flask, request, jsonify, render_template
from bson import ObjectId, json_util
from pydantic import ValidationError

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
            file_path = os.path.join(HISTORY_DATA_DIR, history_filename)
            if os.path.exists(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        history_contents_loaded[history_filename] = content
                        combined_content_parts.append(f"--- From: {history_filename} ---\n{content}\n")
                except Exception as e:
                    print(f"Error reading history file {history_filename} for NPC {npc_doc.get('name', 'Unknown')}: {e}")
                    history_contents_loaded[history_filename] = f"[Error loading content for {history_filename}]"
            else:
                history_contents_loaded[history_filename] = "[File not found]"
    npc_doc['history_contents_loaded'] = history_contents_loaded
    npc_doc['combined_history_content'] = "\n".join(combined_content_parts) if combined_content_parts else None
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
                    with open(fvtt_file_path, 'r', encoding='utf-8') as f_vtt:
                        fvtt_json_data = json.load(f_vtt)
                    if 'system' in fvtt_json_data:
                        fvtt_system_data = fvtt_json_data['system']

                # Initialize associated_history_files if not present in JSON
                if 'associated_history_files' not in primary_char_data:
                    primary_char_data['associated_history_files'] = []

                # Default history file association (if it exists and not already listed)
                potential_history_filename = f"{char_name}.txt"
                history_file_path_abs = os.path.join(HISTORY_DATA_DIR, potential_history_filename)
                if os.path.exists(history_file_path_abs) and potential_history_filename not in primary_char_data['associated_history_files']:
                    primary_char_data['associated_history_files'].append(potential_history_filename)
                    print(f"[Data Sync] -> Default history file '{potential_history_filename}' added for {char_name}.")
                
                combined_data = primary_char_data.copy()
                if fvtt_system_data:
                    combined_data['vtt_data'] = fvtt_system_data
                
                validated_profile = NPCProfile(**combined_data)
                mongo_doc = validated_profile.model_dump(mode='json', exclude_none=True)
                
                existing_char_in_db = characters_collection.find_one({"name": char_name})

                if existing_char_in_db:
                    update_payload = {k: v for k, v in mongo_doc.items() if k != '_id'}
                    is_changed = False
                    for key, value in update_payload.items():
                        if isinstance(value, (dict, list)) or isinstance(existing_char_in_db.get(key), (dict, list)):
                            if json.dumps(existing_char_in_db.get(key), sort_keys=True) != json.dumps(value, sort_keys=True):
                                is_changed = True
                                break
                        elif existing_char_in_db.get(key) != value:
                            is_changed = True
                            break
                    
                    if is_changed:
                        characters_collection.update_one({"_id": existing_char_in_db['_id']}, {"$set": update_payload})
                        updated_count += 1
                else:
                    characters_collection.insert_one(mongo_doc)
                    new_count += 1
                synced_count +=1

            except ValidationError as e:
                print(f"[Data Sync] Error: Validation failed for {filename}. Details: {e.errors()}")
            except Exception as e:
                print(f"[Data Sync] Error: Unexpected error with {filename}: {e}")
    
    print(f"[Data Sync] Finished. Processed: {synced_count} | New: {new_count} | Updated: {updated_count}")
    print("-" * 50 + "\n")


@app.route('/')
def serve_index():
    return render_template('index.html')

@app.route('/api/npcs', methods=['POST'])
def create_npc():
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        data = request.get_json()
        if not data: return jsonify({"error": "Invalid JSON payload"}), 400
        character_profile_data = NPCProfile(**data) 
    except ValidationError as e:
        return jsonify({"error": "Validation Error", "details": e.errors()}), 400
    
    try:
        characters_collection = mongo_db.npcs 
        character_dict = character_profile_data.model_dump(mode='json', exclude_none=True)
        result = characters_collection.insert_one(character_dict)
        created_character_from_db = characters_collection.find_one({"_id": result.inserted_id})
        # Load history content for the response
        created_character_from_db = load_history_content_for_npc(created_character_from_db)
        return jsonify({"message": f"{created_character_from_db.get('character_type', 'Character')} created", 
                        "character": parse_json(created_character_from_db)}), 201
    except Exception as e:
        return jsonify({"error": f"Could not create character: {str(e)}"}), 500

@app.route('/api/npcs', methods=['GET'])
def get_all_npcs():
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        characters_cursor = mongo_db.npcs.find({})
        characters_list = []
        for char_doc in characters_cursor:
            char_doc['_id'] = str(char_doc['_id'])
            char_doc.setdefault('associated_history_files', []) # Ensure field exists
            # For list view, we might not load full history content to keep response light
            # It will be loaded when fetching a single NPC
            characters_list.append(char_doc)
        return jsonify(characters_list), 200
    except Exception as e:
        return jsonify({"error": f"Could not retrieve characters: {str(e)}"}), 500

@app.route('/api/npcs/<npc_id_str>', methods=['GET'])
def get_npc(npc_id_str: str):
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
def update_npc(npc_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid Character ID format"}), 400
    
    existing_npc_data = mongo_db.npcs.find_one({"_id": npc_id_obj})
    if not existing_npc_data: return jsonify({"error": "Character not found for update"}), 404

    try:
        update_data_req = request.get_json()
        if not update_data_req: return jsonify({"error": "Invalid JSON payload"}), 400

        current_data_for_validation = existing_npc_data.copy()
        if '_id' in current_data_for_validation: del current_data_for_validation['_id'] 
        merged_for_validation = {**current_data_for_validation, **update_data_req}
        
        # Ensure associated_history_files is treated as a list if present in request
        if 'associated_history_files' in merged_for_validation and not isinstance(merged_for_validation['associated_history_files'], list):
            merged_for_validation['associated_history_files'] = [merged_for_validation['associated_history_files']]

        validated_update_profile = NPCProfile(**merged_for_validation)
        
        update_doc_set = validated_update_profile.model_dump(
            mode='json', 
            exclude={'memories', 'linked_lore_ids', '_id'}, 
            exclude_none=True 
        )
        
        final_set_payload = {}
        for key, value in update_doc_set.items():
            if key in update_data_req or key in NPCProfile.model_fields:
                 final_set_payload[key] = value
        if 'gm_notes' in update_data_req and update_data_req['gm_notes'] == "":
            final_set_payload['gm_notes'] = ""
        if not final_set_payload: return jsonify({"message": "No valid fields to update"}), 200

    except ValidationError as e:
        return jsonify({"error": "Validation Error during update", "details": e.errors()}), 400
    
    try:
        mongo_db.npcs.update_one({"_id": npc_id_obj}, {"$set": final_set_payload})
        updated_npc_data_from_db = mongo_db.npcs.find_one({"_id": npc_id_obj})
        updated_npc_data_from_db = load_history_content_for_npc(updated_npc_data_from_db) # Load history for response
        return jsonify({"message": "Character updated", "character": parse_json(updated_npc_data_from_db)}), 200
    except Exception as e:
        return jsonify({"error": f"Could not update character: {str(e)}"}), 500

@app.route('/api/history_files', methods=['GET'])
def list_history_files():
    if not os.path.isdir(HISTORY_DATA_DIR):
        return jsonify({"error": f"History directory not found: {HISTORY_DATA_DIR}"}), 500
    try:
        files = [f for f in os.listdir(HISTORY_DATA_DIR) if f.endswith('.txt') and os.path.isfile(os.path.join(HISTORY_DATA_DIR, f))]
        return jsonify(sorted(files)), 200
    except Exception as e:
        return jsonify({"error": f"Could not list history files: {str(e)}"}), 500

@app.route('/api/character/<npc_id_str>/associate_history', methods=['POST'])
def associate_history_file_with_npc(npc_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid Character ID format"}), 400

    data = request.get_json()
    history_filename = data.get('history_file')
    if not history_filename: return jsonify({"error": "history_file not provided"}), 400

    history_file_path = os.path.join(HISTORY_DATA_DIR, history_filename)
    if not os.path.exists(history_file_path): return jsonify({"error": f"History file '{history_filename}' not found"}), 404

    try:
        # Add to set to prevent duplicates, then convert back to list for storage
        update_result = mongo_db.npcs.update_one(
            {"_id": npc_id_obj},
            {"$addToSet": {"associated_history_files": history_filename}}
        )
        if update_result.matched_count == 0: return jsonify({"error": "Character not found"}), 404
        
        npc_doc = mongo_db.npcs.find_one({"_id": npc_id_obj})
        npc_doc_with_history = load_history_content_for_npc(npc_doc) # Load all history for response

        return jsonify({
            "message": f"History file '{history_filename}' associated.",
            "character": parse_json(npc_doc_with_history)
        }), 200
    except Exception as e:
        return jsonify({"error": f"Could not associate history: {str(e)}"}), 500

@app.route('/api/character/<npc_id_str>/dissociate_history', methods=['POST']) # Using POST for consistency, could be DELETE
def dissociate_history_file_from_npc(npc_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid Character ID format"}), 400

    data = request.get_json()
    history_filename = data.get('history_file')
    if not history_filename: return jsonify({"error": "history_file not provided"}), 400

    try:
        update_result = mongo_db.npcs.update_one(
            {"_id": npc_id_obj},
            {"$pull": {"associated_history_files": history_filename}}
        )
        if update_result.matched_count == 0: return jsonify({"error": "Character not found"}), 404
        if update_result.modified_count == 0: return jsonify({"message": f"File '{history_filename}' was not associated."}), 200
        
        npc_doc = mongo_db.npcs.find_one({"_id": npc_id_obj})
        npc_doc_with_history = load_history_content_for_npc(npc_doc)

        return jsonify({
            "message": f"History file '{history_filename}' dissociated.",
            "character": parse_json(npc_doc_with_history)
        }), 200
    except Exception as e:
        return jsonify({"error": f"Could not dissociate history: {str(e)}"}), 500


@app.route('/api/npcs/<npc_id_str>/memory', methods=['POST'])
def add_npc_memory(npc_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try: npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid ID format"}), 400
    
    if not mongo_db.npcs.find_one({"_id": npc_id_obj}): return jsonify({"error": "NPC not found"}), 404
    
    try:
        memory_data = MemoryItem(**request.get_json())
    except ValidationError as e: return jsonify({"error": "Validation Error", "details": e.errors()}), 400
    
    mongo_db.npcs.update_one({"_id": npc_id_obj}, {"$push": {"memories": memory_data.model_dump(mode='json')}})
    updated_npc = mongo_db.npcs.find_one({"_id": npc_id_obj})
    return jsonify({"message": "Memory added", "updated_memories": parse_json(updated_npc.get("memories", []))}), 200

@app.route('/api/npcs/<npc_id_str>/memory/<memory_id_str>', methods=['DELETE'])
def delete_npc_memory(npc_id_str: str, memory_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try: npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid NPC ID"}), 400
    
    result = mongo_db.npcs.update_one({"_id": npc_id_obj}, {"$pull": {"memories": {"memory_id": memory_id_str}}})
    if result.matched_count == 0: return jsonify({"error": "NPC not found"}), 404
    if result.modified_count == 0: return jsonify({"error": "Memory not found"}), 404
    
    updated_npc = mongo_db.npcs.find_one({"_id": npc_id_obj})
    return jsonify({"message": "Memory deleted", "updated_memories": parse_json(updated_npc.get("memories", []))}), 200

@app.route('/api/npcs/<npc_id_str>/dialogue', methods=['POST'])
def generate_dialogue_for_npc(npc_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    if ai_service_instance is None or ai_service_instance.model is None:
        return jsonify({"error": "AI Service not available"}), 503
    
    try: npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid NPC ID"}), 400
    
    npc_data_from_db = mongo_db.npcs.find_one({"_id": npc_id_obj})
    if not npc_data_from_db: return jsonify({"error": "NPC not found"}), 404
    if npc_data_from_db.get('character_type', 'NPC') != 'NPC':
        return jsonify({"error": "Dialogue for PCs not supported"}), 400
    
    # Load history content for the AI
    npc_data_with_history = load_history_content_for_npc(npc_data_from_db)

    try:
        # Use NPCProfileWithHistory for validation if you expect loaded history in the request,
        # but for AI service, we pass the dynamically loaded content.
        # So, we validate against the base NPCProfile for the DB data.
        npc_profile = NPCProfile(**parse_json(npc_data_with_history)) # This will ignore extra loaded fields for validation
    except ValidationError as e:
        return jsonify({"error": "NPC data invalid", "details": e.errors()}), 500
    
    try:
        dialogue_req_data = DialogueRequest(**request.get_json())
    except ValidationError as e:
        return jsonify({"error": "Dialogue request invalid", "details": e.errors()}), 400
    
    # Pass the combined_history_content to the AI service
    # The npc_profile object itself won't have history_content unless we explicitly add it after Pydantic parsing
    # or use a different model. Let's pass it as an extra arg to ai_service.
    combined_history = npc_data_with_history.get('combined_history_content')

    generated_text = ai_service_instance.generate_npc_dialogue(
        npc_profile, 
        dialogue_req_data, 
        world_lore_summary=None, # Assuming world_lore_summary is separate
        detailed_character_history=combined_history # New argument for AI service
    )
    
    memory_suggestions = []
    if dialogue_req_data.player_utterance and generated_text:
        summarized_memory = ai_service_instance.summarize_interaction_for_memory(
            dialogue_req_data.player_utterance, generated_text
        )
        memory_suggestions.append(summarized_memory)

    response_data = DialogueResponse(
        npc_id=npc_id_str, npc_dialogue=generated_text,
        new_memory_suggestions=memory_suggestions, generated_topics=[]
    )
    return jsonify(response_data.model_dump(mode='json')), 200

if __name__ == '__main__':
    for dir_path in [PRIMARY_DATA_DIR, VTT_IMPORT_DIR, HISTORY_DATA_DIR]:
        if not os.path.exists(dir_path):
            os.makedirs(dir_path)
            print(f"Created directory: {dir_path}")
    
    print(f"Data directories: Primary='{PRIMARY_DATA_DIR}', VTT='{VTT_IMPORT_DIR}', History='{HISTORY_DATA_DIR}'")

    if mongo_db is not None: sync_data_from_files()
    else: print("CRITICAL: MongoDB connection failed.")
    if ai_service_instance is None or ai_service_instance.model is None:
        print("CRITICAL: AI Service not initialized.")
    
    print("-" * 50)
    app.run(debug=True, host='0.0.0.0', port=5000)


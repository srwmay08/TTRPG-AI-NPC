# app.py
import os
import json
import re # For slugifying names
from flask import Flask, request, jsonify, render_template
from bson import ObjectId, json_util
from pydantic import ValidationError

from config import config as app_config
from database import db_connector
from models import NPCProfile, DialogueRequest, DialogueResponse, MemoryItem # NPCProfile now includes history fields
from ai_service import ai_service_instance

app = Flask(__name__)
app.secret_key = app_config.FLASK_SECRET_KEY

mongo_db = db_connector.get_db()

# Define the path to the history directory
HISTORY_DATA_DIR = os.path.join(os.path.dirname(__file__), 'data', 'history')
PRIMARY_DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
VTT_IMPORT_DIR = os.path.join(os.path.dirname(__file__), 'data', 'vtt_imports')


def parse_json(data):
    return json.loads(json_util.dumps(data))

def slugify(text):
    """
    Simple slugify function to convert a name to a lowercase, hyphenated string.
    Example: "Cade De la Cour" -> "cade-de-la-cour"
    """
    text = text.lower()
    text = re.sub(r'\s+', '-', text) # Replace spaces with hyphens
    text = re.sub(r'[^\w-]+', '', text) # Remove non-alphanumeric characters except hyphens
    return text

def find_fvtt_file(character_name, vtt_import_dir_abs):
    """
    Tries to find a matching FVTT export file based on the character name.
    Assumes FVTT files are named like 'fvtt-Actor-<slugified-name>-<some-id>.json'
    """
    slug_name = slugify(character_name)
    if not os.path.isdir(vtt_import_dir_abs):
        return None
    for filename in os.listdir(vtt_import_dir_abs):
        if filename.startswith(f"fvtt-Actor-{slug_name}") and filename.endswith('.json'):
            return os.path.join(vtt_import_dir_abs, filename)
    return None

def sync_data_from_files():
    """
    Loads character data from JSON files in the 'data/' directory
    and merges it with corresponding FVTT data from 'data/vtt_imports/',
    and attempts to pre-associate history files from 'data/history/',
    then syncs to MongoDB.
    """
    if mongo_db is None:
        print("[Data Sync] Skipping: Database not available.")
        return

    print("\n" + "-"*50)
    print(f"[Data Sync] Starting character data synchronization from '{PRIMARY_DATA_DIR}', '{VTT_IMPORT_DIR}', and '{HISTORY_DATA_DIR}'...")

    if not os.path.isdir(PRIMARY_DATA_DIR):
        print(f"[Data Sync] Warning: Primary data directory '{PRIMARY_DATA_DIR}' not found. Skipping.")
        print("-" * 50)
        return
    
    if not os.path.isdir(VTT_IMPORT_DIR):
        print(f"[Data Sync] Note: VTT import directory '{VTT_IMPORT_DIR}' not found. Will proceed without VTT data.")
    
    if not os.path.isdir(HISTORY_DATA_DIR):
        print(f"[Data Sync] Note: History data directory '{HISTORY_DATA_DIR}' not found. Will proceed without pre-associating history files.")

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

                # Validate primary data first to get the name
                # Temporarily create an NPCProfile instance just for name extraction
                # This ensures 'name' field exists before we try to use it.
                temp_profile_for_name = NPCProfile(**primary_char_data)
                char_name = temp_profile_for_name.name
                
                fvtt_system_data = None
                fvtt_file_path = find_fvtt_file(char_name, VTT_IMPORT_DIR)

                if fvtt_file_path:
                    try:
                        with open(fvtt_file_path, 'r', encoding='utf-8') as f_vtt:
                            fvtt_json_data = json.load(f_vtt)
                        if 'system' in fvtt_json_data:
                            fvtt_system_data = fvtt_json_data['system']
                            print(f"[Data Sync] -> Found and loaded VTT data for {char_name} from {fvtt_file_path}")
                        else:
                            print(f"[Data Sync] Warning: 'system' key not found in VTT file {fvtt_file_path} for {char_name}.")
                    except json.JSONDecodeError:
                        print(f"[Data Sync] Error: Could not decode JSON from VTT file {fvtt_file_path} for {char_name}.")
                    except Exception as e_vtt:
                        print(f"[Data Sync] Error: An unexpected error occurred with VTT file {fvtt_file_path} for {char_name}: {e_vtt}")
                else:
                    print(f"[Data Sync] -> No matching VTT file found for {char_name} (searched for slug: {slugify(char_name)}).")

                # Attempt to pre-associate history file
                associated_history_file = None
                history_content = None
                potential_history_filename = f"{char_name}.txt" # Assuming history files are named like "Character Name.txt"
                history_file_path_abs = os.path.join(HISTORY_DATA_DIR, potential_history_filename)

                if os.path.exists(history_file_path_abs):
                    try:
                        with open(history_file_path_abs, 'r', encoding='utf-8') as f_hist:
                            history_content = f_hist.read()
                        associated_history_file = potential_history_filename
                        print(f"[Data Sync] -> Found and loaded history file for {char_name}: {potential_history_filename}")
                    except Exception as e_hist:
                        print(f"[Data Sync] Error reading history file {potential_history_filename} for {char_name}: {e_hist}")
                else:
                    print(f"[Data Sync] -> No matching history file found for {char_name} (searched for: {potential_history_filename}).")


                # Combine primary data with VTT data and history data before final validation
                combined_data = primary_char_data.copy() 
                if fvtt_system_data:
                    combined_data['vtt_data'] = fvtt_system_data 
                if associated_history_file:
                    combined_data['associated_history_file'] = associated_history_file
                if history_content:
                    combined_data['history_content'] = history_content
                
                # Validate the combined data structure using the updated NPCProfile model
                validated_profile = NPCProfile(**combined_data)
                
                existing_char_in_db = characters_collection.find_one({"name": char_name})
                
                mongo_doc = validated_profile.model_dump(mode='json', exclude_none=True) 

                if existing_char_in_db:
                    update_payload = {k: v for k, v in mongo_doc.items() if k != '_id'}
                    
                    is_changed = False
                    for key, value in update_payload.items():
                        # Handle nested dicts like vtt_data by comparing them as a whole
                        if isinstance(value, dict) or isinstance(existing_char_in_db.get(key), dict):
                            if json.dumps(existing_char_in_db.get(key), sort_keys=True) != json.dumps(value, sort_keys=True):
                                is_changed = True
                                break
                        elif existing_char_in_db.get(key) != value:
                            is_changed = True
                            break
                    
                    if is_changed:
                        characters_collection.update_one(
                            {"_id": existing_char_in_db['_id']},
                            {"$set": update_payload}
                        )
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
            except json.JSONDecodeError:
                print(f"[Data Sync] Error: Could not decode JSON from {filename}.")
            except Exception as e:
                print(f"[Data Sync] Error: An unexpected error occurred with {filename}: {e}")
    
    print(f"[Data Sync] Finished. Processed: {synced_count} | New in DB: {new_count} | Updated in DB: {updated_count}")
    print("-" * 50 + "\n")


@app.route('/')
def serve_index():
    return render_template('index.html')

@app.route('/api/npcs', methods=['POST'])
def create_npc():
    if mongo_db is None:
        return jsonify({"error": "Database not available"}), 503
    try:
        data = request.get_json()
        if not data: return jsonify({"error": "Invalid JSON payload"}), 400
        # vtt_data, associated_history_file, history_content can be part of the initial creation payload if provided
        # Though typically history would be associated later or via sync
        character_profile_data = NPCProfile(**data) 
    except ValidationError as e:
        return jsonify({"error": "Validation Error", "details": e.errors()}), 400
    except Exception as e:
        return jsonify({"error": f"Invalid request data: {str(e)}"}), 400

    try:
        characters_collection = mongo_db.npcs 
        character_dict = character_profile_data.model_dump(mode='json', exclude_none=True)
        result = characters_collection.insert_one(character_dict)
        # Fetch from DB to include _id and ensure all defaults are present
        created_character_from_db = characters_collection.find_one({"_id": result.inserted_id})
        return jsonify({"message": f"{created_character_from_db.get('character_type', 'Character')} created successfully", 
                        "character": parse_json(created_character_from_db)}), 201
    except Exception as e:
        return jsonify({"error": f"Could not create character: {str(e)}"}), 500

@app.route('/api/npcs', methods=['GET'])
def get_all_npcs():
    if mongo_db is None:
        return jsonify({"error": "Database not available"}), 503
    try:
        characters_cursor = mongo_db.npcs.find({})
        characters_list = []
        for char_doc in characters_cursor:
            char_doc['_id'] = str(char_doc['_id'])
            # Ensure new fields have defaults if missing from older DB entries
            char_doc.setdefault('associated_history_file', None)
            char_doc.setdefault('history_content', None)
            if 'memories' in char_doc and char_doc['memories']:
                for mem in char_doc['memories']:
                    if isinstance(mem.get('memory_id'), ObjectId):
                         mem['memory_id'] = str(mem['memory_id'])
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
    
    # Ensure new fields have defaults if missing
    npc_data.setdefault('associated_history_file', None)
    npc_data.setdefault('history_content', None)
    
    # If associated_history_file exists but history_content is missing (e.g. after a manual DB edit or if sync didn't populate it)
    # try to load it now.
    if npc_data.get("associated_history_file") and not npc_data.get("history_content"):
        history_file_path = os.path.join(HISTORY_DATA_DIR, npc_data["associated_history_file"])
        if os.path.exists(history_file_path):
            try:
                with open(history_file_path, 'r', encoding='utf-8') as f_hist:
                    npc_data["history_content"] = f_hist.read()
            except Exception as e:
                print(f"Error reading history file {npc_data['associated_history_file']} for NPC {npc_id_str} on GET: {e}")
                # Optionally set content to an error message or leave as None
                npc_data["history_content"] = f"Error: Could not load history file {npc_data['associated_history_file']}."
        else:
            npc_data["history_content"] = f"Error: History file {npc_data['associated_history_file']} not found."


    return jsonify(parse_json(npc_data)), 200


@app.route('/api/npcs/<npc_id_str>', methods=['PUT'])
def update_npc(npc_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception:
        return jsonify({"error": "Invalid Character ID format"}), 400
    
    existing_npc_data = mongo_db.npcs.find_one({"_id": npc_id_obj})
    if not existing_npc_data:
        return jsonify({"error": "Character not found for update"}), 404

    try:
        update_data_req = request.get_json()
        if not update_data_req:
            return jsonify({"error": "Invalid JSON payload for update"}), 400
        
        current_data_for_validation = existing_npc_data.copy()
        if '_id' in current_data_for_validation:
            del current_data_for_validation['_id'] 

        merged_for_validation = {**current_data_for_validation, **update_data_req}
        
        validated_update_profile = NPCProfile(**merged_for_validation)
        
        # Note: 'associated_history_file' and 'history_content' are typically managed by their own endpoint
        # or by the sync process. Direct PUT updates to these fields are allowed by the model but might be unusual.
        update_doc_set = validated_update_profile.model_dump(
            mode='json', 
            exclude={'memories', 'linked_lore_ids', '_id'}, 
            exclude_none=True # Important: if a field is None in validated_profile, it won't be in update_doc_set
                              # unless exclude_none is False. For $set, we usually want to update only provided fields.
        )
        
        # To ensure we only $set fields that were actually in the request or are part of the model
        # and avoid wiping existing fields not sent in PUT if they were None in validated_update_profile.
        final_set_payload = {}
        for key, value in update_doc_set.items():
            if key in update_data_req or key in NPCProfile.model_fields:
                 final_set_payload[key] = value
        
        # If 'gm_notes' is explicitly set to empty string in request, allow it to be updated
        if 'gm_notes' in update_data_req and update_data_req['gm_notes'] == "":
            final_set_payload['gm_notes'] = ""


        if not final_set_payload:
            return jsonify({"message": "No valid or changed fields provided for update."}), 200

    except ValidationError as e:
        return jsonify({"error": "Validation Error during update", "details": e.errors()}), 400
    except Exception as e:
        return jsonify({"error": f"Invalid request data for character update: {str(e)}"}), 400

    try:
        result = mongo_db.npcs.update_one({"_id": npc_id_obj}, {"$set": final_set_payload})
        if result.matched_count == 0:
            return jsonify({"error": "Character not found for update (race condition?)"}), 404
        
        updated_npc_data_from_db = mongo_db.npcs.find_one({"_id": npc_id_obj})
        # Ensure new fields are present in the response
        updated_npc_data_from_db.setdefault('associated_history_file', None)
        updated_npc_data_from_db.setdefault('history_content', None)

        if result.modified_count == 0 and not any(key in final_set_payload for key in ['associated_history_file', 'history_content'] if key not in existing_npc_data): # Check if only history fields were "updated" to same value
             return jsonify({"message": "Character data was the same, no changes applied.", "character": parse_json(updated_npc_data_from_db)}), 200
        
        return jsonify({"message": "Character updated successfully", "character": parse_json(updated_npc_data_from_db)}), 200
    except Exception as e:
        return jsonify({"error": f"Could not update character: {str(e)}"}), 500

# --- New API Endpoints for History Files ---
@app.route('/api/history_files', methods=['GET'])
def list_history_files():
    if not os.path.isdir(HISTORY_DATA_DIR):
        print(f"History directory not found: {HISTORY_DATA_DIR}")
        return jsonify({"error": "History directory not found on server."}), 500
    try:
        files = [f for f in os.listdir(HISTORY_DATA_DIR) if f.endswith('.txt') and os.path.isfile(os.path.join(HISTORY_DATA_DIR, f))]
        return jsonify(sorted(files)), 200
    except Exception as e:
        print(f"Error listing history files: {e}")
        return jsonify({"error": f"Could not list history files: {str(e)}"}), 500

@app.route('/api/character/<npc_id_str>/associate_history', methods=['POST'])
def associate_history_file_with_npc(npc_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception:
        return jsonify({"error": "Invalid Character ID format"}), 400

    data = request.get_json()
    history_filename = data.get('history_file')

    if not history_filename:
        return jsonify({"error": "History filename not provided"}), 400

    history_file_path = os.path.join(HISTORY_DATA_DIR, history_filename)
    if not os.path.exists(history_file_path) or not os.path.isfile(history_file_path):
        return jsonify({"error": f"History file '{history_filename}' not found on server."}), 404

    history_content = ""
    try:
        with open(history_file_path, 'r', encoding='utf-8') as f:
            history_content = f.read()
    except Exception as e:
        return jsonify({"error": f"Could not read history file '{history_filename}': {str(e)}"}), 500

    try:
        update_result = mongo_db.npcs.update_one(
            {"_id": npc_id_obj},
            {"$set": {
                "associated_history_file": history_filename,
                "history_content": history_content
            }}
        )
        if update_result.matched_count == 0:
            return jsonify({"error": "Character not found to associate history"}), 404
        
        # Fetch the updated character to return it, including the new history fields
        updated_npc = mongo_db.npcs.find_one({"_id": npc_id_obj})
        updated_npc.setdefault('associated_history_file', history_filename) # ensure it's there
        updated_npc.setdefault('history_content', history_content) # ensure it's there

        return jsonify({
            "message": f"History file '{history_filename}' associated successfully.",
            "character": parse_json(updated_npc), # Send back the full updated character
            "history_content": history_content # Explicitly send history_content for frontend
        }), 200
    except Exception as e:
        return jsonify({"error": f"Could not associate history file: {str(e)}"}), 500


@app.route('/api/npcs/<npc_id_str>/memory', methods=['POST'])
def add_npc_memory(npc_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid Character ID format"}), 400
    
    character_doc = mongo_db.npcs.find_one({"_id": npc_id_obj})
    if not character_doc:
        return jsonify({"error": "Character not found"}), 404
    
    try:
        memory_req_data = request.get_json()
        if not memory_req_data or 'content' not in memory_req_data:
            return jsonify({"error": "Memory content is required"}), 400
        
        memory_item = MemoryItem(
            content=memory_req_data['content'],
            type=memory_req_data.get('type', 'user_added'),
            source=memory_req_data.get('source', 'gm_interface')
        )
    except ValidationError as e:
        return jsonify({"error": "Validation Error for memory item", "details": e.errors()}), 400
    
    try:
        mongo_db.npcs.update_one(
            {"_id": npc_id_obj},
            {"$push": {"memories": memory_item.model_dump(mode='json')}}
        )
        updated_npc = mongo_db.npcs.find_one({"_id": npc_id_obj})
        return jsonify({
            "message": "Memory added successfully", 
            "npc_id": npc_id_str, 
            "new_memory": memory_item.model_dump(mode='json'),
            "updated_memories": parse_json(updated_npc.get("memories", []))
        }), 200
    except Exception as e:
        return jsonify({"error": f"Could not add memory: {str(e)}"}), 500


@app.route('/api/npcs/<npc_id_str>/memory/<memory_id_str>', methods=['DELETE'])
def delete_npc_memory(npc_id_str: str, memory_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception:
        return jsonify({"error": "Invalid Character ID format"}), 400
    
    try:
        update_result = mongo_db.npcs.update_one(
            {"_id": npc_id_obj},
            {"$pull": {"memories": {"memory_id": memory_id_str}}}
        )
        if update_result.matched_count == 0:
            return jsonify({"error": "Character not found"}), 404
        if update_result.modified_count == 0:
            return jsonify({"error": "Memory item not found or already deleted"}), 404
        
        updated_npc = mongo_db.npcs.find_one({"_id": npc_id_obj})
        return jsonify({
            "message": "Memory deleted successfully", 
            "npc_id": npc_id_str,
            "deleted_memory_id": memory_id_str,
            "updated_memories": parse_json(updated_npc.get("memories", []))
        }), 200
    except Exception as e:
        return jsonify({"error": f"Could not delete memory: {str(e)}"}), 500

@app.route('/api/npcs/<npc_id_str>/dialogue', methods=['POST'])
def generate_dialogue_for_npc(npc_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    if ai_service_instance is None or ai_service_instance.model is None:
        return jsonify({"error": "AI Service not available. Please check API key and server logs."}), 503
    
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception:
        return jsonify({"error": "Invalid NPC ID format"}), 400
    
    npc_data_from_db = mongo_db.npcs.find_one({"_id": npc_id_obj})
    if not npc_data_from_db:
        return jsonify({"error": "NPC not found"}), 404
    
    if npc_data_from_db.get('character_type', 'NPC') != 'NPC':
        return jsonify({"error": "Dialogue generation is only supported for NPCs."}), 400
    
    try:
        # Ensure history content is loaded if associated, for the AI prompt
        if npc_data_from_db.get("associated_history_file") and not npc_data_from_db.get("history_content"):
            history_file_path_for_dialogue = os.path.join(HISTORY_DATA_DIR, npc_data_from_db["associated_history_file"])
            if os.path.exists(history_file_path_for_dialogue):
                with open(history_file_path_for_dialogue, 'r', encoding='utf-8') as f_hist_dialogue:
                    npc_data_from_db["history_content"] = f_hist_dialogue.read()
            else: # If file not found, ensure history_content is None or empty for Pydantic
                 npc_data_from_db["history_content"] = None


        npc_profile = NPCProfile(**parse_json(npc_data_from_db))
    except ValidationError as e:
        return jsonify({"error": "NPC data in DB is invalid", "details": e.errors(), "raw_data": parse_json(npc_data_from_db)}), 500
    
    try:
        dialogue_request_data = DialogueRequest(**request.get_json())
    except ValidationError as e:
        return jsonify({"error": "Validation Error in dialogue request", "details": e.errors()}), 400
    
    world_lore_summary = None 
    if npc_profile.linked_lore_ids:
        world_lore_summary = f"This NPC is linked to lore items: {', '.join(npc_profile.linked_lore_ids)}."
    
    # Pass the full npc_profile (which now includes history_content if available)
    generated_text = ai_service_instance.generate_npc_dialogue(npc_profile, dialogue_request_data, world_lore_summary)
    
    memory_suggestions = []
    if dialogue_request_data.player_utterance and generated_text:
        summarized_memory = ai_service_instance.summarize_interaction_for_memory(
            dialogue_request_data.player_utterance,
            generated_text
        )
        memory_suggestions.append(summarized_memory)

    response_data = DialogueResponse(
        npc_id=npc_id_str,
        npc_dialogue=generated_text,
        new_memory_suggestions=memory_suggestions,
        generated_topics=[] 
    )
    return jsonify(response_data.model_dump(mode='json')), 200

# --- Main Execution Block ---
if __name__ == '__main__':
    # Create directories if they don't exist
    for dir_path in [PRIMARY_DATA_DIR, VTT_IMPORT_DIR, HISTORY_DATA_DIR]:
        if not os.path.exists(dir_path):
            os.makedirs(dir_path)
            print(f"Created directory: {dir_path}")
    
    print(f"Data directories: Primary='{PRIMARY_DATA_DIR}', VTT='{VTT_IMPORT_DIR}', History='{HISTORY_DATA_DIR}'")


    if mongo_db is not None:
        sync_data_from_files()
    else:
        print("CRITICAL: Could not connect to MongoDB. Application will run but database operations will fail.")

    if ai_service_instance is None or ai_service_instance.model is None:
        print("CRITICAL: AI Service model not initialized. Dialogue generation will be unavailable. Check server logs and GEMINI_API_KEY.")
    
    print("-" * 50)
    print(f"Flask Secret Key: {'Set' if app_config.FLASK_SECRET_KEY and app_config.FLASK_SECRET_KEY != 'a_default_secret_key' else 'NOT SET or Default'}")
    print(f"Gemini API Key: {'Set' if app_config.GEMINI_API_KEY else 'NOT SET'}")
    print(f"Mongo URI: {app_config.MONGO_URI}")
    print("-" * 50)
    
    print("\n>>> Attempting to start Flask development server...")
    print(">>> If the server starts, you will see 'Running on...' messages below.")
    print(">>> If the script exits back to the command prompt, there is a critical error during startup.")
    print("-" * 50)

    app.run(debug=True, host='0.0.0.0', port=5000)

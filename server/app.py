# app.py
import os
import json
import re # For slugifying names
from flask import Flask, request, jsonify, render_template
from bson import ObjectId, json_util
from pydantic import ValidationError
import traceback # For more detailed error logging
from werkzeug.utils import secure_filename

from config import config as app_config
from database import db_connector
from models import NPCProfile, DialogueRequest, DialogueResponse, MemoryItem, NPCProfileWithHistory
from ai_service import ai_service_instance

app = Flask(__name__)
app.secret_key = app_config.FLASK_SECRET_KEY

mongo_db = db_connector.get_db()

HISTORY_DATA_DIR = os.path.join(os.path.dirname(__file__), 'data', 'history')
PRIMARY_DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
VTT_IMPORT_DIR = os.path.join(os.path.dirname(__file__), 'data', 'vtt_imports')


def parse_json(data):
    return json.loads(json_util.dumps(data))

def slugify(text):
    text = str(text).lower()
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
    history_contents_loaded = {}
    combined_content_parts = []
    if 'associated_history_files' in npc_doc and npc_doc['associated_history_files']:
        for history_filename in npc_doc['associated_history_files']:
            safe_history_filename = secure_filename(history_filename)
            file_path = os.path.join(HISTORY_DATA_DIR, safe_history_filename)
            if os.path.exists(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        history_contents_loaded[history_filename] = content
                        combined_content_parts.append(f"--- From: {history_filename} ---\n{content}\n")
                except Exception as e:
                    print(f"Error reading history file {safe_history_filename} for NPC {npc_doc.get('name', 'Unknown')}: {e}")
                    history_contents_loaded[history_filename] = f"[Error loading content for {safe_history_filename}]"
                    combined_content_parts.append(f"--- From: {history_filename} ---\n[Error loading content]\n")
            else:
                print(f"Warning: History file '{safe_history_filename}' not found at '{file_path}' for NPC {npc_doc.get('name', 'Unknown')}.")
                history_contents_loaded[history_filename] = "[File not found]"
                combined_content_parts.append(f"--- From: {history_filename} ---\n[File not found]\n")

    npc_doc['history_contents_loaded'] = history_contents_loaded
    npc_doc['combined_history_content'] = "\n".join(combined_content_parts).strip() if combined_content_parts else ""
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

                combined_data = primary_char_data.copy()

                # Load and merge VTT data if available
                fvtt_file_path = find_fvtt_file(char_name, VTT_IMPORT_DIR)
                if fvtt_file_path:
                    with open(fvtt_file_path, 'r', encoding='utf-8') as f_vtt:
                        fvtt_json_data = json.load(f_vtt)
                    if 'system' in fvtt_json_data:
                        combined_data['vtt_data'] = fvtt_json_data['system']
                    if 'flags' in fvtt_json_data: # Store VTT flags
                        combined_data['vtt_flags'] = fvtt_json_data['flags']
                    if 'img' in fvtt_json_data and fvtt_json_data['img']: # Store VTT image path
                        combined_data['img'] = fvtt_json_data['img']
                    if 'items' in fvtt_json_data: # Store VTT items
                        combined_data['items'] = fvtt_json_data['items']
                    # Store the full system object if needed for more complex frontend logic
                    # This might be redundant if vtt_data is already the system object
                    if 'system' in fvtt_json_data:
                         combined_data['system'] = fvtt_json_data['system']


                # Associate default history file if it exists
                if 'associated_history_files' not in combined_data:
                    combined_data['associated_history_files'] = []
                potential_history_filename = f"{char_name}.txt"
                history_file_path_abs = os.path.join(HISTORY_DATA_DIR, secure_filename(potential_history_filename))
                if os.path.exists(history_file_path_abs):
                    if potential_history_filename not in combined_data['associated_history_files']:
                        combined_data['associated_history_files'].append(potential_history_filename)

                validated_profile = NPCProfile(**combined_data)
                mongo_doc = validated_profile.model_dump(mode='json', by_alias=True, exclude_none=True)

                existing_char_in_db = characters_collection.find_one({"name": char_name})

                if existing_char_in_db:
                    update_payload = {k: v for k, v in mongo_doc.items() if k != '_id'}
                    # A more robust check might be needed if complex nested objects change often
                    if json_util.dumps(existing_char_in_db, sort_keys=True) != json_util.dumps({**existing_char_in_db, **update_payload}, sort_keys=True):
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
                traceback.print_exc()

    print(f"[Data Sync] Finished. Processed: {synced_count} | New: {new_count} | Updated: {updated_count}")
    print("-" * 50 + "\n")


@app.route('/')
def serve_index():
    return render_template('index.html')

@app.route('/api/npcs', methods=['POST'])
def create_npc_api():
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        data = request.get_json()
        if not data: return jsonify({"error": "Invalid JSON payload"}), 400
        data.setdefault('associated_history_files', [])
        # Ensure vtt_data and vtt_flags are at least empty dicts if not provided
        data.setdefault('vtt_data', {})
        data.setdefault('vtt_flags', {})
        data.setdefault('items', [])
        data.setdefault('system', {})


        character_profile_data = NPCProfile(**data)
    except ValidationError as e:
        return jsonify({"error": "Validation Error", "details": e.errors()}), 400

    try:
        characters_collection = mongo_db.npcs
        character_dict = character_profile_data.model_dump(mode='json', by_alias=True, exclude_none=True)
        result = characters_collection.insert_one(character_dict)
        created_character_from_db = characters_collection.find_one({"_id": result.inserted_id})

        if created_character_from_db:
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
def get_all_npcs_api():
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        characters_cursor = mongo_db.npcs.find({})
        characters_list = []
        for char_doc in characters_cursor:
            char_doc['_id'] = str(char_doc['_id'])
            char_doc.setdefault('associated_history_files', [])
            char_doc.setdefault('combined_history_content', '')
            char_doc.setdefault('vtt_data', {}) # Ensure these exist for frontend
            char_doc.setdefault('vtt_flags', {})
            char_doc.setdefault('img', None)
            char_doc.setdefault('items', [])
            char_doc.setdefault('system', {})
            characters_list.append(char_doc)
        return jsonify(characters_list), 200
    except Exception as e:
        print(f"Error in get_all_npcs_api: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Could not retrieve characters: {str(e)}"}), 500

@app.route('/api/npcs/<npc_id_str>', methods=['GET'])
def get_npc_api(npc_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception:
        return jsonify({"error": "Invalid Character ID format"}), 400

    npc_data = mongo_db.npcs.find_one({"_id": npc_id_obj})
    if not npc_data:
        return jsonify({"error": "Character not found"}), 404

    npc_data.setdefault('associated_history_files', [])
    npc_data.setdefault('vtt_data', {}) # Ensure these exist for frontend
    npc_data.setdefault('vtt_flags', {})
    npc_data.setdefault('img', None)
    npc_data.setdefault('items', [])
    npc_data.setdefault('system', {})
    npc_data_with_history = load_history_content_for_npc(npc_data)

    return jsonify(parse_json(npc_data_with_history)), 200

@app.route('/api/npcs/<npc_id_str>', methods=['PUT'])
def update_npc_api(npc_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid Character ID format"}), 400

    existing_npc_data = mongo_db.npcs.find_one({"_id": npc_id_obj})
    if not existing_npc_data: return jsonify({"error": "Character not found for update"}), 404

    try:
        update_data_req = request.get_json()
        if not update_data_req: return jsonify({"error": "Invalid JSON payload"}), 400

        # Ensure fields from the model that are not in the request but are in existing_npc_data are preserved
        # for validation, and ensure vtt_data/vtt_flags are dicts if present
        current_data_for_validation = {
            **{k: v for k, v in existing_npc_data.items() if k != '_id'}, 
            **update_data_req
        }
        current_data_for_validation.setdefault('vtt_data', {})
        current_data_for_validation.setdefault('vtt_flags', {})
        current_data_for_validation.setdefault('items', [])
        current_data_for_validation.setdefault('system', {})


        if 'associated_history_files' in current_data_for_validation and \
           not isinstance(current_data_for_validation['associated_history_files'], list):
            current_data_for_validation['associated_history_files'] = [current_data_for_validation['associated_history_files']]

        validated_update_profile = NPCProfile(**current_data_for_validation)
        
        # Prepare the $set payload: only include fields that were actually in the request
        # or fields that have default values in Pydantic and might need to be set if not present.
        # For direct updates, we primarily care about fields explicitly sent by the client.
        final_set_payload = {}
        for key, value in validated_update_profile.model_dump(mode='json', by_alias=True, exclude_none=False).items():
            if key in update_data_req: # Only update fields that were in the request
                 final_set_payload[key] = update_data_req[key] # Use the exact value from request
            elif key == 'gm_notes' and 'gm_notes' not in update_data_req and existing_npc_data.get('gm_notes') is not None:
                # If gm_notes is not in request, but exists, keep it (don't set to None unless explicitly requested)
                # This case is tricky; usually, if a field is not in PUT, it's not changed.
                # Pydantic's exclude_none=False might set it to None if not in request.
                # Let's ensure we only update what's in update_data_req for simplicity here.
                pass


        # Specifically handle gm_notes if it's explicitly set to empty string in request
        if 'gm_notes' in update_data_req and update_data_req['gm_notes'] == "":
            final_set_payload['gm_notes'] = ""
        
        # If only _id or other non-updatable fields were in update_data_req, final_set_payload might be empty
        if not final_set_payload:
             updated_npc_data_from_db = mongo_db.npcs.find_one({"_id": npc_id_obj}) # Re-fetch to be sure
             if updated_npc_data_from_db:
                updated_npc_data_from_db = load_history_content_for_npc(updated_npc_data_from_db)
                return jsonify({"message": "No changes applied to the character.", "character": parse_json(updated_npc_data_from_db)}), 200
             else: # Should not happen if existing_npc_data was found
                return jsonify({"error": "Character disappeared after update attempt"}), 500


    except ValidationError as e:
        print(f"Validation Error during update for NPC {npc_id_str}: {e.errors()}")
        return jsonify({"error": "Validation Error during update", "details": e.errors()}), 400

    try:
        result = mongo_db.npcs.update_one({"_id": npc_id_obj}, {"$set": final_set_payload})

        updated_npc_data_from_db = mongo_db.npcs.find_one({"_id": npc_id_obj})
        if updated_npc_data_from_db:
            updated_npc_data_from_db = load_history_content_for_npc(updated_npc_data_from_db)
            return jsonify({"message": "Character updated", "character": parse_json(updated_npc_data_from_db)}), 200
        else:
            return jsonify({"error": "Failed to retrieve updated character"}), 500
    except Exception as e:
        print(f"Error updating NPC {npc_id_str}: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Could not update character: {str(e)}"}), 500

@app.route('/api/history_files', methods=['GET'])
def list_history_files_api():
    if not os.path.isdir(HISTORY_DATA_DIR):
        print(f"Warning: History directory not found at {HISTORY_DATA_DIR}. Creating it.")
        try:
            os.makedirs(HISTORY_DATA_DIR, exist_ok=True)
            return jsonify([]), 200
        except Exception as e:
            print(f"Error creating history directory {HISTORY_DATA_DIR}: {e}")
            return jsonify({"error": f"Could not access or create history directory: {str(e)}"}), 500
    try:
        files = [f for f in os.listdir(HISTORY_DATA_DIR) if f.endswith('.txt') and os.path.isfile(os.path.join(HISTORY_DATA_DIR, f))]
        return jsonify(sorted(files)), 200
    except Exception as e:
        print(f"Error listing history files: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Could not list history files: {str(e)}"}), 500

@app.route('/api/character/<npc_id_str>/associate_history', methods=['POST'])
def associate_history_file_with_npc_api(npc_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid Character ID format"}), 400

    data = request.get_json()
    history_filename_from_req = data.get('history_file')
    if not history_filename_from_req: return jsonify({"error": "history_file not provided"}), 400

    history_filename = secure_filename(history_filename_from_req)

    history_file_path = os.path.join(HISTORY_DATA_DIR, history_filename)
    if not os.path.exists(history_file_path):
        print(f"Attempted to associate non-existent history file: {history_file_path}")
        return jsonify({"error": f"History file '{history_filename}' not found on server."}), 404

    try:
        update_result = mongo_db.npcs.update_one(
            {"_id": npc_id_obj},
            {"$addToSet": {"associated_history_files": history_filename}} # Use original name for DB storage
        )
        if update_result.matched_count == 0: return jsonify({"error": "Character not found"}), 404

        npc_doc = mongo_db.npcs.find_one({"_id": npc_id_obj})
        if npc_doc:
            npc_doc_with_history = load_history_content_for_npc(npc_doc)
            return jsonify({
                "message": f"History file '{history_filename_from_req}' associated.", # Use original name in message
                "character": parse_json(npc_doc_with_history)
            }), 200
        else:
             return jsonify({"error": "Failed to retrieve updated character after history association"}), 500
    except Exception as e:
        print(f"Error associating history for {npc_id_str}: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Could not associate history: {str(e)}"}), 500

@app.route('/api/character/<npc_id_str>/dissociate_history', methods=['POST'])
def dissociate_history_file_from_npc_api(npc_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid Character ID format"}), 400

    data = request.get_json()
    history_filename_from_req = data.get('history_file')
    if not history_filename_from_req: return jsonify({"error": "history_file not provided"}), 400

    # Store and operate with the original filename as it's stored in DB
    # secure_filename was for path construction, not for DB value matching.

    try:
        update_result = mongo_db.npcs.update_one(
            {"_id": npc_id_obj},
            {"$pull": {"associated_history_files": history_filename_from_req}} # Use original name
        )
        if update_result.matched_count == 0: return jsonify({"error": "Character not found"}), 404

        npc_doc = mongo_db.npcs.find_one({"_id": npc_id_obj})
        if npc_doc:
            npc_doc_with_history = load_history_content_for_npc(npc_doc)
            message = f"History file '{history_filename_from_req}' dissociated."
            if update_result.modified_count == 0 :
                 message = f"File '{history_filename_from_req}' was not associated or already removed."

            return jsonify({
                "message": message,
                "character": parse_json(npc_doc_with_history)
            }), 200
        else:
            return jsonify({"error": "Failed to retrieve updated character after history dissociation"}), 500

    except Exception as e:
        print(f"Error dissociating history for {npc_id_str}: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Could not dissociate history: {str(e)}"}), 500


@app.route('/api/npcs/<npc_id_str>/memory', methods=['POST'])
def add_npc_memory_api(npc_id_str: str):
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
    if updated_npc:
        return jsonify({"message": "Memory added", "updated_memories": parse_json(updated_npc.get("memories", []))}), 200
    else:
        return jsonify({"error": "Failed to retrieve updated NPC after adding memory"}), 500

@app.route('/api/npcs/<npc_id_str>/memory/<memory_id_str_path>', methods=['DELETE'])
def delete_npc_memory_api(npc_id_str: str, memory_id_str_path: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try: npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid NPC ID"}), 400

    result = mongo_db.npcs.update_one({"_id": npc_id_obj}, {"$pull": {"memories": {"memory_id": memory_id_str_path}}})
    if result.matched_count == 0: return jsonify({"error": "NPC not found"}), 404
    if result.modified_count == 0: return jsonify({"error": "Memory not found or already deleted"}), 404

    updated_npc = mongo_db.npcs.find_one({"_id": npc_id_obj})
    if updated_npc:
        return jsonify({"message": "Memory deleted", "updated_memories": parse_json(updated_npc.get("memories", []))}), 200
    else:
        return jsonify({"error": "Failed to retrieve updated NPC after deleting memory"}), 500

@app.route('/api/npcs/<npc_id_str>/dialogue', methods=['POST'])
def generate_dialogue_for_npc_api(npc_id_str: str):
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
        npc_profile_for_ai = NPCProfile(**parse_json(npc_data_with_history))
    except ValidationError as e:
        print(f"Pydantic validation error for NPC {npc_id_str} before AI call: {e.errors()}")
        return jsonify({"error": "NPC data from DB is invalid", "details": e.errors()}), 500

    try:
        dialogue_req_payload = request.get_json()
        dialogue_req_data = DialogueRequest(**dialogue_req_payload)
    except ValidationError as e:
        return jsonify({"error": "Dialogue request invalid", "details": e.errors()}), 400

    detailed_history_for_ai = npc_data_with_history.get('combined_history_content', '')
    
    print(f"DEBUG: Generating dialogue for {npc_profile_for_ai.name}. History length: {len(detailed_history_for_ai)}")

    try:
        generated_text_or_error = ai_service_instance.generate_npc_dialogue(
            npc=npc_profile_for_ai,
            dialogue_request=dialogue_req_data,
            world_lore_summary=None,
            detailed_character_history=detailed_history_for_ai
        )
        
        if generated_text_or_error.startswith("Error:") or "AI generation blocked" in generated_text_or_error :
             print(f"AI Service returned an error message for {npc_profile_for_ai.name}: {generated_text_or_error}")
        generated_text = generated_text_or_error

    except Exception as e:
        print(f"Error calling AI service for {npc_profile_for_ai.name}: {e}")
        traceback.print_exc()
        return jsonify({"error": "Dialogue generation failed internally due to an unexpected AI service error.", "details": str(e)}), 500

    memory_suggestions = []
    if dialogue_req_data.player_utterance and generated_text and not (generated_text.startswith("Error:") or "AI generation blocked" in generated_text):
        summarized_memory = ai_service_instance.summarize_interaction_for_memory(
            dialogue_req_data.player_utterance, generated_text
        )
        memory_suggestions.append(summarized_memory)

    response_data_model = DialogueResponse(
        npc_id=npc_id_str,
        npc_dialogue=generated_text,
        new_memory_suggestions=memory_suggestions,
        generated_topics=[]
    )
    return jsonify(response_data_model.model_dump(mode='json')), 200

if __name__ == '__main__':
    for dir_path in [PRIMARY_DATA_DIR, VTT_IMPORT_DIR, HISTORY_DATA_DIR]:
        if not os.path.exists(dir_path):
            os.makedirs(dir_path)
            print(f"Created directory: {dir_path}")

    print(f"Data directories: Primary='{PRIMARY_DATA_DIR}', VTT='{VTT_IMPORT_DIR}', History='{HISTORY_DATA_DIR}'")

    if mongo_db is not None:
        sync_data_from_files()
    else:
        print("CRITICAL: MongoDB connection failed. Data sync skipped and app may not function correctly.")

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

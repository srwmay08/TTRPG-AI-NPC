# app.py
import os
import json
import re 
from flask import Flask, request, jsonify, render_template
from bson import ObjectId, json_util
from pydantic import ValidationError
import traceback 
from werkzeug.utils import secure_filename
from typing import Optional, List, Dict, Any, Union # Added Union
from enum import Enum # If FactionStandingLevel is used directly here

from config import config as app_config
from database import db_connector
from models import NPCProfile, DialogueRequest, DialogueResponse, MemoryItem, NPCProfileWithHistory, FactionStandingLevel
from ai_service import ai_service_instance

app = Flask(__name__)
app.secret_key = app_config.FLASK_SECRET_KEY
mongo_db = db_connector.get_db()
HISTORY_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'history') # More robust path
PRIMARY_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
VTT_IMPORT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'vtt_imports')

# Global for npc_profile_for_ai for potential use in parse_ai_suggestions error case
npc_profile_for_ai: Optional[NPCProfile] = None


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

def load_history_content_for_npc(npc_doc: Dict[str, Any]) -> Dict[str, Any]:
    npc_doc.setdefault('pc_faction_standings', {})
    history_contents_loaded = {}
    combined_content_parts = []
    
    # Ensure HISTORY_DATA_DIR is correctly resolved if it's relative
    abs_history_data_dir = os.path.abspath(HISTORY_DATA_DIR)
    # print(f"DEBUG: Absolute history data dir: {abs_history_data_dir}") # For debugging path issues

    if 'associated_history_files' in npc_doc and npc_doc['associated_history_files']:
        for history_filename in npc_doc['associated_history_files']:
            if not history_filename or not isinstance(history_filename, str): # Skip if None or not a string
                print(f"Warning: Invalid history filename found for NPC {npc_doc.get('name', 'Unknown')}: {history_filename}")
                continue

            safe_history_filename = secure_filename(history_filename) 
            file_path = os.path.join(abs_history_data_dir, safe_history_filename)
            # print(f"DEBUG: Attempting to load history file: {file_path} (Original: {history_filename})")

            if os.path.exists(file_path) and os.path.isfile(file_path): # Added isfile check
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        history_contents_loaded[history_filename] = content
                        combined_content_parts.append(f"--- From: {history_filename} ---\n{content}\n")
                        # print(f"DEBUG: Successfully loaded history file: {history_filename}")
                except Exception as e:
                    print(f"Error reading history file {safe_history_filename} for NPC {npc_doc.get('name', 'Unknown')}: {e}")
                    history_contents_loaded[history_filename] = f"[Error loading content for {safe_history_filename}]"
            else:
                print(f"Warning: History file '{safe_history_filename}' not found at '{file_path}' for NPC {npc_doc.get('name', 'Unknown')}.")
                history_contents_loaded[history_filename] = "[File not found]"
    
    npc_doc['history_contents_loaded'] = history_contents_loaded
    npc_doc['combined_history_content'] = "\n".join(combined_content_parts).strip() if combined_content_parts else "No history content loaded." # Provide clearer default
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

                char_name_temp = primary_char_data.get("name")
                if not char_name_temp:
                    print(f"[Data Sync] Skipping {filename}: missing 'name' field.")
                    continue
                
                primary_char_data.setdefault('pc_faction_standings', {})

                combined_data = primary_char_data.copy()
                
                fvtt_file_path = find_fvtt_file(char_name_temp, VTT_IMPORT_DIR)
                if fvtt_file_path:
                    with open(fvtt_file_path, 'r', encoding='utf-8') as f_vtt:
                        fvtt_json_data = json.load(f_vtt)
                    if 'system' in fvtt_json_data: combined_data['vtt_data'] = fvtt_json_data['system']
                    if 'flags' in fvtt_json_data: combined_data['vtt_flags'] = fvtt_json_data['flags']
                    if 'img' in fvtt_json_data and fvtt_json_data['img']: combined_data['img'] = fvtt_json_data['img']
                    if 'items' in fvtt_json_data: combined_data['items'] = fvtt_json_data['items']
                    if 'system' in fvtt_json_data: combined_data['system'] = fvtt_json_data['system']

                combined_data.setdefault('associated_history_files', [])
                potential_history_filename = f"{char_name_temp}.txt" 
                history_file_path_abs = os.path.join(HISTORY_DATA_DIR, secure_filename(potential_history_filename))
                if os.path.exists(history_file_path_abs) and os.path.isfile(history_file_path_abs):
                    if potential_history_filename not in combined_data['associated_history_files']:
                        combined_data['associated_history_files'].append(potential_history_filename)
                
                validated_profile = NPCProfile(**combined_data)
                mongo_doc = validated_profile.model_dump(mode='json', by_alias=True, exclude_none=True)

                existing_char_in_db = characters_collection.find_one({"name": char_name_temp})

                if existing_char_in_db:
                    update_payload = {k: v for k, v in mongo_doc.items() if k != '_id'}
                    # Ensure pc_faction_standings from DB is preserved if not in the update payload from file,
                    # but allow file to overwrite if it's present there.
                    if 'pc_faction_standings' not in update_payload: # If file has no standings
                        update_payload['pc_faction_standings'] = existing_char_in_db.get('pc_faction_standings', {})
                    # else: use the standings from the file (already in update_payload via mongo_doc)
                    
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
def serve_index(): # ... (same as before)
    return render_template('index.html')

@app.route('/api/npcs', methods=['POST'])
def create_npc_api(): # ... (same as before, pc_faction_standings default is good)
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        data = request.get_json()
        if not data: return jsonify({"error": "Invalid JSON payload"}), 400
        data.setdefault('associated_history_files', [])
        data.setdefault('vtt_data', {})
        data.setdefault('vtt_flags', {})
        data.setdefault('items', [])
        data.setdefault('system', {})
        data.setdefault('pc_faction_standings', {}) 

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
def get_all_npcs_api(): # ... (same as before, pc_faction_standings default is good)
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        characters_cursor = mongo_db.npcs.find({})
        characters_list = []
        for char_doc in characters_cursor:
            char_doc['_id'] = str(char_doc['_id'])
            char_doc.setdefault('associated_history_files', [])
            char_doc.setdefault('combined_history_content', '')
            char_doc.setdefault('vtt_data', {}) 
            char_doc.setdefault('vtt_flags', {})
            char_doc.setdefault('img', None)
            char_doc.setdefault('items', [])
            char_doc.setdefault('system', {})
            char_doc.setdefault('pc_faction_standings', {}) 
            characters_list.append(char_doc)
        return jsonify(characters_list), 200
    except Exception as e:
        print(f"Error in get_all_npcs_api: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Could not retrieve characters: {str(e)}"}), 500

@app.route('/api/npcs/<npc_id_str>', methods=['GET'])
def get_npc_api(npc_id_str: str): # ... (same as before, pc_faction_standings default is good)
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception:
        return jsonify({"error": "Invalid Character ID format"}), 400

    npc_data = mongo_db.npcs.find_one({"_id": npc_id_obj})
    if not npc_data:
        return jsonify({"error": "Character not found"}), 404

    # Ensure all potentially missing fields (especially new ones) have defaults before sending
    npc_data.setdefault('associated_history_files', [])
    npc_data.setdefault('vtt_data', {}) 
    npc_data.setdefault('vtt_flags', {})
    npc_data.setdefault('img', None)
    npc_data.setdefault('items', [])
    npc_data.setdefault('system', {})
    npc_data.setdefault('pc_faction_standings', {}) 
    
    npc_data_with_history = load_history_content_for_npc(npc_data)

    return jsonify(parse_json(npc_data_with_history)), 200

@app.route('/api/npcs/<npc_id_str>', methods=['PUT'])
def update_npc_api(npc_id_str: str): # ... (same as before, ensure pc_faction_standings logic is robust)
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid Character ID format"}), 400

    existing_npc_data = mongo_db.npcs.find_one({"_id": npc_id_obj})
    if not existing_npc_data: return jsonify({"error": "Character not found for update"}), 404

    try:
        update_data_req = request.get_json()
        if not update_data_req: return jsonify({"error": "Invalid JSON payload"}), 400

        # Start with existing data, then overlay request data for validation
        current_data_for_validation = {**existing_npc_data, **update_data_req}
        # Remove _id before Pydantic validation if it's present from existing_npc_data
        current_data_for_validation.pop('_id', None) 
        
        # Ensure defaults for potentially missing nested dicts if not in request or existing
        current_data_for_validation.setdefault('vtt_data', {})
        current_data_for_validation.setdefault('vtt_flags', {})
        current_data_for_validation.setdefault('items', [])
        current_data_for_validation.setdefault('system', {})
        current_data_for_validation.setdefault('pc_faction_standings', existing_npc_data.get('pc_faction_standings', {}))


        if 'associated_history_files' in current_data_for_validation and \
           not isinstance(current_data_for_validation['associated_history_files'], list):
            current_data_for_validation['associated_history_files'] = [current_data_for_validation['associated_history_files']]

        validated_update_profile = NPCProfile(**current_data_for_validation)
        
        # Use only fields from the request for the $set payload
        # Pydantic dump of validated_update_profile would include defaults for fields not in request
        final_set_payload = {}
        for key, value in update_data_req.items():
            if key in validated_update_profile.model_fields: # Check if key is part of our model
                # For Enums like FactionStandingLevel, Pydantic stores them as Enum members.
                # MongoDB needs the string value.
                if isinstance(getattr(validated_update_profile, key), Enum):
                     final_set_payload[key] = getattr(validated_update_profile, key).value
                elif key == 'pc_faction_standings': # Special handling for dict of enums
                    standings_dict = getattr(validated_update_profile, key)
                    final_set_payload[key] = {pc_id: standing.value for pc_id, standing in standings_dict.items()}
                else:
                    final_set_payload[key] = getattr(validated_update_profile, key)


        if not final_set_payload:
             updated_npc_data_from_db = mongo_db.npcs.find_one({"_id": npc_id_obj}) 
             if updated_npc_data_from_db:
                updated_npc_data_from_db = load_history_content_for_npc(updated_npc_data_from_db)
                return jsonify({"message": "No valid changes applied to the character.", "character": parse_json(updated_npc_data_from_db)}), 200
             else: 
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
def list_history_files_api(): # ... (same as before)
    abs_history_data_dir = os.path.abspath(HISTORY_DATA_DIR)
    if not os.path.isdir(abs_history_data_dir):
        print(f"Warning: History directory not found at {abs_history_data_dir}. Creating it.")
        try:
            os.makedirs(abs_history_data_dir, exist_ok=True)
            return jsonify([]), 200
        except Exception as e:
            print(f"Error creating history directory {abs_history_data_dir}: {e}")
            return jsonify({"error": f"Could not access or create history directory: {str(e)}"}), 500
    try:
        files = [f for f in os.listdir(abs_history_data_dir) if f.endswith('.txt') and os.path.isfile(os.path.join(abs_history_data_dir, f))]
        return jsonify(sorted(files)), 200
    except Exception as e:
        print(f"Error listing history files: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Could not list history files: {str(e)}"}), 500

@app.route('/api/character/<npc_id_str>/associate_history', methods=['POST'])
def associate_history_file_with_npc_api(npc_id_str: str): # ... (same as before)
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid Character ID format"}), 400

    data = request.get_json()
    history_filename_from_req = data.get('history_file')
    if not history_filename_from_req: return jsonify({"error": "history_file not provided"}), 400

    history_filename_secure = secure_filename(history_filename_from_req) 
    abs_history_data_dir = os.path.abspath(HISTORY_DATA_DIR)
    history_file_path = os.path.join(abs_history_data_dir, history_filename_secure)

    if not os.path.exists(history_file_path) or not os.path.isfile(history_file_path):
        print(f"Attempted to associate non-existent history file: {history_file_path} (Original: {history_filename_from_req})")
        return jsonify({"error": f"History file '{history_filename_from_req}' not found on server."}), 404

    try:
        update_result = mongo_db.npcs.update_one(
            {"_id": npc_id_obj},
            {"$addToSet": {"associated_history_files": history_filename_from_req}} 
        )
        if update_result.matched_count == 0: return jsonify({"error": "Character not found"}), 404

        npc_doc = mongo_db.npcs.find_one({"_id": npc_id_obj})
        if npc_doc:
            npc_doc_with_history = load_history_content_for_npc(npc_doc)
            return jsonify({
                "message": f"History file '{history_filename_from_req}' associated.", 
                "character": parse_json(npc_doc_with_history)
            }), 200
        else:
             return jsonify({"error": "Failed to retrieve updated character after history association"}), 500
    except Exception as e:
        print(f"Error associating history for {npc_id_str}: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Could not associate history: {str(e)}"}), 500


@app.route('/api/character/<npc_id_str>/dissociate_history', methods=['POST'])
def dissociate_history_file_from_npc_api(npc_id_str: str): # ... (same as before)
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid Character ID format"}), 400

    data = request.get_json()
    history_filename_from_req = data.get('history_file')
    if not history_filename_from_req: return jsonify({"error": "history_file not provided"}), 400
    
    try:
        update_result = mongo_db.npcs.update_one(
            {"_id": npc_id_obj},
            {"$pull": {"associated_history_files": history_filename_from_req}}
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
def add_npc_memory_api(npc_id_str: str): # ... (same as before)
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
def delete_npc_memory_api(npc_id_str: str, memory_id_str_path: str): # ... (same as before)
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


def parse_ai_suggestions(full_ai_output: str, speaking_pc_id: Optional[str]) -> Dict[str, Any]:
    # Ensure npc_profile_for_ai is accessible or passed if needed for fallback name
    npc_name_fallback = "NPC"
    if 'npc_profile_for_ai' in globals() and npc_profile_for_ai:
        npc_name_fallback = npc_profile_for_ai.name

    dialogue_parts = []
    npc_action_str = "None"
    player_check_str = "None"
    new_standing_str = "No change"
    justification_str = "Not specified"
    
    # Key for parsing suggestions related to the speaker
    suggestion_pc_key = speaking_pc_id if speaking_pc_id and speaking_pc_id.strip() != "" else "PLAYER"

    lines = full_ai_output.splitlines()
    dialogue_section_ended = False

    # Attempt to find the "--- END OF DIALOGUE ---" marker
    end_dialogue_marker = "--- END OF DIALOGUE ---"
    dialogue_end_index = -1
    for i, line in enumerate(lines):
        if end_dialogue_marker in line:
            dialogue_end_index = i
            break
    
    if dialogue_end_index != -1:
        dialogue_parts = lines[:dialogue_end_index]
        suggestion_lines = lines[dialogue_end_index + 1:]
    else: # Fallback if marker not found, assume suggestions are at the end after keywords
        suggestion_lines = []
        temp_dialogue_parts = []
        keywords_found = False
        for line in lines:
            stripped_line = line.strip()
            if any(stripped_line.startswith(kw) for kw in ["NPC_ACTION:", "PLAYER_CHECK:", f"STANDING_CHANGE_SUGGESTION_FOR_{suggestion_pc_key}:", "JUSTIFICATION:"]):
                keywords_found = True
            if keywords_found:
                suggestion_lines.append(line)
            else:
                temp_dialogue_parts.append(line)
        dialogue_parts = temp_dialogue_parts


    for line in suggestion_lines:
        stripped_line = line.strip()
        if stripped_line.startswith("NPC_ACTION:"):
            npc_action_str = stripped_line.replace("NPC_ACTION:", "").strip()
        elif stripped_line.startswith("PLAYER_CHECK:"):
            player_check_str = stripped_line.replace("PLAYER_CHECK:", "").strip()
        elif stripped_line.startswith(f"STANDING_CHANGE_SUGGESTION_FOR_{suggestion_pc_key}:"):
            new_standing_str = stripped_line.replace(f"STANDING_CHANGE_SUGGESTION_FOR_{suggestion_pc_key}:", "").strip()
        elif stripped_line.startswith("JUSTIFICATION:"):
            justification_str = stripped_line.replace("JUSTIFICATION:", "").strip()
    
    npc_dialogue_final = "\n".join(dialogue_parts).strip()
    if not npc_dialogue_final and (npc_action_str != "None" or player_check_str != "None" or new_standing_str != "No change"):
        npc_dialogue_final = f"({npc_name_fallback} considers the situation...)"


    parsed_new_standing_enum = None
    if new_standing_str and new_standing_str.lower() not in ["no change", "none", ""]:
        try:
            parsed_new_standing_enum = FactionStandingLevel(new_standing_str)
        except ValueError:
            print(f"Warning: AI suggested an invalid standing level: '{new_standing_str}' for PC '{suggestion_pc_key}'")
            justification_str += f" (AI suggested invalid standing: {new_standing_str})"
            # new_standing_str remains the AI's output for transparency if it's invalid
    
    return {
        "dialogue": npc_dialogue_final if npc_dialogue_final else "(No dialogue response)",
        "npc_action": [npc_action_str] if npc_action_str and npc_action_str.lower() != "none" else [],
        "player_check": [player_check_str] if player_check_str and player_check_str.lower() != "none" else [],
        "new_standing": parsed_new_standing_enum, 
        "new_standing_str_for_response": new_standing_str, 
        "justification": justification_str
    }

@app.route('/api/npcs/<npc_id_str>/dialogue', methods=['POST'])
def generate_dialogue_for_npc_api(npc_id_str: str):
    # ... (existing setup, NPC fetching, validation) ...
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
    
    global npc_profile_for_ai 
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
    
    current_pc_standing_val = None
    speaking_pc_name_for_ai = "the player" 
    
    actual_speaking_pc_id = dialogue_req_data.speaking_pc_id if dialogue_req_data.speaking_pc_id and dialogue_req_data.speaking_pc_id.strip() != "" else None

    if actual_speaking_pc_id:
        current_pc_standing_val = npc_profile_for_ai.pc_faction_standings.get(actual_speaking_pc_id)
        try:
            pc_object_id_val = ObjectId(actual_speaking_pc_id) # Validate if it's an ObjectId
            pc_object_found = mongo_db.npcs.find_one({"_id": pc_object_id_val, "character_type": "PC"})
            if pc_object_found:
                speaking_pc_name_for_ai = pc_object_found.get("name", actual_speaking_pc_id)
            else: 
                # If ID is valid ObjectId but not found as PC, use ID as name.
                # Or it might be a name passed if UI allows selecting by name directly.
                # For now, assume ID is mostly used.
                speaking_pc_name_for_ai = actual_speaking_pc_id 
        except Exception: # Not a valid ObjectId, assume it might be a name or placeholder
            speaking_pc_name_for_ai = actual_speaking_pc_id
            # Attempt to find PC by name if an ID wasn't successfully used
            pc_by_name = mongo_db.npcs.find_one({"name": actual_speaking_pc_id, "character_type": "PC"})
            if pc_by_name: # If found by name, use its ID for standing lookup
                current_pc_standing_val = npc_profile_for_ai.pc_faction_standings.get(str(pc_by_name['_id']))
    else: 
        speaking_pc_name_for_ai = "DM/Scene Event"

    print(f"DEBUG: Generating dialogue for {npc_profile_for_ai.name} towards {speaking_pc_name_for_ai} (ID: {actual_speaking_pc_id}) with standing {current_pc_standing_val.value if current_pc_standing_val else 'None'}")

    try:
        full_ai_output_str = ai_service_instance.generate_npc_dialogue(
            npc=npc_profile_for_ai,
            dialogue_request=dialogue_req_data,
            current_pc_standing=current_pc_standing_val, 
            speaking_pc_name=speaking_pc_name_for_ai,
            world_lore_summary=None,
            detailed_character_history=detailed_history_for_ai
        )
    except Exception as e:
        print(f"Error calling AI service for {npc_profile_for_ai.name}: {e}")
        traceback.print_exc()
        return jsonify({
            "npc_id": npc_id_str,
            "npc_dialogue": f"Error: AI service failed - {type(e).__name__}",
            "new_memory_suggestions": [], "generated_topics": [],
            "suggested_npc_actions": ["AI Service Error"], "suggested_player_checks": [],
            "suggested_standing_pc_id": None, "suggested_new_standing": None, "standing_change_justification": None
        }), 500

    parsed_suggestions = parse_ai_suggestions(full_ai_output_str, actual_speaking_pc_id)
    generated_text = parsed_suggestions["dialogue"]
    
    if "AI generation blocked" in generated_text or generated_text.startswith("Error:"):
         print(f"AI Service returned an error/blocked message for {npc_profile_for_ai.name}: {generated_text}")
    
    memory_suggestions = []
    if dialogue_req_data.player_utterance and generated_text and not ("AI generation blocked" in generated_text or generated_text.startswith("Error:")):
        summarized_memory = ai_service_instance.summarize_interaction_for_memory(
            dialogue_req_data.player_utterance, generated_text
        )
        memory_suggestions.append(summarized_memory)

    response_data_model = DialogueResponse(
        npc_id=npc_id_str,
        npc_dialogue=generated_text,
        new_memory_suggestions=memory_suggestions,
        generated_topics=[], 
        suggested_npc_actions=parsed_suggestions["npc_action"],
        suggested_player_checks=parsed_suggestions["player_check"],
        suggested_standing_pc_id=actual_speaking_pc_id if parsed_suggestions["new_standing"] else None,
        suggested_new_standing=parsed_suggestions["new_standing"], 
        standing_change_justification=parsed_suggestions["justification"]
    )
    return jsonify(response_data_model.model_dump(mode='json')), 200


if __name__ == '__main__':
    for dir_path in [PRIMARY_DATA_DIR, VTT_IMPORT_DIR, HISTORY_DATA_DIR]:
        if not os.path.exists(dir_path):
            os.makedirs(dir_path, exist_ok=True)
            print(f"Created directory: {dir_path}")

    print(f"Data directories: Primary='{os.path.abspath(PRIMARY_DATA_DIR)}', VTT='{os.path.abspath(VTT_IMPORT_DIR)}', History='{os.path.abspath(HISTORY_DATA_DIR)}'")

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
    app.run(debug=True, host='0.0.0.0', port=5000)
# server/app.py
import os
import json
import re
from flask import Flask, request, jsonify, render_template
from bson import ObjectId, json_util
from pydantic import ValidationError
import traceback
from werkzeug.utils import secure_filename
from typing import Optional, List, Dict, Any, Union
from enum import Enum
from datetime import datetime

from config import config as app_config
from database import db_connector
# Ensure LoreEntry and LoreEntryType are imported from your models
from models import NPCProfile, DialogueRequest, DialogueResponse, MemoryItem, NPCProfileWithHistoryAndLore, FactionStandingLevel, LoreEntry, LoreEntryType
from ai_service import ai_service_instance

app = Flask(__name__)
app.secret_key = app_config.FLASK_SECRET_KEY
mongo_db = db_connector.get_db()

# --- Directory Definitions ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PRIMARY_DATA_DIR = os.path.join(BASE_DIR, 'data')
VTT_IMPORT_DIR = os.path.join(PRIMARY_DATA_DIR, 'vtt_imports')
HISTORY_DATA_DIR = os.path.join(PRIMARY_DATA_DIR, 'history')
LORE_DATA_DIR = os.path.join(PRIMARY_DATA_DIR, 'lore') # <-- New Lore Directory

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
    npc_doc.setdefault('linked_lore_ids', []) 
    history_contents_loaded = {}
    combined_content_parts = []

    abs_history_data_dir = os.path.abspath(HISTORY_DATA_DIR)

    if 'associated_history_files' in npc_doc and npc_doc['associated_history_files']:
        for history_filename in npc_doc['associated_history_files']:
            if not history_filename or not isinstance(history_filename, str):
                print(f"Warning: Invalid history filename found for NPC {npc_doc.get('name', 'Unknown')}: {history_filename}")
                continue
            safe_history_filename = secure_filename(history_filename)
            file_path = os.path.join(abs_history_data_dir, safe_history_filename)
            if os.path.exists(file_path) and os.path.isfile(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        history_contents_loaded[history_filename] = content
                        combined_content_parts.append(f"--- From History File: {history_filename} ---\n{content}\n")
                except Exception as e:
                    print(f"Error reading history file {safe_history_filename} for NPC {npc_doc.get('name', 'Unknown')}: {e}")
                    history_contents_loaded[history_filename] = f"[Error loading content for {safe_history_filename}]"
            else:
                print(f"Warning: History file '{safe_history_filename}' not found at '{file_path}' for NPC {npc_doc.get('name', 'Unknown')}.")
                history_contents_loaded[history_filename] = "[File not found]"
    npc_doc['history_contents_loaded'] = history_contents_loaded
    npc_doc['combined_history_content'] = "\n".join(combined_content_parts).strip() if combined_content_parts else "No history file content loaded."
    return npc_doc

def get_linked_lore_summary_for_npc(npc_doc: Dict[str, Any]) -> str:
    if mongo_db is None or 'linked_lore_ids' not in npc_doc or not npc_doc['linked_lore_ids']:
        return "No specific linked lore."
    lore_summaries = []
    lore_collection = mongo_db.lore_entries
    for lore_id_str in npc_doc['linked_lore_ids']:
        try:
            lore_id_obj = ObjectId(lore_id_str)
            lore_entry_doc = lore_collection.find_one({"_id": lore_id_obj})
            if lore_entry_doc:
                summary = f"Regarding '{lore_entry_doc.get('name', 'Unnamed Lore')}': {lore_entry_doc.get('description', 'No description.')[:150]}..."
                if lore_entry_doc.get('key_facts'):
                    summary += " Key facts: " + "; ".join(lore_entry_doc['key_facts'][:2])
                lore_summaries.append(summary)
        except Exception as e:
            print(f"Error fetching or summarizing lore_id {lore_id_str}: {e}")
    if not lore_summaries:
        return "No specific linked lore found or summaries generated."
    return "\n".join(lore_summaries)

def sync_data_from_files():
    if mongo_db is None:
        print("[Data Sync] Skipping: Database not available.")
        return

    print("\n" + "-"*50)
    print(f"[Data Sync] Starting data synchronization...")
    print(f"  Characters from: '{PRIMARY_DATA_DIR}', VTT Imports from: '{VTT_IMPORT_DIR}', History from: '{HISTORY_DATA_DIR}'")
    print(f"  Lore from: '{LORE_DATA_DIR}'")


    # --- Character Data Synchronization ---
    if not os.path.isdir(PRIMARY_DATA_DIR):
        print(f"[Data Sync] Warning: Primary character data directory '{PRIMARY_DATA_DIR}' not found. Skipping character sync.")
    else:
        characters_collection = mongo_db.npcs
        char_synced_count = 0
        char_updated_count = 0
        char_new_count = 0
        print(f"[Data Sync] Syncing character data...")
        for filename in os.listdir(PRIMARY_DATA_DIR):
            if filename.endswith('.json'):
                primary_file_path = os.path.join(PRIMARY_DATA_DIR, filename)
                try:
                    with open(primary_file_path, 'r', encoding='utf-8') as f:
                        primary_char_data = json.load(f)
                    char_name_temp = primary_char_data.get("name")
                    if not char_name_temp:
                        print(f"[Data Sync] Skipping character file {filename}: missing 'name' field.")
                        continue
                    primary_char_data.setdefault('pc_faction_standings', {})
                    primary_char_data.setdefault('linked_lore_ids', [])
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
                        if 'pc_faction_standings' not in update_payload:
                            update_payload['pc_faction_standings'] = existing_char_in_db.get('pc_faction_standings', {})
                        if 'linked_lore_ids' not in update_payload:
                            update_payload['linked_lore_ids'] = existing_char_in_db.get('linked_lore_ids', [])
                        characters_collection.update_one({"_id": existing_char_in_db['_id']}, {"$set": update_payload})
                        char_updated_count += 1
                    else:
                        characters_collection.insert_one(mongo_doc)
                        char_new_count += 1
                    char_synced_count +=1
                except ValidationError as e:
                    print(f"[Data Sync] Error: Character validation failed for {filename}. Details: {e.errors()}")
                except Exception as e:
                    print(f"[Data Sync] Error: Unexpected error with character file {filename}: {e}")
                    traceback.print_exc()
        print(f"[Data Sync] Character sync finished. Processed: {char_synced_count} | New: {char_new_count} | Updated: {char_updated_count}")

    # --- Lore Data Synchronization (New Section) ---
    if not os.path.isdir(LORE_DATA_DIR):
        print(f"[Data Sync] Warning: Lore data directory '{LORE_DATA_DIR}' not found. Skipping lore sync.")
    else:
        lore_collection = mongo_db.lore_entries
        lore_synced_count = 0
        lore_updated_count = 0
        lore_new_count = 0
        print(f"[Data Sync] Syncing lore data...")
        for filename in os.listdir(LORE_DATA_DIR):
            if filename.endswith('.json'):
                filepath = os.path.join(LORE_DATA_DIR, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data_from_file = json.load(f)
                    
                    lore_items_in_file = [data_from_file] if isinstance(data_from_file, dict) else data_from_file
                    if not isinstance(lore_items_in_file, list):
                        print(f"[Data Sync] Skipping lore file {filename}: content is not a JSON object or list of objects.")
                        continue

                    for lore_data_item in lore_items_in_file:
                        if not isinstance(lore_data_item, dict):
                            print(f"[Data Sync] Skipping item in lore file {filename}: item is not a JSON object.")
                            continue
                        try:
                            validated_lore = LoreEntry(**lore_data_item)
                            mongo_doc_payload = validated_lore.model_dump(exclude_none=True, exclude={'lore_id'})

                            existing_lore_in_db = None
                            file_provided_lore_id_str = lore_data_item.get('lore_id')
                            target_object_id = None

                            if file_provided_lore_id_str:
                                try:
                                    target_object_id = ObjectId(file_provided_lore_id_str)
                                    existing_lore_in_db = lore_collection.find_one({"_id": target_object_id})
                                except Exception:
                                    print(f"[Data Sync] Warning: Invalid lore_id '{file_provided_lore_id_str}' in {filename}. Will try to match by name or insert new.")
                                    existing_lore_in_db = lore_collection.find_one({"name": validated_lore.name})
                                    if existing_lore_in_db:
                                         target_object_id = existing_lore_in_db['_id'] # Use ID of name-matched doc
                            else: # No lore_id in file, try by name
                                existing_lore_in_db = lore_collection.find_one({"name": validated_lore.name})
                                if existing_lore_in_db:
                                    target_object_id = existing_lore_in_db['_id']


                            if existing_lore_in_db:
                                lore_collection.update_one({"_id": existing_lore_in_db['_id']}, {"$set": mongo_doc_payload})
                                lore_updated_count += 1
                            else:
                                # Prepare full doc for insert, ensuring _id is ObjectId
                                doc_to_insert = validated_lore.model_dump(exclude_none=True)
                                if file_provided_lore_id_str and target_object_id: # Valid ID from file, but no existing doc
                                     doc_to_insert['_id'] = target_object_id
                                else: # No ID from file or it was invalid; use Pydantic's default (new) lore_id for _id
                                     doc_to_insert['_id'] = ObjectId(doc_to_insert['lore_id'])
                                doc_to_insert.pop('lore_id') # Remove string lore_id field, keep _id as ObjectId
                                
                                lore_collection.insert_one(doc_to_insert)
                                lore_new_count += 1
                            lore_synced_count += 1

                        except ValidationError as e_val:
                            print(f"[Data Sync] Error: Lore validation failed for item in {filename}. Details: {e_val.errors()}")
                        except Exception as e_item_sync:
                            print(f"[Data Sync] Error: Unexpected error with lore item in {filename}: {e_item_sync}")
                            traceback.print_exc()
                except json.JSONDecodeError:
                    print(f"[Data Sync] Error: Could not decode JSON from lore file {filename}.")
                except Exception as e_file_sync:
                    print(f"[Data Sync] Error processing lore file {filename}: {e_file_sync}")
                    traceback.print_exc()
        print(f"[Data Sync] Lore sync finished. Processed: {lore_synced_count} | New: {lore_new_count} | Updated: {lore_updated_count}")
    
    print("-" * 50 + "\n")


# --- App Routes & Other Logic ---
@app.route('/')
def serve_index():
    return render_template('index.html')

# ... (rest of your existing Flask routes for /api/npcs, /api/history_files, dialogue, lore_entries, etc.) ...
# Ensure all your existing API endpoints remain here. The changes above are only for the sync_data_from_files function
# and directory definitions.

# --- CHARACTER (NPC/PC) ENDPOINTS ---
@app.route('/api/npcs', methods=['POST'])
def create_npc_api():
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        data = request.get_json()
        if not data: return jsonify({"error": "Invalid JSON payload"}), 400
        data.setdefault('associated_history_files', [])
        data.setdefault('linked_lore_ids', []) 
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
def get_all_npcs_api():
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        characters_cursor = mongo_db.npcs.find({})
        characters_list = []
        for char_doc in characters_cursor:
            char_doc['_id'] = str(char_doc['_id'])
            char_doc.setdefault('associated_history_files', [])
            char_doc.setdefault('linked_lore_ids', []) 
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
    npc_data.setdefault('linked_lore_ids', []) 
    npc_data.setdefault('vtt_data', {})
    npc_data.setdefault('vtt_flags', {})
    npc_data.setdefault('img', None)
    npc_data.setdefault('items', [])
    npc_data.setdefault('system', {}) 
    npc_data.setdefault('pc_faction_standings', {})
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
        current_data_for_validation = {**existing_npc_data, **update_data_req}
        current_data_for_validation.pop('_id', None)
        current_data_for_validation.setdefault('vtt_data', existing_npc_data.get('vtt_data', {}))
        current_data_for_validation.setdefault('vtt_flags', existing_npc_data.get('vtt_flags', {}))
        current_data_for_validation.setdefault('items', existing_npc_data.get('items', []))
        current_data_for_validation.setdefault('system', existing_npc_data.get('system', {})) 
        current_data_for_validation.setdefault('pc_faction_standings', existing_npc_data.get('pc_faction_standings', {}))
        current_data_for_validation.setdefault('linked_lore_ids', existing_npc_data.get('linked_lore_ids', []))
        if 'associated_history_files' in current_data_for_validation and \
           not isinstance(current_data_for_validation['associated_history_files'], list):
            current_data_for_validation['associated_history_files'] = [current_data_for_validation['associated_history_files']]
        if 'linked_lore_ids' in current_data_for_validation and \
           not isinstance(current_data_for_validation['linked_lore_ids'], list):
            current_data_for_validation['linked_lore_ids'] = [current_data_for_validation['linked_lore_ids']]
        validated_update_profile = NPCProfile(**current_data_for_validation)
        final_set_payload = {}
        for key, value in update_data_req.items():
            if key in validated_update_profile.model_fields:
                attr_value = getattr(validated_update_profile, key)
                if isinstance(attr_value, Enum):
                     final_set_payload[key] = attr_value.value
                elif key == 'pc_faction_standings' and isinstance(attr_value, dict):
                    final_set_payload[key] = {pc_id: (standing.value if isinstance(standing, Enum) else standing)
                                              for pc_id, standing in attr_value.items()}
                else:
                    final_set_payload[key] = attr_value
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

# --- HISTORY FILE ENDPOINTS ---
@app.route('/api/history_files', methods=['GET'])
def list_history_files_api():
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
def associate_history_file_with_npc_api(npc_id_str: str):
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
def dissociate_history_file_from_npc_api(npc_id_str: str):
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

# --- MEMORY ENDPOINTS ---
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

# --- DIALOGUE GENERATION ---
def parse_ai_suggestions(full_ai_output: str, speaking_pc_id: Optional[str]) -> Dict[str, Any]:
    npc_name_fallback = "NPC"
    dialogue_parts = []
    suggestion_lines = []
    npc_action_str = "None"
    player_check_str = "None"
    new_standing_str = "No change"
    justification_str = "Not specified"
    suggestion_pc_key_for_parsing = speaking_pc_id if speaking_pc_id and speaking_pc_id.strip() != "" else "PLAYER"
    lines = full_ai_output.splitlines()
    suggestion_keywords = ["NPC_ACTION:", "PLAYER_CHECK:", f"STANDING_CHANGE_SUGGESTION_FOR_{suggestion_pc_key_for_parsing}:", "JUSTIFICATION:"]
    first_suggestion_line_index = -1
    for i, line in enumerate(lines):
        stripped_line = line.strip()
        if any(stripped_line.startswith(kw) for kw in suggestion_keywords):
            first_suggestion_line_index = i
            break
    if first_suggestion_line_index != -1:
        dialogue_parts = lines[:first_suggestion_line_index]
        suggestion_lines = lines[first_suggestion_line_index:]
    else: 
        dialogue_parts = lines
        suggestion_lines = []
    for line in suggestion_lines:
        stripped_line = line.strip()
        if stripped_line.startswith("NPC_ACTION:"): npc_action_str = stripped_line.replace("NPC_ACTION:", "").strip()
        elif stripped_line.startswith("PLAYER_CHECK:"): player_check_str = stripped_line.replace("PLAYER_CHECK:", "").strip()
        elif stripped_line.startswith(f"STANDING_CHANGE_SUGGESTION_FOR_{suggestion_pc_key_for_parsing}:"):
            raw_standing_val = stripped_line.replace(f"STANDING_CHANGE_SUGGESTION_FOR_{suggestion_pc_key_for_parsing}:", "").strip()
            new_standing_str = raw_standing_val.replace('[', '').replace(']', '').replace('"', '').replace("'", "").strip()
        elif stripped_line.startswith("JUSTIFICATION:"): justification_str = stripped_line.replace("JUSTIFICATION:", "").strip()
    npc_dialogue_final = "\n".join(dialogue_parts).strip()
    if not npc_dialogue_final and (npc_action_str != "None" or player_check_str != "None" or new_standing_str != "No change"):
        npc_dialogue_final = f"({npc_name_fallback} considers the situation...)" 
    parsed_new_standing_enum = None
    if new_standing_str and new_standing_str.lower() not in ["no change", "none", ""]:
        try:
            matched_level = next((level_enum for level_enum in FactionStandingLevel if level_enum.value.lower() == new_standing_str.lower()), None)
            if matched_level: parsed_new_standing_enum = matched_level
            else:
                print(f"Warning: AI suggested an unrecognized standing level: '{new_standing_str}' for PC '{suggestion_pc_key_for_parsing}'")
                justification_str += f" (AI suggested unrecognized standing: {new_standing_str})"
        except Exception as e_standing:
             print(f"Error converting AI standing '{new_standing_str}' to enum: {e_standing}")
             justification_str += f" (Error processing AI standing: {new_standing_str})"
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
    global npc_profile_for_ai 
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
    linked_lore_summary_for_ai = get_linked_lore_summary_for_npc(npc_data_with_history) 
    current_pc_standing_val = None
    speaking_pc_name_for_ai = "the player"
    actual_speaking_pc_id = dialogue_req_data.speaking_pc_id if dialogue_req_data.speaking_pc_id and dialogue_req_data.speaking_pc_id.strip() != "" else None
    if actual_speaking_pc_id:
        current_pc_standing_val = npc_profile_for_ai.pc_faction_standings.get(actual_speaking_pc_id)
        try:
            pc_object_id_val = ObjectId(actual_speaking_pc_id)
            pc_object_found = mongo_db.npcs.find_one({"_id": pc_object_id_val, "character_type": "PC"})
            if pc_object_found: speaking_pc_name_for_ai = pc_object_found.get("name", actual_speaking_pc_id)
            else: speaking_pc_name_for_ai = actual_speaking_pc_id
        except Exception:
            speaking_pc_name_for_ai = actual_speaking_pc_id
            pc_by_name = mongo_db.npcs.find_one({"name": actual_speaking_pc_id, "character_type": "PC"}) 
            if pc_by_name: current_pc_standing_val = npc_profile_for_ai.pc_faction_standings.get(str(pc_by_name['_id']))
    else:
        speaking_pc_name_for_ai = "DM/Scene Event"
    try:
        full_ai_output_str = ai_service_instance.generate_npc_dialogue(
            npc=npc_profile_for_ai,
            dialogue_request=dialogue_req_data,
            current_pc_standing=current_pc_standing_val,
            speaking_pc_name=speaking_pc_name_for_ai,
            world_lore_summary=linked_lore_summary_for_ai, 
            detailed_character_history=detailed_history_for_ai
        )
    except Exception as e:
        print(f"Error calling AI service for {npc_profile_for_ai.name}: {e}")
        traceback.print_exc()
        return jsonify({
            "npc_id": npc_id_str, "npc_dialogue": f"Error: AI service failed - {type(e).__name__}",
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
        npc_id=npc_id_str, npc_dialogue=generated_text,
        new_memory_suggestions=memory_suggestions, generated_topics=[],
        suggested_npc_actions=parsed_suggestions["npc_action"],
        suggested_player_checks=parsed_suggestions["player_check"],
        suggested_standing_pc_id=actual_speaking_pc_id if parsed_suggestions["new_standing"] else None,
        suggested_new_standing=parsed_suggestions["new_standing"],
        standing_change_justification=parsed_suggestions["justification"]
    )
    return jsonify(response_data_model.model_dump(mode='json')), 200

# --- LORE ENTRY ENDPOINTS ---
@app.route('/api/lore_entries', methods=['GET']) 
def get_all_lore_entries_api():
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        lore_cursor = mongo_db.lore_entries.find({})
        raw_list = list(lore_cursor)
        parsed_list = json.loads(json_util.dumps(raw_list))
        client_ready_list = []
        for entry in parsed_list:
            if '_id' in entry and '$oid' in entry['_id']:
                entry['lore_id'] = entry['_id']['$oid']
                del entry['_id']
            if 'lore_type' in entry and isinstance(entry.get('lore_type'), Enum):
                 entry['lore_type'] = entry['lore_type'].value
            client_ready_list.append(entry)
        return jsonify(client_ready_list), 200
    except Exception as e:
        print(f"Error in get_all_lore_entries_api: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Could not retrieve lore entries: {str(e)}"}), 500

@app.route('/api/lore_entries/<lore_id_str>', methods=['GET'])
def get_lore_entry_api(lore_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        lore_id_obj = ObjectId(lore_id_str)
    except Exception:
        return jsonify({"error": "Invalid Lore ID format provided."}), 400
    entry_doc = mongo_db.lore_entries.find_one({"_id": lore_id_obj})
    if not entry_doc:
        return jsonify({"error": "Lore entry not found"}), 404
    parsed_entry = json.loads(json_util.dumps(entry_doc))
    if '_id' in parsed_entry and '$oid' in parsed_entry['_id']:
        parsed_entry['lore_id'] = parsed_entry['_id']['$oid']
        del parsed_entry['_id']
    if 'lore_type' in parsed_entry and isinstance(parsed_entry.get('lore_type'), Enum):
            parsed_entry['lore_type'] = parsed_entry['lore_type'].value
    return jsonify(parsed_entry), 200

@app.route('/api/lore_entries', methods=['POST'])
def create_lore_entry_api():
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        data = request.get_json()
        if not data: return jsonify({"error": "Invalid JSON payload"}), 400
        if 'lore_id' in data:
            try: ObjectId(data['lore_id'])
            except: del data['lore_id']
        lore_entry_data = LoreEntry(**data)
        lore_entry_data.updated_at = datetime.utcnow()
        lore_dict_for_db = lore_entry_data.model_dump(exclude_none=True)
        # Convert string lore_id (which is Pydantic's default) to ObjectId for _id
        if 'lore_id' in lore_dict_for_db:
            try:
                lore_dict_for_db['_id'] = ObjectId(lore_dict_for_db.pop('lore_id'))
            except: # If lore_id from request wasn't valid ObjectId string
                 if '_id' in lore_dict_for_db: del lore_dict_for_db['_id'] 
                 lore_dict_for_db['_id'] = ObjectId() # Generate new one
        elif '_id' not in lore_dict_for_db : # Ensure _id if no lore_id was there to begin with
             lore_dict_for_db['_id'] = ObjectId()
    except ValidationError as e:
        return jsonify({"error": "Validation Error for LoreEntry", "details": e.errors()}), 400
    except Exception as ex:
        print(f"Error preparing lore entry for DB: {ex}")
        return jsonify({"error": f"Could not prepare lore entry data: {str(ex)}"}), 500
    try:
        lore_collection = mongo_db.lore_entries
        result = lore_collection.insert_one(lore_dict_for_db)
        created_lore_entry_doc = lore_collection.find_one({"_id": result.inserted_id})
        parsed_entry = json.loads(json_util.dumps(created_lore_entry_doc))
        if '_id' in parsed_entry and '$oid' in parsed_entry['_id']:
            parsed_entry['lore_id'] = parsed_entry['_id']['$oid']
            del parsed_entry['_id']
        if 'lore_type' in parsed_entry and isinstance(parsed_entry.get('lore_type'), Enum):
            parsed_entry['lore_type'] = parsed_entry['lore_type'].value
        return jsonify({"message": "Lore entry created", "lore_entry": parsed_entry}), 201
    except Exception as e:
        print(f"Error in create_lore_entry_api (DB insert): {e}")
        traceback.print_exc()
        return jsonify({"error": f"Could not create lore entry in DB: {str(e)}"}), 500

@app.route('/api/lore_entries/<lore_id_str>', methods=['PUT'])
def update_lore_entry_api(lore_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        lore_id_obj = ObjectId(lore_id_str)
    except Exception: return jsonify({"error": "Invalid Lore ID format for update"}), 400
    existing_lore_data = mongo_db.lore_entries.find_one({"_id": lore_id_obj})
    if not existing_lore_data: return jsonify({"error": "Lore entry not found for update"}), 404
    try:
        update_data_req = request.get_json()
        if not update_data_req: return jsonify({"error": "Invalid JSON payload"}), 400
        existing_pydantic_data = json.loads(json_util.dumps(existing_lore_data))
        if '_id' in existing_pydantic_data and '$oid' in existing_pydantic_data['_id']:
            existing_pydantic_data['lore_id'] = existing_pydantic_data['_id']['$oid']
            del existing_pydantic_data['_id']
        data_for_validation = {**existing_pydantic_data, **update_data_req}
        validated_lore = LoreEntry(**data_for_validation)
        validated_lore.updated_at = datetime.utcnow()
        final_set_payload = {}
        for key, value in update_data_req.items():
            if key in validated_lore.model_fields_set or key in validated_lore.model_extra: # Ensure model_fields_set is correct
                attr_value = getattr(validated_lore, key, None)
                if isinstance(attr_value, Enum):
                     final_set_payload[key] = attr_value.value
                else:
                    final_set_payload[key] = attr_value
        final_set_payload['updated_at'] = validated_lore.updated_at
    except ValidationError as e:
        return jsonify({"error": "Validation Error for LoreEntry update", "details": e.errors()}), 400
    except Exception as ex_val:
        print(f"Error during lore update validation: {ex_val}")
        return jsonify({"error": f"Data validation error: {ex_val}"}), 400
    if not final_set_payload:
        return jsonify({"message": "No changes provided for lore entry."}), 200
    try:
        mongo_db.lore_entries.update_one({"_id": lore_id_obj}, {"$set": final_set_payload})
        updated_lore_entry_doc = mongo_db.lore_entries.find_one({"_id": lore_id_obj})
        parsed_entry = json.loads(json_util.dumps(updated_lore_entry_doc))
        if '_id' in parsed_entry and '$oid' in parsed_entry['_id']:
            parsed_entry['lore_id'] = parsed_entry['_id']['$oid']
            del parsed_entry['_id']
        if 'lore_type' in parsed_entry and isinstance(parsed_entry.get('lore_type'), Enum):
            parsed_entry['lore_type'] = parsed_entry['lore_type'].value
        return jsonify({"message": "Lore entry updated", "lore_entry": parsed_entry}), 200
    except Exception as e:
        print(f"Error updating lore entry in DB: {e}")
        return jsonify({"error": f"Could not update lore entry in DB: {str(e)}"}), 500

@app.route('/api/lore_entries/<lore_id_str>', methods=['DELETE'])
def delete_lore_entry_api(lore_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        lore_id_obj = ObjectId(lore_id_str)
    except Exception: return jsonify({"error": "Invalid Lore ID format"}), 400
    result = mongo_db.lore_entries.delete_one({"_id": lore_id_obj})
    if result.deleted_count == 0:
        return jsonify({"error": "Lore entry not found"}), 404
    mongo_db.npcs.update_many(
        {"linked_lore_ids": lore_id_str},
        {"$pull": {"linked_lore_ids": lore_id_str}}
    )
    mongo_db.lore_entries.update_many(
        {"linked_lore_entry_ids": lore_id_str},
        {"$pull": {"linked_lore_entry_ids": lore_id_str}}
    )
    return jsonify({"message": "Lore entry deleted and unlinked"}), 200

# --- LINKING ENDPOINTS ---
@app.route('/api/characters/<char_id_str>/link_lore/<lore_id_str>', methods=['POST'])
def link_lore_to_character_api(char_id_str: str, lore_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        char_id_obj = ObjectId(char_id_str)
        lore_id_obj = ObjectId(lore_id_str) # Lore ID from path is actual _id string
    except Exception:
        return jsonify({"error": "Invalid ID format for character or lore entry"}), 400
    char_exists = mongo_db.npcs.count_documents({"_id": char_id_obj}) > 0
    lore_exists = mongo_db.lore_entries.count_documents({"_id": lore_id_obj}) > 0
    if not char_exists: return jsonify({"error": "Character not found"}), 404
    if not lore_exists: return jsonify({"error": "Lore entry not found"}), 404
    mongo_db.npcs.update_one(
        {"_id": char_id_obj},
        {"$addToSet": {"linked_lore_ids": lore_id_str}} # Store string _id in character's links
    )
    mongo_db.lore_entries.update_one(
        {"_id": lore_id_obj},
        {"$addToSet": {"linked_character_ids": char_id_str}}
    )
    updated_char = mongo_db.npcs.find_one({"_id": char_id_obj})
    return jsonify({"message": "Lore linked to character", "character": parse_json(updated_char)}), 200

@app.route('/api/characters/<char_id_str>/unlink_lore/<lore_id_str>', methods=['POST'])
def unlink_lore_from_character_api(char_id_str: str, lore_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        char_id_obj = ObjectId(char_id_str)
    except Exception:
        return jsonify({"error": "Invalid Character ID format"}), 400
    mongo_db.npcs.update_one(
        {"_id": char_id_obj},
        {"$pull": {"linked_lore_ids": lore_id_str}}
    )
    try:
        lore_id_obj_for_pull = ObjectId(lore_id_str)
        mongo_db.lore_entries.update_one(
            {"_id": lore_id_obj_for_pull},
            {"$pull": {"linked_character_ids": char_id_str}}
        )
    except Exception:
        print(f"Note: Could not convert lore_id '{lore_id_str}' to ObjectId for unlinking from lore entry, it might have been an invalid or already removed ID.")
    updated_char = mongo_db.npcs.find_one({"_id": char_id_obj})
    return jsonify({"message": "Lore unlinked from character", "character": parse_json(updated_char)}), 200


if __name__ == '__main__':
    # Ensure all necessary data directories exist
    for dir_path in [PRIMARY_DATA_DIR, VTT_IMPORT_DIR, HISTORY_DATA_DIR, LORE_DATA_DIR]: # <-- Added LORE_DATA_DIR
        if not os.path.exists(dir_path):
            os.makedirs(dir_path, exist_ok=True)
            print(f"Created directory: {dir_path}")

    print(f"Data directories: Primary='{os.path.abspath(PRIMARY_DATA_DIR)}', VTT='{os.path.abspath(VTT_IMPORT_DIR)}', History='{os.path.abspath(HISTORY_DATA_DIR)}', Lore='{os.path.abspath(LORE_DATA_DIR)}'")

    if mongo_db is not None:
        sync_data_from_files() # This will now sync both characters and lore
    else:
        print("CRITICAL: MongoDB connection failed. Data sync skipped and app may not function correctly.")

    if ai_service_instance is None or ai_service_instance.model is None:
        print("CRITICAL: AI Service not initialized. Dialogue generation will fail.")

    print("-" * 50)
    print(f"Flask Secret Key: {'Set' if app_config.FLASK_SECRET_KEY != 'a_default_secret_key' else 'Using Default (Unsafe for Production)'}")
    print(f"Gemini API Key: {'Set' if app_config.GEMINI_API_KEY else 'NOT SET'}")
    print(f"Mongo URI: {app_config.MONGO_URI}")
    print("-" * 50)
    app.run(debug=True, host='0.0.0.0', port=5001)
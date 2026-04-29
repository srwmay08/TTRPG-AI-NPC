import os
import json
import re
import traceback
from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from enum import Enum

from flask import Flask, request, jsonify, render_template
from bson import ObjectId, json_util
from werkzeug.utils import secure_filename
from pydantic import ValidationError

from config import config as app_config
from database import db_connector, sync_data_from_files
from models import (
    NPCProfile, 
    DialogueRequest, 
    DialogueResponse, 
    MemoryItem, 
    NPCProfileWithHistoryAndLore, 
    FactionStandingLevel, 
    LoreEntry, 
    LoreEntryType
)
from ai_service import ai_service_instance

app = Flask(__name__)
app.secret_key = app_config.SECRET_KEY
mongo_db = db_connector.get_db()

# Application Paths aligned with Config
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PRIMARY_DATA_DIR = app_config.PRIMARY_DATA_DIR
VTT_IMPORT_DIR = app_config.VTT_IMPORT_DIR
PC_IMPORT_DIR = app_config.PC_IMPORT_DIR
HISTORY_DATA_DIR = app_config.HISTORY_DATA_DIR
LORE_DATA_DIR = app_config.LORE_DATA_DIR

# --- LIVE DISCORD CHAT VARIABLES ---
PLAYER_CHARACTER_MAPPING = {
    "srwm": "DM (SRWM)",
    "brunes": "Belric",
    "cagge": "Donte"
}
live_session_history = []

# --- UTILITY FUNCTIONS ---

def parse_json(data):
    return json.loads(json_util.dumps(data))

def slugify(text):
    text = str(text).lower()
    text = re.sub(r'\s+', '-', text)
    text = re.sub(r'[^\w-]+', '', text)
    return text

def parse_discord_transcript(raw_text):
    pattern = r"\[\d+:\d+\s?[AP]M\]\s+APP\s+\[Scriptly\]\s+([\w\.]+)\s*:\s*(.+)"
    matches = re.findall(pattern, raw_text, re.MULTILINE)
    formatted_lines = []
    for user, message in matches:
        clean_message = message.strip()
        formatted_lines.append(f"{user}: {clean_message}")
    return "\n".join(formatted_lines)

def load_history_content_for_npc(npc_doc: Dict[str, Any]) -> Dict[str, Any]:
    npc_doc.setdefault('pc_faction_standings', {})
    npc_doc.setdefault('linked_lore_by_name', []) 
    history_contents_loaded = {}
    combined_content_parts = []
    abs_history_data_dir = os.path.abspath(HISTORY_DATA_DIR)

    if 'associated_history_files' in npc_doc and npc_doc['associated_history_files']:
        for history_filename in npc_doc['associated_history_files']:
            if not history_filename or not isinstance(history_filename, str): continue
            safe_history_filename = secure_filename(history_filename)
            file_path = os.path.join(abs_history_data_dir, safe_history_filename)
            if os.path.exists(file_path) and os.path.isfile(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        if "[Scriptly]" in content: content = parse_discord_transcript(content)
                        history_contents_loaded[history_filename] = content
                        combined_content_parts.append(f"--- From History File: {history_filename} ---\n{content}\n")
                except Exception as e:
                    history_contents_loaded[history_filename] = "[Error loading content]"
            else:
                history_contents_loaded[history_filename] = "[File not found]"
    
    npc_doc['history_contents_loaded'] = history_contents_loaded
    npc_doc['combined_history_content'] = "\n".join(combined_content_parts).strip() if combined_content_parts else "No history content."
    return npc_doc

def get_linked_lore_summary_for_npc(npc_doc: Dict[str, Any]) -> str:
    if mongo_db is None or 'linked_lore_by_name' not in npc_doc or not npc_doc['linked_lore_by_name']:
        return "No specific linked lore."
    lore_summaries = []
    lore_collection = mongo_db.lore_entries
    for lore_name in npc_doc['linked_lore_by_name']:
        try:
            lore_entry_doc = lore_collection.find_one({"name": lore_name})
            if lore_entry_doc:
                summary = f"Regarding '{lore_entry_doc.get('name')}': {lore_entry_doc.get('description', '')[:150]}..."
                lore_summaries.append(summary)
        except Exception: continue
    return "\n".join(lore_summaries)

def parse_ai_suggestions(full_ai_output: str, speaking_pc_id: Optional[str]) -> Dict[str, Any]:
    npc_name_fallback = "NPC"
    dialogue_parts = []
    suggestion_lines = []
    npc_actions_list = []
    player_checks_list = []
    generated_topics_list = []
    new_standing_str = "No change"
    justification_str = "Not specified"
    
    suggestion_pc_key_for_parsing = speaking_pc_id if speaking_pc_id and speaking_pc_id.strip() != "" else "PLAYER"
    
    lines = full_ai_output.splitlines()
    suggestion_keywords = [
        "NPC_ACTION:", 
        "PLAYER_CHECK:", 
        "GENERATED_TOPICS:", 
        f"STANDING_CHANGE_SUGGESTION_FOR_{suggestion_pc_key_for_parsing}:", 
        "JUSTIFICATION:"
    ]
    
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
        if stripped_line.startswith("NPC_ACTION:"):
            actions_str = stripped_line.replace("NPC_ACTION:", "").strip()
            if actions_str.lower() != 'none':
                npc_actions_list = [action.strip() for action in actions_str.split(';') if action.strip()]
        elif stripped_line.startswith("PLAYER_CHECK:"):
            checks_str = stripped_line.replace("PLAYER_CHECK:", "").strip()
            if checks_str.lower() != 'none':
                player_checks_list = [check.strip() for check in checks_str.split(';') if check.strip()]
        elif stripped_line.startswith("GENERATED_TOPICS:"):
            topics_str = stripped_line.replace("GENERATED_TOPICS:", "").strip()
            if topics_str.lower() != 'none':
                generated_topics_list = [topic.strip() for topic in topics_str.split(';') if topic.strip()]
        elif stripped_line.startswith(f"STANDING_CHANGE_SUGGESTION_FOR_{suggestion_pc_key_for_parsing}:"):
            raw_standing_val = stripped_line.replace(f"STANDING_CHANGE_SUGGESTION_FOR_{suggestion_pc_key_for_parsing}:", "").strip()
            new_standing_str = raw_standing_val.replace('[', '').replace(']', '').replace('"', '').replace("'", "").strip()
        elif stripped_line.startswith("JUSTIFICATION:"):
            justification_str = stripped_line.replace("JUSTIFICATION:", "").strip()
            
    npc_dialogue_final = "\n".join(dialogue_parts).strip()
    
    parsed_new_standing_enum = None
    if new_standing_str and new_standing_str.lower() not in ["no change", "none", ""]:
        try:
            matched_level = next((level_enum for level_enum in FactionStandingLevel if level_enum.value.lower() == new_standing_str.lower()), None)
            if matched_level:
                parsed_new_standing_enum = matched_level
        except Exception:
            pass
            
    return {
        "dialogue": npc_dialogue_final if npc_dialogue_final else "(No dialogue response)",
        "npc_action": npc_actions_list,
        "player_check": player_checks_list,
        "generated_topics": generated_topics_list,
        "new_standing": parsed_new_standing_enum,
        "new_standing_str_for_response": new_standing_str, 
        "justification": justification_str
    }

    

# --- APP ROUTES ---

@app.route('/')
def serve_index():
    return render_template('index.html')


PLAYER_CHARACTER_MAPPING = {
    "srwm": "DM (Scene Input)",
    "bluesman1971": "Garrett",
    "Seiper192": "Xander Vyltryn",
    "Drizzt": "Sel'zen Daer'maer the Shadow Bound",
    "YEEYEE4477": "Vilis, The Black Hand",
    "ChaserXL": "Sudara",
    "Ortiz Alehammer": "Moriah Kiah"
}

# --- LIVE DISCORD CHAT ENDPOINTS ---

@app.route('/api/live_chat_ingest', methods=['POST'])
def handle_live_chat_ingest():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data"}), 400
        
    raw_author = data.get("author", "Unknown").lower()
    content = data.get("content", "")
    
    character_name = PLAYER_CHARACTER_MAPPING.get(raw_author, data.get("author"))
    formatted_message = f"{character_name}: {content}"
    
    live_session_history.append(formatted_message)
    
    if len(live_session_history) > 50:
        live_session_history.pop(0)
        
    return jsonify({"status": "success", "mapped_to": character_name})

@app.route('/api/live_chat', methods=['GET'])
def get_live_chat():
    return jsonify(live_session_history)

@app.route('/api/live_chat', methods=['DELETE'])
def clear_live_chat():
    live_session_history.clear()
    return jsonify({"status": "cleared"})

# --- CHARACTER (NPC/PC) ENDPOINTS ---

@app.route('/api/npcs', methods=['POST'])
def create_npc_api():
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        data = request.get_json()
        if not data: return jsonify({"error": "Invalid JSON payload"}), 400
        
        data.setdefault('associated_history_files', [])
        data.setdefault('linked_lore_by_name', []) 
        data.setdefault('vtt_data', {})
        data.setdefault('vtt_flags', {})
        data.setdefault('items', [])
        data.setdefault('system', {})
        data.setdefault('pc_faction_standings', {})
        
        character_profile_data = NPCProfile(**data)
        characters_collection = mongo_db.npcs
        character_dict = character_profile_data.model_dump(mode='json', by_alias=True, exclude_none=True)
        
        result = characters_collection.insert_one(character_dict)
        created_character_from_db = characters_collection.find_one({"_id": result.inserted_id})
        
        if created_character_from_db:
            created_character_from_db = load_history_content_for_npc(created_character_from_db)
            return jsonify({
                "message": f"{created_character_from_db.get('character_type', 'Character')} created",
                "character": parse_json(created_character_from_db)
            }), 201
        else:
            return jsonify({"error": "Failed to retrieve created character from DB"}), 500
            
    except ValidationError as e:
        return jsonify({"error": "Validation Error", "details": e.errors()}), 400
    except Exception as e:
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
            char_doc.setdefault('linked_lore_by_name', []) 
            char_doc.setdefault('combined_history_content', '')
            char_doc.setdefault('pc_faction_standings', {})
            characters_list.append(char_doc)
        return jsonify(characters_list), 200
    except Exception as e:
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
        
        validated_update_profile = NPCProfile(**current_data_for_validation)
        final_set_payload = {}
        
        for key, value in update_data_req.items():
            if key in validated_update_profile.model_fields:
                attr_value = getattr(validated_update_profile, key)
                if isinstance(attr_value, Enum):
                    final_set_payload[key] = attr_value.value
                elif key == 'pc_faction_standings' and isinstance(attr_value, dict):
                    final_set_payload[key] = {
                        pc_id: (standing.value if isinstance(standing, Enum) else standing)
                        for pc_id, standing in attr_value.items()
                    }
                else:
                    final_set_payload[key] = attr_value
        
        mongo_db.npcs.update_one({"_id": npc_id_obj}, {"$set": final_set_payload})
        
        char_name = final_set_payload.get('name', existing_npc_data.get('name'))
        if char_name:
            updated_doc_full = mongo_db.npcs.find_one({"_id": npc_id_obj})
            if updated_doc_full:
                file_data = parse_json(updated_doc_full)
                file_data.pop('_id', None)
                safe_filename = secure_filename(f"{char_name}.json")
                target_path = os.path.join(PRIMARY_DATA_DIR, safe_filename)
                try:
                    with open(target_path, 'w', encoding='utf-8') as f:
                        json.dump(file_data, f, indent=4)
                except Exception as e_file:
                    print(f"Error saving updated character file: {e_file}")
        
        updated_npc_data_from_db = mongo_db.npcs.find_one({"_id": npc_id_obj})
        updated_npc_data_from_db = load_history_content_for_npc(updated_npc_data_from_db)
        return jsonify({
            "message": "Character updated and saved", 
            "character": parse_json(updated_npc_data_from_db)
        }), 200

    except ValidationError as e:
        return jsonify({"error": "Validation Error during update", "details": e.errors()}), 400
    except Exception as e:
        return jsonify({"error": f"Could not update character: {str(e)}"}), 500

@app.route('/api/npcs/<npc_id_str>', methods=['DELETE'])
def delete_npc_api(npc_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid Character ID format"}), 400
    
    result = mongo_db.npcs.delete_one({"_id": npc_id_obj})
    if result.deleted_count == 0:
        return jsonify({"error": "Character not found"}), 404
    
    return jsonify({"message": "Character deleted successfully"}), 200

# --- HISTORY ASSOCIATION ENDPOINTS ---

@app.route('/api/history_files', methods=['GET'])
def list_history_files_api():
    abs_history_data_dir = os.path.abspath(HISTORY_DATA_DIR)
    if not os.path.isdir(abs_history_data_dir):
        os.makedirs(abs_history_data_dir, exist_ok=True)
        return jsonify([]), 200
    try:
        files = [f for f in os.listdir(abs_history_data_dir) if f.endswith('.txt')]
        return jsonify(sorted(files)), 200
    except Exception as e:
        return jsonify({"error": f"Could not list history files: {str(e)}"}), 500

@app.route('/api/character/<npc_id_str>/associate_history', methods=['POST'])
def associate_history_file_with_npc_api(npc_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid Character ID format"}), 400
    
    data = request.get_json()
    history_filename = data.get('history_file')
    if not history_filename: return jsonify({"error": "history_file not provided"}), 400
    
    try:
        mongo_db.npcs.update_one(
            {"_id": npc_id_obj},
            {"$addToSet": {"associated_history_files": history_filename}}
        )
        npc_doc = mongo_db.npcs.find_one({"_id": npc_id_obj})
        npc_doc_with_history = load_history_content_for_npc(npc_doc)
        return jsonify({
            "message": f"History file '{history_filename}' associated.",
            "character": parse_json(npc_doc_with_history)
        }), 200
    except Exception as e:
        return jsonify({"error": f"Could not associate history: {str(e)}"}), 500

@app.route('/api/character/<npc_id_str>/dissociate_history', methods=['POST'])
def dissociate_history_file_from_npc_api(npc_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid Character ID format"}), 400
    
    data = request.get_json()
    history_filename = data.get('history_file')
    
    try:
        mongo_db.npcs.update_one(
            {"_id": npc_id_obj},
            {"$pull": {"associated_history_files": history_filename}}
        )
        npc_doc = mongo_db.npcs.find_one({"_id": npc_id_obj})
        npc_doc_with_history = load_history_content_for_npc(npc_doc)
        return jsonify({
            "message": f"History file '{history_filename}' dissociated.",
            "character": parse_json(npc_doc_with_history)
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- MEMORY ENDPOINTS ---

@app.route('/api/npcs/<npc_id_str>/memory', methods=['POST'])
def add_npc_memory_api(npc_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try: npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid ID"}), 400
    
    try:
        memory_data = MemoryItem(**request.get_json())
        mongo_db.npcs.update_one(
            {"_id": npc_id_obj}, 
            {"$push": {"memories": memory_data.model_dump(mode='json')}}
        )
        updated_npc = mongo_db.npcs.find_one({"_id": npc_id_obj})
        return jsonify({
            "message": "Memory added", 
            "updated_memories": parse_json(updated_npc.get("memories", []))
        }), 200
    except ValidationError as e: 
        return jsonify({"error": "Validation Error", "details": e.errors()}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/npcs/<npc_id_str>/memory/<memory_id_str_path>', methods=['DELETE'])
def delete_npc_memory_api(npc_id_str: str, memory_id_str_path: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try: npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid NPC ID"}), 400
    
    result = mongo_db.npcs.update_one(
        {"_id": npc_id_obj}, 
        {"$pull": {"memories": {"memory_id": memory_id_str_path}}}
    )
    if result.modified_count == 0:
        return jsonify({"error": "Memory not found"}), 404
        
    updated_npc = mongo_db.npcs.find_one({"_id": npc_id_obj})
    return jsonify({
        "message": "Memory deleted", 
        "updated_memories": parse_json(updated_npc.get("memories", []))
    }), 200

# --- DIALOGUE GENERATION ---

@app.route('/api/npcs/<npc_id_str>/dialogue', methods=['POST'])
def generate_dialogue_for_npc_api(npc_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    if ai_service_instance is None or ai_service_instance.client is None:
        return jsonify({"error": "AI Service not available"}), 503
        
    try: npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid NPC ID"}), 400
    
    npc_data_from_db = mongo_db.npcs.find_one({"_id": npc_id_obj})
    if not npc_data_from_db: return jsonify({"error": "NPC not found"}), 404
    
    npc_data_with_history = load_history_content_for_npc(npc_data_from_db)
    
    try:
        npc_profile = NPCProfile(**parse_json(npc_data_with_history)) 
        dialogue_req_payload = request.get_json()
        dialogue_req_data = DialogueRequest(**dialogue_req_payload)
    except ValidationError as e:
        return jsonify({"error": "Validation Error", "details": e.errors()}), 400
        
    # Inject live session history into context
    recent_context = list(live_session_history[-15:]) 
    if dialogue_req_data.recent_dialogue_history:
        dialogue_req_data.recent_dialogue_history = recent_context + dialogue_req_data.recent_dialogue_history
    else:
        dialogue_req_data.recent_dialogue_history = recent_context

    detailed_history = npc_data_with_history.get('combined_history_content', '')
    lore_summary = get_linked_lore_summary_for_npc(npc_data_with_history)
    
    try:
        full_ai_output = ai_service_instance.generate_npc_dialogue(
            npc=npc_profile,
            dialogue_request=dialogue_req_data,
            world_lore_summary=lore_summary, 
            detailed_character_history=detailed_history
        )
        
        parsed_suggestions = parse_ai_suggestions(full_ai_output, dialogue_req_data.speaking_pc_id)
        
        memory_suggestions = []
        if dialogue_req_data.player_utterance and parsed_suggestions["dialogue"]:
            memory_suggestions.append(
                ai_service_instance.summarize_interaction_for_memory(
                    dialogue_req_data.player_utterance, 
                    parsed_suggestions["dialogue"]
                )
            )
            
        response_model = DialogueResponse(
            npc_id=npc_id_str, 
            npc_dialogue=parsed_suggestions["dialogue"],
            new_memory_suggestions=memory_suggestions, 
            generated_topics=parsed_suggestions["generated_topics"],
            suggested_npc_actions=parsed_suggestions["npc_action"],
            suggested_player_checks=parsed_suggestions["player_check"],
            suggested_standing_pc_id=dialogue_req_data.speaking_pc_id if parsed_suggestions["new_standing"] else None,
            suggested_new_standing=parsed_suggestions["new_standing"],
            standing_change_justification=parsed_suggestions["justification"]
        )
        return jsonify(response_model.model_dump(mode='json')), 200
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"AI Generation Failed: {str(e)}"}), 500

# --- LORE ENTRY ENDPOINTS ---

@app.route('/api/lore_entries', methods=['GET']) 
def get_all_lore_entries_api():
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        lore_cursor = mongo_db.lore_entries.find({})
        lore_list = []
        for entry in lore_cursor:
            entry['lore_id'] = str(entry.get('lore_id', entry['_id']))
            entry.pop('_id', None)
            lore_list.append(entry)
        return jsonify(lore_list), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/lore_entries', methods=['POST'])
def create_lore_entry_api():
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        data = request.get_json()
        lore_entry_data = LoreEntry(**data)
        lore_entry_data.updated_at = datetime.utcnow()
        
        result = mongo_db.lore_entries.insert_one(lore_entry_data.model_dump(exclude={'lore_id'}))
        mongo_db.lore_entries.update_one({"_id": result.inserted_id}, {"$set": {"lore_id": str(result.inserted_id)}})
        
        created_lore = mongo_db.lore_entries.find_one({"_id": result.inserted_id})
        return jsonify({"message": "Lore entry created", "lore_entry": parse_json(created_lore)}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/lore_entries/<lore_id_str>', methods=['PUT'])
def update_lore_entry_api(lore_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        data = request.get_json()
        mongo_db.lore_entries.update_one({"lore_id": lore_id_str}, {"$set": data})
        updated_lore = mongo_db.lore_entries.find_one({"lore_id": lore_id_str})
        return jsonify(parse_json(updated_lore)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/lore_entries/<lore_id_str>', methods=['DELETE'])
def delete_lore_entry_api(lore_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    result = mongo_db.lore_entries.delete_one({"lore_id": lore_id_str})
    if result.deleted_count == 0:
        return jsonify({"error": "Lore entry not found"}), 404
    return jsonify({"message": "Lore entry deleted"}), 200

# --- LORE LINKING ---

@app.route('/api/characters/<char_id_str>/link_lore', methods=['POST'])
def link_lore_to_character_api(char_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        char_id_obj = ObjectId(char_id_str)
        data = request.get_json()
        lore_name = data.get('lore_name')
        
        mongo_db.npcs.update_one(
            {"_id": char_id_obj},
            {"$addToSet": {"linked_lore_by_name": lore_name}}
        )
        return jsonify({"message": "Lore linked"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- MAIN EXECUTION ---

if __name__ == '__main__':
    # Ensure folders exist
    for dir_path in [PRIMARY_DATA_DIR, VTT_IMPORT_DIR, PC_IMPORT_DIR, HISTORY_DATA_DIR, LORE_DATA_DIR]:
        if not os.path.exists(dir_path):
            os.makedirs(dir_path, exist_ok=True)
            print(f"Verified directory: {dir_path}")

    print(f"Booting TTRPG AI NPC Server...")
    print(f"Primary Data: {os.path.abspath(PRIMARY_DATA_DIR)}")
    print(f"PC Import Path: {os.path.abspath(PC_IMPORT_DIR)}")

    # Sync from files
    if mongo_db is not None:
        print("[System] Synchronizing characters and lore from local files...")
        sync_data_from_files()
    else:
        print("CRITICAL: MongoDB connection failed.")

    print("-" * 50)
    print(f"Flask environment: {app_config.__class__.__name__}")
    print(f"Running on http://0.0.0.0:5001")
    print("-" * 50)
    
    app.run(debug=app_config.DEBUG, host='0.0.0.0', port=5001)
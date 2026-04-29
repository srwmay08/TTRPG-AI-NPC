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

# --- APP ROUTES ---
@app.route('/')
def serve_index():
    return render_template('index.html')

@app.route('/api/live_chat', methods=['GET'])
def get_live_chat():
    return jsonify(live_session_history)

@app.route('/api/npcs', methods=['GET'])
def get_all_npcs_api():
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        characters_cursor = mongo_db.npcs.find({})
        characters_list = []
        for char_doc in characters_cursor:
            char_doc['_id'] = str(char_doc['_id'])
            characters_list.append(char_doc)
        return jsonify(characters_list), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/npcs/<npc_id_str>', methods=['GET'])
def get_npc_api(npc_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
        npc_data = mongo_db.npcs.find_one({"_id": npc_id_obj})
        if not npc_data: return jsonify({"error": "Not found"}), 404
        npc_data_with_history = load_history_content_for_npc(npc_data)
        return jsonify(parse_json(npc_data_with_history)), 200
    except Exception: return jsonify({"error": "Invalid ID"}), 400

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

# --- MAIN EXECUTION ---
if __name__ == '__main__':
    # Initialize DB connection and sync characters BEFORE starting the web server
    if mongo_db is not None:
        print("[System] Running character synchronization...")
        sync_data_from_files()
    else:
        print("CRITICAL: MongoDB connection failed.")

    print("-" * 50)
    print(f"Booting TTRPG AI NPC Server on http://0.0.0.0:5001")
    print("-" * 50)
    
    app.run(debug=app_config.DEBUG, host='0.0.0.0', port=5001)
import os
import json
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
from bson import ObjectId, json_util
from pydantic import ValidationError
import traceback

from config import config as app_config
from models import NPCProfile, LoreEntry, LoreEntryType

class Database:
    """MongoDB Database Connector."""
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Database, cls).__new__(cls)
            try:
                cls._instance.client = MongoClient(app_config.MONGO_URI)
                cls._instance.client.admin.command('ping')
                print("Successfully connected to MongoDB!")
                cls._instance.db = cls._instance.client[app_config.DB_NAME]
            except Exception as e:
                print(f"Could not connect to MongoDB: {e}")
                cls._instance.client = None
                cls._instance.db = None
        return cls._instance

    def get_db(self):
        """Returns the database instance."""
        if self.db is None:
            try:
                self.client = MongoClient(app_config.MONGO_URI)
                self.db = self.client[app_config.DB_NAME]
            except Exception:
                return None
        return self.db

# Global DB connector instance
db_connector = Database()

def parse_json(data):
    return json.loads(json_util.dumps(data))

def sync_data_from_files():
    db = db_connector.get_db()
    if db is None:
        print("Database not available for data sync.")
        return

    npcs_collection = db.npcs
    lore_collection = db.lore_entries

    # --- 1. Sync Lore ---
    print("[Data Sync] Syncing lore data...")
    lore_dir = os.path.abspath(app_config.LORE_DATA_DIR)
    if os.path.exists(lore_dir):
        for root, _, files in os.walk(lore_dir):
            for file_name in files:
                if file_name.endswith('.json'):
                    try:
                        with open(os.path.join(root, file_name), 'r', encoding='utf-8') as f:
                            raw_data = json.load(f)
                        lore_list = raw_data if isinstance(raw_data, list) else [raw_data]
                        for lore_data in lore_list:
                            if not isinstance(lore_data, dict) or 'name' not in lore_data:
                                continue
                            if 'lore_id' not in lore_data:
                                lore_data['lore_id'] = str(ObjectId())
                            validated_lore = LoreEntry(**lore_data)
                            lore_collection.update_one(
                                {"name": validated_lore.name},
                                {"$set": validated_lore.model_dump(by_alias=True, exclude={'lore_id'})},
                                upsert=True
                            )
                    except Exception as e:
                        print(f"[Data Sync] Lore Error in {file_name}: {e}")

    # --- 2. Sync Characters ---
    print("[Data Sync] Syncing character data...")
    
    active_pc_files = {
        "fvtt-Actor-garrett-xLalnoX86KWFZTJu.json",
        "fvtt-Actor-xander-vyltryn-FV69X8W1jSCi6BZU.json",
        "fvtt-Actor-sel'zen-daer'maer-the-shadow-bound-i7qpKNa6HrRxBt3l.json",
        "fvtt-Actor-vilis,-the-black-hand-lKM50j9uy4EOutz7.json",
        "fvtt-Actor-sudara-pzch3aBRuiQSqnv8.json",
        "fvtt-Actor-moriah-kiah-9vGd8Fwm6cEFUaos.json"
    }

    # Only scan these two to avoid the triples seen in your logs
    character_dirs = [
        os.path.abspath(app_config.PRIMARY_DATA_DIR), 
        os.path.abspath(app_config.PC_IMPORT_DIR)
    ]
    
    processed_files = set()
    pc_count = 0

    for directory in character_dirs:
        if not os.path.exists(directory): continue
        for root, _, files in os.walk(directory):
            if os.path.abspath(app_config.LORE_DATA_DIR) in os.path.abspath(root): continue
            
            is_pc_folder = os.path.abspath(app_config.PC_IMPORT_DIR) == os.path.abspath(root)
            
            for file_name in files:
                if not file_name.endswith('.json'): continue
                
                # Deduplication and PC filtering
                file_path = os.path.join(root, file_name)
                if file_path in processed_files: continue
                if is_pc_folder and file_name not in active_pc_files: continue

                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        char_data = json.load(f)
                    
                    if not isinstance(char_data, dict) or 'name' not in char_data: continue

                    # FORCE CHARACTER TYPE
                    if is_pc_folder or char_data.get('type') == 'character':
                        char_data['character_type'] = 'Player Character'
                        pc_count += 1
                    else:
                        char_data['character_type'] = 'NPC'

                    if not char_data.get('description'):
                        char_data['description'] = "Active Party Member" if is_pc_folder else "Local NPC"

                    # Pydantic creation
                    validated_char = NPCProfile(**char_data)
                    
                    # Update database - REMOVED exclude_unset=True to force character_type save
                    char_dump = validated_char.model_dump(by_alias=True)
                    if '_id' in char_dump: del char_dump['_id']

                    npcs_collection.update_one(
                        {"name": validated_char.name},
                        {"$set": char_dump},
                        upsert=True
                    )
                    processed_files.add(file_path)
                    print(f"   [VTT LOAD] {'PC' if char_data['character_type'] == 'Player Character' else 'NPC'} Loaded: {validated_char.name}")

                except Exception as e:
                    print(f"   [VTT ERROR] Failed to load {file_name}: {e}")

    print(f"[Data Sync] Finished. Total Processed: {len(processed_files)} | Total PCs Found: {pc_count}")
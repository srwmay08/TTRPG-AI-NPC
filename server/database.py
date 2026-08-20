# server/database.py
"""
Database Synchronization Module.
Manages the PyMongo client as a Singleton, preventing connection pool exhaustion.
Additionally handles the one-way syncing of static VTT JSON dumps and Lore files into MongoDB.
"""
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
    """
    MongoDB Database Connector utilizing the Singleton pattern.
    Guarantees only one active database client exists in memory across the entire Flask application.
    """
    _instance = None

    def __new__(cls):
        # If the instance doesn't exist, build the connection.
        if cls._instance is None:
            cls._instance = super(Database, cls).__new__(cls)
            try:
                # Initialize PyMongo client with URI from config
                cls._instance.client = MongoClient(app_config.MONGO_URI)
                # Issue an administrative 'ping' to immediately verify the connection is active
                cls._instance.client.admin.command('ping')
                print("Successfully connected to MongoDB!")
                cls._instance.db = cls._instance.client[app_config.DB_NAME]
            except Exception as e:
                # Fallback on failure, allowing the app to run (albeit without DB functionality)
                print(f"Could not connect to MongoDB: {e}")
                cls._instance.client = None
                cls._instance.db = None
        return cls._instance

    def get_db(self):
        """
        Retrieves the active database reference. Attempts to reconnect if it was lost.
        """
        if self.db is None:
            try:
                self.client = MongoClient(app_config.MONGO_URI)
                self.db = self.client[app_config.DB_NAME]
            except Exception:
                return None
        return self.db

# Expose a globally accessible instance of the connector
db_connector = Database()

def parse_json(data):
    """
    Utility function leveraging BSON's json_util to safely convert MongoDB documents
    (which contain complex types like ObjectId and datetime) into standard serializable JSON dicts.
    """
    return json.loads(json_util.dumps(data))

def sync_data_from_files():
    """
    Performs a disk-to-database synchronization process on application startup.
    Scans specified directories for .json files, validates them using Pydantic models,
    and upserts them into MongoDB based on their name identifier.
    """
    db = db_connector.get_db()
    if db is None:
        print("Database not available for data sync.")
        return

    npcs_collection = db.npcs
    lore_collection = db.lore_entries

    # --- 1. Sync Lore ---
    print("[Data Sync] Syncing lore data...")
    lore_dir = os.path.abspath(app_config.LORE_DATA_DIR)
    
    # Recursively traverse the lore directory
    if os.path.exists(lore_dir):
        for root, _, files in os.walk(lore_dir):
            for file_name in files:
                if file_name.endswith('.json'):
                    try:
                        # Open and read the raw lore file
                        with open(os.path.join(root, file_name), 'r', encoding='utf-8') as f:
                            raw_data = json.load(f)
                        
                        # Normalize single object files vs array dumps
                        lore_list = raw_data if isinstance(raw_data, list) else [raw_data]
                        
                        for lore_data in lore_list:
                            # Skip invalid structural blocks
                            if not isinstance(lore_data, dict) or 'name' not in lore_data:
                                continue
                            
                            # Provision a unique ID if the document lacks one natively
                            if 'lore_id' not in lore_data:
                                lore_data['lore_id'] = str(ObjectId())
                            
                            # Route through Pydantic to ensure the schema matches expectations
                            validated_lore = LoreEntry(**lore_data)
                            
                            # Upsert: Update if a lore entry with this exact name exists, otherwise Insert
                            lore_collection.update_one(
                                {"name": validated_lore.name},
                                {"$set": validated_lore.model_dump(by_alias=True, exclude={'lore_id'})},
                                upsert=True
                            )
                    except Exception as e:
                        print(f"[Data Sync] Lore Error in {file_name}: {e}")

    # --- 2. Sync Characters ---
    print("[Data Sync] Syncing character data...")
    
    # Hardcoded set of target PC filenames to restrict ingestion strictly to active players.
    active_pc_files = {
        "fvtt-Actor-garrett-xLalnoX86KWFZTJu.json",
        "fvtt-Actor-xander-vyltryn-FV69X8W1jSCi6BZU.json",
        "fvtt-Actor-sel'zen-daer'maer-the-shadow-bound-i7qpKNa6HrRxBt3l.json",
        "fvtt-Actor-vilis,-the-black-hand-lKM50j9uy4EOutz7.json",
        "fvtt-Actor-sudara-pzch3aBRuiQSqnv8.json",
        "fvtt-Actor-moriah-kiah-9vGd8Fwm6cEFUaos.json"
    }

    # Define paths holding character data. Includes general imports and specific PC imports.
    character_dirs = [
        os.path.abspath(app_config.PRIMARY_DATA_DIR), 
        os.path.abspath(app_config.PC_IMPORT_DIR)
    ]
    
    processed_files = set()
    pc_count = 0

    for directory in character_dirs:
        if not os.path.exists(directory): continue
        
        # Traverse character directories
        for root, _, files in os.walk(directory):
            # Guard clause: Do not attempt to process lore JSON files as character files
            if os.path.abspath(app_config.LORE_DATA_DIR) in os.path.abspath(root): continue
            
            # Identify if we are currently traversing the strict PC directory
            is_pc_folder = os.path.abspath(app_config.PC_IMPORT_DIR) in os.path.abspath(root)
            
            for file_name in files:
                if not file_name.endswith('.json'): continue
                
                file_path = os.path.join(root, file_name)
                
                # Deduplication logic to avoid processing the same file multiple times
                if file_path in processed_files: continue
                
                # If checking a PC folder, ensure the file matches the active list
                if is_pc_folder and file_name not in active_pc_files: continue

                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        char_data = json.load(f)
                    
                    if not isinstance(char_data, dict) or 'name' not in char_data: continue

                    # Normalization Step: Consolidate naming conventions for "Player Character"
                    # distinguishing it definitively from "NPC".
                    if char_data.get('type') == 'character' or is_pc_folder:
                        char_data['character_type'] = 'Player Character'
                        pc_count += 1
                    else:
                        char_data['character_type'] = 'NPC'

                    # Supply a fallback description to pass Pydantic validation if missing
                    if not char_data.get('description'):
                        char_data['description'] = "..."

                    # Flatten MongoDB BSON ObjectIds structured as dicts `{"$oid": "..."}` 
                    # into raw string IDs.
                    if '_id' in char_data and isinstance(char_data['_id'], dict):
                        char_data['_id'] = char_data['_id'].get('$oid', str(ObjectId()))

                    # Pass standard and VTT data through the rigorous Pydantic NPC model.
                    validated_char = NPCProfile(**char_data)
                    
                    # Convert the validated class back into a dictionary for DB insertion.
                    char_dump = validated_char.model_dump(by_alias=True)
                    
                    # Drop the `_id` field from the dictionary before upserting by `name`
                    # to prevent Mongo immutable _id conflict errors.
                    if '_id' in char_dump: del char_dump['_id']

                    # Perform Upsert based on character name.
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
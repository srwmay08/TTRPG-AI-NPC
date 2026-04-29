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

def sync_data_from_files():
    db = db_connector.get_db()
    if db is None:
        return

    npcs_collection = db.npcs
    
    # Active PC filter list
    active_pc_files = {
        "fvtt-Actor-garrett-xLalnoX86KWFZTJu.json",
        "fvtt-Actor-xander-vyltryn-FV69X8W1jSCi6BZU.json",
        "fvtt-Actor-sel'zen-daer'maer-the-shadow-bound-i7qpKNa6HrRxBt3l.json",
        "fvtt-Actor-vilis,-the-black-hand-lKM50j9uy4EOutz7.json",
        "fvtt-Actor-sudara-pzch3aBRuiQSqnv8.json",
        "fvtt-Actor-moriah-kiah-9vGd8Fwm6cEFUaos.json"
    }

    # Directories to scan for characters
    character_dirs = [
        os.path.abspath(app_config.PRIMARY_DATA_DIR), 
        os.path.abspath(app_config.VTT_IMPORT_DIR),
        os.path.abspath(app_config.PC_IMPORT_DIR)
    ]
    
    for directory in character_dirs:
        for root, _, files in os.walk(directory):
            # Check if current directory is the PC import folder
            is_pc_folder = os.path.abspath(app_config.PC_IMPORT_DIR) == os.path.abspath(root)
            
            for file_name in files:
                if file_name.endswith('.json'):
                    # Skip files in the PC folder that are not in our active list
                    if is_pc_folder and file_name not in active_pc_files:
                        continue

                    file_path = os.path.join(root, file_name)
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            char_data = json.load(f)
                        
                        # Set character type
                        if 'character_type' not in char_data:
                            char_data['character_type'] = 'Player Character' if is_pc_folder else 'NPC'

                        # Handle ID
                        if '_id' in char_data and isinstance(char_data['_id'], dict) and '$oid' in char_data['_id']:
                            char_data['_id'] = char_data['_id']['$oid']
                        elif '_id' not in char_data:
                            char_data['_id'] = str(ObjectId())

                        validated_char = NPCProfile(**char_data)
                        
                        # Update or Insert
                        npcs_collection.update_one(
                            {"_id": ObjectId(validated_char.id)},
                            {"$set": validated_char.model_dump(by_alias=True, exclude_unset=True)},
                            upsert=True
                        )
                    except Exception as e:
                        print(f"[Data Sync] Error processing {file_name}: {e}")
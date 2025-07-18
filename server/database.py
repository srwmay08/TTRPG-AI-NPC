# server/database.py
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
                # Verify connection
                cls._instance.client.admin.command('ping')
                print("Successfully connected to MongoDB!")
                cls._instance.db = cls._instance.client[app_config.DB_NAME]
            except ConnectionFailure as e:
                print(f"Could not connect to MongoDB: {e}")
                cls._instance.client = None
                cls._instance.db = None
            except Exception as e:
                print(f"An unexpected error occurred during MongoDB connection: {e}")
                cls._instance.client = None
                cls._instance.db = None
        return cls._instance

    def get_db(self):
        """Returns the database instance."""
        if self.db is None and self.client is None: # Only attempt reconnect if truly not connected
            print("Database not initialized. Attempting to reconnect...")
            try:
                self.client = MongoClient(app_config.MONGO_URI)
                self.client.admin.command('ping')
                self.db = self.client[app_config.DB_NAME]
                print("Reconnected to MongoDB!")
            except Exception as e:
                print(f"Failed to reconnect to MongoDB: {e}")
                return None
        elif self.db is None and self.client is not None: # Client exists but db object is None
             self.db = self.client[app_config.DB_NAME] # Re-assign db object
        return self.db

# Global DB connector instance
db_connector = Database()

def parse_json(data):
    # Handles MongoDB's ObjectId when converting to/from JSON
    return json.loads(json_util.dumps(data))

def sync_data_from_files():
    db = db_connector.get_db()
    if db is None:
        print("Database not available for data sync.")
        return

    npcs_collection = db.npcs
    lore_collection = db.lore_entries

    # --- Sync Lore first ---
    print("[Data Sync] Syncing lore data...")
    lore_count = 0
    new_lore_count = 0
    updated_lore_count = 0
    for root, _, files in os.walk(os.path.abspath(app_config.LORE_DATA_DIR)):
        for file_name in files:
            if file_name.endswith('.json'):
                file_path = os.path.join(root, file_name)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        lore_data = json.load(f)
                    
                    # Ensure lore_id is present or create one from _id if it's a MongoDB export
                    if '_id' in lore_data and '$oid' in lore_data['_id']:
                        lore_data['lore_id'] = str(lore_data['_id']['$oid'])
                    elif 'lore_id' not in lore_data:
                        lore_data['lore_id'] = str(ObjectId())

                    # Ensure lore_type is a valid enum member (Pydantic validation helps here)
                    if 'lore_type' in lore_data and lore_data['lore_type'] not in [t.value for t in LoreEntryType]:
                        print(f"Warning: Invalid lore_type '{lore_data['lore_type']}' in {file_name}. Defaulting to 'Miscellaneous'.")
                        lore_data['lore_type'] = LoreEntryType.MISC.value
                    elif 'lore_type' not in lore_data:
                        lore_data['lore_type'] = LoreEntryType.MISC.value

                    validated_lore_entry = LoreEntry(**lore_data)
                    
                    # Check if lore entry exists by lore_id
                    existing_lore = lore_collection.find_one({"lore_id": validated_lore_entry.lore_id})
                    
                    if existing_lore:
                        # Update existing lore entry
                        lore_collection.update_one(
                            {"lore_id": validated_lore_entry.lore_id},
                            {"$set": validated_lore_entry.model_dump(by_alias=True, exclude_unset=True)}
                        )
                        updated_lore_count += 1
                    else:
                        # Insert new lore entry
                        lore_collection.insert_one(validated_lore_entry.model_dump(by_alias=True))
                        new_lore_count += 1
                    lore_count += 1
                except ValidationError as e:
                    print(f"[Data Sync] Validation Error in lore file {file_name}: {e}")
                except json.JSONDecodeError as e:
                    print(f"[Data Sync] Error: Could not decode JSON from lore file {file_name}. It may be empty or malformed. Error: {e}")
                except Exception as e:
                    print(f"[Data Sync] Unexpected error processing lore file {file_name}: {e}")
                    traceback.print_exc()

    print(f"[Data Sync] Lore sync finished. Processed: {lore_count} | New: {new_lore_count} | Updated: {updated_lore_count}")

    # --- Sync Characters ---
    print("[Data Sync] Syncing character data...")
    character_count = 0
    new_char_count = 0
    updated_char_count = 0
    
    # Directories to scan for characters
    character_dirs = [os.path.abspath(app_config.PRIMARY_DATA_DIR), os.path.abspath(app_config.VTT_IMPORT_DIR)]
    
    for directory in character_dirs:
        for root, _, files in os.walk(directory):
            for file_name in files:
                if file_name.endswith('.json'):
                    file_path = os.path.join(root, file_name)
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            char_data = json.load(f)
                        
                        # --- NEW LOGIC FOR CHARACTER TYPE MAPPING (Crucial Fix) ---
                        if 'character_type' not in char_data:
                            if 'type' in char_data and char_data['type'] == 'character':
                                char_data['character_type'] = 'Player Character'
                            elif 'type' in char_data and char_data['type'] == 'npc':
                                char_data['character_type'] = 'NPC'
                            else:
                                # Default to NPC if no specific type is found (e.g., old manual JSONs without character_type)
                                char_data['character_type'] = 'NPC'
                        # --- END NEW LOGIC ---

                        # Ensure _id is handled for existing documents or create new one
                        if '_id' in char_data and '$oid' in char_data['_id']:
                            char_data['_id'] = str(char_data['_id']['$oid'])
                        elif '_id' not in char_data:
                            char_data['_id'] = str(ObjectId())

                        # Initialize fields that might be missing in older JSONs or VTT imports to prevent Pydantic errors
                        char_data['memories'] = char_data.get('memories', [])
                        char_data['associated_history_files'] = char_data.get('associated_history_files', [])
                        char_data['pc_faction_standings'] = char_data.get('pc_faction_standings', {})
                        char_data['linked_lore_by_name'] = char_data.get('linked_lore_by_name', [])
                        char_data['linked_lore_ids'] = char_data.get('linked_lore_ids', [])
                        char_data['canned_conversations'] = char_data.get('canned_conversations', {})
                        char_data['current_situation'] = char_data.get('current_situation', '')
                        char_data['past_situation'] = char_data.get('past_situation', '')
                        char_data['speech_patterns'] = char_data.get('speech_patterns', '')
                        char_data['mannerisms'] = char_data.get('mannerisms', '')
                        char_data['bonds'] = char_data.get('bonds', [])
                        char_data['flaws'] = char_data.get('flaws', [])
                        char_data['ideals'] = char_data.get('ideals', [])
                        char_data['motivations'] = char_data.get('motivations', [])
                        char_data['knowledge'] = char_data.get('knowledge', [])
                        char_data['relationships'] = char_data.get('relationships', [])
                        char_data['gm_notes'] = char_data.get('gm_notes', '')
                        char_data['img'] = char_data.get('img', None)
                        char_data['system'] = char_data.get('system', {}) # For VTT data
                        char_data['vtt_data'] = char_data.get('vtt_data', {}) # For VTT data
                        char_data['vtt_flags'] = char_data.get('vtt_flags', {}) # For VTT data


                        # Ensure ObjectId for _id field if it's coming from MongoDB export
                        if isinstance(char_data.get('_id'), dict) and '$oid' in char_data['_id']:
                            char_data['_id'] = char_data['_id']['$oid']

                        validated_char = NPCProfile(**char_data)
                        
                        # Find existing character using the _id (from file or generated)
                        existing_char = npcs_collection.find_one({"_id": ObjectId(validated_char.id)})
                        
                        if existing_char:
                            # Update existing character
                            npcs_collection.update_one(
                                {"_id": ObjectId(validated_char.id)},
                                {"$set": validated_char.model_dump(by_alias=True, exclude_unset=True)}
                            )
                            updated_char_count += 1
                        else:
                            # Insert new character
                            # Ensure _id is an ObjectId for new insertions (Pydantic models might return string IDs)
                            validated_char.id = str(ObjectId(validated_char.id)) if isinstance(validated_char.id, str) else str(ObjectId())
                            npcs_collection.insert_one(validated_char.model_dump(by_alias=True))
                            new_char_count += 1
                        character_count += 1
                        print(f"[DEBUG] Attempting to process character file: {file_name}")
                        if 'linked_lore_by_name' in char_data:
                            print(f"    [DEBUG] SUCCESS: Found 'linked_lore_by_name' for {char_data.get('name', 'Unnamed')} in {file_name}.")


                    except ValidationError as e:
                        print(f"[Data Sync] Validation Error in character file {file_name}: {e}")
                    except json.JSONDecodeError as e:
                        print(f"[Data Sync] Error: Could not decode JSON from character file {file_name}. It may be empty or malformed. Error: {e}")
                    except Exception as e:
                        print(f"[Data Sync] Unexpected error processing character file {file_name}: {e}")
                        traceback.print_exc()

    print(f"[Data Sync] Character sync finished. Processed: {character_count} | New: {new_char_count} | Updated: {updated_char_count}")

    # --- (Omitted for brevity: Logic to remove characters/lore from DB that no longer exist as files.
    #      This is typically done by comparing current DB entries with existing files and deleting orphans.
    #      Be careful with this logic to avoid accidental data loss.) ---
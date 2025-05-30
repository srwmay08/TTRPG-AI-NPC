# app.py
import os
import json
import re # For slugifying names
from flask import Flask, request, jsonify, render_template
from bson import ObjectId, json_util
from pydantic import ValidationError

from config import config as app_config
from database import db_connector
from models import NPCProfile, DialogueRequest, DialogueResponse, MemoryItem # NPCProfile now includes vtt_data
from ai_service import ai_service_instance

app = Flask(__name__)
app.secret_key = app_config.FLASK_SECRET_KEY

mongo_db = db_connector.get_db()

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

def find_fvtt_file(character_name, vtt_import_dir):
    """
    Tries to find a matching FVTT export file based on the character name.
    Assumes FVTT files are named like 'fvtt-Actor-<slugified-name>-<some-id>.json'
    """
    slug_name = slugify(character_name)
    if not os.path.isdir(vtt_import_dir):
        return None
    for filename in os.listdir(vtt_import_dir):
        if filename.startswith(f"fvtt-Actor-{slug_name}") and filename.endswith('.json'):
            return os.path.join(vtt_import_dir, filename)
    return None

def sync_data_from_files():
    """
    Loads character data from JSON files in the 'data/' directory
    and merges it with corresponding FVTT data from 'data/vtt_imports/',
    then syncs to MongoDB.
    """
    if mongo_db is None:
        print("[Data Sync] Skipping: Database not available.")
        return

    primary_data_dir = 'data'
    vtt_import_dir = 'data/vtt_imports' # Directory for FVTT JSON exports

    print("\n" + "-"*50)
    print(f"[Data Sync] Starting character data synchronization from '{primary_data_dir}' and '{vtt_import_dir}'...")

    if not os.path.isdir(primary_data_dir):
        print(f"[Data Sync] Warning: Primary data directory '{primary_data_dir}' not found. Skipping.")
        print("-" * 50)
        return
    
    if not os.path.isdir(vtt_import_dir):
        print(f"[Data Sync] Note: VTT import directory '{vtt_import_dir}' not found. Will proceed without VTT data.")
        # We can proceed without VTT data, it's an enhancement.
    
    characters_collection = mongo_db.npcs
    synced_count = 0
    updated_count = 0
    new_count = 0

    for filename in os.listdir(primary_data_dir):
        if filename.endswith('.json'):
            primary_file_path = os.path.join(primary_data_dir, filename)
            try:
                with open(primary_file_path, 'r', encoding='utf-8') as f:
                    primary_char_data = json.load(f)

                # Validate primary data first to get the name
                temp_profile_for_name = NPCProfile(**primary_char_data)
                char_name = temp_profile_for_name.name
                
                fvtt_system_data = None
                fvtt_file_path = find_fvtt_file(char_name, vtt_import_dir)

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

                # Combine primary data with FVTT data before final validation
                combined_data = primary_char_data.copy() # Start with primary
                if fvtt_system_data:
                    combined_data['vtt_data'] = fvtt_system_data 
                
                # Validate the combined data structure
                validated_profile = NPCProfile(**combined_data)
                
                existing_char_in_db = characters_collection.find_one({"name": char_name})
                
                # Prepare document for MongoDB, ensuring Pydantic model_dump is used
                # Exclude fields that are auto-generated or managed differently (like _id)
                # The `vtt_data` field is now part of the model, so it will be included by model_dump.
                mongo_doc = validated_profile.model_dump(mode='json', exclude_none=True) 

                if existing_char_in_db:
                    # Create an update payload, excluding _id
                    update_payload = {k: v for k, v in mongo_doc.items() if k != '_id'}
                    
                    # Check if there are actual changes to avoid unnecessary DB writes
                    is_changed = False
                    for key, value in update_payload.items():
                        if existing_char_in_db.get(key) != value:
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

# --- Existing API Routes (No changes needed for this request) ---
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
        # vtt_data can be part of the initial creation payload if provided
        character_profile_data = NPCProfile(**data) 
    except ValidationError as e:
        return jsonify({"error": "Validation Error", "details": e.errors()}), 400
    except Exception as e:
        return jsonify({"error": f"Invalid request data: {str(e)}"}), 400

    try:
        characters_collection = mongo_db.npcs 
        character_dict = character_profile_data.model_dump(mode='json', exclude_none=True) # Ensure vtt_data is included if present
        result = characters_collection.insert_one(character_dict)
        character_id = str(result.inserted_id)
        # Fetch from DB to include _id
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
            # Ensure _id is a string
            char_doc['_id'] = str(char_doc['_id'])
            # Basic defaults if fields are missing (though Pydantic should handle this on write)
            if 'character_type' not in char_doc:
                char_doc['character_type'] = 'NPC' 
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
    
    # No need to validate with NPCProfile on GET if we trust the DB schema
    # or if we want to return raw data.
    # If strict validation on GET is needed, uncomment the try-except below.
    # try:
    #     npc_profile = NPCProfile(**parse_json(npc_data))
    #     return jsonify(parse_json(npc_profile.model_dump(mode='json', exclude_none=True))), 200
    # except ValidationError as e:
    #     print(f"Warning: Character data for {npc_id_str} from DB has validation issues: {e.errors()}")
    #     return jsonify({"warning": "Character data from DB may be inconsistent", "raw_data": parse_json(npc_data)}), 200
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

        # Create a new NPCProfile instance from existing data merged with update_data_req
        # This ensures that any new vtt_data sent in the PUT request is also validated
        # and properly structured if it's being updated.
        
        current_data_for_validation = existing_npc_data.copy()
        # Remove ObjectId before merging with request data for Pydantic validation
        if '_id' in current_data_for_validation:
            del current_data_for_validation['_id'] 

        # Merge existing data with new update data, new data takes precedence
        merged_for_validation = {**current_data_for_validation, **update_data_req}
        
        # Validate the entire potential new state of the character
        validated_update_profile = NPCProfile(**merged_for_validation)
        
        # Prepare the document for MongoDB, excluding fields that shouldn't be directly set by PUT
        # or are managed by other endpoints (like memories).
        # vtt_data CAN be updated via PUT if included in request.
        update_doc_set = validated_update_profile.model_dump(
            mode='json', 
            exclude={'memories', 'linked_lore_ids', '_id'}, # _id is never in $set
            exclude_none=True
        )
        
        # Only include fields that were actually in the request or are part of the model
        # This prevents accidentally wiping fields not sent in the PUT if they were None in validated_update_profile
        final_set_payload = {}
        for key, value in update_doc_set.items():
            if key in update_data_req or key in NPCProfile.model_fields: # Check against model fields
                 final_set_payload[key] = value

        if not final_set_payload:
            return jsonify({"message": "No valid or changed fields provided for update."}), 200

    except ValidationError as e:
        return jsonify({"error": "Validation Error during update", "details": e.errors()}), 400
    except Exception as e:
        return jsonify({"error": f"Invalid request data for character update: {str(e)}"}), 400

    try:
        result = mongo_db.npcs.update_one({"_id": npc_id_obj}, {"$set": final_set_payload})
        if result.matched_count == 0: # Should not happen due to check above, but good practice
            return jsonify({"error": "Character not found for update (race condition?)"}), 404
        if result.modified_count == 0:
             return jsonify({"message": "Character data was the same, no changes applied.", "character_id": npc_id_str}), 200
        
        updated_npc_data_from_db = mongo_db.npcs.find_one({"_id": npc_id_obj})
        return jsonify({"message": "Character updated successfully", "character": parse_json(updated_npc_data_from_db)}), 200
    except Exception as e:
        return jsonify({"error": f"Could not update character: {str(e)}"}), 500

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
        
        # Create MemoryItem instance
        memory_item = MemoryItem(
            content=memory_req_data['content'],
            type=memory_req_data.get('type', 'user_added'),
            source=memory_req_data.get('source', 'gm_interface')
        )
    except ValidationError as e:
        return jsonify({"error": "Validation Error for memory item", "details": e.errors()}), 400
    
    try:
        # Push the Pydantic model dumped as a dict
        mongo_db.npcs.update_one(
            {"_id": npc_id_obj},
            {"$push": {"memories": memory_item.model_dump(mode='json')}}
        )
        updated_npc = mongo_db.npcs.find_one({"_id": npc_id_obj})
        return jsonify({
            "message": "Memory added successfully", 
            "npc_id": npc_id_str, 
            "new_memory": memory_item.model_dump(mode='json'), # Send back the validated and structured memory
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
    
    # No need to validate memory_id_str as ObjectId, it's a UUID string from MemoryItem model
    
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
        # Parse with Pydantic, which now includes the vtt_data field
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
    
    # Generate the NPC's dialogue response
    # The ai_service can now potentially access npc_profile.vtt_data if it's designed to
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
    # Create the vtt_imports directory if it doesn't exist, to avoid errors if user forgets
    vtt_dir = 'data/vtt_imports'
    if not os.path.exists(vtt_dir):
        os.makedirs(vtt_dir)
        print(f"Created directory: {vtt_dir}")
        print(f"Please place your FVTT JSON export files in '{vtt_dir}' for them to be imported.")

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
# app.py
import os # NEW IMPORT
import json # NEW IMPORT
from flask import Flask, request, jsonify, render_template
from bson import ObjectId, json_util
from pydantic import ValidationError

from config import config as app_config
from database import db_connector
from models import NPCProfile, DialogueRequest, DialogueResponse, MemoryItem
from ai_service import ai_service_instance

app = Flask(__name__)
app.secret_key = app_config.FLASK_SECRET_KEY

mongo_db = db_connector.get_db()

def parse_json(data):
    return json.loads(json_util.dumps(data))

# =====================================================================
# NEW: Data Synchronization Function
# =====================================================================
def sync_data_from_files():
    """
    Loads character data from JSON files in the 'data/' directory
    into the MongoDB database. Inserts new characters and updates existing ones.
    """
    if mongo_db is None:
        print("[Data Sync] Skipping: Database not available.")
        return

    data_dir = 'data'
    print("\n" + "-"*50)
    print("[Data Sync] Starting character data synchronization from 'data/' folder...")

    if not os.path.isdir(data_dir):
        print(f"[Data Sync] Warning: '{data_dir}' directory not found. Skipping.")
        print("-" * 50)
        return

    characters_collection = mongo_db.npcs
    synced_count = 0
    updated_count = 0
    new_count = 0

    for filename in os.listdir(data_dir):
        if filename.endswith('.json'):
            file_path = os.path.join(data_dir, filename)
            try:
                # --- THIS LINE IS THE FIX ---
                with open(file_path, 'r', encoding='utf-8') as f:
                    file_data = json.load(f)

                validated_data = NPCProfile(**file_data)
                
                char_name = validated_data.name
                existing_char = characters_collection.find_one({"name": char_name})

                source_of_truth_data = validated_data.model_dump(
                    mode='json', 
                    exclude={'memories', 'linked_lore_ids'}
                )

                if existing_char:
                    update_payload = {}
                    is_changed = False
                    for key, value in source_of_truth_data.items():
                        if key != '_id' and existing_char.get(key) != value:
                            update_payload[key] = value
                            is_changed = True
                    
                    if is_changed:
                        characters_collection.update_one(
                            {"_id": existing_char['_id']},
                            {"$set": update_payload}
                        )
                        print(f"[Data Sync] -> Updated character: {char_name}")
                        updated_count += 1
                    else:
                        print(f"[Data Sync] -> Character already up-to-date: {char_name}")
                else:
                    if 'memories' not in source_of_truth_data: source_of_truth_data['memories'] = []
                    if 'linked_lore_ids' not in source_of_truth_data: source_of_truth_data['linked_lore_ids'] = []
                    
                    characters_collection.insert_one(source_of_truth_data)
                    print(f"[Data Sync] -> Loaded new character: {char_name}")
                    new_count += 1

                synced_count += 1

            except ValidationError as e:
                print(f"[Data Sync] Error: Validation failed for {filename}. Details: {e}")
            except json.JSONDecodeError:
                print(f"[Data Sync] Error: Could not decode JSON from {filename}.")
            except Exception as e:
                print(f"[Data Sync] Error: An unexpected error occurred with {filename}: {e}")
    
    print(f"[Data Sync] Finished. Synced: {synced_count} | New: {new_count} | Updated: {updated_count}")
    print("-" * 50 + "\n")

# =====================================================================
# API Routes (Existing Code)
# =====================================================================

@app.route('/')
def serve_index():
    return render_template('index.html')

# --- Character CRUD Endpoints ---
# (Your existing routes: /api/npcs POST, /api/npcs GET, /api/npcs/<id> GET, /api/npcs/<id> PUT)
# (Your existing memory endpoints: POST and DELETE)
# (Your existing dialogue endpoint)
# ... The rest of your existing app.py code ...
@app.route('/api/npcs', methods=['POST'])
def create_npc():
    if mongo_db is None:
        return jsonify({"error": "Database not available"}), 503
    try:
        data = request.get_json()
        if not data: return jsonify({"error": "Invalid JSON payload"}), 400
        character_profile_data = NPCProfile(**data) 
    except ValidationError as e:
        return jsonify({"error": "Validation Error", "details": e.errors()}), 400
    except Exception as e:
        return jsonify({"error": f"Invalid request data: {str(e)}"}), 400

    try:
        characters_collection = mongo_db.npcs 
        character_dict = character_profile_data.model_dump(mode='json')
        result = characters_collection.insert_one(character_dict)
        character_id = str(result.inserted_id)
        created_character = character_profile_data.model_dump()
        created_character['_id'] = character_id 
        return jsonify({"message": f"{created_character.get('character_type', 'Character')} created successfully", "character": created_character}), 201
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
            char_doc['_id'] = str(char_doc['_id'])
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
    try:
        npc_profile = NPCProfile(**parse_json(npc_data))
        return jsonify(parse_json(npc_profile.model_dump(mode='json'))), 200
    except ValidationError as e:
        print(f"Warning: Character data for {npc_id_str} from DB has validation issues: {e.errors()}")
        return jsonify({"warning": "Character data from DB may be inconsistent", "raw_data": parse_json(npc_data)}), 200

@app.route('/api/npcs/<npc_id_str>', methods=['PUT'])
def update_npc(npc_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception:
        return jsonify({"error": "Invalid Character ID format"}), 400
    try:
        update_data = request.get_json()
        if not update_data:
            return jsonify({"error": "Invalid JSON payload for update"}), 400
        update_doc = {"$set": {}}
        allowed_fields_to_update = ["name", "description", "personality_traits", "background_story", "motivations", "knowledge", "gm_notes", "linked_lore_ids", "character_type"] 
        has_updates = False
        for key, value in update_data.items():
            if key in allowed_fields_to_update:
                update_doc["$set"][key] = value
                has_updates = True
        if not has_updates:
            return jsonify({"error": "No valid fields provided for update"}), 400
    except Exception as e:
        return jsonify({"error": f"Invalid request data for character update: {str(e)}"}), 400
    try:
        result = mongo_db.npcs.update_one({"_id": npc_id_obj}, update_doc)
        if result.matched_count == 0:
            return jsonify({"error": "Character not found for update"}), 404
        if result.modified_count == 0 and result.matched_count > 0 :
             return jsonify({"message": "Character data was the same, no changes applied.", "character_id": npc_id_str}), 200
        updated_npc_data = mongo_db.npcs.find_one({"_id": npc_id_obj})
        return jsonify({"message": "Character updated successfully", "character": parse_json(updated_npc_data)}), 200
    except Exception as e:
        return jsonify({"error": f"Could not update character: {str(e)}"}), 500

@app.route('/api/npcs/<npc_id_str>/memory', methods=['POST'])
def add_npc_memory(npc_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid Character ID format"}), 400
    if mongo_db.npcs.count_documents({"_id": npc_id_obj}) == 0:
        return jsonify({"error": "Character not found"}), 404
    try:
        memory_req_data = request.get_json()
        if not memory_req_data or 'content' not in memory_req_data:
            return jsonify({"error": "Memory content is required"}), 400
        memory_item = MemoryItem(
            content=memory_req_data['content'],
            type=memory_req_data.get('type', 'user_added'),
            source=memory_req_data.get('source', 'gm_interface')
        )
    except ValidationError as e:
        return jsonify({"error": "Validation Error for memory item", "details": e.errors()}), 400
    try:
        mongo_db.npcs.update_one(
            {"_id": npc_id_obj},
            {"$push": {"memories": memory_item.model_dump(mode='json')}}
        )
        updated_npc = mongo_db.npcs.find_one({"_id": npc_id_obj})
        return jsonify({
            "message": "Memory added successfully", 
            "npc_id": npc_id_str, 
            "new_memory": memory_item.model_dump(mode='json'),
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
    generated_text = ai_service_instance.generate_npc_dialogue(npc_profile, dialogue_request_data, world_lore_summary)
    
    # --- ENHANCEMENT: Generate a summarized memory from the interaction ---
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
    if mongo_db is not None:
        sync_data_from_files()
    else:
        print("CRITICAL: Could not connect to MongoDB. Application will run but database operations will fail.")

    if ai_service_instance is None or ai_service_instance.model is None:
        # CORRECTED LOG MESSAGE
        print("CRITICAL: AI Service model not initialized. Dialogue generation will be unavailable. Check server logs and GEMINI_API_KEY.")
    
    print("-" * 50)
    print(f"Flask Secret Key: {'Set' if app_config.FLASK_SECRET_KEY and app_config.FLASK_SECRET_KEY != 'a_default_secret_key' else 'NOT SET or Default'}")
    # CORRECTED PRINT STATEMENT
    print(f"Gemini API Key: {'Set' if app_config.GEMINI_API_KEY else 'NOT SET'}")
    print(f"Mongo URI: {app_config.MONGO_URI}")
    print("-" * 50)
    
    print("\n>>> Attempting to start Flask development server...")
    print(">>> If the server starts, you will see 'Running on...' messages below.")
    print(">>> If the script exits back to the command prompt, there is a critical error during startup.")
    print("-" * 50)

    app.run(debug=True, host='0.0.0.0', port=5000)
# app.py
from flask import Flask, request, jsonify, render_template # render_template is important
from bson import ObjectId, json_util # json_util for better MongoDB ObjectId serialization
from pydantic import ValidationError
import json # For parsing ObjectId from Pydantic models if needed

from config import config as app_config
from database import db_connector
from models import NPCProfile, DialogueRequest, DialogueResponse, MemoryItem # Make sure MemoryItem is imported
from ai_service import ai_service_instance
# import datetime # Already imported in models.py if MemoryItem uses it.

app = Flask(__name__)
app.secret_key = app_config.FLASK_SECRET_KEY

mongo_db = db_connector.get_db()

# --- Helper for ObjectId conversion ---
def parse_json(data):
    return json.loads(json_util.dumps(data))

# --- HTML Serving Route ---
@app.route('/')
def serve_index():
    """Serves the main HTML page for the GM interface."""
    return render_template('index.html')

# --- NPC CRUD Endpoints ---
@app.route('/api/npcs', methods=['POST'])
def create_npc():
    if mongo_db is None:
        return jsonify({"error": "Database not available"}), 503
    try:
        data = request.get_json()
        if not data: return jsonify({"error": "Invalid JSON payload"}), 400
        npc_profile_data = NPCProfile(**data)
    except ValidationError as e:
        return jsonify({"error": "Validation Error", "details": e.errors()}), 400
    except Exception as e:
        return jsonify({"error": f"Invalid request data: {str(e)}"}), 400

    try:
        npcs_collection = mongo_db.npcs
        npc_dict = npc_profile_data.model_dump(mode='json') # Uses Pydantic's serialization
        
        result = npcs_collection.insert_one(npc_dict)
        npc_id = str(result.inserted_id)
        
        # Return the full NPC object including the generated _id
        created_npc = npc_profile_data.model_dump()
        created_npc['_id'] = npc_id # Add string version of _id for frontend convenience
        return jsonify({"message": "NPC created successfully", "npc": created_npc}), 201

    except Exception as e:
        return jsonify({"error": f"Could not create NPC: {str(e)}"}), 500

@app.route('/api/npcs', methods=['GET'])
def get_all_npcs():
    """Retrieves all NPCs."""
    if mongo_db is None:
        return jsonify({"error": "Database not available"}), 503
    try:
        npcs_cursor = mongo_db.npcs.find({})
        # Correctly serialize MongoDB documents, including ObjectId
        npcs_list = []
        for npc_doc in npcs_cursor:
            npc_doc['_id'] = str(npc_doc['_id']) # Convert ObjectId to string for frontend
            # Ensure memories also have memory_id as string if they are stored with ObjectId
            if 'memories' in npc_doc and npc_doc['memories']:
                for mem in npc_doc['memories']:
                    if isinstance(mem.get('memory_id'), ObjectId): # Should not happen if Pydantic handles it
                         mem['memory_id'] = str(mem['memory_id'])
            npcs_list.append(npc_doc)

        return jsonify(npcs_list), 200
    except Exception as e:
        return jsonify({"error": f"Could not retrieve NPCs: {str(e)}"}), 500

@app.route('/api/npcs/<npc_id_str>', methods=['GET'])
def get_npc(npc_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception:
        return jsonify({"error": "Invalid NPC ID format"}), 400

    npc_data = mongo_db.npcs.find_one({"_id": npc_id_obj})
    if not npc_data:
        return jsonify({"error": "NPC not found"}), 404
    
    npc_data['_id'] = str(npc_data['_id']) # Ensure _id is string
    # Ensure memories structure is fine for Pydantic re-validation if needed,
    # or directly return the dict if frontend handles it.
    try:
        npc_profile = NPCProfile(**npc_data) # Re-validate to ensure consistency
        return jsonify(parse_json(npc_profile.model_dump(mode='json'))), 200 # Use parse_json for ObjectId if any slip through
    except ValidationError as e:
        print(f"Warning: NPC data for {npc_id_str} from DB has validation issues on GET: {e.errors()}")
        return jsonify({"warning": "NPC data from DB may be inconsistent", "raw_data": parse_json(npc_data)}), 200


@app.route('/api/npcs/<npc_id_str>', methods=['PUT'])
def update_npc(npc_id_str: str):
    """Updates an NPC's details (e.g., GM notes, or other fields)."""
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception:
        return jsonify({"error": "Invalid NPC ID format"}), 400

    try:
        update_data = request.get_json()
        if not update_data:
            return jsonify({"error": "Invalid JSON payload for update"}), 400
        
        # Prepare update document for MongoDB. $set will update only provided fields.
        # We don't re-validate the whole NPCProfile here, just update specific fields.
        # For more complex updates, you might fetch, modify Pydantic model, then save.
        update_doc = {"$set": {}}
        allowed_fields_to_update = ["name", "description", "personality_traits", "background_story", "motivations", "knowledge", "gm_notes", "linked_lore_ids"] # Add more as needed
        
        has_updates = False
        for key, value in update_data.items():
            if key in allowed_fields_to_update:
                update_doc["$set"][key] = value
                has_updates = True
        
        if not has_updates:
            return jsonify({"error": "No valid fields provided for update"}), 400

    except Exception as e:
        return jsonify({"error": f"Invalid request data for NPC update: {str(e)}"}), 400

    try:
        result = mongo_db.npcs.update_one({"_id": npc_id_obj}, update_doc)
        if result.matched_count == 0:
            return jsonify({"error": "NPC not found for update"}), 404
        if result.modified_count == 0 and result.matched_count > 0 :
             return jsonify({"message": "NPC data was the same, no changes applied.", "npc_id": npc_id_str}), 200


        # Fetch and return the updated NPC
        updated_npc_data = mongo_db.npcs.find_one({"_id": npc_id_obj})
        updated_npc_data['_id'] = str(updated_npc_data['_id'])
        return jsonify({"message": "NPC updated successfully", "npc": parse_json(updated_npc_data)}), 200
    except Exception as e:
        return jsonify({"error": f"Could not update NPC: {str(e)}"}), 500


# --- Memory Endpoints ---
@app.route('/api/npcs/<npc_id_str>/memory', methods=['POST'])
def add_npc_memory(npc_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid NPC ID format"}), 400

    npc_exists = mongo_db.npcs.count_documents({"_id": npc_id_obj}) > 0
    if not npc_exists: return jsonify({"error": "NPC not found"}), 404

    try:
        memory_req_data = request.get_json()
        if not memory_req_data or 'content' not in memory_req_data:
            return jsonify({"error": "Memory content is required"}), 400
        
        # Create MemoryItem using Pydantic, this will assign a memory_id
        memory_item = MemoryItem(
            content=memory_req_data['content'],
            type=memory_req_data.get('type', 'user_added'), # Default type if not provided
            source=memory_req_data.get('source', 'gm_interface') # Default source
        )
    except ValidationError as e:
        return jsonify({"error": "Validation Error for memory item", "details": e.errors()}), 400
    except Exception as e:
        return jsonify({"error": f"Invalid memory data: {str(e)}"}), 400

    try:
        # Push the Pydantic model dumped as dict to MongoDB
        update_result = mongo_db.npcs.update_one(
            {"_id": npc_id_obj},
            {"$push": {"memories": memory_item.model_dump(mode='json')}}
        )
        if update_result.modified_count == 0:
             return jsonify({"error": "Failed to add memory, NPC not found or not modified."}), 500
        
        # Fetch the updated NPC to return the new memory list
        updated_npc = mongo_db.npcs.find_one({"_id": npc_id_obj})
        updated_npc['_id'] = str(updated_npc['_id']) # For frontend
        
        return jsonify({
            "message": "Memory added successfully", 
            "npc_id": npc_id_str, 
            "new_memory": memory_item.model_dump(mode='json'),
            "updated_memories": parse_json(updated_npc.get("memories", [])) # Return all memories
        }), 200
    except Exception as e:
        return jsonify({"error": f"Could not add memory: {str(e)}"}), 500

@app.route('/api/npcs/<npc_id_str>/memory/<memory_id_str>', methods=['DELETE'])
def delete_npc_memory(npc_id_str: str, memory_id_str: str):
    """Deletes a specific memory item from an NPC ('Undo Mem')."""
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception:
        return jsonify({"error": "Invalid NPC ID format"}), 400

    try:
        # We are pulling an item from an array that matches the memory_id_str
        update_result = mongo_db.npcs.update_one(
            {"_id": npc_id_obj},
            {"$pull": {"memories": {"memory_id": memory_id_str}}}
        )

        if update_result.matched_count == 0:
            return jsonify({"error": "NPC not found"}), 404
        if update_result.modified_count == 0:
            return jsonify({"error": "Memory item not found or already deleted"}), 404
        
        # Fetch the updated NPC to return the new memory list
        updated_npc = mongo_db.npcs.find_one({"_id": npc_id_obj})
        updated_npc['_id'] = str(updated_npc['_id'])

        return jsonify({
            "message": "Memory deleted successfully", 
            "npc_id": npc_id_str,
            "deleted_memory_id": memory_id_str,
            "updated_memories": parse_json(updated_npc.get("memories", []))
        }), 200
    except Exception as e:
        return jsonify({"error": f"Could not delete memory: {str(e)}"}), 500


# --- Dialogue Endpoint (remains largely the same, ensure NPCProfile is up-to-date) ---
@app.route('/api/npcs/<npc_id_str>/dialogue', methods=['POST'])
def generate_dialogue_for_npc(npc_id_str: str):
    if mongo_db is None: return jsonify({"error": "Database not available"}), 503
    if ai_service_instance is None or ai_service_instance.model is None:
        return jsonify({"error": "AI Service not available"}), 503

    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception:
        return jsonify({"error": "Invalid NPC ID format"}), 400

    npc_data_from_db = mongo_db.npcs.find_one({"_id": npc_id_obj})
    if not npc_data_from_db:
        return jsonify({"error": "NPC not found"}), 404
    
    # npc_data_from_db["_id"] = str(npc_data_from_db["_id"]) # Already string if from our GET, but ensure if direct DB
    try:
        npc_profile = NPCProfile(**parse_json(npc_data_from_db)) # Use parse_json before Pydantic
    except ValidationError as e:
        return jsonify({"error": "NPC data in DB is invalid", "details": e.errors(), "raw_data": parse_json(npc_data_from_db)}), 500

    try:
        dialogue_request_data = DialogueRequest(**request.get_json())
    except ValidationError as e:
        return jsonify({"error": "Validation Error in dialogue request", "details": e.errors()}), 400
    
    world_lore_summary = None # Placeholder for actual lore fetching logic
    if npc_profile.linked_lore_ids:
        world_lore_summary = f"This NPC is linked to lore items: {', '.join(npc_profile.linked_lore_ids)}. (Details would be fetched and summarized here based on IDs)."

    generated_text = ai_service_instance.generate_npc_dialogue(npc_profile, dialogue_request_data, world_lore_summary)
    
    # AI might suggest memories; frontend can then use "add_npc_memory"
    # For now, DialogueResponse will carry basic suggestions.
    ai_suggested_memories_content = []
    if "player said" in generated_text.lower() or "you said" in generated_text.lower(): # Very basic heuristic
        ai_suggested_memories_content.append(f"Player's interaction: {dialogue_request_data.player_utterance}")
    ai_suggested_memories_content.append(f"NPC's response: {generated_text}")


    response_data = DialogueResponse(
        npc_id=npc_id_str,
        npc_dialogue=generated_text,
        new_memory_suggestions=ai_suggested_memories_content, # Keep this simple for now
        generated_topics=[] # Placeholder for AI topic generation
    )
    return jsonify(response_data.model_dump(mode='json')), 200


# --- Main execution ---
if __name__ == '__main__':
    if mongo_db is None:
        print("CRITICAL: Could not connect to MongoDB. Application cannot start properly.")
    if ai_service_instance is None or ai_service_instance.model is None: # Check model attribute
        print("CRITICAL: AI Service or its model not initialized. Dialogue generation will fail.")
    
    print(f"Flask Secret Key: {'Set' if app.secret_key and app.secret_key != 'a_default_secret_key' else 'NOT SET or Default - Please set FLASK_SECRET_KEY in .env'}")
    print(f"Google API Key: {'Set' if app_config.GOOGLE_API_KEY else 'NOT SET - Please set GOOGLE_API_KEY in .env'}")
    print(f"Mongo URI: {app_config.MONGO_URI}")
    print(f"Target DB Name: {app_config.DB_NAME}")

    app.run(debug=True, host='0.0.0.0', port=5000) # host='0.0.0.0' makes it accessible on your network
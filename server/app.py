# app.py
from flask import Flask, request, jsonify, render_template
from bson import ObjectId
from pydantic import ValidationError

from config import config as app_config # Renamed to avoid conflict with flask.config
from database import db_connector
from models import NPCProfile, DialogueRequest, DialogueResponse, MemoryItem
from ai_service import ai_service_instance
import datetime

app = Flask(__name__)
app.secret_key = app_config.FLASK_SECRET_KEY

# Get a database instance
mongo_db = db_connector.get_db()

@app.route('/')
def index():
    """Serves a simple landing page (optional)."""
    # For now, just a JSON response. We can render templates later.
    # return render_template('index.html') # You'll need to create templates/index.html
    return jsonify({"message": "Welcome to Bugbear Banter API!"}), 200

@app.route('/api/npcs', methods=['POST'])
def create_npc():
    """Creates a new NPC."""
    if not mongo_db:
        return jsonify({"error": "Database not available"}), 503
        
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON payload"}), 400
        
        npc_profile_data = NPCProfile(**data) # Validate with Pydantic
    except ValidationError as e:
        return jsonify({"error": "Validation Error", "details": e.errors()}), 400
    except Exception as e:
        return jsonify({"error": f"Invalid request data: {str(e)}"}), 400

    try:
        npcs_collection = mongo_db.npcs
        # Convert Pydantic model to dict for MongoDB insertion
        npc_dict = npc_profile_data.model_dump(mode='json') # handles datetime for memories
        
        result = npcs_collection.insert_one(npc_dict)
        npc_id = str(result.inserted_id)
        
        return jsonify({"message": "NPC created successfully", "npc_id": npc_id, "data": npc_profile_data.model_dump()}), 201
    except Exception as e:
        return jsonify({"error": f"Could not create NPC: {str(e)}"}), 500

@app.route('/api/npcs/<npc_id_str>', methods=['GET'])
def get_npc(npc_id_str: str):
    """Retrieves a specific NPC by its ID."""
    if not mongo_db:
        return jsonify({"error": "Database not available"}), 503
    try:
        npc_id = ObjectId(npc_id_str)
    except Exception:
        return jsonify({"error": "Invalid NPC ID format"}), 400

    npc_data = mongo_db.npcs.find_one({"_id": npc_id})
    if not npc_data:
        return jsonify({"error": "NPC not found"}), 404
    
    # Convert MongoDB's _id to string and ensure data matches Pydantic model
    npc_data["_id"] = str(npc_data["_id"])
    # Re-parse with Pydantic to ensure structure and handle potential data inconsistencies from DB
    try:
        npc_profile = NPCProfile(**npc_data)
    except ValidationError as e:
         # This might happen if data in DB is old/malformed
        print(f"Warning: Data for NPC ID {npc_id_str} from DB caused validation error: {e.errors()}")
        # Return raw data with a warning or handle more gracefully
        return jsonify({"warning": "NPC data from DB has validation issues", "raw_data": npc_data}), 200


    return jsonify(npc_profile.model_dump(mode='json')), 200


@app.route('/api/npcs/<npc_id_str>/dialogue', methods=['POST'])
def generate_dialogue_for_npc(npc_id_str: str):
    """Generates dialogue for a given NPC."""
    if not mongo_db:
        return jsonify({"error": "Database not available"}), 503
    if not ai_service_instance or not ai_service_instance.model:
        return jsonify({"error": "AI Service not available"}), 503

    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception:
        return jsonify({"error": "Invalid NPC ID format"}), 400

    npc_data_from_db = mongo_db.npcs.find_one({"_id": npc_id_obj})
    if not npc_data_from_db:
        return jsonify({"error": "NPC not found"}), 404
    
    # Convert MongoDB _id to string for Pydantic model
    npc_data_from_db["_id"] = str(npc_data_from_db["_id"])
    try:
        # This is important to ensure memories are properly parsed as MemoryItem objects
        npc_profile = NPCProfile(**npc_data_from_db)
    except ValidationError as e:
        return jsonify({"error": "NPC data in DB is invalid", "details": e.errors()}), 500


    try:
        dialogue_request_data = DialogueRequest(**request.get_json())
    except ValidationError as e:
        return jsonify({"error": "Validation Error in dialogue request", "details": e.errors()}), 400
    except Exception as e:
        return jsonify({"error": f"Invalid request data for dialogue: {str(e)}"}), 400

    # Placeholder for fetching linked world lore summary (Goal 3)
    world_lore_summary = None
    if npc_profile.linked_lore_ids:
        # In a real scenario, you'd fetch these lore items from a 'world_items' collection
        # and summarize them or pass relevant parts to the AI.
        # For now, a placeholder:
        world_lore_summary = f"This NPC is linked to lore items: {', '.join(npc_profile.linked_lore_ids)}. (Details would be fetched and summarized here)."


    generated_text = ai_service_instance.generate_npc_dialogue(npc_profile, dialogue_request_data, world_lore_summary)

    # Basic "To Memory" suggestion (can be improved by AI)
    new_memory_suggestions = []
    if dialogue_request_data.player_utterance:
        new_memory_suggestions.append(f"Player said: '{dialogue_request_data.player_utterance}'")
    new_memory_suggestions.append(f"NPC responded: '{generated_text}'")
    
    # For a more advanced "To Memory" / "Undo Mem" (Goal 1.A), we would:
    # 1. Let AI suggest structured memory items (facts, sentiments).
    # 2. Provide endpoints to explicitly save/undo these to npc_profile.memories in DB.

    response_data = DialogueResponse(
        npc_id=npc_id_str,
        npc_dialogue=generated_text,
        new_memory_suggestions=new_memory_suggestions 
        # generated_topics would also come from AI in a more advanced version
    )

    return jsonify(response_data.model_dump(mode='json')), 200

# (MVP for Goal 1.A - NPC Persistent Memory - Phase 1: Fact Recall - Manual Add)
@app.route('/api/npcs/<npc_id_str>/memory', methods=['POST'])
def add_npc_memory(npc_id_str: str):
    if not mongo_db: return jsonify({"error": "Database not available"}), 503
    try:
        npc_id_obj = ObjectId(npc_id_str)
    except Exception: return jsonify({"error": "Invalid NPC ID format"}), 400

    npc_data = mongo_db.npcs.find_one({"_id": npc_id_obj})
    if not npc_data: return jsonify({"error": "NPC not found"}), 404

    try:
        memory_data = request.get_json()
        if not memory_data or 'content' not in memory_data:
            return jsonify({"error": "Memory content is required"}), 400
        
        # Create MemoryItem, allowing optional type and source from request
        memory_item = MemoryItem(
            content=memory_data['content'],
            type=memory_data.get('type', 'gm_added_fact'),
            source=memory_data.get('source', 'gm_tool')
        )
    except ValidationError as e:
        return jsonify({"error": "Validation Error for memory item", "details": e.errors()}), 400
    except Exception as e:
        return jsonify({"error": f"Invalid memory data: {str(e)}"}), 400

    try:
        # Using $push to add to the memories array in MongoDB
        mongo_db.npcs.update_one(
            {"_id": npc_id_obj},
            {"$push": {"memories": memory_item.model_dump(mode='json')}} # Save as dict
        )
        return jsonify({"message": "Memory added successfully to NPC", "npc_id": npc_id_str}), 200
    except Exception as e:
        return jsonify({"error": f"Could not add memory: {str(e)}"}), 500

if __name__ == '__main__':
    if not mongo_db:
        print("CRITICAL: Could not connect to MongoDB. Application cannot start properly.")
        # Optionally exit if DB is critical for startup
        # exit(1) 
    if not ai_service_instance or not ai_service_instance.model:
        print("CRITICAL: AI Service not initialized. Dialogue generation will fail.")
    
    print(f"Flask Secret Key: {'Set' if app.secret_key and app.secret_key != 'a_default_secret_key' else 'NOT SET or Default - Please set FLASK_SECRET_KEY in .env'}")
    print(f"Google API Key: {'Set' if app_config.GOOGLE_API_KEY else 'NOT SET - Please set GOOGLE_API_KEY in .env'}")
    print(f"Mongo URI: {app_config.MONGO_URI}")
    print(f"Target DB Name: {app_config.DB_NAME}")

    app.run(debug=True) # debug=True is for development, turn off for production
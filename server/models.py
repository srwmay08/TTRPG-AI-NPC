# models.py
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

class MemoryItem(BaseModel):
    """Represents a single memory item for an NPC."""
    memory_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique ID for the memory item.")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    content: str
    type: str = "generic"
    source: str = "dialogue"

class NPCProfile(BaseModel):
    """Defines the structure for a character's profile."""
    name: str = Field(..., min_length=1, description="The name of the character.")
    description: str = Field(..., description="A general description of the character.")
    character_type: str = Field(default="NPC", description="Type of character: NPC or PC.")
    
    # --- ADDED OPTIONAL FIELDS TO MATCH YOUR DETAILED JSONs ---
    race: Optional[str] = None
    class_str: Optional[str] = Field(default=None, alias="class") # Use alias because 'class' is a reserved keyword in Python
    alignment: Optional[str] = None
    age: Optional[str] = None
    ideals: List[str] = Field(default_factory=list)
    bonds: List[str] = Field(default_factory=list)
    flaws: List[str] = Field(default_factory=list)
    speech_patterns: Optional[str] = None
    mannerisms: Optional[str] = None
    relationships: List[Dict[str, Any]] = Field(default_factory=list)
    past_situation: Optional[str] = None
    current_situation: Optional[str] = None
    
    # --- EXISTING FIELDS ---
    personality_traits: List[str] = Field(default_factory=list, description="Key personality traits.")
    background_story: Optional[str] = None
    motivations: List[str] = Field(default_factory=list)
    knowledge: List[str] = Field(default_factory=list, description="Specific pieces of knowledge the character has.")
    memories: List[MemoryItem] = Field(default_factory=list, description="Character's persistent memories.")
    linked_lore_ids: List[str] = Field(default_factory=list, description="IDs of linked world information items.")
    gm_notes: Optional[str] = Field(default=None, description="Private GM notes for this character.")

    class Config:
        # This allows Pydantic to populate fields from data using either the field name OR its alias
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "name": "Mattrim 'Threestrings' Mereg",
                "character_type": "NPC",
                "description": "A laid-back human bard from Waterdeep.",
                "race": "Human",
                "class": "Bard",
                "personality_traits": ["Eternally chill", "Has the munchies"]
            }
        }

# --- OTHER MODELS REMAIN THE SAME ---
class WorldItem(BaseModel):
    # ... (no changes needed)
    item_id: str = Field(..., description="Unique ID for the world item, can be auto-generated or user-defined.")
    name: str
    type: str
    description: str
    details: Dict[str, Any] = Field(default_factory=dict)
    linked_npc_ids: List[str] = Field(default_factory=list)

class DialogueRequest(BaseModel):
    scene_context: str
    player_utterance: Optional[str] = None
    active_pcs: List[str] = Field(default_factory=list, description="Names or IDs of player characters present in the scene.")
    recent_dialogue_history: List[str] = Field(default_factory=list, description="Last few lines of conversation.")

class DialogueResponse(BaseModel):
    # ... (no changes needed)
    npc_id: str
    npc_dialogue: str
    # IMPROVEMENT: Changed from a generic list to a single, more potent suggestion.
    new_memory_suggestions: List[str] = Field(default_factory=list, description="AI suggestions for what to add to memory, including a summarized version of the interaction.")
    generated_topics: List[str] = Field(default_factory=list, description="AI suggested topics for further conversation.")
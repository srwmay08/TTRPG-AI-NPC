# models.py
from pydantic import BaseModel, Field, HttpUrl
from typing import List, Optional, Dict, Any
from datetime import datetime

class MemoryItem(BaseModel):
    """Represents a single memory item for an NPC."""
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    content: str
    type: str = "generic" # e.g., fact, event, sentiment, observation
    source: str = "dialogue" # e.g., dialogue, gm_input, linked_lore

class NPCProfile(BaseModel):
    """Defines the structure for an NPC's profile."""
    name: str = Field(..., min_length=1, description="The name of the NPC.")
    description: str = Field(..., description="A general description of the NPC.")
    personality_traits: List[str] = Field(default_factory=list, description="Key personality traits.")
    background_story: Optional[str] = None
    motivations: List[str] = Field(default_factory=list)
    knowledge: List[str] = Field(default_factory=list, description="Specific pieces of knowledge the NPC has.")
    memories: List[MemoryItem] = Field(default_factory=list, description="NPC's persistent memories.")
    linked_lore_ids: List[str] = Field(default_factory=list, description="IDs of linked world information items.")
    # We can add more fields as per PRD, e.g., relationships, appearance, voice_description

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Grunk the Orc Blacksmith",
                "description": "A burly orc with a surprisingly gentle demeanor, skilled in smithing.",
                "personality_traits": ["gruff exterior", "kind-hearted", "proud of his work"],
                "background_story": "Exiled from his tribe for refusing to participate in a raid, Grunk found solace in the forge.",
                "motivations": ["Create the finest weapons", "Protect his new village"],
                "knowledge": ["Ancient smithing techniques", "Weaknesses of various armors"],
                "memories": [],
                "linked_lore_ids": []
            }
        }

class WorldItem(BaseModel):
    """Represents a piece of world information (lore, location, event, etc.)."""
    item_id: str = Field(..., description="Unique ID for the world item, can be auto-generated or user-defined.")
    name: str
    type: str # e.g., "location", "religion", "event", "faction", "object"
    description: str
    details: Dict[str, Any] = Field(default_factory=dict) # For flexible additional data
    linked_npc_ids: List[str] = Field(default_factory=list)

    class Config:
        json_schema_extra = {
            "example": {
                "item_id": "daggerford_murders_event_001",
                "name": "The Daggerford Murders",
                "type": "event",
                "description": "A series of unsolved murders that have recently plagued the town of Daggerford.",
                "details": {"victims": ["Merchant Aldo", "Guard Captain Anya"], "suspects": ["Mysterious cloaked figure", "Rival merchant guild"]},
                "linked_npc_ids": ["grunk_orc_blacksmith_id"]
            }
        }

class DialogueRequest(BaseModel):
    """Request model for generating dialogue."""
    npc_id: str
    scene_context: str
    player_utterance: Optional[str] = None # What the player character said to the NPC
    active_pcs: List[str] = Field(default_factory=list, description="Names or IDs of player characters present in the scene.")
    recent_dialogue_history: List[str] = Field(default_factory=list, description="Last few lines of conversation.")
    # Add other NPCs in scene for NPC-to-NPC awareness later

class DialogueResponse(BaseModel):
    """Response model for generated dialogue."""
    npc_id: str
    npc_dialogue: str
    new_memory_suggestions: List[str] = Field(default_factory=list, description="AI suggestions for what to add to memory.")
    generated_topics: List[str] = Field(default_factory=list, description="AI suggested topics for further conversation.")
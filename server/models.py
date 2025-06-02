# models.py
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
from enum import Enum

class FactionStandingLevel(str, Enum):
    ALLY = "Ally"
    WARMLY = "Warmly"
    KINDLY = "Kindly"
    AMIABLE = "Amiable"
    INDIFFERENT = "Indifferent"
    APPREHENSIVE = "Apprehensive"
    DUBIOUS = "Dubious"
    THREATENING = "Threatening"

class MemoryItem(BaseModel):
    """Represents a single memory item for an NPC."""
    memory_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique ID for the memory item.")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    content: str
    type: str = "generic"
    source: str = "dialogue"

class LoreEntryType(str, Enum):
    LOCATION = "Location"
    ORGANIZATION = "Organization/Faction"
    HISTORICAL_EVENT = "Historical Event"
    KEY_ITEM = "Key Item/Artifact"
    CONCEPT_DEITY = "Concept/Deity"
    MISC = "Miscellaneous"

class LoreEntry(BaseModel):
    """Defines the structure for a world lore entry."""
    lore_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique ID for the lore entry.")
    name: str = Field(..., min_length=1, description="The name or title of the lore entry.")
    lore_type: LoreEntryType = Field(default=LoreEntryType.MISC, description="The category of the lore entry.")
    description: str = Field(..., description="A general description of the lore entry.")
    key_facts: List[str] = Field(default_factory=list, description="Bullet points of key information.")
    tags: List[str] = Field(default_factory=list, description="Keywords for searching and linking.")
    gm_notes: Optional[str] = Field(default=None, description="Private GM notes for this lore entry.")
    linked_character_ids: List[str] = Field(default_factory=list, description="IDs of characters directly linked to this lore.")
    linked_lore_entry_ids: List[str] = Field(default_factory=list, description="IDs of other lore entries linked to this one.")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "name": "The Yawning Portal Inn",
                "lore_type": "Location",
                "description": "A famous inn and tavern in Waterdeep, known for the large well in its common room that descends into Undermountain.",
                "key_facts": ["Owned by Durnan.", "Entrance to Undermountain.", "Popular adventurers' hangout."],
                "tags": ["Waterdeep", "Tavern", "Undermountain", "Durnan"],
            }
        }

class NPCProfile(BaseModel):
    """Defines the structure for a character's profile."""
    name: str = Field(..., min_length=1, description="The name of the character.")
    description: str = Field(..., description="A general description of the character.")
    character_type: str = Field(default="NPC", description="Type of character: NPC or PC.")
    
    race: Optional[str] = None
    class_str: Optional[str] = Field(default=None, alias="class")
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
    
    personality_traits: List[str] = Field(default_factory=list, description="Key personality traits.")
    background_story: Optional[str] = None # Kept for general, less structured backstory
    motivations: List[str] = Field(default_factory=list)
    knowledge: List[str] = Field(default_factory=list, description="Specific pieces of knowledge the character has (less structured than lore).")
    memories: List[MemoryItem] = Field(default_factory=list, description="Character's persistent memories.")
    
    gm_notes: Optional[str] = Field(default=None, description="Private GM notes for this character.")
    
    vtt_data: Optional[Dict[str, Any]] = Field(default=None, description="Data imported from VTT character sheets (usually the 'system' object).")
    vtt_flags: Optional[Dict[str, Any]] = Field(default=None, description="Top-level 'flags' object imported from VTT character sheets.")

    associated_history_files: List[str] = Field(default_factory=list, description="List of filenames of associated detailed history .txt files.")
    linked_lore_ids: List[str] = Field(default_factory=list, description="IDs of structured lore entries relevant to this character.")

    img: Optional[str] = Field(default=None, description="Path to character image, potentially from VTT data.")
    items: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Character items (weapons, armor, inventory) from VTT data.")
    system: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Full system object from VTT if needed for complex lookups.")

    pc_faction_standings: Dict[str, FactionStandingLevel] = Field(
        default_factory=dict,
        description="NPC's standing towards each PC. Key: PC ID (str), Value: Standing Level Enum."
    )

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "name": "Mattrim 'Threestrings' Mereg",
                "character_type": "NPC",
                "description": "A laid-back human bard from Waterdeep.",
                "race": "Human",
                "class": "Bard",
                "personality_traits": ["Eternally chill", "Has the munchies"],
                "vtt_data": {"attributes": {"hp": {"value": 10, "max": 10}}},
                "vtt_flags": {"ddbimporter": {"overrideAC": {"flat": 15}}},
                "associated_history_files": ["Threestrings.txt"],
                "linked_lore_ids": ["lore_id_yawning_portal", "lore_id_waterdeep_rumors"],
                "pc_faction_standings": {"pc_id_1": "Amiable", "pc_id_2": "Indifferent"}
            }
        }

class WorldItem(BaseModel): # Kept for potential future direct use, not the primary new lore system
    item_id: str = Field(..., description="Unique ID for the world item, can be auto-generated or user-defined.")
    name: str
    type: str
    description: str
    details: Dict[str, Any] = Field(default_factory=dict)
    linked_npc_ids: List[str] = Field(default_factory=list)

class DialogueRequest(BaseModel):
    scene_context: str
    player_utterance: Optional[str] = None
    active_pcs: List[str] = Field(default_factory=list, description="Names of player characters present in the scene.")
    speaking_pc_id: Optional[str] = Field(default=None, description="The ID of the PC who is speaking or initiating.")
    recent_dialogue_history: List[str] = Field(default_factory=list, description="Last few lines of conversation.")

class DialogueResponse(BaseModel):
    npc_id: str
    npc_dialogue: str
    new_memory_suggestions: List[str] = Field(default_factory=list)
    generated_topics: List[str] = Field(default_factory=list)
    suggested_npc_actions: List[str] = Field(default_factory=list)
    suggested_player_checks: List[str] = Field(default_factory=list)
    suggested_standing_pc_id: Optional[str] = None
    suggested_new_standing: Optional[FactionStandingLevel] = None
    standing_change_justification: Optional[str] = None


class NPCProfileWithHistoryAndLore(NPCProfile):
    history_contents_loaded: Optional[Dict[str, str]] = Field(default=None, description="Loaded content of associated history files. Key: filename, Value: content.")
    combined_history_content: Optional[str] = Field(default=None, description="Concatenated content of all associated history files.")
    # To hold resolved lore entries if needed directly, or just use linked_lore_ids and fetch separately
    # resolved_lore_entries: Optional[List[LoreEntry]] = Field(default=None)
# server/models.py
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
from enum import Enum
from bson import ObjectId

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
    lore_id: str = Field(default_factory=lambda: str(ObjectId()), description="Unique ID for the lore entry (MongoDB ObjectId as string).")
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
    background_story: Optional[str] = None
    motivations: List[str] = Field(default_factory=list)
    knowledge: List[str] = Field(default_factory=list, description="Specific pieces of knowledge the character has (less structured than lore).")
    memories: List[MemoryItem] = Field(default_factory=list, description="Character's persistent memories.")

    gm_notes: Optional[str] = Field(default=None, description="Private GM notes for this character.")

    # vtt_data stores the 'system' object from FVTT
    vtt_data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Data imported from VTT character sheets (usually the 'system' object).")
    vtt_flags: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Top-level 'flags' object imported from VTT character sheets.")
    img: Optional[str] = Field(default=None, description="Path to character image, potentially from VTT data.")
    items: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Character items (weapons, armor, inventory) from VTT data.")
    # system stores the entire FVTT JSON object if needed for deeper parsing later
    system: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Full system object from VTT if needed for complex lookups.")


    associated_history_files: List[str] = Field(default_factory=list, description="List of filenames of associated detailed history .txt files.")
    linked_lore_ids: List[str] = Field(default_factory=list, description="IDs of structured lore entries relevant to this character.")

    pc_faction_standings: Dict[str, FactionStandingLevel] = Field(
        default_factory=dict,
        description="NPC's standing towards each PC. Key: PC ID (str), Value: Standing Level Enum."
    )
    
    @field_validator('vtt_data', 'vtt_flags', 'system', 'pc_faction_standings', mode='before')
    def ensure_dict(cls, value):
        if value is None:
            return {}
        return value

    @field_validator('items', 'ideals', 'bonds', 'flaws', 'relationships', 'personality_traits', 'motivations', 'knowledge', 'memories', 'associated_history_files', 'linked_lore_ids', mode='before')
    def ensure_list(cls, value):
        if value is None:
            return []
        return value


    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "name": "Mattrim 'Threestrings' Mereg",
                "character_type": "NPC",
                "description": "A laid-back human bard from Waterdeep.",
                "linked_lore_ids": ["507f1f77bcf86cd799439011", "507f191e810c19729de860ea"],
            }
        }

class WorldItem(BaseModel):
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

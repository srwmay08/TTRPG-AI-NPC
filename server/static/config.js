// static/config.js
// Responsibility: Store global constants and configurations.

const API_BASE_URL = ''; // Adjust if your API is hosted elsewhere
const DEBUG_DELEGATED_CARD_CLICK = false; // For debugging specific click events

const ABILITY_KEYS_ORDER = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const SKILL_NAME_MAP = {
    "acr": "Acrobatics (Dex)", "ani": "Animal Handling (Wis)", "arc": "Arcana (Int)", "ath": "Athletics (Str)",
    "dec": "Deception (Cha)", "his": "History (Int)", "ins": "Insight (Wis)", "itm": "Intimidation (Cha)",
    "inv": "Investigation (Int)", "med": "Medicine (Wis)", "nat": "Nature (Int)", "prc": "Perception (Wis)",
    "prf": "Performance (Cha)", "per": "Persuasion (Cha)", "rel": "Religion (Int)", "slt": "Sleight of Hand (Dex)",
    "ste": "Stealth (Dex)", "sur": "Survival (Wis)"
};
const PC_QUICK_VIEW_BASE_TITLE = "PC Quick View";

const FACTION_STANDING_LEVELS = Object.freeze({
    THREATENING: "Threatening",
    DUBIOUS: "Dubious",         
    APPREHENSIVE: "Apprehensive", 
    INDIFFERENT: "Indifferent",   
    AMIABLE: "Amiable",       
    KINDLY: "Kindly",         
    WARMLY: "Warmly",         
    ALLY: "Ally"            
});

const FACTION_STANDING_SLIDER_ORDER = [
    FACTION_STANDING_LEVELS.THREATENING, FACTION_STANDING_LEVELS.DUBIOUS, 
    FACTION_STANDING_LEVELS.APPREHENSIVE, FACTION_STANDING_LEVELS.INDIFFERENT,
    FACTION_STANDING_LEVELS.AMIABLE, FACTION_STANDING_LEVELS.KINDLY,
    FACTION_STANDING_LEVELS.WARMLY, FACTION_STANDING_LEVELS.ALLY
];

// New: Lore Entry Types (matches Python Enum)
const LORE_TYPES = [
    "Location",
    "Organization/Faction",
    "Historical Event",
    "Key Item/Artifact",
    "Concept/Deity",
    "Miscellaneous"
];
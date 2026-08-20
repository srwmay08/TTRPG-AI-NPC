/**
 * static/config.js
 * 
 * Responsibility: Store global constants, enumerations, and environment configurations.
 * Centralizing these values prevents magic strings/numbers throughout the codebase
 * and makes global tuning (like reordering skills or tweaking UI logic) much easier.
 */

const API_BASE_URL = ''; // Keep blank for relative routing to the local Flask app
const DEBUG_DELEGATED_CARD_CLICK = false; // Toggle for verbose UI console logs

// Canonical ordering of D&D 5e Ability Scores
const ABILITY_KEYS_ORDER = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

// Dictionary mapping shorthand VTT skill keys to their full names and associated abilities
const SKILL_NAME_MAP = {
    "acr": "Acrobatics (Dex)", "ani": "Animal Handling (Wis)", "arc": "Arcana (Int)", "ath": "Athletics (Str)",
    "dec": "Deception (Cha)", "his": "History (Int)", "ins": "Insight (Wis)", "itm": "Intimidation (Cha)",
    "inv": "Investigation (Int)", "med": "Medicine (Wis)", "nat": "Nature (Int)", "prc": "Perception (Wis)",
    "prf": "Performance (Cha)", "per": "Persuasion (Cha)", "rel": "Religion (Int)", "slt": "Sleight of Hand (Dex)",
    "ste": "Stealth (Dex)", "sur": "Survival (Wis)"
};

const PC_QUICK_VIEW_BASE_TITLE = "PC Quick View";

// Enumeration for NPC Faction Disposition logic (maps directly to Python enum)
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

// Linear ordering array utilized to power the faction standing UI slider
const FACTION_STANDING_SLIDER_ORDER = [
    FACTION_STANDING_LEVELS.THREATENING, FACTION_STANDING_LEVELS.DUBIOUS,
    FACTION_STANDING_LEVELS.APPREHENSIVE, FACTION_STANDING_LEVELS.INDIFFERENT,
    FACTION_STANDING_LEVELS.AMIABLE, FACTION_STANDING_LEVELS.KINDLY,
    FACTION_STANDING_LEVELS.WARMLY, FACTION_STANDING_LEVELS.ALLY
];

// Enumeration for available Worldbuilding categories
const LORE_TYPES = [
    "Location",
    "Organization/Faction",
    "Historical Event",
    "Key Item/Artifact",
    "Concept/Deity",
    "Miscellaneous"
];
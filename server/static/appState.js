/**
 * static/appState.js
 * 
 * Responsibility: Acts as the central state management store for the frontend.
 * Holds the single source of truth for loaded characters, active UI selections,
 * expansion states, and live conversation histories. Provides getter/setter methods
 * to ensure state mutations are predictable and tightly controlled.
 */

const appState = {
    // Sets used to track which characters are currently active in the Scene View
    activeSceneNpcIds: new Set(),
    activePcIds: new Set(),
    
    // Arrays storing the full JSON datasets retrieved from the backend
    allCharacters: [],
    allLoreEntries: [],
    
    // Dictionary mapping NPC IDs to an array of recent conversation lines
    dialogueHistories: {},
    
    // Profile rendering tracking variables
    currentProfileCharId: null,
    lastAiResultForProfiledChar: null,
    currentLoreEntryId: null,
    
    // Dashboard tracking variables
    currentlyExpandedAbility: null,
    currentlyExpandedSkill: null,
    skillSortKey: null,
    currentSceneContextFilter: null,
    
    // Variables for D&D Combat/DPR calculations
    targetAC: 13,
    selectedAttacks: {},
    estimatedRounds: 3,
    
    // Stores predefined text specific to the currently viewed NPC
    cannedResponsesForProfiledChar: {},
    currentCannedResponseIndex: 0,

    /** Bulk populates the character store, passing each through the normalization process. */
    setAllCharacters(characters) {
        // --- SAFE GUARD FIX ---
        // Handles both raw arrays and standard backend response wrappers (e.g. {success: true, data: [...]})
        const rawArray = Array.isArray(characters) ? characters : (characters && Array.isArray(characters.data) ? characters.data : []);
        this.allCharacters = rawArray.map(char => this.processCharacterData(char));
    },

    /** Returns the full array of character documents. */
    getAllCharacters() {
        return this.allCharacters;
    },

    /** Helper to safely locate a character by ID, handling type coercion for MongoDB ObjectIds. */
    getCharacterById(id) {
        if (!id) return null;
        return this.allCharacters.find(char => String(char._id) === String(id));
    },

    /** Updates a specific character in the array, or pushes it if it's new. */
    updateCharacterInList(updatedChar) {
        // Flatten BSON dict structure if necessary
        if (updatedChar._id && typeof updatedChar._id === 'object' && updatedChar._id.$oid) {
            updatedChar._id = updatedChar._id.$oid;
        }
        const index = this.allCharacters.findIndex(c => String(c._id) === String(updatedChar._id));
        const processedChar = this.processCharacterData(updatedChar);
        if (index > -1) {
            this.allCharacters[index] = processedChar;
        } else {
            this.allCharacters.push(processedChar);
        }
        return processedChar;
    },

    /**
     * Critical normalization function. Modifies the raw JSON from the server to guarantee
     * that deeply nested objects (like VTT stats) exist, preventing undefined errors
     * when the UI attempts to render them.
     */
    processCharacterData(char) {
        if (char._id && typeof char._id === 'object' && char._id.$oid) {
            char._id = char._id.$oid;
        }
        
        // --- NORMALIZATION FIX ---
        // Forces backend identifiers to match the 'PC' string expected by the frontend renderers
        if (char.character_type === 'Player Character' || char.type === 'character') {
            char.character_type = 'PC';
        }

        // Deep object initialization: Guarantees path existence for VTT stat access
        char.vtt_data = char.vtt_data || {};
        char.vtt_data.abilities = char.vtt_data.abilities || {};
        char.vtt_data.attributes = char.vtt_data.attributes || {};
        char.vtt_data.attributes.hp = char.vtt_data.attributes.hp || {};
        char.vtt_data.attributes.ac = char.vtt_data.attributes.ac || {};
        char.vtt_data.attributes.movement = char.vtt_data.attributes.movement || {};
        char.vtt_data.attributes.init = char.vtt_data.attributes.init || {};
        char.vtt_data.attributes.spell = char.vtt_data.attributes.spell || {};
        char.vtt_data.details = char.vtt_data.details || {};
        char.vtt_data.skills = char.vtt_data.skills || {};
        char.vtt_data.traits = char.vtt_data.traits || {};
        char.vtt_data.traits.languages = char.vtt_data.traits.languages || {};
        char.vtt_data.traits.armorProf = char.vtt_data.traits.armorProf || {};
        char.vtt_data.traits.weaponProf = char.vtt_data.traits.weaponProf || {};

        char.vtt_flags = char.vtt_flags || {};
        char.items = char.items || [];
        char.system = char.system || {}; 
        char.memories = char.memories || [];
        char.associated_history_files = char.associated_history_files || [];
        char.linked_lore_ids = char.linked_lore_ids || [];
        char.personality_traits = char.personality_traits || [];
        char.ideals = char.ideals || [];
        char.bonds = char.bonds || [];
        char.flaws = char.flaws || [];
        char.motivations = char.motivations || [];
        char.pc_faction_standings = char.pc_faction_standings || {};
        char.canned_conversations = char.canned_conversations || {};

        // Calculate and cache the proficiency bonus for PCs based on their level data
        if (char.character_type === 'PC') {
            const pcLevel = char.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels ||
                            char.system?.details?.level || 
                            char.vtt_data?.details?.level || 
                            1;
            if (typeof DNDCalculations !== 'undefined' && DNDCalculations.getProficiencyBonus) {
                char.calculatedProfBonus = DNDCalculations.getProficiencyBonus(pcLevel);
            } else {
                char.calculatedProfBonus = 2; 
            }
        }
        return char;
    },

    // --- DPR Selection State Management ---
    isAttackSelected(pcId, attackName) {
        return this.selectedAttacks[pcId] && this.selectedAttacks[pcId].has(attackName);
    },

    toggleAttackSelection(pcId, attackName) {
        if (!this.selectedAttacks[pcId]) {
            this.selectedAttacks[pcId] = new Set();
        }
        if (this.selectedAttacks[pcId].has(attackName)) {
            this.selectedAttacks[pcId].delete(attackName);
        } else {
            this.selectedAttacks[pcId].add(attackName);
        }
    },
    
    // --- Active Scene Membership Management ---
    addActiveNpc(id) { this.activeSceneNpcIds.add(String(id)); },
    removeActiveNpc(id) { this.activeSceneNpcIds.delete(String(id)); },
    hasActiveNpc(id) { return this.activeSceneNpcIds.has(String(id)); },
    getActiveNpcCount() { return this.activeSceneNpcIds.size; },
    getActiveNpcIds() { return Array.from(this.activeSceneNpcIds); },

    addActivePc(id) { this.activePcIds.add(String(id)); },
    removeActivePc(id) { this.activePcIds.delete(String(id)); },
    toggleActivePc(id) {
        const idStr = String(id);
        if (this.activePcIds.has(idStr)) this.activePcIds.delete(idStr);
        else this.activePcIds.add(idStr);
    },
    hasActivePc(id) { return this.activePcIds.has(String(id)); },
    getActivePcCount() { return this.activePcIds.size; },
    getActivePcIds() { return Array.from(this.activePcIds); },

    // --- Local Chat History Management ---
    initDialogueHistory(npcId) { this.dialogueHistories[String(npcId)] = []; },
    addDialogueToHistory(npcId, message) {
        const idStr = String(npcId);
        if (!this.dialogueHistories[idStr]) this.initDialogueHistory(idStr);
        this.dialogueHistories[idStr].push(message);
    },
    getDialogueHistory(npcId) { return this.dialogueHistories[String(npcId)] || []; },
    recent_context(npcId) { return (this.dialogueHistories[String(npcId)] || []).slice(-5); },
    deleteDialogueHistory(npcId) { delete this.dialogueHistories[String(npcId)]; },
    getRecentDialogueHistory(npcId, count = 5) {
        return (this.dialogueHistories[String(npcId)] || []).slice(-count);
    },

    // --- Profile/Dashboard Visibility Trackers ---
    setCurrentProfileCharId(id) { this.currentProfileCharId = id ? String(id) : null; },
    getCurrentProfileCharId() { return this.currentProfileCharId; },
    getCurrentProfileChar() { return this.getCharacterById(this.currentProfileCharId); },

    setExpandedAbility(abilityKey) { this.currentlyExpandedAbility = abilityKey; },
    getExpandedAbility() { return this.currentlyExpandedAbility; },
    setExpandedSkill(skillKey) { this.currentlyExpandedSkill = skillKey; },
    getExpandedSkill() { return this.currentlyExpandedSkill; },
    setSkillSortKey(key) { this.skillSortKey = key; },
    getSkillSortKey() { return this.skillSortKey; },
    
    setCannedResponsesForProfiledChar(responses) {
        this.cannedResponsesForProfiledChar = responses;
        this.currentCannedResponseIndex = 0;
    },
    clearCannedResponses() {
        this.cannedResponsesForProfiledChar = {};
        this.currentCannedResponseIndex = 0;
    },

    // --- Lore State Management ---
    setAllLoreEntries(loreEntries) {
        const rawArray = Array.isArray(loreEntries) ? loreEntries : (loreEntries && Array.isArray(loreEntries.data) ? loreEntries.data : []);
        this.allLoreEntries = rawArray.map(entry => {
            // Flatten BSON dict structures natively
            if (entry.lore_id && typeof entry.lore_id === 'object' && entry.lore_id.$oid) {
                entry.lore_id = entry.lore_id.$oid;
            } else if (entry._id && typeof entry._id === 'object' && entry._id.$oid) { 
                entry.lore_id = entry._id.$oid; 
            } else if (entry._id && typeof entry._id === 'string') {
                 entry.lore_id = entry._id; 
            }

            // Guarantee array structures exist to prevent iteration crashes
            entry.key_facts = entry.key_facts || [];
            entry.tags = entry.tags || [];
            entry.linked_character_ids = entry.linked_character_ids || [];
            entry.linked_lore_entry_ids = entry.linked_lore_entry_ids || [];
            return entry;
        });
    },
    getAllLoreEntries() { return this.allLoreEntries; },
    getLoreEntryById(id) {
        if (!id) return null;
        return this.allLoreEntries.find(entry => String(entry.lore_id) === String(id) || String(entry._id?.$oid) === String(id) || String(entry._id) === String(id));
    },
    updateLoreEntryInList(updatedEntry) {
        const idToMatch = String(updatedEntry.lore_id || updatedEntry._id?.$oid || updatedEntry._id);
        const index = this.allLoreEntries.findIndex(e => String(e.lore_id || e._id?.$oid || e._id) === idToMatch);
        if (index > -1) {
            this.allLoreEntries[index] = updatedEntry;
        } else {
            this.allLoreEntries.push(updatedEntry);
        }
    },
    removeLoreEntryFromList(loreId) {
        this.allLoreEntries = this.allLoreEntries.filter(entry => String(entry.lore_id || entry._id?.$oid || entry._id) !== String(loreId));
    },
    setCurrentLoreEntryId(id) { this.currentLoreEntryId = id ? String(id) : null; },
    getCurrentLoreEntryId() { return this.currentLoreEntryId; },
    getCurrentLoreEntry() { return this.getLoreEntryById(this.currentLoreEntryId); },

    // --- Scene Filtration Tracking ---
    setCurrentSceneContextFilter(filter) { this.currentSceneContextFilter = filter; },
    getCurrentSceneContextFilter() { return this.currentSceneContextFilter; }
};
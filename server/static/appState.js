// static/appState.js
// Responsibility: Manage the application's global state.

const appState = {
    activeSceneNpcIds: new Set(),
    activePcIds: new Set(),
    allCharacters: [],
    allLoreEntries: [],
    dialogueHistories: {},
    currentProfileCharId: null,
    currentLoreEntryId: null,
    currentlyExpandedAbility: null,
    currentlyExpandedSkill: null,
    skillSortKey: null,
    currentSceneContextFilter: null, // Added for scene context

    setAllCharacters(characters) {
        this.allCharacters = characters.map(char => this.processCharacterData(char));
    },

    getAllCharacters() {
        return this.allCharacters;
    },

    getCharacterById(id) {
        if (!id) return null;
        return this.allCharacters.find(char => String(char._id) === String(id));
    },

    updateCharacterInList(updatedChar) {
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

    processCharacterData(char) {
        if (char._id && typeof char._id === 'object' && char._id.$oid) {
            char._id = char._id.$oid;
        }
        // Ensure vtt_data and its nested structures are properly initialized
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
        char.system = char.system || {}; // This holds the full FVTT system object
        char.memories = char.memories || [];
        char.associated_history_files = char.associated_history_files || [];
        char.linked_lore_ids = char.linked_lore_ids || [];
        char.personality_traits = char.personality_traits || [];
        char.ideals = char.ideals || [];
        char.bonds = char.bonds || [];
        char.flaws = char.flaws || [];
        char.motivations = char.motivations || [];
        char.pc_faction_standings = char.pc_faction_standings || {};

        if (char.character_type === 'PC') {
            const pcLevel = char.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels ||
                            char.system?.details?.level || // From FVTT 'system'
                            char.vtt_data?.details?.level || // Fallback to 'vtt_data.details'
                            1;
            // Corrected call to DNDCalculations namespace
            if (typeof DNDCalculations !== 'undefined' && DNDCalculations.getProficiencyBonus) {
                char.calculatedProfBonus = DNDCalculations.getProficiencyBonus(pcLevel);
            } else {
                console.error("DNDCalculations.getProficiencyBonus is not available. Check script load order.");
                char.calculatedProfBonus = 2; // Fallback proficiency bonus
            }
        }
        return char;
    },

    // NPC/PC Scene Management
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

    // Dialogue History
    initDialogueHistory(npcId) { this.dialogueHistories[String(npcId)] = []; },
    addDialogueToHistory(npcId, message) {
        const idStr = String(npcId);
        if (!this.dialogueHistories[idStr]) this.initDialogueHistory(idStr);
        this.dialogueHistories[idStr].push(message);
    },
    getDialogueHistory(npcId) { return this.dialogueHistories[String(npcId)] || []; },
    deleteDialogueHistory(npcId) { delete this.dialogueHistories[String(npcId)]; },
    getRecentDialogueHistory(npcId, count = 5) {
        return (this.dialogueHistories[String(npcId)] || []).slice(-count);
    },

    // Character Profile
    setCurrentProfileCharId(id) { this.currentProfileCharId = id ? String(id) : null; },
    getCurrentProfileCharId() { return this.currentProfileCharId; },
    getCurrentProfileChar() { return this.getCharacterById(this.currentProfileCharId); },

    // PC Dashboard UI State
    setExpandedAbility(abilityKey) { this.currentlyExpandedAbility = abilityKey; },
    getExpandedAbility() { return this.currentlyExpandedAbility; },
    setExpandedSkill(skillKey) { this.currentlyExpandedSkill = skillKey; },
    getExpandedSkill() { return this.currentlyExpandedSkill; },
    setSkillSortKey(key) { this.skillSortKey = key; },
    getSkillSortKey() { return this.skillSortKey; },

    // Lore Management State
    setAllLoreEntries(loreEntries) {
        this.allLoreEntries = loreEntries.map(entry => {
            if (entry.lore_id && typeof entry.lore_id === 'object' && entry.lore_id.$oid) {
                entry.lore_id = entry.lore_id.$oid;
            } else if (entry._id && typeof entry._id === 'object' && entry._id.$oid) { // Handle if _id is present
                entry.lore_id = entry._id.$oid; // Use _id as lore_id if lore_id is missing
                // delete entry._id; // Optionally delete _id if lore_id is now the primary identifier
            } else if (entry._id && typeof entry._id === 'string') {
                 entry.lore_id = entry._id; // if _id is already a string
            }


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

    // Scene Context Filter
    setCurrentSceneContextFilter(filter) { this.currentSceneContextFilter = filter; },
    getCurrentSceneContextFilter() { return this.currentSceneContextFilter; }
};
// appState.js
// Responsibility: Manage the application's global state.

const appState = {
    activeSceneNpcIds: new Set(),
    activePcIds: new Set(),
    allCharacters: [], // Holds the processed character objects
    dialogueHistories: {}, // Key: npcId, Value: array of dialogue strings
    currentProfileCharId: null,
    currentlyExpandedAbility: null, // For PC Dashboard
    currentlyExpandedSkill: null,   // For PC Dashboard
    skillSortKey: null,             // For PC Dashboard

    // --- Character Data Management ---
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
        if (index > -1) {
            this.allCharacters[index] = this.processCharacterData(updatedChar);
        } else {
            this.allCharacters.push(this.processCharacterData(updatedChar));
        }
        return this.getCharacterById(updatedChar._id);
    },

    processCharacterData(char) { // Moved from original fetchCharacters
        if (char._id && typeof char._id === 'object' && char._id.$oid) {
            char._id = char._id.$oid;
        }
        char.vtt_data = char.vtt_data || { abilities: {}, attributes: { hp: {}, ac: {}, movement: {}, init: {}, spell: {} }, details: {}, skills: {}, traits: { languages: {}, armorProf: {}, weaponProf: {}} };
        char.vtt_flags = char.vtt_flags || {};
        char.items = char.items || [];
        char.system = char.system || {};
        char.memories = char.memories || [];
        char.associated_history_files = char.associated_history_files || [];
        char.personality_traits = char.personality_traits || [];
        char.ideals = char.ideals || [];
        char.bonds = char.bonds || [];
        char.flaws = char.flaws || [];
        char.motivations = char.motivations || [];
        char.pc_faction_standings = char.pc_faction_standings || {};

        if (char.character_type === 'PC') {
            const pcLevel = char.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || char.system?.details?.level || char.vtt_data?.details?.level || 1;
            char.calculatedProfBonus = getProficiencyBonus(pcLevel); // Assumes dndCalculations.js is loaded
        }
        return char;
    },

    // --- Active Scene NPCs ---
    addActiveNpc(id) { this.activeSceneNpcIds.add(id); },
    removeActiveNpc(id) { this.activeSceneNpcIds.delete(id); },
    hasActiveNpc(id) { return this.activeSceneNpcIds.has(id); },
    getActiveNpcCount() { return this.activeSceneNpcIds.size; },
    getActiveNpcIds() { return Array.from(this.activeSceneNpcIds); },


    // --- Active PCs ---
    addActivePc(id) { this.activePcIds.add(id); },
    removeActivePc(id) { this.activePcIds.delete(id); },
    toggleActivePc(id) {
        if (this.activePcIds.has(id)) {
            this.activePcIds.delete(id);
        } else {
            this.activePcIds.add(id);
        }
    },
    hasActivePc(id) { return this.activePcIds.has(id); },
    getActivePcCount() { return this.activePcIds.size; },
    getActivePcIds() { return Array.from(this.activePcIds); },

    // --- Dialogue Histories ---
    initDialogueHistory(npcId) { this.dialogueHistories[npcId] = []; },
    addDialogueToHistory(npcId, message) {
        if (!this.dialogueHistories[npcId]) this.initDialogueHistory(npcId);
        this.dialogueHistories[npcId].push(message);
    },
    getDialogueHistory(npcId) { return this.dialogueHistories[npcId] || []; },
    deleteDialogueHistory(npcId) { delete this.dialogueHistories[npcId]; },
    getRecentDialogueHistory(npcId, count = 5) {
        return (this.dialogueHistories[npcId] || []).slice(-count);
    },


    // --- Current Profile ---
    setCurrentProfileCharId(id) { this.currentProfileCharId = id; },
    getCurrentProfileCharId() { return this.currentProfileCharId; },
    getCurrentProfileChar() { return this.getCharacterById(this.currentProfileCharId); },


    // --- PC Dashboard UI State ---
    setExpandedAbility(abilityKey) { this.currentlyExpandedAbility = abilityKey; },
    getExpandedAbility() { return this.currentlyExpandedAbility; },
    setExpandedSkill(skillKey) { this.currentlyExpandedSkill = skillKey; },
    getExpandedSkill() { return this.currentlyExpandedSkill; },
    setSkillSortKey(key) { this.skillSortKey = key; },
    getSkillSortKey() { return this.skillSortKey; }
};

// If using ES6 modules:
// export { appState };
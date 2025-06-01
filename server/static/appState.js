// static/appState.js
// Responsibility: Manage the application's global state.

const appState = {
    activeSceneNpcIds: new Set(),
    activePcIds: new Set(),
    allCharacters: [],
    dialogueHistories: {},
    currentProfileCharId: null,
    currentlyExpandedAbility: null,
    currentlyExpandedSkill: null,
    skillSortKey: null,

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
        const processedChar = this.processCharacterData(updatedChar); // Process before storing
        if (index > -1) {
            this.allCharacters[index] = processedChar;
        } else {
            this.allCharacters.push(processedChar);
        }
        return processedChar; // Return the processed character
    },

    processCharacterData(char) {
        if (char._id && typeof char._id === 'object' && char._id.$oid) {
            char._id = char._id.$oid;
        }
        // Ensure all default structures for character object
        char.vtt_data = char.vtt_data || { abilities: {}, attributes: { hp: {}, ac: {}, movement: {}, init: {}, spell: {} }, details: {}, skills: {}, traits: { languages: {}, armorProf: {}, weaponProf: {}} };
        char.vtt_data.abilities = char.vtt_data.abilities || {};
        char.vtt_data.attributes = char.vtt_data.attributes || { hp: {}, ac: {}, movement: {}, init: {}, spell: {} };
        char.vtt_data.attributes.hp = char.vtt_data.attributes.hp || {};
        char.vtt_data.attributes.ac = char.vtt_data.attributes.ac || {};
        char.vtt_data.attributes.movement = char.vtt_data.attributes.movement || {};
        char.vtt_data.attributes.init = char.vtt_data.attributes.init || {};
        char.vtt_data.attributes.spell = char.vtt_data.attributes.spell || {};
        char.vtt_data.details = char.vtt_data.details || {};
        char.vtt_data.skills = char.vtt_data.skills || {};
        char.vtt_data.traits = char.vtt_data.traits || { languages: {}, armorProf: {}, weaponProf: {}};

        char.vtt_flags = char.vtt_flags || {};
        char.items = char.items || [];
        char.system = char.system || {}; // Ensure system object exists
        char.memories = char.memories || [];
        char.associated_history_files = char.associated_history_files || [];
        char.personality_traits = char.personality_traits || [];
        char.ideals = char.ideals || [];
        char.bonds = char.bonds || [];
        char.flaws = char.flaws || [];
        char.motivations = char.motivations || [];
        char.pc_faction_standings = char.pc_faction_standings || {}; // Ensure this exists

        if (char.character_type === 'PC') {
            const pcLevel = char.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || char.system?.details?.level || char.vtt_data?.details?.level || 1;
            char.calculatedProfBonus = window.getProficiencyBonus(pcLevel); // Use window.
        }
        return char;
    },

    addActiveNpc(id) { this.activeSceneNpcIds.add(String(id)); },
    removeActiveNpc(id) { this.activeSceneNpcIds.delete(String(id)); },
    hasActiveNpc(id) { return this.activeSceneNpcIds.has(String(id)); },
    getActiveNpcCount() { return this.activeSceneNpcIds.size; },
    getActiveNpcIds() { return Array.from(this.activeSceneNpcIds); },

    addActivePc(id) { this.activePcIds.add(String(id)); },
    removeActivePc(id) { this.activePcIds.delete(String(id)); },
    toggleActivePc(id) {
        const idStr = String(id);
        if (this.activePcIds.has(idStr)) {
            this.activePcIds.delete(idStr);
        } else {
            this.activePcIds.add(idStr);
        }
    },
    hasActivePc(id) { return this.activePcIds.has(String(id)); },
    getActivePcCount() { return this.activePcIds.size; },
    getActivePcIds() { return Array.from(this.activePcIds); },

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

    setCurrentProfileCharId(id) { this.currentProfileCharId = id ? String(id) : null; },
    getCurrentProfileCharId() { return this.currentProfileCharId; },
    getCurrentProfileChar() { return this.getCharacterById(this.currentProfileCharId); },

    setExpandedAbility(abilityKey) { this.currentlyExpandedAbility = abilityKey; },
    getExpandedAbility() { return this.currentlyExpandedAbility; },
    setExpandedSkill(skillKey) { this.currentlyExpandedSkill = skillKey; },
    getExpandedSkill() { return this.currentlyExpandedSkill; },
    setSkillSortKey(key) { this.skillSortKey = key; },
    getSkillSortKey() { return this.skillSortKey; }
};
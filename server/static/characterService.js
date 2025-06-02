// static/characterService.js
// Responsibility: Logic related to fetching, processing, and managing character data.

var CharacterService = {
    profileElementIds: { // This remains an object, not functions
        detailsCharName: 'details-char-name',
        profileCharType: 'profile-char-type',
        profileDescription: 'profile-description',
        profilePersonality: 'profile-personality',
        gmNotesTextarea: 'gm-notes',
        saveGmNotesBtn: 'save-gm-notes-btn',
        npcMemoriesSection: 'npc-memories-collapsible-section',
        characterMemoriesList: 'character-memories-list',
        addMemoryBtn: 'add-memory-btn',
        npcFactionStandingsSection: 'npc-faction-standings-section',
        npcFactionStandingsContent: 'npc-faction-standings-content',
        characterHistorySection: 'character-history-collapsible-section',
        associatedHistoryList: 'associated-history-list',
        historyContentDisplay: 'history-content-display',
        associateHistoryBtn: 'associate-history-btn',
        characterLoreLinksSection: 'character-lore-links-section',
        loreEntrySelectForCharacter: 'lore-entry-select-for-character',
        linkLoreToCharBtn: 'link-lore-to-char-btn',
        associatedLoreListForCharacter: 'associated-lore-list-for-character',

        // Callbacks will refer to functions that App.js makes global
        deleteMemoryCallback: () => handleDeleteMemory, 
        factionChangeCallback: () => handleSaveFactionStanding,
        dissociateHistoryCallback: () => handleDissociateHistoryFile,
        unlinkLoreFromCharacterCallback: () => handleUnlinkLoreFromCharacter
    },

    initializeAppCharacters: async function() {
        console.log("CharacterService: Fetching characters...");
        try {
            const charactersFromServer = await ApiService.fetchCharactersFromServer();
            appState.setAllCharacters(charactersFromServer); // appState is global
            console.log("CharacterService: Characters fetched and processed:", appState.getAllCharacters().length);

            UIRenderers.renderPcListUI(Utils.getElem('active-pc-list'), Utils.getElem('speaking-pc-select'), appState.getAllCharacters(), appState.activePcIds, App.handleTogglePcSelection);

            UIRenderers.renderNpcListForContextUI(
                Utils.getElem('character-list-scene-tab'),
                appState.getAllCharacters(),
                appState.activeSceneNpcIds,
                App.handleToggleNpcInScene, 
                this.handleSelectCharacterForDetails, // Internal call
                null
            );
            UIRenderers.renderAllNpcListForManagementUI(
                Utils.getElem('all-character-list-management'),
                appState.getAllCharacters(),
                this.handleSelectCharacterForDetails // Internal call
            );

            await this.fetchAllLoreEntriesAndUpdateState(); // Internal call
            UIRenderers.populateLoreTypeDropdownUI();

            setTimeout(App.updateMainView, 0);
        } catch (error) {
            console.error('CharacterService: Error in initializeAppCharacters:', error);
            const sceneTabElem = Utils.getElem('character-list-scene-tab');
            if (sceneTabElem) sceneTabElem.innerHTML = '<ul><li><em>Error loading NPCs for scene.</em></li></ul>';
            const allNpcElem = Utils.getElem('all-character-list-management');
            if (allNpcElem) allNpcElem.innerHTML = '<ul><li><em>Error loading all NPCs.</em></li></ul>';
            const activePcElem = Utils.getElem('active-pc-list');
            if (activePcElem) activePcElem.innerHTML = '<p><em>Error loading PCs.</em></p>';
        }
    },

    handleSelectCharacterForDetails: async function(charIdStr) {
        const characterProfileSection = Utils.getElem('character-profile-main-section');
        if (!charIdStr || charIdStr === "null") {
            appState.setCurrentProfileCharId(null);
            UIRenderers.renderCharacterProfileUI(null, this.profileElementIds);
            if (characterProfileSection) characterProfileSection.classList.add('collapsed');
            return;
        }
        appState.setCurrentProfileCharId(charIdStr);
        try {
            const selectedCharFromServer = await ApiService.fetchNpcDetails(charIdStr);
            const processedChar = appState.updateCharacterInList(selectedCharFromServer);

            UIRenderers.renderCharacterProfileUI(processedChar, this.profileElementIds);
            if (characterProfileSection) characterProfileSection.classList.remove('collapsed');

            await this.fetchAndRenderHistoryFiles();
        } catch (error) {
            console.error("CharacterService: Error in handleSelectCharacterForDetails:", error);
            Utils.updateText('details-char-name', 'Error loading details');
            UIRenderers.renderCharacterProfileUI(null, this.profileElementIds);
            if (characterProfileSection) characterProfileSection.classList.add('collapsed');
        }
    },

    handleCharacterCreation: async function() {
        const name = Utils.getElem('new-char-name').value.trim();
        const description = Utils.getElem('new-char-description').value.trim();
        const personality = Utils.getElem('new-char-personality').value.split(',').map(s => s.trim()).filter(s => s);
        const type = Utils.getElem('new-char-type').value;

        if (!name || !description) {
            alert("Name and Description are required.");
            return;
        }
        const newCharData = { name, description, personality_traits: personality, character_type: type, linked_lore_ids: [] };
        try {
            const result = await ApiService.createCharacterOnServer(newCharData);
            appState.updateCharacterInList(result.character);
            // Re-render relevant UI parts
            UIRenderers.renderNpcListForContextUI(Utils.getElem('character-list-scene-tab'), appState.getAllCharacters(), appState.activeSceneNpcIds, App.handleToggleNpcInScene, this.handleSelectCharacterForDetails, appState.currentSceneContextFilter);
            UIRenderers.renderAllNpcListForManagementUI(Utils.getElem('all-character-list-management'), appState.getAllCharacters(), this.handleSelectCharacterForDetails);
            UIRenderers.renderPcListUI(Utils.getElem('active-pc-list'), Utils.getElem('speaking-pc-select'), appState.getAllCharacters(), appState.activePcIds, App.handleTogglePcSelection);

            Utils.getElem('new-char-name').value = '';
            Utils.getElem('new-char-description').value = '';
            Utils.getElem('new-char-personality').value = '';
            alert("Character created successfully!");
        } catch (error) {
            console.error("CharacterService: Error creating character:", error);
            alert(`Error creating character: ${error.message}`);
        }
    },

    fetchAndRenderHistoryFiles: async function() {
        const selectElement = Utils.getElem('history-file-select');
        if (!selectElement) return;
        const currentValue = selectElement.value;
        selectElement.innerHTML = '<option value="">-- Select a history file --</option>';
        try {
            const files = await ApiService.fetchHistoryFilesFromServer();
            files.forEach(file => {
                const option = document.createElement('option');
                option.value = file;
                option.textContent = file;
                selectElement.appendChild(option);
            });
            if (files.includes(currentValue)) selectElement.value = currentValue;
        } catch (error) {
            console.error("CharacterService: Error fetching/rendering history files:", error);
            selectElement.innerHTML += `<option value="" disabled>Error loading history files.</option>`;
        }
    },

    handleAssociateHistoryFile: async function() {
        const charId = appState.getCurrentProfileCharId();
        if (!charId) { alert("Please select a character first."); return; }
        const selectedFileElement = Utils.getElem('history-file-select');
        if (!selectedFileElement) { console.error("History file select element not found"); return; }
        const selectedFile = selectedFileElement.value;
        if (!selectedFile) { alert("Please select a history file to add."); return; }
        try {
            const result = await ApiService.associateHistoryFileWithNpc(charId, selectedFile);
            if (result && result.character) {
                const updatedChar = appState.updateCharacterInList(result.character);
                UIRenderers.renderCharacterProfileUI(updatedChar, this.profileElementIds);
                alert(result.message || "History file associated successfully.");
            } else { alert("Failed to associate history file: No character data returned from server."); }
        } catch (error) { console.error("CharacterService: Error associating history file:", error); alert(`Error: ${error.message}`); }
    },

    handleDissociateHistoryFile: async function(filename) {
        const charId = appState.getCurrentProfileCharId();
        if (!charId) { alert("No character selected."); return; }
        if (!confirm(`Remove "${filename}" from this character's history?`)) return;
        try {
            const result = await ApiService.dissociateHistoryFileFromNpc(charId, filename);
            if (result && result.character) {
                const updatedChar = appState.updateCharacterInList(result.character);
                UIRenderers.renderCharacterProfileUI(updatedChar, this.profileElementIds);
                alert(result.message || "History file dissociated successfully.");
            } else { alert("Failed to dissociate: No character data returned."); }
        } catch (error) { console.error("CharacterService: Error dissociating history file:", error); alert(`Error: ${error.message}`); }
    },

    handleSaveFactionStanding: async function(npcId, pcId, newStandingValue) {
        if (!npcId || !pcId || !newStandingValue) { console.error("Missing IDs/standing for faction update"); return; }
        try {
            const payload = { pc_faction_standings: { ...(appState.getCharacterById(npcId)?.pc_faction_standings || {}), [pcId]: newStandingValue } };
            const response = await ApiService.updateCharacterOnServer(npcId, payload);
            if (response && response.character) {
                const updatedCharState = appState.updateCharacterInList(response.character);
                const currentProfileChar = appState.getCurrentProfileChar();
                if (currentProfileChar && String(currentProfileChar._id) === String(npcId)) {
                     UIRenderers.renderNpcFactionStandingsUI(updatedCharState, appState.activePcIds, appState.getAllCharacters(), Utils.getElem('npc-faction-standings-content'), App.handleSaveFactionStanding); // App.handleSaveFactionStanding will be global
                }
            } else { console.error("Failed to update faction standing: No character data"); alert("Failed to update faction standing."); }
        } catch (error) { console.error("CharacterService: Error saving faction standing:", error); alert(`Error: ${error.message}`); }
    },

    fetchAllLoreEntriesAndUpdateState: async function() {
        try {
            const loreEntries = await ApiService.fetchAllLoreEntries();
            appState.setAllLoreEntries(loreEntries);
            UIRenderers.renderLoreEntryListUI(appState.getAllLoreEntries());
            UIRenderers.populateLoreEntrySelectForCharacterLinkingUI();
            UIRenderers.populateSceneContextSelectorUI();
            UIRenderers.populateSceneContextTypeFilterUI();
        } catch (error) { console.error("CharacterService: Error fetching all lore entries:", error); }
    },

    handleCreateLoreEntry: async function() {
        const name = Utils.getElem('new-lore-name').value.trim();
        const lore_type = Utils.getElem('new-lore-type').value;
        const description = Utils.getElem('new-lore-description').value.trim();
        const key_facts = Utils.getElem('new-lore-key-facts').value.split('\n').map(s => s.trim()).filter(s => s);
        const tags = Utils.getElem('new-lore-tags').value.split(',').map(s => s.trim()).filter(s => s);
        const gm_notes = Utils.getElem('new-lore-gm-notes').value.trim();

        if (!name || !description || !lore_type) {
            alert("Name, Type, and Description are required for a lore entry.");
            return;
        }
        const loreData = { name, lore_type, description, key_facts, tags, gm_notes };
        try {
            const result = await ApiService.createLoreEntryOnServer(loreData);
            appState.updateLoreEntryInList(result.lore_entry);
            UIRenderers.renderLoreEntryListUI(appState.getAllLoreEntries());
            UIRenderers.populateLoreEntrySelectForCharacterLinkingUI();
            UIRenderers.populateSceneContextSelectorUI();

            Utils.getElem('new-lore-name').value = '';
            Utils.getElem('new-lore-type').value = LORE_TYPES[0]; // LORE_TYPES is global
            Utils.getElem('new-lore-description').value = '';
            Utils.getElem('new-lore-key-facts').value = '';
            Utils.getElem('new-lore-tags').value = '';
            Utils.getElem('new-lore-gm-notes').value = '';
            alert("Lore entry created successfully!");
        } catch (error) {
            console.error("CharacterService: Error creating lore entry:", error);
            alert(`Error creating lore entry: ${error.message}`);
        }
    },

    handleSelectLoreEntryForDetails: async function(loreIdStr) {
        if (!loreIdStr) {
            UIRenderers.closeLoreDetailViewUI();
            return;
        }
        appState.setCurrentLoreEntryId(loreIdStr);
        try {
            const loreEntry = await ApiService.fetchLoreEntryDetails(loreIdStr);
            UIRenderers.renderLoreEntryDetailUI(loreEntry);
        } catch (error) {
            console.error("CharacterService: Error fetching lore entry details:", error);
            UIRenderers.closeLoreDetailViewUI();
        }
    },

    handleUpdateLoreEntryGmNotes: async function() {
        const loreId = appState.getCurrentLoreEntryId();
        if (!loreId) return;
        const gm_notes = Utils.getElem('details-lore-gm-notes').value;
        try {
            const result = await ApiService.updateLoreEntryOnServer(loreId, { gm_notes });
            appState.updateLoreEntryInList(result.lore_entry);
            alert("Lore GM Notes saved!");
        } catch (error) {
            console.error("CharacterService: Error saving lore GM notes:", error);
            alert(`Error saving lore notes: ${error.message}`);
        }
    },

    handleDeleteLoreEntry: async function() {
        const loreId = appState.getCurrentLoreEntryId();
        if (!loreId) return;
        if (!confirm("Are you sure you want to delete this lore entry? This will also unlink it from all characters.")) return;
        try {
            await ApiService.deleteLoreEntryFromServer(loreId);
            appState.removeLoreEntryFromList(loreId);
            UIRenderers.renderLoreEntryListUI(appState.getAllLoreEntries());
            UIRenderers.populateLoreEntrySelectForCharacterLinkingUI();
            UIRenderers.populateSceneContextSelectorUI();
            UIRenderers.closeLoreDetailViewUI();

            const currentProfileCharId = appState.getCurrentProfileCharId();
            if(currentProfileCharId){
                 const charData = appState.getCharacterById(currentProfileCharId);
                 if (charData && charData.linked_lore_ids) {
                    charData.linked_lore_ids = charData.linked_lore_ids.filter(id => id !== loreId);
                    appState.updateCharacterInList(charData);
                    UIRenderers.renderCharacterProfileUI(charData, this.profileElementIds);
                 }
            }
            alert("Lore entry deleted.");
        } catch (error) {
            console.error("CharacterService: Error deleting lore entry:", error);
            alert(`Error deleting lore entry: ${error.message}`);
        }
    },

    handleLinkLoreToCharacter: async function() {
        const charId = appState.getCurrentProfileCharId();
        const loreSelect = Utils.getElem('lore-entry-select-for-character');
        if (!charId || !loreSelect) {
            alert("Please select a character and a lore entry.");
            return;
        }
        const loreId = loreSelect.value;
        if (!loreId) {
            alert("Please select a lore entry to link.");
            return;
        }
        try {
            const result = await ApiService.linkLoreToCharacterOnServer(charId, loreId);
            const updatedChar = appState.updateCharacterInList(result.character);
            UIRenderers.renderCharacterProfileUI(updatedChar, this.profileElementIds);
            alert("Lore linked to character.");
        } catch (error) {
            console.error("CharacterService: Error linking lore to character:", error);
            alert(`Error linking lore: ${error.message}`);
        }
    },

    handleUnlinkLoreFromCharacter: async function(loreIdToUnlink) {
        const charId = appState.getCurrentProfileCharId();
        if (!charId || !loreIdToUnlink) return;
        const character = appState.getCharacterById(charId);
        if (!character) return;
        if (!confirm(`Unlink this lore entry from ${character.name}?`)) return;
        try {
            const result = await ApiService.unlinkLoreFromCharacterOnServer(charId, loreIdToUnlink);
            const updatedChar = appState.updateCharacterInList(result.character);
            UIRenderers.renderCharacterProfileUI(updatedChar, this.profileElementIds);
            alert("Lore unlinked from character.");
        } catch (error) {
            console.error("CharacterService: Error unlinking lore:", error);
            alert(`Error unlinking lore: ${error.message}`);
        }
    },

    handleSaveGmNotes: async function() {
        const charId = appState.getCurrentProfileCharId();
        if (!charId) return;
        const notes = Utils.getElem('gm-notes').value;
        try {
            const updatePayload = { gm_notes: notes };
            const response = await ApiService.updateCharacterOnServer(charId, updatePayload);
            if (response && response.character) {
                appState.updateCharacterInList(response.character);
                alert('GM Notes saved!');
            } else {
                alert('Error: Could not save GM notes. No character data returned.');
            }
        } catch (error) {
            console.error("CharacterService: Error saving GM notes:", error);
            alert(`Error saving notes: ${error.message}`);
        }
    },

    handleAddMemory: async function() {
        const charId = appState.getCurrentProfileCharId();
        const character = appState.getCharacterById(charId);
        if (!charId || !character || character.character_type !== 'NPC') {
            alert("Please select an NPC to add memories to.");
            return;
        }
        const content = Utils.getElem('new-memory-content').value.trim();
        const type = Utils.getElem('new-memory-type').value.trim() || 'fact';
        if (!content) {
            alert("Memory content cannot be empty.");
            return;
        }
        try {
            const memoryData = { content, type, source: "manual GM entry" };
            const response = await ApiService.addMemoryToNpc(charId, memoryData);
            const charToUpdate = appState.getCharacterById(charId);
            if (charToUpdate && response.updated_memories) {
                charToUpdate.memories = response.updated_memories;
                appState.updateCharacterInList(charToUpdate);
                // App.handleDeleteMemory will be global
                UIRenderers.renderMemoriesUI(charToUpdate.memories, Utils.getElem('character-memories-list'), handleDeleteMemory); 
            }
            Utils.getElem('new-memory-content').value = '';
            Utils.getElem('new-memory-type').value = '';
        } catch (error) {
            console.error("CharacterService: Error adding memory:", error);
            alert("Error adding memory: " + error.message);
        }
    },

    handleDeleteMemory: async function(memoryId) {
        const charId = appState.getCurrentProfileCharId();
        if (!charId || !memoryId) return;
        if (!confirm("Are you sure you want to delete this memory?")) return;

        try {
            const response = await ApiService.deleteNpcMemory(charId, memoryId);
            const charToUpdate = appState.getCharacterById(charId);
            if (charToUpdate && response.updated_memories) {
                charToUpdate.memories = response.updated_memories;
                appState.updateCharacterInList(charToUpdate);
                // App.handleDeleteMemory will be global
                UIRenderers.renderMemoriesUI(charToUpdate.memories, Utils.getElem('character-memories-list'), handleDeleteMemory);
            }
        } catch (error) {
            console.error("CharacterService: Error deleting memory:", error);
            alert("Error deleting memory: " + error.message);
        }
    }
};

// Re-export handlers that might be directly assigned via onclick in HTML
// or are used as callbacks in a way that expects them on window.
// This is a bridge; ideally, event listeners in eventHandlers.js would directly call CharacterService.method.
window.handleSaveGmNotes = CharacterService.handleSaveGmNotes;
window.handleAddMemory = CharacterService.handleAddMemory;
window.handleDeleteMemory = CharacterService.handleDeleteMemory; // Crucial for profileElementIds.deleteMemoryCallback
window.handleSaveFactionStanding = CharacterService.handleSaveFactionStanding; // Crucial for profileElementIds.factionChangeCallback
window.handleAssociateHistoryFile = CharacterService.handleAssociateHistoryFile;
window.handleDissociateHistoryFile = CharacterService.handleDissociateHistoryFile; // Crucial for profileElementIds.dissociateHistoryCallback
window.handleCharacterCreation = CharacterService.handleCharacterCreation;
window.handleCreateLoreEntry = CharacterService.handleCreateLoreEntry;
window.handleSelectLoreEntryForDetails = CharacterService.handleSelectLoreEntryForDetails; // Called by UIRenderers
window.handleUpdateLoreEntryGmNotes = CharacterService.handleUpdateLoreEntryGmNotes;
window.handleDeleteLoreEntry = CharacterService.handleDeleteLoreEntry;
window.handleLinkLoreToCharacter = CharacterService.handleLinkLoreToCharacter;
window.handleUnlinkLoreFromCharacter = CharacterService.handleUnlinkLoreFromCharacter; // Crucial for profileElementIds.unlinkLoreFromCharacterCallback

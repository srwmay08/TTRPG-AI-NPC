// static/characterService.js
// Responsibility: Logic related to fetching, processing, and managing character data.

var CharacterService = {
    profileElementIds: {
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
        deleteMemoryCallback: () => CharacterService.handleDeleteMemory,
        factionChangeCallback: () => CharacterService.handleSaveFactionStanding,
        dissociateHistoryCallback: () => CharacterService.handleDissociateHistoryFile,
        unlinkLoreFromCharacterCallback: () => CharacterService.handleUnlinkLoreFromCharacter
    },

    initializeAppCharacters: async function() {
        console.log("Fetching characters via characterService...");
        try {
            const charactersFromServer = await ApiService.fetchCharactersFromServer();
            appState.setAllCharacters(charactersFromServer);
            console.log("Characters fetched and processed:", appState.getAllCharacters().length);

            UIRenderers.renderPcListUI(Utils.getElem('active-pc-list'), Utils.getElem('speaking-pc-select'), appState.getAllCharacters(), appState.activePcIds, App.handleTogglePcSelection);

            UIRenderers.renderNpcListForContextUI(
                Utils.getElem('character-list-scene-tab'),
                appState.getAllCharacters(),
                appState.activeSceneNpcIds,
                App.handleToggleNpcInScene,
                CharacterService.handleSelectCharacterForDetails,
                null
            );
            UIRenderers.renderAllNpcListForManagementUI(
                Utils.getElem('all-character-list-management'),
                appState.getAllCharacters(),
                CharacterService.handleSelectCharacterForDetails
            );

            await this.fetchAllLoreEntriesAndUpdateState();
            UIRenderers.populateLoreTypeDropdownUI();

            setTimeout(App.updateMainView, 0);
        } catch (error) {
            console.error('Error in initializeAppCharacters:', error);
            Utils.getElem('character-list-scene-tab').innerHTML = '<ul><li><em>Error loading NPCs for scene.</em></li></ul>';
            Utils.getElem('all-character-list-management').innerHTML = '<ul><li><em>Error loading all NPCs.</em></li></ul>';
            Utils.getElem('active-pc-list').innerHTML = '<p><em>Error loading PCs.</em></p>';
        }
    },

    handleSelectCharacterForDetails: async function(charIdStr) {
        const characterProfileSection = Utils.getElem('character-profile-main-section');
        
        if (!charIdStr || charIdStr === "null") {
            appState.setCurrentProfileCharId(null);
            appState.clearCannedResponses();
            UIRenderers.renderCharacterProfileUI(null, CharacterService.profileElementIds);
            UIRenderers.renderSuggestions(null); // Clear and hide suggestions
            if (characterProfileSection) {
                characterProfileSection.classList.add('collapsed');
                const content = characterProfileSection.querySelector('.collapsible-content');
                if (content) content.style.display = 'none';
            }
            return;
        }

        appState.setCurrentProfileCharId(charIdStr);
        
        try {
            const selectedCharFromServer = await ApiService.fetchNpcDetails(charIdStr);
            const processedChar = appState.updateCharacterInList(selectedCharFromServer);
            
            appState.setCannedResponsesForProfiledChar(processedChar.canned_conversations || {});
            
            UIRenderers.renderCharacterProfileUI(processedChar, CharacterService.profileElementIds);
            UIRenderers.renderSuggestions(null); // Render suggestions area, showing canned responses if available

            if (characterProfileSection) {
                characterProfileSection.classList.remove('collapsed');
                const content = characterProfileSection.querySelector('.collapsible-content');
                if (content) content.style.display = 'block';
            }

            await CharacterService.fetchAndRenderHistoryFiles();
        } catch (error) {
            console.error("Error in handleSelectCharacterForDetails:", error);
            Utils.updateText('details-char-name', 'Error loading details');
            UIRenderers.renderCharacterProfileUI(null, CharacterService.profileElementIds);
            appState.clearCannedResponses();
            UIRenderers.renderSuggestions(null);
            if (characterProfileSection) {
                characterProfileSection.classList.add('collapsed');
                const content = characterProfileSection.querySelector('.collapsible-content');
                if(content) content.style.display = 'none';
            }
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
            UIRenderers.renderNpcListForContextUI(Utils.getElem('character-list-scene-tab'), appState.getAllCharacters(), appState.activeSceneNpcIds, App.handleToggleNpcInScene, CharacterService.handleSelectCharacterForDetails, appState.currentSceneContextFilter);
            UIRenderers.renderAllNpcListForManagementUI(Utils.getElem('all-character-list-management'), appState.getAllCharacters(), CharacterService.handleSelectCharacterForDetails);
            UIRenderers.renderPcListUI(Utils.getElem('active-pc-list'), Utils.getElem('speaking-pc-select'), appState.getAllCharacters(), appState.activePcIds, App.handleTogglePcSelection);

            Utils.getElem('new-char-name').value = '';
            Utils.getElem('new-char-description').value = '';
            Utils.getElem('new-char-personality').value = '';
            alert("Character created successfully!");
        } catch (error) {
            console.error("Error creating character:", error);
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
            console.error("Error fetching/rendering history files:", error);
            selectElement.innerHTML += `<option value="" disabled>Error loading history files.</option>`;
        }
    },

    handleAssociateHistoryFile: async function() {
        const charId = appState.getCurrentProfileCharId();
        if (!charId) {
            alert("Please select a character first.");
            return;
        }
        const selectedFileElement = Utils.getElem('history-file-select');
        const selectedFile = selectedFileElement.value;

        if (!selectedFile) {
            alert("Please select a history file to add.");
            return;
        }
        try {
            const result = await ApiService.associateHistoryFileWithNpc(charId, selectedFile);
            if (result && result.character) {
                const updatedChar = appState.updateCharacterInList(result.character);
                UIRenderers.renderCharacterProfileUI(updatedChar, CharacterService.profileElementIds);
                alert(result.message || "History file associated successfully.");
            } else {
                alert("Failed to associate history file: No character data returned from server.");
            }
        } catch (error) {
            console.error("Error associating history file:", error);
            alert(`Error associating history file: ${error.message}`);
        }
    },

    handleDissociateHistoryFile: async function(filename) {
        const charId = appState.getCurrentProfileCharId();
        if (!charId) { alert("No character selected."); return; }
        if (!confirm(`Remove "${filename}" from this character's history?`)) return;
        try {
            const result = await ApiService.dissociateHistoryFileFromNpc(charId, filename);
            if (result && result.character) {
                const updatedChar = appState.updateCharacterInList(result.character);
                UIRenderers.renderCharacterProfileUI(updatedChar, CharacterService.profileElementIds);
                alert(result.message || "History file dissociated successfully.");
            } else {
                alert("Failed to dissociate history file: No character data returned from server.");
            }
        } catch (error) {
            console.error("Error dissociating history file:", error);
            alert(`Error dissociating file: ${error.message}`);
        }
    },

    handleSaveFactionStanding: async function(npcId, pcId, newStandingValue) {
        if (!npcId || !pcId || !newStandingValue) {
            console.error("Missing IDs or new standing for faction update");
            return;
        }
        try {
            const payload = {
                pc_faction_standings: {
                    ...(appState.getCharacterById(npcId)?.pc_faction_standings || {}),
                    [pcId]: newStandingValue
                }
            };
            const response = await ApiService.updateCharacterOnServer(npcId, payload);
            if (response && response.character) {
                const updatedCharState = appState.updateCharacterInList(response.character);
                const currentProfileChar = appState.getCurrentProfileChar();
                if (currentProfileChar && String(currentProfileChar._id) === String(npcId)) {
                     UIRenderers.renderNpcFactionStandingsUI(
                        updatedCharState,
                        appState.activePcIds,
                        appState.getAllCharacters(),
                        Utils.getElem('npc-faction-standings-content'),
                        CharacterService.handleSaveFactionStanding
                    );
                }
            } else {
                console.error("Failed to update faction standing: No character data returned from server.");
                alert("Failed to update faction standing on server.");
            }
        } catch (error) {
            console.error("Error saving faction standing:", error);
            alert(`Error saving faction standing: ${error.message}`);
        }
    },

    fetchAllLoreEntriesAndUpdateState: async function() {
        try {
            const loreEntries = await ApiService.fetchAllLoreEntries();
            appState.setAllLoreEntries(loreEntries);
            UIRenderers.renderLoreEntryListUI(appState.getAllLoreEntries());
            UIRenderers.populateLoreEntrySelectForCharacterLinkingUI();
            UIRenderers.populateSceneContextSelectorUI();
            UIRenderers.populateSceneContextTypeFilterUI();
        } catch (error) {
            console.error("Error fetching all lore entries:", error);
        }
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
            Utils.getElem('new-lore-type').value = LORE_TYPES[0];
            Utils.getElem('new-lore-description').value = '';
            Utils.getElem('new-lore-key-facts').value = '';
            Utils.getElem('new-lore-tags').value = '';
            Utils.getElem('new-lore-gm-notes').value = '';
            alert("Lore entry created successfully!");
        } catch (error) {
            console.error("Error creating lore entry:", error);
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
            console.error("Error fetching lore entry details:", error);
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
            console.error("Error saving lore GM notes:", error);
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
                    UIRenderers.renderCharacterProfileUI(charData, CharacterService.profileElementIds);
                 }
            }
            alert("Lore entry deleted.");
        } catch (error) {
            console.error("Error deleting lore entry:", error);
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
            UIRenderers.renderCharacterProfileUI(updatedChar, CharacterService.profileElementIds);
            alert("Lore linked to character.");
        } catch (error) {
            console.error("Error linking lore to character:", error);
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
            UIRenderers.renderCharacterProfileUI(updatedChar, CharacterService.profileElementIds);
            alert("Lore unlinked from character.");
        } catch (error) {
            console.error("Error unlinking lore:", error);
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
            console.error("Error saving GM notes:", error);
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
                UIRenderers.renderMemoriesUI(charToUpdate.memories, Utils.getElem('character-memories-list'), CharacterService.handleDeleteMemory);
            }
            Utils.getElem('new-memory-content').value = '';
            Utils.getElem('new-memory-type').value = '';
        } catch (error) {
            console.error("Error adding memory:", error);
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
                UIRenderers.renderMemoriesUI(charToUpdate.memories, Utils.getElem('character-memories-list'), CharacterService.handleDeleteMemory);
            }
        } catch (error) {
            console.error("Error deleting memory:", error);
            alert("Error deleting memory: " + error.message);
        }
    }
};
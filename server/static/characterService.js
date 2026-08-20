/**
 * static/characterService.js
 * 
 * Responsibility: Acts as a controller specifically governing logic related to 
 * fetching, processing, modifying, and updating character and lore data states.
 * Mediates between ApiService calls and UI Renderer updates.
 */

const CharacterService = {
    // Dictionary tracking static HTML IDs to prevent magic strings and assist maintainability
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
        associatedLoreListForCharacter: 'associated-lore-list-for-character'
    },

    /**
     * Entrypoint data fetcher. Hits the API to load all chars, splits PCs from NPCs, 
     * and delegates lists to their respective renderers.
     */
    initializeAppCharacters: async function() {
        console.log("Fetching characters via characterService...");
        try {
            // Await complete document pull
            let charactersFromServer = await ApiService.fetchCharactersFromServer();
            
            // Push raw data into AppState normalization
            appState.setAllCharacters(charactersFromServer);
            console.log("Characters fetched and processed:", appState.getAllCharacters().length);

            // Extract only the Player Characters and render their specific sidebars/dashboards
            const playerCharacters = appState.getAllCharacters().filter(char => char.character_type === 'PC');
            PCRenderers.renderPcListUI(Utils.getElem('active-pc-list'), Utils.getElem('speaking-pc-select'), playerCharacters, appState.activePcIds, App.handleTogglePcSelection, appState.activeSceneNpcIds);

            // Push non-player characters to the specific context-filtered lists
            NPCRenderers.renderNpcListForContextUI(
                Utils.getElem('character-list-scene-tab'),
                appState.getAllCharacters(),
                appState.activeSceneNpcIds,
                App.handleToggleNpcInScene,
                CharacterService.handleSelectCharacterForDetails,
                null
            );
            
            // Populate the unrestricted backend management list
            NPCRenderers.renderAllNpcListForManagementUI(
                Utils.getElem('all-character-list-management'),
                appState.getAllCharacters(),
                CharacterService.handleSelectCharacterForDetails
            );

            // Concurrently fetch the lore data as it interacts closely with NPCs
            await this.fetchAllLoreEntriesAndUpdateState();
            LoreRenderers.populateLoreTypeDropdownUI();

            // Shift event to end of JS queue
            setTimeout(App.updateMainView, 0);
        } catch (error) {
            // Handle critical boot errors safely to avoid crashing the rest of the JS execution
            console.error('Error in initializeAppCharacters:', error);
            Utils.getElem('character-list-scene-tab').innerHTML = '<ul><li><em>Error loading NPCs for scene.</em></li></ul>';
            Utils.getElem('all-character-list-management').innerHTML = '<ul><li><em>Error loading all NPCs.</em></li></ul>';
            Utils.getElem('active-pc-list').innerHTML = '<p><em>Error loading PCs.</em></p>';
        }
    },

    /**
     * Executes when an NPC name is clicked, swapping to the profile view
     * and loading their deep context info.
     * @param {string} charIdStr - The MongoDB ObjectId of the character.
     */
    handleSelectCharacterForDetails: async function(charIdStr) {
        const characterProfileSection = Utils.getElem('character-profile-main-section');
        
        // Null handler: Clears the pane if selection is wiped
        if (!charIdStr || charIdStr === "null") {
            appState.setCurrentProfileCharId(null);
            appState.clearCannedResponses();
            appState.lastAiResultForProfiledChar = null;
            NPCRenderers.renderCharacterProfileUI(null, CharacterService.profileElementIds);
            NPCRenderers.renderSuggestionsArea(null);
            if (characterProfileSection) {
                characterProfileSection.classList.add('collapsed');
                const content = characterProfileSection.querySelector('.collapsible-content');
                if (content) content.style.display = 'none';
            }
            return;
        }

        // Save active tracked character
        appState.setCurrentProfileCharId(charIdStr);
        
        try {
            // Make a detailed query to the DB to fetch large text blocks (histories)
            const selectedCharFromServer = await ApiService.fetchNpcDetails(charIdStr);
            const processedChar = appState.updateCharacterInList(selectedCharFromServer);
            
            // Cache their specific predefined topic outputs
            appState.setCannedResponsesForProfiledChar(processedChar.canned_conversations || {});
            
            // Delegate the building of their HTML sheet to the renderer
            NPCRenderers.renderCharacterProfileUI(processedChar, CharacterService.profileElementIds);
            NPCRenderers.renderSuggestionsArea(null, charIdStr);

            // Expand the accordion window
            if (characterProfileSection) {
                characterProfileSection.classList.remove('collapsed');
                const content = characterProfileSection.querySelector('.collapsible-content');
                if (content) content.style.display = 'block';
            }

            await CharacterService.fetchAndRenderHistoryFiles();

            // Switch view if it is an NPC
            if (processedChar.character_type === 'NPC') {
                appState.currentView = 'npc';
                if (window.App && App.updateMainView) App.updateMainView();
            }

        } catch (error) {
            console.error("Error in handleSelectCharacterForDetails:", error);
            Utils.updateText('details-char-name', 'Error loading details');
            NPCRenderers.renderCharacterProfileUI(null, CharacterService.profileElementIds);
            appState.clearCannedResponses();
            NPCRenderers.renderSuggestionsArea(null);
            if (characterProfileSection) {
                characterProfileSection.classList.add('collapsed');
                const content = characterProfileSection.querySelector('.collapsible-content');
                if(content) content.style.display = 'none';
            }
        }
    },

    /** Validates inputs from the frontend submission form and pushes to the backend. */
    handleCharacterCreation: async function(event) {
        if (event) event.preventDefault(); // Prevent standard HTTP form from overriding AJAX request
        
        // Grab and trim text data
        const name = Utils.getElem('new-char-name').value.trim();
        const description = Utils.getElem('new-char-description').value.trim();
        const personality = Utils.getElem('new-char-personality').value.split(',').map(s => s.trim()).filter(s => s);
        const type = Utils.getElem('new-char-type').value;

        // Basic requirement gating
        if (!name || !description) {
            alert("Name and Description are required.");
            return;
        }
        
        // Structure payload
        const newCharData = { name, description, personality_traits: personality, character_type: type, linked_lore_ids: [] };
        
        try {
            // Push via API and append the resultant new document directly into state arrays
            const newCharacter = await ApiService.createCharacterOnServer(newCharData);
            appState.updateCharacterInList(newCharacter);
            
            // Trigger downstream UI cascades to reflect new state
            NPCRenderers.renderNpcListForContextUI(Utils.getElem('character-list-scene-tab'), appState.getAllCharacters(), appState.activeSceneNpcIds, App.handleToggleNpcInScene, CharacterService.handleSelectCharacterForDetails, appState.currentSceneContextFilter);
            NPCRenderers.renderAllNpcListForManagementUI(Utils.getElem('all-character-list-management'), appState.getAllCharacters(), CharacterService.handleSelectCharacterForDetails);
            PCRenderers.renderPcListUI(Utils.getElem('active-pc-list'), Utils.getElem('speaking-pc-select'), appState.getAllCharacters(), appState.activePcIds, App.handleTogglePcSelection, appState.activeSceneNpcIds);

            // Reset inputs for next creation
            Utils.getElem('new-char-name').value = '';
            Utils.getElem('new-char-description').value = '';
            Utils.getElem('new-char-personality').value = '';
            alert("Character created successfully!");
        } catch (error) {
            console.error("Error creating character:", error);
            alert(`Error creating character: ${error.message}`);
        }
    },

    /** Queries the backend for available `.txt` logs to bind to characters. */
    fetchAndRenderHistoryFiles: async function() {
        const selectElement = Utils.getElem('history-file-select');
        if (!selectElement) return;
        const currentValue = selectElement.value; // Store state before wiping list
        
        selectElement.innerHTML = '<option value="">-- Select a history file --</option>';
        try {
            const files = await ApiService.fetchHistoryFilesFromServer();
            files.forEach(file => {
                const option = document.createElement('option');
                option.value = file;
                option.textContent = file;
                selectElement.appendChild(option);
            });
            // Re-apply selection if possible
            if (files.includes(currentValue)) selectElement.value = currentValue;
        } catch (error) {
            console.error("Error fetching/rendering history files:", error);
            selectElement.innerHTML += `<option value="" disabled>Error loading history files.</option>`;
        }
    },

    /** Instructs API to push a text file reference string to an NPC's array. */
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
                NPCRenderers.renderCharacterProfileUI(updatedChar, CharacterService.profileElementIds);
                alert(result.message || "History file associated successfully.");
            } else {
                alert("Failed to associate history file: No character data returned from server.");
            }
        } catch (error) {
            console.error("Error associating history file:", error);
            alert(`Error associating history file: ${error.message}`);
        }
    },

    /** Instructs API to pull a text file reference string from an NPC's array. */
    handleDissociateHistoryFile: async function(filename) {
        const charId = appState.getCurrentProfileCharId();
        if (!charId) { alert("No character selected."); return; }
        
        // Confirmation gate
        if (!confirm(`Remove "${filename}" from this character's history?`)) return;
        
        try {
            const result = await ApiService.dissociateHistoryFileFromNpc(charId, filename);
            if (result && result.character) {
                const updatedChar = appState.updateCharacterInList(result.character);
                NPCRenderers.renderCharacterProfileUI(updatedChar, CharacterService.profileElementIds);
                alert(result.message || "History file dissociated successfully.");
            } else {
                alert("Failed to dissociate history file: No character data returned from server.");
            }
        } catch (error) {
            console.error("Error dissociating history file:", error);
            alert(`Error dissociating file: ${error.message}`);
        }
    },

    /** Updates a specific Dictionary key within an NPC corresponding to a PC's reputation. */
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
                
                // If they are currently being viewed, immediately overwrite the visible slider
                if (currentProfileChar && String(currentProfileChar._id) === String(npcId)) {
                     NPCRenderers.renderNpcFactionStandingsUI(
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

    /** Cascades Lore downloads into specific Context selector dropdowns. */
    fetchAllLoreEntriesAndUpdateState: async function() {
        try {
            const loreEntries = await ApiService.fetchAllLoreEntries();
            appState.setAllLoreEntries(loreEntries);
            LoreRenderers.renderLoreEntryListUI(appState.getAllLoreEntries());
            LoreRenderers.populateLoreEntrySelectForCharacterLinkingUI();
            LoreRenderers.populateSceneContextSelectorUI();
            LoreRenderers.populateLoreTypeDropdownUI();
        } catch (error) {
            console.error("Error fetching all lore entries:", error);
        }
    },

    /** Structure and validate new generic Lore contexts. */
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
            LoreRenderers.renderLoreEntryListUI(appState.getAllLoreEntries());
            LoreRenderers.populateLoreEntrySelectForCharacterLinkingUI();
            LoreRenderers.populateSceneContextSelectorUI();

            // Clear inputs post-success
            Utils.getElem('new-lore-name').value = '';
            Utils.getElem('new-lore-type').value = LORE_TYPES[0]; // Restores to default constant
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

    /** Fetches the specific lore entry object for display on the right pane. */
    handleSelectLoreEntryForDetails: async function(loreIdStr) {
        if (!loreIdStr) {
            LoreRenderers.closeLoreDetailViewUI();
            return;
        }
        appState.setCurrentLoreEntryId(loreIdStr);
        try {
            const loreEntry = await ApiService.fetchLoreEntryDetails(loreIdStr);
            LoreRenderers.renderLoreEntryDetailUI(loreEntry);
        } catch (error) {
            console.error("Error fetching lore entry details:", error);
            LoreRenderers.closeLoreDetailViewUI();
        }
    },

    /** Persists GM private notes updates to a Lore object without modifying descriptors. */
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

    /** Initiates destructive deletion logic against the backend Mongo DB. */
    handleDeleteLoreEntry: async function() {
        const loreId = appState.getCurrentLoreEntryId();
        if (!loreId) return;
        
        // Hard-stop validation check
        if (!confirm("Are you sure you want to delete this lore entry? This will also unlink it from all characters.")) return;
        
        try {
            await ApiService.deleteLoreEntryFromServer(loreId);
            appState.removeLoreEntryFromList(loreId);
            
            // Clean up related selector UI downstream
            LoreRenderers.renderLoreEntryListUI(appState.getAllLoreEntries());
            LoreRenderers.populateLoreEntrySelectForCharacterLinkingUI();
            LoreRenderers.populateSceneContextSelectorUI();
            LoreRenderers.closeLoreDetailViewUI();

            // If a character currently active has this lore linked, locally drop it from their instance
            const currentProfileCharId = appState.getCurrentProfileCharId();
            if(currentProfileCharId){
                 const charData = appState.getCharacterById(currentProfileCharId);
                 if (charData && charData.linked_lore_ids) {
                    charData.linked_lore_ids = charData.linked_lore_ids.filter(id => id !== loreId);
                    appState.updateCharacterInList(charData);
                    NPCRenderers.renderCharacterProfileUI(charData, CharacterService.profileElementIds);
                 }
            }
            alert("Lore entry deleted.");
        } catch (error) {
            console.error("Error deleting lore entry:", error);
            alert(`Error deleting lore entry: ${error.message}`);
        }
    },

    /** Directs backend to update the NPC's `linked_lore` array with a target ID. */
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
            NPCRenderers.renderCharacterProfileUI(updatedChar, CharacterService.profileElementIds);
            alert("Lore linked to character.");
        } catch (error) {
            console.error("Error linking lore to character:", error);
            alert(`Error linking lore: ${error.message}`);
        }
    },

    /** Directs backend to `$pull` a target ID from the NPC's `linked_lore` array. */
    handleUnlinkLoreFromCharacter: async function(loreIdToUnlink) {
        const charId = appState.getCurrentProfileCharId();
        if (!charId || !loreIdToUnlink) return;

        const character = appState.getCharacterById(charId);
        if (!character) return;

        if (!confirm(`Unlink this lore entry from ${character.name}?`)) return;

        try {
            const result = await ApiService.unlinkLoreFromCharacterOnServer(charId, loreIdToUnlink);
            const updatedChar = appState.updateCharacterInList(result.character);
            NPCRenderers.renderCharacterProfileUI(updatedChar, CharacterService.profileElementIds);
            alert("Lore unlinked from character.");
        } catch (error) {
            console.error("Error unlinking lore:", error);
            alert(`Error unlinking lore: ${error.message}`);
        }
    },

    /** Basic PUT mapping utility for specific GM text. */
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

    /** Sends manually crafted strings to become formatted Memory Objects in Mongo. */
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
                NPCRenderers.renderMemoriesUI(charToUpdate.memories, Utils.getElem('character-memories-list'), CharacterService.handleDeleteMemory);
            }
            Utils.getElem('new-memory-content').value = '';
            Utils.getElem('new-memory-type').value = '';
        } catch (error) {
            console.error("Error adding memory:", error);
            alert("Error adding memory: " + error.message);
        }
    },

    /** Passes UUID target to API endpoint targeting Memory deletions. */
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
                NPCRenderers.renderMemoriesUI(charToUpdate.memories, Utils.getElem('character-memories-list'), CharacterService.handleDeleteMemory);
            }
        } catch (error) {
            console.error("Error deleting memory:", error);
            alert("Error deleting memory: " + error.message);
        }
    }
};
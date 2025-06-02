// static/characterService.js
// Responsibility: Logic related to fetching, processing, and managing character data.

// Defines the IDs of HTML elements used for displaying character profile information.
window.profileElementIds = {
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
    
    // Callbacks that resolve to globally defined handler functions.
    deleteMemoryCallback: () => window.handleDeleteMemory,
    factionChangeCallback: () => window.handleSaveFactionStanding,
    dissociateHistoryCallback: () => window.handleDissociateHistoryFile,
    unlinkLoreFromCharacterCallback: () => window.handleUnlinkLoreFromCharacter 
};

// Initializes application characters and related UI elements.
window.initializeAppCharacters = async function() {
    console.log("Fetching characters via characterService...");
    try {
        const charactersFromServer = await window.fetchCharactersFromServer(); // Fetches all character data.
        appState.setAllCharacters(charactersFromServer); // Processes and stores characters in global state.
        console.log("Characters fetched and processed:", appState.getAllCharacters().length);

        // Renders UI lists for player characters and NPCs.
        window.renderPcListUI(window.getElem('active-pc-list'), window.getElem('speaking-pc-select'), appState.getAllCharacters(), appState.activePcIds, window.handleTogglePcSelection);
        window.renderNpcListForSceneUI(window.getElem('character-list'), appState.getAllCharacters(), appState.activeSceneNpcIds, window.handleToggleNpcInScene, window.handleSelectCharacterForDetails);
        
        await window.fetchAllLoreEntriesAndUpdateState(); // Fetches and renders lore entries.
        window.populateLoreTypeDropdownUI(); // Populates the lore type dropdown in the lore creation form.
        window.populateSceneContextSelectorUI(); // New: Populates the scene context (Location/Organization) dropdown.


        setTimeout(window.updateMainView, 0); // Defers main view update to ensure all elements are ready.
    } catch (error) {
        console.error('Error in initializeAppCharacters:', error);
        // Updates UI to show errors if character loading fails.
        if (window.getElem('character-list')) window.getElem('character-list').innerHTML = '<ul><li><em>Error loading NPCs.</em></li></ul>';
        if (window.getElem('active-pc-list')) window.getElem('active-pc-list').innerHTML = '<p><em>Error loading PCs.</em></p>';
    }
};

// Handles selection of a character to display their details.
window.handleSelectCharacterForDetails = async function(charIdStr) {
    if (!charIdStr || charIdStr === "null") { // If no valid character ID, clear the profile.
        appState.setCurrentProfileCharId(null);
        window.renderCharacterProfileUI(null, window.profileElementIds); 
        window.populateLoreEntrySelectForCharacterLinkingUI(null); 
        return;
    }
    appState.setCurrentProfileCharId(charIdStr); // Set the current character ID in global state.
    try {
        const selectedCharFromServer = await window.fetchNpcDetails(charIdStr); // Fetch full details for the selected character.
        const processedChar = appState.updateCharacterInList(selectedCharFromServer); // Update character in global state.

        window.renderCharacterProfileUI(processedChar, window.profileElementIds); // Render the character's profile.
        await window.fetchAndRenderHistoryFiles(); // Fetch and display associated history files.
        window.populateLoreEntrySelectForCharacterLinkingUI(processedChar.linked_lore_ids || []); // Populate lore linking dropdown.
    } catch (error) {
        console.error("Error in handleSelectCharacterForDetails:", error);
        window.updateText('details-char-name', 'Error loading details');
        window.renderCharacterProfileUI(null, window.profileElementIds); 
        window.populateLoreEntrySelectForCharacterLinkingUI(null); 
    }
};

// Saves GM notes for the currently selected character.
window.handleSaveGmNotes = async function() {
    const charId = appState.getCurrentProfileCharId();
    if (!charId) return;
    const notes = window.getElem('gm-notes').value;
    try {
        const updatePayload = { gm_notes: notes };
        const response = await window.updateCharacterOnServer(charId, updatePayload); 
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
};

// Adds a new memory to the currently selected NPC.
window.handleAddMemory = async function() {
    const charId = appState.getCurrentProfileCharId();
    const character = appState.getCharacterById(charId);
    if (!charId || !character || character.character_type !== 'NPC') {
        alert("Please select an NPC to add memories to.");
        return;
    }
    const content = window.getElem('new-memory-content').value.trim();
    const type = window.getElem('new-memory-type').value.trim() || 'fact';
    if (!content) {
        alert("Memory content cannot be empty.");
        return;
    }
    try {
        const memoryData = { content, type, source: "manual GM entry" };
        const response = await window.addMemoryToNpc(charId, memoryData);
        const charToUpdate = appState.getCharacterById(charId); 
        if (charToUpdate && response.updated_memories) { 
            charToUpdate.memories = response.updated_memories;
            appState.updateCharacterInList(charToUpdate);
            window.renderMemoriesUI(charToUpdate.memories, window.getElem('character-memories-list'), window.handleDeleteMemory);
        }
        window.getElem('new-memory-content').value = '';
        window.getElem('new-memory-type').value = '';
    } catch (error) {
        console.error("Error adding memory:", error);
        alert("Error adding memory: " + error.message);
    }
};

// Deletes a memory from the currently selected NPC.
window.handleDeleteMemory = async function(memoryId) {
    const charId = appState.getCurrentProfileCharId();
    if (!charId || !memoryId) return;
    if (!confirm("Are you sure you want to delete this memory?")) return;

    try {
        const response = await window.deleteNpcMemory(charId, memoryId);
        const charToUpdate = appState.getCharacterById(charId);
        if (charToUpdate && response.updated_memories) {
            charToUpdate.memories = response.updated_memories;
            appState.updateCharacterInList(charToUpdate);
            window.renderMemoriesUI(charToUpdate.memories, window.getElem('character-memories-list'), window.handleDeleteMemory);
        }
    } catch (error) {
        console.error("Error deleting memory:", error);
        alert("Error deleting memory: " + error.message);
    }
};

// Handles creation of a new character.
window.handleCharacterCreation = async function() {
    const name = window.getElem('new-char-name').value.trim();
    const description = window.getElem('new-char-description').value.trim();
    const personality = window.getElem('new-char-personality').value.split(',').map(s => s.trim()).filter(s => s);
    const type = window.getElem('new-char-type').value;

    if (!name || !description) {
        alert("Name and Description are required.");
        return;
    }
    const newCharData = { name, description, personality_traits: personality, character_type: type, linked_lore_ids: [] }; // Ensure linked_lore_ids is initialized
    try {
        const result = await window.createCharacterOnServer(newCharData);
        appState.updateCharacterInList(result.character); // Add new character to state
        // Re-render lists
        window.renderNpcListForSceneUI(window.getElem('character-list'), appState.getAllCharacters(), appState.activeSceneNpcIds, window.handleToggleNpcInScene, window.handleSelectCharacterForDetails);
        window.renderPcListUI(window.getElem('active-pc-list'), window.getElem('speaking-pc-select'), appState.getAllCharacters(), appState.activePcIds, window.handleTogglePcSelection);
        // Clear form
        window.getElem('new-char-name').value = '';
        window.getElem('new-char-description').value = '';
        window.getElem('new-char-personality').value = '';
        alert("Character created successfully!");
    } catch (error) {
        console.error("Error creating character:", error);
        alert(`Error creating character: ${error.message}`);
    }
};

// Fetches and renders the list of available history files.
window.fetchAndRenderHistoryFiles = async function() {
    const selectElement = window.getElem('history-file-select');
    if (!selectElement) return;
    const currentValue = selectElement.value;
    selectElement.innerHTML = '<option value="">-- Select a history file --</option>';
    try {
        const files = await window.fetchHistoryFilesFromServer();
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
};

// Associates a selected history file with the current character.
window.handleAssociateHistoryFile = async function() {
    const charId = appState.getCurrentProfileCharId();
    if (!charId) {
        alert("Please select a character first.");
        return;
    }
    const selectedFileElement = window.getElem('history-file-select');
    if (!selectedFileElement) {
        console.error("History file select element not found");
        return;
    }
    const selectedFile = selectedFileElement.value;

    if (!selectedFile) {
        alert("Please select a history file to add.");
        return;
    }
    try {
        const result = await window.associateHistoryFileWithNpc(charId, selectedFile);
        if (result && result.character) {
            const updatedChar = appState.updateCharacterInList(result.character);
            window.renderCharacterProfileUI(updatedChar, window.profileElementIds);
            alert(result.message || "History file associated successfully.");
        } else {
            alert("Failed to associate history file: No character data returned from server.");
        }
    } catch (error) {
        console.error("Error associating history file:", error);
        alert(`Error associating history file: ${error.message}`);
    }
};

// Dissociates a history file from the current character.
window.handleDissociateHistoryFile = async function(filename) {
    const charId = appState.getCurrentProfileCharId();
    if (!charId) { alert("No character selected."); return; }
    if (!confirm(`Remove "${filename}" from this character's history?`)) return;
    try {
        const result = await window.dissociateHistoryFileFromNpc(charId, filename);
        if (result && result.character) {
            const updatedChar = appState.updateCharacterInList(result.character);
            window.renderCharacterProfileUI(updatedChar, window.profileElementIds);
            alert(result.message || "History file dissociated successfully.");
        } else {
            alert("Failed to dissociate history file: No character data returned from server.");
        }
    } catch (error) {
        console.error("Error dissociating history file:", error);
        alert(`Error dissociating file: ${error.message}`);
    }
};

// Handles saving changes to an NPC's faction standing towards a PC.
window.handleSaveFactionStanding = async function(npcId, pcId, newStandingValue) {
    if (!npcId || !pcId || !newStandingValue) {
        console.error("Missing IDs or new standing for faction update");
        return;
    }
    try {
        // The payload should correctly target the specific PC's standing within the npc's pc_faction_standings object
        const payload = { 
            pc_faction_standings: { 
                ...(appState.getCharacterById(npcId)?.pc_faction_standings || {}), // Preserve existing standings
                [pcId]: newStandingValue // Update/add the specific PC's standing
            }
        };

        const response = await window.updateCharacterOnServer(npcId, payload); // Use the general update endpoint
        if (response && response.character) {
            const updatedCharState = appState.updateCharacterInList(response.character); 
            const currentProfileChar = appState.getCurrentProfileChar();
            // Re-render if the updated NPC is the one currently in profile
            if (currentProfileChar && String(currentProfileChar._id) === String(npcId)) {
                 window.renderNpcFactionStandingsUI(
                    updatedCharState, 
                    appState.activePcIds,
                    appState.getAllCharacters(),
                    window.getElem('npc-faction-standings-content'),
                    window.handleSaveFactionStanding
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
};

// --- Lore Management Functions ---
window.fetchAllLoreEntriesAndUpdateState = async function() {
    try {
        const loreEntries = await window.fetchAllLoreEntries(); 
        appState.setAllLoreEntries(loreEntries);
        window.renderLoreEntryListUI(appState.getAllLoreEntries());
        window.populateLoreEntrySelectForCharacterLinkingUI(); 
        window.populateSceneContextSelectorUI(); // Populate the new scene context dropdown
    } catch (error) {
        console.error("Error fetching all lore entries:", error);
    }
};

window.handleCreateLoreEntry = async function() {
    const name = window.getElem('new-lore-name').value.trim();
    const lore_type = window.getElem('new-lore-type').value;
    const description = window.getElem('new-lore-description').value.trim();
    const key_facts = window.getElem('new-lore-key-facts').value.split('\n').map(s => s.trim()).filter(s => s);
    const tags = window.getElem('new-lore-tags').value.split(',').map(s => s.trim()).filter(s => s);
    const gm_notes = window.getElem('new-lore-gm-notes').value.trim();

    if (!name || !description || !lore_type) {
        alert("Name, Type, and Description are required for a lore entry.");
        return;
    }
    const loreData = { name, lore_type, description, key_facts, tags, gm_notes };
    try {
        const result = await window.createLoreEntryOnServer(loreData); 
        appState.updateLoreEntryInList(result.lore_entry); // Add to local state
        window.renderLoreEntryListUI(appState.getAllLoreEntries()); // Re-render list
        window.populateLoreEntrySelectForCharacterLinkingUI(); // Update linking dropdown
        window.populateSceneContextSelectorUI(); // Update scene context dropdown

        // Clear form
        window.getElem('new-lore-name').value = '';
        window.getElem('new-lore-type').value = LORE_TYPES[0]; 
        window.getElem('new-lore-description').value = '';
        window.getElem('new-lore-key-facts').value = '';
        window.getElem('new-lore-tags').value = '';
        window.getElem('new-lore-gm-notes').value = '';
        alert("Lore entry created successfully!");
    } catch (error) {
        console.error("Error creating lore entry:", error);
        alert(`Error creating lore entry: ${error.message}`);
    }
};

window.handleSelectLoreEntryForDetails = async function(loreIdStr) {
    if (!loreIdStr) {
        window.closeLoreDetailViewUI();
        return;
    }
    appState.setCurrentLoreEntryId(loreIdStr);
    try {
        const loreEntry = await window.fetchLoreEntryDetails(loreIdStr); 
        window.renderLoreEntryDetailUI(loreEntry); 
    } catch (error) {
        console.error("Error fetching lore entry details:", error);
        window.closeLoreDetailViewUI(); 
    }
};

window.handleUpdateLoreEntryGmNotes = async function() {
    const loreId = appState.getCurrentLoreEntryId();
    if (!loreId) return;
    const gm_notes = window.getElem('details-lore-gm-notes').value;
    try {
        const result = await window.updateLoreEntryOnServer(loreId, { gm_notes });
        appState.updateLoreEntryInList(result.lore_entry); // Update local state
        alert("Lore GM Notes saved!");
    } catch (error) {
        console.error("Error saving lore GM notes:", error);
        alert(`Error saving lore notes: ${error.message}`);
    }
};

window.handleDeleteLoreEntry = async function() {
    const loreId = appState.getCurrentLoreEntryId();
    if (!loreId) return;
    if (!confirm("Are you sure you want to delete this lore entry? This will also unlink it from all characters.")) return;
    try {
        await window.deleteLoreEntryFromServer(loreId); 
        appState.removeLoreEntryFromList(loreId); // Remove from local state
        window.renderLoreEntryListUI(appState.getAllLoreEntries()); // Re-render list
        window.populateLoreEntrySelectForCharacterLinkingUI(); // Update linking dropdown
        window.populateSceneContextSelectorUI(); // Update scene context dropdown
        window.closeLoreDetailViewUI(); 
        
        // Refresh any open character profile that might have been linked to this lore
        const currentProfileCharId = appState.getCurrentProfileCharId();
        if(currentProfileCharId){
             const charData = appState.getCharacterById(currentProfileCharId);
             // Refilter its linked_lore_ids and re-render
             if (charData && charData.linked_lore_ids) {
                charData.linked_lore_ids = charData.linked_lore_ids.filter(id => id !== loreId);
                appState.updateCharacterInList(charData);
                window.renderCharacterProfileUI(charData, window.profileElementIds);
             }
        }
        alert("Lore entry deleted.");
    } catch (error) {
        console.error("Error deleting lore entry:", error);
        alert(`Error deleting lore entry: ${error.message}`);
    }
};

window.handleLinkLoreToCharacter = async function() {
    const charId = appState.getCurrentProfileCharId();
    const loreSelect = window.getElem('lore-entry-select-for-character');
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
        const result = await window.linkLoreToCharacterOnServer(charId, loreId); 
        const updatedChar = appState.updateCharacterInList(result.character); // Update char in local state
        
        window.renderCharacterProfileUI(updatedChar, window.profileElementIds); // Re-render profile
        // The populateLoreEntrySelectForCharacterLinkingUI will be called within renderCharacterProfileUI indirectly or directly
        alert("Lore linked to character.");
    } catch (error) {
        console.error("Error linking lore to character:", error);
        alert(`Error linking lore: ${error.message}`);
    }
};

window.handleUnlinkLoreFromCharacter = async function(loreIdToUnlink) {
    const charId = appState.getCurrentProfileCharId();
    if (!charId || !loreIdToUnlink) return;
    
    const character = appState.getCharacterById(charId);
    if (!character) return;

    if (!confirm(`Unlink this lore entry from ${character.name}?`)) return;

    try {
        const result = await window.unlinkLoreFromCharacterOnServer(charId, loreIdToUnlink); 
        const updatedChar = appState.updateCharacterInList(result.character); // Update char in local state
        
        window.renderCharacterProfileUI(updatedChar, window.profileElementIds); // Re-render profile
        alert("Lore unlinked from character.");
    } catch (error) {
        console.error("Error unlinking lore:", error);
        alert(`Error unlinking lore: ${error.message}`);
    }
};
// static/characterService.js
// Responsibility: Logic related to fetching, processing, and managing character data.

// Make profileElementIds global for access within this file by its own functions
window.profileElementIds = {
    detailsCharName: 'details-char-name', profileCharType: 'profile-char-type',
    profileDescription: 'profile-description', profilePersonality: 'profile-personality',
    gmNotesTextarea: 'gm-notes', saveGmNotesBtn: 'save-gm-notes-btn',
    npcMemoriesSection: 'npc-memories-collapsible-section', characterMemoriesList: 'character-memories-list',
    addMemoryBtn: 'add-memory-btn', npcFactionStandingsSection: 'npc-faction-standings-section',
    npcFactionStandingsContent: 'npc-faction-standings-content', characterHistorySection: 'character-history-collapsible-section',
    associatedHistoryList: 'associated-history-list', historyContentDisplay: 'history-content-display',
    associateHistoryBtn: 'associate-history-btn',
    // Callbacks will reference globally defined handlers
    deleteMemoryCallback: () => window.handleDeleteMemory,
    factionChangeCallback: () => window.handleSaveFactionStanding,
    dissociateHistoryCallback: () => window.handleDissociateHistoryFile
};

// static/characterService.js

window.initializeAppCharacters = async function() {
    console.log("Fetching characters via characterService...");
    try {
        const charactersFromServer = await window.fetchCharactersFromServer();
        appState.setAllCharacters(charactersFromServer);
        console.log("Characters fetched and processed:", appState.getAllCharacters().length);

        window.renderNpcListForSceneUI(window.getElem('character-list'), appState.getAllCharacters(), appState.activeSceneNpcIds, window.handleToggleNpcInScene, window.handleSelectCharacterForDetails);
        window.renderPcListUI(window.getElem('active-pc-list'), window.getElem('speaking-pc-select'), appState.getAllCharacters(), appState.activePcIds, window.handleTogglePcSelection);
        
        setTimeout(window.updateMainView, 0); // <-- DEFER THIS CALL
    } catch (error) {
        console.error('Error in initializeAppCharacters:', error);
        if (window.getElem('character-list')) window.getElem('character-list').innerHTML = '<ul><li><em>Error loading NPCs.</em></li></ul>';
        if (window.getElem('active-pc-list')) window.getElem('active-pc-list').innerHTML = '<p><em>Error loading PCs.</em></p>';
    }
};

// ... rest of characterService.js code ...

window.handleSelectCharacterForDetails = async function(charIdStr) {
    if (!charIdStr || charIdStr === "null") {
        appState.setCurrentProfileCharId(null);
        window.renderCharacterProfileUI(null, window.profileElementIds);
        return;
    }
    appState.setCurrentProfileCharId(charIdStr);
    try {
        const selectedCharFromServer = await window.fetchNpcDetails(charIdStr);
        const processedChar = appState.updateCharacterInList(selectedCharFromServer);

        window.renderCharacterProfileUI(processedChar, window.profileElementIds);
        await window.fetchAndRenderHistoryFiles();
    } catch (error) {
        console.error("Error in handleSelectCharacterForDetails:", error);
        window.updateText('details-char-name', 'Error loading details');
         // Attempt to render the profile pane with an error message or clear it
        window.renderCharacterProfileUI(null, window.profileElementIds); // Clears profile
    }
};

window.handleSaveGmNotes = async function() {
    const charId = appState.getCurrentProfileCharId();
    if (!charId) return;
    const notes = window.getElem('gm-notes').value;
    try {
        // Pass the whole character object or specific fields the backend expects
        // The backend PUT /api/npcs/{npc_id_str} expects a partial or full NPCProfile
        const updatePayload = { gm_notes: notes };
        const response = await window.updateCharacterOnServer(charId, updatePayload); // Use specific update function
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
        const charToUpdate = appState.getCharacterById(charId); // Re-fetch or use response
        if (charToUpdate && response.updated_memories) { // Ensure response has updated_memories
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

window.handleCharacterCreation = async function() {
    const name = window.getElem('new-char-name').value.trim();
    const description = window.getElem('new-char-description').value.trim();
    const personality = window.getElem('new-char-personality').value.split(',').map(s => s.trim()).filter(s => s);
    const type = window.getElem('new-char-type').value;

    if (!name || !description) {
        alert("Name and Description are required.");
        return;
    }
    const newCharData = { name, description, personality_traits: personality, character_type: type };
    try {
        const result = await window.createCharacterOnServer(newCharData);
        appState.updateCharacterInList(result.character);
        window.renderNpcListForSceneUI(window.getElem('character-list'), appState.getAllCharacters(), appState.activeSceneNpcIds, window.handleToggleNpcInScene, window.handleSelectCharacterForDetails);
        window.renderPcListUI(window.getElem('active-pc-list'), window.getElem('speaking-pc-select'), appState.getAllCharacters(), appState.activePcIds, window.handleTogglePcSelection);
        window.getElem('new-char-name').value = '';
        window.getElem('new-char-description').value = '';
        window.getElem('new-char-personality').value = '';
        alert("Character created successfully!");
    } catch (error) {
        console.error("Error creating character:", error);
        alert(`Error creating character: ${error.message}`);
    }
};

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

window.handleSaveFactionStanding = async function(npcId, pcId, newStandingValue) {
    if (!npcId || !pcId || !newStandingValue) {
        console.error("Missing IDs or new standing for faction update");
        return;
    }
    try {
        const response = await window.updateNpcFactionStanding(npcId, pcId, newStandingValue);
        if (response && response.character) {
            const updatedCharState = appState.updateCharacterInList(response.character); // Get the character from state
            const currentProfileChar = appState.getCurrentProfileChar();
            if (currentProfileChar && String(currentProfileChar._id) === String(npcId)) {
                 window.renderNpcFactionStandingsUI(
                    updatedCharState, // Use the character from state which is processed
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
// This is the end of characterService.js. Ensure no extra braces.
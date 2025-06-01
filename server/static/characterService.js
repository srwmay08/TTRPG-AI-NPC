// characterService.js
// Responsibility: Logic related to fetching, processing, and managing character data.
// Assumes apiService.js, appState.js, and relevant UI renderers are available.

async function initializeAppCharacters() {
    console.log("Fetching characters via characterService...");
    try {
        const charactersFromServer = await fetchCharactersFromServer(); // from apiService.js
        appState.setAllCharacters(charactersFromServer); // Process and store in appState
        console.log("Characters fetched and processed:", appState.getAllCharacters().length);

        // Initial Renders (could also be triggered from app.js)
        renderNpcListForSceneUI(getElem('character-list'), appState.getAllCharacters(), appState.activeSceneNpcIds, handleToggleNpcInScene, handleSelectCharacterForDetails);
        renderPcListUI(getElem('active-pc-list'), getElem('speaking-pc-select'), appState.getAllCharacters(), appState.activePcIds, handleTogglePcSelection);
        updateMainView(); // This global function will need to be refactored or called from app.js
    } catch (error) {
        console.error('Error in initializeAppCharacters:', error);
        if (getElem('character-list')) getElem('character-list').innerHTML = '<ul><li><em>Error loading NPCs.</em></li></ul>';
        if (getElem('active-pc-list')) getElem('active-pc-list').innerHTML = '<p><em>Error loading PCs.</em></p>';
    }
}

async function handleSelectCharacterForDetails(charIdStr) {
    if (!charIdStr || charIdStr === "null") {
        appState.setCurrentProfileCharId(null);
        // Call a UI function to reset/clear the profile pane
        renderCharacterProfileUI(null, profileElementIds /* define this object with IDs */);
        return;
    }
    appState.setCurrentProfileCharId(charIdStr);
    try {
        const selectedChar = await fetchNpcDetails(charIdStr); // from apiService.js
        const processedChar = appState.updateCharacterInList(selectedChar); // Process and update in state

        // Define profileElementIds for renderCharacterProfileUI
        const elements = {
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
            deleteMemoryCallback: handleDeleteMemory, // Pass actual handler
            factionChangeCallback: handleSaveFactionStanding, // Pass actual handler
            dissociateHistoryCallback: handleDissociateHistoryFile // Pass actual handler
        };
        renderCharacterProfileUI(processedChar, elements);
        await fetchAndRenderHistoryFiles(); // Update history file dropdown
    } catch (error) {
        console.error("Error in handleSelectCharacterForDetails:", error);
        updateText('details-char-name', 'Error loading details');
        // Potentially clear other parts of the profile UI
    }
}

async function handleSaveGmNotes() {
    const charId = appState.getCurrentProfileCharId();
    if (!charId) return;
    const notes = getElem('gm-notes').value;
    try {
        const updatedCharData = await saveCharacterNotes(charId, notes); // from apiService.js
        appState.updateCharacterInList(updatedCharData.character); // Update state
        alert('GM Notes saved!');
    } catch (error) {
        console.error("Error saving GM notes:", error);
        alert(`Error saving notes: ${error.message}`);
    }
}

async function handleAddMemory() {
    const charId = appState.getCurrentProfileCharId();
    const character = appState.getCharacterById(charId);
    if (!charId || !character || character.character_type !== 'NPC') {
        alert("Please select an NPC to add memories to.");
        return;
    }
    const content = getElem('new-memory-content').value.trim();
    const type = getElem('new-memory-type').value.trim() || 'fact'; // Default type
    if (!content) {
        alert("Memory content cannot be empty.");
        return;
    }
    try {
        const memoryData = { content, type, source: "manual GM entry" }; // memory_id and timestamp added by backend/model
        const response = await addMemoryToNpc(charId, memoryData); // from apiService.js
        const charToUpdate = appState.getCharacterById(charId);
        if (charToUpdate) {
            charToUpdate.memories = response.updated_memories; // Assuming backend returns the full list
            appState.updateCharacterInList(charToUpdate); // Update character in state
             renderMemoriesUI(charToUpdate.memories, getElem('character-memories-list'), handleDeleteMemory);
        }
        getElem('new-memory-content').value = '';
        getElem('new-memory-type').value = '';
    } catch (error) {
        console.error("Error adding memory:", error);
        alert("Error adding memory: " + error.message);
    }
}

async function handleDeleteMemory(memoryId) {
    const charId = appState.getCurrentProfileCharId();
    if (!charId || !memoryId) return;
    if (!confirm("Are you sure you want to delete this memory?")) return;

    try {
        const response = await deleteNpcMemory(charId, memoryId); // from apiService.js
        const charToUpdate = appState.getCharacterById(charId);
        if (charToUpdate) {
            charToUpdate.memories = response.updated_memories;
            appState.updateCharacterInList(charToUpdate);
            renderMemoriesUI(charToUpdate.memories, getElem('character-memories-list'), handleDeleteMemory);
        }
    } catch (error) {
        console.error("Error deleting memory:", error);
        alert("Error deleting memory: " + error.message);
    }
}

async function handleCharacterCreation() {
    // ... (get values from form)
    // const newCharData = { name, description, personality_traits, character_type };
    // const result = await createCharacterOnServer(newCharData);
    // appState.updateCharacterInList(result.character);
    // ... (re-render lists, clear form, alert user)
}

async function fetchAndRenderHistoryFiles() {
    const selectElement = getElem('history-file-select');
    if (!selectElement) return;
    const currentValue = selectElement.value;
    selectElement.innerHTML = '<option value="">-- Select a history file --</option>';
    try {
        const files = await fetchHistoryFilesFromServer(); // from apiService.js
        files.forEach(file => {
            const option = document.createElement('option');
            option.value = file;
            option.textContent = file;
            selectElement.appendChild(option);
        });
        if (files.includes(currentValue)) selectElement.value = currentValue;
    } catch (error) {
        console.error("Error fetching/rendering history files:", error);
        selectElement.innerHTML += `<option value="" disabled>Error loading.</option>`;
    }
}

// (Make sure elements object is complete and correct in these handlers)
const profileElementIds = {
    detailsCharName: 'details-char-name', profileCharType: 'profile-char-type',
    profileDescription: 'profile-description', profilePersonality: 'profile-personality',
    gmNotesTextarea: 'gm-notes', saveGmNotesBtn: 'save-gm-notes-btn',
    npcMemoriesSection: 'npc-memories-collapsible-section', characterMemoriesList: 'character-memories-list',
    addMemoryBtn: 'add-memory-btn', npcFactionStandingsSection: 'npc-faction-standings-section',
    npcFactionStandingsContent: 'npc-faction-standings-content', characterHistorySection: 'character-history-collapsible-section',
    associatedHistoryList: 'associated-history-list', historyContentDisplay: 'history-content-display',
    associateHistoryBtn: 'associate-history-btn',
    // Make sure these callbacks refer to globally accessible functions or are passed in correctly
    deleteMemoryCallback: window.handleDeleteMemory,
    factionChangeCallback: window.handleSaveFactionStanding,
    dissociateHistoryCallback: window.handleDissociateHistoryFile
};


async function handleAssociateHistoryFile() {
    const charId = appState.getCurrentProfileCharId();
    if (!charId) {
        alert("Please select a character first.");
        return;
    }
    const selectedFileElement = window.getElem('history-file-select'); // Use window.getElem
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
        const result = await window.associateHistoryFileWithNpc(charId, selectedFile); // from apiService.js

        if (result && result.character) {
            const updatedChar = appState.updateCharacterInList(result.character);
            // Re-render the entire profile to reflect changes
            window.renderCharacterProfileUI(updatedChar, profileElementIds); // from uiRenderers.js
            alert(result.message || "History file associated successfully.");
        } else {
            alert("Failed to associate history file: No character data returned from server.");
        }
    } catch (error) {
        console.error("Error associating history file:", error);
        alert(`Error associating history file: ${error.message}`);
    }
}

async function handleDissociateHistoryFile(filename) { // Filename is passed directly
    const charId = appState.getCurrentProfileCharId();
    if (!charId) { alert("No character selected."); return; }
    if (!confirm(`Remove "${filename}" from this character's history?`)) return;

    try {
        const result = await window.dissociateHistoryFileFromNpc(charId, filename); // from apiService.js
        if (result && result.character) {
            const updatedChar = appState.updateCharacterInList(result.character);
            window.renderCharacterProfileUI(updatedChar, profileElementIds); // from uiRenderers.js
            alert(result.message || "History file dissociated successfully.");
        } else {
            alert("Failed to dissociate history file: No character data returned from server.");
        }
    } catch (error) {
        console.error("Error dissociating history file:", error);
        alert(`Error dissociating file: ${error.message}`);
    }
}
}
async function handleSaveFactionStanding(pcId, newStandingValue) {
    // ... (logic to call apiService.updateNpcFactionStanding and update appState/UI)
}


// If using ES6 modules:
// export { initializeAppCharacters, handleSelectCharacterForDetails, ... };
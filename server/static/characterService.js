// static/characterService.js
// Responsibility: Logic related to fetching, processing, and managing character data.

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

    deleteMemoryCallback: () => window.handleDeleteMemory,
    factionChangeCallback: () => window.handleSaveFactionStanding,
    dissociateHistoryCallback: () => window.handleDissociateHistoryFile,
    unlinkLoreFromCharacterCallback: () => window.handleUnlinkLoreFromCharacter
};

window.initializeAppCharacters = async function() {
    console.log("Fetching characters via characterService...");
    try {
        const charactersFromServer = await window.fetchCharactersFromServer();
        appState.setAllCharacters(charactersFromServer);
        console.log("Characters fetched and processed:", appState.getAllCharacters().length);

        window.renderPcListUI(window.getElem('active-pc-list'), window.getElem('speaking-pc-select'), appState.getAllCharacters(), appState.activePcIds, window.handleTogglePcSelection);

        window.renderNpcListForContextUI(
            window.getElem('character-list-scene-tab'),
            appState.getAllCharacters(),
            appState.activeSceneNpcIds,
            window.handleToggleNpcInScene,
            window.handleSelectCharacterForDetails,
            null
        );
        window.renderAllNpcListForManagementUI(
            window.getElem('all-character-list-management'),
            appState.getAllCharacters(),
            window.handleSelectCharacterForDetails
        );

        await window.fetchAllLoreEntriesAndUpdateState();
        window.populateLoreTypeDropdownUI();

        setTimeout(window.updateMainView, 0);
    } catch (error) {
        console.error('Error in initializeAppCharacters:', error);
        if (window.getElem('character-list-scene-tab')) window.getElem('character-list-scene-tab').innerHTML = '<ul><li><em>Error loading NPCs for scene.</em></li></ul>';
        if (window.getElem('all-character-list-management')) window.getElem('all-character-list-management').innerHTML = '<ul><li><em>Error loading all NPCs.</em></li></ul>';
        if (window.getElem('active-pc-list')) window.getElem('active-pc-list').innerHTML = '<p><em>Error loading PCs.</em></p>';
    }
};

window.handleSelectCharacterForDetails = async function(charIdStr) {
    const characterProfileSection = window.getElem('character-profile-main-section');
    if (!charIdStr || charIdStr === "null") {
        appState.setCurrentProfileCharId(null);
        window.renderCharacterProfileUI(null, window.profileElementIds);
        if (characterProfileSection) characterProfileSection.classList.add('collapsed');
        return;
    }
    appState.setCurrentProfileCharId(charIdStr);
    try {
        const selectedCharFromServer = await window.fetchNpcDetails(charIdStr);
        const processedChar = appState.updateCharacterInList(selectedCharFromServer);

        window.renderCharacterProfileUI(processedChar, window.profileElementIds);
        if (characterProfileSection) characterProfileSection.classList.remove('collapsed');

        await window.fetchAndRenderHistoryFiles();
    } catch (error) {
        console.error("Error in handleSelectCharacterForDetails:", error);
        window.updateText('details-char-name', 'Error loading details');
        window.renderCharacterProfileUI(null, window.profileElementIds);
        if (characterProfileSection) characterProfileSection.classList.add('collapsed');
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
    const newCharData = { name, description, personality_traits: personality, character_type: type, linked_lore_ids: [] };
    try {
        const result = await window.createCharacterOnServer(newCharData);
        appState.updateCharacterInList(result.character);
        window.renderNpcListForContextUI(window.getElem('character-list-scene-tab'), appState.getAllCharacters(), appState.activeSceneNpcIds, window.handleToggleNpcInScene, window.handleSelectCharacterForDetails, appState.currentSceneContextFilter);
        window.renderAllNpcListForManagementUI(window.getElem('all-character-list-management'), appState.getAllCharacters(), window.handleSelectCharacterForDetails);
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
        const payload = {
            pc_faction_standings: {
                ...(appState.getCharacterById(npcId)?.pc_faction_standings || {}),
                [pcId]: newStandingValue
            }
        };
        const response = await window.updateCharacterOnServer(npcId, payload);
        if (response && response.character) {
            const updatedCharState = appState.updateCharacterInList(response.character);
            const currentProfileChar = appState.getCurrentProfileChar();
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

window.fetchAllLoreEntriesAndUpdateState = async function() {
    try {
        const loreEntries = await window.fetchAllLoreEntries();
        appState.setAllLoreEntries(loreEntries);
        window.renderLoreEntryListUI(appState.getAllLoreEntries());
        window.populateLoreEntrySelectForCharacterLinkingUI();
        window.populateSceneContextSelectorUI();
        window.populateSceneContextTypeFilterUI();
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
        appState.updateLoreEntryInList(result.lore_entry);
        window.renderLoreEntryListUI(appState.getAllLoreEntries());
        window.populateLoreEntrySelectForCharacterLinkingUI();
        window.populateSceneContextSelectorUI();

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
        appState.updateLoreEntryInList(result.lore_entry);
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
        appState.removeLoreEntryFromList(loreId);
        window.renderLoreEntryListUI(appState.getAllLoreEntries());
        window.populateLoreEntrySelectForCharacterLinkingUI();
        window.populateSceneContextSelectorUI();
        window.closeLoreDetailViewUI();

        const currentProfileCharId = appState.getCurrentProfileCharId();
        if(currentProfileCharId){
             const charData = appState.getCharacterById(currentProfileCharId);
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
        const updatedChar = appState.updateCharacterInList(result.character);
        window.renderCharacterProfileUI(updatedChar, window.profileElementIds);
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
        const updatedChar = appState.updateCharacterInList(result.character);
        window.renderCharacterProfileUI(updatedChar, window.profileElementIds);
        alert("Lore unlinked from character.");
    } catch (error) {
        console.error("Error unlinking lore:", error);
        alert(`Error unlinking lore: ${error.message}`);
    }
};

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
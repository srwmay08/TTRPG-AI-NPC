// static/apiService.js
// Responsibility: Handle all communications with the backend API.

async function fetchData(url, options = {}) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Unknown error structure" }));
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error || response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching data from ${url}:`, error);
        throw error;
    }
}

window.fetchCharactersFromServer = async function() {
    console.log("Fetching characters via apiService...");
    return fetchData(`${API_BASE_URL}/api/npcs`);
};

window.fetchNpcDetails = async function(npcId) {
    console.log(`Fetching details for char ID via apiService: ${npcId}`);
    return fetchData(`${API_BASE_URL}/api/npcs/${npcId}`);
};

window.generateNpcDialogue = async function(npcId, payload) {
    return fetchData(`${API_BASE_URL}/api/npcs/${npcId}/dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
};

window.saveCharacterNotes = async function(npcId, notes) {
    // This was the previous implementation, ensure backend matches or adjust
    return fetchData(`${API_BASE_URL}/api/npcs/${npcId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gm_notes: notes }) // Only sending gm_notes
    });
};
window.updateCharacterOnServer = async function(npcId, updatePayload) {
    return fetchData(`${API_BASE_URL}/api/npcs/${npcId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
    });
};


window.addMemoryToNpc = async function(npcId, memoryData) {
     return fetchData(`${API_BASE_URL}/api/npcs/${npcId}/memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memoryData)
    });
};

window.deleteNpcMemory = async function(npcId, memoryId) {
    return fetchData(`${API_BASE_URL}/api/npcs/${npcId}/memory/${memoryId}`, {
        method: 'DELETE'
    });
};

window.createCharacterOnServer = async function(characterData) {
    return fetchData(`${API_BASE_URL}/api/npcs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(characterData)
    });
};

window.fetchHistoryFilesFromServer = async function() {
    return fetchData(`${API_BASE_URL}/api/history_files`);
};

window.associateHistoryFileWithNpc = async function(npcId, fileName) {
    return fetchData(`${API_BASE_URL}/api/character/${npcId}/associate_history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history_file: fileName })
    });
};

window.dissociateHistoryFileFromNpc = async function(npcId, fileName) {
     return fetchData(`${API_BASE_URL}/api/character/${npcId}/dissociate_history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history_file: fileName })
    });
};

window.updateNpcFactionStanding = async function(npcId, pcId, standing) {
    const payload = { pc_faction_standings: { [pcId]: standing } };
    // This should send the entire character update, or backend needs to handle partial for just this
    // For now, assuming backend merges this field. A safer PUT might involve fetching current NPC data first.
    // Let's keep it simple as per previous characterService where it also called PUT on /api/npcs/{npcId}
    return fetchData(`${API_BASE_URL}/api/npcs/${npcId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
};
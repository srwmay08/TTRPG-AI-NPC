// apiService.js
// Responsibility: Handle all communications with the backend API.
// Assumes API_BASE_URL is globally available from config.js

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
        throw error; // Re-throw to be handled by the caller
    }
}

async function fetchCharactersFromServer() {
    console.log("Fetching characters via apiService...");
    return fetchData(`${API_BASE_URL}/api/npcs`);
}

async function fetchNpcDetails(npcId) {
    console.log(`Fetching details for char ID via apiService: ${npcId}`);
    return fetchData(`${API_BASE_URL}/api/npcs/${npcId}`);
}

async function generateNpcDialogue(npcId, payload) {
    return fetchData(`${API_BASE_URL}/api/npcs/${npcId}/dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

async function saveCharacterNotes(npcId, notes) {
    return fetchData(`${API_BASE_URL}/api/npcs/${npcId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gm_notes: notes })
    });
}

async function addMemoryToNpc(npcId, memoryData) {
     return fetchData(`${API_BASE_URL}/api/npcs/${npcId}/memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memoryData)
    });
}

async function deleteNpcMemory(npcId, memoryId) {
    return fetchData(`${API_BASE_URL}/api/npcs/${npcId}/memory/${memoryId}`, {
        method: 'DELETE'
    });
}

async function createCharacterOnServer(characterData) {
    return fetchData(`${API_BASE_URL}/api/npcs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(characterData)
    });
}

async function fetchHistoryFilesFromServer() {
    return fetchData(`${API_BASE_URL}/api/history_files`);
}

async function associateHistoryFileWithNpc(npcId, fileName) {
    return fetchData(`${API_BASE_URL}/api/character/${npcId}/associate_history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history_file: fileName })
    });
}

async function dissociateHistoryFileFromNpc(npcId, fileName) {
     return fetchData(`${API_BASE_URL}/api/character/${npcId}/dissociate_history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history_file: fileName })
    });
}

async function updateNpcFactionStanding(npcId, pcId, standing) {
    const payload = { pc_faction_standings: { [pcId]: standing } };
    return fetchData(`${API_BASE_URL}/api/npcs/${npcId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

// If using ES6 modules:
// export { fetchCharactersFromServer, fetchNpcDetails, ... };
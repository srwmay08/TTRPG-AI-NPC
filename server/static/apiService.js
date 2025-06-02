// static/apiService.js
// Responsibility: Handle all communications with the backend API.

var ApiService = (function() {
    // This is an internal helper function, not exposed on the ApiService object itself.
    async function _fetchData(url, options = {}) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Unknown error structure" }));
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error || response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`ApiService: Error fetching data from ${url}:`, error);
            throw error; // Re-throw to be handled by the caller
        }
    }

    // Public API methods
    return {
        fetchCharactersFromServer: async function() {
            console.log("ApiService: Fetching characters...");
            return _fetchData(`${API_BASE_URL}/api/npcs`);
        },

        fetchNpcDetails: async function(npcId) {
            console.log(`ApiService: Fetching details for char ID: ${npcId}`);
            return _fetchData(`${API_BASE_URL}/api/npcs/${npcId}`);
        },

        generateNpcDialogue: async function(npcId, payload) {
            return _fetchData(`${API_BASE_URL}/api/npcs/${npcId}/dialogue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        },

        updateCharacterOnServer: async function(npcId, updatePayload) {
            return _fetchData(`${API_BASE_URL}/api/npcs/${npcId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatePayload)
            });
        },

        addMemoryToNpc: async function(npcId, memoryData) {
             return _fetchData(`${API_BASE_URL}/api/npcs/${npcId}/memory`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(memoryData)
            });
        },

        deleteNpcMemory: async function(npcId, memoryId) {
            return _fetchData(`${API_BASE_URL}/api/npcs/${npcId}/memory/${memoryId}`, {
                method: 'DELETE'
            });
        },

        createCharacterOnServer: async function(characterData) {
            return _fetchData(`${API_BASE_URL}/api/npcs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(characterData)
            });
        },

        fetchHistoryFilesFromServer: async function() {
            return _fetchData(`${API_BASE_URL}/api/history_files`);
        },

        associateHistoryFileWithNpc: async function(npcId, fileName) {
            return _fetchData(`${API_BASE_URL}/api/character/${npcId}/associate_history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history_file: fileName })
            });
        },

        dissociateHistoryFileFromNpc: async function(npcId, fileName) {
             return _fetchData(`${API_BASE_URL}/api/character/${npcId}/dissociate_history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history_file: fileName })
            });
        },

        updateNpcFactionStanding: async function(npcId, pcId, standing) {
            const payload = { pc_faction_standings: { [pcId]: standing } };
            // Calls its own namespaced method
            return this.updateCharacterOnServer(npcId, payload);
        },

        fetchAllLoreEntries: async function() {
            return _fetchData(`${API_BASE_URL}/api/lore_entries`);
        },

        fetchLoreEntryDetails: async function(loreId) {
            return _fetchData(`${API_BASE_URL}/api/lore_entries/${loreId}`);
        },

        createLoreEntryOnServer: async function(loreData) {
            return _fetchData(`${API_BASE_URL}/api/lore_entries`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loreData)
            });
        },

        updateLoreEntryOnServer: async function(loreId, loreData) {
            return _fetchData(`${API_BASE_URL}/api/lore_entries/${loreId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loreData)
            });
        },

        deleteLoreEntryFromServer: async function(loreId) {
            return _fetchData(`${API_BASE_URL}/api/lore_entries/${loreId}`, {
                method: 'DELETE'
            });
        },

        linkLoreToCharacterOnServer: async function(charId, loreId) {
            return _fetchData(`${API_BASE_URL}/api/characters/${charId}/link_lore/${loreId}`, {
                method: 'POST'
            });
        },

        unlinkLoreFromCharacterOnServer: async function(charId, loreId) {
            return _fetchData(`${API_BASE_URL}/api/characters/${charId}/unlink_lore/${loreId}`, {
                method: 'POST'
            });
        }
    };
})();

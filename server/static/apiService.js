/**
 * static/apiService.js
 * 
 * Responsibility: Handle all communications with the backend Flask API.
 * Uses an Immediately Invoked Function Expression (IIFE) to create a singleton
 * pattern, keeping the internal `_fetchData` helper private while exposing
 * the structured API methods.
 */

var ApiService = (function() {
    
    /**
     * Internal generic fetch wrapper. 
     * Automatically handles JSON parsing, unwraps standard server responses, and standardizes HTTP error throwing.
     * @param {string} url - The API endpoint to hit.
     * @param {Object} options - Fetch options (method, headers, body).
     * @returns {Promise<Object>} The parsed data response.
     */
    async function _fetchData(url, options = {}) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                // Attempt to parse backend error payload, fallback to status text if it fails
                const errorData = await response.json().catch(() => ({ error: "Unknown error structure" }));
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error || response.statusText}`);
            }
            const json = await response.json();
            
            // --- UNWRAP STANDARD RESPONSE WRAPPER ---
            // If the backend wraps payloads as { success: true, data: ... }, extract .data automatically 
            // unless it's a raw array (like list endpoints).
            if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
                return json.data;
            }
            return json;
        } catch (error) {
            console.error(`ApiService: Error fetching data from ${url}:`, error);
            throw error; // Re-throw to be handled and displayed by the calling UI component
        }
    }

    // Publicly exposed API methods mapped directly to backend Flask routes
    return {
        /** Retrieves all NPC and PC documents from MongoDB. */
        fetchCharactersFromServer: async function() {
            console.log("ApiService: Fetching characters...");
            return _fetchData(`${API_BASE_URL}/api/npcs`);
        },

        /** Retrieves a specific character document by its MongoDB ObjectId. */
        fetchNpcDetails: async function(npcId) {
            console.log(`ApiService: Fetching details for char ID: ${npcId}`);
            return _fetchData(`${API_BASE_URL}/api/npcs/${npcId}`);
        },

        /** Submits the current scene context and dialogue history to trigger the GenAI engine. */
        generateNpcDialogue: async function(npcId, payload) {
            return _fetchData(`${API_BASE_URL}/api/npcs/${npcId}/dialogue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        },

        /** Pushes partial updates (like GM notes or edited attributes) to a character document. */
        updateCharacterOnServer: async function(npcId, updatePayload) {
            return _fetchData(`${API_BASE_URL}/api/npcs/${npcId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatePayload)
            });
        },

        /** Appends a new manual or AI-generated memory object to the character's memory array. */
        addMemoryToNpc: async function(npcId, memoryData) {
             return _fetchData(`${API_BASE_URL}/api/npcs/${npcId}/memory`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(memoryData)
            });
        },

        /** Removes a specific memory object from a character using its unique UUID. */
        deleteNpcMemory: async function(npcId, memoryId) {
            return _fetchData(`${API_BASE_URL}/api/npcs/${npcId}/memory/${memoryId}`, {
                method: 'DELETE'
            });
        },

        /** Creates a brand new character document from the frontend form. */
        createCharacterOnServer: async function(characterData) {
            return _fetchData(`${API_BASE_URL}/api/npcs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(characterData)
            });
        },

        /** Scans the backend history folder and returns a list of available .txt files. */
        fetchHistoryFilesFromServer: async function() {
            return _fetchData(`${API_BASE_URL}/api/history_files`);
        },

        /** Binds a specific history .txt file to a character for deep context inclusion. */
        associateHistoryFileWithNpc: async function(npcId, fileName) {
            return _fetchData(`${API_BASE_URL}/api/character/${npcId}/associate_history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history_file: fileName })
            });
        },

        /** Unbinds a specific history .txt file from a character. */
        dissociateHistoryFileFromNpc: async function(npcId, fileName) {
             return _fetchData(`${API_BASE_URL}/api/character/${npcId}/dissociate_history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history_file: fileName })
            });
        },

        /** Updates the specific disposition value an NPC holds toward a targeted PC. */
        updateNpcFactionStanding: async function(npcId, pcId, standing) {
            const payload = { pc_faction_standings: { [pcId]: standing } };
            return this.updateCharacterOnServer(npcId, payload);
        },

        /** Retrieves all structured LoreEntry documents from the database. */
        fetchAllLoreEntries: async function() {
            return _fetchData(`${API_BASE_URL}/api/lore_entries`);
        },

        /** Retrieves a specific LoreEntry document by its MongoDB ObjectId. */
        fetchLoreEntryDetails: async function(loreId) {
            return _fetchData(`${API_BASE_URL}/api/lore_entries/${loreId}`);
        },

        /** Creates a new LoreEntry document from the frontend form. */
        createLoreEntryOnServer: async function(loreData) {
            return _fetchData(`${API_BASE_URL}/api/lore_entries`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loreData)
            });
        },

        /** Modifies an existing LoreEntry document (e.g., updating GM notes). */
        updateLoreEntryOnServer: async function(loreId, loreData) {
            return _fetchData(`${API_BASE_URL}/api/lore_entries/${loreId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loreData)
            });
        },

        /** Deletes a LoreEntry document from the database entirely. */
        deleteLoreEntryFromServer: async function(loreId) {
            return _fetchData(`${API_BASE_URL}/api/lore_entries/${loreId}`, {
                method: 'DELETE'
            });
        },

        /** Injects a lore reference ID into a character's context array. */
        linkLoreToCharacterOnServer: async function(charId, loreId) {
            return _fetchData(`${API_BASE_URL}/api/characters/${charId}/link_lore/${loreId}`, {
                method: 'POST'
            });
        },

        /** Removes a lore reference ID from a character's context array. */
        unlinkLoreFromCharacterOnServer: async function(charId, loreId) {
            return _fetchData(`${API_BASE_URL}/api/characters/${charId}/unlink_lore/${loreId}`, {
                method: 'POST'
            });
        }
    };
})();
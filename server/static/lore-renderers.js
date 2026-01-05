/* server/static/lore-renderers.js */
// Responsibility: Rendering Lore related UI elements.

var LoreRenderers = {
    populateLoreTypeDropdownUI: function() {
        const selectElement = Utils.getElem('new-lore-type');
        if (!selectElement) { console.warn("LoreRenderers.populateLoreTypeDropdownUI: 'new-lore-type' select element not found."); return; }
        selectElement.innerHTML = '';
        // LORE_TYPES is assumed to be globally available or from config.js
        if (typeof LORE_TYPES !== 'undefined' && Array.isArray(LORE_TYPES)) {
            LORE_TYPES.forEach(type => {
                const option = document.createElement('option'); option.value = type; option.textContent = type; selectElement.appendChild(option);
            });
        } else { console.error("LORE_TYPES is not defined or not an array in config.js"); selectElement.innerHTML = '<option value="">Error: Types not loaded</option>'; }
    },

    renderLoreEntryListUI: function(loreEntries) {
        const listContainer = Utils.getElem('lore-entry-list');
        if (!listContainer) { console.warn("LoreRenderers.renderLoreEntryListUI: 'lore-entry-list' ul element not found."); return; }
        listContainer.innerHTML = '';
        
        if (!loreEntries || loreEntries.length === 0) { 
            listContainer.innerHTML = '<li><em>No lore entries. Create one.</em></li>'; 
            return; 
        }
        
        const sortedLoreEntries = [...loreEntries].sort((a, b) => a.name.localeCompare(b.name));
        
        // Get currently selected ID to highlight
        const currentId = window.AppState ? window.AppState.getCurrentLoreEntryId() : null;

        sortedLoreEntries.forEach(entry => {
            const li = document.createElement('li');
            const idToUse = String(entry.lore_id || entry._id);
            li.dataset.loreId = idToUse;
            
            // Style as clickable row
            li.style.cursor = 'pointer';
            li.style.display = 'flex';
            li.style.alignItems = 'center';
            li.style.padding = '8px 10px';

            if (currentId === idToUse) {
                li.classList.add('selected'); // Uses existing CSS for selection highlight
            }
            
            // Content
            const nameSpan = document.createElement('span');
            nameSpan.textContent = `${entry.name} (${entry.lore_type})`;
            nameSpan.className = 'lore-entry-name-clickable'; 
            nameSpan.style.flex = '1';
            
            // Row Click Handler -> Calls App.handleSelectLoreEntry
            li.onclick = (e) => {
                e.stopPropagation();
                if(window.App && App.handleSelectLoreEntry) {
                    App.handleSelectLoreEntry(idToUse);
                }
            };
            
            li.appendChild(nameSpan);
            listContainer.appendChild(li);
        });
    },

    // --- NEW: Renders Lore into the Right Column (Profile View) ---
    renderLoreProfileUI: function(loreEntry) {
        console.group("--- [DEBUG] LoreRenderers.renderLoreProfileUI ---");
        
        // Reuse the NPC profile view container for Lore details
        const profileContainer = document.getElementById('npc-profile-view');

        if (!loreEntry) {
            if(profileContainer) profileContainer.innerHTML = '<p>No Lore Entry Selected</p>';
            console.groupEnd();
            return;
        }

        if (!profileContainer) {
            console.error("ERROR: 'npc-profile-view' container not found (used for Lore display).");
            console.groupEnd();
            return;
        }

        console.log("Rendering Lore:", loreEntry.name);

        // Build HTML
        let html = `
            <div class="npc-profile-sheet" style="border-top: 4px solid var(--accent-color);">
                <div class="profile-header">
                    <h2>${Utils.escapeHtml(loreEntry.name)}</h2>
                    <span class="char-type-badge">${Utils.escapeHtml(loreEntry.lore_type)}</span>
                </div>
                
                <div class="profile-section">
                    <h4>Description</h4>
                    <p>${Utils.escapeHtml(loreEntry.description || 'No description available.')}</p>
                </div>`;

        // Key Facts (if any)
        if (loreEntry.key_facts && loreEntry.key_facts.length > 0) {
            html += `
                <div class="profile-section">
                    <h4>Key Facts</h4>
                    <ul>
                        ${loreEntry.key_facts.map(fact => `<li>${Utils.escapeHtml(fact)}</li>`).join('')}
                    </ul>
                </div>`;
        }

        // GM Notes (Editable)
        html += `
                <div class="profile-section collapsible-section">
                    <h4 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')">GM Notes <span class="arrow-indicator">▼</span></h4>
                    <div class="collapsible-content">
                        <textarea id="details-lore-gm-notes" rows="6" class="full-width-textarea" placeholder="Private notes for the GM.">${Utils.escapeHtml(loreEntry.gm_notes || '')}</textarea>
                        <div class="control-row" style="margin-top: 10px;">
                            <button id="save-lore-gm-notes-btn">Save Notes</button>
                            <button id="delete-lore-btn" style="background-color: #dc3545; margin-left: auto;">Delete Entry</button>
                        </div>
                    </div>
                </div>
            </div>`;

        profileContainer.innerHTML = html;

        // Attach Event Listeners
        const saveBtn = document.getElementById('save-lore-gm-notes-btn');
        if (saveBtn) {
            saveBtn.onclick = () => {
                 CharacterService.handleUpdateLoreEntryGmNotes(loreEntry.lore_id || loreEntry._id, document.getElementById('details-lore-gm-notes').value);
            };
        }

        const deleteBtn = document.getElementById('delete-lore-btn');
        if (deleteBtn) {
            deleteBtn.onclick = () => CharacterService.handleDeleteLoreEntry(loreEntry.lore_id || loreEntry._id);
        }

        console.groupEnd();
    },

    // Legacy sidebar renderer (kept empty or redirecting if needed, but 'renderLoreProfileUI' now takes precedence in the new view logic)
    renderLoreEntryDetailUI: function(loreEntry) {
       // This function is effectively replaced by renderLoreProfileUI in the new 'Lore View' layout.
       // However, we can leave it or log that it's deprecated.
       console.log("LoreRenderers.renderLoreEntryDetailUI: Legacy call. Use renderLoreProfileUI with MainView instead.");
    },

    closeLoreDetailViewUI: function() {
        if (window.AppState) appState.setCurrentLoreEntryId(null);
    },

    populateLoreEntrySelectForCharacterLinkingUI: function(alreadyLinkedNames = []) {
        const selectElement = Utils.getElem('lore-entry-select-for-character');
        // SILENT RETURN if element not found to prevent console spam during initial renders or hidden states
        if (!selectElement) { return; }
        
        // appState is assumed to be globally available
        const currentCharacter = appState.getCurrentProfileChar();
        const linkButton = Utils.getElem('link-lore-to-char-btn');
        if (!currentCharacter) { selectElement.innerHTML = '<option value="">-- Select char first --</option>'; selectElement.disabled = true; if(linkButton) Utils.disableBtn('link-lore-to-char-btn', true); return; }
        selectElement.disabled = false; if(linkButton) Utils.disableBtn('link-lore-to-char-btn', false);
        const currentValue = selectElement.value;
        selectElement.innerHTML = '<option value="">-- Select lore --</option>';
        const allLore = appState.getAllLoreEntries();
        const linkedNameSet = new Set(alreadyLinkedNames || []);
        allLore.sort((a,b)=> a.name.localeCompare(b.name)).forEach(lore => {
            const idToUse = String(lore.lore_id || lore._id);
            if (!linkedNameSet.has(lore.name)) {
                const option = document.createElement('option'); option.value = idToUse; option.textContent = `${lore.name} (${lore.lore_type})`; selectElement.appendChild(option);
            }
        });
        if (allLore.some(l => String(l.lore_id || l._id) === currentValue) && !linkedNameSet.has(appState.getLoreEntryById(currentValue)?.name)) {
            selectElement.value = currentValue; 
        }
    },

    renderAssociatedLoreForCharacterUI: function(character, unlinkCallback) {
        // CharacterService is assumed to be globally available
        const listElement = Utils.getElem(CharacterService.profileElementIds.associatedLoreListForCharacter);
        // SILENT RETURN
        if (!listElement) { return; }
        
        listElement.innerHTML = '';
        if (character && character.linked_lore_by_name && character.linked_lore_by_name.length > 0) {
            // appState is assumed to be globally available
            character.linked_lore_by_name.forEach(loreName => {
                const loreEntry = appState.getAllLoreEntries().find(l => l.name === loreName);
                if (loreEntry) {
                    const loreId = loreEntry.lore_id || loreEntry._id;
                    const li = document.createElement('li'); li.className = 'associated-lore-item';
                    li.innerHTML = `<span>${loreEntry.name} (${loreEntry.lore_type})</span><button data-lore-id="${loreId}" class="unlink-lore-btn">Unlink</button>`;
                    li.querySelector('button').onclick = () => unlinkCallback(loreId); 
                    listElement.appendChild(li);
                } else { 
                    const li = document.createElement('li'); 
                    li.textContent = `Linked Lore: ${loreName} (Details not found)`; 
                    listElement.appendChild(li);
                }
            });
        } else { listElement.innerHTML = '<li><em>No lore associated.</em></li>'; }
    },

    populateSceneContextTypeFilterUI: function() {
        const selector = Utils.getElem('scene-context-type-filter');
        if (!selector) { console.warn("LoreRenderers.populateSceneContextTypeFilterUI: Scene context type filter not found."); return; }
        selector.innerHTML = '<option value="">-- All Relevant Lore Types --</option>';
        // LORE_TYPES is assumed to be globally available or from config.js
        const relevantLoreTypes = [LORE_TYPES[0], LORE_TYPES[1]];
        relevantLoreTypes.forEach(type => {
            const option = document.createElement('option'); option.value = type; option.textContent = type; selector.appendChild(option);
        });
    },

    populateSceneContextSelectorUI: function() {
        const typeFilterSelector = Utils.getElem('scene-context-type-filter');
        const entrySelector = Utils.getElem('scene-context-selector');
        if (!entrySelector || !typeFilterSelector) { console.warn("LoreRenderers.populateSceneContextSelectorUI: Scene context selectors not found."); return; }

        const selectedLoreType = typeFilterSelector.value;
        const currentValue = entrySelector.value;
        entrySelector.innerHTML = '<option value="">-- Select Specific Context --</option>';

        // appState is assumed to be globally available
        let loreToDisplay = appState.getAllLoreEntries();
        // LORE_TYPES is assumed to be globally available or from config.js
        const defaultRelevantTypes = [LORE_TYPES[0], LORE_TYPES[1]];

        if (selectedLoreType) {
            loreToDisplay = loreToDisplay.filter(lore => lore.lore_type === selectedLoreType);
        } else {
            loreToDisplay = loreToDisplay.filter(lore => defaultRelevantTypes.includes(lore.lore_type));
        }

        loreToDisplay
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(lore => {
                const option = document.createElement('option');
                const idToUse = lore.lore_id || lore._id;
                option.value = String(idToUse);
                option.textContent = `${lore.name} (${lore.lore_type})`;
                entrySelector.appendChild(option);
            });

        if (loreToDisplay.some(l => String(l.lore_id || l._id) === currentValue)) {
            entrySelector.value = currentValue;
        } else {
            entrySelector.value = "";
            if(appState.currentSceneContextFilter?.id !== null && typeof appState.currentSceneContextFilter?.id !== 'undefined' && appState.currentSceneContextFilter?.id !== ""){
                appState.currentSceneContextFilter = null;
                // NPCRenderers is assumed to be globally available
                NPCRenderers.renderNpcListForContextUI(
                    Utils.getElem('character-list-scene-tab'),
                    appState.getAllCharacters(),
                    appState.activeSceneNpcIds,
                    App.handleToggleNpcInScene, // App is assumed to be globally available
                    CharacterService.handleSelectCharacterForDetails, // CharacterService is assumed to be globally available
                    null
                );
            }
        }
    },

    renderLocationDashboardUI: function(loreEntry, allCharacters, containerElement) {
        if (!containerElement) {
            console.error("LoreRenderers.renderLocationDashboardUI: containerElement not found.");
            return;
        }
        if (!loreEntry) {
            containerElement.innerHTML = `<p class="pc-dashboard-no-selection">No location context selected.</p>`;
            return;
        }
    
        const linkedNpcs = allCharacters.filter(char =>
            char.character_type === 'NPC' &&
            char.linked_lore_by_name &&
            char.linked_lore_by_name.includes(loreEntry.name)
        );
    
        let contentHTML = `<div class="location-dashboard-content">`;
        contentHTML += `<h2>${Utils.escapeHtml(loreEntry.name)}</h2>`;
        contentHTML += `<p class="location-description"><em>(${Utils.escapeHtml(loreEntry.lore_type)})</em></p>`;
        contentHTML += `<p class="location-description">${Utils.escapeHtml(loreEntry.description)}</p>`;
        
        if (loreEntry.key_facts && loreEntry.key_facts.length > 0) {
            contentHTML += `<h4>Key Facts</h4><ul>`;
            loreEntry.key_facts.forEach(fact => {
                contentHTML += `<li>${Utils.escapeHtml(fact)}</li>`;
            });
            contentHTML += `</ul>`;
        }
    
        contentHTML += `<hr>`;
        contentHTML += `<h4>Known NPCs Present</h4>`;
    
        if (linkedNpcs.length > 0) {
            contentHTML += `<div class="character-list">`;
            linkedNpcs.forEach(npc => {
                // NPCRenderers is assumed to be globally available
                contentHTML += NPCRenderers.generateNpcCardHTML(npc);
            });
            contentHTML += `</div>`;
        } else {
            contentHTML += `<p><em>No NPCs are currently known to be associated with this location.</em></p>`;
        }
        
        contentHTML += `<hr>`;
        contentHTML += `<h4>Suggested NPCs</h4>`;
        contentHTML += `<p><em>(This feature has not yet been implemented.)</em></p>`;
    
        contentHTML += `</div>`;
        containerElement.innerHTML = contentHTML;
    }
};
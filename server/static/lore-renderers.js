/**
 * server/static/lore-renderers.js
 * 
 * Responsibility: Rendering Lore and Worldbuilding related UI elements.
 * This object contains methods for populating dropdowns with dynamic lore data,
 * building the lore sidebar list, and generating the detailed Lore Profile view.
 */

var LoreRenderers = {
    /**
     * Injects the standard lore categories (Location, Faction, etc.) into the creation form dropdown.
     */
    populateLoreTypeDropdownUI: function() {
        const selectElement = Utils.getElem('new-lore-type');
        if (!selectElement) { 
            console.warn("LoreRenderers.populateLoreTypeDropdownUI: 'new-lore-type' select element not found."); 
            return; 
        }
        
        selectElement.innerHTML = '';
        
        // Ensure the global LORE_TYPES constant is available before iterating
        if (typeof LORE_TYPES !== 'undefined' && Array.isArray(LORE_TYPES)) {
            LORE_TYPES.forEach(type => {
                const option = document.createElement('option'); 
                option.value = type; 
                option.textContent = type; 
                selectElement.appendChild(option);
            });
        } else { 
            console.error("LORE_TYPES is not defined or not an array in config.js"); 
            selectElement.innerHTML = '<option value="">Error: Types not loaded</option>'; 
        }
    },

    /**
     * Builds the left-sidebar list of all available Lore entries.
     * @param {Array<Object>} loreEntries - The array of lore documents from the backend.
     */
    renderLoreEntryListUI: function(loreEntries) {
        const listContainer = Utils.getElem('lore-entry-list');
        if (!listContainer) { 
            console.warn("LoreRenderers.renderLoreEntryListUI: 'lore-entry-list' ul element not found."); 
            return; 
        }
        
        listContainer.innerHTML = '';
        
        // Handle empty state gracefully
        if (!loreEntries || loreEntries.length === 0) { 
            listContainer.innerHTML = '<li><em>No lore entries. Create one.</em></li>'; 
            return; 
        }
        
        // Create a new array and sort it alphabetically by name to avoid mutating the original state
        const sortedLoreEntries = [...loreEntries].sort((a, b) => a.name.localeCompare(b.name));
        
        // Retrieve the currently active lore ID so we can highlight it in the list
        const currentId = window.AppState ? window.AppState.getCurrentLoreEntryId() : null;

        sortedLoreEntries.forEach(entry => {
            const li = document.createElement('li');
            const idToUse = String(entry.lore_id || entry._id);
            li.dataset.loreId = idToUse;
            
            // Apply inline styles to turn the row into a clickable flex container
            li.style.cursor = 'pointer';
            li.style.display = 'flex';
            li.style.alignItems = 'center';
            li.style.padding = '8px 10px';

            // Visually highlight the row if it matches the current global state
            if (currentId === idToUse) {
                li.classList.add('selected'); 
            }
            
            // Construct the display name appended with its structural category
            const nameSpan = document.createElement('span');
            nameSpan.textContent = `${entry.name} (${entry.lore_type})`;
            nameSpan.className = 'lore-entry-name-clickable'; 
            nameSpan.style.flex = '1';
            
            // Bind the click event to the main App controller to route the view
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

    /**
     * Dynamically builds the detailed HTML profile for a specific Lore Entry 
     * and renders it into the main right-hand content pane.
     * @param {Object} loreEntry - The target lore document.
     */
    renderLoreProfileUI: function(loreEntry) {
        console.group("--- [DEBUG] LoreRenderers.renderLoreProfileUI ---");
        
        // We reuse the existing NPC profile container for Lore details to simplify the DOM
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

        // Construct the Header and core Description blocks
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

        // Render Key Facts as a bulleted list if any exist
        if (loreEntry.key_facts && loreEntry.key_facts.length > 0) {
            html += `
                <div class="profile-section">
                    <h4>Key Facts</h4>
                    <ul>
                        ${loreEntry.key_facts.map(fact => `<li>${Utils.escapeHtml(fact)}</li>`).join('')}
                    </ul>
                </div>`;
        }

        // Render an editable GM Notes text area within a collapsible accordion
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

        // Push constructed HTML into the DOM
        profileContainer.innerHTML = html;

        // Re-attach event listeners to the newly minted buttons
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

    /**
     * Legacy sidebar renderer. Left in place to prevent exceptions if older logic calls it,
     * but delegates to the new profile viewer.
     */
    renderLoreEntryDetailUI: function(loreEntry) {
       console.log("LoreRenderers.renderLoreEntryDetailUI: Legacy call. Use renderLoreProfileUI with MainView instead.");
    },

    /** Wipes the current lore selection from global state. */
    closeLoreDetailViewUI: function() {
        if (window.AppState) appState.setCurrentLoreEntryId(null);
    },

    /**
     * Populates the `<select>` element within a Character's profile that allows
     * the GM to link a specific lore entry to that character.
     * @param {Array<string>} alreadyLinkedNames - Lore names that should be excluded from the dropdown.
     */
    populateLoreEntrySelectForCharacterLinkingUI: function(alreadyLinkedNames = []) {
        const selectElement = Utils.getElem('lore-entry-select-for-character');
        // Fail silently if the element isn't currently rendered in the DOM
        if (!selectElement) { return; }
        
        const currentCharacter = appState.getCurrentProfileChar();
        const linkButton = Utils.getElem('link-lore-to-char-btn');
        
        // Disable controls if no character is currently selected
        if (!currentCharacter) { 
            selectElement.innerHTML = '<option value="">-- Select char first --</option>'; 
            selectElement.disabled = true; 
            if(linkButton) Utils.disableBtn('link-lore-to-char-btn', true); 
            return; 
        }
        
        selectElement.disabled = false; 
        if(linkButton) Utils.disableBtn('link-lore-to-char-btn', false);
        
        const currentValue = selectElement.value;
        selectElement.innerHTML = '<option value="">-- Select lore --</option>';
        
        const allLore = appState.getAllLoreEntries();
        const linkedNameSet = new Set(alreadyLinkedNames || []);
        
        // Sort and populate options, ignoring those already linked
        allLore.sort((a,b)=> a.name.localeCompare(b.name)).forEach(lore => {
            const idToUse = String(lore.lore_id || lore._id);
            if (!linkedNameSet.has(lore.name)) {
                const option = document.createElement('option'); 
                option.value = idToUse; 
                option.textContent = `${lore.name} (${lore.lore_type})`; 
                selectElement.appendChild(option);
            }
        });
        
        // Attempt to restore previous selection if it's still valid
        if (allLore.some(l => String(l.lore_id || l._id) === currentValue) && !linkedNameSet.has(appState.getLoreEntryById(currentValue)?.name)) {
            selectElement.value = currentValue; 
        }
    },

    /**
     * Renders the list of Lore entries already associated with the currently viewed character.
     * Includes buttons allowing the user to unlink them.
     */
    renderAssociatedLoreForCharacterUI: function(character, unlinkCallback) {
        const listElement = Utils.getElem(CharacterService.profileElementIds.associatedLoreListForCharacter);
        if (!listElement) { return; }
        
        listElement.innerHTML = '';
        
        if (character && character.linked_lore_by_name && character.linked_lore_by_name.length > 0) {
            character.linked_lore_by_name.forEach(loreName => {
                const loreEntry = appState.getAllLoreEntries().find(l => l.name === loreName);
                if (loreEntry) {
                    const loreId = loreEntry.lore_id || loreEntry._id;
                    const li = document.createElement('li'); 
                    li.className = 'associated-lore-item';
                    li.innerHTML = `<span>${loreEntry.name} (${loreEntry.lore_type})</span><button data-lore-id="${loreId}" class="unlink-lore-btn">Unlink</button>`;
                    
                    // Bind the specific lore ID to the unlink button callback
                    li.querySelector('button').onclick = () => unlinkCallback(loreId); 
                    listElement.appendChild(li);
                } else { 
                    // Handle edge case where a character's linked lore string no longer exists in the DB
                    const li = document.createElement('li'); 
                    li.textContent = `Linked Lore: ${loreName} (Details not found)`; 
                    listElement.appendChild(li);
                }
            });
        } else { 
            listElement.innerHTML = '<li><em>No lore associated.</em></li>'; 
        }
    },

    /** Populates the overarching category filter for the Scene setup. */
    populateSceneContextTypeFilterUI: function() {
        const selector = Utils.getElem('scene-context-type-filter');
        if (!selector) { 
            console.warn("LoreRenderers.populateSceneContextTypeFilterUI: Scene context type filter not found."); 
            return; 
        }
        
        selector.innerHTML = '<option value="">-- All Relevant Lore Types --</option>';
        
        // Defaults to just Location and Faction types as they are most relevant for scene context
        const relevantLoreTypes = [LORE_TYPES[0], LORE_TYPES[1]];
        relevantLoreTypes.forEach(type => {
            const option = document.createElement('option'); 
            option.value = type; 
            option.textContent = type; 
            selector.appendChild(option);
        });
    },

    /**
     * Populates the specific Scene Context dropdown based on the selected Type Filter.
     */
    populateSceneContextSelectorUI: function() {
        const typeFilterSelector = Utils.getElem('scene-context-type-filter');
        const entrySelector = Utils.getElem('scene-context-selector');
        if (!entrySelector || !typeFilterSelector) { 
            console.warn("LoreRenderers.populateSceneContextSelectorUI: Scene context selectors not found."); 
            return; 
        }

        const selectedLoreType = typeFilterSelector.value;
        const currentValue = entrySelector.value;
        entrySelector.innerHTML = '<option value="">-- Select Specific Context --</option>';

        let loreToDisplay = appState.getAllLoreEntries();
        const defaultRelevantTypes = [LORE_TYPES[0], LORE_TYPES[1]];

        // Filter the dataset based on the parent dropdown's state
        if (selectedLoreType) {
            loreToDisplay = loreToDisplay.filter(lore => lore.lore_type === selectedLoreType);
        } else {
            loreToDisplay = loreToDisplay.filter(lore => defaultRelevantTypes.includes(lore.lore_type));
        }

        // Build and sort the specific options
        loreToDisplay
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(lore => {
                const option = document.createElement('option');
                const idToUse = lore.lore_id || lore._id;
                option.value = String(idToUse);
                option.textContent = `${lore.name} (${lore.lore_type})`;
                entrySelector.appendChild(option);
            });

        // Restore state or clear and trigger a downstream re-render of the NPC list
        if (loreToDisplay.some(l => String(l.lore_id || l._id) === currentValue)) {
            entrySelector.value = currentValue;
        } else {
            entrySelector.value = "";
            if(appState.currentSceneContextFilter?.id !== null && typeof appState.currentSceneContextFilter?.id !== 'undefined' && appState.currentSceneContextFilter?.id !== ""){
                appState.currentSceneContextFilter = null;
                NPCRenderers.renderNpcListForContextUI(
                    Utils.getElem('character-list-scene-tab'),
                    appState.getAllCharacters(),
                    appState.activeSceneNpcIds,
                    App.handleToggleNpcInScene, 
                    CharacterService.handleSelectCharacterForDetails, 
                    null
                );
            }
        }
    },

    /**
     * Renders a specific dashboard view for a Location type lore entry,
     * highlighting the NPCs known to be associated with that location.
     */
    renderLocationDashboardUI: function(loreEntry, allCharacters, containerElement) {
        if (!containerElement) {
            console.error("LoreRenderers.renderLocationDashboardUI: containerElement not found.");
            return;
        }
        if (!loreEntry) {
            containerElement.innerHTML = `<p class="pc-dashboard-no-selection">No location context selected.</p>`;
            return;
        }
    
        // Cross-reference all NPCs to see who has this lore name in their linked arrays
        const linkedNpcs = allCharacters.filter(char =>
            char.character_type === 'NPC' &&
            char.linked_lore_by_name &&
            char.linked_lore_by_name.includes(loreEntry.name)
        );
    
        // Construct the location summary
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
    
        // Render associated NPCs as cards
        if (linkedNpcs.length > 0) {
            contentHTML += `<div class="character-list">`;
            linkedNpcs.forEach(npc => {
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
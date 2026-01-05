// static/npc-renderers.js
// Responsibility: Rendering Non-Player Character (NPC) related UI elements.

var NPCRenderers = {
    renderNpcListForContextUI: function(listContainerElement, allCharacters, activeSceneNpcIds, onToggleInSceneCallback, onNameClickCallback, sceneContextFilter) {
        if (!listContainerElement) {
            console.error("NPCRenderers.renderNpcListForContextUI: listContainerElement not found");
            return;
        }
        let ul = listContainerElement.querySelector('ul');
        if (!ul) {
            ul = document.createElement('ul');
            listContainerElement.appendChild(ul);
        }
        ul.innerHTML = '';
    
        let npcsToDisplay = allCharacters.filter(char => char.character_type === 'NPC');
    
        // appState is assumed to be globally available
        if (sceneContextFilter && sceneContextFilter.id) {
            const loreContextEntry = appState.getLoreEntryById(sceneContextFilter.id);
            if (loreContextEntry) {
                const loreName = loreContextEntry.name;
                npcsToDisplay = npcsToDisplay.filter(npc =>
                    npc.linked_lore_by_name && npc.linked_lore_by_name.includes(loreName)
                );
            } else {
                npcsToDisplay = []; // Lore not found, show no NPCs
            }
        }
    
        npcsToDisplay.sort((a, b) => a.name.localeCompare(b.name));
    
        if (npcsToDisplay.length === 0) {
            if (sceneContextFilter && sceneContextFilter.id) {
                ul.innerHTML = '<li><p><em>No NPCs are linked to this specific context.</em></p></li>';
            } else {
                ul.innerHTML = '<li><p><em>No NPCs available.</em></p></li>';
            }
            return;
        }
    
        npcsToDisplay.forEach(char => {
            const charIdStr = String(char._id);
            const li = document.createElement('li');
            li.dataset.charId = charIdStr;
            
            // --- STYLING & INTERACTION ---
            li.style.display = 'flex';
            li.style.alignItems = 'center';
            li.style.justifyContent = 'space-between';
            li.style.cursor = 'pointer'; // Make whole row look clickable
            
            const isActive = activeSceneNpcIds.has(charIdStr);

            // Visual feedback for "Active in Scene"
            if (isActive) {
                li.classList.add('active-in-scene');
                li.style.backgroundColor = '#e2e6ea'; // Light highlight
            }

            // 1. CLICK HANDLER (Toggle Scene)
            // Clicking the row toggles the scene presence
            li.onclick = async (event) => {
                console.log("[DEBUG] NPC Row Clicked (Toggle Scene):", char.name);
                await onToggleInSceneCallback(charIdStr, char.name);
            };

            // 2. NAME DISPLAY
            const nameSpan = document.createElement('span');
            nameSpan.className = 'npc-name-clickable'; // Retain class for layout consistency
            nameSpan.style.flex = '1';
            nameSpan.style.padding = '8px'; // Add padding for easier clicking
            nameSpan.textContent = char.name;

            if (isActive) {
                nameSpan.style.fontWeight = 'bold';
                const checkMark = document.createElement('span');
                checkMark.textContent = ' ✔';
                checkMark.style.color = '#28a745';
                checkMark.style.fontWeight = 'bold';
                nameSpan.appendChild(checkMark);
            }
            
            // 3. PROFILE BUTTON (View Details)
            // Small button to view profile without toggling scene
            const profileBtn = document.createElement('button');
            profileBtn.textContent = 'Profile'; 
            profileBtn.style.fontSize = '0.75rem';
            profileBtn.style.padding = '2px 6px';
            profileBtn.style.marginRight = '5px';
            profileBtn.title = "View Character Profile";
            
            profileBtn.onclick = async (event) => {
                event.stopPropagation(); // Stop the row click (scene toggle) from firing
                console.log("[DEBUG] NPC Profile Clicked:", char.name);
                await onNameClickCallback(charIdStr);
            };
    
            li.appendChild(nameSpan);
            li.appendChild(profileBtn);
            ul.appendChild(li);
        });
    },

    renderAllNpcListForManagementUI: function(listContainerElement, allCharacters, onNameClickCallback) {
        if (!listContainerElement) { console.error("NPCRenderers.renderAllNpcListForManagementUI: listContainerElement not found"); return; }
        let ul = listContainerElement.querySelector('ul');
        if (!ul) {
            ul = document.createElement('ul');
            listContainerElement.appendChild(ul);
        }
        ul.innerHTML = '';
        const npcs = allCharacters.filter(char => char.character_type === 'NPC').sort((a, b) => a.name.localeCompare(b.name));

        if (npcs.length === 0) {
            ul.innerHTML = '<li><p><em>No NPCs created yet. Use the "Create New Character" form below.</em></p></li>';
            return;
        }
        npcs.forEach(char => {
            const charIdStr = String(char._id);
            const li = document.createElement('li');
            li.dataset.charId = charIdStr;

            const nameSpan = document.createElement('span');
            nameSpan.textContent = char.name;
            nameSpan.className = 'npc-name-clickable';
            nameSpan.onclick = () => {
                console.log("[DEBUG] NPC Name Clicked (Management Tab):", char.name);
                onNameClickCallback(charIdStr);
            };

            li.appendChild(nameSpan);
            ul.appendChild(li);
        });
    },

    createNpcDialogueAreaUI: function(npcCharacter, containerElement) {
        if (!npcCharacter || !containerElement) return;

        const npcIdStr = String(npcCharacter._id);
        const npcName = npcCharacter.name;
        const npcDescription = npcCharacter.description || 'No description available.';

        if (Utils.getElem(`npc-area-${npcIdStr}`)) return;

        const areaDiv = document.createElement('div');
        areaDiv.className = 'npc-dialogue-area';
        areaDiv.id = `npc-area-${npcIdStr}`;

        const nameHeader = document.createElement('h3');
        nameHeader.textContent = npcName;
        areaDiv.appendChild(nameHeader);

        const transcriptDiv = document.createElement('div');
        transcriptDiv.className = 'npc-transcript';
        transcriptDiv.id = `transcript-${npcIdStr}`;

        // --- NEW: Add the description prologue ---
        const descriptionP = document.createElement('p');
        descriptionP.className = 'npc-description-prologue';
        descriptionP.textContent = npcDescription;
        transcriptDiv.appendChild(descriptionP);
        // ---

        const sceneEventP = document.createElement('p');
        sceneEventP.className = 'scene-event';
        sceneEventP.innerHTML = `<em>Dialogue with ${npcName} begins.</em>`;
        transcriptDiv.appendChild(sceneEventP);

        areaDiv.appendChild(transcriptDiv);

        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.id = `ai-suggestions-${npcIdStr}`;
        suggestionsDiv.className = 'ai-suggestions-for-npc';
        suggestionsDiv.style.display = 'none';
        areaDiv.appendChild(suggestionsDiv);
        
        containerElement.appendChild(areaDiv);
    },

    removeNpcDialogueAreaUI: function(npcIdStr, containerElement) {
        const areaDiv = Utils.getElem(`npc-area-${npcIdStr}`);
        if (areaDiv) areaDiv.remove();
        // appState is assumed to be globally available
        if (appState.getActiveNpcCount() === 0 && containerElement && !containerElement.querySelector('p.scene-event')) {
            containerElement.innerHTML = '<p class="scene-event">Select NPCs from the SCENE tab to add them to the interaction.</p>';
        }
    },

    appendMessageToTranscriptUI: function(transcriptArea, message, className) {
        if (!transcriptArea) return;
        const entry = document.createElement('p');
        entry.className = className;
        entry.textContent = message;
        transcriptArea.appendChild(entry);
        transcriptArea.scrollTop = transcriptArea.scrollHeight;
    },

    renderSuggestionsArea: function(aiResult, forNpcId) {
        const globalSuggestionsArea = Utils.getElem('ai-suggestions');
        if (!globalSuggestionsArea) return;
    
        let hasContentToDisplay = false;
    
        // Part 1: Render Canned Responses for the currently profiled character
        // appState is assumed to be globally available
        const cannedResponses = appState.cannedResponsesForProfiledChar || {};
        const cannedContainer = Utils.getElem('canned-responses-list');
        const cannedDisplay = Utils.getElem('canned-response-display');
        const cannedControls = Utils.getElem('canned-response-controls');
    
        if (cannedContainer && cannedDisplay && cannedControls) {
            const keys = Object.keys(cannedResponses);
            if (keys.length > 0) {
                hasContentToDisplay = true;
                cannedContainer.style.display = 'flex';
                cannedControls.style.display = 'none'; // Hide the old buttons
    
                keys.sort((a, b) => {
                    const aIsIntro = a.toLowerCase() === 'introduction';
                    const bIsIntro = b.toLowerCase() === 'introduction';
                    if (aIsIntro && !bIsIntro) return -1;
                    if (!aIsIntro && bIsIntro) return 1;
                    return a.localeCompare(b);
                });
    
                cannedDisplay.innerHTML = keys.map(key =>
                    `<div class="clickable-suggestion" onclick="App.useSpecificCannedResponse('${Utils.escapeHtml(key).replace(/'/g, "\\'")}')">${Utils.escapeHtml(key)}</div>`
                ).join('');
    
            } else {
                cannedContainer.style.display = 'none';
            }
        }
    
        // Part 2: Render AI Suggestions
        const profiledCharId = appState.getCurrentProfileCharId();
        if (aiResult && forNpcId && forNpcId === profiledCharId) {
            const suggestionTypes = {
                'memories': { title: 'Suggested Memories', data: aiResult.new_memory_suggestions, render: item => `${Utils.escapeHtml(item)} <button onclick="App.addSuggestedMemoryAsActual('${forNpcId}', '${Utils.escapeHtml(item).replace(/'/g, "\\'")}')">Add</button>` },
                'topics': { title: 'Suggested Conversation Topics', data: aiResult.generated_topics, render: item => `<div class="clickable-suggestion" onclick="App.sendTopicToChat('${Utils.escapeHtml(item).replace(/'/g, "\\'")}')">${Utils.escapeHtml(item)}</div>` },
                'npc-actions': { title: 'Suggested NPC Actions/Thoughts', data: aiResult.suggested_npc_actions, render: item => Utils.escapeHtml(item) },
                'player-checks': { title: 'Suggested Player Checks', data: aiResult.suggested_player_checks, render: item => Utils.escapeHtml(item) }
            };
    
            for (const [key, config] of Object.entries(suggestionTypes)) {
                const listDiv = Utils.getElem(`suggested-${key}-list`);
                if (listDiv) {
                    if (config.data && config.data.length > 0) {
                        listDiv.style.display = 'flex';
                        listDiv.innerHTML = `<h5>${config.title}</h5>` + config.data.map(item => `<div class="suggested-item">${config.render(item)}</div>`).join('');
                        hasContentToDisplay = true;
                    } else {
                        listDiv.style.display = 'none';
                    }
                }
            }
    
            const standingChangesDiv = Utils.getElem('suggested-faction-standing-changes');
            if (standingChangesDiv) {
                if (aiResult.suggested_new_standing && aiResult.suggested_standing_pc_id) {
                    standingChangesDiv.style.display = 'flex';
                    const pcForStanding = appState.getCharacterById(aiResult.suggested_standing_pc_id);
                    const pcNameForStanding = pcForStanding ? pcForStanding.name : "the speaker";
                    const standingValue = (typeof aiResult.suggested_new_standing === 'object' && aiResult.suggested_new_standing !== null) ? aiResult.suggested_new_standing.value : aiResult.suggested_new_standing;
                    standingChangesDiv.innerHTML = `<h5>Suggested Faction Standing Change:</h5>
                        <div class="suggested-item">
                            Towards ${Utils.escapeHtml(pcNameForStanding)}: ${Utils.escapeHtml(standingValue)}
                            (Justification: ${Utils.escapeHtml(aiResult.standing_change_justification || 'None')})
                            <button onclick="App.acceptFactionStandingChange('${forNpcId}', '${aiResult.suggested_standing_pc_id}', '${Utils.escapeHtml(standingValue)}')">Accept</button>
                        </div>`;
                    hasContentToDisplay = true;
                } else {
                     standingChangesDiv.style.display = 'none';
                }
            }
        } else {
             ['memories', 'topics', 'npc-actions', 'player-checks', 'faction-standing-changes'].forEach(suggType => {
                const targetDiv = Utils.getElem(`suggested-${suggType}-list`);
                if(targetDiv) {
                    targetDiv.style.display = 'none';
                }
             });
        }
        globalSuggestionsArea.style.display = hasContentToDisplay ? 'flex' : 'none';
    },

    renderNpcFactionStandingsUI: function(npcCharacter, activePcIdsSet, allCharactersArray, contentElement, onStandingChangeCallback) {
        if (!contentElement) { console.error("NPCRenderers.renderNpcFactionStandingsUI: contentElement not found"); return; }
        if (!npcCharacter || npcCharacter.character_type !== 'NPC') {
            contentElement.innerHTML = "<p><em>Select an NPC to view/edit standings.</em></p>";
            return;
        }
        contentElement.innerHTML = '';
        const activePcs = allCharactersArray.filter(char => char.character_type === 'PC' && activePcIdsSet.has(String(char._id)));
        if (activePcs.length === 0) {
            contentElement.innerHTML = "<p><em>No PCs selected to show standings towards.</em></p>";
            return;
        }
        activePcs.forEach(pc => {
            const pcIdStr = String(pc._id);
            const standingEntryDiv = document.createElement('div');
            standingEntryDiv.className = 'faction-standing-entry';
            const label = document.createElement('label');
            label.htmlFor = `standing-slider-${npcCharacter._id}-${pcIdStr}`;
            label.textContent = `${pc.name}:`;
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.id = `standing-slider-${npcCharacter._id}-${pcIdStr}`;
            slider.dataset.pcId = pcIdStr;
            // FACTION_STANDING_SLIDER_ORDER and FACTION_STANDING_LEVELS are assumed to be globally available or from config.js
            slider.min = 0;
            slider.max = FACTION_STANDING_SLIDER_ORDER.length - 1;
            slider.step = 1;
            const currentStandingObj = npcCharacter.pc_faction_standings ? npcCharacter.pc_faction_standings[pcIdStr] : null;
            let currentStandingValue = FACTION_STANDING_LEVELS.INDIFFERENT;
            if (currentStandingObj) {
                if (typeof currentStandingObj === 'string' && FACTION_STANDING_SLIDER_ORDER.includes(currentStandingObj)) {
                    currentStandingValue = currentStandingObj;
                } else if (typeof currentStandingObj === 'object' && currentStandingObj !== null && typeof currentStandingObj.value !== 'undefined' && FACTION_STANDING_SLIDER_ORDER.includes(currentStandingObj.value)) {
                    currentStandingValue = currentStandingObj.value;
                }
            }
            const currentStandingIndex = FACTION_STANDING_SLIDER_ORDER.indexOf(currentStandingValue);
            slider.value = currentStandingIndex !== -1 ? currentStandingIndex : FACTION_STANDING_SLIDER_ORDER.indexOf(FACTION_STANDING_LEVELS.INDIFFERENT);
            const levelDisplay = document.createElement('span');
            levelDisplay.className = 'standing-level-display';
            levelDisplay.textContent = FACTION_STANDING_SLIDER_ORDER[slider.valueAsNumber];
            slider.addEventListener('input', (event) => { levelDisplay.textContent = FACTION_STANDING_SLIDER_ORDER[event.target.valueAsNumber]; });
            slider.addEventListener('change', (event) => { onStandingChangeCallback(npcCharacter._id, pcIdStr, FACTION_STANDING_SLIDER_ORDER[event.target.valueAsNumber]); });
            standingEntryDiv.appendChild(label);
            standingEntryDiv.appendChild(slider);
            standingEntryDiv.appendChild(levelDisplay);
            contentElement.appendChild(standingEntryDiv);
        });
    },

    // --- NEW: Fully Dynamic Renderer for Right Column ---
    renderCharacterProfileUI: function(character, elements) {
        console.group("--- [DEBUG] NPCRenderers.renderCharacterProfileUI ---");
        
        // This function now renders into the 'npc-profile-view' in the right column
        const profileContainer = document.getElementById('npc-profile-view');

        if (!character) {
            console.warn("Character data is null. Hiding profile section.");
            if(profileContainer) profileContainer.innerHTML = '<p>No Character Selected</p>';
            console.groupEnd();
            return;
        }

        if (!profileContainer) {
            console.error("ERROR: 'npc-profile-view' container not found in Right Column.");
            console.groupEnd();
            return;
        }

        console.log("Rendering Character into Right Column:", character.name);
        
        // Ensure defaults
        character.personality_traits = character.personality_traits || [];
        character.memories = character.memories || [];
        character.associated_history_files = character.associated_history_files || [];
        character.linked_lore_by_name = character.linked_lore_by_name || [];
        character.pc_faction_standings = character.pc_faction_standings || {};
        const isNpc = character.character_type === 'NPC';

        // 1. Build HTML Structure (similar to the old sidebar but cleaner)
        let html = `
            <div class="npc-profile-sheet">
                <div class="profile-header">
                    <h2>${character.name}</h2>
                    <span class="char-type-badge">${character.character_type || 'Unknown'}</span>
                </div>
                
                <div class="profile-section">
                    <h4>Description</h4>
                    <p>${character.description || 'No description available.'}</p>
                </div>

                <div class="profile-section">
                    <h4>Personality</h4>
                    <p>${character.personality_traits.join(', ') || 'None listed.'}</p>
                </div>

                <div class="profile-section collapsible-section">
                    <h4 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')">GM Notes <span class="arrow-indicator">▼</span></h4>
                    <div class="collapsible-content">
                        <textarea id="gm-notes" rows="4" class="full-width-textarea" placeholder="Private notes for the GM.">${character.gm_notes || ''}</textarea>
                        <button id="save-gm-notes-btn">Save Notes</button>
                    </div>
                </div>`;

        if (isNpc) {
            html += `
                <div class="profile-section collapsible-section">
                    <h4 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')">Memories <span class="arrow-indicator">▼</span></h4>
                    <div class="collapsible-content">
                        <ul id="character-memories-list" class="memory-list"></ul>
                        <div class="add-memory-controls">
                            <input type="text" id="new-memory-content" placeholder="New memory content">
                            <input type="text" id="new-memory-type" placeholder="Type (e.g., 'fact')">
                            <button id="add-memory-btn">Add Memory</button>
                        </div>
                    </div>
                </div>

                <div class="profile-section collapsible-section">
                    <h4 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')">Faction Standings <span class="arrow-indicator">▼</span></h4>
                    <div class="collapsible-content" id="npc-faction-standings-content">
                        </div>
                </div>`;
        }

        html += `
                <div class="profile-section collapsible-section">
                    <h4 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')">History & Lore <span class="arrow-indicator">▼</span></h4>
                    <div class="collapsible-content">
                        <h5>History Files</h5>
                        <ul id="associated-history-list"></ul>
                        <div class="control-row">
                            <select id="history-file-select"></select>
                            <button id="associate-history-btn">Associate File</button>
                        </div>
                        <div id="history-content-display" class="scrollable-text-box"></div>
                        
                        <h5 style="margin-top: 15px;">Lore Entries</h5>
                        <ul id="associated-lore-list-for-character"></ul>
                        <div class="control-row">
                            <select id="lore-entry-select-for-character">
                                <option value="">-- Select Lore --</option>
                            </select>
                            <button id="link-lore-to-char-btn">Link Lore</button>
                        </div>
                    </div>
                </div>
            </div>`;

        // 2. Inject HTML
        profileContainer.innerHTML = html;

        // 3. Attach Event Listeners & Dynamic Content logic
        // We reuse the existing helper methods but pass the NEW DOM elements we just created.

        const gmNotesBtn = document.getElementById('save-gm-notes-btn');
        if (gmNotesBtn) gmNotesBtn.onclick = CharacterService.handleSaveGmNotes;

        if (isNpc) {
            const memoryList = document.getElementById('character-memories-list');
            const addMemBtn = document.getElementById('add-memory-btn');
            const standingContent = document.getElementById('npc-faction-standings-content');
            
            if (memoryList) this.renderMemoriesUI(character.memories, memoryList, CharacterService.handleDeleteMemory);
            if (addMemBtn) addMemBtn.onclick = CharacterService.handleAddMemory;
            
            if (standingContent && appState) {
                this.renderNpcFactionStandingsUI(character, appState.activePcIds, appState.getAllCharacters(), standingContent, CharacterService.handleSaveFactionStanding);
            }
        }

        const histList = document.getElementById('associated-history-list');
        const histDisplay = document.getElementById('history-content-display');
        const histBtn = document.getElementById('associate-history-btn');

        // Populate history select (Assuming API service has loaded files, or we re-fetch)
        // Note: In the original code, population of the select box was handled by CharacterService or App. 
        // We might need to trigger that population here or assume global state.
        // For now, we wire up the renderers.
        if (histList && histDisplay) {
            this.renderAssociatedHistoryFilesUI(character, histList, histDisplay, CharacterService.handleDissociateHistoryFile);
        }
        if (histBtn) histBtn.onclick = CharacterService.handleAssociateHistoryFile;
        
        // Populate History Dropdown (Quick fix: trigger global population if available)
        if (window.populateHistoryFileSelect) window.populateHistoryFileSelect(); 


        const loreList = document.getElementById('associated-lore-list-for-character');
        const loreBtn = document.getElementById('link-lore-to-char-btn');
        
        if (window.LoreRenderers) {
            LoreRenderers.renderAssociatedLoreForCharacterUI(character, CharacterService.handleUnlinkLoreFromCharacter);
            LoreRenderers.populateLoreEntrySelectForCharacterLinkingUI(character.linked_lore_by_name);
        }
        if (loreBtn) loreBtn.onclick = CharacterService.handleLinkLoreToCharacter;

        console.groupEnd();
    },

    renderMemoriesUI: function(memories, listElement, deleteCallback) {
        if (!listElement) return;
        listElement.innerHTML = '';
        if (!memories || memories.length === 0) {
            listElement.innerHTML = '<p><em>No memories recorded yet.</em></p>';
            return;
        }
        memories.forEach(memory => {
            const item = document.createElement('div');
            item.className = 'memory-item';
            item.innerHTML = `
                <span><strong>${memory.type || 'Fact'}:</strong> ${Utils.escapeHtml(memory.content)} <em>(${new Date(memory.timestamp).toLocaleDateString()})</em></span>
                <button data-memory-id="${memory.memory_id}">Delete</button>
            `;
            item.querySelector('button').onclick = () => deleteCallback(memory.memory_id);
            listElement.appendChild(item);
        });
    },

    renderAssociatedHistoryFilesUI: function(character, listElement, contentDisplayElement, dissociateCallback) {
        if (!listElement || !contentDisplayElement) return;
        listElement.innerHTML = '';
        if (character?.associated_history_files?.length > 0) {
            character.associated_history_files.forEach(filename => {
                const li = document.createElement('li');
                li.textContent = filename;
                const removeBtn = document.createElement('button');
                removeBtn.textContent = 'Remove';
                removeBtn.className = 'remove-history-btn';
                removeBtn.onclick = () => dissociateCallback(filename);
                li.appendChild(removeBtn);
                listElement.appendChild(li);
            });
        } else {
            listElement.innerHTML = '<li><em>None associated.</em></li>';
        }
        contentDisplayElement.textContent = character?.combined_history_content ||
                                       (character?.associated_history_files?.length > 0 ? "Content loading or is empty." : "No history files associated to display content.");
    },

    generateNpcCardHTML: function(npc) {
        if (!npc) return '';
        let cardHTML = `<div class="npc-stat-card" data-npc-id="${String(npc._id)}">`;
        cardHTML += `<h4>${npc.name}</h4>`;
        cardHTML += `<p class="npc-card-description">${npc.description || 'No description.'}</p>`;
        if (npc.personality_traits && npc.personality_traits.length > 0) {
           cardHTML += `<p><strong>Personality:</strong> ${npc.personality_traits.join(', ')}</p>`;
        }
        cardHTML += `</div>`;
        return cardHTML;
    }
};
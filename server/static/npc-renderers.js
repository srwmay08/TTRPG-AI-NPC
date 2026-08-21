/**
 * server/static/npc-renderers.js
 * 
 * Responsibility: Handling DOM construction and updates for Non-Player Characters (NPCs).
 * This includes the sidebar lists, the dynamic transcription area in the Scene View,
 * and the complex editable Profile sheet on the right panel.
 */

var NPCRenderers = {
    /**
     * Renders the left-sidebar list of NPCs available for the current Scene.
     * Filters characters based on the currently selected Scene Context (Lore).
     */
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
    
        // Filter dataset down to only NPCs
        let npcsToDisplay = allCharacters.filter(char => char.character_type === 'NPC');
    
        // If a specific location/faction is selected, filter NPCs to only those linked to it
        if (sceneContextFilter && sceneContextFilter.id) {
            const loreContextEntry = appState.getLoreEntryById(sceneContextFilter.id);
            if (loreContextEntry) {
                const loreName = loreContextEntry.name;
                npcsToDisplay = npcsToDisplay.filter(npc =>
                    npc.linked_lore_by_name && npc.linked_lore_by_name.includes(loreName)
                );
            } else {
                npcsToDisplay = []; // Lore not found, fail safe
            }
        }
    
        npcsToDisplay.sort((a, b) => a.name.localeCompare(b.name));
    
        // Empty state handling
        if (npcsToDisplay.length === 0) {
            if (sceneContextFilter && sceneContextFilter.id) {
                ul.innerHTML = '<li><p><em>No NPCs are linked to this specific context.</em></p></li>';
            } else {
                ul.innerHTML = '<li><p><em>No NPCs available.</em></p></li>';
            }
            return;
        }
    
        // Build the interactive list items
        npcsToDisplay.forEach(char => {
            const charIdStr = String(char._id);
            const li = document.createElement('li');
            li.dataset.charId = charIdStr;
            
            // Flex layout ensures the "Profile" button floats to the right
            li.style.display = 'flex';
            li.style.alignItems = 'center';
            li.style.justifyContent = 'space-between';
            li.style.cursor = 'pointer'; 
            
            const isActive = activeSceneNpcIds.has(charIdStr);

            // Add visual highlighting if they are actively in the scene dialogue
            if (isActive) {
                li.classList.add('active-in-scene');
                li.style.backgroundColor = '#e2e6ea'; 
            }

            // Bind the row click to toggle their active presence in the scene
            li.onclick = async (event) => {
                console.log("[DEBUG] NPC Row Clicked (Toggle Scene):", char.name);
                await onToggleInSceneCallback(charIdStr, char.name);
            };

            const nameSpan = document.createElement('span');
            nameSpan.className = 'npc-name-clickable'; 
            nameSpan.style.flex = '1';
            nameSpan.style.padding = '8px'; 
            nameSpan.textContent = char.name;

            // Inject a green checkmark if active
            if (isActive) {
                nameSpan.style.fontWeight = 'bold';
                const checkMark = document.createElement('span');
                checkMark.textContent = ' ✔';
                checkMark.style.color = '#28a745';
                checkMark.style.fontWeight = 'bold';
                nameSpan.appendChild(checkMark);
            }
            
            // Build the "Profile" button to view stats without toggling scene presence
            const profileBtn = document.createElement('button');
            profileBtn.textContent = 'Profile'; 
            profileBtn.style.fontSize = '0.75rem';
            profileBtn.style.padding = '2px 6px';
            profileBtn.style.marginRight = '5px';
            profileBtn.title = "View Character Profile";
            
            profileBtn.onclick = async (event) => {
                event.stopPropagation(); // VERY IMPORTANT: Stop the row click from firing and toggling the scene
                console.log("[DEBUG] NPC Profile Clicked:", char.name);
                await onNameClickCallback(charIdStr);
            };
    
            li.appendChild(nameSpan);
            li.appendChild(profileBtn);
            ul.appendChild(li);
        });
    },

    /**
     * Renders an unfiltered, master list of all NPCs for the generic Management Tab.
     */
    renderAllNpcListForManagementUI: function(listContainerElement, allCharacters, onNameClickCallback) {
        if (!listContainerElement) { 
            console.error("NPCRenderers.renderAllNpcListForManagementUI: listContainerElement not found"); 
            return; 
        }
        
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

    /**
     * Dynamically injects a new conversational block into the Scene View 
     * when an NPC is added to the active scene.
     */
    createNpcDialogueAreaUI: function(npcCharacter, containerElement) {
        if (!npcCharacter || !containerElement) return;

        const npcIdStr = String(npcCharacter._id);
        const npcName = npcCharacter.name;
        const npcDescription = npcCharacter.description || 'No description available.';

        // Prevent rendering duplicate areas for the same character
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

        // Inject the character's description string at the very top of their transcript
        // to give the GM immediate context on how to roleplay them.
        const descriptionP = document.createElement('p');
        descriptionP.className = 'npc-description-prologue';
        descriptionP.textContent = npcDescription;
        transcriptDiv.appendChild(descriptionP);

        // Visual break indicating start of actual dialogue
        const sceneEventP = document.createElement('p');
        sceneEventP.className = 'scene-event';
        sceneEventP.innerHTML = `<em>Dialogue with ${npcName} begins.</em>`;
        transcriptDiv.appendChild(sceneEventP);

        areaDiv.appendChild(transcriptDiv);

        // Establish the hidden container for AI-generated metadata (Checks, Topics, Actions)
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.id = `ai-suggestions-${npcIdStr}`;
        suggestionsDiv.className = 'ai-suggestions-for-npc';
        suggestionsDiv.style.display = 'none';
        areaDiv.appendChild(suggestionsDiv);
        
        containerElement.appendChild(areaDiv);
    },

    /** Destroys the conversational block when an NPC is toggled out of the scene. */
    removeNpcDialogueAreaUI: function(npcIdStr, containerElement) {
        const areaDiv = Utils.getElem(`npc-area-${npcIdStr}`);
        if (areaDiv) areaDiv.remove();
        
        // If the scene is now completely empty, display the placeholder instructional text
        if (appState.getActiveNpcCount() === 0 && containerElement && !containerElement.querySelector('p.scene-event')) {
            containerElement.innerHTML = '<p class="scene-event">Select NPCs from the SCENE tab to add them to the interaction.</p>';
        }
    },

    /**
     * Takes raw text and appends it to a specific character's transcript window.
     * Styles it differently based on if it's the NPC speaking or a Player/GM input.
     */
    appendMessageToTranscriptUI: function(transcriptArea, message, className, npcId = null) {
        if (!transcriptArea) return;
        
        const entryContainer = document.createElement('div');
        entryContainer.className = 'transcript-entry-container';
        entryContainer.style.marginBottom = '8px';

        const entry = document.createElement('p');
        entry.className = className;
        entry.textContent = message;
        entry.style.display = 'inline-block';
        entry.style.margin = '0 5px 0 0';

        entryContainer.appendChild(entry);

        // If the AI generated this response, attach a quick-action "Remember this" button
        // that automatically saves the string to the NPC's permanent memory array.
        if (npcId && className.includes('npc-response')) {
             const saveMemBtn = document.createElement('button');
             saveMemBtn.innerHTML = '🧠'; 
             saveMemBtn.title = "Instantly remember this line";
             saveMemBtn.className = 'quick-memory-btn';
             saveMemBtn.style.fontSize = '0.8rem';
             saveMemBtn.style.padding = '0 4px';
             saveMemBtn.style.cursor = 'pointer';
             saveMemBtn.style.border = 'none';
             saveMemBtn.style.background = 'transparent';

             saveMemBtn.onclick = () => {
                 if (typeof CharacterService !== 'undefined') {
                     CharacterService.handleAddMemory(null, npcId, "Dialogue", message);
                     saveMemBtn.innerHTML = '✅';
                     saveMemBtn.disabled = true;
                 } else {
                     console.error("CharacterService not found");
                 }
             };
             entryContainer.appendChild(saveMemBtn);
        }

        transcriptArea.appendChild(entryContainer);
        // Force the scrollbar to stay attached to the bottom of the feed
        transcriptArea.scrollTop = transcriptArea.scrollHeight;
    },

    /**
     * Parses the complex `DialogueResponse` object returned from the backend GenAI call,
     * building the actionable UI elements for suggestions and standing modifications.
     */
    renderSuggestionsArea: function(aiResult, forNpcId) {
        const globalSuggestionsArea = Utils.getElem('ai-suggestions');
        if (!globalSuggestionsArea) return;
    
        let hasContentToDisplay = false;
    
        // --- Part 1: Render Canned Responses ---
        const cannedResponses = appState.cannedResponsesForProfiledChar || {};
        const cannedContainer = Utils.getElem('canned-responses-list');
        const cannedDisplay = Utils.getElem('canned-response-display');
        const cannedControls = Utils.getElem('canned-response-controls');
    
        if (cannedContainer && cannedDisplay && cannedControls) {
            const keys = Object.keys(cannedResponses);
            if (keys.length > 0) {
                hasContentToDisplay = true;
                cannedContainer.style.display = 'flex';
                cannedControls.style.display = 'none'; 
    
                // Force "Introduction" to always appear as the first button
                keys.sort((a, b) => {
                    const aIsIntro = a.toLowerCase() === 'introduction';
                    const bIsIntro = b.toLowerCase() === 'introduction';
                    if (aIsIntro && !bIsIntro) return -1;
                    if (!aIsIntro && bIsIntro) return 1;
                    return a.localeCompare(b);
                });
    
                // Construct clickable buttons that trigger the hardcoded dialogue bypass
                cannedDisplay.innerHTML = keys.map(key =>
                    `<div class="clickable-suggestion" onclick="App.useSpecificCannedResponse('${Utils.escapeHtml(key).replace(/'/g, "\\'")}')">${Utils.escapeHtml(key)}</div>`
                ).join('');
    
            } else {
                cannedContainer.style.display = 'none';
            }
        }
    
        // --- Part 2: Render AI Generated Suggestions ---
        const profiledCharId = appState.getCurrentProfileCharId();
        
        // Ensure we only render suggestions if the active response matches the character being viewed
        if (aiResult && forNpcId && forNpcId === profiledCharId) {
            
            // Map configuration for dynamic lists
            const suggestionTypes = {
                'memories': { title: 'Suggested Memories', data: aiResult.new_memory_suggestions, render: item => `${Utils.escapeHtml(item)} <button onclick="App.addSuggestedMemoryAsActual('${forNpcId}', '${Utils.escapeHtml(item).replace(/'/g, "\\'")}')">Add</button>` },
                'topics': { title: 'Suggested Conversation Topics', data: aiResult.generated_topics, render: item => `<div class="clickable-suggestion" onclick="App.sendTopicToChat('${Utils.escapeHtml(item).replace(/'/g, "\\'")}')">${Utils.escapeHtml(item)}</div>` },
                'npc-actions': { title: 'Suggested NPC Actions/Thoughts', data: aiResult.suggested_npc_actions, render: item => Utils.escapeHtml(item) },
                'player-checks': { title: 'Suggested Player Checks', data: aiResult.suggested_player_checks, render: item => Utils.escapeHtml(item) }
            };
    
            // Iterate and build HTML
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
    
            // Separate bespoke logic for the Faction Standing change suggestion
            const standingChangesDiv = Utils.getElem('suggested-faction-standing-changes');
            if (standingChangesDiv) {
                if (aiResult.suggested_new_standing && aiResult.suggested_standing_pc_id) {
                    standingChangesDiv.style.display = 'flex';
                    
                    const pcForStanding = appState.getCharacterById(aiResult.suggested_standing_pc_id);
                    const pcNameForStanding = pcForStanding ? pcForStanding.name : "the speaker";
                    
                    // Handle Object vs String variations returned from Pydantic Enums
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
             // Hide all sub-containers if no valid result exists for this NPC
             ['memories', 'topics', 'npc-actions', 'player-checks', 'faction-standing-changes'].forEach(suggType => {
                const targetDiv = Utils.getElem(`suggested-${suggType}-list`);
                if(targetDiv) {
                    targetDiv.style.display = 'none';
                }
             });
        }
        
        // Show/hide the master parent container based on whether any child has content
        globalSuggestionsArea.style.display = hasContentToDisplay ? 'flex' : 'none';
    },

    /**
     * Builds the interactive Sliders inside an NPC's profile dictating 
     * how they feel about the PCs in the current scene.
     */
    renderNpcFactionStandingsUI: function(npcCharacter, activePcIdsSet, allCharactersArray, contentElement, onStandingChangeCallback) {
        if (!contentElement) { console.error("NPCRenderers.renderNpcFactionStandingsUI: contentElement not found"); return; }
        
        if (!npcCharacter || npcCharacter.character_type !== 'NPC') {
            contentElement.innerHTML = "<p><em>Select an NPC to view/edit standings.</em></p>";
            return;
        }
        contentElement.innerHTML = '';
        
        // Filter the array of PCs down to only the ones currently flagged as Active
        const activePcs = allCharactersArray.filter(char => char.character_type === 'PC' && activePcIdsSet.has(String(char._id)));
        if (activePcs.length === 0) {
            contentElement.innerHTML = "<p><em>No PCs selected to show standings towards.</em></p>";
            return;
        }
        
        // Construct an HTML Slider mapped to the ordered FACTION_STANDING_SLIDER_ORDER array
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
            
            slider.min = 0;
            slider.max = FACTION_STANDING_SLIDER_ORDER.length - 1;
            slider.step = 1;
            
            // Retrieve current database standing, defaulting to indifferent
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
            
            // Re-render visual text as slider drags
            slider.addEventListener('input', (event) => { levelDisplay.textContent = FACTION_STANDING_SLIDER_ORDER[event.target.valueAsNumber]; });
            // Send API update request when mouse releases
            slider.addEventListener('change', (event) => { onStandingChangeCallback(npcCharacter._id, pcIdStr, FACTION_STANDING_SLIDER_ORDER[event.target.valueAsNumber]); });
            
            standingEntryDiv.appendChild(label);
            standingEntryDiv.appendChild(slider);
            standingEntryDiv.appendChild(levelDisplay);
            contentElement.appendChild(standingEntryDiv);
        });
    },

    // --- Helper functions for Form Editor Construction ---

    /** Private util to generate a standardized HTML input block for the Edit Profile UI. */
    _generateFieldEditorHTML: function(value, label, fieldKey, isTextarea = false) {
        let html = `<div class="form-group" style="margin-bottom: 10px;">`;
        html += `<label style="display:block; font-weight:bold; font-size:0.8rem;">${label}</label>`;
        if (isTextarea) {
            html += `<textarea class="edit-field-input" data-field="${fieldKey}" rows="3" style="width:100%;">${Utils.escapeHtml(value || '')}</textarea>`;
        } else {
            html += `<input type="text" class="edit-field-input" data-field="${fieldKey}" value="${Utils.escapeHtml(value || '')}" style="width:100%;">`;
        }
        html += `</div>`;
        return html;
    },

    /** Private util to generate dynamic array input fields (like Personality Traits) for the Edit Profile UI. */
    _generateListEditorHTML: function(list, label, fieldKey) {
        list = list || [];
        let html = `<div class="form-group list-editor-group" data-field="${fieldKey}" style="margin-bottom: 15px; border:1px solid #ddd; padding:10px; border-radius:5px;">`;
        html += `<label style="display:block; font-weight:bold; margin-bottom:5px;">${label}</label>`;
        html += `<div class="list-items-container">`;
        
        list.forEach((item, index) => {
            html += `<div class="list-item-row" style="display:flex; margin-bottom:5px;">
                <input type="text" value="${Utils.escapeHtml(item)}" style="flex:1;">
                <button type="button" onclick="this.parentElement.remove()" style="background:#dc3545; color:white; border:none; margin-left:5px;">&times;</button>
            </div>`;
        });
        
        html += `</div>`; // End items container
        html += `<button type="button" class="add-list-item-btn" style="font-size:0.8rem; margin-top:5px;">+ Add Item</button>`;
        html += `</div>`;
        return html;
    },

    /**
     * Builds and manages the massive Profile Sheet on the right-hand panel for NPCs.
     * Contains the logic for swapping between "View" and "Edit" modes, as well as 
     * gathering input data to push back to the server.
     */
    renderCharacterProfileUI: function(character, elements) {
        const profileContainer = document.getElementById('npc-profile-view');
        if (!character || !profileContainer) return;

        // 1. HEADER
        let html = `
            <div class="npc-profile-sheet">
                <div class="profile-header">
                    <h2>${character.name}</h2>
                    <span class="char-type-badge">${character.character_type || 'Unknown'}</span>
                    <button id="toggle-edit-mode-btn" style="margin-left:auto; font-size:0.8rem;">Edit Profile</button>
                </div>`;

        // 2. EDIT FORM CONTAINER (Constructed but hidden by default)
        html += `<div id="profile-edit-form-container" style="display:none; padding:10px; border:1px solid #ccc; background:#f9f9f9; margin-bottom:15px;">
            <h4>Edit Character Details</h4>`;
        
        html += `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">`;
        html += this._generateFieldEditorHTML(character.name, "Name", "name");
        html += this._generateFieldEditorHTML(character.race, "Race", "race");
        html += this._generateFieldEditorHTML(character.class_str, "Class/Role", "class_str");
        html += this._generateFieldEditorHTML(character.age, "Age", "age");
        html += this._generateFieldEditorHTML(character.alignment, "Alignment", "alignment");
        html += `</div>`;

        html += this._generateFieldEditorHTML(character.description, "Description", "description", true);
        html += this._generateFieldEditorHTML(character.background_story, "Background Story", "background_story", true);
        html += this._generateFieldEditorHTML(character.speech_patterns, "Speech Patterns", "speech_patterns");
        html += this._generateFieldEditorHTML(character.mannerisms, "Mannerisms", "mannerisms");

        html += this._generateListEditorHTML(character.personality_traits, "Personality Traits", "personality_traits");
        html += this._generateListEditorHTML(character.motivations, "Motivations", "motivations");

        html += `<div style="display:flex; justify-content:flex-end; gap:10px; margin-top:10px;">
            <button id="cancel-edit-btn">Cancel</button>
            <button id="save-edit-btn" style="background-color:#28a745; color:white;">Save Changes</button>
        </div>`;
        html += `</div>`; 

        // 3. VISUAL DISPLAY CONTAINER (Visible by default)
        html += `<div id="visual-profile-content">
                    <div class="profile-section">
                        <h4>Description</h4>
                        <p>${character.description || 'No description available.'}</p>
                    </div>

                    <div class="profile-section">
                        <h4>Personality</h4>
                        <p>${(character.personality_traits || []).join(', ') || 'None listed.'}</p>
                    </div>

                    <div class="profile-section collapsible-section">
                        <h4 class="collapsible-header" onclick="this.parentElement.classList.toggle('collapsed')">GM Notes <span class="arrow-indicator">▼</span></h4>
                        <div class="collapsible-content">
                            <textarea id="gm-notes" rows="4" class="full-width-textarea" placeholder="Private notes for the GM.">${character.gm_notes || ''}</textarea>
                            <button id="save-gm-notes-btn">Save Notes</button>
                        </div>
                    </div>`;

        if (character.character_type === 'NPC') {
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
            </div> </div> `;

        profileContainer.innerHTML = html;

        // --- Attach Event Listeners to Rebuilt DOM ---
        const gmNotesBtn = document.getElementById('save-gm-notes-btn');
        if (gmNotesBtn) gmNotesBtn.onclick = CharacterService.handleSaveGmNotes;

        if (character.character_type === 'NPC') {
            const memoryList = document.getElementById('character-memories-list');
            const addMemBtn = document.getElementById('add-memory-btn');
            const standingContent = document.getElementById('npc-faction-standings-content');
            
            // Delegate secondary block rendering
            if (memoryList) this.renderMemoriesUI(character.memories, memoryList, CharacterService.handleDeleteMemory);
            if (addMemBtn) addMemBtn.onclick = CharacterService.handleAddMemory;
            
            if (standingContent && appState) {
                this.renderNpcFactionStandingsUI(character, appState.activePcIds, appState.getAllCharacters(), standingContent, CharacterService.handleSaveFactionStanding);
            }
        }

        const histList = document.getElementById('associated-history-list');
        const histDisplay = document.getElementById('history-content-display');
        const histBtn = document.getElementById('associate-history-btn');

        if (histList && histDisplay) {
            this.renderAssociatedHistoryFilesUI(character, histList, histDisplay, CharacterService.handleDissociateHistoryFile);
        }
        if (histBtn) histBtn.onclick = CharacterService.handleAssociateHistoryFile;
        
        if (window.populateHistoryFileSelect) window.populateHistoryFileSelect(); 

        const loreList = document.getElementById('associated-lore-list-for-character');
        const loreBtn = document.getElementById('link-lore-to-char-btn');
        
        if (window.LoreRenderers) {
            LoreRenderers.renderAssociatedLoreForCharacterUI(character, CharacterService.handleUnlinkLoreFromCharacter);
            LoreRenderers.populateLoreEntrySelectForCharacterLinkingUI(character.linked_lore_by_name);
        }
        if (loreBtn) loreBtn.onclick = CharacterService.handleLinkLoreToCharacter;

        // --- Setup Logic for the Inline FORM EDITOR ---
        const toggleEditBtn = document.getElementById('toggle-edit-mode-btn');
        const editContainer = document.getElementById('profile-edit-form-container');
        const visualContent = document.getElementById('visual-profile-content');
        const cancelBtn = document.getElementById('cancel-edit-btn');
        const saveBtn = document.getElementById('save-edit-btn');

        // Toggle visibility to show the form
        if (toggleEditBtn) {
            toggleEditBtn.onclick = () => {
                visualContent.style.display = 'none';
                editContainer.style.display = 'block';
                toggleEditBtn.style.display = 'none';
            };
        }

        // Cancel and revert to display state
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                editContainer.style.display = 'none';
                visualContent.style.display = 'block';
                toggleEditBtn.style.display = 'block';
            };
        }

        // Handle dynamic addition of array inputs (like personality traits)
        const addListBtns = editContainer.querySelectorAll('.add-list-item-btn');
        addListBtns.forEach(btn => {
            btn.onclick = () => {
                const container = btn.parentElement.querySelector('.list-items-container');
                const row = document.createElement('div');
                row.className = 'list-item-row';
                row.style.cssText = 'display:flex; margin-bottom:5px;';
                row.innerHTML = `
                    <input type="text" style="flex:1;">
                    <button type="button" onclick="this.parentElement.remove()" style="background:#dc3545; color:white; border:none; margin-left:5px;">&times;</button>
                `;
                container.appendChild(row);
            };
        });

        // Harvest data from the form and submit it to the API
        if (saveBtn) {
            saveBtn.onclick = async () => {
                const updatedData = { ...character };

                // Extract standard text/number fields
                const textInputs = editContainer.querySelectorAll('.edit-field-input');
                textInputs.forEach(input => {
                    const field = input.dataset.field;
                    if (field) updatedData[field] = input.value;
                });

                // Extract and compile array fields
                const listGroups = editContainer.querySelectorAll('.list-editor-group');
                listGroups.forEach(group => {
                    const field = group.dataset.field;
                    const items = [];
                    const itemInputs = group.querySelectorAll('.list-item-row input');
                    itemInputs.forEach(inp => {
                        if (inp.value.trim()) items.push(inp.value.trim());
                    });
                    updatedData[field] = items;
                });

                // Push payload to server
                if (typeof CharacterService !== 'undefined') {
                    await CharacterService.updateCharacter(character._id, updatedData);
                }
            };
        }
    },

    /** Iterates over the NPC's memory array and renders them as a list with delete buttons. */
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

    /** Renders the list of bound text documents and populates the reading window. */
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
        
        // Show concatenated file texts, or fallback strings
        contentDisplayElement.textContent = character?.combined_history_content ||
                                       (character?.associated_history_files?.length > 0 ? "Content loading or is empty." : "No history files associated to display content.");
    },

    /** Generates a small visual card block for an NPC, used inside Lore location overviews. */
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
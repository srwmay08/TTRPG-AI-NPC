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
            li.style.cursor = "pointer";
    
            if (activeSceneNpcIds.has(charIdStr)) {
                li.classList.add('active-in-scene');
            }
    
            const nameSpan = document.createElement('span');
            nameSpan.textContent = char.name;
            nameSpan.className = 'npc-name-clickable';
            
            li.onclick = async (event) => {
                if (event.target.classList.contains('npc-name-clickable')) {
                    event.stopPropagation();
                    await onNameClickCallback(charIdStr);
                } else {
                    await onToggleInSceneCallback(charIdStr, char.name);
                }
            };
    
            li.appendChild(nameSpan);
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
            nameSpan.onclick = () => onNameClickCallback(charIdStr);

            li.appendChild(nameSpan);
            ul.appendChild(li);
        });
    },

    renderPcListUI: function(pcListDiv, speakingPcSelect, allCharacters, activePcIds, onPcItemClickCallback, activeNpcIdsSet) {
        // This function name is a bit misleading as it also populates the speakingPcSelect with NPCs
        if (!pcListDiv) { console.error("NPCRenderers.renderPcListUI: pcListDiv not found"); return;}
        pcListDiv.innerHTML = '';
        if (speakingPcSelect) {
            const currentSpeaker = speakingPcSelect.value;
            speakingPcSelect.innerHTML = '<option value="">-- DM/Scene Event --</option>';

            // Add Player Characters
            const pcs = allCharacters.filter(char => char.character_type === 'PC').sort((a, b) => a.name.localeCompare(b.name));
            pcs.forEach(pc => {
                const pcIdStr = String(pc._id);
                const option = document.createElement('option');
                option.value = pcIdStr;
                option.textContent = `(PC) ${pc.name}`;
                speakingPcSelect.appendChild(option);
            });

            // Add a separator
            if (activeNpcIdsSet && activeNpcIdsSet.size > 0 && pcs.length > 0) {
                const separator = document.createElement('option');
                separator.disabled = true;
                separator.textContent = '--- NPCs in Scene ---';
                speakingPcSelect.appendChild(separator);
            }

            // Add Active NPCs
            if (activeNpcIdsSet) {
                const activeNpcs = allCharacters.filter(char => activeNpcIdsSet.has(String(char._id))).sort((a, b) => a.name.localeCompare(b.name));
                activeNpcs.forEach(npc => {
                    const npcIdStr = String(npc._id);
                    const option = document.createElement('option');
                    option.value = npcIdStr;
                    option.textContent = `(NPC) ${npc.name}`;
                    speakingPcSelect.appendChild(option);
                });
            }
            // Try to restore previous selection
            if (Array.from(speakingPcSelect.options).some(opt => opt.value === currentSpeaker)) {
                speakingPcSelect.value = currentSpeaker;
            }
        }
        
        // This part remains the same, for rendering the PC list on the left
        const pcsForList = allCharacters.filter(char => char.character_type === 'PC').sort((a, b) => a.name.localeCompare(b.name));
        if (pcsForList.length === 0) {
            pcListDiv.innerHTML = '<p><em>No Player Characters defined yet.</em></p>';
            return;
        }
        const ul = document.createElement('ul');
        pcsForList.forEach(pc => {
            const pcIdStr = String(pc._id);
            const li = document.createElement('li');
            li.style.cursor = "pointer";
            li.textContent = pc.name;
            li.dataset.charId = pcIdStr;
            li.onclick = () => onPcItemClickCallback(pcIdStr);
            if (activePcIds.has(pcIdStr)) {
                li.classList.add('selected');
            }
            ul.appendChild(li);
        });
        pcListDiv.appendChild(ul);
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

    renderCharacterProfileUI: function(character, elements) {
        // This function renders parts of the profile for both PC and NPC, but the majority of
        // its dependencies (memories, faction standings, history, lore links) are strongly
        // associated with NPCs. We'll keep it here for now, but if PC profile rendering
        // becomes more complex, a `character-renderers.js` might be warranted.
        const characterProfileMainSection = Utils.getElem('character-profile-main-section');
        const detailsCharNameElem = Utils.getElem(elements.detailsCharName);

        if (!character) {
            if(characterProfileMainSection) characterProfileMainSection.style.display = 'none';
            if (detailsCharNameElem) Utils.updateText(elements.detailsCharName, 'None Selected');
            return;
        }

        if(characterProfileMainSection) characterProfileMainSection.style.display = 'block';

        const profileCharTypeElem = Utils.getElem(elements.profileCharType);
        const profileDescriptionElem = Utils.getElem(elements.profileDescription);
        const profilePersonalityElem = Utils.getElem(elements.profilePersonality);
        const gmNotesTextareaElem = Utils.getElem(elements.gmNotesTextarea);
        const saveGmNotesBtnElem = Utils.getElem(elements.saveGmNotesBtn);
        const npcMemoriesSectionElem = Utils.getElem(elements.npcMemoriesSection);
        const characterMemoriesListElem = Utils.getElem(elements.characterMemoriesList);
        const addMemoryBtnElem = Utils.getElem(elements.addMemoryBtn);
        const npcFactionStandingsSectionElem = Utils.getElem(elements.npcFactionStandingsSection);
        const npcFactionStandingsContentElem = Utils.getElem(elements.npcFactionStandingsContent);
        const characterHistorySectionElem = Utils.getElem(elements.characterHistorySection);
        const associatedHistoryListElem = Utils.getElem(elements.associatedHistoryList);
        const historyContentDisplayElem = Utils.getElem(elements.historyContentDisplay);
        const characterLoreLinksSectionElem = Utils.getElem(elements.characterLoreLinksSection);
        const linkLoreToCharBtnElem = Utils.getElem(elements.linkLoreToCharBtn);

        character.personality_traits = character.personality_traits || [];
        character.memories = character.memories || [];
        character.associated_history_files = character.associated_history_files || [];
        character.linked_lore_by_name = character.linked_lore_by_name || [];
        character.pc_faction_standings = character.pc_faction_standings || {};

        if (detailsCharNameElem) Utils.updateText(elements.detailsCharName, character.name || "N/A");
        if (profileCharTypeElem) Utils.updateText(elements.profileCharType, character.character_type || "N/A");
        if (profileDescriptionElem) Utils.updateText(elements.profileDescription, character.description || "N/A");
        if (profilePersonalityElem) Utils.updateText(elements.profilePersonality, character.personality_traits.join(', ') || "N/A");
        if (gmNotesTextareaElem) gmNotesTextareaElem.value = character.gm_notes || '';
        if (saveGmNotesBtnElem) Utils.disableBtn(elements.saveGmNotesBtn, false);

        const isNpc = character.character_type === 'NPC';
        if (npcMemoriesSectionElem) npcMemoriesSectionElem.style.display = isNpc ? 'block' : 'none';
        if (npcFactionStandingsSectionElem) npcFactionStandingsSectionElem.style.display = isNpc ? 'block' : 'none';
        if (characterHistorySectionElem) characterHistorySectionElem.style.display = 'block';
        if (characterLoreLinksSectionElem) characterLoreLinksSectionElem.style.display = 'block';

        if (isNpc) {
            // CharacterService and appState are assumed to be globally available
            if (characterMemoriesListElem) this.renderMemoriesUI(character.memories, characterMemoriesListElem, CharacterService.handleDeleteMemory);
            if (npcFactionStandingsContentElem) this.renderNpcFactionStandingsUI(character, appState.activePcIds, appState.getAllCharacters(), npcFactionStandingsContentElem, CharacterService.handleSaveFactionStanding);
            if (addMemoryBtnElem) Utils.disableBtn(elements.addMemoryBtn, false);
        } else {
            if (characterMemoriesListElem) characterMemoriesListElem.innerHTML = '<p><em>Memories are for NPCs only.</em></p>';
            if (addMemoryBtnElem) Utils.disableBtn(elements.addMemoryBtn, true);
            if (npcFactionStandingsContentElem) npcFactionStandingsContentElem.innerHTML = '<p><em>Faction standings are for NPCs.</em></p>';
        }
        if (associatedHistoryListElem && historyContentDisplayElem) this.renderAssociatedHistoryFilesUI(character, associatedHistoryListElem, historyContentDisplayElement, CharacterService.handleDissociateHistoryFile);
        // LoreRenderers is assumed to be globally available
        LoreRenderers.renderAssociatedLoreForCharacterUI(character, CharacterService.handleUnlinkLoreFromCharacter);
        LoreRenderers.populateLoreEntrySelectForCharacterLinkingUI(character.linked_lore_by_name);
        if (linkLoreToCharBtnElem) Utils.disableBtn(elements.linkLoreToCharBtn, false);
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
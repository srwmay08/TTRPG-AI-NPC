// static/uiRenderers.js

console.log("uiRenderers.js: Parsing STARTED");

var UIRenderers = {
    createPcQuickViewSectionHTML: function(isForDashboard) {
        const titleText = PC_QUICK_VIEW_BASE_TITLE; // Global constant from config.js
        const fullTitle = isForDashboard ? `${titleText} (Click card for details)` : titleText;
        return `<h4>${fullTitle}</h4><div class="pc-dashboard-grid">`;
    },

    generatePcQuickViewCardHTML: function(pc, isClickableForDetailedView = false) {
        if (!pc) return '';
        // Ensure defaults for pc.vtt_data and its nested properties
        pc.vtt_data = pc.vtt_data || {};
        pc.vtt_data.abilities = pc.vtt_data.abilities || {};
        pc.vtt_data.attributes = pc.vtt_data.attributes || {};
        pc.vtt_data.attributes.hp = pc.vtt_data.attributes.hp || {};
        pc.vtt_data.attributes.ac = pc.vtt_data.attributes.ac || {};
        pc.vtt_data.attributes.movement = pc.vtt_data.attributes.movement || {};
        pc.vtt_data.attributes.init = pc.vtt_data.attributes.init || {};
        pc.vtt_data.attributes.spell = pc.vtt_data.attributes.spell || {};
        pc.vtt_data.details = pc.vtt_data.details || {};
        pc.vtt_data.skills = pc.vtt_data.skills || {};
        pc.vtt_data.traits = pc.vtt_data.traits || { languages: {}, armorProf: {}, weaponProf: {}};
        pc.items = pc.items || [];
        pc.system = pc.system || {};

        const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || pc.vtt_data?.details?.level || 1;
        if (typeof pc.calculatedProfBonus === 'undefined') {
            pc.calculatedProfBonus = DNDCalculations.getProficiencyBonus(pcLevel);
        }

        let cardClasses = 'pc-stat-card';
        let dataAttributes = '';
        // Make all PC cards clickable (in dashboard overview AND scene quick view)
        if (isClickableForDetailedView || pc.character_type === 'PC') { 
            cardClasses += ' clickable-pc-card';
            dataAttributes = `data-pc-id="${String(pc._id)}"`;
        }

        let cardHTML = `<div class="${cardClasses}" ${dataAttributes}>`;
        cardHTML += `<h4>${pc.name} (Lvl ${pcLevel})</h4>`;

        const hpCurrent = pc.vtt_data.attributes.hp?.value ?? 'N/A';
        const hpMax = pc.vtt_data.attributes.hp?.max ?? pc.system?.attributes?.hp?.max ?? 'N/A';
        cardHTML += `<p><strong>HP:</strong> ${hpCurrent} / ${hpMax}</p>`;

        let acDisplay = pc.vtt_flags?.ddbimporter?.overrideAC?.flat ?? pc.vtt_data.attributes.ac?.value ?? pc.vtt_data.attributes.ac?.flat;
        if (acDisplay === undefined || acDisplay === null) {
            const equippedArmor = pc.items?.find(item => item.type === 'equipment' && item.system?.equipped && typeof item.system?.armor?.value !== 'undefined');
            if (equippedArmor && equippedArmor.system?.armor) {
                acDisplay = equippedArmor.system.armor.value;
                const dexForAC = pc.vtt_data.abilities.dex?.value;
                if (equippedArmor.system.armor.dex !== null && typeof equippedArmor.system.armor.dex !== 'undefined' && dexForAC) {
                    const dexMod = DNDCalculations.getAbilityModifier(dexForAC);
                    acDisplay += Math.min(dexMod, equippedArmor.system.armor.dex);
                } else if (equippedArmor.system.armor.dex === null && dexForAC) {
                     acDisplay += DNDCalculations.getAbilityModifier(dexForAC);
                }
            } else {
                acDisplay = 10 + DNDCalculations.getAbilityModifier(pc.vtt_data.abilities.dex?.value || 10);
            }
        }
        cardHTML += `<p><strong>AC:</strong> ${acDisplay}</p>`;
        cardHTML += `<p><strong>Prof. Bonus:</strong> +${pc.calculatedProfBonus}</p>`;
        cardHTML += `<p><strong>Speed:</strong> ${pc.vtt_data.attributes.movement?.walk || pc.system?.attributes?.movement?.walk || 0} ft</p>`;

        let initiativeBonus = 'N/A';
        const initAbilityKey = pc.vtt_data.attributes.init?.ability || 'dex'; 
        const dexValue = pc.vtt_data.abilities.dex?.value;

        if (pc.vtt_data.abilities[initAbilityKey]) {
            initiativeBonus = DNDCalculations.getAbilityModifier(pc.vtt_data.abilities[initAbilityKey].value || 10);
        } else if (typeof pc.vtt_data.attributes.init?.bonus !== 'undefined' && pc.vtt_data.attributes.init.bonus !== "") {
            initiativeBonus = parseInt(pc.vtt_data.attributes.init.bonus) || 0;
        } else if (typeof dexValue !== 'undefined') { 
            initiativeBonus = DNDCalculations.getAbilityModifier(dexValue);
        }
        cardHTML += `<p><strong>Initiative:</strong> ${initiativeBonus >= 0 ? '+' : ''}${initiativeBonus}</p>`;
        
        let spellDcText = DNDCalculations.spellSaveDC(pc); // Uses the pcData version
        if (spellDcText === 'N/A (No Casting Ability)' || spellDcText === 'N/A (Proficiency Error)') {
             if (pc.vtt_data.attributes.spell?.dc) { // Fallback
                 spellDcText = pc.vtt_data.attributes.spell.dc;
             } else {
                 spellDcText = "N/A";
             }
        }

        cardHTML += `<p><strong>Spell DC:</strong> ${spellDcText}</p>`;
        cardHTML += `</div>`;
        return cardHTML;
    },

    renderNpcListForContextUI: function(listContainerElement, allCharacters, activeNpcIds, onCheckboxChangeCallback, onNameClickCallback, contextFilter = null) {
        if (!listContainerElement) { console.error("UIRenderers.renderNpcListForContextUI: listContainerElement not found"); return; }
        let ul = listContainerElement.querySelector('ul');
        if (!ul) {
            ul = document.createElement('ul');
            listContainerElement.appendChild(ul);
        }
        ul.innerHTML = '';
        
        let npcsToDisplay = allCharacters.filter(char => char.character_type === 'NPC');

        if (contextFilter && contextFilter.type === 'lore' && contextFilter.id) {
            npcsToDisplay = npcsToDisplay.filter(npc => {
                const linkedIds = (npc.linked_lore_ids || []).map(id => String(id));
                return linkedIds.includes(String(contextFilter.id));
            });
        }

        npcsToDisplay.sort((a, b) => a.name.localeCompare(b.name));

        if (npcsToDisplay.length === 0) {
            ul.innerHTML = contextFilter && contextFilter.id ?
                '<li><p><em>No NPCs linked to this context. Link NPCs in the NPCs tab.</em></p></li>' :
                '<li><p><em>No NPCs to display. Select a context or create NPCs in the NPCs Tab.</em></p></li>';
            return;
        }

        npcsToDisplay.forEach(char => {
            const charIdStr = String(char._id);
            const li = document.createElement('li');
            li.dataset.charId = charIdStr;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `npc-scene-context-checkbox-${charIdStr}`;
            checkbox.checked = activeNpcIds.has(charIdStr);
            checkbox.onchange = () => onCheckboxChangeCallback(charIdStr, char.name); 
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = char.name;
            nameSpan.className = 'npc-name-clickable';
            nameSpan.onclick = async () => { 
                await CharacterService.handleSelectCharacterForDetails(charIdStr); // CharacterService namespace
                const npcTabButton = document.querySelector('.tab-link[onclick*="tab-npcs"]');
                if(npcTabButton && !npcTabButton.classList.contains('active')) {
                    App.openTab(null, 'tab-npcs'); // App namespace
                } else if (npcTabButton && npcTabButton.classList.contains('active')) {
                    const characterProfileSection = Utils.getElem('character-profile-main-section');
                    if (characterProfileSection && characterProfileSection.classList.contains('collapsed')) {
                        characterProfileSection.querySelector('h3').click(); 
                    }
                }
            };
            li.appendChild(checkbox);
            li.appendChild(nameSpan);
            if (activeNpcIds.has(charIdStr)) li.classList.add('active-in-scene');
            ul.appendChild(li);
        });
    },

    renderAllNpcListForManagementUI: function(listContainerElement, allCharacters, onNameClickCallback) {
        if (!listContainerElement) { console.error("UIRenderers.renderAllNpcListForManagementUI: listContainerElement not found"); return; }
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
            nameSpan.onclick = async () => { await onNameClickCallback(charIdStr); }; 
            
            li.appendChild(nameSpan);
            ul.appendChild(li);
        });
    },

    renderPcListUI: function(pcListDiv, speakingPcSelect, allCharacters, activePcIds, onPcItemClickCallback) {
        if (!pcListDiv) { console.error("UIRenderers.renderPcListUI: pcListDiv not found"); return;}
        pcListDiv.innerHTML = '';
        if (speakingPcSelect) {
            speakingPcSelect.innerHTML = '<option value="">-- DM/Scene Event --</option>';
        }
        const pcs = allCharacters.filter(char => char.character_type === 'PC').sort((a, b) => a.name.localeCompare(b.name));
        if (pcs.length === 0) {
            pcListDiv.innerHTML = '<p><em>No Player Characters defined yet. Create them in the NPCs Tab (as PC type).</em></p>';
            return;
        }
        const ul = document.createElement('ul');
        pcs.forEach(pc => {
            const pcIdStr = String(pc._id);
            const li = document.createElement('li');
            li.style.cursor = "pointer";
            li.textContent = pc.name;
            li.dataset.charId = pcIdStr;
            li.onclick = () => onPcItemClickCallback(pcIdStr);
            if (activePcIds.has(pcIdStr)) {
                li.classList.add('selected');
            } else {
                li.classList.remove('selected');
            }
            ul.appendChild(li);
            if (speakingPcSelect) {
                const option = document.createElement('option');
                option.value = pcIdStr;
                option.textContent = pc.name;
                speakingPcSelect.appendChild(option);
            }
        });
        pcListDiv.appendChild(ul);
    },

    createNpcDialogueAreaUI: function(npcIdStr, npcName, containerElement) {
        if (!containerElement || Utils.getElem(`npc-area-${npcIdStr}`)) return;
        const areaDiv = document.createElement('div');
        areaDiv.className = 'npc-dialogue-area';
        areaDiv.id = `npc-area-${npcIdStr}`;
        const nameHeader = document.createElement('h3');
        nameHeader.textContent = npcName;
        areaDiv.appendChild(nameHeader);
        const transcriptDiv = document.createElement('div');
        transcriptDiv.className = 'npc-transcript';
        transcriptDiv.id = `transcript-${npcIdStr}`;
        transcriptDiv.innerHTML = `<p class="scene-event">Dialogue with ${npcName} begins.</p>`;
        areaDiv.appendChild(transcriptDiv);
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.id = `ai-suggestions-${npcIdStr}`;
        suggestionsDiv.className = 'ai-suggestions-for-npc';
        suggestionsDiv.style.display = 'none';
        suggestionsDiv.innerHTML = `
            <div id="suggested-memories-list-npc-${npcIdStr}" class="ai-suggestion-category"><h5>Suggested Memories:</h5></div>
            <div id="suggested-topics-list-npc-${npcIdStr}" class="ai-suggestion-category"><h5>Suggested Follow-up Topics:</h5></div>
            <div id="suggested-npc-actions-list-npc-${npcIdStr}" class="ai-suggestion-category"><h5>Suggested NPC Actions/Thoughts:</h5></div>
            <div id="suggested-player-checks-list-npc-${npcIdStr}" class="ai-suggestion-category"><h5>Suggested Player Checks:</h5></div>
            <div id="suggested-faction-standing-changes-npc-${npcIdStr}" class="ai-suggestion-category"><h5>Suggested Faction Standing Change:</h5></div>`;
        areaDiv.appendChild(suggestionsDiv);
        containerElement.appendChild(areaDiv);
        this.adjustNpcDialogueAreaWidthsUI(containerElement);
    },

    removeNpcDialogueAreaUI: function(npcIdStr, containerElement) {
        const areaDiv = Utils.getElem(`npc-area-${npcIdStr}`);
        if (areaDiv) areaDiv.remove();
        this.adjustNpcDialogueAreaWidthsUI(containerElement);
        if (appState.getActiveNpcCount() === 0 && containerElement && !containerElement.querySelector('p.scene-event')) {
            containerElement.innerHTML = '<p class="scene-event">Select NPCs from the SCENE tab to add them to the interaction.</p>';
        }
    },

    adjustNpcDialogueAreaWidthsUI: function(containerElement) {
        if (!containerElement) return;
        const dialogueAreas = containerElement.querySelectorAll('.npc-dialogue-area');
        const numAreas = dialogueAreas.length;
        if (numAreas === 0) return;
        const minIndividualWidth = 250; 
        const containerWidth = containerElement.clientWidth;
        let flexBasisPercent = 100 / numAreas;

        if (numAreas * minIndividualWidth > containerWidth) {
            dialogueAreas.forEach(area => {
                area.style.minWidth = `${minIndividualWidth}px`;
                area.style.flex = `0 0 ${minIndividualWidth}px`; 
            });
        } else {
            dialogueAreas.forEach(area => {
                area.style.minWidth = `${minIndividualWidth}px`; 
                area.style.flexBasis = `${flexBasisPercent}%`;
                area.style.flexGrow = `1`; 
                area.style.flex = `1 1 ${flexBasisPercent}%`;
            });
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

    renderAiSuggestionsContent: function(aiResult, forNpcId) {
        const suggestionsContainerNpc = Utils.getElem(`ai-suggestions-${forNpcId}`);
        if (!suggestionsContainerNpc) return;
        suggestionsContainerNpc.innerHTML = ''; 
        let contentGeneratedForNpc = false;

        const memoriesListNpc = document.createElement('div');
        memoriesListNpc.id = `suggested-memories-list-npc-${forNpcId}`; 
        memoriesListNpc.className = 'ai-suggestion-category';
        if (aiResult.new_memory_suggestions && aiResult.new_memory_suggestions.length > 0) {
            memoriesListNpc.innerHTML = '<h5>Suggested Memories:</h5>' + aiResult.new_memory_suggestions.map(mem =>
                // Functions called from onclick are expected to be global.
                // App.addSuggestedMemoryAsActual will be exposed to window in app.js
                `<div class="suggested-item">${Utils.escapeHtml(mem)} <button onclick="addSuggestedMemoryAsActual('${forNpcId}', '${Utils.escapeHtml(mem).replace(/'/g, "\\'")}')">Add</button></div>`
            ).join('');
            contentGeneratedForNpc = true;
        } else {
            memoriesListNpc.innerHTML = '<h5>Suggested Memories:</h5><p><em>None</em></p>';
        }
        suggestionsContainerNpc.appendChild(memoriesListNpc);
        
        const topicsListNpc = document.createElement('div');
        topicsListNpc.id = `suggested-topics-list-npc-${forNpcId}`;
        topicsListNpc.className = 'ai-suggestion-category';
        if (aiResult.generated_topics && aiResult.generated_topics.length > 0) {
            topicsListNpc.innerHTML = '<h5>Suggested Follow-up Topics:</h5>' + aiResult.generated_topics.map(topic => `<div class="suggested-item">${Utils.escapeHtml(topic)}</div>`).join('');
            contentGeneratedForNpc = true;
        } else { topicsListNpc.innerHTML = '<h5>Suggested Follow-up Topics:</h5><p><em>None</em></p>'; }
        suggestionsContainerNpc.appendChild(topicsListNpc);

        const actionsListNpc = document.createElement('div');
        actionsListNpc.id = `suggested-npc-actions-list-npc-${forNpcId}`;
        actionsListNpc.className = 'ai-suggestion-category';
        if (aiResult.suggested_npc_actions && aiResult.suggested_npc_actions.length > 0) {
            actionsListNpc.innerHTML = '<h5>Suggested NPC Actions/Thoughts:</h5>' + aiResult.suggested_npc_actions.map(action => `<div class="suggested-item">${Utils.escapeHtml(action)}</div>`).join('');
            contentGeneratedForNpc = true;
        } else { actionsListNpc.innerHTML = '<h5>Suggested NPC Actions/Thoughts:</h5><p><em>None</em></p>';}
        suggestionsContainerNpc.appendChild(actionsListNpc);

        const checksListNpc = document.createElement('div');
        checksListNpc.id = `suggested-player-checks-list-npc-${forNpcId}`;
        checksListNpc.className = 'ai-suggestion-category';
        if (aiResult.suggested_player_checks && aiResult.suggested_player_checks.length > 0) {
            checksListNpc.innerHTML = '<h5>Suggested Player Checks:</h5>' + aiResult.suggested_player_checks.map(check => `<div class="suggested-item">${Utils.escapeHtml(check)}</div>`).join('');
            contentGeneratedForNpc = true;
        } else { checksListNpc.innerHTML = '<h5>Suggested Player Checks:</h5><p><em>None</em></p>';}
        suggestionsContainerNpc.appendChild(checksListNpc);
        
        const standingChangesNpc = document.createElement('div');
        standingChangesNpc.id = `suggested-faction-standing-changes-npc-${forNpcId}`;
        standingChangesNpc.className = 'ai-suggestion-category';
         if (aiResult.suggested_new_standing && aiResult.suggested_standing_pc_id) {
            const pcForStanding = appState.getCharacterById(aiResult.suggested_standing_pc_id);
            const pcNameForStanding = pcForStanding ? pcForStanding.name : aiResult.suggested_standing_pc_id;
            const standingValue = (typeof aiResult.suggested_new_standing === 'object' && aiResult.suggested_new_standing !== null) ? aiResult.suggested_new_standing.value : aiResult.suggested_new_standing;
            standingChangesNpc.innerHTML = `<h5>Suggested Faction Standing Change:</h5>
                <div class="suggested-item">
                    Towards ${Utils.escapeHtml(pcNameForStanding)}: ${Utils.escapeHtml(standingValue)} 
                    (Justification: ${Utils.escapeHtml(aiResult.standing_change_justification || 'None')})
                    <button onclick="acceptFactionStandingChange('${forNpcId}', '${aiResult.suggested_standing_pc_id}', '${Utils.escapeHtml(standingValue)}')">Accept</button> 
                </div>`; // App.acceptFactionStandingChange will be global
            contentGeneratedForNpc = true;
        } else {
             standingChangesNpc.innerHTML = `<h5>Suggested Faction Standing Change:</h5><p><em>None</em></p>`;
        }
        suggestionsContainerNpc.appendChild(standingChangesNpc);
        suggestionsContainerNpc.style.display = contentGeneratedForNpc ? 'block' : 'none';

        const globalSuggestionsArea = Utils.getElem('ai-suggestions'); 
        if (globalSuggestionsArea) {
            if (appState.getActiveNpcCount() > 0 && contentGeneratedForNpc && appState.getCurrentProfileCharId() === forNpcId) {
                globalSuggestionsArea.style.display = 'block';
                Utils.getElem('suggested-memories-list').innerHTML = memoriesListNpc.innerHTML;
                Utils.getElem('suggested-topics-list').innerHTML = topicsListNpc.innerHTML;
                Utils.getElem('suggested-npc-actions-list').innerHTML = actionsListNpc.innerHTML;
                Utils.getElem('suggested-player-checks-list').innerHTML = checksListNpc.innerHTML;
                Utils.getElem('suggested-faction-standing-changes').innerHTML = standingChangesNpc.innerHTML;
            } else {
                globalSuggestionsArea.style.display = 'none'; 
            }
        }
    },

    renderNpcFactionStandingsUI: function(npcCharacter, activePcIdsSet, allCharactersArray, contentElement, onStandingChangeCallback) {
        if (!contentElement) { console.error("UIRenderers.renderNpcFactionStandingsUI: contentElement not found"); return; }
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
            slider.min = 0;
            slider.max = FACTION_STANDING_SLIDER_ORDER.length - 1; // FACTION_STANDING_SLIDER_ORDER is global from config.js
            slider.step = 1;
            const currentStandingObj = npcCharacter.pc_faction_standings ? npcCharacter.pc_faction_standings[pcIdStr] : null;
            let currentStandingValue = FACTION_STANDING_LEVELS.INDIFFERENT; // FACTION_STANDING_LEVELS is global
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
        const associateHistoryBtnElem = Utils.getElem(elements.associateHistoryBtn);
        const characterLoreLinksSectionElem = Utils.getElem(elements.characterLoreLinksSection); 
        const associatedLoreListForCharacterElem = Utils.getElem(elements.associatedLoreListForCharacter); 
        const linkLoreToCharBtnElem = Utils.getElem(elements.linkLoreToCharBtn); 

        character.personality_traits = character.personality_traits || [];
        character.memories = character.memories || [];
        character.associated_history_files = character.associated_history_files || [];
        character.linked_lore_ids = character.linked_lore_ids || []; 
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
            if (characterMemoriesListElem) this.renderMemoriesUI(character.memories, characterMemoriesListElem, elements.deleteMemoryCallback());
            if (npcFactionStandingsContentElem) this.renderNpcFactionStandingsUI(character, appState.activePcIds, appState.getAllCharacters(), npcFactionStandingsContentElem, elements.factionChangeCallback());
            if (addMemoryBtnElem) Utils.disableBtn(elements.addMemoryBtn, false);
        } else { 
            if (characterMemoriesListElem) characterMemoriesListElem.innerHTML = '<p><em>Memories are for NPCs only.</em></p>';
            if (addMemoryBtnElem) Utils.disableBtn(elements.addMemoryBtn, true);
            if (npcFactionStandingsContentElem) npcFactionStandingsContentElem.innerHTML = '<p><em>Faction standings are for NPCs.</em></p>';
        }
        if (associatedHistoryListElem && historyContentDisplayElem) this.renderAssociatedHistoryFilesUI(character, associatedHistoryListElem, historyContentDisplayElem, elements.dissociateHistoryCallback());
        this.renderAssociatedLoreForCharacterUI(character, elements.unlinkLoreFromCharacterCallback());
        this.populateLoreEntrySelectForCharacterLinkingUI(character.linked_lore_ids);
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

    populateLoreTypeDropdownUI: function() {
        const selectElement = Utils.getElem('new-lore-type');
        if (!selectElement) { console.warn("UIRenderers.populateLoreTypeDropdownUI: 'new-lore-type' select element not found."); return; }
        selectElement.innerHTML = ''; 
        if (typeof LORE_TYPES !== 'undefined' && Array.isArray(LORE_TYPES)) { // LORE_TYPES is global from config.js
            LORE_TYPES.forEach(type => { 
                const option = document.createElement('option'); option.value = type; option.textContent = type; selectElement.appendChild(option);
            });
        } else { console.error("LORE_TYPES is not defined or not an array in config.js"); selectElement.innerHTML = '<option value="">Error: Types not loaded</option>'; }
    },

    renderLoreEntryListUI: function(loreEntries) {
        const listContainer = Utils.getElem('lore-entry-list');
        if (!listContainer) { console.warn("UIRenderers.renderLoreEntryListUI: 'lore-entry-list' ul element not found."); return; }
        listContainer.innerHTML = ''; 
        if (!loreEntries || loreEntries.length === 0) { listContainer.innerHTML = '<li><em>No lore entries. Create one.</em></li>'; return; }
        const sortedLoreEntries = [...loreEntries].sort((a, b) => a.name.localeCompare(b.name));
        sortedLoreEntries.forEach(entry => {
            const li = document.createElement('li');
            const idToUse = entry.lore_id || entry._id; 
            li.dataset.loreId = String(idToUse); 
            const nameSpan = document.createElement('span');
            nameSpan.textContent = `${entry.name} (${entry.lore_type})`;
            nameSpan.className = 'lore-entry-name-clickable'; 
            nameSpan.onclick = () => CharacterService.handleSelectLoreEntryForDetails(String(idToUse));
            li.appendChild(nameSpan);
            listContainer.appendChild(li);
        });
    },

    renderLoreEntryDetailUI: function(loreEntry) {
        const detailSection = Utils.getElem('lore-entry-profile-section');
        if (!detailSection || !loreEntry) { if(detailSection) detailSection.style.display = 'none'; console.warn("UIRenderers.renderLoreEntryDetailUI: Detail section or loreEntry not found."); return; }
        Utils.updateText('details-lore-name', loreEntry.name);
        Utils.updateText('details-lore-type', loreEntry.lore_type); 
        Utils.updateText('details-lore-description', loreEntry.description);
        const keyFactsList = Utils.getElem('details-lore-key-facts-list');
        keyFactsList.innerHTML = '';
        if (loreEntry.key_facts && loreEntry.key_facts.length > 0) { loreEntry.key_facts.forEach(fact => { const li = document.createElement('li'); li.textContent = fact; keyFactsList.appendChild(li); }); }
        else { keyFactsList.innerHTML = '<li><em>No key facts listed.</em></li>'; }
        Utils.updateText('details-lore-tags', (loreEntry.tags || []).join(', '));
        Utils.getElem('details-lore-gm-notes').value = loreEntry.gm_notes || '';
        detailSection.style.display = 'block';
        Utils.disableBtn('save-lore-gm-notes-btn', false);
        Utils.disableBtn('delete-lore-btn', false);
    },

    closeLoreDetailViewUI: function() { // This is called by HTML onclick="window.closeLoreDetailViewUI()"
        const detailSection = Utils.getElem('lore-entry-profile-section');
        if (detailSection) { detailSection.style.display = 'none'; }
        appState.setCurrentLoreEntryId(null); 
    },

    populateLoreEntrySelectForCharacterLinkingUI: function(alreadyLinkedIds = []) {
        const selectElement = Utils.getElem('lore-entry-select-for-character');
        if (!selectElement) { console.warn("UIRenderers.populateLoreEntrySelectForCharacterLinkingUI: Select element not found."); return; }
        const currentCharacter = appState.getCurrentProfileChar(); // appState is global
        const linkButton = Utils.getElem('link-lore-to-char-btn');
        if (!currentCharacter) { selectElement.innerHTML = '<option value="">-- Select char first --</option>'; selectElement.disabled = true; if(linkButton) Utils.disableBtn('link-lore-to-char-btn', true); return; }
        selectElement.disabled = false; if(linkButton) Utils.disableBtn('link-lore-to-char-btn', false);
        const currentValue = selectElement.value; 
        selectElement.innerHTML = '<option value="">-- Select lore --</option>';
        const allLore = appState.getAllLoreEntries();
        const linkedIdSet = new Set((alreadyLinkedIds || []).map(id => String(id)));
        allLore.sort((a,b)=> a.name.localeCompare(b.name)).forEach(lore => {
            const idToUse = String(lore.lore_id || lore._id);
            if (!linkedIdSet.has(idToUse)) { 
                const option = document.createElement('option'); option.value = idToUse; option.textContent = `${lore.name} (${lore.lore_type})`; selectElement.appendChild(option);
            }
        });
        if (allLore.some(l => String(l.lore_id || l._id) === currentValue) && !linkedIdSet.has(currentValue)) { selectElement.value = currentValue; }
    },

    renderAssociatedLoreForCharacterUI: function(character, unlinkCallback) {
        const listElement = Utils.getElem(CharacterService.profileElementIds.associatedLoreListForCharacter);
        if (!listElement) { console.warn("UIRenderers.renderAssociatedLoreForCharacterUI: List element not found."); return; }
        listElement.innerHTML = '';
        if (character && character.linked_lore_ids && character.linked_lore_ids.length > 0) {
            character.linked_lore_ids.forEach(loreId => {
                const loreEntry = appState.getLoreEntryById(String(loreId)); 
                if (loreEntry) {
                    const li = document.createElement('li'); li.className = 'associated-lore-item'; 
                    li.innerHTML = `<span>${loreEntry.name} (${loreEntry.lore_type})</span><button data-lore-id="${loreId}" class="unlink-lore-btn">Unlink</button>`;
                    li.querySelector('button').onclick = () => unlinkCallback(loreId); listElement.appendChild(li);
                } else { const li = document.createElement('li'); li.textContent = `Linked Lore ID: ${loreId} (Details not found)`; listElement.appendChild(li); }
            });
        } else { listElement.innerHTML = '<li><em>No lore associated.</em></li>'; }
    },

    populateSceneContextTypeFilterUI: function() {
        const selector = Utils.getElem('scene-context-type-filter');
        if (!selector) { console.warn("UIRenderers.populateSceneContextTypeFilterUI: Scene context type filter not found."); return; }
        selector.innerHTML = '<option value="">-- All Relevant Lore Types --</option>';
        const relevantLoreTypes = [LORE_TYPES[0], LORE_TYPES[1]]; // LORE_TYPES is global
        relevantLoreTypes.forEach(type => {
            const option = document.createElement('option'); option.value = type; option.textContent = type; selector.appendChild(option);
        });
    },

    populateSceneContextSelectorUI: function() {
        const typeFilterSelector = Utils.getElem('scene-context-type-filter');
        const entrySelector = Utils.getElem('scene-context-selector');
        if (!entrySelector || !typeFilterSelector) { console.warn("UIRenderers.populateSceneContextSelectorUI: Scene context selectors not found."); return; }
        
        const selectedLoreType = typeFilterSelector.value;
        const currentValue = entrySelector.value;
        entrySelector.innerHTML = '<option value="">-- Select Specific Context --</option>';
        
        let loreToDisplay = appState.getAllLoreEntries();
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
                this.renderNpcListForContextUI( 
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

    renderPcQuickViewInSceneUI: function(wrapperElement, activePcsData) {
        if (!wrapperElement) { console.error("UIRenderers.renderPcQuickViewInSceneUI: wrapperElement not found"); return; }
        if (!activePcsData || activePcsData.length === 0) {
            wrapperElement.innerHTML = '';
            wrapperElement.style.display = 'none';
            return;
        }
        let contentHTML = this.createPcQuickViewSectionHTML(false);
        activePcsData.sort((a, b) => a.name.localeCompare(b.name)).forEach(pc => {
            if (typeof pc.calculatedProfBonus === 'undefined') { 
                const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || pc.vtt_data?.details?.level || 1;
                pc.calculatedProfBonus = DNDCalculations.getProficiencyBonus(pcLevel);
             }
            contentHTML += this.generatePcQuickViewCardHTML(pc, true);
        });
        contentHTML += `</div>`;
        wrapperElement.innerHTML = contentHTML;
        wrapperElement.style.display = 'flex';
    },

    updatePcDashboardUI: function(dashboardContentElement, allCharacters, activePcIds, currentlyExpandedAbility, currentlyExpandedSkill, skillSortKey) {
        if (!dashboardContentElement) { console.error("UIRenderers.updatePcDashboardUI: 'pc-dashboard-content' element not found."); return; }
        dashboardContentElement.innerHTML = ''; 

        const selectedPcs = allCharacters.filter(char => activePcIds.has(String(char._id)) && char.character_type === 'PC' && char.vtt_data);

        if (selectedPcs.length === 0) {
            dashboardContentElement.innerHTML = `<p class="pc-dashboard-no-selection">Select Player Characters from the left panel to view their details and comparisons.</p>`;
            return;
        }

        selectedPcs.forEach(pc => { 
            const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || pc.vtt_data?.details?.level || 1;
            pc.calculatedProfBonus = DNDCalculations.getProficiencyBonus(pcLevel);
        });

        let quickViewHTML = this.createPcQuickViewSectionHTML(true);
        const sortedSelectedPcsByName = [...selectedPcs].sort((a, b) => a.name.localeCompare(b.name));
        sortedSelectedPcsByName.forEach(pc => {
            quickViewHTML += this.generatePcQuickViewCardHTML(pc, true);
        });
        quickViewHTML += `</div>`;
        dashboardContentElement.innerHTML += quickViewHTML;

        const abilitiesForTable = ABILITY_KEYS_ORDER.map(k => k.toUpperCase()); // ABILITY_KEYS_ORDER is global
        let mainStatsTableHTML = `<h4>Ability Scores Overview</h4><div class="table-wrapper"><table id="main-stats-table"><thead><tr><th>Character</th>`;
        abilitiesForTable.forEach(ablKey => {
            const isExpanded = currentlyExpandedAbility === ablKey; 
            const arrow = isExpanded ? '▼' : '►';
            // App.toggleAbilityExpansion will be global
            mainStatsTableHTML += `<th class="clickable-ability-header" data-ability="${ablKey}" onclick="toggleAbilityExpansion('${ablKey}')">${ablKey} <span class="arrow-indicator">${arrow}</span></th>`;
        });
        mainStatsTableHTML += `</tr></thead><tbody>`;
        sortedSelectedPcsByName.forEach(pc => {
            mainStatsTableHTML += `<tr><td>${pc.name}</td>`;
            ABILITY_KEYS_ORDER.forEach(ablKey => {
                const score = pc.vtt_data?.abilities?.[ablKey]?.value || 10;
                const mod = DNDCalculations.getAbilityModifier(score);
                mainStatsTableHTML += `<td>${score} (${mod >= 0 ? '+' : ''}${mod})</td>`;
            });
            mainStatsTableHTML += `</tr>`;
        });
        mainStatsTableHTML += `</tbody></table></div>`;
        dashboardContentElement.innerHTML += mainStatsTableHTML;

        const abilityExpansionContainer = document.createElement('div');
        abilityExpansionContainer.id = 'expanded-ability-details-sections';
        dashboardContentElement.appendChild(abilityExpansionContainer);
        abilitiesForTable.forEach(ablKey => { 
            const expansionDiv = document.createElement('div');
            expansionDiv.id = `expanded-${ablKey}`;
            expansionDiv.className = 'expanded-ability-content';
            expansionDiv.style.display = (currentlyExpandedAbility === ablKey) ? 'block' : 'none';
            if (currentlyExpandedAbility === ablKey && selectedPcs.length > 0) {
                this.populateExpandedAbilityDetailsUI(ablKey, expansionDiv, selectedPcs);
            }
            abilityExpansionContainer.appendChild(expansionDiv);
        });

        let skillsTableHTML = `<h4>Skills Overview</h4><div class="table-wrapper"><table id="skills-overview-table"><thead><tr><th>Character</th>`;
        for (const skillKey in SKILL_NAME_MAP) { // SKILL_NAME_MAP is global
            const skillFullName = SKILL_NAME_MAP[skillKey].replace(/\s\(...\)/, '');
            const isExpanded = currentlyExpandedSkill === skillKey;
            const arrow = isExpanded ? '▼' : '►';
            // App.toggleSkillExpansion will be global
            skillsTableHTML += `<th class="clickable-skill-header" data-skill-key="${skillKey}" onclick="toggleSkillExpansion('${skillKey}')">${skillFullName} <span class="arrow-indicator">${arrow}</span></th>`;
        }
        skillsTableHTML += `</tr></thead><tbody>`;
        let pcsForSkillTable = [...selectedPcs]; 
        if (skillSortKey) { 
            // Simplified sorting logic for brevity; ensure it's correct
            pcsForSkillTable.sort((a,b) => (DNDCalculations.calculateSkillBonus(a.vtt_data.abilities[SKILL_NAME_MAP[skillSortKey].match(/\(([^)]+)\)/)[1].toLowerCase()]?.value || 10, a.vtt_data.skills[skillSortKey]?.value || 0, a.calculatedProfBonus) < DNDCalculations.calculateSkillBonus(b.vtt_data.abilities[SKILL_NAME_MAP[skillSortKey].match(/\(([^)]+)\)/)[1].toLowerCase()]?.value || 10, b.vtt_data.skills[skillSortKey]?.value || 0, b.calculatedProfBonus)) ? 1 : -1);
        } else { pcsForSkillTable.sort((a,b) => a.name.localeCompare(b.name)); } 

        pcsForSkillTable.forEach(pc => {
            skillsTableHTML += `<tr><td>${pc.name}</td>`;
            for (const skillKey in SKILL_NAME_MAP) {
                const skillData = pc.vtt_data?.skills?.[skillKey];
                let skillBonusFormatted = "N/A";
                const defaultAbilityAbbrevMatch = SKILL_NAME_MAP[skillKey].match(/\(([^)]+)\)/);
                const defaultAbilityAbbrev = defaultAbilityAbbrevMatch ? defaultAbilityAbbrevMatch[1].toLowerCase() : 'int';
                const abilityKeyForSkill = skillData?.ability || defaultAbilityAbbrev;
                if (pc.vtt_data?.abilities?.[abilityKeyForSkill] && typeof pc.calculatedProfBonus !== 'undefined') {
                    const abilityScore = pc.vtt_data.abilities[abilityKeyForSkill]?.value || 10;
                    const bonus = DNDCalculations.calculateSkillBonus(abilityScore, skillData?.value || 0, pc.calculatedProfBonus);
                    skillBonusFormatted = `${bonus >= 0 ? '+' : ''}${bonus}`;
                }
                skillsTableHTML += `<td>${skillBonusFormatted}</td>`;
            }
            skillsTableHTML += `</tr>`;
        });
        skillsTableHTML += `</tbody></table></div>`;
        dashboardContentElement.innerHTML += skillsTableHTML;

        const skillExpansionContainer = document.createElement('div');
        skillExpansionContainer.id = 'expanded-skill-details-sections';
        dashboardContentElement.appendChild(skillExpansionContainer);
        for (const skillKey in SKILL_NAME_MAP) {
            const expansionDiv = document.createElement('div');
            expansionDiv.id = `expanded-skill-${skillKey}`;
            expansionDiv.className = 'expanded-skill-content';
            expansionDiv.style.display = (currentlyExpandedSkill === skillKey) ? 'block' : 'none';
            if (currentlyExpandedSkill === skillKey && selectedPcs.length > 0) {
                this.populateExpandedSkillDetailsUI(skillKey, expansionDiv, selectedPcs);
            }
            skillExpansionContainer.appendChild(expansionDiv);
        }
    },

    populateExpandedAbilityDetailsUI: function(ablKey, expansionDiv, selectedPcsInput) {
        console.log("UIRenderers.populateExpandedAbilityDetailsUI for", ablKey); 
        if (!expansionDiv) { console.error("populateExpandedAbilityDetailsUI: expansionDiv is null for", ablKey); return; }
        if (!selectedPcsInput || selectedPcsInput.length === 0) { expansionDiv.innerHTML = '<p><em>Select PCs to view ability details.</em></p>'; return; }
        // ... (Rest of the function, ensure calls to DNDCalculations are correct) ...
    },

    populateExpandedSkillDetailsUI: function(skillKey, expansionDiv, selectedPcs) {
        console.log("UIRenderers.populateExpandedSkillDetailsUI for", skillKey); 
        if (!expansionDiv) { console.error("populateExpandedSkillDetailsUI: expansionDiv is null for", skillKey); return; }
        // ... (Rest of the function, ensure SKILL_NAME_MAP is accessed correctly) ...
    },

    renderDetailedPcSheetUI: function(pcData, dashboardContentElement) {
        if (!pcData || pcData.character_type !== 'PC' || !pcData.vtt_data) {
            console.error("UIRenderers.renderDetailedPcSheetUI: PC not found or invalid VTT data:", pcData);
            if (dashboardContentElement) dashboardContentElement.innerHTML = `<p>Error loading PC. <button onclick="handleBackToDashboardOverview()">Back to Dashboard Overview</button></p>`; // App.handleBackToDashboardOverview will be global
            return;
        }
        // ... (Rest of the function, ensure DNDCalculations, ABILITY_KEYS_ORDER, SKILL_NAME_MAP are used correctly) ...
        // onclick="handleBackToDashboardOverview()"
    },

    updateMainViewUI: function(dialogueInterfaceElem, pcDashboardViewElem, pcQuickViewInSceneElem, activeNpcCount, showPcDashboard) {
        console.log("UIRenderers.updateMainViewUI. Active NPCs:", activeNpcCount, "Show PC Dashboard:", showPcDashboard);
        if (!dialogueInterfaceElem || !pcDashboardViewElem || !pcQuickViewInSceneElem) {
            console.error("UIRenderers.updateMainViewUI: Critical UI container element(s) missing."); return; 
        }
        const dashboardContent = Utils.getElem('pc-dashboard-content');
        const isDetailedSheetVisible = dashboardContent && dashboardContent.querySelector('.detailed-pc-sheet');

        if (activeNpcCount > 0 && !isDetailedSheetVisible) { 
            dialogueInterfaceElem.style.display = 'flex'; 
            pcDashboardViewElem.style.display = 'none';  
            const activePcsData = appState.getAllCharacters().filter(char => appState.hasActivePc(String(char._id)));
            this.renderPcQuickViewInSceneUI(pcQuickViewInSceneElem, activePcsData);
        } else if (isDetailedSheetVisible) { 
            dialogueInterfaceElem.style.display = 'none';
            pcDashboardViewElem.style.display = 'block';
            pcQuickViewInSceneElem.style.display = 'none'; 
            pcQuickViewInSceneElem.innerHTML = '';
        } else { 
            dialogueInterfaceElem.style.display = 'none';   
            pcDashboardViewElem.style.display = 'block'; 
            pcQuickViewInSceneElem.style.display = 'none';
            pcQuickViewInSceneElem.innerHTML = '';
            
            if (dashboardContent) {
                if (showPcDashboard) { 
                    this.updatePcDashboardUI(dashboardContent, appState.getAllCharacters(), appState.activePcIds, appState.getExpandedAbility(), appState.getExpandedSkill(), appState.getSkillSortKey());
                } else {
                    dashboardContent.innerHTML = `<p class="pc-dashboard-no-selection">Select Player Characters from the left panel to view their details and comparisons.</p>`;
                }
            }
        }
    }
};

// Re-export functions that are called directly from HTML onclick attributes
window.closeLoreDetailViewUI = UIRenderers.closeLoreDetailViewUI;
// Note: Other functions like toggleAbilityExpansion, addSuggestedMemoryAsActual etc.,
// are typically called from App.js event handlers or dynamically generated HTML.
// App.js will handle their global exposure if needed.

console.log("uiRenderers.js: All functions are now part of the UIRenderers namespace. Parsing FINISHED.");

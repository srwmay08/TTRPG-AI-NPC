// static/uiRenderers.js

console.log("uiRenderers.js: Parsing STARTED");

var UIRenderers = {
    createPcQuickViewSectionHTML: function(isForDashboard) {
        // MODIFICATION: This function will now ONLY return the H4 title element.
        const titleText = PC_QUICK_VIEW_BASE_TITLE;
        const fullTitle = isForDashboard ? `${titleText} (Click card for details)` : titleText;
        return `<h4>${fullTitle}</h4>`;
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
        pc.vtt_data.attributes.spell = pc.vtt_data.attributes.spell || {}; // Ensure spell attribute exists
        pc.vtt_data.details = pc.vtt_data.details || {};
        pc.vtt_data.skills = pc.vtt_data.skills || {};
        pc.vtt_data.traits = pc.vtt_data.traits || { languages: {}, armorProf: {}, weaponProf: {}};
        pc.items = pc.items || [];
        pc.system = pc.system || {}; // Ensure 'system' (full FVTT data) is initialized

        const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || pc.vtt_data?.details?.level || 1;
        if (typeof pc.calculatedProfBonus === 'undefined') {
            pc.calculatedProfBonus = DNDCalculations.getProficiencyBonus(pcLevel);
        }

        let cardClasses = 'pc-stat-card';
        let dataAttributes = '';
        if (isClickableForDetailedView || pc.character_type === 'PC') {
            cardClasses += ' clickable-pc-card';
            dataAttributes = `data-pc-id="${String(pc._id)}"`;
        }

        let cardHTML = `<div class="${cardClasses}" ${dataAttributes}>`;
        cardHTML += `<h4>${pc.name} (Lvl ${pcLevel})</h4>`;

        const hpCurrent = pc.vtt_data.attributes.hp?.value ?? pc.system?.attributes?.hp?.value ?? 'N/A';
        const hpMax = pc.vtt_data.attributes.hp?.max ?? pc.system?.attributes?.hp?.max ?? 'N/A';
        cardHTML += `<p><strong>HP:</strong> ${hpCurrent} / ${hpMax}</p>`;

        const acDisplayValue = DNDCalculations.calculateDisplayAC(pc);
        cardHTML += `<p><strong>AC:</strong> ${acDisplayValue}</p>`;

        cardHTML += `<p><strong>Prof. Bonus:</strong> +${pc.calculatedProfBonus}</p>`;

        let initiativeBonus = 'N/A';
        const initAbilityKey = pc.vtt_data.attributes.init?.ability || pc.system?.attributes?.init?.ability || 'dex';
        const abilitiesSourceForInit = pc.vtt_data.abilities[initAbilityKey] ? pc.vtt_data.abilities : (pc.system?.abilities || {});
        const abilityValueForInit = abilitiesSourceForInit[initAbilityKey]?.value;

        if (typeof abilityValueForInit !== 'undefined') {
            initiativeBonus = DNDCalculations.getAbilityModifier(abilityValueForInit);
        } else if (typeof (pc.vtt_data.attributes.init?.bonus ?? pc.system?.attributes?.init?.bonus) !== 'undefined' && (pc.vtt_data.attributes.init?.bonus ?? pc.system?.attributes?.init?.bonus) !== "") {
            initiativeBonus = parseInt(pc.vtt_data.attributes.init?.bonus ?? pc.system?.attributes?.init?.bonus) || 0;
        }
        const initBonusFromAttributes = parseInt(pc.vtt_data.attributes.init?.bonus ?? pc.system?.attributes?.init?.bonus);
        if (!isNaN(initBonusFromAttributes) && typeof abilityValueForInit === 'undefined') { // if only bonus is defined, use it
             initiativeBonus = initBonusFromAttributes;
        } else if (!isNaN(initBonusFromAttributes) && typeof abilityValueForInit !== 'undefined'){ // if both are defined, add them
            initiativeBonus += initBonusFromAttributes;
        }


        cardHTML += `<p><strong>Initiative:</strong> ${initiativeBonus >= 0 ? '+' : ''}${initiativeBonus}</p>`;
        cardHTML += `<p><strong>Speed:</strong> ${pc.vtt_data.attributes.movement?.walk || pc.system?.attributes?.movement?.walk || 0} ft</p>`;
        
        let spellDcText = DNDCalculations.spellSaveDC(pc);
         if (spellDcText === 'N/A (No Casting Ability)' || spellDcText === 'N/A (Proficiency Error)') {
             if (pc.vtt_data.attributes.spell?.dc ?? pc.system?.attributes?.spell?.dc) {
                 spellDcText = pc.vtt_data.attributes.spell?.dc ?? pc.system?.attributes?.spell?.dc;
             } else {
                 spellDcText = "N/A";
             }
        }
        cardHTML += `<p><strong>Spell DC:</strong> ${spellDcText}</p>`;
        
        let spellAtkBonusText = DNDCalculations.spellAttackBonus(pc);
        if (spellAtkBonusText === 'N/A (No Casting Ability)' || spellAtkBonusText === 'N/A (Proficiency Error)') {
            spellAtkBonusText = "N/A"; // Or try to get from attributes if available, similar to DC
        }
        cardHTML += `<p><strong>Spell Atk:</strong> +${spellAtkBonusText}</p>`;


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

        // Apply context filter if one is active
        if (contextFilter && contextFilter.type === 'lore' && contextFilter.id) {
            npcsToDisplay = npcsToDisplay.filter(npc => {
                const linkedIds = (npc.linked_lore_ids || []).map(id => String(id));
                return linkedIds.includes(String(contextFilter.id));
            });
        }
        // If no filter is selected (contextFilter is null or contextFilter.id is null/empty), all NPCs are shown by default (no additional filtering needed here)

        npcsToDisplay.sort((a, b) => a.name.localeCompare(b.name));

        if (npcsToDisplay.length === 0) {
            ul.innerHTML = (contextFilter && contextFilter.id) ?
                '<li><p><em>No NPCs linked to this specific context. Link NPCs in the NPCs Tab.</em></p></li>' :
                '<li><p><em>No NPCs to display. Create NPCs in the NPCs Tab or clear context filters.</em></p></li>';
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
                await CharacterService.handleSelectCharacterForDetails(charIdStr);
                const npcTabButton = document.querySelector('.tab-link[onclick*="tab-npcs"]');
                if(npcTabButton && !npcTabButton.classList.contains('active')) {
                    App.openTab(null, 'tab-npcs');
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
                </div>`;
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
        if (typeof LORE_TYPES !== 'undefined' && Array.isArray(LORE_TYPES)) {
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

    closeLoreDetailViewUI: function() {
        const detailSection = Utils.getElem('lore-entry-profile-section');
        if (detailSection) { detailSection.style.display = 'none'; }
        appState.setCurrentLoreEntryId(null);
    },

    populateLoreEntrySelectForCharacterLinkingUI: function(alreadyLinkedIds = []) {
        const selectElement = Utils.getElem('lore-entry-select-for-character');
        if (!selectElement) { console.warn("UIRenderers.populateLoreEntrySelectForCharacterLinkingUI: Select element not found."); return; }
        const currentCharacter = appState.getCurrentProfileChar();
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
        const relevantLoreTypes = [LORE_TYPES[0], LORE_TYPES[1]];
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
                    null // No specific context, should show all NPCs by default
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

        // MODIFICATION: Build the title and card grid as separate sibling elements.
        let titleHTML = this.createPcQuickViewSectionHTML(false);
        let cardsHTML = '';
        activePcsData.sort((a, b) => a.name.localeCompare(b.name)).forEach(pc => {
            if (typeof pc.calculatedProfBonus === 'undefined') {
                const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || pc.vtt_data?.details?.level || 1;
                pc.calculatedProfBonus = DNDCalculations.getProficiencyBonus(pcLevel);
             }
            cardsHTML += this.generatePcQuickViewCardHTML(pc, true);
        });
        
        // Place the title OUTSIDE and BEFORE the card grid container.
        wrapperElement.innerHTML = titleHTML + `<div class="pc-dashboard-grid">${cardsHTML}</div>`;
        wrapperElement.style.display = 'block'; // The container should be a simple block.
    },

updatePcDashboardUI: function(dashboardContentElement, allCharacters, activePcIds, currentlyExpandedAbility, currentlyExpandedSkill, skillSortKey) {
        if (!dashboardContentElement) { console.error("UIRenderers.updatePcDashboardUI: 'pc-dashboard-content' element not found."); return; }

        let finalHTML = ''; // We will build the entire dashboard HTML here.

        const selectedPcs = allCharacters.filter(char => activePcIds.has(String(char._id)) && char.character_type === 'PC' && (char.vtt_data || char.system));

        if (selectedPcs.length === 0) {
            dashboardContentElement.innerHTML = `<p class="pc-dashboard-no-selection">Select Player Characters from the left panel to view their details and comparisons.</p>`;
            return;
        }
        
        let sortedSelectedPcs = [...selectedPcs];
        if (currentlyExpandedAbility === 'STR') {
             sortedSelectedPcs.sort((a,b) => {
                const scoreA = (a.vtt_data?.abilities?.str?.value ?? a.system?.abilities?.str?.value) || 10;
                const scoreB = (b.vtt_data?.abilities?.str?.value ?? b.system?.abilities?.str?.value) || 10;
                return scoreB - scoreA;
            });
        } else {
            sortedSelectedPcs.sort((a, b) => a.name.localeCompare(b.name));
        }

        sortedSelectedPcs.forEach(pc => {
            const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || pc.vtt_data?.details?.level || 1;
            pc.calculatedProfBonus = DNDCalculations.getProficiencyBonus(pcLevel);
        });

        // --- NEW HTML STRUCTURE ---
        // 1. Add the H4 title directly.
        finalHTML += this.createPcQuickViewSectionHTML(true);

        // 2. Build the cards and wrap them in the grid container.
        let cardsHTML = '';
        sortedSelectedPcs.forEach(pc => {
            cardsHTML += this.generatePcQuickViewCardHTML(pc, true);
        });
        finalHTML += `<div class="pc-dashboard-grid">${cardsHTML}</div>`;
        // --- END NEW STRUCTURE ---

        // 3. Build the rest of the tables.
        const abilitiesForTable = ABILITY_KEYS_ORDER.map(k => k.toUpperCase());
        let mainStatsTableHTML = `<h4>Ability Scores Overview</h4><div class="table-wrapper"><table id="main-stats-table"><thead><tr><th>Character</th>`;
        abilitiesForTable.forEach(ablKey => {
            const isExpanded = currentlyExpandedAbility === ablKey;
            const arrow = isExpanded ? '▼' : '►';
            mainStatsTableHTML += `<th class="clickable-ability-header" data-ability="${ablKey}" onclick="toggleAbilityExpansion('${ablKey}')">${ablKey} <span class="arrow-indicator">${arrow}</span></th>`;
        });
        mainStatsTableHTML += `</tr></thead><tbody>`;
        sortedSelectedPcs.forEach(pc => {
            mainStatsTableHTML += `<tr><td>${pc.name}</td>`;
            ABILITY_KEYS_ORDER.forEach(ablKey => {
                const score = (pc.vtt_data?.abilities?.[ablKey]?.value ?? pc.system?.abilities?.[ablKey]?.value) || 10;
                const mod = DNDCalculations.getAbilityModifier(score);
                mainStatsTableHTML += `<td>${score} (${mod >= 0 ? '+' : ''}${mod})</td>`;
            });
            mainStatsTableHTML += `</tr>`;
        });
        mainStatsTableHTML += `</tbody></table></div>`;
        finalHTML += mainStatsTableHTML;

        let skillsTableHTML = `<h4>Skills Overview</h4><div class="table-wrapper"><table id="skills-overview-table"><thead><tr><th>Character</th>`;
        let pcsForSkillTable = [...sortedSelectedPcs]; 
        if (skillSortKey && skillSortKey !== 'STR') {
            pcsForSkillTable.sort((a,b) => {
                const skillAData = a.vtt_data?.skills?.[skillSortKey] ?? a.system?.skills?.[skillSortKey];
                const skillBData = b.vtt_data?.skills?.[skillSortKey] ?? b.system?.skills?.[skillSortKey];
                const skillANameParts = SKILL_NAME_MAP[skillSortKey].match(/\(([^)]+)\)/);
                const skillAAbilityKey = (skillAData?.ability || (skillANameParts ? skillANameParts[1].toLowerCase() : 'int'));
                const skillBNameParts = SKILL_NAME_MAP[skillSortKey].match(/\(([^)]+)\)/);
                const skillBAbilityKey = (skillBData?.ability || (skillBNameParts ? skillBNameParts[1].toLowerCase() : 'int'));

                const valA = DNDCalculations.calculateSkillBonus(
                    (a.vtt_data?.abilities?.[skillAAbilityKey]?.value ?? a.system?.abilities?.[skillAAbilityKey]?.value) || 10,
                    skillAData?.value || 0,
                    a.calculatedProfBonus
                );
                const valB = DNDCalculations.calculateSkillBonus(
                    (b.vtt_data?.abilities?.[skillBAbilityKey]?.value ?? b.system?.abilities?.[skillBAbilityKey]?.value) || 10,
                    skillBData?.value || 0,
                    b.calculatedProfBonus
                );
                return valB - valA;
            });
        } else if (!skillSortKey && currentlyExpandedAbility !== 'STR') {
             pcsForSkillTable.sort((a,b) => a.name.localeCompare(b.name));
        }

        for (const skillKey in SKILL_NAME_MAP) {
            const skillFullName = SKILL_NAME_MAP[skillKey].replace(/\s\(...\)/, '');
            const isExpanded = currentlyExpandedSkill === skillKey;
            const arrow = isExpanded ? '▼' : '►';
            skillsTableHTML += `<th class="clickable-skill-header" data-skill-key="${skillKey}" onclick="toggleSkillExpansion('${skillKey}')">${skillFullName} <span class="arrow-indicator">${arrow}</span></th>`;
        }
        skillsTableHTML += `</tr></thead><tbody>`;

        pcsForSkillTable.forEach(pc => {
            skillsTableHTML += `<tr><td>${pc.name}</td>`;
            for (const skillKey in SKILL_NAME_MAP) {
                const skillData = pc.vtt_data?.skills?.[skillKey] ?? pc.system?.skills?.[skillKey];
                let skillBonusFormatted = "N/A";
                const defaultAbilityAbbrevMatch = SKILL_NAME_MAP[skillKey].match(/\(([^)]+)\)/);
                const defaultAbilityAbbrev = defaultAbilityAbbrevMatch ? defaultAbilityAbbrevMatch[1].toLowerCase() : 'int';
                const abilityKeyForSkill = skillData?.ability || defaultAbilityAbbrev;
                const abilitiesSource = pc.vtt_data?.abilities ?? pc.system?.abilities;

                if (abilitiesSource?.[abilityKeyForSkill] && typeof pc.calculatedProfBonus !== 'undefined') {
                    const abilityScore = abilitiesSource[abilityKeyForSkill]?.value || 10;
                    const bonus = DNDCalculations.calculateSkillBonus(abilityScore, skillData?.value || 0, pc.calculatedProfBonus);
                    skillBonusFormatted = `${bonus >= 0 ? '+' : ''}${bonus}`;
                }
                skillsTableHTML += `<td>${skillBonusFormatted}</td>`;
            }
            skillsTableHTML += `</tr>`;
        });
        skillsTableHTML += `</tbody></table></div>`;
        finalHTML += skillsTableHTML;

        dashboardContentElement.innerHTML = finalHTML;

        // 4. Append dynamic expansion containers last.
        const abilityExpansionContainer = document.createElement('div');
        abilityExpansionContainer.id = 'expanded-ability-details-sections';
        dashboardContentElement.appendChild(abilityExpansionContainer);
        abilitiesForTable.forEach(ablKey => {
            const expansionDiv = document.createElement('div');
            expansionDiv.id = `expanded-${ablKey}`;
            expansionDiv.className = 'expanded-ability-content';
            expansionDiv.style.display = (currentlyExpandedAbility === ablKey) ? 'block' : 'none';
            if (currentlyExpandedAbility === ablKey && selectedPcs.length > 0) {
                this.populateExpandedAbilityDetailsUI(ablKey, expansionDiv, sortedSelectedPcs);
            }
            abilityExpansionContainer.appendChild(expansionDiv);
        });

        const skillExpansionContainer = document.createElement('div');
        skillExpansionContainer.id = 'expanded-skill-details-sections';
        dashboardContentElement.appendChild(skillExpansionContainer);
        for (const skillKey in SKILL_NAME_MAP) {
            const expansionDiv = document.createElement('div');
            expansionDiv.id = `expanded-skill-${skillKey}`;
            expansionDiv.className = 'expanded-skill-content';
            expansionDiv.style.display = (currentlyExpandedSkill === skillKey) ? 'block' : 'none';
            if (currentlyExpandedSkill === skillKey && selectedPcs.length > 0) {
                this.populateExpandedSkillDetailsUI(skillKey, expansionDiv, pcsForSkillTable);
            }
            skillExpansionContainer.appendChild(expansionDiv);
        }
    },

    populateExpandedAbilityDetailsUI: function(ablKey, expansionDiv, selectedPcsInput) {
        console.log("UIRenderers.populateExpandedAbilityDetailsUI for", ablKey);
        if (!expansionDiv) { console.error("populateExpandedAbilityDetailsUI: expansionDiv is null for", ablKey); return; }
        
        let sortedPcs = [...selectedPcsInput]; // Use the passed-in list which might already be sorted by STR
        if (ablKey.toLowerCase() !== 'str') { // If not STR, sort by the current ability for this display
            sortedPcs.sort((a, b) => {
                const scoreA = (a.vtt_data?.abilities?.[ablKey.toLowerCase()]?.value ?? a.system?.abilities?.[ablKey.toLowerCase()]?.value) || 10;
                const scoreB = (b.vtt_data?.abilities?.[ablKey.toLowerCase()]?.value ?? b.system?.abilities?.[ablKey.toLowerCase()]?.value) || 10;
                return scoreB - scoreA;
            });
        }


        if (!sortedPcs || sortedPcs.length === 0) { expansionDiv.innerHTML = '<p><em>Select PCs to view ability details.</em></p>'; return; }

        expansionDiv.innerHTML = `<h5>${ablKey.toUpperCase()} Score Details & Comparisons</h5>`;
        const barChartContainer = document.createElement('div');
        barChartContainer.className = 'ability-bar-chart-container';
        expansionDiv.appendChild(barChartContainer);
        sortedPcs.forEach(pc => {
            const abilitiesSource = pc.vtt_data?.abilities ?? pc.system?.abilities;
            const score = abilitiesSource?.[ablKey.toLowerCase()]?.value || 10;
            const mod = DNDCalculations.getAbilityModifier(score);
            barChartContainer.innerHTML += UIRenderers.generateBarChartRowHTML(pc.name, score, mod, 20, 10);
        });

        // Table for derived stats based on the ability
        let derivedTableHTML = `<h5>${ablKey.toUpperCase()} Derived Stats & Skills</h5><table class="detailed-pc-ability-table">`;
        derivedTableHTML += `<thead><tr><th>PC Name</th>`;

        // Add relevant skill headers for this ability
        for (const skillKey in SKILL_NAME_MAP) {
            const skillNameParts = SKILL_NAME_MAP[skillKey].match(/\(([^)]+)\)/);
            const skillAbilityKey = skillNameParts ? skillNameParts[1].toLowerCase() : 'int';
            if (skillAbilityKey === ablKey.toLowerCase()) {
                derivedTableHTML += `<th>${SKILL_NAME_MAP[skillKey].replace(/\s\(...\)/, '')} Bonus</th>`;
            }
        }
        // Add other derived stat headers
        if (ablKey.toLowerCase() === 'str') {
            derivedTableHTML += `<th>Melee Atk (STR)</th><th>Melee Dmg (STR)</th><th>Carry Cap.</th><th>Push/Drag/Lift</th><th>Encumbered At</th><th>Heavily Enc. At</th>`;
        } else if (ablKey.toLowerCase() === 'dex') {
            derivedTableHTML += `<th>AC (Unarmored)</th><th>Initiative Bonus</th><th>Finesse Atk (DEX)</th><th>Ranged Atk (DEX)</th>`;
        } else if (ablKey.toLowerCase() === 'con') {
            derivedTableHTML += `<th>HP Bonus/Lvl</th><th>Hold Breath</th>`;
        } else if (ablKey.toLowerCase() === 'wis') {
             // Passive perception is now on quick card, specific wisdom skills handled in skill loop
        }
        // INT and CHA have skills but fewer unique derived stats not covered by skills or general spellcasting stats
        derivedTableHTML += `</tr></thead><tbody>`;

        sortedPcs.forEach(pc => {
            derivedTableHTML += `<tr><td>${pc.name}</td>`;
            const abilitiesSource = pc.vtt_data?.abilities ?? pc.system?.abilities;
            const score = abilitiesSource?.[ablKey.toLowerCase()]?.value || 10;
            const mod = DNDCalculations.getAbilityModifier(score);

            for (const skillKey in SKILL_NAME_MAP) {
                const skillNameParts = SKILL_NAME_MAP[skillKey].match(/\(([^)]+)\)/);
                const skillAbilityKey = skillNameParts ? skillNameParts[1].toLowerCase() : 'int';
                if (skillAbilityKey === ablKey.toLowerCase()) {
                    const skillData = pc.vtt_data?.skills?.[skillKey] ?? pc.system?.skills?.[skillKey];
                    const bonus = DNDCalculations.calculateSkillBonus(score, skillData?.value || 0, pc.calculatedProfBonus);
                    derivedTableHTML += `<td>${bonus >= 0 ? '+' : ''}${bonus}</td>`;
                }
            }

            if (ablKey.toLowerCase() === 'str') {
                derivedTableHTML += `<td>${mod + pc.calculatedProfBonus >= 0 ? '+' : ''}${mod + pc.calculatedProfBonus}</td>`; // Melee Atk
                derivedTableHTML += `<td>${mod >= 0 ? '+' : ''}${mod}</td>`; // Melee Dmg
                derivedTableHTML += `<td>${DNDCalculations.carryingCapacity(score)} lbs</td>`;
                derivedTableHTML += `<td>${DNDCalculations.pushDragLift(score)} lbs</td>`;
                derivedTableHTML += `<td>${DNDCalculations.carryingCapacity(score)/3} lbs</td>`; // Encumbered
                derivedTableHTML += `<td>${(DNDCalculations.carryingCapacity(score)/3)*2} lbs</td>`; // Heavily Encumbered

            } else if (ablKey.toLowerCase() === 'dex') {
                const dexScoreForAC = (pc.vtt_data?.abilities?.dex?.value ?? pc.system?.abilities?.dex?.value) || 10;
                const conScoreForAC = (pc.vtt_data?.abilities?.con?.value ?? pc.system?.abilities?.con?.value) || 10;
                const wisScoreForAC = (pc.vtt_data?.abilities?.wis?.value ?? pc.system?.abilities?.wis?.value) || 10;
                let acDesc = DNDCalculations.getUnarmoredAC(DNDCalculations.getAbilityModifier(dexScoreForAC)); // Default
                const classNames = DNDCalculations.getCharacterClassNames(pc);
                if(classNames.includes('monk')) acDesc = DNDCalculations.getMonkUnarmoredAC(DNDCalculations.getAbilityModifier(dexScoreForAC), DNDCalculations.getAbilityModifier(wisScoreForAC));
                else if(classNames.includes('barbarian')) acDesc = DNDCalculations.getBarbarianUnarmoredAC(DNDCalculations.getAbilityModifier(dexScoreForAC), DNDCalculations.getAbilityModifier(conScoreForAC));

                derivedTableHTML += `<td>${acDesc}</td>`;
                const initiativeBonus = DNDCalculations.getAbilityModifier((pc.vtt_data?.abilities?.[pc.vtt_data?.attributes?.init?.ability || 'dex']?.value ?? pc.system?.abilities?.[pc.system?.attributes?.init?.ability || 'dex']?.value) || 10) + (parseInt(pc.vtt_data?.attributes?.init?.bonus ?? pc.system?.attributes?.init?.bonus) || 0);
                derivedTableHTML += `<td>${initiativeBonus >= 0 ? '+' : ''}${initiativeBonus}</td>`;
                derivedTableHTML += `<td>${mod + pc.calculatedProfBonus >= 0 ? '+' : ''}${mod + pc.calculatedProfBonus}</td>`; // Finesse Atk
                derivedTableHTML += `<td>${mod + pc.calculatedProfBonus >= 0 ? '+' : ''}${mod + pc.calculatedProfBonus}</td>`; // Ranged Atk

            } else if (ablKey.toLowerCase() === 'con') {
                derivedTableHTML += `<td>${mod >= 0 ? '+' : ''}${mod}</td>`;
                derivedTableHTML += `<td>${DNDCalculations.holdBreath(score)}</td>`;
            }
            derivedTableHTML += `</tr>`;
        });
        derivedTableHTML += `</tbody></table>`;
        expansionDiv.innerHTML += derivedTableHTML;
    },

    populateExpandedSkillDetailsUI: function(skillKey, expansionDiv, selectedPcs) {
        console.log("UIRenderers.populateExpandedSkillDetailsUI for", skillKey);
        if (!expansionDiv) { console.error("populateExpandedSkillDetailsUI: expansionDiv is null for", skillKey); return; }
        const skillFullName = SKILL_NAME_MAP[skillKey] || skillKey;
        expansionDiv.innerHTML = `<h5>${skillFullName} Bonus Details & Comparisons</h5>`;

        const barChartContainer = document.createElement('div');
        barChartContainer.className = 'skill-bar-chart-container';
        expansionDiv.appendChild(barChartContainer);

        selectedPcs.forEach(pc => {
            const skillData = pc.vtt_data?.skills?.[skillKey] ?? pc.system?.skills?.[skillKey];
            const defaultAbilityAbbrevMatch = SKILL_NAME_MAP[skillKey].match(/\(([^)]+)\)/);
            const defaultAbilityAbbrev = defaultAbilityAbbrevMatch ? defaultAbilityAbbrevMatch[1].toLowerCase() : 'int';
            const abilityKeyForSkill = skillData?.ability || defaultAbilityAbbrev;
            const abilitiesSource = pc.vtt_data?.abilities ?? pc.system?.abilities;
            const abilityScore = abilitiesSource?.[abilityKeyForSkill]?.value || 10;
            const bonus = DNDCalculations.calculateSkillBonus(abilityScore, skillData?.value || 0, pc.calculatedProfBonus);
            barChartContainer.innerHTML += UIRenderers.generateBarChartRowHTML(pc.name, bonus, bonus, 10, 0);
        });
         expansionDiv.innerHTML += `<p><em>Passive ${skillFullName}: Calculated as 10 + Skill Bonus.</em></p>`;
    },

    generateBarChartRowHTML: function(pcName, value, modifier, maxValue = 20, neutralValue = 10) {
        const modDisplay = modifier >= 0 ? `+${modifier}` : modifier;
        const percentage = ((value - (neutralValue - (maxValue - neutralValue))) / (2 * (maxValue - neutralValue))) * 100;
        const zeroOffsetPercentage = ((neutralValue - (neutralValue - (maxValue - neutralValue))) / (2 * (maxValue - neutralValue))) * 100;

        let barLeft, barWidth;
        if (value >= neutralValue) {
            barLeft = `${zeroOffsetPercentage}%`;
            barWidth = `${Math.min(100 - zeroOffsetPercentage, ((value - neutralValue) / (maxValue - neutralValue)) * (100-zeroOffsetPercentage) )}%`;
             return `<div class="pc-bar-row"><span class="stat-comparison-pc-name">${pcName}</span><div class="stat-bar-wrapper" style="--zero-offset: ${zeroOffsetPercentage}%"><div class="stat-bar positive" style="--bar-left: ${barLeft}; --bar-width: ${barWidth};">${value} (${modDisplay})</div></div></div>`;
        } else {
            barWidth = `${Math.min(zeroOffsetPercentage, ((neutralValue - value) / (neutralValue - (neutralValue - (maxValue-neutralValue)*2) )) * zeroOffsetPercentage )}%`;
            barLeft = `${zeroOffsetPercentage - parseFloat(barWidth)}%`;
             return `<div class="pc-bar-row"><span class="stat-comparison-pc-name">${pcName}</span><div class="stat-bar-wrapper" style="--zero-offset: ${zeroOffsetPercentage}%"><div class="stat-bar negative" style="--bar-left: ${barLeft}; --bar-width: ${barWidth};">${value} (${modDisplay})</div></div></div>`;
        }
    },

    renderDetailedPcSheetUI: function(pcData, dashboardContentElement) {
        if (!pcData || pcData.character_type !== 'PC' || !(pcData.vtt_data || pcData.system)) {
            console.error("UIRenderers.renderDetailedPcSheetUI: PC not found or invalid VTT data:", pcData);
            if (dashboardContentElement) dashboardContentElement.innerHTML = `<p>Error loading PC. <button onclick="handleBackToDashboardOverview()">Back to Dashboard Overview</button></p>`;
            return;
        }
        dashboardContentElement.innerHTML = ''; 

        const pcLevel = pcData.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pcData.system?.details?.level || pcData.vtt_data?.details?.level || 1;
        pcData.calculatedProfBonus = DNDCalculations.getProficiencyBonus(pcLevel);


        let sheetHTML = `<div class="detailed-pc-sheet">
            <button class="close-detailed-pc-sheet-btn" onclick="handleBackToDashboardOverview()" title="Back to Dashboard Overview">&times;</button>
            <h3>${pcData.name} - Level ${pcLevel} ${pcData.vtt_data?.details?.race || pcData.system?.details?.race || ''} ${pcData.vtt_data?.details?.originalClass || DNDCalculations.getCharacterClassNames(pcData).join('/') || ''}</h3>`;

        // Abilities Table
        sheetHTML += `<div class="pc-section"><h4>Ability Scores</h4><div class="table-wrapper"><table class="detailed-pc-ability-table"><thead><tr>`;
        ABILITY_KEYS_ORDER.forEach(key => sheetHTML += `<th>${key.toUpperCase()}</th>`);
        sheetHTML += `</tr></thead><tbody><tr>`;
        ABILITY_KEYS_ORDER.forEach(key => {
            const score = (pcData.vtt_data?.abilities?.[key]?.value ?? pcData.system?.abilities?.[key]?.value) || 10;
            sheetHTML += `<td>${score}</td>`;
        });
        sheetHTML += `</tr><tr>`;
        ABILITY_KEYS_ORDER.forEach(key => {
            const score = (pcData.vtt_data?.abilities?.[key]?.value ?? pcData.system?.abilities?.[key]?.value) || 10;
            const mod = DNDCalculations.getAbilityModifier(score);
            sheetHTML += `<td>(${mod >= 0 ? '+' : ''}${mod})</td>`;
        });
        sheetHTML += `</tr></tbody></table></div></div>`;


        // Derived Combat Stats Section
        sheetHTML += `<div class="pc-section"><h4>Derived Combat Stats</h4><table class="detailed-pc-table">`;
        const ac = DNDCalculations.calculateDisplayAC(pcData);
        const initiative = DNDCalculations.getAbilityModifier((pcData.vtt_data?.abilities?.[pcData.vtt_data?.attributes?.init?.ability || 'dex']?.value ?? pcData.system?.abilities?.[pcData.system?.attributes?.init?.ability || 'dex']?.value) || 10) + (parseInt(pcData.vtt_data?.attributes?.init?.bonus ?? pcData.system?.attributes?.init?.bonus) || 0);
        const speed = pcData.vtt_data?.attributes?.movement?.walk ?? pcData.system?.attributes?.movement?.walk ?? 30;
        const spellDC = DNDCalculations.spellSaveDC(pcData);
        const spellAtk = DNDCalculations.spellAttackBonus(pcData);

        sheetHTML += `<tr><th>Armor Class</th><td>${ac}</td></tr>`;
        sheetHTML += `<tr><th>Initiative</th><td>${initiative >= 0 ? '+' : ''}${initiative}</td></tr>`;
        sheetHTML += `<tr><th>Speed</th><td>${speed} ft</td></tr>`;
        sheetHTML += `<tr><th>Proficiency Bonus</th><td>+${pcData.calculatedProfBonus}</td></tr>`;
        sheetHTML += `<tr><th>Spell Save DC</th><td>${spellDC}</td></tr>`;
        sheetHTML += `<tr><th>Spell Attack Bonus</th><td>+${spellAtk}</td></tr>`;
        sheetHTML += `</table></div>`;

        // Skills & Other Stats by Ability
        ABILITY_KEYS_ORDER.forEach(ablKey => {
            sheetHTML += `<div class="pc-section"><h4>${ablKey.toUpperCase()} Based Skills & Stats</h4><table class="detailed-pc-table">`;
            const abilitiesSource = pcData.vtt_data?.abilities ?? pcData.system?.abilities;
            const score = abilitiesSource?.[ablKey]?.value || 10;
            const mod = DNDCalculations.getAbilityModifier(score);

            // Skills for this ability
            for (const skillKey in SKILL_NAME_MAP) {
                const skillNameParts = SKILL_NAME_MAP[skillKey].match(/\(([^)]+)\)/);
                const skillAbilityKeyFromMap = skillNameParts ? skillNameParts[1].toLowerCase() : 'int';
                if (skillAbilityKeyFromMap === ablKey) {
                    const skillData = pcData.vtt_data?.skills?.[skillKey] ?? pcData.system?.skills?.[skillKey];
                    const proficiencyValue = skillData?.value || 0;
                    const bonus = DNDCalculations.calculateSkillBonus(score, proficiencyValue, pcData.calculatedProfBonus);
                    const passive = DNDCalculations.calculatePassiveSkill(score, proficiencyValue, pcData.calculatedProfBonus);
                    sheetHTML += `<tr><td>${SKILL_NAME_MAP[skillKey].replace(/\s\(...\)/, '')}</td><td>Bonus: ${bonus >= 0 ? '+' : ''}${bonus}</td><td>Passive: ${passive}</td></tr>`;
                }
            }
            // Other derived stats for this ability
            if (ablKey === 'str') {
                sheetHTML += `<tr><td>Melee Attack (STR)</td><td colspan="2">${mod + pcData.calculatedProfBonus >= 0 ? '+' : ''}${mod + pcData.calculatedProfBonus}</td></tr>`;
                sheetHTML += `<tr><td>Melee Damage (STR)</td><td colspan="2">${mod >= 0 ? '+' : ''}${mod}</td></tr>`;
                sheetHTML += `<tr><td>Carry Capacity</td><td colspan="2">${DNDCalculations.carryingCapacity(score)} lbs</td></tr>`;
                sheetHTML += `<tr><td>Push/Drag/Lift</td><td colspan="2">${DNDCalculations.pushDragLift(score)} lbs</td></tr>`;
                 sheetHTML += `<tr><td>Encumbered At</td><td colspan="2">${Math.floor(DNDCalculations.carryingCapacity(score)/3)} lbs</td></tr>`;
                sheetHTML += `<tr><td>Heavily Encumbered At</td><td colspan="2">${Math.floor((DNDCalculations.carryingCapacity(score)/3)*2)} lbs</td></tr>`;
            } else if (ablKey === 'dex') {
                 // AC and Initiative are in derived stats section
                sheetHTML += `<tr><td>Finesse Attack (DEX)</td><td colspan="2">${mod + pcData.calculatedProfBonus >= 0 ? '+' : ''}${mod + pcData.calculatedProfBonus}</td></tr>`;
                sheetHTML += `<tr><td>Ranged Attack (DEX)</td><td colspan="2">${mod + pcData.calculatedProfBonus >= 0 ? '+' : ''}${mod + pcData.calculatedProfBonus}</td></tr>`;
            } else if (ablKey === 'con') {
                sheetHTML += `<tr><td>HP Bonus/Level</td><td colspan="2">${mod >= 0 ? '+' : ''}${mod}</td></tr>`;
                sheetHTML += `<tr><td>Hold Breath</td><td colspan="2">${DNDCalculations.holdBreath(score)}</td></tr>`;
            }
            // WIS, INT, CHA primarily have skills listed above. Spellcasting stats are in derived combat stats.
            sheetHTML += `</table></div>`;
        });


        // Other Details: Traits, Languages, Proficiencies
        sheetHTML += `<div class="pc-section"><h4>Other Details</h4>`;
        sheetHTML += `<p><strong>Alignment:</strong> ${pcData.vtt_data?.details?.alignment || pcData.system?.details?.alignment || 'N/A'}</p>`;
        sheetHTML += `<p><strong>Background:</strong> ${pcData.vtt_data?.details?.background || pcData.system?.details?.background || 'N/A'}</p>`;
        const languages = pcData.vtt_data?.traits?.languages?.value?.map(lang => lang.charAt(0).toUpperCase() + lang.slice(1)).join(', ') || pcData.system?.traits?.languages?.value?.map(lang => lang.charAt(0).toUpperCase() + lang.slice(1)).join(', ') || 'None';
        sheetHTML += `<p><strong>Languages:</strong> ${languages}</p>`;

        const armorProfs = pcData.vtt_data?.traits?.armorProf?.value?.join(', ') || pcData.system?.traits?.armorProf?.value?.join(', ') || 'None';
        sheetHTML += `<p><strong>Armor Proficiencies:</strong> ${armorProfs}</p>`;
        const weaponProfs = pcData.vtt_data?.traits?.weaponProf?.value?.join(', ') || pcData.system?.traits?.weaponProf?.value?.join(', ') || 'None';
        sheetHTML += `<p><strong>Weapon Proficiencies:</strong> ${weaponProfs}</p>`;
        sheetHTML += `</div>`;


        sheetHTML += `</div>`;
        dashboardContentElement.innerHTML = sheetHTML;
    },

    updateMainViewUI: function(dialogueInterfaceElem, pcDashboardViewElem, pcQuickViewInSceneElem, activeNpcCount, showPcDashboard) {
        console.log("UIRenderers.updateMainViewUI. Active NPCs:", activeNpcCount, "Show PC Dashboard:", showPcDashboard);
        if (!dialogueInterfaceElem || !pcDashboardViewElem || !pcQuickViewInSceneElem) {
            console.error("UIRenderers.updateMainViewUI: Critical UI container element(s) missing."); return;
        }
        const dashboardContent = Utils.getElem('pc-dashboard-content');
        const isDetailedSheetVisible = dashboardContent && dashboardContent.querySelector('.detailed-pc-sheet');

        if (activeNpcCount > 0 && !isDetailedSheetVisible) {
            // THIS IS THE CHANGE: 'flex' becomes 'block'
            dialogueInterfaceElem.style.display = 'block';
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
        Utils.disableBtn('generate-dialogue-btn', activeNpcCount === 0);
        console.log("App.js: App.updateMainView finished.");
    }
};

window.closeLoreDetailViewUI = UIRenderers.closeLoreDetailViewUI;

console.log("uiRenderers.js: All functions are now part of the UIRenderers namespace. Parsing FINISHED.");
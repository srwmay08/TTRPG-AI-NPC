// static/uiRenderers.js
// All functions intended for global access are explicitly prefixed with window.

console.log("uiRenderers.js: Parsing STARTED");

window.createPcQuickViewSectionHTML = function(isForDashboard) {
    const titleText = PC_QUICK_VIEW_BASE_TITLE; // From config.js
    const fullTitle = isForDashboard ? `${titleText} (Click card for details)` : titleText;
    return `<h4>${fullTitle}</h4><div class="pc-dashboard-grid">`;
};

window.generatePcQuickViewCardHTML = function(pc, isClickableForDetailedView = false) {
    if (!pc) return '';
    pc.vtt_data = pc.vtt_data || { abilities: {}, attributes: { hp: {}, ac: {}, movement: {}, init: {}, spell: {} }, details: {}, skills: {}, traits: { languages: {}, armorProf: {}, weaponProf: {}} };
    pc.vtt_data.abilities = pc.vtt_data.abilities || {};
    pc.vtt_data.attributes = pc.vtt_data.attributes || { hp: {}, ac: {}, movement: {}, init: {}, spell: {} };
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
        pc.calculatedProfBonus = window.getProficiencyBonus(pcLevel); // From dndCalculations.js
    }

    let cardClasses = 'pc-stat-card';
    let dataAttributes = '';
    if (isClickableForDetailedView) {
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
                const dexMod = window.getAbilityModifier(dexForAC);
                acDisplay += Math.min(dexMod, equippedArmor.system.armor.dex);
            } else if (equippedArmor.system.armor.dex === null && dexForAC) {
                 acDisplay += window.getAbilityModifier(dexForAC);
            }
        } else {
            acDisplay = 10 + window.getAbilityModifier(pc.vtt_data.abilities.dex?.value || 10);
        }
    }
    cardHTML += `<p><strong>AC:</strong> ${acDisplay}</p>`;
    cardHTML += `<p><strong>Prof. Bonus:</strong> +${pc.calculatedProfBonus}</p>`;
    cardHTML += `<p><strong>Speed:</strong> ${pc.vtt_data.attributes.movement?.walk || pc.system?.attributes?.movement?.walk || 0} ft</p>`;

    let initiativeBonus = 'N/A';
    const initAbilityKey = pc.vtt_data.attributes.init?.ability;
    const dexValue = pc.vtt_data.abilities.dex?.value;
    if (initAbilityKey && pc.vtt_data.abilities[initAbilityKey]) {
        initiativeBonus = window.getAbilityModifier(pc.vtt_data.abilities[initAbilityKey].value || 10);
    } else if (typeof pc.vtt_data.attributes.init?.bonus !== 'undefined' && pc.vtt_data.attributes.init.bonus !== "") {
        initiativeBonus = parseInt(pc.vtt_data.attributes.init.bonus) || 0;
    } else if (typeof dexValue !== 'undefined') {
        initiativeBonus = window.getAbilityModifier(dexValue);
    }
    cardHTML += `<p><strong>Initiative:</strong> ${initiativeBonus >= 0 ? '+' : ''}${initiativeBonus}</p>`;

    const spellcastingAbilityKey = pc.system?.attributes?.spellcasting || pc.vtt_data.attributes.spellcasting;
    let spellDcText = "N/A";
    if (spellcastingAbilityKey && typeof pc.vtt_data.abilities[spellcastingAbilityKey]?.value !== 'undefined') {
        const castingScore = pc.vtt_data.abilities[spellcastingAbilityKey].value || 10;
        spellDcText = window.spellSaveDC(castingScore, pc.calculatedProfBonus);
    } else if (pc.vtt_data.attributes.spell?.dc) {
        spellDcText = pc.vtt_data.attributes.spell.dc;
    }
    cardHTML += `<p><strong>Spell DC:</strong> ${spellDcText}</p>`;
    cardHTML += `</div>`;
    return cardHTML;
};


window.renderNpcListForSceneUI = function(listContainerElement, allCharacters, activeNpcIds, onCheckboxChange, onNameClick) {
    if (!listContainerElement) { console.error("renderNpcListForSceneUI: listContainerElement not found"); return; }
    let ul = listContainerElement.querySelector('ul');
    if (!ul) {
        ul = document.createElement('ul');
        listContainerElement.appendChild(ul);
    }
    ul.innerHTML = '';
    const npcs = allCharacters.filter(char => char.character_type === 'NPC').sort((a, b) => a.name.localeCompare(b.name));

    if (npcs.length === 0) {
        ul.innerHTML = '<li><p><em>No NPCs defined yet.</em></p></li>';
        return;
    }
    npcs.forEach(char => {
        const charIdStr = String(char._id);
        const li = document.createElement('li');
        li.dataset.charId = charIdStr;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `npc-scene-checkbox-${charIdStr}`;
        checkbox.checked = activeNpcIds.has(charIdStr);
        checkbox.onchange = () => onCheckboxChange(charIdStr, char.name);
        const nameSpan = document.createElement('span');
        nameSpan.textContent = char.name;
        nameSpan.className = 'npc-name-clickable';
        nameSpan.onclick = async () => { await onNameClick(charIdStr); };
        li.appendChild(checkbox);
        li.appendChild(nameSpan);
        if (activeNpcIds.has(charIdStr)) li.classList.add('active-in-scene');
        ul.appendChild(li);
    });
};

window.renderPcListUI = function(pcListDiv, speakingPcSelect, allCharacters, activePcIds, onPcItemClick) {
    if (!pcListDiv) { console.error("renderPcListUI: pcListDiv not found"); return;}
    pcListDiv.innerHTML = '';
    if (speakingPcSelect) {
        speakingPcSelect.innerHTML = '<option value="">-- DM/Scene Event --</option>';
    }
    const pcs = allCharacters.filter(char => char.character_type === 'PC').sort((a, b) => a.name.localeCompare(b.name));
    if (pcs.length === 0) {
        pcListDiv.innerHTML = '<p><em>No Player Characters defined yet.</em></p>';
        return;
    }
    const ul = document.createElement('ul');
    pcs.forEach(pc => {
        const pcIdStr = String(pc._id);
        const li = document.createElement('li');
        li.style.cursor = "pointer";
        li.textContent = pc.name;
        li.dataset.charId = pcIdStr;
        li.onclick = () => onPcItemClick(pcIdStr);
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
};

window.createNpcDialogueAreaUI = function(npcIdStr, npcName, containerElement) {
    if (!containerElement || window.getElem(`npc-area-${npcIdStr}`)) return;
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
        <div id="suggested-memories-list-npc-${npcIdStr}" class="ai-suggestion-category"><h6>Suggested Memories:</h6></div>
        <div id="suggested-topics-list-npc-${npcIdStr}" class="ai-suggestion-category"><h6>Suggested Follow-up Topics:</h6></div>
        <div id="suggested-npc-actions-list-npc-${npcIdStr}" class="ai-suggestion-category"><h5>Suggested NPC Actions/Thoughts:</h5></div>
        <div id="suggested-player-checks-list-npc-${npcIdStr}" class="ai-suggestion-category"><h5>Suggested Player Checks:</h5></div>
        <div id="suggested-faction-standing-changes-npc-${npcIdStr}" class="ai-suggestion-category"><h5>Suggested Faction Standing Change:</h5></div>`;
    areaDiv.appendChild(suggestionsDiv);
    containerElement.appendChild(areaDiv);
    window.adjustNpcDialogueAreaWidthsUI(containerElement);
};

window.removeNpcDialogueAreaUI = function(npcIdStr, containerElement) {
    const areaDiv = window.getElem(`npc-area-${npcIdStr}`);
    if (areaDiv) areaDiv.remove();
    window.adjustNpcDialogueAreaWidthsUI(containerElement);
    if (appState.getActiveNpcCount() === 0 && containerElement && !containerElement.querySelector('p.scene-event')) {
        containerElement.innerHTML = '<p class="scene-event">Select NPCs to add them to the scene.</p>';
    }
};

window.adjustNpcDialogueAreaWidthsUI = function(containerElement) {
    if (!containerElement) return;
    const dialogueAreas = containerElement.querySelectorAll('.npc-dialogue-area');
    const numAreas = dialogueAreas.length;
    if (numAreas === 0) return;
    const minIndividualWidth = 250;
    const containerWidth = containerElement.clientWidth;
    let flexBasisPercent = 100 / numAreas;
    if (numAreas * minIndividualWidth > containerWidth) {
        flexBasisPercent = (minIndividualWidth / containerWidth) * 100;
        flexBasisPercent = Math.min(flexBasisPercent, 100);
    }
    dialogueAreas.forEach(area => {
        area.style.minWidth = `${minIndividualWidth}px`;
        area.style.flexBasis = `${flexBasisPercent}%`;
        area.style.flexGrow = `1`;
    });
};

window.appendMessageToTranscriptUI = function(transcriptArea, message, className) {
    if (!transcriptArea) return;
    const entry = document.createElement('p');
    entry.className = className;
    entry.textContent = message;
    transcriptArea.appendChild(entry);
    transcriptArea.scrollTop = transcriptArea.scrollHeight;
};

window.renderAiSuggestionsContent = function(aiResult, forNpcId) {
    const suggestionsContainerNpc = window.getElem(`ai-suggestions-${forNpcId}`);
    if (!suggestionsContainerNpc) return;
    suggestionsContainerNpc.innerHTML = '';
    let contentGeneratedForNpc = false;

    const memoriesListNpc = document.createElement('div');
    memoriesListNpc.id = `suggested-memories-list-npc-${forNpcId}`;
    memoriesListNpc.className = 'ai-suggestion-category';
    if (aiResult.new_memory_suggestions && aiResult.new_memory_suggestions.length > 0) {
        memoriesListNpc.innerHTML = '<h6>Suggested Memories:</h6>' + aiResult.new_memory_suggestions.map(mem =>
            `<div class="suggested-item">${mem} <button onclick="window.addSuggestedMemoryAsActual('${forNpcId}', '${mem.replace(/'/g, "\\'")}')">Add</button></div>`
        ).join('');
        contentGeneratedForNpc = true;
    } else {
        memoriesListNpc.innerHTML = '<h6>Suggested Memories:</h6>';
    }
    suggestionsContainerNpc.appendChild(memoriesListNpc);

    const topicsListNpc = document.createElement('div');
    topicsListNpc.id = `suggested-topics-list-npc-${forNpcId}`;
    topicsListNpc.className = 'ai-suggestion-category';
    if (aiResult.generated_topics && aiResult.generated_topics.length > 0) {
        topicsListNpc.innerHTML = '<h6>Suggested Follow-up Topics:</h6>' + aiResult.generated_topics.map(topic => `<div class="suggested-item">${topic}</div>`).join('');
        contentGeneratedForNpc = true;
    } else {
        topicsListNpc.innerHTML = '<h6>Suggested Follow-up Topics:</h6>';
    }
    suggestionsContainerNpc.appendChild(topicsListNpc);

    const actionsListNpc = document.createElement('div');
    actionsListNpc.id = `suggested-npc-actions-list-npc-${forNpcId}`;
    actionsListNpc.className = 'ai-suggestion-category';
    if (aiResult.suggested_npc_actions && aiResult.suggested_npc_actions.length > 0) {
        actionsListNpc.innerHTML = '<h5>Suggested NPC Actions/Thoughts:</h5>' + aiResult.suggested_npc_actions.map(action => `<div class="suggested-item">${action}</div>`).join('');
        contentGeneratedForNpc = true;
    } else {
        actionsListNpc.innerHTML = '<h5>Suggested NPC Actions/Thoughts:</h5>';
    }
    suggestionsContainerNpc.appendChild(actionsListNpc);

    const checksListNpc = document.createElement('div');
    checksListNpc.id = `suggested-player-checks-list-npc-${forNpcId}`;
    checksListNpc.className = 'ai-suggestion-category';
    if (aiResult.suggested_player_checks && aiResult.suggested_player_checks.length > 0) {
        checksListNpc.innerHTML = '<h5>Suggested Player Checks:</h5>' + aiResult.suggested_player_checks.map(check => `<div class="suggested-item">${check}</div>`).join('');
        contentGeneratedForNpc = true;
    } else {
        checksListNpc.innerHTML = '<h5>Suggested Player Checks:</h5>';
    }
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
                Towards ${pcNameForStanding}: ${standingValue}
                (Justification: ${aiResult.standing_change_justification || 'None'})
                <button onclick="window.acceptFactionStandingChange('${forNpcId}', '${aiResult.suggested_standing_pc_id}', '${standingValue}')">Accept</button>
            </div>`;
        contentGeneratedForNpc = true;
    } else {
         standingChangesNpc.innerHTML = `<h5>Suggested Faction Standing Change:</h5>`;
    }
    suggestionsContainerNpc.appendChild(standingChangesNpc);
    suggestionsContainerNpc.style.display = contentGeneratedForNpc ? 'block' : 'none';

    const globalSuggestionsArea = window.getElem('ai-suggestions');
    if (globalSuggestionsArea && appState.getCurrentProfileCharId() === forNpcId) {
        globalSuggestionsArea.style.display = 'block';
        const globalMem = window.getElem('suggested-memories-list');
        if (globalMem) globalMem.innerHTML = memoriesListNpc.innerHTML;
        const globalTopics = window.getElem('suggested-topics-list');
        if (globalTopics) globalTopics.innerHTML = topicsListNpc.innerHTML;
        const globalActions = window.getElem('suggested-npc-actions-list');
        if (globalActions) globalActions.innerHTML = actionsListNpc.innerHTML;
        const globalChecks = window.getElem('suggested-player-checks-list');
        if (globalChecks) globalChecks.innerHTML = checksListNpc.innerHTML;
        const globalStanding = window.getElem('suggested-faction-standing-changes');
        if (globalStanding) globalStanding.innerHTML = standingChangesNpc.innerHTML;
    } else if (globalSuggestionsArea && appState.getActiveNpcCount() === 0) {
        globalSuggestionsArea.style.display = 'none';
    }
};

window.renderNpcFactionStandingsUI = function(npcCharacter, activePcIdsSet, allCharactersArray, contentElement, onStandingChangeCallback) {
    // ... (Full code for renderNpcFactionStandingsUI as provided in my previous response)
    if (!contentElement) { console.error("renderNpcFactionStandingsUI: contentElement not found"); return; }
    if (!npcCharacter || npcCharacter.character_type !== 'NPC') {
        contentElement.innerHTML = "<p><em>Faction standings are for NPCs. Ensure an NPC is selected.</em></p>";
        return;
    }
    contentElement.innerHTML = '';
    const activePcs = allCharactersArray.filter(char => char.character_type === 'PC' && activePcIdsSet.has(String(char._id)));
    if (activePcs.length === 0) {
        contentElement.innerHTML = "<p><em>No PCs selected in the left panel to show standings towards. Add PCs via the main list.</em></p>";
        return;
    }
    activePcs.forEach(pc => {
        const pcIdStr = String(pc._id);
        const standingEntryDiv = document.createElement('div');
        standingEntryDiv.className = 'faction-standing-entry';
        const label = document.createElement('label');
        label.htmlFor = `standing-select-${npcCharacter._id}-${pcIdStr}`;
        label.textContent = `${pc.name}:`;
        label.style.marginRight = "10px";
        const select = document.createElement('select');
        select.id = `standing-select-${npcCharacter._id}-${pcIdStr}`;
        select.dataset.pcId = pcIdStr;
        select.style.width = "150px";
        FACTION_STANDING_SLIDER_ORDER.forEach(levelKey => {
            const option = document.createElement('option');
            option.value = levelKey;
            option.textContent = levelKey;
            select.appendChild(option);
        });
        const currentStandingObj = npcCharacter.pc_faction_standings ? npcCharacter.pc_faction_standings[pcIdStr] : null;
        const currentStandingValue = (typeof currentStandingObj === 'object' && currentStandingObj !== null && typeof currentStandingObj.value !== 'undefined') ? currentStandingObj.value : currentStandingObj;
        select.value = currentStandingValue || FACTION_STANDING_LEVELS.INDIFFERENT;
        select.addEventListener('change', (event) => {
            onStandingChangeCallback(npcCharacter._id, pcIdStr, event.target.value);
        });
        standingEntryDiv.appendChild(label);
        standingEntryDiv.appendChild(select);
        contentElement.appendChild(standingEntryDiv);
    });
};


// static/uiRenderers.js
// Make sure this function is defined after its dependencies like renderMemoriesUI etc. if they are in the same file,
// OR ensure all are on window and uiRenderers.js is fully parsed before this is called.

window.renderCharacterProfileUI = function(character, elements) {
    if (!elements) {
        console.error("renderCharacterProfileUI: elements object not provided. This object should contain DOM element IDs.");
        // Try to get some default elements to prevent further errors, but this is not ideal.
        elements = {
            detailsCharName: 'details-char-name',
            profileCharType: 'profile-char-type',
            profileDescription: 'profile-description',
            profilePersonality: 'profile-personality',
            gmNotesTextarea: 'gm-notes',
            saveGmNotesBtn: 'save-gm-notes-btn',
            npcMemoriesSection: 'npc-memories-collapsible-section',
            characterMemoriesList: 'character-memories-list',
            addMemoryBtn: 'add-memory-btn',
            npcFactionStandingsSection: 'npc-faction-standings-section',
            npcFactionStandingsContent: 'npc-faction-standings-content',
            characterHistorySection: 'character-history-collapsible-section',
            associatedHistoryList: 'associated-history-list',
            historyContentDisplay: 'history-content-display',
            associateHistoryBtn: 'associate-history-btn',
            // Callbacks should be actual functions, e.g., window.handleDeleteMemory
            // These are expected to be passed in correctly by characterService.js
            deleteMemoryCallback: elements.deleteMemoryCallback || function() { console.warn("deleteMemoryCallback not provided to renderCharacterProfileUI"); },
            factionChangeCallback: elements.factionChangeCallback || function() { console.warn("factionChangeCallback not provided to renderCharacterProfileUI"); },
            dissociateHistoryCallback: elements.dissociateHistoryCallback || function() { console.warn("dissociateHistoryCallback not provided to renderCharacterProfileUI"); }
        };
    }

    const detailsCharNameElem = window.getElem(elements.detailsCharName);
    const profileCharTypeElem = window.getElem(elements.profileCharType);
    const profileDescriptionElem = window.getElem(elements.profileDescription);
    const profilePersonalityElem = window.getElem(elements.profilePersonality);
    const gmNotesTextareaElem = window.getElem(elements.gmNotesTextarea);
    const saveGmNotesBtnElem = window.getElem(elements.saveGmNotesBtn);
    const npcMemoriesSectionElem = window.getElem(elements.npcMemoriesSection);
    const characterMemoriesListElem = window.getElem(elements.characterMemoriesList);
    const addMemoryBtnElem = window.getElem(elements.addMemoryBtn);
    const npcFactionStandingsSectionElem = window.getElem(elements.npcFactionStandingsSection);
    const npcFactionStandingsContentElem = window.getElem(elements.npcFactionStandingsContent);
    const characterHistorySectionElem = window.getElem(elements.characterHistorySection);
    const associatedHistoryListElem = window.getElem(elements.associatedHistoryList);
    const historyContentDisplayElem = window.getElem(elements.historyContentDisplay);
    const associateHistoryBtnElem = window.getElem(elements.associateHistoryBtn);

    if (!character) {
        if (detailsCharNameElem) window.updateText(elements.detailsCharName, 'None');
        if (profileCharTypeElem) window.updateText(elements.profileCharType, '');
        if (profileDescriptionElem) window.updateText(elements.profileDescription, '');
        if (profilePersonalityElem) window.updateText(elements.profilePersonality, '');
        if (gmNotesTextareaElem) gmNotesTextareaElem.value = '';
        if (saveGmNotesBtnElem) window.disableBtn(elements.saveGmNotesBtn, true);

        if (npcMemoriesSectionElem) npcMemoriesSectionElem.style.display = 'none';
        if (npcFactionStandingsSectionElem) npcFactionStandingsSectionElem.style.display = 'none';
        if (characterHistorySectionElem) characterHistorySectionElem.style.display = 'block'; // Keep visible

        if (associatedHistoryListElem) associatedHistoryListElem.innerHTML = '<li><em>Select a character.</em></li>';
        if (historyContentDisplayElem) historyContentDisplayElem.textContent = 'Select a character to view history.';

        if (addMemoryBtnElem) window.disableBtn(elements.addMemoryBtn, true);
        if (associateHistoryBtnElem) window.disableBtn(elements.associateHistoryBtn, true);
        return;
    }

    // Ensure character has expected structure, defaulting where necessary
    character.personality_traits = character.personality_traits || [];
    character.memories = character.memories || [];
    character.associated_history_files = character.associated_history_files || [];
    character.pc_faction_standings = character.pc_faction_standings || {};


    if (detailsCharNameElem) window.updateText(elements.detailsCharName, character.name || "N/A");
    if (profileCharTypeElem) window.updateText(elements.profileCharType, character.character_type || "N/A");
    if (profileDescriptionElem) window.updateText(elements.profileDescription, character.description || "N/A");
    if (profilePersonalityElem) window.updateText(elements.profilePersonality, character.personality_traits.join(', ') || "N/A");

    if (gmNotesTextareaElem) gmNotesTextareaElem.value = character.gm_notes || '';
    if (saveGmNotesBtnElem) window.disableBtn(elements.saveGmNotesBtn, false);

    const isNpc = character.character_type === 'NPC';

    if (npcMemoriesSectionElem) npcMemoriesSectionElem.style.display = isNpc ? 'block' : 'none';
    if (npcFactionStandingsSectionElem) npcFactionStandingsSectionElem.style.display = isNpc ? 'block' : 'none';
    if (characterHistorySectionElem) characterHistorySectionElem.style.display = 'block';

    if (isNpc) {
        if (characterMemoriesListElem) {
            // The callback elements.deleteMemoryCallback() should resolve to window.handleDeleteMemory
            window.renderMemoriesUI(character.memories, characterMemoriesListElem, elements.deleteMemoryCallback());
        }
        if (npcFactionStandingsContentElem) {
            // The callback elements.factionChangeCallback() should resolve to window.handleSaveFactionStanding
            // Ensure appState is globally available
            window.renderNpcFactionStandingsUI(character, appState.activePcIds, appState.getAllCharacters(), npcFactionStandingsContentElem, elements.factionChangeCallback());
        }
        if (addMemoryBtnElem) window.disableBtn(elements.addMemoryBtn, false);
    } else { // Is PC
        if (characterMemoriesListElem) characterMemoriesListElem.innerHTML = '<p><em>Memories are for NPCs only.</em></p>';
        if (addMemoryBtnElem) window.disableBtn(elements.addMemoryBtn, true);
        if (npcFactionStandingsContentElem) npcFactionStandingsContentElem.innerHTML = '<p><em>Faction standings are for NPCs.</em></p>';
        if (npcFactionStandingsSectionElem) npcFactionStandingsSectionElem.style.display = 'none'; // Hide entire section for PC
    }

    if (associatedHistoryListElem && historyContentDisplayElem) {
        // The callback elements.dissociateHistoryCallback() should resolve to window.handleDissociateHistoryFile
        window.renderAssociatedHistoryFilesUI(character, associatedHistoryListElem, historyContentDisplayElem, elements.dissociateHistoryCallback());
    }
    if (associateHistoryBtnElem) window.disableBtn(elements.associateHistoryBtn, false);
};

window.renderMemoriesUI = function(memories, listElement, deleteCallback) {
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
            <span><strong>${memory.type || 'Fact'}:</strong> ${memory.content} <em>(${new Date(memory.timestamp).toLocaleDateString()})</em></span>
            <button data-memory-id="${memory.memory_id}">Delete</button>
        `;
        item.querySelector('button').onclick = () => deleteCallback(memory.memory_id);
        listElement.appendChild(item);
    });
};

window.renderAssociatedHistoryFilesUI = function(character, listElement, contentDisplayElement, dissociateCallback) {
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
};

window.renderPcQuickViewInSceneUI = function(wrapperElement, activePcsData) {
    if (!wrapperElement) { console.error("renderPcQuickViewInSceneUI: wrapperElement not found"); return; }
    if (activePcsData.length === 0) {
        wrapperElement.innerHTML = '';
        wrapperElement.style.display = 'none';
        return;
    }
    let contentHTML = window.createPcQuickViewSectionHTML(false);
    activePcsData.sort((a, b) => a.name.localeCompare(b.name)).forEach(pc => {
        if (typeof pc.calculatedProfBonus === 'undefined') {
            const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || pc.vtt_data?.details?.level || 1;
            pc.calculatedProfBonus = window.getProficiencyBonus(pcLevel);
        }
        contentHTML += window.generatePcQuickViewCardHTML(pc, false);
    });
    contentHTML += `</div>`;
    wrapperElement.innerHTML = contentHTML;
    wrapperElement.style.display = 'block';
};

window.updatePcDashboardUI = function(dashboardContentElement, allCharacters, activePcIds, currentlyExpandedAbility, currentlyExpandedSkill, skillSortKey) {
    // (Full definition as provided in the previous response, ensuring all internal calls are window. prefixed)
    if (!dashboardContentElement) {
        console.error("updatePcDashboardUI: 'pc-dashboard-content' element not found.");
        return;
    }
    dashboardContentElement.innerHTML = '';

    const selectedPcs = allCharacters.filter(char => activePcIds.has(String(char._id)) && char.character_type === 'PC' && char.vtt_data);

    if (selectedPcs.length === 0) {
        dashboardContentElement.innerHTML = `<p class="pc-dashboard-no-selection">Select Player Characters from the left panel to view their details and comparisons.</p>`;
        return;
    }

    selectedPcs.forEach(pc => {
        const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || pc.vtt_data?.details?.level || 1;
        pc.calculatedProfBonus = window.getProficiencyBonus(pcLevel);
    });

    let quickViewHTML = window.createPcQuickViewSectionHTML(true);
    const sortedSelectedPcsByName = [...selectedPcs].sort((a, b) => a.name.localeCompare(b.name));
    sortedSelectedPcsByName.forEach(pc => {
        quickViewHTML += window.generatePcQuickViewCardHTML(pc, true);
    });
    quickViewHTML += `</div>`;
    dashboardContentElement.innerHTML += quickViewHTML;

    const abilitiesForTable = ABILITY_KEYS_ORDER.map(k => k.toUpperCase());
    let mainStatsTableHTML = `<h4>Ability Scores Overview</h4><div class="table-wrapper"><table id="main-stats-table"><thead><tr><th>Character</th>`;
    abilitiesForTable.forEach(ablKey => {
        const isExpanded = currentlyExpandedAbility === ablKey && window.getElem(`expanded-${ablKey}`)?.style.display !== 'none';
        const arrow = isExpanded ? '▼' : '►';
        mainStatsTableHTML += `<th class="clickable-ability-header" data-ability="${ablKey}" onclick="window.toggleAbilityExpansion('${ablKey}')">${ablKey} <span class="arrow-indicator">${arrow}</span></th>`;
    });
    mainStatsTableHTML += `</tr></thead><tbody>`;
    sortedSelectedPcsByName.forEach(pc => {
        mainStatsTableHTML += `<tr><td>${pc.name}</td>`;
        ABILITY_KEYS_ORDER.forEach(ablKey => {
            const score = pc.vtt_data?.abilities?.[ablKey]?.value || 10;
            const mod = window.getAbilityModifier(score);
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
            window.populateExpandedAbilityDetailsUI(ablKey.toUpperCase(), expansionDiv, selectedPcs);
        }
        abilityExpansionContainer.appendChild(expansionDiv);
    });

    let skillsTableHTML = `<h4>Skills Overview</h4><div class="table-wrapper"><table id="skills-overview-table"><thead><tr><th>Character</th>`;
    for (const skillKey in SKILL_NAME_MAP) {
        const skillFullName = SKILL_NAME_MAP[skillKey].replace(/\s\(...\)/, '');
        const isExpanded = currentlyExpandedSkill === skillKey && window.getElem(`expanded-skill-${skillKey}`)?.style.display !== 'none';
        const arrow = isExpanded ? '▼' : '►';
        skillsTableHTML += `<th class="clickable-skill-header" data-skill-key="${skillKey}" onclick="window.toggleSkillExpansion('${skillKey}')">${skillFullName} <span class="arrow-indicator">${arrow}</span></th>`;
    }
    skillsTableHTML += `</tr></thead><tbody>`;
    let pcsForSkillTable = [...selectedPcs];
    if (skillSortKey) {
        pcsForSkillTable.sort((a,b) => {
            const skillVttDataA = a.vtt_data?.skills?.[skillSortKey];
            const defaultAbilityA = SKILL_NAME_MAP[skillSortKey]?.match(/\(([^)]+)\)/)?.[1]?.toLowerCase() || 'int';
            const baseAbilityKeyA = skillVttDataA?.ability || defaultAbilityA;
            const baseAbilityScoreA = a.vtt_data?.abilities?.[baseAbilityKeyA]?.value || 10;
            const bonusA = window.calculateSkillBonus(baseAbilityScoreA, skillVttDataA?.value || 0, a.calculatedProfBonus);
            const skillVttDataB = b.vtt_data?.skills?.[skillSortKey];
            const defaultAbilityB = SKILL_NAME_MAP[skillSortKey]?.match(/\(([^)]+)\)/)?.[1]?.toLowerCase() || 'int';
            const baseAbilityKeyB = skillVttDataB?.ability || defaultAbilityB;
            const baseAbilityScoreB = b.vtt_data?.abilities?.[baseAbilityKeyB]?.value || 10;
            const bonusB = window.calculateSkillBonus(baseAbilityScoreB, skillVttDataB?.value || 0, b.calculatedProfBonus);
            return bonusB - bonusA;
        });
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
                const bonus = window.calculateSkillBonus(abilityScore, skillData?.value || 0, pc.calculatedProfBonus);
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
            window.populateExpandedSkillDetailsUI(skillKey, expansionDiv, selectedPcs);
        }
        skillExpansionContainer.appendChild(expansionDiv);
    }
};

window.renderDetailedPcSheetUI = function(pcData, dashboardContentElement) {
    // (Full definition as provided in my previous detailed response, including collapsible sections)
    if (!pcData || pcData.character_type !== 'PC' || !pcData.vtt_data) {
        console.error("PC not found or invalid VTT data for detailed sheet:", pcData);
        if (dashboardContentElement) dashboardContentElement.innerHTML = `<p>Error loading PC. <button onclick="window.handleBackToDashboardOverview()">Back to Dashboard Overview</button></p>`;
        return;
    }
    if (!dashboardContentElement) { console.error("'pc-dashboard-content' not found for detailed sheet."); return; }
    dashboardContentElement.innerHTML = '';

    let html = `<div class="detailed-pc-sheet" data-pc-id="${pcData._id}">`;
    html += `<span class="close-detailed-pc-sheet-btn" onclick="window.handleBackToDashboardOverview()" title="Close Detailed View">&times;</span>`;
    
    const pcLevel = pcData.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pcData.system?.details?.level || pcData.vtt_data?.details?.level || 1;
    pcData.calculatedProfBonus = window.getProficiencyBonus(pcLevel);
    
    let raceName = pcData.vtt_data?.details?.race || pcData.race || 'N/A';
    if (pcData.items && pcData.vtt_data?.details?.race) {
        const raceItem = pcData.items.find(item => item._id === pcData.vtt_data.details.race && item.type === 'race');
        if (raceItem) raceName = raceItem.name;
    }

    let className = pcData.class_str || 'N/A';
    const classItem = pcData.items?.find(i => i.type === 'class');
    if (classItem) { className = classItem.name; } 
    else if (pcData.vtt_data?.details?.originalClass) { className = pcData.vtt_data.details.originalClass; }

    html += `<div class="pc-sheet-top-section"><h2>${pcData.name}</h2>`;
    html += `<p class="pc-basic-info-subtext">${raceName} ${className}, Level ${pcLevel} &bull; Alignment: ${pcData.vtt_data?.details?.alignment || pcData.alignment || 'N/A'}</p></div>`;

    html += `<div class="pc-sheet-columns">`;
    html += `<div class="pc-sheet-column pc-sheet-column-left">`;
    html += `<div class="pc-section"><h4>Combat Stats</h4><div class="pc-info-grid">`;
    const hpCurrent = pcData.vtt_data?.attributes?.hp?.value ?? 'N/A';
    const hpMax = pcData.vtt_data?.attributes?.hp?.max ?? pcData.system?.attributes?.hp?.max ?? 'N/A';
    html += `<p><strong>HP:</strong> ${hpCurrent} / ${hpMax}</p>`;
    
    let acDisplayDetailed = pcData.vtt_flags?.ddbimporter?.overrideAC?.flat ?? pcData.vtt_data?.attributes?.ac?.value ?? pcData.vtt_data?.attributes?.ac?.flat;
    if (acDisplayDetailed === undefined || acDisplayDetailed === null) {
        const equippedArmorItems = pcData.items?.filter(item => item.type === 'equipment' && item.system?.equipped && typeof item.system?.armor?.value !== 'undefined') || [];
        if (equippedArmorItems.length > 0) {
            const equippedArmor = equippedArmorItems[0];
            acDisplayDetailed = equippedArmor.system.armor.value;
            if (equippedArmor.system.armor.dex !== null && typeof equippedArmor.system.armor.dex !== 'undefined' && pcData.vtt_data?.abilities?.dex?.value) {
                const dexMod = window.getAbilityModifier(pcData.vtt_data.abilities.dex.value);
                acDisplayDetailed += Math.min(dexMod, equippedArmor.system.armor.dex);
            } else if (equippedArmor.system.armor.dex === null && pcData.vtt_data?.abilities?.dex?.value) {
                 acDisplayDetailed += window.getAbilityModifier(pcData.vtt_data.abilities.dex.value);
            }
        } else { 
            acDisplayDetailed = 10 + window.getAbilityModifier(pcData.vtt_data?.abilities?.dex?.value || 10);
        }
    }
    html += `<p><strong>AC:</strong> ${acDisplayDetailed}</p>`;
    html += `<p><strong>Speed:</strong> ${pcData.vtt_data?.attributes?.movement?.walk || pcData.system?.attributes?.movement?.walk || 30} ft</p>`;
    
    let initiativeBonusDet = 'N/A';
    const initAbilityKeyDet = pcData.vtt_data?.attributes?.init?.ability;
    const dexValueForInitDet = pcData.vtt_data?.abilities?.dex?.value;
    if (initAbilityKeyDet && pcData.vtt_data?.abilities?.[initAbilityKeyDet]) {
        initiativeBonusDet = window.getAbilityModifier(pcData.vtt_data.abilities[initAbilityKeyDet].value || 10);
    } else if (typeof pcData.vtt_data?.attributes?.init?.bonus !== 'undefined' && pcData.vtt_data.attributes.init.bonus !== "") {
        initiativeBonusDet = parseInt(pcData.vtt_data.attributes.init.bonus) || 0;
    } else if (typeof dexValueForInitDet !== 'undefined') {
        initiativeBonusDet = window.getAbilityModifier(dexValueForInitDet);
    }
    html += `<p><strong>Initiative:</strong> ${initiativeBonusDet >= 0 ? '+' : ''}${initiativeBonusDet}</p>`;
    html += `<p><strong>Proficiency Bonus:</strong> +${pcData.calculatedProfBonus}</p></div></div>`;

    html += `<div class="pc-section"><h4>Weapons & Attacks</h4>`;
    const weaponsDetailed = pcData.items?.filter(item => item.type === 'weapon' && item.system?.equipped) || [];
    if (weaponsDetailed.length > 0) {
        html += `<ul class="pc-sheet-list">`;
        weaponsDetailed.forEach(w => {
            let attackBonusStr = "N/A"; let damageStr = "N/A";
            const weaponSystem = w.system || {}; let ablMod = 0;
            const weaponAbility = weaponSystem.ability;
            if (weaponAbility && pcData.vtt_data?.abilities?.[weaponAbility]) {
                ablMod = window.getAbilityModifier(pcData.vtt_data.abilities[weaponAbility].value || 10);
            } else if (weaponSystem.properties?.includes('fin')) {
                const strMod = window.getAbilityModifier(pcData.vtt_data?.abilities?.str?.value || 10);
                const dexMod = window.getAbilityModifier(pcData.vtt_data?.abilities?.dex?.value || 10);
                ablMod = Math.max(strMod, dexMod);
            } else if (weaponSystem.type?.value?.includes('R') || weaponSystem.properties?.includes('thr')) {
                 if (weaponSystem.properties?.includes('thr') && !weaponSystem.properties?.includes('fin')) {
                    ablMod = window.getAbilityModifier(pcData.vtt_data?.abilities?.str?.value || 10);
                 } else {
                    ablMod = window.getAbilityModifier(pcData.vtt_data?.abilities?.dex?.value || 10);
                 }
            } else { 
                ablMod = window.getAbilityModifier(pcData.vtt_data?.abilities?.str?.value || 10);
            }
            let isProficient = weaponSystem.proficient === 1 || weaponSystem.proficient === true;
            attackBonusStr = ablMod + (isProficient ? pcData.calculatedProfBonus : 0) + (parseInt(weaponSystem.attackBonus) || 0) + (weaponSystem.magicalBonus || 0) ;
            attackBonusStr = `${attackBonusStr >= 0 ? '+' : ''}${attackBonusStr}`;

            if (weaponSystem.damage?.parts?.length > 0) {
                const part = weaponSystem.damage.parts[0];
                let dmgBonusFromPart = parseInt(part.bonus);
                let totalDmgBonus = ablMod + (weaponSystem.magicalBonus || 0);
                if (!isNaN(dmgBonusFromPart)) { totalDmgBonus = dmgBonusFromPart + (weaponSystem.magicalBonus || 0); }
                damageStr = `${part.number || '1'}d${part.denomination || '?'} ${totalDmgBonus >= 0 ? '+' : ''}${totalDmgBonus} ${part.types?.join('/') || part.type || 'damage'}`;
            } else if (weaponSystem.damage?.base) {
                damageStr = `${weaponSystem.damage.base.number || '1'}d${weaponSystem.damage.base.denomination || '?'} ${weaponSystem.damage.base.bonus || ''} ${weaponSystem.damage.base.types?.join('/') || ''}`;
            }
            html += `<li><strong>${w.name}:</strong> Atk ${attackBonusStr}, Dmg: ${damageStr} <i>(${(weaponSystem.properties || []).join(', ')})${weaponSystem.mastery ? `, Mastery: ${weaponSystem.mastery}` : ''}</i></li>`;
        });
        html += `</ul>`;
    } else { html += `<p>No equipped weapons listed.</p>`; }
    html += `</div>`;

    html += `<div class="pc-section"><h4>Ability Scores & Saves</h4><table class="detailed-pc-table"><thead><tr><th>Ability</th><th>Score</th><th>Mod</th><th>Save</th></tr></thead><tbody>`;
    ABILITY_KEYS_ORDER.forEach(abl => {
        const score = pcData.vtt_data?.abilities?.[abl]?.value || 10; const mod = window.getAbilityModifier(score);
        const proficientInSave = pcData.vtt_data?.abilities?.[abl]?.proficient === 1;
        const saveBonus = window.savingThrowBonus(score, proficientInSave, pcData.calculatedProfBonus);
        html += `<tr><td>${abl.toUpperCase()}</td><td>${score}</td><td>${mod >= 0 ? '+' : ''}${mod}</td><td>${saveBonus >= 0 ? '+' : ''}${saveBonus}${proficientInSave ? ' <abbr title="Proficient">(P)</abbr>' : ''}</td></tr>`;
    });
    html += `</tbody></table></div>`;
    html += `</div>`; 

    html += `<div class="pc-sheet-column pc-sheet-column-right">`;
    html += `<div class="pc-section"><h4>Skills</h4><table class="detailed-pc-table"><thead><tr><th>Skill</th><th>Bonus</th></tr></thead><tbody>`;
    for (const skillKey in SKILL_NAME_MAP) {
        const skillData = pcData.vtt_data?.skills?.[skillKey]; const skillDisplayName = SKILL_NAME_MAP[skillKey];
        const defaultAbilityAbbrevMatch = skillDisplayName.match(/\(([^)]+)\)/);
        const defaultAbilityAbbrev = defaultAbilityAbbrevMatch ? defaultAbilityAbbrevMatch[1].toLowerCase() : 'int';
        const abilityKeyForSkill = skillData?.ability || defaultAbilityAbbrev;
        const scoreForSkill = pcData.vtt_data?.abilities?.[abilityKeyForSkill]?.value || 10;
        const proficiencyValue = skillData?.value || 0; 
        const bonus = window.calculateSkillBonus(scoreForSkill, proficiencyValue, pcData.calculatedProfBonus);
        let profMarker = ""; 
        if (proficiencyValue === 1) profMarker = " <abbr title='Proficient'>(P)</abbr>"; 
        else if (proficiencyValue === 2) profMarker = " <abbr title='Expertise'>(E)</abbr>"; 
        else if (proficiencyValue === 0.5) profMarker = " <abbr title='Half-Proficiency'>(H)</abbr>";
        html += `<tr><td>${skillDisplayName.replace(/\s\(...\)/, '')} <small>(${abilityKeyForSkill.toUpperCase()})</small></td><td>${bonus >= 0 ? '+' : ''}${bonus}${profMarker}</td></tr>`;
    }
    html += `</tbody></table></div>`;
    html += `</div>`; 
    html += `</div>`;

    const collapsibleSectionsDataDetailed = [
        {
            title: "Personality & Roleplaying",
            contentFn: () => { 
                let content = `<div class="pc-info-grid">`;
                const traits = (pcData.personality_traits || []).length > 0 ? pcData.personality_traits : (pcData.vtt_data?.details?.trait ? [pcData.vtt_data.details.trait] : []);
                const ideals = (pcData.ideals || []).length > 0 ? pcData.ideals : (pcData.vtt_data?.details?.ideal ? [pcData.vtt_data.details.ideal] : []);
                const bonds = (pcData.bonds || []).length > 0 ? pcData.bonds : (pcData.vtt_data?.details?.bond ? [pcData.vtt_data.details.bond] : []);
                const flaws = (pcData.flaws || []).length > 0 ? pcData.flaws : (pcData.vtt_data?.details?.flaw ? [pcData.vtt_data.details.flaw] : []);
                content += `<p><strong>Personality Traits:</strong> ${(traits || []).join('; ') || 'N/A'}</p>`;
                content += `<p><strong>Ideals:</strong> ${(ideals || []).join('; ') || 'N/A'}</p>`;
                content += `<p><strong>Bonds:</strong> ${(bonds || []).join('; ') || 'N/A'}</p>`;
                content += `<p><strong>Flaws:</strong> ${(flaws || []).join('; ') || 'N/A'}</p>`;
                content += `</div>`;
                return content;
             }
        },
        {
            title: "Appearance",
            contentFn: () => { 
                let content = `<div class="pc-info-grid">`;
                if (pcData.vtt_data?.details?.appearance && typeof pcData.vtt_data.details.appearance === 'string' && pcData.vtt_data.details.appearance.trim() !== "") {
                    content += `<p>${pcData.vtt_data.details.appearance.replace(/\n/g, '<br>')}</p>`;
                } else {
                    content += `<p><strong>Gender:</strong> ${pcData.vtt_data?.details?.gender || 'N/A'}</p>`;
                    content += `<p><strong>Age:</strong> ${pcData.vtt_data?.details?.age || pcData.age || 'N/A'}</p>`;
                    content += `<p><strong>Height:</strong> ${pcData.vtt_data?.details?.height || 'N/A'}</p>`;
                    content += `<p><strong>Weight:</strong> ${pcData.vtt_data?.details?.weight || 'N/A'}</p>`;
                    content += `<p><strong>Eyes:</strong> ${pcData.vtt_data?.details?.eyes || 'N/A'}</p>`;
                    content += `<p><strong>Skin:</strong> ${pcData.vtt_data?.details?.skin || 'N/A'}</p>`;
                    content += `<p><strong>Hair:</strong> ${pcData.vtt_data?.details?.hair || 'N/A'}</p>`;
                }
                 if (pcData.img && !pcData.img.startsWith('ddb-images/')) { 
                    content += `<p><img src="${pcData.img}" alt="${pcData.name} portrait" style="max-width: 150px; border-radius: 4px;"></p>`;
                } else if (pcData.vtt_data?.img && !pcData.vtt_data.img.includes('token')) {
                     content += `<p><img src="${pcData.vtt_data.img}" alt="${pcData.name} portrait" style="max-width: 150px; border-radius: 4px;"></p>`;
                }
                content += `</div>`;
                return content;
            }
        },
        {
            title: "Backstory & Motivations",
            contentFn: () => { 
                let content = `<div>`;
                content += `<h5>Backstory</h5><p>${pcData.backstory || pcData.vtt_data?.details?.biography?.public || pcData.vtt_data?.details?.biography?.value || 'Not detailed.'}</p>`;
                content += `<h5>Motivations</h5><p>${(pcData.motivations || []).join ? (pcData.motivations || []).join('; ') : (pcData.motivations || 'Not detailed.')}</p>`;
                content += `</div>`;
                return content;
            }
        },
        {
            title: "Proficiencies & Languages",
            contentFn: () => { 
                let content = `<h5>Armor Proficiencies</h5><p>${(pcData.vtt_data?.traits?.armorProf?.value || []).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ') || 'None'}. Custom: ${pcData.vtt_data?.traits?.armorProf?.custom || ''}</p>`;
                content += `<h5>Weapon Proficiencies</h5><p>${(pcData.vtt_data?.traits?.weaponProf?.value || []).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ') || 'None'}. Custom: ${pcData.vtt_data?.traits?.weaponProf?.custom || ''}</p>`;
                content += `<h5>Tool Proficiencies</h5><ul class="pc-sheet-list">`;
                if (pcData.vtt_data?.tools && Object.keys(pcData.vtt_data.tools).length > 0) {
                    let toolsFound = false;
                    for (const toolKey in pcData.vtt_data.tools) {
                         if (pcData.vtt_data.tools[toolKey]?.value >= 1) {
                            content += `<li>${toolKey.charAt(0).toUpperCase() + toolKey.slice(1)} (Ability: ${pcData.vtt_data.tools[toolKey].ability?.toUpperCase() || 'N/A'})</li>`;
                            toolsFound = true;
                         }
                    }
                    if (!toolsFound) content += `<li>None listed</li>`;
                } else { content += `<li>None listed</li>`; }
                content += `</ul>`;
                content += `<h5>Languages</h5><p>${(pcData.vtt_data?.traits?.languages?.value || []).map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(', ') || 'None'}. Custom: ${pcData.vtt_data?.traits?.languages?.custom || ''}</p>`;
                return content;
            }
        },
        {
            title: "Features & Traits",
            contentFn: () => { 
                let content = `<ul class="pc-sheet-list">`;
                const features = pcData.items?.filter(item => item.type === 'feat') || [];
                if (features.length > 0) {
                    features.forEach(feat => {
                        let desc = (feat.system?.description?.value || 'No description.');
                        desc = desc.replace(/<[^>]+>/g, ''); 
                        content += `<li><strong>${feat.name}</strong>: ${desc.substring(0, 150)}${desc.length > 150 ? '...' : ''}</li>`;
                    });
                } else {
                    content += `<li>No special features or traits listed in items.</li>`;
                }
                if (pcData.vtt_data?.details?.trait && !features.some(f => f.name.toLowerCase().includes('trait'))) {
                     content += `<li><strong>Other Trait(s):</strong> ${pcData.vtt_data.details.trait}</li>`;
                }
                content += `</ul>`;
                return content;
            }
        },
        {
            title: "Equipment & Inventory",
            contentFn: () => { 
                let content = `<ul class="pc-sheet-list">`;
                const equipment = pcData.items?.filter(item => ['equipment', 'loot', 'consumable', 'tool', 'container', 'weapon'].includes(item.type)) || [];
                if (equipment.length > 0) {
                    equipment.forEach(item => {
                         content += `<li><strong>${item.name}</strong> (Qty: ${item.system?.quantity || 1}, Type: ${item.type}) ${item.system?.equipped ? '(Equipped)' : ''}</li>`;
                    });
                } else {
                    content += `<li>No equipment listed.</li>`;
                }
                 content += `<li><strong>Currency:</strong> GP: ${pcData.vtt_data?.currency?.gp || 0}, SP: ${pcData.vtt_data?.currency?.sp || 0}, CP: ${pcData.vtt_data?.currency?.cp || 0}, EP: ${pcData.vtt_data?.currency?.ep || 0}, PP: ${pcData.vtt_data?.currency?.pp || 0}</li>`;
                content += `</ul>`;
                return content;
            }
        },
        {
            title: "Spells",
            contentFn: () => { 
                let content = ``; const spellsByLevel = {};
                const spellItems = pcData.items?.filter(item => item.type === 'spell') || [];
                if (spellItems.length === 0) return "<p>No spells listed in items.</p>";
                spellItems.forEach(spell => {
                    const levelKey = spell.system?.level === 0 ? 'Cantrips' : `Level ${spell.system?.level}`;
                    if (!spellsByLevel[levelKey]) spellsByLevel[levelKey] = [];
                    spellsByLevel[levelKey].push({name: spell.name, school: spell.system?.school || 'N/A', desc: spell.system?.description?.value || ''});
                });
                const spellLevelsOrder = ['Cantrips'];
                for (let i = 1; i <= 9; i++) spellLevelsOrder.push(`Level ${i}`);
                Object.keys(spellsByLevel).forEach(lvlKey => {
                    if (!spellLevelsOrder.includes(lvlKey)) spellLevelsOrder.push(lvlKey);
                });
                let foundSpells = false;
                spellLevelsOrder.forEach(level => {
                    if (spellsByLevel[level] && spellsByLevel[level].length > 0) {
                        foundSpells = true; content += `<h5>${level}</h5><ul class="pc-sheet-list">`;
                        spellsByLevel[level].forEach(spell => {
                            let shortDesc = (spell.desc || 'No description.').replace(/<[^>]+>/g, '');
                            shortDesc = shortDesc.substring(0, 100) + (shortDesc.length > 100 ? '...' : '');
                            content += `<li title="${(spell.desc || '').replace(/<[^>]+>/g, '')}"><strong>${spell.name}</strong> <small>(${spell.school})</small> - <i>${shortDesc}</i></li>`;
                        });
                        content += `</ul>`;
                    }
                });
                return foundSpells ? content : "<p>No spells available or processed.</p>";
            }
        }
    ];
    collapsibleSectionsDataDetailed.forEach(sectionData => {
        html += `<div class="pc-section collapsible-section collapsed">
                    <h4 style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                        ${sectionData.title} <span class="arrow-indicator">►</span>
                    </h4>
                    <div class="collapsible-content" style="display: none;">${sectionData.contentFn()}</div>
                 </div>`;
    });
    html += `</div>`;
    dashboardContentElement.innerHTML = html;

    dashboardContentElement.querySelectorAll('.detailed-pc-sheet .collapsible-section h4').forEach(header => {
        header.addEventListener('click', () => {
            const section = header.parentElement;
            const content = section.querySelector('.collapsible-content');
            const arrow = header.querySelector('.arrow-indicator');
            section.classList.toggle('collapsed');
            if (section.classList.contains('collapsed')) {
                if (content) content.style.display = 'none';
                if (arrow) arrow.textContent = ' ►';
            } else {
                if (content) content.style.display = 'block';
                if (arrow) arrow.textContent = ' ▼';
            }
        });
    });
};

console.log("uiRenderers.js: Parsing FINISHED");
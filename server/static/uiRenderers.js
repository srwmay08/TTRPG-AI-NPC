// uiRenderers.js
// Responsibility: Functions that manipulate the DOM to display data.
// Assumes utils.js, config.js, dndCalculations.js, and appState.js are available.

// --- Character List Rendering ---
function renderNpcListForSceneUI(listContainerElement, allCharacters, activeNpcIds, onCheckboxChange, onNameClick) {
    if (!listContainerElement) return;
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
        checkbox.onchange = () => onCheckboxChange(charIdStr, char.name); // Callback

        const nameSpan = document.createElement('span');
        nameSpan.textContent = char.name;
        nameSpan.className = 'npc-name-clickable';
        nameSpan.onclick = () => onNameClick(charIdStr); // Callback

        li.appendChild(checkbox);
        li.appendChild(nameSpan);
        if (activeNpcIds.has(charIdStr)) {
            li.classList.add('active-in-scene');
        }
        ul.appendChild(li);
    });
}

function createPcQuickViewSectionHTML(isForDashboard) {
    // Assumes PC_QUICK_VIEW_BASE_TITLE is available from config.js
    const titleText = PC_QUICK_VIEW_BASE_TITLE;
    const fullTitle = isForDashboard ? `${titleText} (Click card for details)` : titleText;
    return `<h4>${fullTitle}</h4><div class="pc-dashboard-grid">`; // Ensure class "pc-dashboard-grid" exists
}

function renderPcListUI(pcListDiv, speakingPcSelect, allCharacters, activePcIds, onPcItemClick) {
    if (!pcListDiv) return;

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
        li.onclick = () => onPcItemClick(pcIdStr); // Callback

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
}


// --- Dialogue Area Rendering ---
function createNpcDialogueAreaUI(npcIdStr, npcName, containerElement) {
    if (!containerElement || getElem(`npc-area-${npcIdStr}`)) return; // Use global getElem for check

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
        <div id="suggested-memories-list-npc-${npcIdStr}" class="ai-suggestion-category"></div>
        <div id="suggested-topics-list-npc-${npcIdStr}" class="ai-suggestion-category"></div>
        <div id="suggested-npc-actions-list-npc-${npcIdStr}" class="ai-suggestion-category"><h5>NPC Actions:</h5></div>
        <div id="suggested-player-checks-list-npc-${npcIdStr}" class="ai-suggestion-category"><h5>Player Checks:</h5></div>
        <div id="suggested-faction-standing-changes-npc-${npcIdStr}" class="ai-suggestion-category"><h5>Faction Standing:</h5></div>
    `;
    areaDiv.appendChild(suggestionsDiv);

    containerElement.appendChild(areaDiv);
    adjustNpcDialogueAreaWidthsUI(containerElement);
}

function removeNpcDialogueAreaUI(npcIdStr, containerElement) {
    const areaDiv = getElem(`npc-area-${npcIdStr}`); // Use global getElem for check
    if (areaDiv) areaDiv.remove();
    adjustNpcDialogueAreaWidthsUI(containerElement);
    if (appState.getActiveNpcCount() === 0 && containerElement && !containerElement.querySelector('p.scene-event')) {
        containerElement.innerHTML = '<p class="scene-event">Select NPCs to add them to the scene.</p>';
    }
}

function adjustNpcDialogueAreaWidthsUI(containerElement) {
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
}

function appendMessageToTranscriptUI(transcriptArea, message, className) {
    if (!transcriptArea) return;
    const entry = document.createElement('p');
    entry.className = className;
    entry.textContent = message;
    transcriptArea.appendChild(entry);
    transcriptArea.scrollTop = transcriptArea.scrollHeight;
}

// --- Profile Pane Rendering ---
function renderCharacterProfileUI(character, elements, onSaveNotes, onAddMemory, onAssociateHistory) {
    if (!character) {
        updateText(elements.detailsCharName, 'None');
        updateText(elements.profileCharType, '');
        updateText(elements.profileDescription, '');
        updateText(elements.profilePersonality, '');
        getElem(elements.gmNotesTextarea).value = ''; // Assuming elements.gmNotesTextarea is the ID
        disableBtn(elements.saveGmNotesBtn, true);
        getElem(elements.npcMemoriesSection).style.display = 'none';
        getElem(elements.npcFactionStandingsSection).style.display = 'none';
        getElem(elements.characterHistorySection).style.display = 'block';
        getElem(elements.associatedHistoryList).innerHTML = '<li><em>Select a character.</em></li>';
        getElem(elements.historyContentDisplay).textContent = 'Select a character to view history.';
        disableBtn(elements.addMemoryBtn, true);
        disableBtn(elements.associateHistoryBtn, true);
        return;
    }

    updateText(elements.detailsCharName, character.name || "N/A");
    updateText(elements.profileCharType, character.character_type || "N/A");
    updateText(elements.profileDescription, character.description || "N/A");
    updateText(elements.profilePersonality, (character.personality_traits || []).join(', ') || "N/A");

    getElem(elements.gmNotesTextarea).value = character.gm_notes || '';
    disableBtn(elements.saveGmNotesBtn, false); // Enable save button

    const isNpc = character.character_type === 'NPC';
    getElem(elements.npcMemoriesSection).style.display = isNpc ? 'block' : 'none';
    getElem(elements.npcFactionStandingsSection).style.display = isNpc ? 'block' : 'none';
    getElem(elements.characterHistorySection).style.display = 'block';

    if (isNpc) {
        renderMemoriesUI(character.memories || [], getElem(elements.characterMemoriesList), elements.deleteMemoryCallback); // Assumes elements.deleteMemoryCallback
        renderNpcFactionStandingsUI(character, appState.getActivePcIds(), appState.getAllCharacters(), getElem(elements.npcFactionStandingsContent), elements.factionChangeCallback); // Assumes elements.factionChangeCallback
        disableBtn(elements.addMemoryBtn, false);
    } else {
        getElem(elements.characterMemoriesList).innerHTML = '<p><em>Memories are for NPCs only.</em></p>';
        disableBtn(elements.addMemoryBtn, true);
        const factionContent = getElem(elements.npcFactionStandingsContent);
        if(factionContent) factionContent.innerHTML = '<p><em>Faction standings are for NPCs.</em></p>';
    }

    renderAssociatedHistoryFilesUI(character, getElem(elements.associatedHistoryList), getElem(elements.historyContentDisplay), elements.dissociateHistoryCallback); // Assumes elements.dissociateHistoryCallback
    disableBtn(elements.associateHistoryBtn, false);
    // Fetching history files for the dropdown is more of a service/app.js concern
}

function renderMemoriesUI(memories, listElement, deleteCallback) {
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
}

function renderAssociatedHistoryFilesUI(character, listElement, contentDisplayElement, dissociateCallback) {
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
}

function renderNpcFactionStandingsUI(npc, activePcIds, allCharacters, contentElement, onStandingChange) {
    // ... (implementation of renderNpcFactionStandings, but taking elements and data as params)
    // ... this was not fully implemented in your original script but was stubbed.
    // ... It would iterate through active PCs, find them in allCharacters,
    // ... and create select dropdowns for each PC's standing with the NPC.
    // ... Example:
    // contentElement.innerHTML = '';
    // if (activePcIds.size === 0) {
    //     contentElement.innerHTML = "<p><em>No PCs in scene to show standings towards. Add PCs.</em></p>";
    //     return;
    // }
    // activePcIds.forEach(pcId => {
    //     const pc = allCharacters.find(c => String(c._id) === pcId && c.character_type === 'PC');
    //     if (pc) {
    //         // ... create label, select for FACTION_STANDING_SLIDER_ORDER ...
    //         // ... set current value from npc.pc_faction_standings[pcId] ...
    //         // ... select.onchange = (e) => onStandingChange(pcId, e.target.value); ...
    //         // ... append to contentElement ...
    //     }
    // });
    contentElement.innerHTML = "<p><em>Faction Standings UI to be fully implemented here.</em></p>"; // Placeholder
}


// ... Other UI rendering functions like renderDetailedPcSheetUI, updatePcDashboardUI
// ... These would be very large and need careful extraction and parameterization.
// ... For updatePcDashboardUI, you'd pass the dashboardContentElement, the list of selectedPcs,
// ... and the current state for expanded abilities/skills.

// --- Main View Management ---
function updateMainViewUI(dialogueInterfaceElem, pcDashboardViewElem, pcQuickViewInSceneElem, activeNpcCount, showPcDashboard) {
    if (activeNpcCount > 0) {
        dialogueInterfaceElem.style.display = 'flex';
        pcDashboardViewElem.style.display = 'none';
        // PC Quick View in scene is handled by its own render function
    } else {
        dialogueInterfaceElem.style.display = 'none';
        pcDashboardViewElem.style.display = 'block';
        pcQuickViewInSceneElem.style.display = 'none';
        pcQuickViewInSceneElem.innerHTML = '';

        const dashboardContent = getElem('pc-dashboard-content'); // Still might need getElem for root containers
        if (dashboardContent && !dashboardContent.querySelector('.detailed-pc-sheet')) { // Avoid re-rendering if detailed sheet is up
             if (showPcDashboard) { // showPcDashboard is a boolean based on activePcIds.size > 0
                 // Call to render the PC dashboard overview
                 updatePcDashboardUI(dashboardContent, appState.getAllCharacters().filter(c => appState.hasActivePc(String(c._id))), appState.getExpandedAbility(), appState.getExpandedSkill(), appState.getSkillSortKey());
             } else {
                 dashboardContent.innerHTML = `<p class="pc-dashboard-no-selection">Select Player Characters from the left panel to view their details and comparisons.</p>`;
             }
        }
    }
}
function renderPcQuickViewInSceneUI(wrapperElement, activePcsData) {
    // ... (implementation based on original renderPcQuickViewInScene)
    // ... Uses generatePcQuickViewCardHTML
    if (activePcsData.length === 0) {
        wrapperElement.innerHTML = '';
        wrapperElement.style.display = 'none';
        return;
    }
    // Assumes PC_QUICK_VIEW_BASE_TITLE is available from config.js
    let contentHTML = `<h4>${PC_QUICK_VIEW_BASE_TITLE}</h4><div class="pc-dashboard-grid">`;
    activePcsData.sort((a, b) => a.name.localeCompare(b.name)).forEach(pc => {
        // Ensure calculatedProfBonus is set if not already (might be better in characterService or appState.processCharacterData)
        if (pc.calculatedProfBonus === undefined) {
            const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || pc.vtt_data?.details?.level || 1;
            pc.calculatedProfBonus = getProficiencyBonus(pcLevel);
        }
        contentHTML += generatePcQuickViewCardHTML(pc, false); // Assuming generatePcQuickViewCardHTML is also moved/accessible
    });
    contentHTML += `</div>`;
    wrapperElement.innerHTML = contentHTML;
    wrapperElement.style.display = 'block';
}


// ... Many more rendering functions will go here (renderDetailedPcSheet, updatePcDashboard and its helpers)
// generatePcQuickViewCardHTML should also be moved here or to a pcCardRenderer.js
function generatePcQuickViewCardHTML(pc, isClickableForDetailedView = false) {
    // ... (Keep the original implementation, but ensure it uses passed-in pc data)
    // ... and constants like getAbilityModifier, getProficiencyBonus are accessible.
    if (!pc) return '';
    // Ensure VTT data structures exist (this could be pre-processed when characters are loaded)
    pc.vtt_data = pc.vtt_data || { abilities: {}, attributes: { hp: {}, ac: {}, movement: {}, init: {}, spell: {} }, details: {}, skills: {}, traits: { languages: {}, armorProf: {}, weaponProf: {}} };
    // ... (rest of the safety checks for vtt_data sub-objects)

    const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || pc.vtt_data?.details?.level || 1;
    if (pc.calculatedProfBonus === undefined) { // Should ideally be pre-calculated
        pc.calculatedProfBonus = getProficiencyBonus(pcLevel);
    }

    let cardClasses = 'pc-stat-card';
    let dataAttributes = '';
    if (isClickableForDetailedView) {
        cardClasses += ' clickable-pc-card';
        dataAttributes = `data-pc-id="${String(pc._id)}"`;
    }

    let cardHTML = `<div class="${cardClasses}" ${dataAttributes}>`;
    cardHTML += `<h4>${pc.name} (Lvl ${pcLevel})</h4>`;
    // ... (rest of the HTML generation from your original function)
    const hpCurrent = pc.vtt_data.attributes.hp?.value ?? 'N/A';
    const hpMax = pc.vtt_data.attributes.hp?.max ?? pc.system?.attributes?.hp?.max ?? 'N/A';
    cardHTML += `<p><strong>HP:</strong> ${hpCurrent} / ${hpMax}</p>`;

    let acDisplay = pc.vtt_flags?.ddbimporter?.overrideAC?.flat ?? pc.vtt_data.attributes.ac?.value ?? pc.vtt_data.attributes.ac?.flat;
    if (acDisplay === undefined || acDisplay === null) {
        const equippedArmor = pc.items?.find(item => item.type === 'equipment' && item.system?.equipped && item.system?.armor?.value !== undefined);
        if (equippedArmor && equippedArmor.system?.armor) {
            acDisplay = equippedArmor.system.armor.value;
            const dexForAC = pc.vtt_data.abilities.dex?.value;
            if (equippedArmor.system.armor.dex !== null && equippedArmor.system.armor.dex !== undefined && dexForAC) {
                const dexMod = getAbilityModifier(dexForAC);
                acDisplay += Math.min(dexMod, equippedArmor.system.armor.dex);
            } else if (equippedArmor.system.armor.dex === null && dexForAC) {
                 acDisplay += getAbilityModifier(dexForAC);
            }
        } else {
            acDisplay = 10 + getAbilityModifier(pc.vtt_data.abilities.dex?.value || 10);
        }
    }
    cardHTML += `<p><strong>AC:</strong> ${acDisplay}</p>`;
    cardHTML += `<p><strong>Prof. Bonus:</strong> +${pc.calculatedProfBonus}</p>`;
    cardHTML += `<p><strong>Speed:</strong> ${pc.vtt_data.attributes.movement?.walk || pc.system?.attributes?.movement?.walk || 0} ft</p>`;

    let initiativeBonus = 'N/A';
    const initAbilityKey = pc.vtt_data.attributes.init?.ability;
    const dexValue = pc.vtt_data.abilities.dex?.value;
    if (initAbilityKey && pc.vtt_data.abilities[initAbilityKey]) {
        initiativeBonus = getAbilityModifier(pc.vtt_data.abilities[initAbilityKey].value || 10);
    } else if (pc.vtt_data.attributes.init?.bonus !== undefined && pc.vtt_data.attributes.init.bonus !== "") {
        initiativeBonus = parseInt(pc.vtt_data.attributes.init.bonus) || 0;
    } else if (dexValue !== undefined) {
        initiativeBonus = getAbilityModifier(dexValue);
    }
    cardHTML += `<p><strong>Initiative:</strong> ${initiativeBonus >= 0 ? '+' : ''}${initiativeBonus}</p>`;

    const spellcastingAbilityKey = pc.system?.attributes?.spellcasting || pc.vtt_data.attributes.spellcasting;
    let spellDcText = "N/A";
    if (spellcastingAbilityKey && pc.vtt_data.abilities[spellcastingAbilityKey]?.value !== undefined) {
        const castingScore = pc.vtt_data.abilities[spellcastingAbilityKey].value || 10;
        spellDcText = spellSaveDC(castingScore, pc.calculatedProfBonus);
    } else if (pc.vtt_data.attributes.spell?.dc) {
        spellDcText = pc.vtt_data.attributes.spell.dc;
    }
    cardHTML += `<p><strong>Spell DC:</strong> ${spellDcText}</p>`;
    cardHTML += `</div>`;
    return cardHTML;
}

// If using ES6 modules:
// export { renderNpcListForSceneUI, renderPcListUI, ... };
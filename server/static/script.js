// --- Global Debug Flags ---
const DEBUG_DELEGATED_CARD_CLICK = false; // Set to true to enable specific card click logs

// --- Global State Variables ---
let activeSceneNpcIds = new Set();
let activePcIds = new Set();
let allCharacters = []; // This will store character objects
// dialogueHistory is not explicitly used in the provided base, dialogueHistories is.
// let dialogueHistory = []; // Deprecated or replaced by dialogueHistories
let dialogueHistories = {}; // For per-NPC history
let currentProfileCharId = null;
let currentlyExpandedAbility = null;
let currentlyExpandedSkill = null;
let skillSortKey = null;

// --- Constants ---
const API_BASE_URL = ''; // Assuming your API is at the same origin
const ABILITY_KEYS_ORDER = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const SKILL_NAME_MAP = { // Used by PC Sheet and PC Dashboard
    "acr": "Acrobatics (Dex)", "ani": "Animal Handling (Wis)", "arc": "Arcana (Int)", "ath": "Athletics (Str)",
    "dec": "Deception (Cha)", "his": "History (Int)", "ins": "Insight (Wis)", "itm": "Intimidation (Cha)",
    "inv": "Investigation (Int)", "med": "Medicine (Wis)", "nat": "Nature (Int)", "prc": "Perception (Wis)",
    "prf": "Performance (Cha)", "per": "Persuasion (Cha)", "rel": "Religion (Int)", "slt": "Sleight of Hand (Dex)",
    "ste": "Stealth (Dex)", "sur": "Survival (Wis)"
};

// --- Utility Functions ---
function getElem(id) { return document.getElementById(id); }
function updateText(id, text) {
    const elem = getElem(id);
    if (elem) elem.textContent = text;
    else console.warn(`updateText: Element with ID '${id}' not found.`);
}
function disableBtn(id, disabled) {
    const elem = getElem(id);
    if (elem) elem.disabled = disabled;
    else console.warn(`disableBtn: Element with ID '${id}' not found.`);
}

// --- D&D 5e Calculation Functions (Restored from your provided base) ---
function getAbilityModifier(score) { return Math.floor(((score || 10) - 10) / 2); }
function carryingCapacity(score) { return (score || 10) * 15; }
function pushDragLift(score) { return (score || 10) * 30; }
function longJump(score, running = true) { score = score || 10; return running ? score : Math.floor(score / 2); }
function highJump(score, running = true) { score = score || 10; const mod = getAbilityModifier(score); return running ? (3 + mod) : Math.floor((3 + mod) / 2); }
function initiative(dexScore) { return getAbilityModifier(dexScore || 10); }
function holdBreath(conScore) { conScore = conScore || 10; return Math.max(1 + getAbilityModifier(conScore), 0.5) + " minutes"; }
function spellSaveDC(castingStatScore, proficiencyBonus) { return 8 + getAbilityModifier(castingStatScore || 10) + proficiencyBonus; }
function spellAttackBonus(castingStatScore, proficiencyBonus) { return getAbilityModifier(castingStatScore || 10) + proficiencyBonus; }
function savingThrowBonus(abilityScore, proficientInSave = false, proficiencyBonus = 0) {
    const mod = getAbilityModifier(abilityScore || 10);
    return mod + (proficientInSave ? proficiencyBonus : 0);
}
function calculateSkillBonus(baseStatScore, skillProficiencyValue, proficiencyBonus) {
    const modifier = getAbilityModifier(baseStatScore || 10);
    let skillBonus = modifier;
    if (skillProficiencyValue === 1) { // Proficient
        skillBonus += proficiencyBonus;
    } else if (skillProficiencyValue === 2) { // Expertise
        skillBonus += (proficiencyBonus * 2);
    } else if (skillProficiencyValue === 0.5) { // Half-proficiency
        skillBonus += Math.floor(proficiencyBonus / 2);
    }
    return skillBonus;
}
function calculatePassiveSkill(baseStatScore, skillProficiencyValue, proficiencyBonus) {
    const skillBonus = calculateSkillBonus(baseStatScore || 10, skillProficiencyValue, proficiencyBonus);
    return 10 + skillBonus;
}
function getProficiencyBonus(level) {
    level = level || 1;
    if (level < 1) return 2;
    if (level <= 4) return 2;
    if (level <= 8) return 3;
    if (level <= 12) return 4;
    if (level <= 16) return 5;
    return 6;
}

// --- Character Data & Rendering ---
async function fetchCharacters() {
    console.log("Fetching characters...");
    try {
        const response = await fetch(`${API_BASE_URL}/api/npcs`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const charactersFromServer = await response.json();
        allCharacters = charactersFromServer.map(char => {
            if (char._id && typeof char._id === 'object' && char._id.$oid) char._id = char._id.$oid;
            return {
                ...{ // Default structure
                    combined_history_content: "", 
                    vtt_data: {}, vtt_flags: {}, items: [], system: {},
                    memories: [], associated_history_files: []
                }, ...char
            };
        });
        console.log("Characters fetched and processed:", allCharacters.length);
        renderNpcListForScene();
        renderPcList();
        updateView();
    } catch (error) {
        console.error('Error in fetchCharacters:', error);
        if (getElem('character-list')) getElem('character-list').innerHTML = '<ul><li><em>Error loading NPCs.</em></li></ul>';
        if (getElem('active-pc-list')) getElem('active-pc-list').innerHTML = '<p><em>Error loading PCs.</em></p>';
    }
}

function renderNpcListForScene() {
    const listContainer = getElem('character-list'); if (!listContainer) return;
    let ul = listContainer.querySelector('ul'); if (!ul) { ul = document.createElement('ul'); listContainer.appendChild(ul); }
    ul.innerHTML = '';
    const npcs = allCharacters.filter(char => char.character_type === 'NPC').sort((a, b) => a.name.localeCompare(b.name));
    if (npcs.length === 0) { ul.innerHTML = '<li><p><em>No NPCs defined yet.</em></p></li>'; return; }
    npcs.forEach(char => {
        const charIdStr = String(char._id); const li = document.createElement('li'); li.dataset.charId = charIdStr;
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.id = `npc-scene-checkbox-${charIdStr}`;
        checkbox.checked = activeSceneNpcIds.has(charIdStr); checkbox.onchange = () => toggleNpcInScene(charIdStr, char.name);
        const nameSpan = document.createElement('span'); nameSpan.textContent = char.name; nameSpan.className = 'npc-name-clickable';
        nameSpan.onclick = async () => { await selectCharacterForDetails(charIdStr); };
        li.appendChild(checkbox); li.appendChild(nameSpan);
        if (activeSceneNpcIds.has(charIdStr)) li.classList.add('active-in-scene');
        ul.appendChild(li);
    });
}

async function triggerNpcGreeting(npcIdStr, npcName, dialogueRequestPayload) {
    console.log(`Triggering greeting for ${npcName}`);
    const transcriptArea = getElem(`transcript-${npcIdStr}`);
    if (!transcriptArea) { console.error(`Transcript area for NPC ID ${npcIdStr} not found for greeting.`); return; }
    if (!dialogueHistories[npcIdStr]) dialogueHistories[npcIdStr] = [];
    const sceneEventP = document.createElement('p'); sceneEventP.className = 'scene-event';
    sceneEventP.textContent = `${npcName} notices ${dialogueRequestPayload.active_pcs.join(', ') || 'someone'}...`;
    transcriptArea.appendChild(sceneEventP); transcriptArea.scrollTop = transcriptArea.scrollHeight;
    try {
        const response = await fetch(`${API_BASE_URL}/api/npcs/${npcIdStr}/dialogue`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dialogueRequestPayload)
        });
        const result = await response.json();
        const npcResponseEntry = document.createElement('p'); npcResponseEntry.className = 'dialogue-entry npc-response';
        if (!response.ok) { const errorMsg = result.error || `Greeting generation failed for ${npcName}.`; throw new Error(errorMsg); }
        npcResponseEntry.textContent = `${npcName}: ${result.npc_dialogue}`;
        dialogueHistories[npcIdStr].push(`${npcName}: ${result.npc_dialogue}`);
        renderAiSuggestions(result.new_memory_suggestions, result.generated_topics, npcIdStr);
        transcriptArea.appendChild(npcResponseEntry);
    } catch (error) {
        console.error(`Error generating greeting for ${npcName}:`, error);
        const npcErrorEntry = document.createElement('p'); npcErrorEntry.className = 'dialogue-entry npc-response';
        npcErrorEntry.textContent = `${npcName}: (Error: ${error.message})`;
        transcriptArea.appendChild(npcErrorEntry);
        dialogueHistories[npcIdStr].push(`${npcName}: (Error generating greeting)`);
    }
    transcriptArea.scrollTop = transcriptArea.scrollHeight;
}

async function toggleNpcInScene(npcIdStr, npcName) {
    const multiNpcContainer = getElem('multi-npc-dialogue-container'); if (!multiNpcContainer) return;
    const isAdding = !activeSceneNpcIds.has(npcIdStr);
    if (isAdding) {
        activeSceneNpcIds.add(npcIdStr); createNpcDialogueArea(npcIdStr, npcName); dialogueHistories[npcIdStr] = [];
        if (activePcIds.size > 0) {
            const sceneContext = getElem('scene-context').value.trim();
            const activePcNames = Array.from(activePcIds).map(pcId => allCharacters.find(c=>String(c._id)===pcId)?.name || "a PC");
            const greetingPayload = {
                scene_context: sceneContext || `${activePcNames.join(', ')} ${activePcNames.length > 1 ? 'are' : 'is'} present.`,
                player_utterance: `(${activePcNames.join(', ')} ${activePcNames.length > 1 ? 'have' : 'has'} just entered or you have noticed them.)`,
                active_pcs: activePcNames, recent_dialogue_history: []
            };
            setTimeout(() => triggerNpcGreeting(npcIdStr, npcName, greetingPayload), 50);
        }
    } else {
        activeSceneNpcIds.delete(npcIdStr); removeNpcDialogueArea(npcIdStr); delete dialogueHistories[npcIdStr];
    }
    adjustNpcDialogueAreaWidths();
    if (activeSceneNpcIds.size > 0 && multiNpcContainer.querySelector('p.scene-event')) {
        multiNpcContainer.innerHTML = '';
        activeSceneNpcIds.forEach(id => { const npc = allCharacters.find(c => String(c._id) === id); if(npc && !getElem(`npc-area-${id}`)) createNpcDialogueArea(id, npc.name); });
    } else if (activeSceneNpcIds.size === 0) { multiNpcContainer.innerHTML = '<p class="scene-event">Select NPCs to add them to the scene.</p>'; }
    renderNpcListForScene(); disableBtn('generate-dialogue-btn', activeSceneNpcIds.size === 0);
    updateView();
}

function createNpcDialogueArea(npcIdStr, npcName) {
    const container = getElem('multi-npc-dialogue-container'); if (!container) return;
    const placeholder = container.querySelector('p.scene-event');
    if (placeholder && activeSceneNpcIds.size > 0) placeholder.remove();
    if (getElem(`npc-area-${npcIdStr}`)) return;
    const areaDiv = document.createElement('div'); areaDiv.className = 'npc-dialogue-area'; areaDiv.id = `npc-area-${npcIdStr}`;
    const nameHeader = document.createElement('h3'); nameHeader.textContent = npcName; areaDiv.appendChild(nameHeader);
    const transcriptDiv = document.createElement('div'); transcriptDiv.className = 'npc-transcript'; transcriptDiv.id = `transcript-${npcIdStr}`;
    transcriptDiv.innerHTML = `<p class="scene-event">Dialogue with ${npcName} starts.</p>`; areaDiv.appendChild(transcriptDiv);
    container.appendChild(areaDiv); adjustNpcDialogueAreaWidths();
}
function removeNpcDialogueArea(npcIdStr) {
    const areaDiv = getElem(`npc-area-${npcIdStr}`); if (areaDiv) areaDiv.remove();
    adjustNpcDialogueAreaWidths();
    const container = getElem('multi-npc-dialogue-container'); if (!container) return;
    if (activeSceneNpcIds.size === 0 && !container.querySelector('p.scene-event')) { container.innerHTML = '<p class="scene-event">Select NPCs to add them to the scene.</p>'; }
}
function adjustNpcDialogueAreaWidths() {
    const container = getElem('multi-npc-dialogue-container'); if (!container) return;
    const dialogueAreas = container.querySelectorAll('.npc-dialogue-area'); const numAreas = dialogueAreas.length;
    if (numAreas === 0) return;
    const widthPercent = Math.max(25, 100 / numAreas); 
    dialogueAreas.forEach(area => { area.style.minWidth = `250px`; area.style.flexBasis = `${widthPercent}%`; area.style.flexGrow = `1`; });
}

function renderPcList() {
    const pcListDiv = getElem('active-pc-list'); if (!pcListDiv) return;
    pcListDiv.innerHTML = '';
    const pcs = allCharacters.filter(char => char.character_type === 'PC').sort((a,b) => a.name.localeCompare(b.name));
    if (pcs.length === 0) { pcListDiv.innerHTML = '<p><em>No Player Characters defined yet.</em></p>'; return; }
    const ul = document.createElement('ul');
    pcs.forEach(pc => {
        const pcIdStr = String(pc._id); const li = document.createElement('li');
        li.style.cursor = "pointer"; li.textContent = pc.name; li.dataset.charId = pcIdStr;
        li.onclick = async () => {
            console.log(`PC List Item clicked: ${pc.name} (ID: ${pcIdStr})`);
            togglePcSelection(pcIdStr); // This updates activePcIds and will call renderPcList via updateView chain
            await selectCharacterForDetails(pcIdStr); // Update profile panel
            // updatePcDashboard is called by updateView if necessary
            updateView(); // This will ensure PC Dashboard is visible if no NPCs are active
        };
        if (activePcIds.has(pcIdStr)) li.classList.add('selected');
        else li.classList.remove('selected');
        ul.appendChild(li);
    });
    pcListDiv.appendChild(ul);
}

// This function is no longer needed as PC removal is handled by left-panel clicks.
// function removePcFromScene(pcIdToRemove) { /* ... code removed ... */ }

function renderPcQuickViewInScene() {
    const container = getElem('pc-quick-view-in-scene'); if (!container) return;
    container.innerHTML = ''; 
    const activePcs = allCharacters.filter(char => activePcIds.has(String(char._id)) && char.character_type === 'PC');
    if (activePcs.length === 0) { container.style.display = 'none'; return; }
    container.style.display = 'flex';
    activePcs.sort((a,b) => a.name.localeCompare(b.name)).forEach(pc => {
        const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || pc.vtt_data?.details?.level || 1;
        const card = document.createElement('div'); card.className = 'pc-stat-card';
        let acDisplay = pc.vtt_flags?.ddbimporter?.overrideAC?.flat ?? pc.vtt_data?.attributes?.ac?.value ?? pc.vtt_data?.attributes?.ac?.flat;
        if (acDisplay === undefined || acDisplay === null) {
            const equippedArmor = pc.items?.find(item => item.type === 'equipment' && item.system?.equipped && item.system?.armor?.value !== undefined);
            if (equippedArmor) { acDisplay = equippedArmor.system.armor.value; if (equippedArmor.system.armor.dex !== null && equippedArmor.system.armor.dex !== undefined && pc.vtt_data?.abilities?.dex?.value) { const dexMod = getAbilityModifier(pc.vtt_data.abilities.dex.value); acDisplay += Math.min(dexMod, equippedArmor.system.armor.dex); } else if (equippedArmor.system.armor.dex === null && pc.vtt_data?.abilities?.dex?.value) { acDisplay += getAbilityModifier(pc.vtt_data.abilities.dex.value); }
            } else { acDisplay = 10 + getAbilityModifier(pc.vtt_data?.abilities?.dex?.value || 10); }
        }
        card.innerHTML = `<h4>${pc.name} (Lvl ${pcLevel})</h4> 
                          <p>HP: ${pc.vtt_data?.attributes?.hp?.value ?? 'N/A'} / ${pc.vtt_data?.attributes?.hp?.max ?? pc.system?.attributes?.hp?.max ?? 'N/A'}</p>
                          <p>AC: ${acDisplay}</p>`;
        container.appendChild(card);
    });
    // Removed event listener attachment for .remove-pc-from-scene-btn
}

async function fetchHistoryFiles() {
    const selectElement = getElem('history-file-select'); if (!selectElement) return;
    const currentValue = selectElement.value; selectElement.innerHTML = '<option value="">-- Select a history file --</option>';
    try {
        const response = await fetch(`${API_BASE_URL}/api/history_files`);
        if (!response.ok) throw new Error(`Failed to fetch history files: ${response.status}`);
        const files = await response.json();
        files.forEach(file => { const option = document.createElement('option'); option.value = file; option.textContent = file; selectElement.appendChild(option); });
        if (files.includes(currentValue)) selectElement.value = currentValue;
    } catch (error) { console.error("Error fetching history files:", error); selectElement.innerHTML += `<option value="" disabled>Error loading.</option>`; }
}

async function associateHistoryFile() {
    const charIdToUse = String(currentProfileCharId); if (!charIdToUse) { alert("Please select a character first."); return; }
    const selectedFile = getElem('history-file-select').value; if (!selectedFile) { alert("Please select a history file to add."); return; }
    try {
        const response = await fetch(`${API_BASE_URL}/api/character/${charIdToUse}/associate_history`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ history_file: selectedFile }) });
        const result = await response.json(); if (!response.ok) throw new Error(result.error || `Failed to associate. Status: ${response.status}`);
        alert(result.message || "Associated successfully.");
        const charIndex = allCharacters.findIndex(c => String(c._id) === charIdToUse);
        if (charIndex > -1 && result.character) { let updatedChar = result.character; if (updatedChar._id?.$oid) updatedChar._id = updatedChar._id.$oid; allCharacters[charIndex] = updatedChar; }
        await selectCharacterForDetails(charIdToUse);
    } catch (error) { console.error("Error associating history file:", error); alert(`Error: ${error.message}`); }
}

async function dissociateHistoryFile(filename) {
    const charIdToUse = String(currentProfileCharId); if (!charIdToUse) { alert("No character selected."); return; }
    if (!confirm(`Remove "${filename}" from this character's history?`)) return;
    try {
        const response = await fetch(`${API_BASE_URL}/api/character/${charIdToUse}/dissociate_history`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ history_file: filename }) });
        const result = await response.json(); if (!response.ok) throw new Error(result.error || "Failed to dissociate.");
        alert(result.message || "Dissociated successfully.");
        const charIndex = allCharacters.findIndex(c => String(c._id) === charIdToUse);
        if (charIndex > -1 && result.character) { let updatedChar = result.character; if (updatedChar._id?.$oid) updatedChar._id = updatedChar._id.$oid; allCharacters[charIndex] = updatedChar; }
        await selectCharacterForDetails(charIdToUse);
    } catch (error) { console.error("Error dissociating file:", error); alert(`Error: ${error.message}`); }
}

function renderAssociatedHistoryFiles(character) {
    const listElement = getElem('associated-history-list'); if (!listElement) return;
    listElement.innerHTML = '';
    if (character?.associated_history_files?.length > 0) {
        character.associated_history_files.forEach(filename => {
            const li = document.createElement('li'); li.textContent = filename;
            const removeBtn = document.createElement('button'); removeBtn.textContent = 'Remove'; removeBtn.className = 'remove-history-btn'; removeBtn.onclick = () => dissociateHistoryFile(filename);
            li.appendChild(removeBtn); listElement.appendChild(li);
        });
    } else { listElement.innerHTML = '<li><em>None associated.</em></li>'; }
    const historyContentDisplay = getElem('history-content-display');
    if (historyContentDisplay) historyContentDisplay.textContent = character?.combined_history_content || (character?.associated_history_files?.length > 0 ? "Content not loaded." : "No history files.");
}

async function selectCharacterForDetails(charIdStr) {
    console.log("selectCharacterForDetails: Fetching details for char ID:", charIdStr); currentProfileCharId = charIdStr;
    try {
        const response = await fetch(`${API_BASE_URL}/api/npcs/${charIdStr}`); if (!response.ok) throw new Error(`Failed to fetch details: ${response.status}`);
        let selectedChar = await response.json(); if (selectedChar._id?.$oid) selectedChar._id = selectedChar._id.$oid;
        selectedChar = {...{combined_history_content:"", vtt_data:{}, vtt_flags:{}, items:[], system:{}, memories: [], associated_history_files:[]}, ...selectedChar};
        const charIndex = allCharacters.findIndex(c => String(c._id) === charIdStr);
        if (charIndex > -1) allCharacters[charIndex] = selectedChar; else allCharacters.push(selectedChar);
        updateText('details-char-name', selectedChar.name || "N/A"); updateText('profile-char-type', selectedChar.character_type || "N/A");
        updateText('profile-description', selectedChar.description || "N/A"); updateText('profile-personality', (selectedChar.personality_traits || []).join(', ') || "N/A");
        getElem('gm-notes').value = selectedChar.gm_notes || ''; disableBtn('save-gm-notes-btn', false);
        getElem('npc-memories-collapsible-section').style.display = selectedChar.character_type === 'NPC' ? 'block' : 'none';
        getElem('character-history-collapsible-section').style.display = 'block';
        if (selectedChar.character_type === 'NPC') { renderMemories(selectedChar.memories); disableBtn('add-memory-btn', false); }
        else { disableBtn('add-memory-btn', true); getElem('character-memories-list').innerHTML = '<p><em>Memories for NPCs.</em></p>'; }
        renderAssociatedHistoryFiles(selectedChar); await fetchHistoryFiles(); disableBtn('associate-history-btn', false);
    } catch (error) { console.error("Error in selectCharacterForDetails:", error); /* Reset UI */ }
}

function togglePcSelection(pcIdStr) { // Removed elementListItem parameter
    console.log("Toggling PC selection for:", pcIdStr);
    if (activePcIds.has(pcIdStr)) {
        activePcIds.delete(pcIdStr);
    } else {
        activePcIds.add(pcIdStr);
    }
    renderPcList(); // Re-render to update selection styles for all items
    updateView(); 
}

function updateView() {
    const dialogueInterface = getElem('dialogue-interface');
    const pcDashboardView = getElem('pc-dashboard-view');
    const pcQuickViewInScene = getElem('pc-quick-view-in-scene');
    if (!dialogueInterface || !pcDashboardView || !pcQuickViewInScene) { console.error("updateView: Critical UI element(s) missing."); return; }

    if (activeSceneNpcIds.size > 0) { // NPC Dialogue Mode
        dialogueInterface.style.display = 'flex'; 
        pcDashboardView.style.display = 'none';
        if (activePcIds.size > 0) { 
            renderPcQuickViewInScene(); 
            pcQuickViewInScene.style.display = 'flex'; 
        } else { 
            pcQuickViewInScene.style.display = 'none'; 
            pcQuickViewInScene.innerHTML = ''; 
        }
    } else { // PC Dashboard Mode (No NPCs in Scene)
        dialogueInterface.style.display = 'none'; 
        pcDashboardView.style.display = 'block';  
        pcQuickViewInScene.style.display = 'none'; 
        pcQuickViewInScene.innerHTML = '';       
        if (!getElem('pc-dashboard-content').querySelector('.detailed-pc-sheet')) { 
            updatePcDashboard(); 
        }
    }
}

function updatePcDashboard() {
    console.log("Updating PC Dashboard (Overview). Active PC IDs:", new Set(activePcIds));
    const dashboardContent = getElem('pc-dashboard-content');
    if (!dashboardContent) { console.error("updatePcDashboard: 'pc-dashboard-content' not found."); return; }
    dashboardContent.innerHTML = '';

    const selectedPcs = allCharacters.filter(char => activePcIds.has(String(char._id)) && char.character_type === 'PC' && char.vtt_data);
    console.log("Selected PCs for dashboard overview:", selectedPcs.map(p => ({name: p.name, id: p._id, vtt: !!p.vtt_data}) ));

    if (selectedPcs.length === 0) {
        dashboardContent.innerHTML = `<p class="pc-dashboard-no-selection">Select Player Characters from the left panel to view their details and comparisons.</p>`;
        return;
    }
    selectedPcs.forEach(pc => {
         const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || pc.vtt_data?.details?.level || 1;
         pc.calculatedProfBonus = getProficiencyBonus(pcLevel);
    });

    let statCardsHTML = `<h4>PC Quick View (Click card for details)</h4><div class="pc-dashboard-grid">`;
    const sortedSelectedPcsByName = [...selectedPcs].sort((a,b) => a.name.localeCompare(b.name));
    sortedSelectedPcsByName.forEach(pc => {
        const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || pc.vtt_data?.details?.level || 1;
        statCardsHTML += `<div class="pc-stat-card clickable-pc-card" data-pc-id="${String(pc._id)}"><h4>${pc.name} (Lvl ${pcLevel})</h4>`;
        const hpCurrent = pc.vtt_data?.attributes?.hp?.value ?? 'N/A';
        const hpMax = pc.vtt_data?.attributes?.hp?.max ?? pc.system?.attributes?.hp?.max ?? 'N/A';
        statCardsHTML += `<p><strong>HP:</strong> ${hpCurrent} / ${hpMax}</p>`;
        let acDisplay = pc.vtt_flags?.ddbimporter?.overrideAC?.flat ?? pc.vtt_data?.attributes?.ac?.value ?? pc.vtt_data?.attributes?.ac?.flat;
        if (acDisplay === undefined || acDisplay === null) {
            const equippedArmor = pc.items?.find(item => item.type === 'equipment' && item.system?.equipped && item.system?.armor?.value !== undefined);
            if (equippedArmor) { acDisplay = equippedArmor.system.armor.value; if (equippedArmor.system.armor.dex !== null && equippedArmor.system.armor.dex !== undefined && pc.vtt_data?.abilities?.dex?.value) { const dexMod = getAbilityModifier(pc.vtt_data.abilities.dex.value); acDisplay += Math.min(dexMod, equippedArmor.system.armor.dex); } else if (equippedArmor.system.armor.dex === null && pc.vtt_data?.abilities?.dex?.value) { acDisplay += getAbilityModifier(pc.vtt_data.abilities.dex.value); }
            } else { acDisplay = 10 + getAbilityModifier(pc.vtt_data?.abilities?.dex?.value || 10); }
        }
        statCardsHTML += `<p><strong>AC:</strong> ${acDisplay}</p>`;
        statCardsHTML += `<p><strong>Prof. Bonus:</strong> +${pc.calculatedProfBonus}</p>`;
        statCardsHTML += `<p><strong>Speed:</strong> ${pc.vtt_data?.attributes?.movement?.walk || pc.system?.attributes?.movement?.walk || 0} ft</p>`;
        let initiativeBonus = 'N/A'; const initAbility = pc.vtt_data?.attributes?.init?.ability; const dexValue = pc.vtt_data?.abilities?.dex?.value;
        if (initAbility && pc.vtt_data?.abilities?.[initAbility]) { initiativeBonus = getAbilityModifier(pc.vtt_data.abilities[initAbility].value || 10); }
        else if (pc.vtt_data?.attributes?.init?.bonus !== undefined && pc.vtt_data.attributes.init.bonus !== "") { initiativeBonus = pc.vtt_data.attributes.init.bonus; }
        else if (dexValue !== undefined) { initiativeBonus = getAbilityModifier(dexValue); }
        statCardsHTML += `<p><strong>Initiative:</strong> ${initiativeBonus >= 0 ? '+' : ''}${initiativeBonus}</p>`;
        const spellcastingAbilityKey = pc.system?.attributes?.spellcasting || pc.vtt_data?.attributes?.spellcasting;
        let spellDcText = "N/A";
        if (spellcastingAbilityKey && pc.vtt_data?.abilities?.[spellcastingAbilityKey]?.value !== undefined) { const castingScore = pc.vtt_data.abilities[spellcastingAbilityKey].value || 10; spellDcText = spellSaveDC(castingScore, pc.calculatedProfBonus); }
        else if (pc.vtt_data?.attributes?.spell?.dc) { spellDcText = pc.vtt_data.attributes.spell.dc; }
        statCardsHTML += `<p><strong>Spell DC:</strong> ${spellDcText}</p></div>`;
    });
    statCardsHTML += `</div>`;
    dashboardContent.innerHTML += statCardsHTML;

    const abilitiesForTable = ABILITY_KEYS_ORDER.map(k => k.toUpperCase());
    let mainStatsTableHTML = `<h4>Ability Scores Overview</h4><table id="main-stats-table"><thead><tr><th>Character</th>`;
    abilitiesForTable.forEach(ablKey => {
        const arrow = (currentlyExpandedAbility === ablKey && document.getElementById(`expanded-${ablKey}`)?.style.display !== 'none') ? '▼' : '►';
        mainStatsTableHTML += `<th class="clickable-ability-header" data-ability="${ablKey}" onclick="toggleAbilityExpansion('${ablKey}')">${ablKey} <span class="arrow-indicator">${arrow}</span></th>`;
    });
    mainStatsTableHTML += `</tr></thead><tbody>`;
    sortedSelectedPcsByName.forEach(pc => {
        mainStatsTableHTML += `<tr><td>${pc.name}</td>`;
        ABILITY_KEYS_ORDER.forEach(ablKey => { 
            const score = pc.vtt_data?.abilities?.[ablKey]?.value || 0; const mod = getAbilityModifier(score);
            mainStatsTableHTML += `<td>${score} (${mod >= 0 ? '+' : ''}${mod})</td>`;
        });
        mainStatsTableHTML += `</tr>`;
    });
    mainStatsTableHTML += `</tbody></table>`;
    dashboardContent.innerHTML += `<div class="table-wrapper">${mainStatsTableHTML}</div>`;
    const abilityExpansionContainer = document.createElement('div'); abilityExpansionContainer.id = 'expanded-ability-details-sections'; dashboardContent.appendChild(abilityExpansionContainer);
    abilitiesForTable.forEach(ablKey => {
        const expansionDiv = document.createElement('div'); expansionDiv.id = `expanded-${ablKey}`; expansionDiv.className = 'expanded-ability-content';
        expansionDiv.style.display = (currentlyExpandedAbility === ablKey) ? 'block' : 'none';
        if (currentlyExpandedAbility === ablKey && selectedPcs.length > 0) { populateExpandedAbilityDetails(ablKey, expansionDiv, selectedPcs); }
        abilityExpansionContainer.appendChild(expansionDiv);
    });

    let skillsTableHTML = `<h4>Skills Overview</h4><table id="skills-overview-table"><thead><tr><th>Character</th>`;
    for (const skillKey in SKILL_NAME_MAP) {
        const skillFullName = SKILL_NAME_MAP[skillKey].replace(/\s\(...\)/, '');
        const arrow = (currentlyExpandedSkill === skillKey && document.getElementById(`expanded-skill-${skillKey}`)?.style.display !== 'none') ? '▼' : '►';
        skillsTableHTML += `<th class="clickable-skill-header" data-skill-key="${skillKey}" onclick="toggleSkillExpansion('${skillKey}')">${skillFullName} <span class="arrow-indicator">${arrow}</span></th>`;
    }
    skillsTableHTML += `</tr></thead><tbody>`;
    let pcsForSkillTable = [...selectedPcs];
    if (skillSortKey) {
        pcsForSkillTable.sort((a, b) => {
            const skillVttDataA = a.vtt_data?.skills?.[skillSortKey]; const defaultAbilityA = SKILL_NAME_MAP[skillSortKey]?.match(/\(([^)]+)\)/)?.[1]?.toLowerCase() || 'int';
            const baseAbilityKeyA = skillVttDataA?.ability || defaultAbilityA; const baseAbilityScoreA = a.vtt_data?.abilities?.[baseAbilityKeyA]?.value || 10;
            const bonusA = calculateSkillBonus(baseAbilityScoreA, skillVttDataA?.value || 0, a.calculatedProfBonus);
            const skillVttDataB = b.vtt_data?.skills?.[skillSortKey]; const defaultAbilityB = SKILL_NAME_MAP[skillSortKey]?.match(/\(([^)]+)\)/)?.[1]?.toLowerCase() || 'int';
            const baseAbilityKeyB = skillVttDataB?.ability || defaultAbilityB; const baseAbilityScoreB = b.vtt_data?.abilities?.[baseAbilityKeyB]?.value || 10;
            const bonusB = calculateSkillBonus(baseAbilityScoreB, skillVttDataB?.value || 0, b.calculatedProfBonus);
            return bonusB - bonusA;
        });
    } else { pcsForSkillTable.sort((a,b) => a.name.localeCompare(b.name)); }
    pcsForSkillTable.forEach(pc => {
        skillsTableHTML += `<tr><td>${pc.name}</td>`;
        for (const skillKey in SKILL_NAME_MAP) {
            const skillData = pc.vtt_data?.skills?.[skillKey]; let skillBonusFormatted = "N/A";
            const defaultAbilityAbbrevMatch = SKILL_NAME_MAP[skillKey].match(/\(([^)]+)\)/); const defaultAbilityAbbrev = defaultAbilityAbbrevMatch ? defaultAbilityAbbrevMatch[1].toLowerCase() : 'int';
            const abilityKeyForSkill = skillData?.ability || defaultAbilityAbbrev;
            if (pc.vtt_data?.abilities?.[abilityKeyForSkill] && pc.calculatedProfBonus !== undefined) {
                const abilityScore = pc.vtt_data.abilities[abilityKeyForSkill]?.value || 10;
                const bonus = calculateSkillBonus(abilityScore, skillData?.value || 0, pc.calculatedProfBonus);
                skillBonusFormatted = `${bonus >= 0 ? '+' : ''}${bonus}`;
            }
            skillsTableHTML += `<td>${skillBonusFormatted}</td>`;
        }
        skillsTableHTML += `</tr>`;
    });
    skillsTableHTML += `</tbody></table>`;
    dashboardContent.innerHTML += `<div class="table-wrapper">${skillsTableHTML}</div>`;
    const skillExpansionContainer = document.createElement('div'); skillExpansionContainer.id = 'expanded-skill-details-sections'; dashboardContent.appendChild(skillExpansionContainer);
    for (const skillKey in SKILL_NAME_MAP) {
        const expansionDiv = document.createElement('div'); expansionDiv.id = `expanded-skill-${skillKey}`; expansionDiv.className = 'expanded-skill-content';
        expansionDiv.style.display = (currentlyExpandedSkill === skillKey) ? 'block' : 'none';
        if (currentlyExpandedSkill === skillKey && selectedPcs.length > 0) { populateExpandedSkillDetails(skillKey, expansionDiv, selectedPcs); }
        skillExpansionContainer.appendChild(expansionDiv);
    }
    // console.log("DEBUG: dashboardContent final innerHTML for overview (updatePcDashboard end):\n", dashboardContent.innerHTML);
}

function toggleAbilityExpansion(ablKey) {
    const selectedPcs = allCharacters.filter(char => activePcIds.has(String(char._id)) && char.character_type === 'PC' && char.vtt_data);
    const expansionDiv = document.getElementById(`expanded-${ablKey}`);
    const headerTH = document.querySelector(`#main-stats-table th[data-ability="${ablKey}"]`);
    const arrowSpan = headerTH ? headerTH.querySelector('span.arrow-indicator') : null;
    if (!expansionDiv || !headerTH || !arrowSpan) return;
    const isCurrentlyHidden = expansionDiv.style.display === 'none';
    if (isCurrentlyHidden) {
        if (selectedPcs.length === 0) { arrowSpan.textContent = ' ►'; return; }
        if (currentlyExpandedAbility && currentlyExpandedAbility !== ablKey) {
            const otherDiv = document.getElementById(`expanded-${currentlyExpandedAbility}`);
            const otherHeaderTH = document.querySelector(`#main-stats-table th[data-ability="${currentlyExpandedAbility}"]`);
            if (otherDiv) otherDiv.style.display = 'none';
            if (otherHeaderTH && otherHeaderTH.querySelector('span.arrow-indicator')) otherHeaderTH.querySelector('span.arrow-indicator').textContent = ' ►';
        }
        populateExpandedAbilityDetails(ablKey.toUpperCase(), expansionDiv, selectedPcs);
        expansionDiv.style.display = 'block'; arrowSpan.textContent = ' ▼'; currentlyExpandedAbility = ablKey.toUpperCase();
    } else { expansionDiv.style.display = 'none'; arrowSpan.textContent = ' ►'; currentlyExpandedAbility = null; }
}

function toggleSkillExpansion(skillKey) {
    if (currentlyExpandedSkill === skillKey) { skillSortKey = null; currentlyExpandedSkill = null; }
    else { skillSortKey = skillKey; currentlyExpandedSkill = skillKey; }
    updatePcDashboard(); 
    const allSkillHeaders = document.querySelectorAll(`#skills-overview-table th.clickable-skill-header`);
    allSkillHeaders.forEach(header => {
        const sKey = header.dataset.skillKey; const arrow = header.querySelector('span.arrow-indicator');
        if (arrow) arrow.textContent = (sKey === currentlyExpandedSkill) ? ' ▼' : ' ►';
    });
    const expansionDiv = document.getElementById(`expanded-skill-${skillKey}`);
    if (expansionDiv && currentlyExpandedSkill === skillKey) expansionDiv.style.display = 'block';
}

function populateExpandedSkillDetails(skillKey, expansionDiv, selectedPcs) { /* ... (same as before, ensure SKILL_NAME_MAP is used correctly) ... */ 
    if (!selectedPcs || selectedPcs.length === 0) { expansionDiv.innerHTML = '<p><em>Select PCs to view skill details.</em></p>'; return; }
    const skillFullName = SKILL_NAME_MAP[skillKey]?.replace(/\s\(...\)/, '') || skillKey.toUpperCase();
    let contentHTML = `<h5>${skillFullName} Skill Modifiers & Rules</h5><div class="skill-bar-chart-container">`;
    const skillDataForGraph = selectedPcs.map(pc => {
        const skillVttData = pc.vtt_data?.skills?.[skillKey];
        const defaultAbility = SKILL_NAME_MAP[skillKey]?.match(/\(([^)]+)\)/)?.[1]?.toLowerCase() || 'int';
        const baseAbilityKey = skillVttData?.ability || defaultAbility;
        const baseAbilityScore = pc.vtt_data?.abilities?.[baseAbilityKey]?.value || 10;
        const bonus = calculateSkillBonus(baseAbilityScore, skillVttData?.value || 0, pc.calculatedProfBonus);
        return { name: pc.name, modifier: bonus };
    }).sort((a,b) => b.modifier - a.modifier);
    const allModifiers = skillDataForGraph.map(d => d.modifier);
    const dataMinMod = allModifiers.length > 0 ? Math.min(0, ...allModifiers) : 0;
    const dataMaxMod = allModifiers.length > 0 ? Math.max(0, ...allModifiers) : 0;
    const visualMin = Math.min(-2, dataMinMod -1); const visualMax = Math.max(5, dataMaxMod + 1);
    const visualRange = visualMax - visualMin; const zeroPositionPercent = visualRange !== 0 ? ((0 - visualMin) / visualRange) * 100 : 50;
    skillDataForGraph.forEach(data => {
        let barWidthPercent = 0; let barLeftPercent = zeroPositionPercent; let barClass = 'stat-bar';
        if (visualRange !== 0) { if (data.modifier >= 0) { barClass += ' positive'; barWidthPercent = (data.modifier / visualRange) * 100; } else { barClass += ' negative'; barWidthPercent = (Math.abs(data.modifier) / visualRange) * 100; barLeftPercent = zeroPositionPercent - barWidthPercent; } }
        else { barWidthPercent = data.modifier === 0 ? 0 : 50; if(data.modifier < 0) barLeftPercent = 0; }
        barWidthPercent = Math.max(0.5, barWidthPercent);
        contentHTML += `<div class="pc-bar-row"><div class="stat-comparison-pc-name" title="${data.name}">${data.name.substring(0,15)+(data.name.length > 15 ? '...' : '')}</div><div class="stat-bar-wrapper" style="--zero-offset: ${zeroPositionPercent}%;"><div class="${barClass}" style="left: ${barLeftPercent}%; width: ${barWidthPercent}%;">${data.modifier >= 0 ? '+' : ''}${data.modifier}</div></div></div>`;
    });
    contentHTML += `</div><table class="rules-explanation-table"><tr><td>`;
    switch (skillKey) { /* Your existing detailed switch cases for skill descriptions */ 
        case 'acr': contentHTML += "Your Dexterity (Acrobatics) check covers your attempt to stay on your feet in a tricky situation, such as when you’re trying to run across a sheet of ice, balance on a tightrope, or stay upright on a rocking ship’s deck. The GM might also call for a Dexterity (Acrobatics) check to see if you can perform acrobatic stunts, including dives, rolls, somersaults, and flips."; break;
        case 'ath': contentHTML += "Your Strength (Athletics) check covers difficult situations you encounter while climbing, jumping, or swimming. Examples include: attempting to climb a sheer or slippery cliff, trying to jump an unusually long distance, or struggling to swim in treacherous currents."; break;
        case 'slt': contentHTML += "Whenever you attempt an act of legerdemain or manual trickery, such as planting something on someone else or concealing an object on your person, make a Dexterity (Sleight of Hand) check. The GM might also call for a Dexterity (Sleight of Hand) check to determine whether you can lift a coin purse off another person or slip something out of another person’s pocket."; break;
        case 'ste': contentHTML += "Make a Dexterity (Stealth) check when you attempt to conceal yourself from enemies, slink past guards, slip away without being noticed, or sneak up on someone without being seen or heard."; break;
        case 'arc': contentHTML += "Your Intelligence (Arcana) check measures your ability to recall lore about spells, magic items, eldritch symbols, magical traditions, the planes of existence, and the inhabitants of those planes."; break;
        case 'his': contentHTML += "Your Intelligence (History) check measures your ability to recall lore about historical events, legendary people, ancient kingdoms, past disputes, recent wars, and lost civilizations."; break;
        case 'inv': contentHTML += "When you look around for clues and make deductions based on those clues, you make an Intelligence (Investigation) check. You might deduce the location of a hidden object, discern from the appearance of a wound what kind of weapon dealt it, or determine the weakest point in a tunnel that could cause it to collapse."; break;
        case 'nat': contentHTML += "Your Intelligence (Nature) check measures your ability to recall lore about terrain, plants and animals, the weather, and natural cycles."; break;
        case 'rel': contentHTML += "Your Intelligence (Religion) check measures your ability to recall lore about deities, rites and prayers, religious hierarchies, holy symbols, and the practices of secret cults."; break;
        case 'ani': contentHTML += "When there is any question whether you can calm down a domesticated animal, keep a mount from getting spooked, or intuit an animal’s intentions, the GM might call for a Wisdom (Animal Handling) check. You also make a Wisdom (Animal Handling) check to control your mount when you attempt a risky maneuver."; break;
        case 'ins': contentHTML += "Your Wisdom (Insight) check decides whether you can determine the true intentions of a creature, such as when searching out a lie or predicting someone’s next move. Doing so involves gleaning clues from body language, speech habits, and changes in mannerisms."; break;
        case 'med': contentHTML += "A Wisdom (Medicine) check lets you try to stabilize a dying companion or diagnose an illness."; break;
        case 'prc': contentHTML += "Your Wisdom (Perception) check lets you spot, hear, or otherwise detect the presence of something. It measures your general awareness of your surroundings and the keenness of your senses."; break;
        case 'sur': contentHTML += "The GM might ask you to make a Wisdom (Survival) check to follow tracks, hunt wild game, guide your group through frozen wastelands, identify signs that owlbears live nearby, predict the weather, or avoid quicksand and other natural hazards."; break;
        case 'dec': contentHTML += "Your Charisma (Deception) check determines whether you can convincingly hide the truth, either verbally or through your actions. This deception can encompass everything from misleading others through ambiguity to telling outright lies."; break;
        case 'itm': contentHTML += "When you attempt to influence someone through overt threats, hostile actions, and physical violence, the GM might ask you to make a Charisma (Intimidation) check."; break;
        case 'prf': contentHTML += "Your Charisma (Performance) check determines how well you can delight an audience with music, dance, acting, storytelling, or some other form of entertainment."; break;
        case 'per': contentHTML += "When you attempt to influence someone or a group of people with tact, social graces, or good nature, the GM might ask you to make a Charisma (Persuasion) check."; break;
        default: contentHTML += `General information about the ${skillFullName} skill.`; break;
    }
    contentHTML += "</td></tr></table>"; expansionDiv.innerHTML = contentHTML;
}

function populateExpandedAbilityDetails(ablKey, expansionDiv, selectedPcsInput) { /* ... (same as before) ... */ }

function renderDetailedPcSheet(pcId) {
    const pc = allCharacters.find(c => String(c._id) === String(pcId));
    if (!pc || pc.character_type !== 'PC' || !pc.vtt_data) {
        console.error("PC not found or invalid VTT data for detailed sheet:", pcId, pc);
        const dashboardContentError = getElem('pc-dashboard-content');
        if (dashboardContentError) dashboardContentError.innerHTML = `<p>Error loading PC. <button onclick="updatePcDashboard()">Back</button></p>`;
        return;
    }
    console.log("Rendering detailed sheet for:", pc.name);
    if (DEBUG_DELEGATED_CARD_CLICK) console.log("VTT Data:", pc.vtt_data, "Items:", pc.items);

    const dashboardContent = getElem('pc-dashboard-content');
    if (!dashboardContent) { console.error("'pc-dashboard-content' not found."); return; }
    dashboardContent.innerHTML = '';

    let html = `<div class="detailed-pc-sheet" data-pc-id="${pcId}">`;
    html += `<button onclick="updatePcDashboard()" class="back-to-dashboard-btn">Back to Dashboard</button>`;
    
    const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || pc.vtt_data?.details?.level || 1;
    pc.calculatedProfBonus = getProficiencyBonus(pcLevel);
    let raceName = pc.vtt_data?.details?.race || 'N/A';
    if (pc.items && pc.vtt_data?.details?.race) {
        const raceItem = pc.items.find(item => item._id === pc.vtt_data.details.race && item.type === 'race');
        if (raceItem) raceName = raceItem.name;
    }
    let className = 'N/A';
    const classItem = pc.items?.find(i => i.type === 'class');
    if (classItem) className = classItem.name;
    else if (pc.vtt_data?.details?.originalClass) className = pc.vtt_data.details.originalClass;

    html += `<div class="pc-sheet-top-section"><h2>${pc.name}</h2>`;
    html += `<p class="pc-basic-info-subtext">${raceName} ${className}, Level ${pcLevel} &bull; Alignment: ${pc.vtt_data?.details?.alignment || 'N/A'}</p></div>`;

    html += `<div class="pc-sheet-columns">`; // Main flex container for columns
    // Column 1: Combat, Weapons, Abilities
    html += `<div class="pc-sheet-column pc-sheet-column-left">`;
    html += `<div class="pc-section"><h4>Combat Stats</h4><div class="pc-info-grid">`;
    const hpCurrent = pc.vtt_data?.attributes?.hp?.value ?? 'N/A';
    const hpMax = pc.vtt_data?.attributes?.hp?.max ?? pc.system?.attributes?.hp?.max ?? 'N/A';
    html += `<p><strong>HP:</strong> ${hpCurrent} / ${hpMax}</p>`;
    let acDisplay = pc.vtt_flags?.ddbimporter?.overrideAC?.flat ?? pc.vtt_data?.attributes?.ac?.value ?? pc.vtt_data?.attributes?.ac?.flat;
    if (acDisplay === undefined || acDisplay === null) { /* AC Calculation Fallback */ acDisplay = 10 + getAbilityModifier(pc.vtt_data?.abilities?.dex?.value || 10); }
    html += `<p><strong>AC:</strong> ${acDisplay}</p>`;
    html += `<p><strong>Speed:</strong> ${pc.vtt_data?.attributes?.movement?.walk || pc.system?.attributes?.movement?.walk || 0} ft</p>`;
    let initiativeBonus = 'N/A'; const initAbility = pc.vtt_data?.attributes?.init?.ability; const dexValue = pc.vtt_data?.abilities?.dex?.value;
    if (initAbility && pc.vtt_data?.abilities?.[initAbility]) { initiativeBonus = getAbilityModifier(pc.vtt_data.abilities[initAbility].value || 10); }
    else if (pc.vtt_data?.attributes?.init?.bonus != null && pc.vtt_data.attributes.init.bonus !== "") { initiativeBonus = pc.vtt_data.attributes.init.bonus; }
    else if (dexValue !== undefined) { initiativeBonus = getAbilityModifier(dexValue); }
    html += `<p><strong>Initiative:</strong> ${initiativeBonus >= 0 ? '+' : ''}${initiativeBonus}</p>`;
    html += `<p><strong>Proficiency Bonus:</strong> +${pc.calculatedProfBonus}</p></div></div>`;
    html += `<div class="pc-section"><h4>Weapons & Attacks</h4>`;
    const weapons = pc.items?.filter(item => item.type === 'weapon') || [];
    if (weapons.length > 0) { html += `<ul class="pc-sheet-list">`; weapons.forEach(w => { /* Weapon rendering logic */ 
        let attackBonusStr = "N/A"; let damageStr = "N/A"; const weaponSystem = w.system || {}; let ablMod = 0;
        let isProficient = weaponSystem.proficient === 1 || weaponSystem.proficient === undefined || weaponSystem.proficient === null;
        if (weaponSystem.ability) { ablMod = getAbilityModifier(pc.vtt_data?.abilities?.[weaponSystem.ability]?.value || 10); }
        else if (weaponSystem.properties?.includes('fin')) { const strMod = getAbilityModifier(pc.vtt_data?.abilities?.str?.value || 10); const dexMod = getAbilityModifier(pc.vtt_data?.abilities?.dex?.value || 10); ablMod = Math.max(strMod, dexMod); }
        else if (weaponSystem.type?.value?.includes('R') || weaponSystem.properties?.includes('thr')) { if (weaponSystem.properties?.includes('thr') && !weaponSystem.properties?.includes('fin')) { ablMod = getAbilityModifier(pc.vtt_data?.abilities?.str?.value || 10); } else { ablMod = getAbilityModifier(pc.vtt_data?.abilities?.dex?.value || 10); }
        } else { ablMod = getAbilityModifier(pc.vtt_data?.abilities?.str?.value || 10); }
        attackBonusStr = isProficient ? (ablMod + pc.calculatedProfBonus) : ablMod; attackBonusStr = `${attackBonusStr >= 0 ? '+' : ''}${attackBonusStr}`;
        if (weaponSystem.damage?.parts?.length > 0) { const part = weaponSystem.damage.parts[0]; let dmgBonus = ablMod; if (part.bonus && String(part.bonus).trim() !== "") dmgBonus = parseInt(part.bonus) || ablMod; damageStr = `${part.number || '1'}d${part.denomination || '?'} ${dmgBonus >= 0 ? '+' : ''}${dmgBonus} ${part.types?.join('/') || part.type || 'damage'}`; }
        else if (weaponSystem.damage?.base) { damageStr = `${weaponSystem.damage.base.number || '1'}d${weaponSystem.damage.base.denomination || '?'} ${weaponSystem.damage.base.bonus || ''} ${weaponSystem.damage.base.types?.join('/') || ''}`; }
        html += `<li><strong>${w.name}:</strong> Atk ${attackBonusStr}, Dmg: ${damageStr} <i>(${(weaponSystem.properties || []).join(', ')})</i></li>`;
    }); html += `</ul>`; } else { html += `<p>No weapons listed.</p>`; } html += `</div>`;
    html += `<div class="pc-section"><h4>Ability Scores & Saves</h4><table class="detailed-pc-table"><thead><tr><th>Ability</th><th>Score</th><th>Mod</th><th>Save</th></tr></thead><tbody>`;
    const localAbilitiesConst = ABILITY_KEYS_ORDER;
    localAbilitiesConst.forEach(abl => {
        const score = pc.vtt_data?.abilities?.[abl]?.value || 10; const mod = getAbilityModifier(score);
        const proficient = pc.vtt_data?.abilities?.[abl]?.proficient === 1;
        const saveBonus = savingThrowBonus(score, proficient, pc.calculatedProfBonus);
        html += `<tr><td>${abl.toUpperCase()}</td><td>${score}</td><td>${mod >= 0 ? '+' : ''}${mod}</td><td>${saveBonus >= 0 ? '+' : ''}${saveBonus}${proficient ? ' <abbr title="Proficient">(P)</abbr>' : ''}</td></tr>`;
    }); html += `</tbody></table></div>`; html += `</div>`; // End Column 1

    // Column 2
    html += `<div class="pc-sheet-column pc-sheet-column-right">`;
    html += `<div class="pc-section"><h4>Skills</h4><table class="detailed-pc-table"><thead><tr><th>Skill</th><th>Bonus</th></tr></thead><tbody>`;
    for (const skillKey in SKILL_NAME_MAP) {
        const skillData = pc.vtt_data?.skills?.[skillKey]; const skillDisplayName = SKILL_NAME_MAP[skillKey];
        const defaultAbilityAbbrevMatch = skillDisplayName.match(/\(([^)]+)\)/);
        const defaultAbilityAbbrev = defaultAbilityAbbrevMatch ? defaultAbilityAbbrevMatch[1].toLowerCase() : 'int';
        const abilityKey = skillData?.ability || defaultAbilityAbbrev;
        const score = pc.vtt_data?.abilities?.[abilityKey]?.value || 10;
        const proficiencyValue = skillData?.value || 0; const bonus = calculateSkillBonus(score, proficiencyValue, pc.calculatedProfBonus);
        let profMarker = ""; if (proficiencyValue === 1) profMarker = " <abbr title='Proficient'>(P)</abbr>"; else if (proficiencyValue === 2) profMarker = " <abbr title='Expertise'>(E)</abbr>"; else if (proficiencyValue === 0.5) profMarker = " <abbr title='Half-Proficiency'>(H)</abbr>";
        html += `<tr><td>${skillDisplayName.replace(/\s\(...\)/, '')} <small>(${abilityKey.toUpperCase()})</small></td><td>${bonus >= 0 ? '+' : ''}${bonus}${profMarker}</td></tr>`;
    } html += `</tbody></table></div>`; html += `</div>`; // End Column 2
    html += `</div>`; // End pc-sheet-columns

    // Collapsible sections below
    const collapsibleSectionsData = [ /* ... same as before ... */ ];
    collapsibleSectionsData.forEach(sectionData => {
        html += `<div class="pc-section collapsible-section collapsed"> 
                    <h4 style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                        ${sectionData.title} <span class="arrow-indicator">►</span>
                    </h4>
                    <div class="collapsible-content" style="display: none;">${sectionData.contentFn()}</div>
                 </div>`;
    });
    html += `</div>`;
    dashboardContent.innerHTML = html;
    dashboardContent.querySelectorAll('.detailed-pc-sheet .collapsible-section h4').forEach(header => {
        header.addEventListener('click', () => {
            const section = header.parentElement; const content = section.querySelector('.collapsible-content');
            section.classList.toggle('collapsed'); const arrow = header.querySelector('.arrow-indicator');
            if (section.classList.contains('collapsed')) { if (content) content.style.display = 'none'; if (arrow) arrow.textContent = ' ►'; }
            else { if (content) content.style.display = 'block'; if (arrow) arrow.textContent = ' ▼'; }
        });
    });
}

// --- Memory Management, Dialogue, Character Creation/GM Notes ---
// (These functions are assumed to be mostly complete and correct from your original script,
// if they were longer than what I might have included in previous snippets,
// please ensure you have your full original versions here.)
function renderMemories(memories = []) { /* ... */ }
async function addMemoryToCharacter() { /* ... */ }
async function deleteMemory(memoryId) { /* ... */ }
async function generateDialogue() { /* ... */ }
function renderAiSuggestions(memorySuggestions = [], topicSuggestions = [], forNpcId) { /* ... */ }
async function saveGMNotes() { /* ... */ }
async function createCharacter() { /* ... */ }

// --- Event Listeners & Initial Setup ---
console.log("script.js: File execution started.");
document.addEventListener('DOMContentLoaded', () => {
    console.log("script.js: DOMContentLoaded event fired.");
    try { fetchCharacters(); fetchHistoryFiles(); }
    catch (e) { console.error("Error during initial fetch calls:", e); }

    const leftColumn = getElem('left-column');
    const resizer = getElem('resizer');
    if (leftColumn && resizer) { /* ... Resizer logic (same as before) ... */ 
        let isResizing = false;
        resizer.addEventListener('mousedown', () => { isResizing = true; });
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const newLeftWidth = e.clientX;
            if (newLeftWidth > 200 && newLeftWidth < (window.innerWidth - 200)) { 
                leftColumn.style.width = `${newLeftWidth}px`;
            }
        });
        document.addEventListener('mouseup', () => { isResizing = false; });
    }

    // Collapsible sections for left panel
    document.querySelectorAll('#left-column .collapsible-section').forEach(section => {
        const header = section.querySelector('h3');
        if (header) {
            // Add arrow indicator if not present (for dynamic sections perhaps)
            if (!header.querySelector('.arrow-indicator')) {
                const arrowSpan = document.createElement('span');
                arrowSpan.className = 'arrow-indicator';
                header.appendChild(arrowSpan); // Append it to keep title first
            }

            header.addEventListener('click', () => {
                section.classList.toggle('collapsed');
                const arrow = header.querySelector('.arrow-indicator');
                if (arrow) arrow.textContent = section.classList.contains('collapsed') ? ' ►' : ' ▼';
            });

            // Initial collapse state
            if (section.id === 'pc-list-section') { // Player Character List
                section.classList.remove('collapsed');
                const arrow = header.querySelector('.arrow-indicator'); if (arrow) arrow.textContent = ' ▼';
            } else { // Collapse all others by default in left panel
                 section.classList.add('collapsed');
                 const arrow = header.querySelector('.arrow-indicator'); if (arrow) arrow.textContent = ' ►';
            }
        }
    });
     // Ensure profile itself starts open as it's a primary interaction point
    const profileMainSection = getElem('character-profile-main-section');
    if (profileMainSection) {
        profileMainSection.classList.remove('collapsed');
        const profileHeaderArrow = profileMainSection.querySelector('h3 .arrow-indicator');
        if (profileHeaderArrow) profileHeaderArrow.textContent = ' ▼';
    }


    const pcDashboardContentForDelegation = getElem('pc-dashboard-content');
    if (pcDashboardContentForDelegation) {
        console.log("DEBUG: Attaching DELEGATED click listener to pc-dashboard-content.");
        pcDashboardContentForDelegation.addEventListener('click', function(event) {
            const clickedCard = event.target.closest('.clickable-pc-card');
            if (DEBUG_DELEGATED_CARD_CLICK) { /* ... toggleable logs ... */ }
            if (clickedCard) {
                const pcIdToRender = clickedCard.dataset.pcId;
                if (pcIdToRender) { renderDetailedPcSheet(pcIdToRender); }
                else { console.error("Delegated Listener: Clicked card, but data-pc-id missing."); }
            }
        });
    } else { console.error("DEBUG: Crucial element #pc-dashboard-content not found."); }

    updateView();
    console.log("script.js: DOMContentLoaded finished.");
});
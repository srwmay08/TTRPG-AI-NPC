// --- Global State Variables ---
let activeSceneNpcIds = new Set();
let activePcIds = new Set();
let allCharacters = []; // This will store character objects
let dialogueHistory = [];
let dialogueHistories = {};
let currentProfileCharId = null;
let currentlyExpandedAbility = null;
let currentlyExpandedSkill = null;
let skillSortKey = null;

// --- Constants ---
const API_BASE_URL = '';

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

// --- D&D 5e Calculation Functions ---
function getAbilityModifier(score) { return Math.floor((score - 10) / 2); }
function carryingCapacity(score) { return score * 15; }
function pushDragLift(score) { return score * 30; }
function longJump(score, running = true) { return running ? score : Math.floor(score / 2); }
function highJump(score, running = true) { const mod = getAbilityModifier(score); return running ? (3 + mod) : Math.floor((3 + mod) / 2); }
function initiative(dexScore) { return getAbilityModifier(dexScore); }
function holdBreath(conScore) { return Math.max(1 + getAbilityModifier(conScore), 0.5) + " minutes"; }
function spellSaveDC(castingStatScore, proficiencyBonus) { return 8 + getAbilityModifier(castingStatScore) + proficiencyBonus; }
function spellAttackBonus(castingStatScore, proficiencyBonus) { return getAbilityModifier(castingStatScore) + proficiencyBonus; }
function savingThrowBonus(abilityScore, proficientInSave = false, proficiencyBonus = 0) {
    const mod = getAbilityModifier(abilityScore);
    return mod + (proficientInSave ? proficiencyBonus : 0);
}
function calculateSkillBonus(baseStatScore, skillProficiencyValue, proficiencyBonus) {
    const modifier = getAbilityModifier(baseStatScore);
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
    const skillBonus = calculateSkillBonus(baseStatScore, skillProficiencyValue, proficiencyBonus);
    return 10 + skillBonus;
}
function getProficiencyBonus(level) {
    if (level < 1) return 2;
    if (level <= 4) return 2;
    if (level <= 8) return 3;
    if (level <= 12) return 4;
    if (level <= 16) return 5;
    return 6;
}

// --- Character Data & Rendering ---
async function fetchCharacters() {
    console.log("script.js: fetchCharacters() function entered.");
    try {
        const response = await fetch(`${API_BASE_URL}/api/npcs`);
        console.log("script.js: fetchCharacters() - /api/npcs fetch initiated, status: " + response.status);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for /api/npcs`);
        }
        const charactersFromServer = await response.json();
        allCharacters = charactersFromServer.map(char => {
            if (char._id && typeof char._id === 'object' && char._id.$oid) {
                char._id = char._id.$oid;
            }
            // Ensure potentially missing fields from backend have defaults for frontend logic
            char.combined_history_content = char.combined_history_content || "";
            char.vtt_data = char.vtt_data || {}; // Ensure vtt_data is an object
            char.vtt_flags = char.vtt_flags || {}; // Ensure vtt_flags is an object
            char.items = char.items || []; // Ensure items is an array
            char.system = char.system || {}; // Ensure system is an object
            return char;
        });
        console.log("script.js: fetchCharacters() - Data processed, allCharacters count:", allCharacters.length);
        console.log("Fetched allCharacters sample (first 3):", allCharacters.slice(0,3).map(c => ({id: c._id, name: c.name, historyDefined: c.combined_history_content !== undefined, vttDataKeys: Object.keys(c.vtt_data || {}), vttFlagsKeys: Object.keys(c.vtt_flags || {}) })));

        renderNpcListForScene();
        renderPcList();
        updateView();
    } catch (error) {
        console.error('Error in fetchCharacters:', error);
        const npcListElem = getElem('character-list');
        if (npcListElem) npcListElem.innerHTML = '<ul><li><em>Error loading NPCs. Check console.</em></li></ul>';
        const pcListElem = getElem('active-pc-list');
        if (pcListElem) pcListElem.innerHTML = '<p><em>Error loading PCs. Check console.</em></p>';
    }
}

function renderNpcListForScene() {
    const listContainer = getElem('character-list');
    if (!listContainer) { console.error("renderNpcListForScene: 'character-list' container not found."); return; }
    let ul = listContainer.querySelector('ul');
    if (!ul) {
        ul = document.createElement('ul');
        listContainer.appendChild(ul);
    }
    ul.innerHTML = '';
    const npcs = allCharacters.filter(char => char.character_type === 'NPC');

    if (npcs.length === 0) {
        ul.innerHTML = '<li><p><em>No NPCs defined yet. Create NPCs to add them to scenes.</em></p></li>';
        return;
    }

    npcs.forEach(char => {
        const charIdStr = String(char._id);
        const li = document.createElement('li');
        li.dataset.charId = charIdStr;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `npc-scene-checkbox-${charIdStr}`;
        checkbox.checked = activeSceneNpcIds.has(charIdStr);
        checkbox.onchange = () => toggleNpcInScene(charIdStr, char.name);

        const nameSpan = document.createElement('span');
        nameSpan.textContent = char.name;
        nameSpan.className = 'npc-name-clickable';
        nameSpan.onclick = async () => {
            await selectCharacterForDetails(charIdStr);
        };

        li.appendChild(checkbox);
        li.appendChild(nameSpan);

        if (activeSceneNpcIds.has(charIdStr)) {
            li.classList.add('active-in-scene');
        }
        ul.appendChild(li);
    });
}

function toggleNpcInScene(npcIdStr, npcName) {
    const multiNpcContainer = getElem('multi-npc-dialogue-container');
    if (!multiNpcContainer) { console.error("toggleNpcInScene: 'multi-npc-dialogue-container' not found."); return; }

    if (activeSceneNpcIds.has(npcIdStr)) {
        activeSceneNpcIds.delete(npcIdStr);
        removeNpcDialogueArea(npcIdStr);
        delete dialogueHistories[npcIdStr];
    } else {
        activeSceneNpcIds.add(npcIdStr);
        createNpcDialogueArea(npcIdStr, npcName);
        dialogueHistories[npcIdStr] = [];
    }
    adjustNpcDialogueAreaWidths(); // Adjust widths after adding/removing

    if (activeSceneNpcIds.size >= 1 && multiNpcContainer.querySelector('p.scene-event')) {
        multiNpcContainer.innerHTML = '';
        activeSceneNpcIds.forEach(id => {
             const npc = allCharacters.find(c=> String(c._id) === String(id));
             if(npc && !getElem(`npc-area-${id}`)) { // Re-create if it was removed by innerHTML clear
                createNpcDialogueArea(id, npc.name);
             }
        });
    } else if (activeSceneNpcIds.size === 0) {
         multiNpcContainer.innerHTML = '<p class="scene-event">Select NPCs to add them to the scene.</p>';
    }

    renderNpcListForScene();
    disableBtn('generate-dialogue-btn', activeSceneNpcIds.size === 0);
    updateView();
}

function createNpcDialogueArea(npcIdStr, npcName) {
    const container = getElem('multi-npc-dialogue-container');
    if (!container) { console.error("createNpcDialogueArea: 'multi-npc-dialogue-container' not found."); return; }
    const placeholder = container.querySelector('p.scene-event');
    if (placeholder && activeSceneNpcIds.size > 0) {
        placeholder.remove();
    }

    if (getElem(`npc-area-${npcIdStr}`)) return;

    const areaDiv = document.createElement('div');
    areaDiv.className = 'npc-dialogue-area';
    areaDiv.id = `npc-area-${npcIdStr}`;

    const nameHeader = document.createElement('h3');
    nameHeader.textContent = npcName;
    areaDiv.appendChild(nameHeader);

    const transcriptDiv = document.createElement('div');
    transcriptDiv.className = 'npc-transcript';
    transcriptDiv.id = `transcript-${npcIdStr}`;
    transcriptDiv.innerHTML = `<p class="scene-event">Dialogue with ${npcName} starts.</p>`;
    areaDiv.appendChild(transcriptDiv);

    container.appendChild(areaDiv);
    adjustNpcDialogueAreaWidths(); // Adjust widths after adding a new area
}

function removeNpcDialogueArea(npcIdStr) {
    const areaDiv = getElem(`npc-area-${npcIdStr}`);
    if (areaDiv) {
        areaDiv.remove();
    }
    adjustNpcDialogueAreaWidths(); // Adjust widths after removing an area

    const container = getElem('multi-npc-dialogue-container');
    if (!container) { console.error("removeNpcDialogueArea: 'multi-npc-dialogue-container' not found."); return; }
    if (activeSceneNpcIds.size === 0 && !container.querySelector('p.scene-event')) {
         container.innerHTML = '<p class="scene-event">Select NPCs to add them to the scene.</p>';
    }
}

function adjustNpcDialogueAreaWidths() {
    const container = getElem('multi-npc-dialogue-container');
    if (!container) return;
    const dialogueAreas = container.querySelectorAll('.npc-dialogue-area');
    const numAreas = dialogueAreas.length;

    if (numAreas === 0) return;

    const widthPercent = 100 / numAreas;
    dialogueAreas.forEach(area => {
        area.style.width = `${widthPercent}%`;
        // Add some margin if there are multiple areas for better spacing
        area.style.marginRight = numAreas > 1 ? '5px' : '0';
    });
    // Remove margin from the last element
    if (numAreas > 0 && dialogueAreas[numAreas - 1]) {
        dialogueAreas[numAreas - 1].style.marginRight = '0';
    }
}


function renderPcList() {
    const pcListDiv = getElem('active-pc-list');
    if (!pcListDiv) { console.error("renderPcList: 'active-pc-list' div not found."); return; }
    pcListDiv.innerHTML = '';
    const pcs = allCharacters.filter(char => char.character_type === 'PC');
    if (pcs.length === 0) {
        pcListDiv.innerHTML = '<p><em>No Player Characters defined yet. Create characters with type "PC".</em></p>';
        return;
    }
    const ul = document.createElement('ul');
    pcs.forEach(pc => {
        const pcIdStr = String(pc._id);
        const li = document.createElement('li');
        li.style.cursor = "pointer";
        li.textContent = pc.name;
        li.dataset.charId = pcIdStr;

        li.onclick = async () => {
            console.log(`PC List Item clicked: ${pc.name} (ID: ${pcIdStr})`);
            activeSceneNpcIds.clear();
            const multiNpcContainer = getElem('multi-npc-dialogue-container');
            if (multiNpcContainer) multiNpcContainer.innerHTML = '<p class="scene-event">Select NPCs to add them to the scene.</p>';
            renderNpcListForScene();
            disableBtn('generate-dialogue-btn', true);

            togglePcSelection(pcIdStr, li);
            await selectCharacterForDetails(pcIdStr); // This updates the left-hand profile

            // Ensure PC Dashboard overview is shown when selecting from this list
            const dashboardContent = getElem('pc-dashboard-content');
            if (dashboardContent) {
                // If a detailed sheet is open, or if it's not the overview, force overview
                if (dashboardContent.querySelector('.detailed-pc-sheet') || activePcIds.size > 0) {
                     updatePcDashboard(); // This will render the overview cards
                }
            }
            updateView(); // This ensures the PC dashboard view is active
        };

        if (activePcIds.has(pcIdStr)) {
             li.classList.add('selected');
        } else {
            li.classList.remove('selected');
        }
        ul.appendChild(li);
    });
    pcListDiv.appendChild(ul);
}

async function fetchHistoryFiles() {
    console.log("script.js: fetchHistoryFiles() function entered.");
    const selectElement = getElem('history-file-select');
    if (!selectElement) {
        console.error("script.js: fetchHistoryFiles() - 'history-file-select' element not found!");
        return;
    }
    selectElement.innerHTML = '<option value="">-- Select a history file --</option>';
    try {
        const response = await fetch(`${API_BASE_URL}/api/history_files`);
        console.log("script.js: fetchHistoryFiles() - /api/history_files fetch initiated, status: " + response.status);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch history files. Status: ${response.status}. Message: ${errorText}`);
        }
        const files = await response.json();
        files.forEach(file => {
            const option = document.createElement('option');
            option.value = file;
            option.textContent = file;
            selectElement.appendChild(option);
        });
        console.log("script.js: fetchHistoryFiles() - History files processed.");
    } catch (error) {
        console.error("Error in fetchHistoryFiles function:", error);
        selectElement.innerHTML += `<option value="" disabled>Error loading files.</option>`;
    }
}

async function associateHistoryFile() {
    const charIdToUse = String(currentProfileCharId);
    if (!charIdToUse) {
        alert("Please select a character in the profile section first.");
        return;
    }
    const selectedFile = getElem('history-file-select').value;
    if (!selectedFile) {
        alert("Please select a history file from the dropdown to add.");
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/api/character/${charIdToUse}/associate_history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history_file: selectedFile })
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || result.message || `Failed to associate history file. Status: ${response.status}`);
        }
        alert(result.message || "History file associated successfully.");

        const charIndex = allCharacters.findIndex(c => String(c._id) === charIdToUse);
        if (charIndex > -1 && result.character) {
            let updatedChar = result.character;
            if (updatedChar._id && typeof updatedChar._id === 'object' && updatedChar._id.$oid) {
                updatedChar._id = updatedChar._id.$oid;
            }
            allCharacters[charIndex] = updatedChar;
        }
        await selectCharacterForDetails(charIdToUse);

    } catch (error) {
        console.error("Error associating history file:", error);
        alert(`Error: ${error.message}`);
    }
}

async function dissociateHistoryFile(filename) {
    const charIdToUse = String(currentProfileCharId);
    if (!charIdToUse) {
        alert("No character selected.");
        return;
    }
    if (!confirm(`Are you sure you want to remove "${filename}" from this character's history?`)) {
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/api/character/${charIdToUse}/dissociate_history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history_file: filename })
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || result.message || "Failed to dissociate history file.");
        }
        alert(result.message || "History file dissociated successfully.");

        const charIndex = allCharacters.findIndex(c => String(c._id) === charIdToUse);
        if (charIndex > -1 && result.character) {
            let updatedChar = result.character;
            if (updatedChar._id && typeof updatedChar._id === 'object' && updatedChar._id.$oid) {
                updatedChar._id = updatedChar._id.$oid;
            }
            allCharacters[charIndex] = updatedChar;
        }
        await selectCharacterForDetails(charIdToUse);

    } catch (error) {
        console.error("Error dissociating history file:", error);
        alert(`Error: ${error.message}`);
    }
}

function renderAssociatedHistoryFiles(character) {
    const listElement = getElem('associated-history-list');
    if (!listElement) { console.error("renderAssociatedHistoryFiles: 'associated-history-list' not found."); return; }
    listElement.innerHTML = '';

    if (character && character.associated_history_files && character.associated_history_files.length > 0) {
        character.associated_history_files.forEach(filename => {
            const li = document.createElement('li');
            li.textContent = filename;

            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'Remove';
            removeBtn.className = 'remove-history-btn';
            removeBtn.onclick = () => dissociateHistoryFile(filename);

            li.appendChild(removeBtn);
            listElement.appendChild(li);
        });
    } else {
        listElement.innerHTML = '<li><em>None associated.</em></li>';
    }

    const historyContentDisplay = getElem('history-content-display');
    if (!historyContentDisplay) { console.error("renderAssociatedHistoryFiles: 'history-content-display' not found."); return; }

    if (character && character.combined_history_content) {
        historyContentDisplay.textContent = character.combined_history_content;
    } else if (character && character.associated_history_files && character.associated_history_files.length > 0) {
        historyContentDisplay.textContent = "History files are associated, but content appears empty or wasn't loaded.";
    } else {
        historyContentDisplay.textContent = "No history content. Associate files to view their content.";
    }
}

async function selectCharacterForDetails(charIdStr) {
    console.log("selectCharacterForDetails: Fetching details for character ID:", charIdStr);
    currentProfileCharId = charIdStr;
    try {
        const response = await fetch(`${API_BASE_URL}/api/npcs/${charIdStr}`);
        console.log(`selectCharacterForDetails: Response status for /api/npcs/${charIdStr}: ${response.status}`);
        if (!response.ok) {
            let errorMsg = `Failed to fetch character details: ${response.status}`;
            try {
                const errData = await response.json();
                errorMsg += ` - ${errData.error || errData.message}`;
            } catch (e) { /* ignore parsing error if response not json */ }
            throw new Error(errorMsg);
        }
        let selectedChar = await response.json();

        if (selectedChar._id && typeof selectedChar._id === 'object' && selectedChar._id.$oid) {
            selectedChar._id = selectedChar._id.$oid;
        }
        // Ensure all necessary nested objects exist for safety
        selectedChar.combined_history_content = selectedChar.combined_history_content || "";
        selectedChar.vtt_data = selectedChar.vtt_data || {};
        selectedChar.vtt_flags = selectedChar.vtt_flags || {};
        selectedChar.items = selectedChar.items || [];
        selectedChar.system = selectedChar.system || {};


        console.log("selectCharacterForDetails: Fetched character details (ID as string):", {id: selectedChar._id, name: selectedChar.name, historyDefined: selectedChar.combined_history_content !== undefined, vttDataKeys: Object.keys(selectedChar.vtt_data), vttFlagsKeys: Object.keys(selectedChar.vtt_flags) });


        const charIndex = allCharacters.findIndex(c => String(c._id) === charIdStr);
        if (charIndex > -1) {
            allCharacters[charIndex] = selectedChar;
        } else {
            allCharacters.push(selectedChar);
            console.warn("selectCharacterForDetails: Fetched character was not found in allCharacters, pushed new.", charIdStr);
        }

        updateText('details-char-name', selectedChar.name || "N/A");
        updateText('profile-char-type', selectedChar.character_type || "N/A");
        updateText('profile-description', selectedChar.description || "N/A");
        updateText('profile-personality', (selectedChar.personality_traits || []).join(', ') || "N/A");

        const gmNotesElem = getElem('gm-notes');
        if (gmNotesElem) gmNotesElem.value = selectedChar.gm_notes || '';
        disableBtn('save-gm-notes-btn', false);

        const isNpc = selectedChar.character_type === 'NPC';
        const npcMemoriesSection = getElem('npc-memories-collapsible-section');
        if (npcMemoriesSection) npcMemoriesSection.style.display = isNpc ? 'block' : 'none';

        const charHistorySection = getElem('character-history-collapsible-section');
        if (charHistorySection) charHistorySection.style.display = 'block';

        if (isNpc) {
            renderMemories(selectedChar.memories || []);
            disableBtn('add-memory-btn', false);
        } else {
            disableBtn('add-memory-btn', true);
            const charMemList = getElem('character-memories-list');
            if (charMemList) charMemList.innerHTML = '<p><em>Memories are typically managed for NPCs.</em></p>';
        }

        renderAssociatedHistoryFiles(selectedChar);
        await fetchHistoryFiles();
        disableBtn('associate-history-btn', false);
    } catch (error) {
        console.error("Error in selectCharacterForDetails:", error);
        currentProfileCharId = null;
        updateText('details-char-name', "Error");
        updateText('profile-char-type', 'Error');
        updateText('profile-description', 'Error loading details.');
        updateText('profile-personality', 'Error');
        const histContentDisp = getElem('history-content-display');
        if(histContentDisp) histContentDisp.textContent = "Error loading character details.";
        const assocHistList = getElem('associated-history-list');
        if(assocHistList) assocHistList.innerHTML = '<li><em>Error loading.</em></li>';
        disableBtn('save-gm-notes-btn', true);
        disableBtn('add-memory-btn', true);
        disableBtn('associate-history-btn', true);
    }
}

function togglePcSelection(pcIdStr, element) {
    console.log("Toggling PC selection for:", pcIdStr, "Current activePcIds:", new Set(activePcIds));
    if (activePcIds.has(pcIdStr)) {
        activePcIds.delete(pcIdStr);
        if (element) element.classList.remove('selected');
        console.log("Removed. New activePcIds:", new Set(activePcIds));
    } else {
        activePcIds.add(pcIdStr);
        if (element) element.classList.add('selected');
        console.log("Added. New activePcIds:", new Set(activePcIds));
    }
    const pcDashboardViewElem = getElem('pc-dashboard-view');
    if(pcDashboardViewElem && pcDashboardViewElem.style.display === 'block') { // Check if dashboard is visible
        // If a detailed sheet is NOT showing, or if the current detailed sheet is NOT for the toggled PC, update overview.
        const detailedSheet = pcDashboardViewElem.querySelector('.detailed-pc-sheet');
        if (!detailedSheet || (detailedSheet && detailedSheet.dataset.pcId !== pcIdStr)) {
            // updatePcDashboard(); // Don't force overview if just toggling selection for already detailed PC
        }
        // If the detailed sheet for THIS pcId IS showing, and we just DE-selected it, then revert to overview.
        else if (detailedSheet && detailedSheet.dataset.pcId === pcIdStr && !activePcIds.has(pcIdStr)) {
            updatePcDashboard();
        }
         // If no detailed sheet is showing, and we just selected a PC, show overview.
        else if (!detailedSheet && activePcIds.size > 0) {
            updatePcDashboard();
        }
    }
}

function updateView() {
    const dialogueInterface = getElem('dialogue-interface');
    const pcDashboardView = getElem('pc-dashboard-view');
    if (!dialogueInterface || !pcDashboardView) {
        console.error("updateView: dialogueInterface or pcDashboardView element not found.");
        return;
    }

    if (activeSceneNpcIds.size > 0) { // If NPCs are active for dialogue, show dialogue interface
        dialogueInterface.style.display = 'flex';
        pcDashboardView.style.display = 'none';
        const dashboardContent = getElem('pc-dashboard-content');
        if (dashboardContent.querySelector('.detailed-pc-sheet')) {
            // If switching from a detailed PC view to NPC dialogue, clear detailed view and show overview next time
            dashboardContent.innerHTML = ''; // Clear detailed view
            updatePcDashboard(); // Prepare overview for next time PC dashboard is shown
        }

        if(currentlyExpandedAbility){
            const expansionDiv = document.getElementById(`expanded-${currentlyExpandedAbility}`);
            if(expansionDiv) expansionDiv.style.display = 'none';
            const headerTH = document.querySelector(`#main-stats-table th[data-ability="${currentlyExpandedAbility}"]`);
            if (headerTH && headerTH.querySelector('span.arrow-indicator')) headerTH.querySelector('span.arrow-indicator').textContent = ' ►';
            currentlyExpandedAbility = null;
        }
        if(currentlyExpandedSkill){
            const skillExpansionDiv = document.getElementById(`expanded-skill-${currentlyExpandedSkill}`);
            if(skillExpansionDiv) skillExpansionDiv.style.display = 'none';
            const skillHeader = document.querySelector(`#skills-overview-table th.clickable-skill-header[data-skill-key="${currentlyExpandedSkill}"]`);
            if(skillHeader && skillHeader.querySelector('span.arrow-indicator')) skillHeader.querySelector('span.arrow-indicator').textContent = ' ►';
            currentlyExpandedSkill = null;
        }
    } else { // Otherwise, show PC Dashboard
        dialogueInterface.style.display = 'none';
        pcDashboardView.style.display = 'block';
        // If no specific PC detail sheet is currently displayed, show the overview.
        // This ensures that if we switch from NPC view back to PC view, we see the overview.
        if (!getElem('pc-dashboard-content').querySelector('.detailed-pc-sheet')) {
            updatePcDashboard();
        }
        // If a detailed sheet IS up, let it stay. Clicking a PC card from quick view will call renderDetailedPcSheet.
        // Clicking a PC from the list will also handle updating the view correctly to show the overview.
    }
}

function updatePcDashboard() {
    console.log("Updating PC Dashboard (Overview). Active PC IDs:", new Set(activePcIds));
    const dashboardContent = getElem('pc-dashboard-content');
    if (!dashboardContent) {
        console.error("updatePcDashboard: 'pc-dashboard-content' not found.");
        return;
    }

    dashboardContent.innerHTML = ''; // Clear for overview

    const selectedPcs = allCharacters.filter(char =>
        activePcIds.has(String(char._id)) && char.character_type === 'PC' && char.vtt_data
    );
    console.log("Selected PCs for dashboard overview:", selectedPcs.map(p => ({name: p.name, id: p._id, vtt: !!p.vtt_data, flags: !!p.vtt_flags }) ));

    if (selectedPcs.length === 0) {
        const anyPcsExist = allCharacters.some(char => char.character_type === 'PC' && (char.vtt_data && Object.keys(char.vtt_data).length > 0));
        dashboardContent.innerHTML = `<p class="pc-dashboard-no-selection">${anyPcsExist ? 'Select Player Characters from the left panel to view their details.' : 'No Player Characters with VTT data available. Create PCs and ensure VTT data is synced.'}</p>`;
        if (currentlyExpandedAbility) {
            const expansionDiv = document.getElementById(`expanded-${currentlyExpandedAbility}`);
            if (expansionDiv) expansionDiv.style.display = 'none';
            const headerTH = document.querySelector(`#main-stats-table th[data-ability="${currentlyExpandedAbility}"]`);
             if (headerTH && headerTH.querySelector('span.arrow-indicator')) headerTH.querySelector('span.arrow-indicator').textContent = ' ►';
            currentlyExpandedAbility = null;
        }
        if (currentlyExpandedSkill) {
            const skillExpansionDiv = document.getElementById(`expanded-skill-${currentlyExpandedSkill}`);
            if (skillExpansionDiv) skillExpansionDiv.style.display = 'none';
            const skillHeader = document.querySelector(`#skills-overview-table th.clickable-skill-header[data-skill-key="${currentlyExpandedSkill}"]`);
            if(skillHeader && skillHeader.querySelector('span.arrow-indicator')) skillHeader.querySelector('span.arrow-indicator').textContent = ' ►';
            currentlyExpandedSkill = null;
        }
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
        // Added inline style for visibility debugging, you can remove the border later
        statCardsHTML += `<div class="pc-stat-card clickable-pc-card" data-pc-id="${String(pc._id)}" style="border: 1px dashed blue;"><h4>${pc.name} (Lvl ${pcLevel})</h4>`;
        
        const hpCurrent = pc.vtt_data?.attributes?.hp?.value !== undefined ? pc.vtt_data.attributes.hp.value : 'N/A';
        const hpMax = pc.vtt_data?.attributes?.hp?.max !== undefined && pc.vtt_data.attributes.hp.max !== null ? pc.vtt_data.attributes.hp.max : (pc.system?.attributes?.hp?.max || 'N/A');
        statCardsHTML += `<p><strong>HP:</strong> ${hpCurrent} / ${hpMax}</p>`;

        let acDisplay = pc.vtt_flags?.ddbimporter?.overrideAC?.flat;
        if (acDisplay === undefined || acDisplay === null) acDisplay = pc.vtt_data?.attributes?.ac?.value;
        if (acDisplay === undefined || acDisplay === null) acDisplay = pc.vtt_data?.attributes?.ac?.flat;
        if (acDisplay === undefined || acDisplay === null) { 
            const equippedArmor = pc.items?.find(item => item.type === 'equipment' && item.system?.equipped && item.system?.armor?.value !== undefined);
            if (equippedArmor) {
                acDisplay = equippedArmor.system.armor.value;
                if (equippedArmor.system.armor.dex !== null && equippedArmor.system.armor.dex !== undefined && pc.vtt_data?.abilities?.dex?.value) {
                    const dexMod = getAbilityModifier(pc.vtt_data.abilities.dex.value);
                    acDisplay += Math.min(dexMod, equippedArmor.system.armor.dex); 
                } else if (equippedArmor.system.armor.dex === null && pc.vtt_data?.abilities?.dex?.value) { 
                     acDisplay += getAbilityModifier(pc.vtt_data.abilities.dex.value);
                }
            } else {
                acDisplay = 'N/A';
            }
        }
        statCardsHTML += `<p><strong>AC:</strong> ${acDisplay}</p>`;

        statCardsHTML += `<p><strong>Prof. Bonus:</strong> +${pc.calculatedProfBonus}</p>`;
        statCardsHTML += `<p><strong>Speed:</strong> ${pc.vtt_data?.attributes?.movement?.walk || pc.system?.attributes?.movement?.walk || 0} ft</p>`;
        
        let initiativeBonus = 'N/A';
        const initAbility = pc.vtt_data?.attributes?.init?.ability;
        const dexValue = pc.vtt_data?.abilities?.dex?.value;

        if (initAbility && pc.vtt_data?.abilities?.[initAbility]) {
            initiativeBonus = getAbilityModifier(pc.vtt_data.abilities[initAbility].value || 10);
        } else if (pc.vtt_data?.attributes?.init?.bonus !== undefined && pc.vtt_data.attributes.init.bonus !== "") {
            initiativeBonus = pc.vtt_data.attributes.init.bonus;
        } else if (dexValue !== undefined) {
            initiativeBonus = getAbilityModifier(dexValue);
        }
        statCardsHTML += `<p><strong>Initiative:</strong> ${initiativeBonus >= 0 ? '+' : ''}${initiativeBonus}</p>`;

        const spellcastingAbilityKey = pc.system?.attributes?.spellcasting || pc.vtt_data?.attributes?.spellcasting;
        let spellDcText = "N/A";
        if (spellcastingAbilityKey && pc.vtt_data?.abilities?.[spellcastingAbilityKey]?.value !== undefined) {
            const castingScore = pc.vtt_data.abilities[spellcastingAbilityKey].value || 10;
            spellDcText = spellSaveDC(castingScore, pc.calculatedProfBonus);
        } else if (pc.vtt_data?.attributes?.spell?.dc) { 
            spellDcText = pc.vtt_data.attributes.spell.dc;
        }
        statCardsHTML += `<p><strong>Spell DC:</strong> ${spellDcText}</p>`;

        statCardsHTML += `</div>`;
    });
    statCardsHTML += `</div>`;
    
    dashboardContent.innerHTML += statCardsHTML;
    // REMOVED the forEach loop that attached individual listeners here.
    // The delegated listener (added in DOMContentLoaded) will handle clicks on .clickable-pc-card

    const abilities = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
    let mainStatsTableHTML = `<h4>Ability Scores Overview</h4>
                              <table id="main-stats-table"><thead><tr><th>Character</th>`;
    abilities.forEach(ablKey => {
        const arrow = (currentlyExpandedAbility === ablKey && document.getElementById(`expanded-${ablKey}`)?.style.display !== 'none') ? '▼' : '►';
        mainStatsTableHTML += `<th class="clickable-ability-header" data-ability="${ablKey}" onclick="toggleAbilityExpansion('${ablKey}')">${ablKey} <span class="arrow-indicator">${arrow}</span></th>`;
    });
    mainStatsTableHTML += `</tr></thead><tbody>`;
    sortedSelectedPcsByName.forEach(pc => {
        mainStatsTableHTML += `<tr><td>${pc.name}</td>`;
        abilities.forEach(ablKey => {
            const score = pc.vtt_data?.abilities?.[ablKey.toLowerCase()]?.value || 0;
            const mod = getAbilityModifier(score);
            mainStatsTableHTML += `<td>${score} (${mod >= 0 ? '+' : ''}${mod})</td>`;
        });
        mainStatsTableHTML += `</tr>`;
    });
    mainStatsTableHTML += `</tbody></table>`;
    
    dashboardContent.innerHTML += `<div class="table-wrapper">${mainStatsTableHTML}</div>`; 
    
    const abilityExpansionContainer = document.createElement('div');
    abilityExpansionContainer.id = 'expanded-ability-details-sections';
    dashboardContent.appendChild(abilityExpansionContainer);

    abilities.forEach(ablKey => {
        const expansionDiv = document.createElement('div');
        expansionDiv.id = `expanded-${ablKey}`;
        expansionDiv.className = 'expanded-ability-content';
        expansionDiv.style.display = (currentlyExpandedAbility === ablKey) ? 'block' : 'none';
        if (currentlyExpandedAbility === ablKey && selectedPcs.length > 0) {
            populateExpandedAbilityDetails(ablKey, expansionDiv, selectedPcs);
        }
        abilityExpansionContainer.appendChild(expansionDiv);
    });

    const skillNameMap = {
        "acr": "Acrobatics", "ani": "Animal Handling", "arc": "Arcana", "ath": "Athletics",
        "dec": "Deception", "his": "History", "ins": "Insight", "itm": "Intimidation",
        "inv": "Investigation", "med": "Medicine", "nat": "Nature", "prc": "Perception",
        "prf": "Performance", "per": "Persuasion", "rel": "Religion", "slt": "Sleight of Hand",
        "ste": "Stealth", "sur": "Survival"
    };
    let skillsTableHTML = `<h4>Skills Overview</h4>
                           <table id="skills-overview-table"><thead><tr><th>Character</th>`;
    for (const skillKey in skillNameMap) {
        const skillFullName = skillNameMap[skillKey];
        const arrow = (currentlyExpandedSkill === skillKey && document.getElementById(`expanded-skill-${skillKey}`)?.style.display !== 'none') ? '▼' : '►';
        skillsTableHTML += `<th class="clickable-skill-header" data-skill-key="${skillKey}" onclick="toggleSkillExpansion('${skillKey}')">${skillFullName} <span class="arrow-indicator">${arrow}</span></th>`;
    }
    skillsTableHTML += `</tr></thead><tbody>`;

    let pcsForSkillTable = [...selectedPcs];
    if (skillSortKey) {
        pcsForSkillTable.sort((a, b) => {
            const skillDataA = a.vtt_data?.skills?.[skillSortKey];
            const abilityKeyA = skillDataA?.ability || (skillSortKey === 'ath' ? 'str' : ['acr', 'slt', 'ste'].includes(skillSortKey) ? 'dex' : ['arc', 'his', 'inv', 'nat', 'rel'].includes(skillSortKey) ? 'int' : ['ani', 'ins', 'med', 'prc', 'sur'].includes(skillSortKey) ? 'wis' : 'cha');
            const abilityScoreA = a.vtt_data?.abilities?.[abilityKeyA]?.value || 10;
            const bonusA = skillDataA ? calculateSkillBonus(abilityScoreA, skillDataA.value || 0, a.calculatedProfBonus) : getAbilityModifier(abilityScoreA);

            const skillDataB = b.vtt_data?.skills?.[skillSortKey];
            const abilityKeyB = skillDataB?.ability || (skillSortKey === 'ath' ? 'str' : ['acr', 'slt', 'ste'].includes(skillSortKey) ? 'dex' : ['arc', 'his', 'inv', 'nat', 'rel'].includes(skillSortKey) ? 'int' : ['ani', 'ins', 'med', 'prc', 'sur'].includes(skillSortKey) ? 'wis' : 'cha');
            const abilityScoreB = b.vtt_data?.abilities?.[abilityKeyB]?.value || 10;
            const bonusB = skillDataB ? calculateSkillBonus(abilityScoreB, skillDataB.value || 0, b.calculatedProfBonus) : getAbilityModifier(abilityScoreB);

            return bonusB - bonusA;
        });
    } else {
         pcsForSkillTable.sort((a,b) => a.name.localeCompare(b.name));
    }

    pcsForSkillTable.forEach(pc => {
        skillsTableHTML += `<tr><td>${pc.name}</td>`;
        for (const skillKey in skillNameMap) {
            const skillData = pc.vtt_data?.skills?.[skillKey];
            let skillBonusFormatted = "N/A";
            const defaultAbilityForSkill = (skillKey === 'ath' ? 'str' : ['acr', 'slt', 'ste'].includes(skillKey) ? 'dex' : ['arc', 'his', 'inv', 'nat', 'rel'].includes(skillKey) ? 'int' : ['ani', 'ins', 'med', 'prc', 'sur'].includes(skillKey) ? 'wis' : 'cha');
            const abilityKeyForSkill = skillData?.ability || defaultAbilityForSkill;

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

    const skillExpansionContainer = document.createElement('div');
    skillExpansionContainer.id = 'expanded-skill-details-sections';
    dashboardContent.appendChild(skillExpansionContainer);

    for (const skillKey in skillNameMap) {
        const expansionDiv = document.createElement('div');
        expansionDiv.id = `expanded-skill-${skillKey}`;
        expansionDiv.className = 'expanded-skill-content';
        expansionDiv.style.display = (currentlyExpandedSkill === skillKey) ? 'block' : 'none';
        if (currentlyExpandedSkill === skillKey && selectedPcs.length > 0) {
            populateExpandedSkillDetails(skillKey, expansionDiv, selectedPcs);
        }
        skillExpansionContainer.appendChild(expansionDiv);
    }
    console.log("DEBUG: dashboardContent final innerHTML for overview (updatePcDashboard end):\n", dashboardContent.innerHTML);
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
        expansionDiv.style.display = 'block';
        arrowSpan.textContent = ' ▼';
        currentlyExpandedAbility = ablKey.toUpperCase();
    } else {
        expansionDiv.style.display = 'none';
        arrowSpan.textContent = ' ►';
        currentlyExpandedAbility = null;
    }
}

function toggleSkillExpansion(skillKey) {
    if (currentlyExpandedSkill === skillKey) {
        skillSortKey = null;
        currentlyExpandedSkill = null;
    } else {
        skillSortKey = skillKey;
        currentlyExpandedSkill = skillKey;
    }
    updatePcDashboard(); // This will re-render the skill table and handle showing/hiding the correct expansion

    // Update arrow indicators after re-render
    const allSkillHeaders = document.querySelectorAll(`#skills-overview-table th.clickable-skill-header`);
    allSkillHeaders.forEach(header => {
        const sKey = header.dataset.skillKey;
        const arrow = header.querySelector('span.arrow-indicator');
        if (arrow) { // Ensure arrow exists
            arrow.textContent = (sKey === currentlyExpandedSkill) ? ' ▼' : ' ►';
        }
    });
}


function populateExpandedSkillDetails(skillKey, expansionDiv, selectedPcs) {
    if (!selectedPcs || selectedPcs.length === 0) {
        expansionDiv.innerHTML = '<p><em>Select PCs to view skill details.</em></p>';
        return;
    }
    const skillNameMap = {
        "acr": "Acrobatics", "ani": "Animal Handling", "arc": "Arcana", "ath": "Athletics",
        "dec": "Deception", "his": "History", "ins": "Insight", "itm": "Intimidation",
        "inv": "Investigation", "med": "Medicine", "nat": "Nature", "prc": "Perception",
        "prf": "Performance", "per": "Persuasion", "rel": "Religion", "slt": "Sleight of Hand",
        "ste": "Stealth", "sur": "Survival"
    };
    const skillFullName = skillNameMap[skillKey] || skillKey.toUpperCase();
    let contentHTML = `<h5>${skillFullName} Skill Modifiers & Rules</h5>`;

    contentHTML += `<div class="skill-bar-chart-container">`;
    const skillDataForGraph = selectedPcs.map(pc => {
        const skillVttData = pc.vtt_data?.skills?.[skillKey];
        const defaultAbilityForSkill = (skillKey === 'ath' ? 'str' : ['acr', 'slt', 'ste'].includes(skillKey) ? 'dex' : ['arc', 'his', 'inv', 'nat', 'rel'].includes(skillKey) ? 'int' : ['ani', 'ins', 'med', 'prc', 'sur'].includes(skillKey) ? 'wis' : 'cha');
        const baseAbilityKey = skillVttData?.ability || defaultAbilityForSkill;
        const baseAbilityScore = pc.vtt_data?.abilities?.[baseAbilityKey]?.value || 10;
        const bonus = calculateSkillBonus(baseAbilityScore, skillVttData?.value || 0, pc.calculatedProfBonus);
        return { name: pc.name, modifier: bonus };
    }).sort((a,b) => b.modifier - a.modifier);

    const allModifiers = skillDataForGraph.map(d => d.modifier);
    const dataMinMod = allModifiers.length > 0 ? Math.min(0, ...allModifiers) : 0;
    const dataMaxMod = allModifiers.length > 0 ? Math.max(0, ...allModifiers) : 0;

    const visualMin = Math.min(-2, dataMinMod -1);
    const visualMax = Math.max(5, dataMaxMod + 1);
    const visualRange = visualMax - visualMin;

    const zeroPositionPercent = visualRange !== 0 ? ((0 - visualMin) / visualRange) * 100 : 50;

    skillDataForGraph.forEach(data => {
        let barWidthPercent = 0;
        let barLeftPercent = zeroPositionPercent;
        let barClass = 'stat-bar';

        if (visualRange !== 0) {
            if (data.modifier >= 0) {
                barClass += ' positive';
                barWidthPercent = (data.modifier / visualRange) * 100;
            } else {
                barClass += ' negative';
                barWidthPercent = (Math.abs(data.modifier) / visualRange) * 100;
                barLeftPercent = zeroPositionPercent - barWidthPercent;
            }
        } else {
             barWidthPercent = data.modifier === 0 ? 0 : 50;
             if(data.modifier < 0) barLeftPercent = 0;
        }
        barWidthPercent = Math.max(0.5, barWidthPercent);

        contentHTML += `<div class="pc-bar-row">
                            <div class="stat-comparison-pc-name" title="${data.name}">${data.name.substring(0,15)+(data.name.length > 15 ? '...' : '')}</div>
                            <div class="stat-bar-wrapper" style="--zero-offset: ${zeroPositionPercent}%;">
                                <div class="${barClass}" style="left: ${barLeftPercent}%; width: ${barWidthPercent}%;">
                                    ${data.modifier >= 0 ? '+' : ''}${data.modifier}
                                </div>
                            </div>
                       </div>`;
    });
    contentHTML += `</div>`;
    contentHTML += `<table class="rules-explanation-table"><tr><td>`;
    switch (skillKey) {
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
        default: contentHTML += `General information about the ${skillFullName} skill. (Details to be added).`; break;
    }
    contentHTML += "</td></tr></table>";
    expansionDiv.innerHTML = contentHTML;
}

function populateExpandedAbilityDetails(ablKey, expansionDiv, selectedPcsInput) {
     if (!selectedPcsInput || selectedPcsInput.length === 0) {
        expansionDiv.innerHTML = '<p><em>Select PCs to view ability details.</em></p>';
        return;
    }
    const upperAblKey = ablKey.toUpperCase();
    const lowerAblKey = ablKey.toLowerCase();

    const sortedPcs = [...selectedPcsInput].sort((a, b) => {
        const scoreA = a.vtt_data?.abilities?.[lowerAblKey]?.value || 0;
        const scoreB = b.vtt_data?.abilities?.[lowerAblKey]?.value || 0;
        return scoreB - scoreA;
    });

    let contentHTML = `<h5>${upperAblKey} Score Comparison</h5>`;
    contentHTML += `<div class="ability-bar-chart-container">`;
    sortedPcs.forEach(pc => {
        const score = pc.vtt_data?.abilities?.[lowerAblKey]?.value || 0;
        const barWidth = Math.max(5, (score / 20) * 100);
        contentHTML += `<div class="pc-bar-row">
                            <div class="stat-comparison-pc-name" title="${pc.name}">${pc.name.substring(0,15)+(pc.name.length > 15 ? '...' : '')}</div>
                            <div class="stat-bar-wrapper"><div class="stat-bar" style="width: ${barWidth}%;">${score}</div></div>
                       </div>`;
    });
    contentHTML += `</div>`;

    contentHTML += `<h5>${upperAblKey} Derived Stats Summary</h5><table class="derived-stats-table"><thead><tr><th>Derived Stat</th>`;
    sortedPcs.forEach(pc => { contentHTML += `<th>${pc.name.substring(0,10)+(pc.name.length > 10 ? '...' : '')}</th>`; });
    contentHTML += `</tr></thead><tbody>`;

    let generalDerivedMetrics = ["Modifier", `${upperAblKey} Save`];
    if (upperAblKey === 'STR') generalDerivedMetrics.push("Long Jump (Run/Stand)", "High Jump (Run/Stand)");
    else if (upperAblKey === 'DEX') generalDerivedMetrics.push("Initiative");
    else if (upperAblKey === 'CON') generalDerivedMetrics.push("Hold Breath");
    else if (upperAblKey === 'WIS') generalDerivedMetrics.push("Passive Perception (Calc)");

    sortedPcs.forEach(pc => {
        if (pc.calculatedProfBonus === undefined) {
            const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || pc.vtt_data?.details?.level || 1;
            pc.calculatedProfBonus = getProficiencyBonus(pcLevel);
        }
    });

    generalDerivedMetrics.forEach(metricName => {
        contentHTML += `<tr><th>${metricName}</th>`;
        sortedPcs.forEach(pc => {
            const abilityData = pc.vtt_data?.abilities?.[lowerAblKey];
            const score = abilityData?.value || 0;
            const modifier = getAbilityModifier(score);
            const isSaveProficient = abilityData?.proficient === 1;
            let value = 'N/A';

            if (metricName === "Modifier") value = `${modifier >= 0 ? '+' : ''}${modifier}`;
            else if (metricName === `${upperAblKey} Save`) {
                const saveBonus = savingThrowBonus(score, isSaveProficient, pc.calculatedProfBonus);
                value = `${saveBonus >= 0 ? '+' : ''}${saveBonus} ${isSaveProficient ? '<abbr title="Proficient">(P)</abbr>' : ''}`;
            }
            else if (metricName === "Long Jump (Run/Stand)" && upperAblKey === 'STR') value = `${longJump(score, true)}ft / ${longJump(score, false)}ft`;
            else if (metricName === "High Jump (Run/Stand)" && upperAblKey === 'STR') value = `${highJump(score, true)}ft / ${highJump(score, false)}ft`;
            else if (metricName === "Initiative" && upperAblKey === 'DEX') value = `${initiative(score) >= 0 ? '+' : ''}${initiative(score)}`;
            else if (metricName === "Hold Breath" && upperAblKey === 'CON') value = `${holdBreath(score)}`;
            else if (metricName === "Passive Perception (Calc)" && upperAblKey === 'WIS') {
                const wisScoreVal = pc.vtt_data?.abilities?.wis?.value || 0;
                const percSkillInfo = pc.vtt_data?.skills?.prc;
                 if (wisScoreVal !== undefined && percSkillInfo !== undefined && pc.calculatedProfBonus !== undefined) {
                     value = calculatePassiveSkill(wisScoreVal, percSkillInfo.value || 0, pc.calculatedProfBonus);
                 }
            }
            contentHTML += `<td>${value}</td>`;
        });
        contentHTML += `</tr>`;
    });
    contentHTML += `</tbody></table>`;

    contentHTML += `<hr><h4>${upperAblKey} Applications & Calculations</h4>`;

    if (upperAblKey === 'STR') {
        contentHTML += `<h5>Strength Checks & Athletics</h5><table class="rules-explanation-table"><tr><td><strong>General:</strong> Strength checks model any attempt to lift, push, pull, or break something, to force your body through a space, or to otherwise apply brute force to a situation. The Athletics skill reflects aptitude in certain kinds of Strength checks.</td></tr><tr><td><strong>Athletics Examples:</strong><ul><li>Attempt to climb a sheer or slippery cliff, avoid hazards while scaling a wall, or cling to a surface while something is trying to knock you off.</li><li>Try to jump an unusually long distance or pull off a stunt midjump.</li><li>Struggle to swim or stay afloat in treacherous currents, storm-tossed waves, or areas of thick seaweed. Or another creature tries to push or pull you underwater or otherwise interfere with your swimming.</li></ul></td></tr><tr><td><strong>Other Strength Check Examples:</strong><ul><li>Force open a stuck, locked, or barred door.</li><li>Break free of bonds.</li><li>Push through a tunnel that is too small.</li><li>Hang on to a wagon while being dragged behind it.</li><li>Tip over a statue.</li><li>Keep a boulder from rolling.</li></ul></td></tr></table>`;
        contentHTML += `<h5>Attack Rolls and Damage (Melee Weapons)</h5><table class="rules-explanation-table"><tr><td>You add your Strength modifier to your attack roll and your damage roll when attacking with a melee weapon such as a mace, a battleaxe, or a javelin. You use melee weapons to make melee attacks in hand-to-hand combat, and some of them can be thrown to make a ranged attack.</td></tr></table>`;
        contentHTML += `<table class="derived-stats-table"><thead><tr><th>Character</th><th>STR Modifier (for Melee Attack/Damage)</th></tr></thead><tbody>`;
        sortedPcs.forEach(pc => {
            const score = pc.vtt_data?.abilities?.str?.value || 0; const mod = getAbilityModifier(score);
            contentHTML += `<tr><td>${pc.name}</td><td>${mod >= 0 ? '+' : ''}${mod}</td></tr>`;
        });
        contentHTML += `</tbody></table>`;
        contentHTML += `<h5>Lifting and Carrying</h5><table class="rules-explanation-table"><tr><td><strong>Carrying Capacity Rule:</strong> Your carrying capacity is your Strength score multiplied by 15. This is the weight (in pounds) that you can carry.</td></tr><tr><td><strong>Push, Drag, or Lift Rule:</strong> You can push, drag, or lift a weight in pounds up to twice your carrying capacity (or 30 times your Strength score). While pushing or dragging weight in excess of your carrying capacity, your speed drops to 5 feet.</td></tr><tr><td><strong>Size and Strength Rule:</strong> Larger creatures can bear more weight, whereas Tiny creatures can carry less. For each size category above Medium, double the creature’s carrying capacity and the amount it can push, drag, or lift. For a Tiny creature, halve these weights. (Calculations below account for this).</td></tr></table>`;
        contentHTML += `<table class="derived-stats-table"><thead><tr><th>Character</th><th>Size</th><th>Carrying Capacity (lbs)</th><th>Push/Drag/Lift (lbs)</th></tr></thead><tbody>`;
        sortedPcs.forEach(pc => {
            const score = pc.vtt_data?.abilities?.str?.value || 0; const size = pc.system?.traits?.size || pc.vtt_data?.traits?.size || 'med';
            let capMultiplier = 1; if (size === 'tiny') capMultiplier = 0.5; else if (size === 'lg') capMultiplier = 2; else if (size === 'huge') capMultiplier = 4; else if (size === 'grg') capMultiplier = 8;
            const baseCap = carryingCapacity(score); const actualCap = Math.floor(baseCap * capMultiplier); const pdl = actualCap * 2;
            const sizeMap = { 'tiny': 'Tiny', 'sm': 'Small', 'med': 'Medium', 'lg': 'Large', 'huge': 'Huge', 'grg': 'Gargantuan' };
            contentHTML += `<tr><td>${pc.name}</td><td>${sizeMap[size] || size}</td><td>${actualCap}</td><td>${pdl}</td></tr>`;
        });
        contentHTML += `</tbody></table>`;
        contentHTML += `<h5>Variant: Encumbrance</h5><table class="rules-explanation-table"><tr><td>(When you use this variant, ignore the Strength column of the Armor table.)</td></tr><tr><td><strong>Encumbered:</strong> If you carry weight in excess of 5 times your Strength score, you are encumbered, which means your speed drops by 10 feet.</td></tr><tr><td><strong>Heavily Encumbered:</strong> If you carry weight in excess of 10 times your Strength score, up to your maximum carrying capacity, you are instead heavily encumbered, which means your speed drops by 20 feet and you have disadvantage on ability checks, attack rolls, and saving throws that use Strength, Dexterity, or Constitution.</td></tr></table>`;
        contentHTML += `<table class="derived-stats-table"><thead><tr><th>Character</th><th>Encumbered At (> lbs)</th><th>Heavily Encumbered At (> lbs)</th></tr></thead><tbody>`;
        sortedPcs.forEach(pc => {
            const score = pc.vtt_data?.abilities?.str?.value || 0;
            contentHTML += `<tr><td>${pc.name}</td><td>${score * 5}</td><td>${score * 10}</td></tr>`;
        });
        contentHTML += `</tbody></table>`;
    }
    else if (upperAblKey === 'DEX') {
        contentHTML += `<h5>Dexterity Checks</h5><table class="rules-explanation-table"><tr><td>A Dexterity check can model any attempt to move nimbly, quickly, or quietly, or to keep from falling on tricky footing. The Acrobatics, Sleight of Hand, and Stealth skills reflect aptitude in certain kinds of Dexterity checks.</td></tr></table>`;
        contentHTML += `<h5>Attack Rolls and Damage (Ranged/Finesse)</h5><table class="rules-explanation-table"><tr><td>You add your Dexterity modifier to your attack roll and your damage roll when attacking with a ranged weapon, such as a sling or a longbow. You can also add your Dexterity modifier to your attack roll and your damage roll when attacking with a melee weapon that has the finesse property, such as a dagger or a rapier.</td></tr></table>`;
        contentHTML += `<table class="derived-stats-table"><thead><tr><th>Character</th><th>DEX Modifier (for Ranged/Finesse Attack/Damage)</th></tr></thead><tbody>`;
        sortedPcs.forEach(pc => {
            const score = pc.vtt_data?.abilities?.dex?.value || 0; const mod = getAbilityModifier(score);
            contentHTML += `<tr><td>${pc.name}</td><td>${mod >= 0 ? '+' : ''}${mod}</td></tr>`;
        });
        contentHTML += `</tbody></table>`;
        contentHTML += `<h5>Armor Class</h5><table class="rules-explanation-table"><tr><td>Depending on the armor you wear, you might add some or all of your Dexterity modifier to your Armor Class. (Actual AC is on individual character cards).</td></tr></table>`;
        contentHTML += `<h5>Initiative</h5><table class="rules-explanation-table"><tr><td>At the beginning of every combat, you roll initiative by making a Dexterity check. Initiative determines the order of creatures’ turns in combat.</td></tr></table>`;
        contentHTML += `<h5>Hiding</h5><table class="rules-explanation-table"><tr><td>Make a Dexterity (Stealth) check. Contested by Wisdom (Perception) of searchers...<br><strong>Passive Perception:</strong> Your Dexterity (Stealth) check is compared against a creature's passive Wisdom (Perception) score (10 + creature's Wisdom modifier + bonuses/penalties).</td></tr></table>`;
    }
    else if (upperAblKey === 'CON') {
        contentHTML += `<h5>Constitution Checks</h5><table class="rules-explanation-table"><tr><td>Constitution checks are uncommon, and no skills apply to Constitution checks, because the endurance this ability represents is largely passive... Examples: Hold your breath, march or labor for hours without rest, go without sleep, survive without food or water, quaff an entire stein of ale in one go.</td></tr></table>`;
        contentHTML += `<h5>Hit Points</h5><table class="rules-explanation-table"><tr><td>Your Constitution modifier contributes to your hit points. Typically, you add your Constitution modifier to each Hit Die you roll for your hit points. If your Constitution modifier changes, your hit point maximum changes as well, as though you had the new modifier from 1st level.</td></tr></table>`;
        contentHTML += `<table class="derived-stats-table"><thead><tr><th>Character</th><th>CON Modifier (for HP)</th><th>Max HP (from VTT)</th></tr></thead><tbody>`;
        sortedPcs.forEach(pc => {
            const score = pc.vtt_data?.abilities?.con?.value || 0; const mod = getAbilityModifier(score);
            const hpMax = pc.vtt_data?.attributes?.hp?.max !== undefined && pc.vtt_data.attributes.hp.max !== null ? pc.vtt_data.attributes.hp.max : (pc.system?.attributes?.hp?.max || 'N/A');
            contentHTML += `<tr><td>${pc.name}</td><td>${mod >= 0 ? '+' : ''}${mod}</td><td>${hpMax}</td></tr>`;
        });
        contentHTML += `</tbody></table>`;
    }
    else if (upperAblKey === 'INT') {
        contentHTML += `<h5>Intelligence Checks</h5><table class="rules-explanation-table"><tr><td>An Intelligence check comes into play when you need to draw on logic, education, memory, or deductive reasoning. The Arcana, History, Investigation, Nature, and Religion skills reflect aptitude in certain kinds of Intelligence checks.</td></tr></table>`;
        contentHTML += `<h5>Other Intelligence Checks</h5><table class="rules-explanation-table"><tr><td>The GM might call for an Intelligence check when you try to accomplish tasks like: Communicate with a creature without using words, estimate the value of a precious item, pull together a disguise to pass as a city guard, forge a document, recall lore about a craft or trade, win a game of skill.</td></tr></table>`;
        contentHTML += `<h5>Spellcasting Ability (Wizards, Artificers)</h5><table class="rules-explanation-table"><tr><td>Wizards and Artificers use Intelligence as their spellcasting ability, which helps determine the saving throw DCs of spells they cast.</td></tr></table>`;
        if (sortedPcs.some(pc => pc.vtt_data?.attributes?.spellcasting === 'int')) {
            contentHTML += `<table class="derived-stats-table"><thead><tr><th>Character (INT Casters)</th><th>Spell Save DC</th><th>Spell Attack Bonus</th></tr></thead><tbody>`;
            sortedPcs.filter(pc => pc.vtt_data?.attributes?.spellcasting === 'int').forEach(pc => {
                const score = pc.vtt_data?.abilities?.int?.value || 0;
                contentHTML += `<tr><td>${pc.name}</td><td>${spellSaveDC(score, pc.calculatedProfBonus)}</td><td>+${spellAttackBonus(score, pc.calculatedProfBonus)}</td></tr>`;
            });
            contentHTML += `</tbody></table>`;
        }
    }
    else if (upperAblKey === 'WIS') {
        contentHTML += `<h5>Wisdom Checks</h5><table class="rules-explanation-table"><tr><td>A Wisdom check might reflect an effort to read body language, understand someone’s feelings, notice things about the environment, or care for an injured person. The Animal Handling, Insight, Medicine, Perception, and Survival skills reflect aptitude in certain kinds of Wisdom checks.</td></tr></table>`;
        contentHTML += `<h5>Other Wisdom Checks</h5><table class="rules-explanation-table"><tr><td>The GM might call for a Wisdom check when you try to accomplish tasks like: Get a gut feeling about what course of action to follow, discern whether a seemingly dead or living creature is undead.</td></tr></table>`;
        contentHTML += `<h5>Spellcasting Ability (Clerics, Druids, Rangers, Monks)</h5><table class="rules-explanation-table"><tr><td>Clerics, druids, rangers, and some monks use Wisdom as their spellcasting ability, which helps determine the saving throw DCs of spells they cast.</td></tr></table>`;
         if (sortedPcs.some(pc => pc.vtt_data?.attributes?.spellcasting === 'wis')) {
            contentHTML += `<table class="derived-stats-table"><thead><tr><th>Character (WIS Casters)</th><th>Spell Save DC</th><th>Spell Attack Bonus</th></tr></thead><tbody>`;
            sortedPcs.filter(pc => pc.vtt_data?.attributes?.spellcasting === 'wis').forEach(pc => {
                const score = pc.vtt_data?.abilities?.wis?.value || 0;
                contentHTML += `<tr><td>${pc.name}</td><td>${spellSaveDC(score, pc.calculatedProfBonus)}</td><td>+${spellAttackBonus(score, pc.calculatedProfBonus)}</td></tr>`;
            });
            contentHTML += `</tbody></table>`;
        }
    }
    else if (upperAblKey === 'CHA') {
        contentHTML += `<h5>Charisma Checks</h5><table class="rules-explanation-table"><tr><td>A Charisma check might arise when you try to influence or entertain others, when you try to make an impression or tell a convincing lie, or when you are navigating a tricky social situation. The Deception, Intimidation, Performance, and Persuasion skills reflect aptitude in certain kinds of Charisma checks.</td></tr></table>`;
        contentHTML += `<h5>Other Charisma Checks</h5><table class="rules-explanation-table"><tr><td>The GM might call for a Charisma check when you try to accomplish tasks like: Find the best person to talk to for news, rumors, and gossip, blend into a crowd to get the sense of key topics of conversation.</td></tr></table>`;
        contentHTML += `<h5>Spellcasting Ability (Bards, Paladins, Sorcerers, Warlocks)</h5><table class="rules-explanation-table"><tr><td>Bards, paladins, sorcerers, and warlocks use Charisma as their spellcasting ability, which helps determine the saving throw DCs of spells they cast.</td></tr></table>`;
        if (sortedPcs.some(pc => pc.vtt_data?.attributes?.spellcasting === 'cha')) {
            contentHTML += `<table class="derived-stats-table"><thead><tr><th>Character (CHA Casters)</th><th>Spell Save DC</th><th>Spell Attack Bonus</th></tr></thead><tbody>`;
            sortedPcs.filter(pc => pc.vtt_data?.attributes?.spellcasting === 'cha').forEach(pc => {
                const score = pc.vtt_data?.abilities?.cha?.value || 0;
                contentHTML += `<tr><td>${pc.name}</td><td>${spellSaveDC(score, pc.calculatedProfBonus)}</td><td>+${spellAttackBonus(score, pc.calculatedProfBonus)}</td></tr>`;
            });
            contentHTML += `</tbody></table>`;
        }
    }
    expansionDiv.innerHTML = contentHTML;
}


// --- NEW FUNCTION for Detailed PC Sheet ---
function renderDetailedPcSheet(pcId) {
    const pc = allCharacters.find(c => String(c._id) === String(pcId));
    if (!pc || pc.character_type !== 'PC' || !pc.vtt_data) { 
        console.error("PC not found or invalid VTT data for detailed sheet:", pcId, pc);
        const dashboardContentError = getElem('pc-dashboard-content');
        if (dashboardContentError) {
            dashboardContentError.innerHTML = `<p>Error: Could not load detailed sheet for PC ID ${pcId}. <button onclick="updatePcDashboard()">Back to Overview</button></p>`;
        }
        return;
    }

    console.log("Rendering detailed sheet for:", pc.name, "VTT Data:", pc.vtt_data, "VTT Flags:", pc.vtt_flags, "Items:", pc.items);

    const dashboardContent = getElem('pc-dashboard-content');
    if (!dashboardContent) {
        console.error("renderDetailedPcSheet: 'pc-dashboard-content' element not found.");
        return;
    }
    dashboardContent.innerHTML = ''; 

    let html = `<div class="detailed-pc-sheet" data-pc-id="${pcId}">`; 
    html += `<button onclick="updatePcDashboard()" style="margin-bottom: 15px; padding: 8px 12px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Back to Dashboard Overview</button>`;
    html += `<h2>${pc.name}</h2>`;

    // Basic Info
    const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.vtt_data?.details?.level || 1; 
    pc.calculatedProfBonus = getProficiencyBonus(pcLevel);

    html += `<div class="pc-section"><h4>Basic Information</h4><div class="pc-info-grid">`;
    
    let raceName = pc.vtt_data?.details?.race || 'N/A'; 
    if (pc.items && pc.vtt_data?.details?.race) { 
        const raceItem = pc.items.find(item => item._id === pc.vtt_data.details.race && item.type === 'race');
        if (raceItem) raceName = raceItem.name;
    }
    html += `<p><strong>Race:</strong> ${raceName}</p>`;

    let className = 'N/A';
    const classItemFromItems = pc.items?.find(i => i.type === 'class');
    if (classItemFromItems) {
        className = classItemFromItems.name;
    } else if (pc.vtt_data?.details?.originalClass) { 
         className = pc.vtt_data.details.originalClass;
    }
    html += `<p><strong>Class:</strong> ${className}</p>`;
    html += `<p><strong>Level:</strong> ${pcLevel}</p>`;
    html += `<p><strong>Alignment:</strong> ${pc.vtt_data?.details?.alignment || 'N/A'}</p>`; 
    
    const imgSrc = pc.img || pc.vtt_data?.img;
    if (imgSrc && !String(imgSrc).includes('ddb-images/')) { 
      html += `<img src="${String(imgSrc).startsWith('http') ? imgSrc : API_BASE_URL + '/' + imgSrc}" alt="${pc.name}" style="max-width: 150px; float:right; margin-left:10px; border-radius: 4px;">`;
    }
    html += `</div></div>`;

    // Combat Stats
    html += `<div class="pc-section"><h4>Combat Stats</h4><div class="pc-info-grid">`;
    const hpCurrent = pc.vtt_data?.attributes?.hp?.value !== undefined ? pc.vtt_data.attributes.hp.value : 'N/A';
    const hpMax = pc.vtt_data?.attributes?.hp?.max !== undefined && pc.vtt_data.attributes.hp.max !== null ? pc.vtt_data.attributes.hp.max : 'N/A';
    html += `<p><strong>HP:</strong> ${hpCurrent} / ${hpMax}</p>`;

    let acDisplay = pc.vtt_flags?.ddbimporter?.overrideAC?.flat;
    if (acDisplay === undefined || acDisplay === null) acDisplay = pc.vtt_data?.attributes?.ac?.value;
    if (acDisplay === undefined || acDisplay === null) acDisplay = pc.vtt_data?.attributes?.ac?.flat;
    if (acDisplay === undefined || acDisplay === null) { 
        const equippedArmor = pc.items?.find(item => item.type === 'equipment' && item.system?.equipped && item.system?.armor?.value !== undefined);
        if (equippedArmor) {
            acDisplay = equippedArmor.system.armor.value;
            if (equippedArmor.system.armor.dex !== null && equippedArmor.system.armor.dex !== undefined && pc.vtt_data?.abilities?.dex?.value) {
                const dexMod = getAbilityModifier(pc.vtt_data.abilities.dex.value);
                acDisplay += Math.min(dexMod, equippedArmor.system.armor.dex); 
            } else if (equippedArmor.system.armor.dex === null && pc.vtt_data?.abilities?.dex?.value) { 
                 acDisplay += getAbilityModifier(pc.vtt_data.abilities.dex.value);
            }
        } else {
            acDisplay = 'N/A';
        }
    }
    html += `<p><strong>AC:</strong> ${acDisplay}</p>`;

    html += `<p><strong>Speed:</strong> ${pc.vtt_data?.attributes?.movement?.walk || pc.system?.attributes?.movement?.walk || 0} ft</p>`;
    let initiativeBonus = 'N/A';
    const initAbility = pc.vtt_data?.attributes?.init?.ability;
    const dexValue = pc.vtt_data?.abilities?.dex?.value;

    if (initAbility && pc.vtt_data?.abilities?.[initAbility]) {
        initiativeBonus = getAbilityModifier(pc.vtt_data.abilities[initAbility].value || 10);
    } else if (pc.vtt_data?.attributes?.init?.bonus !== undefined && pc.vtt_data.attributes.init.bonus !== "") {
        initiativeBonus = pc.vtt_data.attributes.init.bonus;
    } else if (dexValue !== undefined) {
        initiativeBonus = getAbilityModifier(dexValue);
    }
    html += `<p><strong>Initiative:</strong> ${initiativeBonus >= 0 ? '+' : ''}${initiativeBonus}</p>`;
    html += `<p><strong>Proficiency Bonus:</strong> +${pc.calculatedProfBonus}</p></div></div>`;

    // Ability Scores & Saves
    html += `<div class="pc-section"><h4>Ability Scores & Saves</h4><table class="detailed-pc-table"><thead><tr><th>Ability</th><th>Score</th><th>Mod</th><th>Save</th></tr></thead><tbody>`;
    const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    abilities.forEach(abl => {
        const score = pc.vtt_data?.abilities?.[abl]?.value || 10;
        const mod = getAbilityModifier(score);
        const proficient = pc.vtt_data?.abilities?.[abl]?.proficient === 1;
        const saveBonus = savingThrowBonus(score, proficient, pc.calculatedProfBonus);
        html += `<tr><td>${abl.toUpperCase()}</td><td>${score}</td><td>${mod >= 0 ? '+' : ''}${mod}</td><td>${saveBonus >= 0 ? '+' : ''}${saveBonus}${proficient ? ' <abbr title="Proficient">(P)</abbr>' : ''}</td></tr>`;
    });
    html += `</tbody></table></div>`;

    // Skills
    html += `<div class="pc-section"><h4>Skills</h4><table class="detailed-pc-table"><thead><tr><th>Skill</th><th>Mod</th><th>Bonus</th></tr></thead><tbody>`;
    const skillNameMap = {
        "acr": "Acrobatics (Dex)", "ani": "Animal Handling (Wis)", "arc": "Arcana (Int)", "ath": "Athletics (Str)",
        "dec": "Deception (Cha)", "his": "History (Int)", "ins": "Insight (Wis)", "itm": "Intimidation (Cha)",
        "inv": "Investigation (Int)", "med": "Medicine (Wis)", "nat": "Nature (Int)", "prc": "Perception (Wis)",
        "prf": "Performance (Cha)", "per": "Persuasion (Cha)", "rel": "Religion (Int)", "slt": "Sleight of Hand (Dex)",
        "ste": "Stealth (Dex)", "sur": "Survival (Wis)"
    };
    for (const skillKey in skillNameMap) {
        const skillData = pc.vtt_data?.skills?.[skillKey];
        const skillDisplayName = skillNameMap[skillKey];
        const defaultAbilityAbbrevMatch = skillDisplayName.match(/\(([^)]+)\)/);
        const defaultAbilityAbbrev = defaultAbilityAbbrevMatch ? defaultAbilityAbbrevMatch[1].toLowerCase() : 'int'; 
        const abilityKey = skillData?.ability || defaultAbilityAbbrev;
        const score = pc.vtt_data?.abilities?.[abilityKey]?.value || 10;
        const proficiencyValue = skillData?.value || 0; 
        const bonus = calculateSkillBonus(score, proficiencyValue, pc.calculatedProfBonus);
        let profMarker = "";
        if (proficiencyValue === 1) profMarker = " <abbr title='Proficient'>(P)</abbr>";
        else if (proficiencyValue === 2) profMarker = " <abbr title='Expertise'>(E)</abbr>";
        else if (proficiencyValue === 0.5) profMarker = " <abbr title='Half-Proficiency'>(H)</abbr>";

        html += `<tr><td>${skillDisplayName}</td><td>${getAbilityModifier(score) >=0 ? '+' : ''}${getAbilityModifier(score)}</td><td>${bonus >= 0 ? '+' : ''}${bonus}${profMarker}</td></tr>`;
    }
    html += `</tbody></table></div>`;

    // Weapons
    html += `<div class="pc-section"><h4>Weapons & Attacks</h4>`;
    const weapons = pc.items?.filter(item => item.type === 'weapon') || [];
    if (weapons.length > 0) {
        html += `<ul>`;
        weapons.forEach(w => {
            let attackBonusStr = "N/A";
            let damageStr = "N/A";
            const weaponSystem = w.system || {};

            let ablMod = 0;
            let isProficient = weaponSystem.proficient === 1 || weaponSystem.proficient === undefined; 

            if (weaponSystem.ability) {
                ablMod = getAbilityModifier(pc.vtt_data?.abilities?.[weaponSystem.ability]?.value || 10);
            } else if (weaponSystem.properties?.includes('fin')) {
                const strMod = getAbilityModifier(pc.vtt_data?.abilities?.str?.value || 10);
                const dexMod = getAbilityModifier(pc.vtt_data?.abilities?.dex?.value || 10);
                ablMod = Math.max(strMod, dexMod);
            } else if (weaponSystem.type?.value?.includes('R') || weaponSystem.properties?.includes('thr')) {
                if (weaponSystem.properties?.includes('thr') && !weaponSystem.properties?.includes('fin')) {
                     ablMod = getAbilityModifier(pc.vtt_data?.abilities?.str?.value || 10);
                } else {
                     ablMod = getAbilityModifier(pc.vtt_data?.abilities?.dex?.value || 10);
                }
            } else {
                ablMod = getAbilityModifier(pc.vtt_data?.abilities?.str?.value || 10);
            }

            attackBonusStr = isProficient ? (ablMod + pc.calculatedProfBonus) : ablMod;
            attackBonusStr = `${attackBonusStr >= 0 ? '+' : ''}${attackBonusStr}`;

            if (weaponSystem.damage?.parts?.length > 0) {
                const part = weaponSystem.damage.parts[0];
                let dmgBonus = ablMod;
                if (part.bonus && String(part.bonus).trim() !== "") dmgBonus = parseInt(part.bonus) || 0;
                damageStr = `${part.number || '1'}d${part.denomination || '?'} ${dmgBonus >= 0 ? '+' : ''}${dmgBonus} ${part.types?.join('/') || part.type || 'damage'}`;
            } else if (weaponSystem.damage?.base) { 
                 damageStr = `${weaponSystem.damage.base.number || '1'}d${weaponSystem.damage.base.denomination || '?'} ${weaponSystem.damage.base.bonus || ''} ${weaponSystem.damage.base.types?.join('/') || ''}`;
            }
            html += `<li><strong>${w.name}:</strong> Attack ${attackBonusStr}, Damage: ${damageStr} <i>(${(weaponSystem.properties || []).join(', ')})</i></li>`;
        });
        html += `</ul>`;
    } else {
        html += `<p>No weapons listed.</p>`;
    }
    html += `</div>`;


    // Spells
    html += `<div class="pc-section"><h4>Spells</h4>`;
    const spells = pc.items?.filter(item => item.type === 'spell') || [];
    const spellcastingAbilityKey = pc.system?.attributes?.spellcasting || pc.vtt_data?.attributes?.spellcasting;
    if (spellcastingAbilityKey && spells.length > 0) {
        const castingScore = pc.vtt_data?.abilities?.[spellcastingAbilityKey]?.value || 10;
        html += `<p><strong>Spellcasting Ability:</strong> ${spellcastingAbilityKey.toUpperCase()}</p>`;
        html += `<p><strong>Spell Save DC:</strong> ${spellSaveDC(castingScore, pc.calculatedProfBonus)}</p>`;
        html += `<p><strong>Spell Attack Bonus:</strong> +${spellAttackBonus(castingScore, pc.calculatedProfBonus)}</p>`;

        const spellsByLevel = {};
        spells.forEach(s => {
            const level = s.system?.level === 0 ? "Cantrips" : `Level ${s.system?.level}`;
            if (!spellsByLevel[level]) spellsByLevel[level] = [];
            spellsByLevel[level].push(s.name);
        });

        const spellLevels = Object.keys(spellsByLevel).sort((a, b) => {
            if (a === "Cantrips") return -1;
            if (b === "Cantrips") return 1;
            return parseInt(a.replace("Level ", "")) - parseInt(b.replace("Level ", ""));
        });

        spellLevels.forEach(level => {
             html += `<p><strong>${level}:</strong> ${spellsByLevel[level].join(', ')}</p>`;
        });

    } else {
        html += `<p>No spells listed or not a primary spellcaster.</p>`;
    }
    html += `</div>`;

    // Inventory & Currency
    html += `<div class="pc-section"><h4>Inventory & Currency</h4>`;
    const inventoryItems = pc.items?.filter(item => !['weapon', 'spell', 'feat', 'class', 'race', 'background'].includes(item.type)) || [];
    if (inventoryItems.length > 0) {
        html += `<p><strong>Notable Items:</strong></p><ul>`;
        inventoryItems.forEach(item => {
            html += `<li>${item.name} ${item.system?.quantity > 1 ? `(x${item.system.quantity})` : ''}</li>`;
        });
        html += `</ul>`;
    } else {
        html += `<p>Inventory appears empty or not detailed.</p>`;
    }
    html += `<p><strong>Currency:</strong> `;
    const currency = pc.system?.currency || pc.vtt_data?.currency;
    let currencyString = [];
    if(currency?.gp) currencyString.push(`${currency.gp} GP`);
    if(currency?.sp) currencyString.push(`${currency.sp} SP`);
    if(currency?.cp) currencyString.push(`${currency.cp} CP`);
    if(currency?.ep) currencyString.push(`${currency.ep} EP`);
    if(currency?.pp) currencyString.push(`${currency.pp} PP`);
    html += currencyString.length > 0 ? currencyString.join(', ') : 'None';
    html += `</p></div>`;

    // Details (Biography, Personality, etc.)
    html += `<div class="pc-section"><h4>Details & Notes</h4>`;
    const details = pc.system?.details || pc.vtt_data?.details;
    if(details?.biography?.value) html += `<p><strong>Biography:</strong><br>${details.biography.value.replace(/<p>/g, '').replace(/<\/p>/g, '<br>')}</p>`;
    if(details?.trait) html += `<p><strong>Personality Traits:</strong> ${details.trait}</p>`;
    if(details?.ideal) html += `<p><strong>Ideals:</strong> ${details.ideal}</p>`;
    if(details?.bond) html += `<p><strong>Bonds:</strong> ${details.bond}</p>`;
    if(details?.flaw) html += `<p><strong>Flaws:</strong> ${details.flaw}</p>`;
    if(pc.description && pc.description !== pc.name) html += `<p><strong>Description:</strong> ${pc.description}</p>`;
    html += `</div>`;

    html += `</div>`; // end detailed-pc-sheet
    dashboardContent.innerHTML = html;
}


// --- Memory Management Functions ---

function renderMemories(memories = []) {
    const listElement = getElem('character-memories-list');
    if (!listElement) {
        console.error("renderMemories: 'character-memories-list' element not found.");
        return;
    }
    listElement.innerHTML = '';

    if (!memories || memories.length === 0) {
        listElement.innerHTML = '<p><em>No memories recorded for this NPC yet.</em></p>';
        return;
    }

    const ul = document.createElement('ul');
    memories.forEach(memory => {
        const li = document.createElement('li');
        li.className = 'memory-item';

        let memoryTimestamp = 'N/A';
        if (memory.timestamp) {
            if (typeof memory.timestamp === 'object' && memory.timestamp.$date) {
                memoryTimestamp = new Date(memory.timestamp.$date).toLocaleString();
            } else {
                memoryTimestamp = new Date(memory.timestamp).toLocaleString();
            }
        }

        li.innerHTML = `<span><strong>${memory.type || 'Generic'}:</strong> ${memory.content || 'No content'}
                        <br><small><em>(ID: ${memory.memory_id}, Source: ${memory.source || 'Unknown'}, Time: ${memoryTimestamp})</em></small></span>`;

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => deleteMemory(memory.memory_id);
        li.appendChild(deleteBtn);
        ul.appendChild(li);
    });
    listElement.appendChild(ul);
}

async function addMemoryToCharacter() {
    if (!currentProfileCharId) {
        alert("No character selected in profile to add memory to.");
        return;
    }
    const selectedCharacter = allCharacters.find(c => String(c._id) === String(currentProfileCharId));
    if (!selectedCharacter || selectedCharacter.character_type !== 'NPC') {
        alert("Memories can only be added to NPCs.");
        return;
    }

    const content = getElem('new-memory-content').value.trim();
    const type = getElem('new-memory-type').value.trim() || 'generic';

    if (!content) {
        alert("Memory content cannot be empty.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/npcs/${currentProfileCharId}/memory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: content, type: type, source: 'manual_gm_entry' })
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || `Failed to add memory. Status: ${response.status}`);
        }
        const charIndex = allCharacters.findIndex(c => String(c._id) === String(currentProfileCharId));
        if (charIndex > -1) {
            allCharacters[charIndex].memories = result.updated_memories;
        }
        renderMemories(result.updated_memories || []);
        getElem('new-memory-content').value = '';
        getElem('new-memory-type').value = '';
        alert(result.message || "Memory added successfully.");
    } catch (error) {
        console.error("Error adding memory:", error);
        alert(`Error: ${error.message}`);
    }
}

async function deleteMemory(memoryId) {
    if (!currentProfileCharId) {
        alert("No character selected for memory deletion.");
        return;
    }
    if (!confirm(`Are you sure you want to delete memory ID: ${memoryId}?`)) {
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/api/npcs/${currentProfileCharId}/memory/${memoryId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || `Failed to delete memory. Status: ${response.status}`);
        }
         const charIndex = allCharacters.findIndex(c => String(c._id) === String(currentProfileCharId));
        if (charIndex > -1) {
            allCharacters[charIndex].memories = result.updated_memories;
        }
        renderMemories(result.updated_memories || []);
        alert(result.message || "Memory deleted successfully.");
    } catch (error) {
        console.error("Error deleting memory:", error);
        alert(`Error: ${error.message}`);
    }
}

// --- Dialogue Management Functions ---

async function generateDialogue() {
    const playerUtterance = getElem('player-utterance').value.trim();
    const sceneContext = getElem('scene-context').value.trim();

    if (activeSceneNpcIds.size === 0) {
        alert("Please select at least one NPC to send dialogue to.");
        return;
    }

    disableBtn('generate-dialogue-btn', true);

    for (const npcIdStr of activeSceneNpcIds) {
        const npc = allCharacters.find(c => String(c._id) === npcIdStr);
        if (!npc) continue;

        const transcriptArea = getElem(`transcript-${npcIdStr}`);
        if (!transcriptArea) {
            console.error(`Transcript area for NPC ID ${npcIdStr} not found.`);
            continue;
        }

        if (playerUtterance) {
            const playerEntry = document.createElement('p');
            playerEntry.className = 'dialogue-entry player-utterance';
            playerEntry.textContent = `Player: ${playerUtterance}`;
            transcriptArea.appendChild(playerEntry);
            if (!dialogueHistories[npcIdStr]) dialogueHistories[npcIdStr] = [];
            dialogueHistories[npcIdStr].push(`Player: ${playerUtterance}`);
        }
        transcriptArea.scrollTop = transcriptArea.scrollHeight;

        const dialogueRequestPayload = {
            scene_context: sceneContext,
            player_utterance: playerUtterance,
            active_pcs: Array.from(activePcIds).map(pcId => {
                const pc = allCharacters.find(c => String(c._id) === pcId);
                return pc ? pc.name : "Unknown PC";
            }),
            recent_dialogue_history: (dialogueHistories[npcIdStr] || []).slice(-5)
        };

        try {
            const response = await fetch(`${API_BASE_URL}/api/npcs/${npcIdStr}/dialogue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dialogueRequestPayload)
            });

            const result = await response.json();

            if (!response.ok) {
                const errorMsg = result.error || `Dialogue generation failed for ${npc.name}. Status: ${response.status}`;
                console.error(errorMsg, result.details || '');
                const npcErrorEntry = document.createElement('p');
                npcErrorEntry.className = 'dialogue-entry npc-response';
                npcErrorEntry.textContent = `${npc.name}: (Error: ${errorMsg})`;
                transcriptArea.appendChild(npcErrorEntry);
                if (dialogueHistories[npcIdStr]) {
                    dialogueHistories[npcIdStr].push(`${npc.name}: (Error: ${errorMsg})`);
                }
            } else {
                const npcResponseEntry = document.createElement('p');
                npcResponseEntry.className = 'dialogue-entry npc-response';
                npcResponseEntry.textContent = `${npc.name}: ${result.npc_dialogue}`;
                transcriptArea.appendChild(npcResponseEntry);
                if (dialogueHistories[npcIdStr]) {
                    dialogueHistories[npcIdStr].push(`${npc.name}: ${result.npc_dialogue}`);
                }
                renderAiSuggestions(result.new_memory_suggestions, result.generated_topics, npcIdStr);
            }
            transcriptArea.scrollTop = transcriptArea.scrollHeight;

        } catch (error) {
            console.error(`Error generating dialogue for ${npc.name}:`, error);
            const npcErrorEntry = document.createElement('p');
            npcErrorEntry.className = 'dialogue-entry npc-response';
            npcErrorEntry.textContent = `${npc.name}: (Network error or server issue)`;
            transcriptArea.appendChild(npcErrorEntry);
             if (dialogueHistories[npcIdStr]) {
                dialogueHistories[npcIdStr].push(`${npc.name}: (Network error or server issue)`);
            }
            transcriptArea.scrollTop = transcriptArea.scrollHeight;
        }
    }

    const playerUtteranceElem = getElem('player-utterance');
    if (playerUtteranceElem) playerUtteranceElem.value = '';
    disableBtn('generate-dialogue-btn', activeSceneNpcIds.size === 0);
}


function renderAiSuggestions(memorySuggestions = [], topicSuggestions = [], forNpcId) {
    const memoryListElem = getElem('suggested-memories-list');
    const topicListElem = getElem('suggested-topics-list');
    if (!memoryListElem || !topicListElem) return;

    if (activeSceneNpcIds.size === 1 && activeSceneNpcIds.has(forNpcId)) {
        memoryListElem.innerHTML = '<h5>Suggested Memories:</h5>';
        topicListElem.innerHTML = '<h5>Suggested Topics:</h5>';

        if (memorySuggestions.length === 0) {
            memoryListElem.innerHTML += '<p><em>None yet.</em></p>';
        } else {
            memorySuggestions.forEach(memText => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'suggested-item';
                itemDiv.textContent = memText;
                const addButton = document.createElement('button');
                addButton.textContent = 'Add as Memory';
                addButton.onclick = () => {
                    const newMemContentElem = getElem('new-memory-content');
                    const newMemTypeElem = getElem('new-memory-type');
                    if (newMemContentElem) newMemContentElem.value = memText;
                    if (newMemTypeElem) newMemTypeElem.value = 'dialogue_summary';
                    if (currentProfileCharId === forNpcId) {
                       addMemoryToCharacter();
                    } else {
                        alert(`Memory suggestion for ${allCharacters.find(c=>String(c._id) === forNpcId)?.name || 'NPC'}. Switch profile to add or copy manually.`);
                    }
                };
                itemDiv.appendChild(addButton);
                memoryListElem.appendChild(itemDiv);
            });
        }

        if (topicSuggestions.length === 0) {
            topicListElem.innerHTML += '<p><em>None yet.</em></p>';
        } else {
            topicSuggestions.forEach(topicText => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'suggested-item clickable-suggestion';
                itemDiv.textContent = topicText;
                itemDiv.onclick = () => {
                    const playerUtteranceElem = getElem('player-utterance');
                    if(playerUtteranceElem) playerUtteranceElem.value = topicText;
                };
                topicListElem.appendChild(itemDiv);
            });
        }
    } else if (activeSceneNpcIds.size > 1) {
        memoryListElem.innerHTML = '<h5>Suggested Memories:</h5><p><em>(Suggestions shown for single active NPC)</em></p>';
        topicListElem.innerHTML = '<h5>Suggested Topics:</h5><p><em>(Suggestions shown for single active NPC)</em></p>';
    } else {
         memoryListElem.innerHTML = '';
         topicListElem.innerHTML = '';
    }
}

// --- Character Creation and GM Notes Functions ---

async function saveGMNotes() {
    if (!currentProfileCharId) {
        alert("No character selected to save notes for.");
        return;
    }
    const notes = getElem('gm-notes').value;
    try {
        const response = await fetch(`${API_BASE_URL}/api/npcs/${currentProfileCharId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gm_notes: notes })
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || `Failed to save GM notes. Status: ${response.status}`);
        }
        const charIndex = allCharacters.findIndex(c => String(c._id) === String(currentProfileCharId));
        if (charIndex > -1) {
            allCharacters[charIndex].gm_notes = notes;
        }
        alert("GM Notes saved successfully.");
    } catch (error) {
        console.error("Error saving GM notes:", error);
        alert(`Error: ${error.message}`);
    }
}

async function createCharacter() {
    const name = getElem('new-char-name').value.trim();
    const description = getElem('new-char-description').value.trim();
    const personality = getElem('new-char-personality').value.split(',').map(s => s.trim()).filter(s => s);
    const charType = getElem('new-char-type').value;

    if (!name || !description) {
        alert("Name and Description are required to create a character.");
        return;
    }

    const newCharData = {
        name,
        description,
        personality_traits: personality.length > 0 ? personality : ["Default trait"],
        character_type: charType,
        race: "Unknown",
        class_str: "Commoner",
        memories: [],
        associated_history_files: [],
        vtt_data: {}, // Ensure these are present for new characters
        vtt_flags: {},
        items: [],
        system: {}
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/npcs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newCharData)
        });
        const result = await response.json();
        if (!response.ok) {
            let errorDetails = "";
            if (result.details) {
                errorDetails = result.details.map(d => `${d.loc.join('.')}: ${d.msg}`).join('; ');
            }
            throw new Error(result.error + (errorDetails ? ` (${errorDetails})` : '') || `Failed to create character. Status: ${response.status}`);
        }

        let createdChar = result.character;
         if (createdChar._id && typeof createdChar._id === 'object' && createdChar._id.$oid) {
            createdChar._id = createdChar._id.$oid;
        }
        // Ensure new char has default structures for safety
        createdChar.vtt_data = createdChar.vtt_data || {};
        createdChar.vtt_flags = createdChar.vtt_flags || {};
        createdChar.items = createdChar.items || [];
        createdChar.system = createdChar.system || {};

        allCharacters.push(createdChar);

        getElem('new-char-name').value = '';
        getElem('new-char-description').value = '';
        getElem('new-char-personality').value = '';

        renderNpcListForScene();
        renderPcList();
        alert(`${charType} "${name}" created successfully!`);

    } catch (error) {
        console.error("Error creating character:", error);
        alert(`Error: ${error.message}`);
    }
}


// --- Event Listeners & Initial Setup ---
console.log("script.js: File execution started.");

document.addEventListener('DOMContentLoaded', () => {
    console.log("script.js: DOMContentLoaded event fired.");

    try {
        console.log("script.js: DOMContentLoaded - Attempting to call fetchCharacters().");
        fetchCharacters();
        console.log("script.js: DOMContentLoaded - Attempting to call fetchHistoryFiles().");
        fetchHistoryFiles();
    } catch (e) {
        console.error("script.js: DOMContentLoaded - Error during initial fetch calls:", e);
    }

    console.log("script.js: DOMContentLoaded - Setting up resizer logic.");
    const leftColumn = getElem('left-column');
    const resizer = getElem('resizer');
    const centerColumn = getElem('center-column');

    if (leftColumn && resizer && centerColumn) {
        let isResizing = false;
        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', () => {
                isResizing = false;
                document.removeEventListener('mousemove', handleMouseMove);
            });
        });

        function handleMouseMove(e) {
            if (!isResizing) return;
            const newLeftWidth = e.clientX;
            if (newLeftWidth > 250 && newLeftWidth < (window.innerWidth - 250)) {
                leftColumn.style.width = `${newLeftWidth}px`;
            }
        }
    } else {
        console.warn("script.js: DOMContentLoaded - One or more resizer elements not found (left-column, resizer, or center-column).");
    }
    console.log("script.js: DOMContentLoaded - Finished resizer logic setup.");

    console.log("script.js: DOMContentLoaded - Setting up collapsible sections.");
    document.querySelectorAll('.collapsible-section h3').forEach(header => {
        header.addEventListener('click', () => {
            const section = header.parentElement;
            if (section) {
                section.classList.toggle('collapsed');
            } else {
                console.warn("Collapsible header's parentElement is null:", header);
            }
        });
        if (!header.closest('#character-profile-main-section') &&
            !header.closest('#pc-list-section') &&
            !header.closest('#npc-list-section') &&
            header.parentElement) {
            header.parentElement.classList.add('collapsed');
        }
    });
    console.log("script.js: DOMContentLoaded - Finished collapsible sections setup.");

    // ADD THIS BLOCK FOR DELEGATED EVENT LISTENING
    const pcDashboardContentForDelegation = getElem('pc-dashboard-content');
    if (pcDashboardContentForDelegation) {
        console.log("DEBUG: Attaching DELEGATED click listener to pc-dashboard-content.");
        pcDashboardContentForDelegation.addEventListener('click', function(event) {
            console.log('DEBUG (Delegated Listener on #pc-dashboard-content): Click detected. Target:', event.target);
            const clickedCard = event.target.closest('.clickable-pc-card'); // Check if the click was on or inside a card

            if (clickedCard) {
                console.log('DEBUG (Delegated Listener): >>> CLICK WAS ON A .clickable-pc-card <<< PC ID:', clickedCard.dataset.pcId);
                alert(`Card clicked (Delegated Listener): ${clickedCard.dataset.pcId}`);
                
                const pcIdToRender = clickedCard.dataset.pcId;
                if (pcIdToRender) {
                    renderDetailedPcSheet(pcIdToRender);
                } else {
                    console.error("DEBUG (Delegated Listener): Clicked card found, but data-pc-id is missing or undefined.");
                }
            } else {
                console.log('DEBUG (Delegated Listener): Click was inside #pc-dashboard-content, but NOT on a .clickable-pc-card.');
            }
        });
    } else {
        console.error("DEBUG: Crucial element #pc-dashboard-content not found for attaching delegated listener.");
    }
    // END OF ADDED BLOCK

    console.log("script.js: DOMContentLoaded - Calling updateView().");
    updateView();
    console.log("script.js: DOMContentLoaded - updateView() called.");
});

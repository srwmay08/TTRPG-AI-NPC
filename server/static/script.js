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
function updateText(id, text) { getElem(id).textContent = text; }
function disableBtn(id, disabled) { getElem(id).disabled = disabled; }

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
    if (skillProficiencyValue === 1) { 
        skillBonus += proficiencyBonus;
    } else if (skillProficiencyValue === 2) {
        skillBonus += (proficiencyBonus * 2);
    } else if (skillProficiencyValue === 0.5) { 
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
    try {
        const response = await fetch(`${API_BASE_URL}/api/npcs`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const charactersFromServer = await response.json();
        // Ensure all _id fields are strings for consistent handling in JS
        allCharacters = charactersFromServer.map(char => {
            if (char._id && typeof char._id === 'object' && char._id.$oid) {
                char._id = char._id.$oid;
            }
            // Ensure combined_history_content exists
            if (char.combined_history_content === undefined) {
                char.combined_history_content = ""; // Default to empty string
            }
            return char;
        });
        console.log("Fetched allCharacters, IDs ensured to be strings:", allCharacters.map(c => ({id: c._id, name: c.name, history: c.combined_history_content !== undefined})));
        renderNpcListForScene(); 
        renderPcList();
        updateView(); 
    } catch (error) { 
        console.error('Error in fetchCharacters:', error); 
        getElem('character-list').innerHTML = '<ul><li><em>Error loading NPCs. Check console.</em></li></ul>';
        getElem('active-pc-list').innerHTML = '<p><em>Error loading PCs. Check console.</em></p>';
    }
}

function renderNpcListForScene() {
    const listContainer = getElem('character-list'); 
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
        const charIdStr = String(char._id); // Ensure ID is string for dataset and comparisons
        const li = document.createElement('li');
        li.dataset.charId = charIdStr;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `npc-scene-checkbox-${charIdStr}`;
        checkbox.checked = activeSceneNpcIds.has(charIdStr); // Compare string IDs
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

function toggleNpcInScene(npcIdStr, npcName) { // Ensure npcIdStr is a string
    const multiNpcContainer = getElem('multi-npc-dialogue-container');
    if (activeSceneNpcIds.has(npcIdStr)) {
        activeSceneNpcIds.delete(npcIdStr);
        removeNpcDialogueArea(npcIdStr);
        delete dialogueHistories[npcIdStr]; 
    } else {
        activeSceneNpcIds.add(npcIdStr);
        createNpcDialogueArea(npcIdStr, npcName);
        dialogueHistories[npcIdStr] = []; 
    }
    
    if (activeSceneNpcIds.size >= 1 && multiNpcContainer.querySelector('p.scene-event')) {
        multiNpcContainer.innerHTML = ''; 
        activeSceneNpcIds.forEach(id => { 
             const npc = allCharacters.find(c=> String(c._id) === String(id)); // Ensure string comparison
             if(npc && !getElem(`npc-area-${id}`)) { 
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

function createNpcDialogueArea(npcIdStr, npcName) { // Ensure npcIdStr is string
    const container = getElem('multi-npc-dialogue-container');
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
}

function removeNpcDialogueArea(npcIdStr) { // Ensure npcIdStr is string
    const areaDiv = getElem(`npc-area-${npcIdStr}`);
    if (areaDiv) {
        areaDiv.remove();
    }
    const container = getElem('multi-npc-dialogue-container');
    if (activeSceneNpcIds.size === 0 && !container.querySelector('p.scene-event')) {
         container.innerHTML = '<p class="scene-event">Select NPCs to add them to the scene.</p>';
    }
}

function renderPcList() {
    const pcListDiv = getElem('active-pc-list');
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
            getElem('multi-npc-dialogue-container').innerHTML = '<p class="scene-event">Select NPCs to add them to the scene.</p>';
            renderNpcListForScene(); 
            disableBtn('generate-dialogue-btn', true);

            togglePcSelection(pcIdStr, li); 
            
            await selectCharacterForDetails(pcIdStr); 
            
            updateView();
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
    const selectElement = getElem('history-file-select');
    selectElement.innerHTML = '<option value="">-- Select a history file --</option>'; 
    try {
        const response = await fetch(`${API_BASE_URL}/api/history_files`);
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
    } catch (error) {
        console.error("Error in fetchHistoryFiles function:", error.message, error);
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
    if (character && character.combined_history_content) { 
        historyContentDisplay.textContent = character.combined_history_content;
    } else if (character && character.associated_history_files && character.associated_history_files.length > 0) {
        historyContentDisplay.textContent = "History files are associated, but content appears empty or wasn't loaded.";
    } else {
        historyContentDisplay.textContent = "No history content. Associate files to view their content.";
    }
}

async function selectCharacterForDetails(charIdStr) { 
    console.log("Fetching details for character ID:", charIdStr);
    currentProfileCharId = charIdStr; 
    try {
        const response = await fetch(`${API_BASE_URL}/api/npcs/${charIdStr}`);
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
        if (selectedChar.combined_history_content === undefined) { // Ensure this field exists
            selectedChar.combined_history_content = "";
        }
        console.log("Fetched character details (ID as string):", selectedChar);
        
        const charIndex = allCharacters.findIndex(c => String(c._id) === charIdStr); 
        if (charIndex > -1) {
            allCharacters[charIndex] = selectedChar; 
        } else {
            allCharacters.push(selectedChar); 
            console.warn("Fetched character was not found in allCharacters, pushed new.", charIdStr);
        }

        updateText('details-char-name', selectedChar.name || "N/A"); 
        updateText('profile-char-type', selectedChar.character_type || "N/A");
        updateText('profile-description', selectedChar.description || "N/A");
        updateText('profile-personality', (selectedChar.personality_traits || []).join(', ') || "N/A");
        
        getElem('gm-notes').value = selectedChar.gm_notes || '';
        disableBtn('save-gm-notes-btn', false);

        const isNpc = selectedChar.character_type === 'NPC';
        getElem('npc-memories-collapsible-section').style.display = isNpc ? 'block' : 'none';
        getElem('character-history-collapsible-section').style.display = 'block'; 
        
        if (isNpc) {
            renderMemories(selectedChar.memories || []);
            disableBtn('add-memory-btn', false);
        } else { 
            disableBtn('add-memory-btn', true);
            getElem('character-memories-list').innerHTML = '<p><em>Memories are typically managed for NPCs.</em></p>';
        }
        
        renderAssociatedHistoryFiles(selectedChar); 
        await fetchHistoryFiles(); 
        disableBtn('associate-history-btn', false);
    } catch (error) {
        console.error("Error in selectCharacterForDetails:", error);
        currentProfileCharId = null;
        updateText('details-char-name', "Error");
        getElem('profile-char-type').textContent = 'Error';
        getElem('profile-description').textContent = 'Error loading details.';
        getElem('profile-personality').textContent = 'Error';
        getElem('history-content-display').textContent = "Error loading character details.";
        getElem('associated-history-list').innerHTML = '<li><em>Error loading.</em></li>';
        disableBtn('save-gm-notes-btn', true);
        disableBtn('add-memory-btn', true);
        disableBtn('associate-history-btn', true);
    }
}

function togglePcSelection(pcIdStr, element) { 
    console.log("Toggling PC selection for:", pcIdStr, "Current activePcIds:", new Set(activePcIds));
    if (activePcIds.has(pcIdStr)) {
        activePcIds.delete(pcIdStr);
        element.classList.remove('selected');
        console.log("Removed. New activePcIds:", new Set(activePcIds));
    } else {
        activePcIds.add(pcIdStr);
        element.classList.add('selected');
        console.log("Added. New activePcIds:", new Set(activePcIds));
    }
    if(getElem('pc-dashboard-view').style.display !== 'none') { 
        updatePcDashboard(); 
    }
}

function updateView() {
    const dialogueInterface = getElem('dialogue-interface');
    const pcDashboardView = getElem('pc-dashboard-view');
    
    if (activeSceneNpcIds.size > 0) { 
        dialogueInterface.style.display = 'flex'; 
        pcDashboardView.style.display = 'none';
        // Collapse any expanded PC dashboard sections
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
    } else { 
        dialogueInterface.style.display = 'none';
        pcDashboardView.style.display = 'block';
        updatePcDashboard(); 
    }
}

function updatePcDashboard() {
    console.log("Updating PC Dashboard. Active PC IDs:", new Set(activePcIds));
    const dashboardContent = getElem('pc-dashboard-content');
    dashboardContent.innerHTML = ''; 

    const selectedPcs = allCharacters.filter(char => 
        activePcIds.has(String(char._id)) && char.character_type === 'PC' && char.vtt_data
    );
    console.log("Selected PCs for dashboard:", selectedPcs.map(p => ({name: p.name, id: p._id, vtt: !!p.vtt_data }) ));


    if (selectedPcs.length === 0) {
        const anyPcsExist = allCharacters.some(char => char.character_type === 'PC' && char.vtt_data);
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
            if (skillHeader && skillHeader.querySelector('span.arrow-indicator')) skillHeader.querySelector('span.arrow-indicator').textContent = ' ►';
            currentlyExpandedSkill = null;
        }
        return;
    }

    selectedPcs.forEach(pc => {
         const pcLevel = pc.flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || 1;
         pc.calculatedProfBonus = getProficiencyBonus(pcLevel);
    });

    let statCardsHTML = `<h4>PC Quick View</h4><div class="pc-dashboard-grid">`;
    const sortedSelectedPcsByName = [...selectedPcs].sort((a,b) => a.name.localeCompare(b.name));
    sortedSelectedPcsByName.forEach(pc => {
        const pcLevel = pc.flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || 1;
        statCardsHTML += `<div class="pc-stat-card"><h4>${pc.name} (Lvl ${pcLevel})</h4>`;
        const hpCurrent = pc.vtt_data.attributes.hp?.value !== undefined ? pc.vtt_data.attributes.hp.value : 'N/A';
        const hpMax = pc.vtt_data.attributes.hp?.max !== undefined && pc.vtt_data.attributes.hp.max !== null ? pc.vtt_data.attributes.hp.max : 'N/A';
        statCardsHTML += `<p><strong>HP:</strong> ${hpCurrent} / ${hpMax}</p>`;
        
        let acDisplay = pc.flags?.ddbimporter?.overrideAC?.flat; 
        if (acDisplay === undefined || acDisplay === null) {
            acDisplay = pc.vtt_data.attributes.ac?.value;
        }
        if (acDisplay === undefined || acDisplay === null) {
            acDisplay = pc.vtt_data.attributes.ac?.flat;
        }
        if (acDisplay === undefined || acDisplay === null) {
            acDisplay = 'N/A';
        }
        statCardsHTML += `<p><strong>AC:</strong> ${acDisplay}</p>`;
        
        let passivePercFormatted = 'N/A';
        const wisScoreForPassive = pc.vtt_data.abilities?.wis?.value;
        const percSkillInfo = pc.vtt_data.skills?.prc; 
        if (wisScoreForPassive !== undefined && percSkillInfo !== undefined) { 
            passivePercFormatted = calculatePassiveSkill(wisScoreForPassive, percSkillInfo.value || 0, pc.calculatedProfBonus);
        }
        statCardsHTML += `<p><strong>Pas. Perception:</strong> ${passivePercFormatted}</p>`;

        let passiveInvFormatted = 'N/A';
        const intScoreForPassive = pc.vtt_data.abilities?.int?.value;
        const invSkillInfo = pc.vtt_data.skills?.inv; 
        if (intScoreForPassive !== undefined && invSkillInfo !== undefined) { 
             passiveInvFormatted = calculatePassiveSkill(intScoreForPassive, invSkillInfo.value || 0, pc.calculatedProfBonus);
        }
        statCardsHTML += `<p><strong>Pas. Investigation:</strong> ${passiveInvFormatted}</p>`;
        statCardsHTML += `</div>`;
    });
    statCardsHTML += `</div>`; 
    dashboardContent.innerHTML += statCardsHTML;

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
            const score = pc.vtt_data.abilities[ablKey.toLowerCase()]?.value || 0;
            const mod = getAbilityModifier(score);
            mainStatsTableHTML += `<td>${score} (${mod >= 0 ? '+' : ''}${mod})</td>`;
        });
        mainStatsTableHTML += `</tr>`;
    });
    mainStatsTableHTML += `</tbody></table>`;
    const abilityExpansionContainer = document.createElement('div');
    abilityExpansionContainer.id = 'expanded-ability-details-sections';
    dashboardContent.innerHTML += mainStatsTableHTML; 
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
            const skillDataA = a.vtt_data.skills?.[skillSortKey];
            const abilityKeyA = skillDataA?.ability || (skillSortKey === 'ath' ? 'str' : ['acr', 'slt', 'ste'].includes(skillSortKey) ? 'dex' : ['arc', 'his', 'inv', 'nat', 'rel'].includes(skillSortKey) ? 'int' : ['ani', 'ins', 'med', 'prc', 'sur'].includes(skillSortKey) ? 'wis' : 'cha');
            const abilityScoreA = a.vtt_data.abilities[abilityKeyA]?.value || 10;
            const bonusA = skillDataA ? calculateSkillBonus(abilityScoreA, skillDataA.value || 0, a.calculatedProfBonus) : getAbilityModifier(abilityScoreA);

            const skillDataB = b.vtt_data.skills?.[skillSortKey];
            const abilityKeyB = skillDataB?.ability || (skillSortKey === 'ath' ? 'str' : ['acr', 'slt', 'ste'].includes(skillSortKey) ? 'dex' : ['arc', 'his', 'inv', 'nat', 'rel'].includes(skillSortKey) ? 'int' : ['ani', 'ins', 'med', 'prc', 'sur'].includes(skillSortKey) ? 'wis' : 'cha');
            const abilityScoreB = b.vtt_data.abilities[abilityKeyB]?.value || 10;
            const bonusB = skillDataB ? calculateSkillBonus(abilityScoreB, skillDataB.value || 0, b.calculatedProfBonus) : getAbilityModifier(abilityScoreB);
            
            return bonusB - bonusA; 
        });
    } else { 
         pcsForSkillTable.sort((a,b) => a.name.localeCompare(b.name));
    }

    pcsForSkillTable.forEach(pc => {
        skillsTableHTML += `<tr><td>${pc.name}</td>`;
        for (const skillKey in skillNameMap) {
            const skillData = pc.vtt_data.skills?.[skillKey];
            let skillBonusFormatted = "N/A";
            const defaultAbilityForSkill = (skillKey === 'ath' ? 'str' : ['acr', 'slt', 'ste'].includes(skillKey) ? 'dex' : ['arc', 'his', 'inv', 'nat', 'rel'].includes(skillKey) ? 'int' : ['ani', 'ins', 'med', 'prc', 'sur'].includes(skillKey) ? 'wis' : 'cha');
            const abilityKeyForSkill = skillData?.ability || defaultAbilityForSkill;

            if (pc.vtt_data.abilities[abilityKeyForSkill]) {
                const abilityScore = pc.vtt_data.abilities[abilityKeyForSkill]?.value || 10;
                const bonus = calculateSkillBonus(abilityScore, skillData?.value || 0, pc.calculatedProfBonus);
                skillBonusFormatted = `${bonus >= 0 ? '+' : ''}${bonus}`;
            }
            skillsTableHTML += `<td>${skillBonusFormatted}</td>`;
        }
        skillsTableHTML += `</tr>`;
    });
    skillsTableHTML += `</tbody></table>`;
    const skillExpansionContainer = document.createElement('div');
    skillExpansionContainer.id = 'expanded-skill-details-sections';
    dashboardContent.innerHTML += skillsTableHTML;
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
    updatePcDashboard(); 

    const allSkillHeaders = document.querySelectorAll(`#skills-overview-table th.clickable-skill-header`);
    allSkillHeaders.forEach(header => {
        const sKey = header.dataset.skillKey;
        const arrow = header.querySelector('span.arrow-indicator');
        const expDiv = document.getElementById(`expanded-skill-${sKey}`);
        if (expDiv && arrow) { 
            if (sKey === currentlyExpandedSkill) { 
                arrow.textContent = ' ▼';
                populateExpandedSkillDetails(sKey, expDiv, allCharacters.filter(char => activePcIds.has(String(char._id)) && char.character_type === 'PC' && char.vtt_data));
                expDiv.style.display = 'block';
            } else { 
                arrow.textContent = ' ►';
                expDiv.style.display = 'none';
            }
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
        const skillVttData = pc.vtt_data.skills?.[skillKey];
        const defaultAbilityForSkill = (skillKey === 'ath' ? 'str' : ['acr', 'slt', 'ste'].includes(skillKey) ? 'dex' : ['arc', 'his', 'inv', 'nat', 'rel'].includes(skillKey) ? 'int' : ['ani', 'ins', 'med', 'prc', 'sur'].includes(skillKey) ? 'wis' : 'cha');
        const baseAbilityKey = skillVttData?.ability || defaultAbilityForSkill;
        const baseAbilityScore = pc.vtt_data.abilities[baseAbilityKey]?.value || 10;
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
        const scoreA = a.vtt_data.abilities[lowerAblKey]?.value || 0;
        const scoreB = b.vtt_data.abilities[lowerAblKey]?.value || 0;
        return scoreB - scoreA;
    });

    let contentHTML = `<h5>${upperAblKey} Score Comparison</h5>`;
    contentHTML += `<div class="ability-bar-chart-container">`;
    sortedPcs.forEach(pc => {
        const score = pc.vtt_data.abilities[lowerAblKey]?.value || 0;
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

    // Ensure calculatedProfBonus is on the pc objects
    sortedPcs.forEach(pc => {
        if (pc.calculatedProfBonus === undefined) {
            const pcLevel = pc.flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || 1;
            pc.calculatedProfBonus = getProficiencyBonus(pcLevel);
        }
    });

    generalDerivedMetrics.forEach(metricName => {
        contentHTML += `<tr><th>${metricName}</th>`;
        sortedPcs.forEach(pc => {
            const score = pc.vtt_data.abilities[lowerAblKey]?.value || 0;
            const modifier = getAbilityModifier(score);
            const isSaveProficient = pc.vtt_data.abilities[lowerAblKey]?.proficient === 1;
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
                const wisScoreVal = pc.vtt_data.abilities.wis?.value || 0;
                const percSkillInfo = pc.vtt_data.skills?.prc;
                 if (wisScoreVal !== undefined && percSkillInfo !== undefined) {
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
            const score = pc.vtt_data.abilities.str?.value || 0; const mod = getAbilityModifier(score);
            contentHTML += `<tr><td>${pc.name}</td><td>${mod >= 0 ? '+' : ''}${mod}</td></tr>`;
        });
        contentHTML += `</tbody></table>`;
        contentHTML += `<h5>Lifting and Carrying</h5><table class="rules-explanation-table"><tr><td><strong>Carrying Capacity Rule:</strong> Your carrying capacity is your Strength score multiplied by 15. This is the weight (in pounds) that you can carry.</td></tr><tr><td><strong>Push, Drag, or Lift Rule:</strong> You can push, drag, or lift a weight in pounds up to twice your carrying capacity (or 30 times your Strength score). While pushing or dragging weight in excess of your carrying capacity, your speed drops to 5 feet.</td></tr><tr><td><strong>Size and Strength Rule:</strong> Larger creatures can bear more weight, whereas Tiny creatures can carry less. For each size category above Medium, double the creature’s carrying capacity and the amount it can push, drag, or lift. For a Tiny creature, halve these weights. (Calculations below account for this).</td></tr></table>`;
        contentHTML += `<table class="derived-stats-table"><thead><tr><th>Character</th><th>Size</th><th>Carrying Capacity (lbs)</th><th>Push/Drag/Lift (lbs)</th></tr></thead><tbody>`;
        sortedPcs.forEach(pc => {
            const score = pc.vtt_data.abilities.str?.value || 0; const size = pc.system?.traits?.size || 'med';
            let capMultiplier = 1; if (size === 'tiny') capMultiplier = 0.5; else if (size === 'lg') capMultiplier = 2; else if (size === 'huge') capMultiplier = 4; else if (size === 'grg') capMultiplier = 8;
            const baseCap = carryingCapacity(score); const actualCap = Math.floor(baseCap * capMultiplier); const pdl = actualCap * 2;
            const sizeMap = { 'tiny': 'Tiny', 'sm': 'Small', 'med': 'Medium', 'lg': 'Large', 'huge': 'Huge', 'grg': 'Gargantuan' };
            contentHTML += `<tr><td>${pc.name}</td><td>${sizeMap[size] || size}</td><td>${actualCap}</td><td>${pdl}</td></tr>`;
        });
        contentHTML += `</tbody></table>`;
        contentHTML += `<h5>Variant: Encumbrance</h5><table class="rules-explanation-table"><tr><td>(When you use this variant, ignore the Strength column of the Armor table.)</td></tr><tr><td><strong>Encumbered:</strong> If you carry weight in excess of 5 times your Strength score, you are encumbered, which means your speed drops by 10 feet.</td></tr><tr><td><strong>Heavily Encumbered:</strong> If you carry weight in excess of 10 times your Strength score, up to your maximum carrying capacity, you are instead heavily encumbered, which means your speed drops by 20 feet and you have disadvantage on ability checks, attack rolls, and saving throws that use Strength, Dexterity, or Constitution.</td></tr></table>`;
        contentHTML += `<table class="derived-stats-table"><thead><tr><th>Character</th><th>Encumbered At (> lbs)</th><th>Heavily Encumbered At (> lbs)</th></tr></thead><tbody>`;
        sortedPcs.forEach(pc => {
            const score = pc.vtt_data.abilities.str?.value || 0;
            contentHTML += `<tr><td>${pc.name}</td><td>${score * 5}</td><td>${score * 10}</td></tr>`;
        });
        contentHTML += `</tbody></table>`;
    } 
    else if (upperAblKey === 'DEX') {
        contentHTML += `<h5>Dexterity Checks</h5><table class="rules-explanation-table"><tr><td>A Dexterity check can model any attempt to move nimbly, quickly, or quietly, or to keep from falling on tricky footing. The Acrobatics, Sleight of Hand, and Stealth skills reflect aptitude in certain kinds of Dexterity checks.</td></tr></table>`;
        contentHTML += `<h5>Attack Rolls and Damage (Ranged/Finesse)</h5><table class="rules-explanation-table"><tr><td>You add your Dexterity modifier to your attack roll and your damage roll when attacking with a ranged weapon, such as a sling or a longbow. You can also add your Dexterity modifier to your attack roll and your damage roll when attacking with a melee weapon that has the finesse property, such as a dagger or a rapier.</td></tr></table>`;
        contentHTML += `<table class="derived-stats-table"><thead><tr><th>Character</th><th>DEX Modifier (for Ranged/Finesse Attack/Damage)</th></tr></thead><tbody>`;
        sortedPcs.forEach(pc => {
            const score = pc.vtt_data.abilities.dex?.value || 0; const mod = getAbilityModifier(score);
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
            const score = pc.vtt_data.abilities.con?.value || 0; const mod = getAbilityModifier(score);
            const hpMax = pc.vtt_data.attributes.hp?.max !== undefined && pc.vtt_data.attributes.hp.max !== null ? pc.vtt_data.attributes.hp.max : 'N/A';
            contentHTML += `<tr><td>${pc.name}</td><td>${mod >= 0 ? '+' : ''}${mod}</td><td>${hpMax}</td></tr>`;
        });
        contentHTML += `</tbody></table>`;
    }
    else if (upperAblKey === 'INT') {
        contentHTML += `<h5>Intelligence Checks</h5><table class="rules-explanation-table"><tr><td>An Intelligence check comes into play when you need to draw on logic, education, memory, or deductive reasoning. The Arcana, History, Investigation, Nature, and Religion skills reflect aptitude in certain kinds of Intelligence checks.</td></tr></table>`;
        contentHTML += `<h5>Other Intelligence Checks</h5><table class="rules-explanation-table"><tr><td>The GM might call for an Intelligence check when you try to accomplish tasks like: Communicate with a creature without using words, estimate the value of a precious item, pull together a disguise to pass as a city guard, forge a document, recall lore about a craft or trade, win a game of skill.</td></tr></table>`;
        contentHTML += `<h5>Spellcasting Ability (Wizards)</h5><table class="rules-explanation-table"><tr><td>Wizards use Intelligence as their spellcasting ability, which helps determine the saving throw DCs of spells they cast.</td></tr></table>`;
        if (sortedPcs.some(pc => pc.vtt_data.attributes?.spellcasting === 'int')) {
            contentHTML += `<table class="derived-stats-table"><thead><tr><th>Character (INT Casters)</th><th>Spell Save DC</th><th>Spell Attack Bonus</th></tr></thead><tbody>`;
            sortedPcs.filter(pc => pc.vtt_data.attributes?.spellcasting === 'int').forEach(pc => {
                const score = pc.vtt_data.abilities.int?.value || 0;
                contentHTML += `<tr><td>${pc.name}</td><td>${spellSaveDC(score, pc.calculatedProfBonus)}</td><td>+${spellAttackBonus(score, pc.calculatedProfBonus)}</td></tr>`;
            });
            contentHTML += `</tbody></table>`;
        }
    }
    else if (upperAblKey === 'WIS') {
        contentHTML += `<h5>Wisdom Checks</h5><table class="rules-explanation-table"><tr><td>A Wisdom check might reflect an effort to read body language, understand someone’s feelings, notice things about the environment, or care for an injured person. The Animal Handling, Insight, Medicine, Perception, and Survival skills reflect aptitude in certain kinds of Wisdom checks.</td></tr></table>`;
        contentHTML += `<h5>Other Wisdom Checks</h5><table class="rules-explanation-table"><tr><td>The GM might call for a Wisdom check when you try to accomplish tasks like: Get a gut feeling about what course of action to follow, discern whether a seemingly dead or living creature is undead.</td></tr></table>`;
        contentHTML += `<h5>Spellcasting Ability (Clerics, Druids, Rangers)</h5><table class="rules-explanation-table"><tr><td>Clerics, druids, and rangers use Wisdom as their spellcasting ability, which helps determine the saving throw DCs of spells they cast.</td></tr></table>`;
         if (sortedPcs.some(pc => pc.vtt_data.attributes?.spellcasting === 'wis')) {
            contentHTML += `<table class="derived-stats-table"><thead><tr><th>Character (WIS Casters)</th><th>Spell Save DC</th><th>Spell Attack Bonus</th></tr></thead><tbody>`;
            sortedPcs.filter(pc => pc.vtt_data.attributes?.spellcasting === 'wis').forEach(pc => {
                const score = pc.vtt_data.abilities.wis?.value || 0;
                contentHTML += `<tr><td>${pc.name}</td><td>${spellSaveDC(score, pc.calculatedProfBonus)}</td><td>+${spellAttackBonus(score, pc.calculatedProfBonus)}</td></tr>`;
            });
            contentHTML += `</tbody></table>`;
        }
    }
    else if (upperAblKey === 'CHA') {
        contentHTML += `<h5>Charisma Checks</h5><table class="rules-explanation-table"><tr><td>A Charisma check might arise when you try to influence or entertain others, when you try to make an impression or tell a convincing lie, or when you are navigating a tricky social situation. The Deception, Intimidation, Performance, and Persuasion skills reflect aptitude in certain kinds of Charisma checks.</td></tr></table>`;
        contentHTML += `<h5>Other Charisma Checks</h5><table class="rules-explanation-table"><tr><td>The GM might call for a Charisma check when you try to accomplish tasks like: Find the best person to talk to for news, rumors, and gossip, blend into a crowd to get the sense of key topics of conversation.</td></tr></table>`;
        contentHTML += `<h5>Spellcasting Ability (Bards, Paladins, Sorcerers, Warlocks)</h5><table class="rules-explanation-table"><tr><td>Bards, paladins, sorcerers, and warlocks use Charisma as their spellcasting ability, which helps determine the saving throw DCs of spells they cast.</td></tr></table>`;
        if (sortedPcs.some(pc => pc.vtt_data.attributes?.spellcasting === 'cha')) {
            contentHTML += `<table class="derived-stats-table"><thead><tr><th>Character (CHA Casters)</th><th>Spell Save DC</th><th>Spell Attack Bonus</th></tr></thead><tbody>`;
            sortedPcs.filter(pc => pc.vtt_data.attributes?.spellcasting === 'cha').forEach(pc => {
                const score = pc.vtt_data.abilities.cha?.value || 0;
                contentHTML += `<tr><td>${pc.name}</td><td>${spellSaveDC(score, pc.calculatedProfBonus)}</td><td>+${spellAttackBonus(score, pc.calculatedProfBonus)}</td></tr>`;
            });
            contentHTML += `</tbody></table>`;
        }
    }
    expansionDiv.innerHTML = contentHTML;
}
</script>

</body>
</html>
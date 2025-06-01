// --- Global Debug Flags ---
const DEBUG_DELEGATED_CARD_CLICK = false; 

// --- Global State Variables ---
let activeSceneNpcIds = new Set();
let activePcIds = new Set(); // IDs of PCs active in the current game session
let allCharacters = []; 
let dialogueHistories = {}; 
let currentProfileCharId = null;
let currentlyExpandedAbility = null;
let currentlyExpandedSkill = null;
let skillSortKey = null;

// --- Constants ---
const API_BASE_URL = ''; 
const ABILITY_KEYS_ORDER = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const SKILL_NAME_MAP = {
    "acr": "Acrobatics (Dex)", "ani": "Animal Handling (Wis)", "arc": "Arcana (Int)", "ath": "Athletics (Str)",
    "dec": "Deception (Cha)", "his": "History (Int)", "ins": "Insight (Wis)", "itm": "Intimidation (Cha)",
    "inv": "Investigation (Int)", "med": "Medicine (Wis)", "nat": "Nature (Int)", "prc": "Perception (Wis)",
    "prf": "Performance (Cha)", "per": "Persuasion (Cha)", "rel": "Religion (Int)", "slt": "Sleight of Hand (Dex)",
    "ste": "Stealth (Dex)", "sur": "Survival (Wis)"
};
const PC_QUICK_VIEW_BASE_TITLE = "PC Quick View";

const FACTION_STANDING_LEVELS = Object.freeze({
    ALLY: "Ally",
    WARMLY: "Warmly",
    KINDLY: "Kindly",
    AMIABLE: "Amiable",
    INDIFFERENT: "Indifferent",
    APPREHENSIVE: "Apprehensive",
    DUBIOUS: "Dubious",
    THREATENING: "Threatening"
});

const FACTION_STANDING_ORDER = [
    FACTION_STANDING_LEVELS.THREATENING,
    FACTION_STANDING_LEVELS.DUBIOUS,
    FACTION_STANDING_LEVELS.APPREHENSIVE,
    FACTION_STANDING_LEVELS.INDIFFERENT,
    FACTION_STANDING_LEVELS.AMIABLE,
    FACTION_STANDING_LEVELS.KINDLY,
    FACTION_STANDING_LEVELS.WARMLY,
    FACTION_STANDING_LEVELS.ALLY
];


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
            char.vtt_data = char.vtt_data || { abilities: {}, attributes: { hp: {}, ac: {}, movement: {}, init: {}, spell: {} }, details: {}, skills: {}, traits: { languages: {}, armorProf: {}, weaponProf: {}} };
            char.vtt_flags = char.vtt_flags || {};
            char.items = char.items || [];
            char.system = char.system || {};
            char.memories = char.memories || [];
            char.associated_history_files = char.associated_history_files || [];
            char.personality_traits = char.personality_traits || [];
            char.ideals = char.ideals || [];
            char.bonds = char.bonds || [];
            char.flaws = char.flaws || [];
            char.motivations = char.motivations || [];
            char.pc_faction_standings = char.pc_faction_standings || {};


            if (char.character_type === 'PC') {
                const pcLevel = char.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || char.system?.details?.level || char.vtt_data?.details?.level || 1;
                char.calculatedProfBonus = getProficiencyBonus(pcLevel);
            }
            return char;
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
    console.log(`Triggering greeting for ${npcName} (ID: ${npcIdStr})`);
    const transcriptArea = getElem(`transcript-${npcIdStr}`);
    if (!transcriptArea) { console.error(`Transcript area for NPC ID ${npcIdStr} not found for greeting.`); return; }
    
    if (!dialogueHistories[npcIdStr]) dialogueHistories[npcIdStr] = [];

    const sceneEventP = document.createElement('p');
    sceneEventP.className = 'scene-event';
    sceneEventP.textContent = `${npcName} is formulating a response...`; 
    transcriptArea.appendChild(sceneEventP);
    transcriptArea.scrollTop = transcriptArea.scrollHeight;

    try {
        const response = await fetch(`${API_BASE_URL}/api/npcs/${npcIdStr}/dialogue`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dialogueRequestPayload)
        });
        const result = await response.json();
        
        sceneEventP.remove(); 

        const npcResponseEntry = document.createElement('p');
        npcResponseEntry.className = 'dialogue-entry npc-response';
        if (!response.ok) { 
            const errorMsg = result.error || `Greeting generation failed for ${npcName}. Status: ${response.status}`; 
            throw new Error(errorMsg); 
        }
        npcResponseEntry.textContent = `${npcName}: ${result.npc_dialogue}`;
        dialogueHistories[npcIdStr].push(`${npcName}: ${result.npc_dialogue}`);
        
        renderAiSuggestions(
            result.new_memory_suggestions, 
            result.generated_topics, 
            npcIdStr,
            result.suggested_npc_actions,
            result.suggested_player_checks,
            result.suggested_standing_pc_id,
            result.suggested_new_standing,
            result.standing_change_justification
        );
        transcriptArea.appendChild(npcResponseEntry);
    } catch (error) {
        console.error(`Error generating greeting for ${npcName}:`, error);
        if (sceneEventP && sceneEventP.parentNode) sceneEventP.remove(); 
        const npcErrorEntry = document.createElement('p');
        npcErrorEntry.className = 'dialogue-entry npc-response';
        npcErrorEntry.textContent = `${npcName}: (Error: ${error.message})`;
        transcriptArea.appendChild(npcErrorEntry);
        dialogueHistories[npcIdStr].push(`${npcName}: (Error generating greeting)`);
    }
    transcriptArea.scrollTop = transcriptArea.scrollHeight;
}

async function toggleNpcInScene(npcIdStr, npcName) {
    const multiNpcContainer = getElem('multi-npc-dialogue-container');
    if (!multiNpcContainer) { console.error("Multi-NPC dialogue container not found."); return; }

    const isAdding = !activeSceneNpcIds.has(npcIdStr);
    const toggledNpc = isAdding ? allCharacters.find(c => String(c._id) === npcIdStr) : null;
    const speakingPcSelect = getElem('speaking-pc-select');
    const currentSpeakingPcId = speakingPcSelect ? speakingPcSelect.value : null;

    if (isAdding && toggledNpc) {
        activeSceneNpcIds.add(npcIdStr);
        createNpcDialogueArea(npcIdStr, npcName); 
        dialogueHistories[npcIdStr] = []; 

        if (activePcIds.size > 0) {
            const sceneContext = getElem('scene-context').value.trim();
            const activePcNames = Array.from(activePcIds).map(pcId => allCharacters.find(c => String(c._id) === pcId)?.name || "a PC");
            const greetingPayload = {
                scene_context: sceneContext || `${activePcNames.join(', ')} ${activePcNames.length > 1 ? 'are' : 'is'} present.`,
                player_utterance: `(System: You, ${toggledNpc.name}, have just become aware of ${activePcNames.join(', ')} in the scene. Offer a greeting or initial reaction.)`,
                active_pcs: activePcNames,
                speaking_pc_id: currentSpeakingPcId, 
                recent_dialogue_history: [] 
            };
            setTimeout(() => triggerNpcGreeting(npcIdStr, toggledNpc.name, greetingPayload), 100);
        }

        const otherNpcIdsInScene = Array.from(activeSceneNpcIds).filter(id => id !== npcIdStr);
        if (otherNpcIdsInScene.length > 0) {
            const arrivalMessageForOthers = `(System Observation: ${toggledNpc.name} has just arrived or become prominent in the scene.)`;
            
            otherNpcIdsInScene.forEach(async (existingNpcId) => {
                const existingNpc = allCharacters.find(c => String(c._id) === existingNpcId);
                if (!existingNpc) return;

                const transcriptArea = getElem(`transcript-${existingNpcId}`);
                if (transcriptArea) {
                    const arrivalEntry = document.createElement('p');
                    arrivalEntry.className = 'scene-event';
                    arrivalEntry.textContent = arrivalMessageForOthers;
                    transcriptArea.appendChild(arrivalEntry);
                    transcriptArea.scrollTop = transcriptArea.scrollHeight;
                    if (!dialogueHistories[existingNpcId]) dialogueHistories[existingNpcId] = [];
                    dialogueHistories[existingNpcId].push(arrivalMessageForOthers);
                }
                
                const sceneContext = getElem('scene-context').value.trim();
                const activePcNames = Array.from(activePcIds).map(pcId => allCharacters.find(c => String(c._id) === pcId)?.name || "a PC");
                
                const reactionPayload = {
                    scene_context: sceneContext,
                    player_utterance: arrivalMessageForOthers,
                    active_pcs: activePcNames,
                    speaking_pc_id: currentSpeakingPcId, 
                    recent_dialogue_history: (dialogueHistories[existingNpcId] || []).slice(-5)
                };

                if (transcriptArea) {
                    const thinkingEntry = document.createElement('p');
                    thinkingEntry.className = 'scene-event';
                    thinkingEntry.id = `thinking-${existingNpcId}-arrival-${toggledNpc.name.replace(/\s+/g, '-')}`;
                    thinkingEntry.textContent = `${existingNpc.name} notices ${toggledNpc.name}...`;
                    transcriptArea.appendChild(thinkingEntry);
                    transcriptArea.scrollTop = transcriptArea.scrollHeight;
                }

                try {
                    const response = await fetch(`${API_BASE_URL}/api/npcs/${existingNpcId}/dialogue`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(reactionPayload)
                    });
                    const result = await response.json();

                    if (transcriptArea) {
                        const thinkingMsg = getElem(`thinking-${existingNpcId}-arrival-${toggledNpc.name.replace(/\s+/g, '-')}`);
                        if (thinkingMsg) thinkingMsg.remove();

                        const npcResponseEntry = document.createElement('p');
                        npcResponseEntry.className = 'dialogue-entry npc-response';
                        if (!response.ok) {
                            npcResponseEntry.textContent = `${existingNpc.name}: (Error reacting to ${toggledNpc.name}'s arrival: ${result.error || 'Unknown error'})`;
                            if(dialogueHistories[existingNpcId]) dialogueHistories[existingNpcId].push(`${existingNpc.name}: (Error reacting to arrival)`);
                        } else {
                            npcResponseEntry.textContent = `${existingNpc.name}: ${result.npc_dialogue}`;
                            if(dialogueHistories[existingNpcId]) dialogueHistories[existingNpcId].push(`${existingNpc.name}: ${result.npc_dialogue}`);
                            renderAiSuggestions(
                                result.new_memory_suggestions, 
                                result.generated_topics, 
                                existingNpcId,
                                result.suggested_npc_actions,
                                result.suggested_player_checks,
                                result.suggested_standing_pc_id,
                                result.suggested_new_standing,
                                result.standing_change_justification
                            );
                        }
                        transcriptArea.appendChild(npcResponseEntry);
                        transcriptArea.scrollTop = transcriptArea.scrollHeight;
                    }
                } catch (error) {
                    console.error(`Error triggering reaction for ${existingNpc.name} to ${toggledNpc.name}'s arrival:`, error);
                    if (transcriptArea) {
                        const thinkingMsg = getElem(`thinking-${existingNpcId}-arrival-${toggledNpc.name.replace(/\s+/g, '-')}`);
                        if (thinkingMsg) thinkingMsg.remove();
                        const errorEntry = document.createElement('p');
                        errorEntry.className = 'dialogue-entry npc-response';
                        errorEntry.textContent = `${existingNpc.name}: (Network error while reacting)`;
                        transcriptArea.appendChild(errorEntry);
                        if(dialogueHistories[existingNpcId]) dialogueHistories[existingNpcId].push(`${existingNpc.name}: (Network error reacting)`);
                    }
                }
            });
        }
    } else if (!isAdding) { 
        activeSceneNpcIds.delete(npcIdStr);
        removeNpcDialogueArea(npcIdStr); 
        delete dialogueHistories[npcIdStr];
    }

    const placeholderEvent = multiNpcContainer.querySelector('p.scene-event');
    if (activeSceneNpcIds.size > 0 && placeholderEvent) {
        placeholderEvent.remove();
    } else if (activeSceneNpcIds.size === 0 && !placeholderEvent) {
        multiNpcContainer.innerHTML = '<p class="scene-event">Select NPCs to add them to the scene.</p>';
    }
    
    adjustNpcDialogueAreaWidths(); 
    renderNpcListForScene(); 
    disableBtn('generate-dialogue-btn', activeSceneNpcIds.size === 0);
    updateView();
}


function createNpcDialogueArea(npcIdStr, npcName) {
    const container = getElem('multi-npc-dialogue-container'); if (!container) return;
    if (getElem(`npc-area-${npcIdStr}`)) return; 

    const areaDiv = document.createElement('div');
    areaDiv.className = 'npc-dialogue-area';
    areaDiv.id = `npc-area-${npcIdStr}`;

    const nameHeader = document.createElement('h3'); nameHeader.textContent = npcName; areaDiv.appendChild(nameHeader);
    const transcriptDiv = document.createElement('div'); transcriptDiv.className = 'npc-transcript'; transcriptDiv.id = `transcript-${npcIdStr}`;
    transcriptDiv.innerHTML = `<p class="scene-event">Dialogue with ${npcName} begins.</p>`; areaDiv.appendChild(transcriptDiv);

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
    
    container.appendChild(areaDiv);
    adjustNpcDialogueAreaWidths();
}

function removeNpcDialogueArea(npcIdStr) {
    const areaDiv = getElem(`npc-area-${npcIdStr}`);
    if (areaDiv) areaDiv.remove();
    adjustNpcDialogueAreaWidths(); 
    const container = getElem('multi-npc-dialogue-container');
    if (activeSceneNpcIds.size === 0 && container && !container.querySelector('p.scene-event')) {
        container.innerHTML = '<p class="scene-event">Select NPCs to add them to the scene.</p>';
    }
}

function adjustNpcDialogueAreaWidths() {
    const container = getElem('multi-npc-dialogue-container'); if (!container) return;
    const dialogueAreas = container.querySelectorAll('.npc-dialogue-area');
    const numAreas = dialogueAreas.length;
    if (numAreas === 0) return;

    const minIndividualWidth = 250; 
    const containerWidth = container.clientWidth;
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

function renderPcList() {
    const pcListDiv = getElem('active-pc-list'); if (!pcListDiv) return;
    const speakingPcSelect = getElem('speaking-pc-select'); 

    pcListDiv.innerHTML = ''; 
    if(speakingPcSelect) speakingPcSelect.innerHTML = '<option value="">-- Select Speaking PC --</option>'; 

    const pcs = allCharacters.filter(char => char.character_type === 'PC').sort((a,b) => a.name.localeCompare(b.name));
    
    if (pcs.length === 0) { 
        pcListDiv.innerHTML = '<p><em>No Player Characters defined yet.</em></p>'; 
        if(speakingPcSelect) speakingPcSelect.disabled = true;
        return; 
    }
    if(speakingPcSelect) speakingPcSelect.disabled = false;

    const ul = document.createElement('ul');
    pcs.forEach(pc => {
        const pcIdStr = String(pc._id); 
        const li = document.createElement('li');
        li.style.cursor = "pointer"; 
        li.textContent = pc.name; 
        li.dataset.charId = pcIdStr;
        li.onclick = async () => {
            console.log(`PC List Item clicked: ${pc.name} (ID: ${pcIdStr})`);
            togglePcSelection(pcIdStr); 
            updateView();
        };
        if (activePcIds.has(pcIdStr)) {
            li.classList.add('selected');
        } else {
            li.classList.remove('selected');
        }
        ul.appendChild(li);

        if(speakingPcSelect){
            const option = document.createElement('option');
            option.value = pcIdStr;
            option.textContent = pc.name;
            speakingPcSelect.appendChild(option);
        }
    });
    pcListDiv.appendChild(ul);
}

function createPcQuickViewSectionHTML(isForDashboard) {
    const titleText = PC_QUICK_VIEW_BASE_TITLE;
    const fullTitle = isForDashboard ? `${titleText} (Click card for details)` : titleText;
    return `<h4>${fullTitle}</h4><div class="pc-dashboard-grid">`;
}

function generatePcQuickViewCardHTML(pc, isClickableForDetailedView = false) {
    if (!pc) return '';
    pc.vtt_data = pc.vtt_data || { abilities: {}, attributes: { hp: {}, ac: {}, movement: {}, init: {}, spell: {} }, details: {}, skills: {}, traits: { languages: {}, armorProf: {}, weaponProf: {}} };
    // ... (rest of existing VTT data defaulting logic)
    const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || pc.vtt_data?.details?.level || 1;
    if (pc.calculatedProfBonus === undefined) pc.calculatedProfBonus = getProficiencyBonus(pcLevel);
    // ... (rest of existing card HTML generation)
    let cardClasses = 'pc-stat-card';
    let dataAttributes = '';
    if (isClickableForDetailedView) {
        cardClasses += ' clickable-pc-card';
        dataAttributes = `data-pc-id="${String(pc._id)}"`;
    }
    let cardHTML = `<div class="${cardClasses}" ${dataAttributes}>`;
    cardHTML += `<h4>${pc.name} (Lvl ${pcLevel})</h4>`;
    // ... (HP, AC, Prof Bonus, Speed, Initiative, Spell DC rendering)
    const hpCurrent = pc.vtt_data.attributes.hp.value ?? 'N/A';
    const hpMax = pc.vtt_data.attributes.hp.max ?? pc.system?.attributes?.hp?.max ?? 'N/A';
    cardHTML += `<p><strong>HP:</strong> ${hpCurrent} / ${hpMax}</p>`;
    // ... etc for AC, prof bonus, speed, initiative, spell DC
    cardHTML += `</div>`;
    return cardHTML;
}

function renderPcQuickViewInScene() {
    const wrapperContainer = getElem('pc-quick-view-section-in-scene'); 
    if (!wrapperContainer) { console.error("PC Quick View section wrapper in Scene not found."); return; }
    const activePcs = allCharacters.filter(char => activePcIds.has(String(char._id)) && char.character_type === 'PC');
    if (activePcs.length === 0) { wrapperContainer.innerHTML = ''; wrapperContainer.style.display = 'none'; return; }
    let contentHTML = createPcQuickViewSectionHTML(false); 
    activePcs.sort((a, b) => a.name.localeCompare(b.name)).forEach(pc => {
        if (pc.calculatedProfBonus === undefined) {
            const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || pc.vtt_data?.details?.level || 1;
            pc.calculatedProfBonus = getProficiencyBonus(pcLevel);
        }
        contentHTML += generatePcQuickViewCardHTML(pc, false); 
    });
    contentHTML += `</div>`; 
    wrapperContainer.innerHTML = contentHTML;
    wrapperContainer.style.display = 'block'; 
}

async function fetchHistoryFiles() { /* ... (keep existing) ... */ }
async function associateHistoryFile() { /* ... (keep existing) ... */ }
async function dissociateHistoryFile(filename) { /* ... (keep existing) ... */ }
function renderAssociatedHistoryFiles(character) { /* ... (keep existing) ... */ }


async function selectCharacterForDetails(charIdStr) {
    console.log("selectCharacterForDetails: Fetching details for char ID:", charIdStr);
    currentProfileCharId = charIdStr; 
    try {
        const response = await fetch(`${API_BASE_URL}/api/npcs/${charIdStr}`); 
        if (!response.ok) throw new Error(`Failed to fetch details: ${response.status}`);
        let selectedChar = await response.json(); 
        if (selectedChar._id?.$oid) selectedChar._id = selectedChar._id.$oid;
        
        selectedChar = {...{combined_history_content:"", vtt_data:{abilities: {}, attributes: { hp: {}, ac: {}, movement: {}, init: {}, spell: {} }, details: {}, skills: {}, traits: { languages: {}, armorProf: {}, weaponProf: {}}}, vtt_flags:{}, items:[], system:{}, memories: [], associated_history_files:[], personality_traits:[], pc_faction_standings: {}}, ...selectedChar};

        const charIndex = allCharacters.findIndex(c => String(c._id) === charIdStr);
        if (charIndex > -1) allCharacters[charIndex] = selectedChar; 
        else allCharacters.push(selectedChar); 

        updateText('details-char-name', selectedChar.name || "N/A"); 
        updateText('profile-char-type', selectedChar.character_type || "N/A");
        updateText('profile-description', selectedChar.description || "N/A"); 
        updateText('profile-personality', (selectedChar.personality_traits || []).join(', ') || "N/A");
        
        getElem('gm-notes').value = selectedChar.gm_notes || ''; 
        disableBtn('save-gm-notes-btn', false);
        
        const npcSpecificSections = ['npc-memories-collapsible-section', 'npc-faction-standings-section'];
        npcSpecificSections.forEach(sectionId => {
            const elem = getElem(sectionId);
            if (elem) elem.style.display = selectedChar.character_type === 'NPC' ? 'block' : 'none';
        });
        getElem('character-history-collapsible-section').style.display = 'block'; 

        if (selectedChar.character_type === 'NPC') { 
            renderMemories(selectedChar.memories); 
            disableBtn('add-memory-btn', false); 
            renderNpcFactionStandings(selectedChar);
        } else { 
            disableBtn('add-memory-btn', true); 
            getElem('character-memories-list').innerHTML = '<p><em>Memories are for NPCs only.</em></p>'; 
            const factionContent = getElem('npc-faction-standings-content');
            if(factionContent) factionContent.innerHTML = '<p><em>Faction standings are for NPCs.</em></p>';
        }
        
        renderAssociatedHistoryFiles(selectedChar); 
        await fetchHistoryFiles(); 
        disableBtn('associate-history-btn', false);

    } catch (error) { 
        console.error("Error in selectCharacterForDetails:", error); 
        updateText('details-char-name', 'Error');
        const factionSection = getElem('npc-faction-standings-section');
        if (factionSection) factionSection.style.display = 'none';
        const factionContent = getElem('npc-faction-standings-content');
        if (factionContent) factionContent.innerHTML = '';
    }
}

function togglePcSelection(pcIdStr) { 
    console.log("Toggling PC selection for:", pcIdStr);
    if (activePcIds.has(pcIdStr)) {
        activePcIds.delete(pcIdStr);
    } else {
        activePcIds.add(pcIdStr);
    }
    renderPcList(); 
    updateView(); 
    if (currentProfileCharId && allCharacters.find(c => String(c._id) === currentProfileCharId)?.character_type === 'NPC') {
        const npc = allCharacters.find(c => String(c._id) === currentProfileCharId);
        if (npc) renderNpcFactionStandings(npc);
    }
}

function updateView() {
    const dialogueInterface = getElem('dialogue-interface');
    const pcDashboardView = getElem('pc-dashboard-view');
    const pcQuickViewWrapperInScene = getElem('pc-quick-view-section-in-scene'); 

    if (!dialogueInterface || !pcDashboardView || !pcQuickViewWrapperInScene) {
        console.error("updateView: Critical UI element(s) missing.");
        return;
    }

    if (activeSceneNpcIds.size > 0) { 
        dialogueInterface.style.display = 'flex';
        pcDashboardView.style.display = 'none';
        if (activePcIds.size > 0) {
            renderPcQuickViewInScene(); 
            pcQuickViewWrapperInScene.style.display = 'block'; 
        } else {
            pcQuickViewWrapperInScene.style.display = 'none';
            pcQuickViewWrapperInScene.innerHTML = ''; 
        }
    } else { 
        dialogueInterface.style.display = 'none';
        pcDashboardView.style.display = 'block';
        pcQuickViewWrapperInScene.style.display = 'none'; 
        pcQuickViewWrapperInScene.innerHTML = ''; 
        const dashboardContent = getElem('pc-dashboard-content');
        if (dashboardContent && !dashboardContent.querySelector('.detailed-pc-sheet')) {
            updatePcDashboard();
        } else if (!dashboardContent) {
            console.error("pc-dashboard-content element not found in updateView");
        }
    }
}


function updatePcDashboard() { /* ... (keep existing and all its helper functions) ... */ }
function toggleAbilityExpansion(ablKey) { /* ... (keep existing) ... */ }
function populateExpandedAbilityDetails(ablKey, expansionDiv, selectedPcsInput) { /* ... (keep existing) ... */ }
function toggleSkillExpansion(skillKey) { /* ... (keep existing) ... */ }
function populateExpandedSkillDetails(skillKey, expansionDiv, selectedPcs) { /* ... (keep existing) ... */ }
function renderDetailedPcSheet(pcId) { /* ... (keep existing) ... */ }

// --- Faction Standing UI ---
function renderNpcFactionStandings(npcCharacter) {
    const container = getElem('npc-faction-standings-content');
    if (!container || npcCharacter.character_type !== 'NPC') {
        if(container) container.innerHTML = '<p><em>Faction standings are for NPCs.</em></p>';
        return;
    }
    container.innerHTML = ''; 

    const pcsToDisplayStandingsFor = allCharacters.filter(char => char.character_type === 'PC'); 
    
    if (pcsToDisplayStandingsFor.length === 0) {
        container.innerHTML = '<p><em>No PCs available to show/set standings for. Add PCs via "Create New Character".</em></p>';
        return;
    }
    
    const npcStandings = npcCharacter.pc_faction_standings || {};

    pcsToDisplayStandingsFor.forEach(pc => {
        const pcId = String(pc._id);
        const standingDiv = document.createElement('div');
        standingDiv.className = 'faction-standing-entry';
        
        const label = document.createElement('label');
        label.htmlFor = `standing-select-${npcCharacter._id}-${pcId}`;
        label.textContent = `${pc.name}: `;
        standingDiv.appendChild(label);

        const select = document.createElement('select');
        select.id = `standing-select-${npcCharacter._id}-${pcId}`;
        select.dataset.npcId = npcCharacter._id;
        select.dataset.pcId = pcId;

        FACTION_STANDING_ORDER.forEach(level => { 
            const option = document.createElement('option');
            option.value = level;
            option.textContent = level;
            if (npcStandings[pcId] === level) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        if (!npcStandings[pcId]) { 
             const defaultStanding = FACTION_STANDING_LEVELS.INDIFFERENT;
             select.value = defaultStanding;
        }

        select.onchange = handleFactionStandingChange; 
        standingDiv.appendChild(select);
        container.appendChild(standingDiv);
    });
}

async function handleFactionStandingChange(event) {
    const selectElement = event.target;
    const npcId = selectElement.dataset.npcId;
    const pcId = selectElement.dataset.pcId;
    const newStanding = selectElement.value;

    const npcCharacter = allCharacters.find(char => String(char._id) === npcId);
    if (!npcCharacter) {
        console.error("NPC not found for faction standing update:", npcId);
        return;
    }

    if (!npcCharacter.pc_faction_standings) {
        npcCharacter.pc_faction_standings = {};
    }
    npcCharacter.pc_faction_standings[pcId] = newStanding;

    console.log(`Updating NPC ${npcId} standing towards PC ${pcId} to ${newStanding}`);
    console.log("Payload to send:", { pc_faction_standings: npcCharacter.pc_faction_standings });

    try {
        const response = await fetch(`${API_BASE_URL}/api/npcs/${npcId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pc_faction_standings: npcCharacter.pc_faction_standings })
        });
        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error || `Failed to update faction standing. Status: ${response.status}`);
        }
        const result = await response.json();
        console.log("Faction standing updated on server:", result.character.pc_faction_standings);
        
        const charIndex = allCharacters.findIndex(c => String(c._id) === npcId);
        if (charIndex > -1) {
             let updatedCharFromServer = result.character;
             if (updatedCharFromServer._id?.$oid) updatedCharFromServer._id = updatedCharFromServer._id.$oid;
             if(allCharacters[charIndex].character_type === 'PC' && allCharacters[charIndex].calculatedProfBonus !== undefined) {
                updatedCharFromServer.calculatedProfBonus = allCharacters[charIndex].calculatedProfBonus;
             }
             allCharacters[charIndex] = updatedCharFromServer; 
        }

    } catch (error) {
        console.error("Error updating faction standing on server:", error);
        alert(`Error saving faction standing: ${error.message}`);
    }
}

// --- Memory Management, Dialogue, Character Creation/GM Notes ---
function renderMemories(memories = []) {
    const listElement = getElem('character-memories-list');
    if (!listElement) { console.warn("Memory list element not found."); return; }
    listElement.innerHTML = ''; 
    if (memories.length === 0) { listElement.innerHTML = '<p><em>No memories yet.</em></p>'; return; }
    memories.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); 
    memories.forEach(memory => { /* ... (existing rendering logic) ... */ });
}
async function addMemoryToCharacter() { /* ... (keep existing) ... */ }
async function deleteMemory(memoryId) { /* ... (keep existing) ... */ }

async function generateDialogue() {
    const playerUtterance = getElem('player-utterance').value.trim();
    const sceneContext = getElem('scene-context').value.trim();
    const speakingPcSelect = getElem('speaking-pc-select');
    const speakingPcId = speakingPcSelect ? speakingPcSelect.value : null;

    if (activeSceneNpcIds.size === 0) {
        alert("No NPCs are active in the scene.");
        return;
    }
    if (playerUtterance && !speakingPcId && activeSceneNpcIds.size > 0) { 
        alert("Please select which PC is speaking from the dropdown under 'Player Characters'.");
        return;
    }

    disableBtn('generate-dialogue-btn', true);
    
    const speakingPcObject = allCharacters.find(c => String(c._id) === speakingPcId);
    const pcNameForDisplay = speakingPcObject ? speakingPcObject.name : (Array.from(activePcIds)
        .map(id => allCharacters.find(c => String(c._id) === id)?.name)
        .filter(name => name)
        .join(', ') || "Player(s)");

    if (playerUtterance) {
        activeSceneNpcIds.forEach(npcId => {
            const transcriptArea = getElem(`transcript-${npcId}`);
            if (transcriptArea) {
                const playerEntry = document.createElement('p');
                playerEntry.className = 'dialogue-entry player-utterance';
                playerEntry.textContent = `${pcNameForDisplay}: ${playerUtterance}`;
                transcriptArea.appendChild(playerEntry);
                transcriptArea.scrollTop = transcriptArea.scrollHeight;
                if (!dialogueHistories[npcId]) dialogueHistories[npcId] = [];
                dialogueHistories[npcId].push(`${pcNameForDisplay}: ${playerUtterance}`);
            }
        });
    }

    for (const npcId of activeSceneNpcIds) {
        const npc = allCharacters.find(c => String(c._id) === npcId);
        if (!npc) continue;
        const transcriptArea = getElem(`transcript-${npcId}`);
        const specificNpcHistory = (dialogueHistories[npcId] || []).slice(-5); 
        
        const payload = {
            scene_context: sceneContext || "A general scene.",
            player_utterance: playerUtterance,
            active_pcs: Array.from(activePcIds).map(id => allCharacters.find(c => String(c._id) === id)?.name).filter(name => name),
            speaking_pc_id: speakingPcId, 
            recent_dialogue_history: specificNpcHistory
        };
        
        if (transcriptArea) { 
            const thinkingEntry = document.createElement('p');
            thinkingEntry.className = 'scene-event';
            thinkingEntry.textContent = `${npc.name} is thinking...`;
            thinkingEntry.id = `thinking-${npcId}`;
            transcriptArea.appendChild(thinkingEntry);
            transcriptArea.scrollTop = transcriptArea.scrollHeight;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/npcs/${npcId}/dialogue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            
            if (transcriptArea) { 
                const thinkingMsg = getElem(`thinking-${npcId}`);
                if (thinkingMsg) thinkingMsg.remove();
            }

            const npcResponseEntry = document.createElement('p');
            npcResponseEntry.className = 'dialogue-entry npc-response';

            if (!response.ok) {
                const errorDetail = result.error || `Dialogue generation failed for ${npc.name}. Status: ${response.status}`;
                console.error(`Error generating dialogue for ${npc.name}:`, errorDetail, result.details);
                npcResponseEntry.textContent = `${npc.name}: (Error: ${errorDetail})`;
                if (dialogueHistories[npcId]) dialogueHistories[npcId].push(`${npc.name}: (Error in response)`);
            } else {
                npcResponseEntry.textContent = `${npc.name}: ${result.npc_dialogue}`;
                if (dialogueHistories[npcId]) dialogueHistories[npcId].push(`${npc.name}: ${result.npc_dialogue}`);
                
                renderAiSuggestions(
                    result.new_memory_suggestions, 
                    result.generated_topics, 
                    npcId, 
                    result.suggested_npc_actions,
                    result.suggested_player_checks,
                    result.suggested_standing_pc_id,
                    result.suggested_new_standing,
                    result.standing_change_justification
                );
                
                if (result.suggested_standing_pc_id && result.suggested_new_standing && result.suggested_standing_pc_id === speakingPcId) {
                    const npcToUpdate = allCharacters.find(char => String(char._id) === npcId);
                    if (npcToUpdate) {
                        if(!npcToUpdate.pc_faction_standings) npcToUpdate.pc_faction_standings = {};
                        const currentStandingForPC = npcToUpdate.pc_faction_standings[speakingPcId] || FACTION_STANDING_LEVELS.INDIFFERENT;
                        if (currentStandingForPC !== result.suggested_new_standing) {
                            npcToUpdate.pc_faction_standings[speakingPcId] = result.suggested_new_standing;
                            console.log(`AI Suggestion: Updating ${npc.name}'s standing towards ${speakingPcObject?.name || speakingPcId} to ${result.suggested_new_standing}`);
                            
                            fetch(`${API_BASE_URL}/api/npcs/${npcId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ pc_faction_standings: npcToUpdate.pc_faction_standings })
                            }).then(async resp => {
                                if(resp.ok) {
                                    const updatedNpcData = await resp.json();
                                    const idx = allCharacters.findIndex(c => String(c._id) === updatedNpcData.character._id);
                                    if (idx > -1) allCharacters[idx] = updatedNpcData.character;
                                    console.log(`Auto-saved AI suggested standing for NPC ${npcId}`);
                                    if(currentProfileCharId === npcId) renderNpcFactionStandings(updatedNpcData.character);
                                } else {
                                    console.error("Failed to auto-save AI suggested standing change.");
                                }
                            }).catch(err => console.error("Error auto-saving AI standing change:", err));
                        }
                    }
                }
            }
            if (transcriptArea) {
                transcriptArea.appendChild(npcResponseEntry);
                transcriptArea.scrollTop = transcriptArea.scrollHeight;
            }
        } catch (error) {
            console.error(`Network or other error for ${npc.name}:`, error);
             if (transcriptArea) { 
                const thinkingMsg = getElem(`thinking-${npcId}`);
                if (thinkingMsg) thinkingMsg.remove();
                const errorEntry = document.createElement('p');
                errorEntry.className = 'dialogue-entry npc-response';
                errorEntry.textContent = `${npc.name}: (Network error or AI service unavailable)`;
                transcriptArea.appendChild(errorEntry);
                if (dialogueHistories[npcId]) dialogueHistories[npcId].push(`${npc.name}: (Error - network/service)`);
            }
        }
    }
    if (playerUtterance) getElem('player-utterance').value = '';
    disableBtn('generate-dialogue-btn', false);
}

function renderAiSuggestions(
    memorySuggestions = [], 
    topicSuggestions = [], 
    forNpcId,
    npcActions = [], 
    playerChecks = [],
    suggestedStandingPcId = null,
    suggestedNewStanding = null, 
    standingChangeJustification = null
) {
    let targetContainer;
    let isNpcSpecificContainer = false;
    const npcSpecificSuggestionsContainer = getElem(`ai-suggestions-${forNpcId}`);
    const generalSuggestionsContainer = getElem('ai-suggestions');

    if (npcSpecificSuggestionsContainer && activeSceneNpcIds.has(forNpcId)) { // Prefer NPC-specific if NPC is in scene
        targetContainer = npcSpecificSuggestionsContainer;
        isNpcSpecificContainer = true;
    } else if (generalSuggestionsContainer) { // Fallback to general
        targetContainer = generalSuggestionsContainer;
    } else {
        console.warn("No AI suggestions container found.");
        return;
    }

    // Clear or prepare sections
    if (isNpcSpecificContainer) {
        targetContainer.innerHTML = `
            <div id="suggested-memories-list-npc-${forNpcId}" class="ai-suggestion-category"></div>
            <div id="suggested-topics-list-npc-${forNpcId}" class="ai-suggestion-category"></div>
            <div id="suggested-npc-actions-list-npc-${forNpcId}" class="ai-suggestion-category"><h5>NPC Actions:</h5></div>
            <div id="suggested-player-checks-list-npc-${forNpcId}" class="ai-suggestion-category"><h5>Player Checks:</h5></div>
            <div id="suggested-faction-standing-changes-npc-${forNpcId}" class="ai-suggestion-category"><h5>Faction Standing:</h5></div>
        `;
    } else { // General container: clear specific known sub-sections if they exist
        const clearIfExists = (id, defaultHTML) => { const el = getElem(id); if (el) el.innerHTML = defaultHTML || ''; };
        clearIfExists('suggested-memories-list');
        clearIfExists('suggested-topics-list');
        clearIfExists('suggested-npc-actions-list', '<h5>Suggested NPC Actions/Thoughts:</h5>');
        clearIfExists('suggested-player-checks-list', '<h5>Suggested Player Checks:</h5>');
        clearIfExists('suggested-faction-standing-changes', '<h5>Suggested Faction Standing Change:</h5>');
    }
    
    let hasAnySuggestion = false;

    // Memory Suggestions
    const memListContainerId = isNpcSpecificContainer ? `suggested-memories-list-npc-${forNpcId}` : 'suggested-memories-list';
    const memListContainer = getElem(memListContainerId);
    if (memListContainer && memorySuggestions.length > 0) {
        memListContainer.innerHTML = '<h6>Suggested Memories:</h6>';
        memorySuggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = 'suggested-item clickable-suggestion';
            item.textContent = suggestion;
            item.onclick = async () => { 
                const originalProfileCharId = currentProfileCharId; 
                const targetNpcForMemory = forNpcId || currentProfileCharId; // Fallback to current if forNpcId is not set (e.g. global suggestion)
                if (!targetNpcForMemory) { alert("No NPC context for memory."); return; }

                currentProfileCharId = targetNpcForMemory; 
                if (originalProfileCharId !== targetNpcForMemory || !getElem('new-memory-content')) {
                    await selectCharacterForDetails(targetNpcForMemory); 
                }
                getElem('new-memory-content').value = suggestion; 
                getElem('new-memory-type').value = "ai_suggested_interaction"; 
                await addMemoryToCharacter(); 
                if (originalProfileCharId && originalProfileCharId !== targetNpcForMemory) {
                   await selectCharacterForDetails(originalProfileCharId);
                }
            };
            memListContainer.appendChild(item);
        });
        hasAnySuggestion = true;
    } else if (memListContainer) { memListContainer.innerHTML = ''; } // Clear header if no suggestions

    // Topic Suggestions
    const topicsListContainerId = isNpcSpecificContainer ? `suggested-topics-list-npc-${forNpcId}` : 'suggested-topics-list';
    const topicsListContainer = getElem(topicsListContainerId);
    if (topicsListContainer && topicSuggestions.length > 0) {
        topicsListContainer.innerHTML = '<h6>Suggested Follow-up Topics:</h6>';
        topicSuggestions.forEach(topic => {
            const item = document.createElement('div');
            item.className = 'suggested-item clickable-suggestion';
            item.textContent = topic;
            item.onclick = () => {
                getElem('player-utterance').value = topic; 
                getElem('player-utterance').focus();
            };
            topicsListContainer.appendChild(item);
        });
        hasAnySuggestion = true;
    } else if (topicsListContainer) { topicsListContainer.innerHTML = ''; }

    // NPC Actions
    const actionsListContainerId = isNpcSpecificContainer ? `suggested-npc-actions-list-npc-${forNpcId}` : 'suggested-npc-actions-list';
    const actionsListContainer = getElem(actionsListContainerId);
    if (actionsListContainer && npcActions.length > 0 && npcActions[0] !== "None") {
        actionsListContainer.innerHTML = `<h5>${isNpcSpecificContainer ? 'NPC Might:' : 'Suggested NPC Actions/Thoughts:'}</h5>`;
        npcActions.forEach(action => {
            const item = document.createElement('div'); item.className = 'suggested-item'; item.textContent = action;
            actionsListContainer.appendChild(item);
        });
        hasAnySuggestion = true;
    } else if (actionsListContainer) { actionsListContainer.innerHTML = `<h5>${isNpcSpecificContainer ? 'NPC Actions:' : 'Suggested NPC Actions/Thoughts:'}</h5>`; }


    // Player Checks
    const checksListContainerId = isNpcSpecificContainer ? `suggested-player-checks-list-npc-${forNpcId}` : 'suggested-player-checks-list';
    const checksListContainer = getElem(checksListContainerId);
    if (checksListContainer && playerChecks.length > 0 && playerChecks[0] !== "None") {
        checksListContainer.innerHTML = `<h5>${isNpcSpecificContainer ? 'Players Might Check:' : 'Suggested Player Checks:'}</h5>`;
        playerChecks.forEach(check => {
            const item = document.createElement('div'); item.className = 'suggested-item'; item.textContent = check;
            checksListContainer.appendChild(item);
        });
        hasAnySuggestion = true;
    } else if (checksListContainer) { checksListContainer.innerHTML = `<h5>${isNpcSpecificContainer ? 'Player Checks:' : 'Suggested Player Checks:'}</h5>`; }

    // Faction Standing Change Suggestion
    const standingChangeContainerId = isNpcSpecificContainer ? `suggested-faction-standing-changes-npc-${forNpcId}` : 'suggested-faction-standing-changes';
    const standingChangeContainer = getElem(standingChangeContainerId);
    if (standingChangeContainer && suggestedNewStanding && suggestedNewStanding.toLowerCase() !== 'no change' && suggestedStandingPcId) {
        const pcForStanding = allCharacters.find(c => String(c._id) === suggestedStandingPcId);
        const pcName = pcForStanding ? pcForStanding.name : suggestedStandingPcId;
        standingChangeContainer.innerHTML = `<h5>${isNpcSpecificContainer ? 'Faction Standing:' : 'Suggested Faction Standing Change:'}</h5>`;
        
        const item = document.createElement('div'); 
        item.className = 'suggested-item';
        item.innerHTML = `For <strong>${pcName}</strong>: New standing <strong>${suggestedNewStanding}</strong>. <em>Justification: ${standingChangeJustification || 'N/A'}</em>`;
        
        const acceptBtn = document.createElement('button');
        acceptBtn.textContent = 'Accept & Update Standing';
        acceptBtn.onclick = async () => {
            const npcToUpdate = allCharacters.find(char => String(char._id) === (forNpcId || currentProfileCharId)); // Use forNpcId if available
            const targetPcIdForStanding = suggestedStandingPcId; 
            if (npcToUpdate && targetPcIdForStanding) {
                if(!npcToUpdate.pc_faction_standings) npcToUpdate.pc_faction_standings = {};
                npcToUpdate.pc_faction_standings[targetPcIdForStanding] = suggestedNewStanding; 
                
                try {
                    const response = await fetch(`${API_BASE_URL}/api/npcs/${npcToUpdate._id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ pc_faction_standings: npcToUpdate.pc_faction_standings })
                    });
                    if (!response.ok) throw new Error('Failed to save accepted standing change on server.');
                    const updatedNpcData = await response.json();
                    
                    const idx = allCharacters.findIndex(c => String(c._id) === updatedNpcData.character._id);
                    if (idx > -1) allCharacters[idx] = updatedNpcData.character;

                    console.log('GM accepted standing change, saved for NPC:', npcToUpdate._id, 'PC:', targetPcIdForStanding);
                    if(currentProfileCharId === npcToUpdate._id) renderNpcFactionStandings(updatedNpcData.character);
                    item.innerHTML += " <em style='color:green;'>(Accepted & Saved!)</em>"; 
                    acceptBtn.disabled = true; 
                } catch (err) {
                    console.error("Error saving GM-accepted standing change:", err);
                    alert("Error saving standing change: " + err.message);
                }
            }
        };
        item.appendChild(acceptBtn);
        standingChangeContainer.appendChild(item);
        hasAnySuggestion = true;
    } else if (standingChangeContainer) { standingChangeContainer.innerHTML = `<h5>${isNpcSpecificContainer ? 'Faction Standing:' : 'Suggested Faction Standing Change:'}</h5>`; }
    
    if (isNpcSpecificContainer) { // For NPC-specific container
        targetContainer.style.display = hasAnySuggestion ? 'block' : 'none';
    } else if (targetContainer) { // For general container
        // Visibility of the main #ai-suggestions div is handled by its own logic,
        // this function just populates its children.
        // If you want to hide the main general container if all its sub-parts are empty,
        // you'd add that logic here by checking if any of its children have content.
    }
}


async function saveGMNotes() {
    const charIdToUse = String(currentProfileCharId);
    if (!charIdToUse) { alert("No character selected."); return; }
    const gmNotes = getElem('gm-notes').value;
    try {
        const response = await fetch(`${API_BASE_URL}/api/npcs/${charIdToUse}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gm_notes: gmNotes }) 
        });
        const result = await response.json();
        if (!response.ok) {
            const errorDetails = result.details ? JSON.stringify(result.details) : '';
            throw new Error(result.error || `Failed to save GM notes. Status: ${response.status}. ${errorDetails}`);
        }
        alert("GM notes saved successfully.");
        const charIndex = allCharacters.findIndex(c => String(c._id) === charIdToUse);
        if (charIndex > -1 && result.character) {
            let updatedChar = result.character;
            if (updatedChar._id && typeof updatedChar._id === 'object' && updatedChar._id.$oid) {
                updatedChar._id = updatedChar._id.$oid;
            }
            allCharacters[charIndex] = updatedChar;
        }
    } catch (error) {
        console.error("Error saving GM notes:", error);
        alert(`Error: ${error.message}`);
    }
}

async function createCharacter() {
    const name = getElem('new-char-name').value.trim();
    const description = getElem('new-char-description').value.trim();
    const personality_traits = getElem('new-char-personality').value.split(',').map(t => t.trim()).filter(t => t);
    const character_type = getElem('new-char-type').value;

    if (!name || !description) { alert("Name and Description are required."); return; }
    const newCharData = { 
        name, description, personality_traits, character_type,
        race: null, class_str: null, alignment: null, age: null,
        ideals: [], bonds: [], flaws: [], speech_patterns: null, mannerisms: null,
        relationships: [], past_situation: null, current_situation: null,
        background_story: null, motivations: [], knowledge: [], memories: [],
        linked_lore_ids: [], gm_notes: null, vtt_data: {}, vtt_flags: {},
        associated_history_files: [], img: null, items: [], system: {},
        pc_faction_standings: {} // Initialize new field
    };
    try {
        const response = await fetch(`${API_BASE_URL}/api/npcs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newCharData)
        });
        const result = await response.json();
        if (!response.ok) {
            const errorDetails = result.details ? JSON.stringify(result.details) : '';
            throw new Error(result.error || `Failed to create character. Status: ${response.status}. ${errorDetails}`);
        }
        alert(`${result.character?.name || 'Character'} created successfully!`);
        getElem('new-char-name').value = '';
        getElem('new-char-description').value = '';
        getElem('new-char-personality').value = '';
        await fetchCharacters(); 
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
        fetchCharacters(); 
        fetchHistoryFiles(); 
    } catch (e) { 
        console.error("Error during initial fetch calls:", e); 
    }

    const leftColumn = getElem('left-column');
    const resizer = getElem('resizer');
    if (leftColumn && resizer) { 
        let isResizing = false;
        resizer.addEventListener('mousedown', (e) => { 
            e.preventDefault(); 
            isResizing = true; 
            document.body.style.cursor = 'col-resize'; 
        });
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            let newLeftWidth = e.clientX;
            const minColWidth = 200; 
            const maxColWidth = window.innerWidth - 200; 
            if (newLeftWidth < minColWidth) newLeftWidth = minColWidth;
            if (newLeftWidth > maxColWidth) newLeftWidth = maxColWidth;
            leftColumn.style.width = `${newLeftWidth}px`;
        });
        document.addEventListener('mouseup', () => { 
            if (isResizing) {
                isResizing = false; 
                document.body.style.cursor = 'default'; 
            }
        });
    }

    document.querySelectorAll('#left-column .collapsible-section').forEach(section => {
        const header = section.querySelector('h3, h4'); // Allow h4 for faction section header
        if (header) {
            let arrow = header.querySelector('.arrow-indicator');
            if (!arrow && (header.tagName === 'H3' || header.parentElement.id === 'npc-faction-standings-section')) { // Add arrow if h3 or it's the faction h4
                arrow = document.createElement('span');
                arrow.className = 'arrow-indicator';
                header.insertBefore(document.createTextNode(' '), header.firstChild); 
                header.insertBefore(arrow, header.firstChild); 
            }

            header.addEventListener('click', (e) => {
                if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.closest('.faction-standing-entry select')) {
                    return; // Don't collapse if interacting with form elements inside
                }
                const content = section.querySelector('.collapsible-content');
                if (content) { // Only toggle if there's collapsible content
                    section.classList.toggle('collapsed');
                    if(arrow) arrow.textContent = section.classList.contains('collapsed') ? ' ►' : ' ▼';
                    content.style.display = section.classList.contains('collapsed') ? 'none' : 'block';
                } else if (header.tagName === 'H4' && section.id === 'npc-faction-standings-section') { // Special case for faction h4
                     section.classList.toggle('collapsed');
                     if(arrow) arrow.textContent = section.classList.contains('collapsed') ? ' ►' : ' ▼';
                     const factionContent = getElem('npc-faction-standings-content');
                     if(factionContent) factionContent.style.display = section.classList.contains('collapsed') ? 'none' : 'block';
                }
            });
            
            // Initial state logic
            const contentToToggle = section.querySelector('.collapsible-content') || (section.id === 'npc-faction-standings-section' ? getElem('npc-faction-standings-content') : null);
            const shouldBeOpen = ['pc-list-section', 'npc-list-section', 'character-profile-main-section', 
                                  'gm-notes-collapsible-section', 'npc-memories-collapsible-section', 
                                  'npc-faction-standings-section'].includes(section.id);

            if (shouldBeOpen) {
                section.classList.remove('collapsed');
                if(arrow) arrow.textContent = ' ▼';
                if(contentToToggle) contentToToggle.style.display = 'block';
            } else {
                 section.classList.add('collapsed');
                 if(arrow) arrow.textContent = ' ►';
                 if(contentToToggle) contentToToggle.style.display = 'none';
            }
            // Ensure Profile's direct sub-sections also get their arrows set correctly
            if (section.id === 'character-profile-main-section' && !section.classList.contains('collapsed')) {
                section.querySelectorAll('.collapsible-section > h3').forEach(subHeader => { // Only target h3 here
                    const subArrow = subHeader.querySelector('.arrow-indicator');
                    const subSection = subHeader.parentElement;
                    const subContent = subSection.querySelector('.collapsible-content');
                     if (!subSection.classList.contains('collapsed')) { 
                        if(subArrow) subArrow.textContent = ' ▼';
                        if(subContent) subContent.style.display = 'block';
                    } else {
                        if(subArrow) subArrow.textContent = ' ►';
                         if(subContent) subContent.style.display = 'none';
                    }
                });
            }
        }
    });
    
    const pcDashboardContentForDelegation = getElem('pc-dashboard-content');
    if (pcDashboardContentForDelegation) {
        console.log("Attaching DELEGATED click listener to pc-dashboard-content.");
        pcDashboardContentForDelegation.addEventListener('click', function(event) {
            const clickedCard = event.target.closest('.clickable-pc-card');
            if (DEBUG_DELEGATED_CARD_CLICK) { 
                console.log("Dashboard content clicked. Event target:", event.target);
                console.log("Closest '.clickable-pc-card':", clickedCard);
            }
            if (clickedCard) {
                const pcIdToRender = clickedCard.dataset.pcId;
                if (DEBUG_DELEGATED_CARD_CLICK) console.log("Card has pcId:", pcIdToRender);
                if (pcIdToRender) { 
                    renderDetailedPcSheet(pcIdToRender); 
                } else { 
                    console.error("Delegated Listener: Clicked card, but data-pc-id missing."); 
                }
            }
        });
    } else { 
        console.error("Crucial element #pc-dashboard-content not found for event delegation."); 
    }

    updateView(); 
    console.log("script.js: DOMContentLoaded finished.");
});
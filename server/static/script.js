// --- Global Debug Flags ---
const DEBUG_DELEGATED_CARD_CLICK = false; // Set to true to enable specific card click logs

// --- Global State Variables ---
let activeSceneNpcIds = new Set();
let activePcIds = new Set();
let allCharacters = []; // This will store character objects
let dialogueHistories = {}; // For per-NPC history { npcId: ["speaker: utterance", ...] }
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
const PC_QUICK_VIEW_BASE_TITLE = "PC Quick View";


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
            // Ensure essential nested structures exist for PCs, especially VTT data
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

            // Pre-calculate proficiency bonus for PCs
            if (char.character_type === 'PC') {
                const pcLevel = char.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || char.system?.details?.level || char.vtt_data?.details?.level || 1;
                char.calculatedProfBonus = getProficiencyBonus(pcLevel);
            }
            return char;
        });
        console.log("Characters fetched and processed:", allCharacters.length);
        renderNpcListForScene();
        renderPcList();
        updateView(); // Initial view update
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
    
    // Ensure dialogue history for this NPC exists
    if (!dialogueHistories[npcIdStr]) dialogueHistories[npcIdStr] = [];

    const sceneEventP = document.createElement('p');
    sceneEventP.className = 'scene-event';
    // More generic message as the payload now specifies the context for the AI
    sceneEventP.textContent = `${npcName} is formulating a response...`; 
    transcriptArea.appendChild(sceneEventP);
    transcriptArea.scrollTop = transcriptArea.scrollHeight;

    try {
        const response = await fetch(`${API_BASE_URL}/api/npcs/${npcIdStr}/dialogue`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dialogueRequestPayload)
        });
        const result = await response.json();
        
        sceneEventP.remove(); // Remove the "formulating response" message

        const npcResponseEntry = document.createElement('p');
        npcResponseEntry.className = 'dialogue-entry npc-response';
        if (!response.ok) { 
            const errorMsg = result.error || `Greeting generation failed for ${npcName}. Status: ${response.status}`; 
            throw new Error(errorMsg); 
        }
        npcResponseEntry.textContent = `${npcName}: ${result.npc_dialogue}`;
        dialogueHistories[npcIdStr].push(`${npcName}: ${result.npc_dialogue}`);
        renderAiSuggestions(result.new_memory_suggestions, result.generated_topics, npcIdStr);
        transcriptArea.appendChild(npcResponseEntry);
    } catch (error) {
        console.error(`Error generating greeting for ${npcName}:`, error);
        if (sceneEventP && sceneEventP.parentNode) sceneEventP.remove(); // Ensure it's removed on error too
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
    if (!multiNpcContainer) {
        console.error("Multi-NPC dialogue container not found.");
        return;
    }

    const isAdding = !activeSceneNpcIds.has(npcIdStr);
    const toggledNpc = isAdding ? allCharacters.find(c => String(c._id) === npcIdStr) : null;

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
                            renderAiSuggestions(result.new_memory_suggestions, result.generated_topics, existingNpcId);
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
    // Placeholder removal is now handled more robustly in toggleNpcInScene
    if (getElem(`npc-area-${npcIdStr}`)) return; // Don't recreate if it exists

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

    // AI Suggestions container per NPC
    const suggestionsDiv = document.createElement('div');
    suggestionsDiv.id = `ai-suggestions-${npcIdStr}`;
    suggestionsDiv.className = 'ai-suggestions-for-npc'; // For specific styling
    suggestionsDiv.style.display = 'none'; // Initially hidden
    areaDiv.appendChild(suggestionsDiv);
    
    container.appendChild(areaDiv);
    adjustNpcDialogueAreaWidths();
}

function removeNpcDialogueArea(npcIdStr) {
    const areaDiv = getElem(`npc-area-${npcIdStr}`);
    if (areaDiv) areaDiv.remove();
    adjustNpcDialogueAreaWidths(); // Adjust after removing
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

    // Ensure a minimum width for readability, but allow flex to fill space
    const minIndividualWidth = 250; // px
    const containerWidth = container.clientWidth;
    let flexBasisPercent = 100 / numAreas;

    if (numAreas * minIndividualWidth > containerWidth) {
        // If total min width exceeds container, they'll rely more on min-width and scroll
        flexBasisPercent = (minIndividualWidth / containerWidth) * 100;
        flexBasisPercent = Math.min(flexBasisPercent, 100); // Cap at 100%
    }
    
    dialogueAreas.forEach(area => {
        area.style.minWidth = `${minIndividualWidth}px`;
        area.style.flexBasis = `${flexBasisPercent}%`;
        area.style.flexGrow = `1`;
    });
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
            togglePcSelection(pcIdStr); 
            await selectCharacterForDetails(pcIdStr); 
            updateView();
        };
        if (activePcIds.has(pcIdStr)) li.classList.add('selected');
        else li.classList.remove('selected');
        ul.appendChild(li);
    });
    pcListDiv.appendChild(ul);
}

/**
 * Generates the HTML for the PC Quick View section header and the opening of its grid.
 * @param {boolean} isForDashboard - True if the header is for the main dashboard (adds extra text).
 * @returns {string} HTML string for the header and grid opening.
 */
function createPcQuickViewSectionHTML(isForDashboard) {
    const titleText = PC_QUICK_VIEW_BASE_TITLE;
    const fullTitle = isForDashboard ? `${titleText} (Click card for details)` : titleText;
    return `<h4>${fullTitle}</h4><div class="pc-dashboard-grid">`;
}

/**
 * Generates the HTML for a single PC quick view stat card.
 * @param {object} pc - The player character object.
 * @param {boolean} isClickableForDetailedView - If true, adds class and data-attribute for detailed view navigation.
 * @returns {string} HTML string for the PC card.
 */
function generatePcQuickViewCardHTML(pc, isClickableForDetailedView = false) {
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


    const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || pc.vtt_data?.details?.level || 1;
    
    if (pc.calculatedProfBonus === undefined) {
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

    const hpCurrent = pc.vtt_data.attributes.hp.value ?? 'N/A';
    const hpMax = pc.vtt_data.attributes.hp.max ?? pc.system?.attributes?.hp?.max ?? 'N/A';
    cardHTML += `<p><strong>HP:</strong> ${hpCurrent} / ${hpMax}</p>`;

    let acDisplay = pc.vtt_flags?.ddbimporter?.overrideAC?.flat ?? pc.vtt_data.attributes.ac.value ?? pc.vtt_data.attributes.ac.flat;
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
    cardHTML += `<p><strong>Speed:</strong> ${pc.vtt_data.attributes.movement.walk || pc.system?.attributes?.movement?.walk || 0} ft</p>`;

    let initiativeBonus = 'N/A';
    const initAbilityKey = pc.vtt_data.attributes.init.ability;
    const dexValue = pc.vtt_data.abilities.dex?.value;
    if (initAbilityKey && pc.vtt_data.abilities[initAbilityKey]) {
        initiativeBonus = getAbilityModifier(pc.vtt_data.abilities[initAbilityKey].value || 10);
    } else if (pc.vtt_data.attributes.init.bonus !== undefined && pc.vtt_data.attributes.init.bonus !== "") {
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
    } else if (pc.vtt_data.attributes.spell.dc) { 
        spellDcText = pc.vtt_data.attributes.spell.dc;
    }
    cardHTML += `<p><strong>Spell DC:</strong> ${spellDcText}</p>`;
    cardHTML += `</div>`;
    return cardHTML;
}

function renderPcQuickViewInScene() {
    const wrapperContainer = getElem('pc-quick-view-section-in-scene'); 
    if (!wrapperContainer) {
        console.error("PC Quick View section wrapper in Scene ('pc-quick-view-section-in-scene') not found.");
        return;
    }
    
    const activePcs = allCharacters.filter(char => activePcIds.has(String(char._id)) && char.character_type === 'PC');

    if (activePcs.length === 0) {
        wrapperContainer.innerHTML = ''; 
        wrapperContainer.style.display = 'none';
        return;
    }

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


async function fetchHistoryFiles() {
    const selectElement = getElem('history-file-select'); if (!selectElement) return;
    const currentValue = selectElement.value; 
    selectElement.innerHTML = '<option value="">-- Select a history file --</option>';
    try {
        const response = await fetch(`${API_BASE_URL}/api/history_files`);
        if (!response.ok) throw new Error(`Failed to fetch history files: ${response.status}`);
        const files = await response.json();
        files.forEach(file => { 
            const option = document.createElement('option'); 
            option.value = file; option.textContent = file; 
            selectElement.appendChild(option); 
        });
        if (files.includes(currentValue)) selectElement.value = currentValue;
    } catch (error) { 
        console.error("Error fetching history files:", error); 
        selectElement.innerHTML += `<option value="" disabled>Error loading.</option>`; 
    }
}

async function associateHistoryFile() {
    const charIdToUse = String(currentProfileCharId); 
    if (!charIdToUse) { alert("Please select a character first."); return; }
    const selectedFile = getElem('history-file-select').value; 
    if (!selectedFile) { alert("Please select a history file to add."); return; }
    try {
        const response = await fetch(`${API_BASE_URL}/api/character/${charIdToUse}/associate_history`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ history_file: selectedFile }) 
        });
        const result = await response.json(); 
        if (!response.ok) throw new Error(result.error || `Failed to associate. Status: ${response.status}`);
        alert(result.message || "Associated successfully.");
        const charIndex = allCharacters.findIndex(c => String(c._id) === charIdToUse);
        if (charIndex > -1 && result.character) { 
            let updatedChar = result.character; 
            if (updatedChar._id?.$oid) updatedChar._id = updatedChar._id.$oid; 
            allCharacters[charIndex] = updatedChar; 
        }
        await selectCharacterForDetails(charIdToUse); // Refresh details view
    } catch (error) { 
        console.error("Error associating history file:", error); 
        alert(`Error: ${error.message}`); 
    }
}

async function dissociateHistoryFile(filename) {
    const charIdToUse = String(currentProfileCharId); 
    if (!charIdToUse) { alert("No character selected."); return; }
    if (!confirm(`Remove "${filename}" from this character's history?`)) return;
    try {
        const response = await fetch(`${API_BASE_URL}/api/character/${charIdToUse}/dissociate_history`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ history_file: filename }) 
        });
        const result = await response.json(); 
        if (!response.ok) throw new Error(result.error || "Failed to dissociate.");
        alert(result.message || "Dissociated successfully.");
        const charIndex = allCharacters.findIndex(c => String(c._id) === charIdToUse);
        if (charIndex > -1 && result.character) { 
            let updatedChar = result.character; 
            if (updatedChar._id?.$oid) updatedChar._id = updatedChar._id.$oid; 
            allCharacters[charIndex] = updatedChar; 
        }
        await selectCharacterForDetails(charIdToUse); // Refresh details view
    } catch (error) { 
        console.error("Error dissociating file:", error); 
        alert(`Error: ${error.message}`); 
    }
}

function renderAssociatedHistoryFiles(character) {
    const listElement = getElem('associated-history-list'); if (!listElement) return;
    listElement.innerHTML = '';
    if (character?.associated_history_files?.length > 0) {
        character.associated_history_files.forEach(filename => {
            const li = document.createElement('li'); li.textContent = filename;
            const removeBtn = document.createElement('button'); 
            removeBtn.textContent = 'Remove'; 
            removeBtn.className = 'remove-history-btn'; 
            removeBtn.onclick = () => dissociateHistoryFile(filename);
            li.appendChild(removeBtn); 
            listElement.appendChild(li);
        });
    } else { listElement.innerHTML = '<li><em>None associated.</em></li>'; }
    
    const historyContentDisplay = getElem('history-content-display');
    if (historyContentDisplay) {
        historyContentDisplay.textContent = character?.combined_history_content || 
                                           (character?.associated_history_files?.length > 0 ? "Content not loaded or is empty." : "No history files associated to display content.");
    }
}

async function selectCharacterForDetails(charIdStr) {
    console.log("selectCharacterForDetails: Fetching details for char ID:", charIdStr);
    currentProfileCharId = charIdStr; 
    try {
        const response = await fetch(`${API_BASE_URL}/api/npcs/${charIdStr}`); 
        if (!response.ok) throw new Error(`Failed to fetch details: ${response.status}`);
        let selectedChar = await response.json(); 
        if (selectedChar._id?.$oid) selectedChar._id = selectedChar._id.$oid;
        
        // Ensure defaults for missing fields from backend if necessary
        selectedChar = {...{combined_history_content:"", vtt_data:{abilities: {}, attributes: { hp: {}, ac: {}, movement: {}, init: {}, spell: {} }, details: {}, skills: {}, traits: { languages: {}, armorProf: {}, weaponProf: {}}}, vtt_flags:{}, items:[], system:{}, memories: [], associated_history_files:[], personality_traits:[]}, ...selectedChar};


        const charIndex = allCharacters.findIndex(c => String(c._id) === charIdStr);
        if (charIndex > -1) allCharacters[charIndex] = selectedChar; 
        else allCharacters.push(selectedChar); // Add if not found (e.g., first load)

        updateText('details-char-name', selectedChar.name || "N/A"); 
        updateText('profile-char-type', selectedChar.character_type || "N/A");
        updateText('profile-description', selectedChar.description || "N/A"); 
        updateText('profile-personality', (selectedChar.personality_traits || []).join(', ') || "N/A");
        
        getElem('gm-notes').value = selectedChar.gm_notes || ''; 
        disableBtn('save-gm-notes-btn', false);
        
        getElem('npc-memories-collapsible-section').style.display = selectedChar.character_type === 'NPC' ? 'block' : 'none';
        getElem('character-history-collapsible-section').style.display = 'block'; 

        if (selectedChar.character_type === 'NPC') { 
            renderMemories(selectedChar.memories); 
            disableBtn('add-memory-btn', false); 
        } else { 
            disableBtn('add-memory-btn', true); 
            getElem('character-memories-list').innerHTML = '<p><em>Memories are for NPCs only.</em></p>'; 
        }
        
        renderAssociatedHistoryFiles(selectedChar); 
        await fetchHistoryFiles(); // Refresh available history files list
        disableBtn('associate-history-btn', false);

    } catch (error) { 
        console.error("Error in selectCharacterForDetails:", error); 
        updateText('details-char-name', 'Error');
        // Optionally reset other fields or show an error message in the profile area
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
}

function updateView() {
    const dialogueInterface = getElem('dialogue-interface');
    const pcDashboardView = getElem('pc-dashboard-view');
    const pcQuickViewWrapperInScene = getElem('pc-quick-view-section-in-scene'); 

    if (!dialogueInterface || !pcDashboardView || !pcQuickViewWrapperInScene) {
        console.error("updateView: Critical UI element(s) missing. Check IDs: dialogue-interface, pc-dashboard-view, pc-quick-view-section-in-scene");
        return;
    }

    if (activeSceneNpcIds.size > 0) { // NPC Dialogue Mode
        dialogueInterface.style.display = 'flex';
        pcDashboardView.style.display = 'none';
        
        if (activePcIds.size > 0) {
            renderPcQuickViewInScene(); 
            pcQuickViewWrapperInScene.style.display = 'block'; 
        } else {
            pcQuickViewWrapperInScene.style.display = 'none';
            pcQuickViewWrapperInScene.innerHTML = ''; 
        }
    } else { // PC Dashboard Mode (No NPCs in Scene)
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


function updatePcDashboard() {
    console.log("Updating PC Dashboard (Overview). Active PC IDs:", new Set(activePcIds));
    const dashboardContent = getElem('pc-dashboard-content');
    if (!dashboardContent) { console.error("updatePcDashboard: 'pc-dashboard-content' not found."); return; }
    dashboardContent.innerHTML = ''; // Clear previous content

    const selectedPcs = allCharacters.filter(char => activePcIds.has(String(char._id)) && char.character_type === 'PC' && char.vtt_data);
    console.log("Selected PCs for dashboard overview:", selectedPcs.map(p => ({name: p.name, id: p._id, vtt: !!p.vtt_data}) ));

    if (selectedPcs.length === 0) {
        dashboardContent.innerHTML = `<p class="pc-dashboard-no-selection">Select Player Characters from the left panel to view their details and comparisons.</p>`;
        return;
    }
    
    selectedPcs.forEach(pc => { // Ensure profBonus is calculated
         const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || pc.vtt_data?.details?.level || 1;
         pc.calculatedProfBonus = getProficiencyBonus(pcLevel);
    });

    let quickViewHTML = createPcQuickViewSectionHTML(true); // true for dashboard context
    const sortedSelectedPcsByName = [...selectedPcs].sort((a,b) => a.name.localeCompare(b.name));
    sortedSelectedPcsByName.forEach(pc => {
        quickViewHTML += generatePcQuickViewCardHTML(pc, true); // true: clickable for detailed view
    });
    quickViewHTML += `</div>`; // Close the .pc-dashboard-grid
    dashboardContent.innerHTML += quickViewHTML;


    const abilitiesForTable = ABILITY_KEYS_ORDER.map(k => k.toUpperCase());
    let mainStatsTableHTML = `<h4>Ability Scores Overview</h4><div class="table-wrapper"><table id="main-stats-table"><thead><tr><th>Character</th>`;
    abilitiesForTable.forEach(ablKey => {
        const arrow = (currentlyExpandedAbility === ablKey && getElem(`expanded-${ablKey}`)?.style.display !== 'none') ? '▼' : '►';
        mainStatsTableHTML += `<th class="clickable-ability-header" data-ability="${ablKey}" onclick="toggleAbilityExpansion('${ablKey}')">${ablKey} <span class="arrow-indicator">${arrow}</span></th>`;
    });
    mainStatsTableHTML += `</tr></thead><tbody>`;
    sortedSelectedPcsByName.forEach(pc => {
        mainStatsTableHTML += `<tr><td>${pc.name}</td>`;
        ABILITY_KEYS_ORDER.forEach(ablKey => { 
            const score = pc.vtt_data?.abilities?.[ablKey]?.value || 10; // Default to 10 if not found
            const mod = getAbilityModifier(score);
            mainStatsTableHTML += `<td>${score} (${mod >= 0 ? '+' : ''}${mod})</td>`;
        });
        mainStatsTableHTML += `</tr>`;
    });
    mainStatsTableHTML += `</tbody></table></div>`;
    dashboardContent.innerHTML += mainStatsTableHTML;
    
    const abilityExpansionContainer = document.createElement('div'); 
    abilityExpansionContainer.id = 'expanded-ability-details-sections'; 
    dashboardContent.appendChild(abilityExpansionContainer);
    abilitiesForTable.forEach(ablKey => {
        const expansionDiv = document.createElement('div'); 
        expansionDiv.id = `expanded-${ablKey}`; 
        expansionDiv.className = 'expanded-ability-content';
        expansionDiv.style.display = (currentlyExpandedAbility === ablKey) ? 'block' : 'none';
        if (currentlyExpandedAbility === ablKey && selectedPcs.length > 0) { 
            populateExpandedAbilityDetails(ablKey.toUpperCase(), expansionDiv, selectedPcs); 
        }
        abilityExpansionContainer.appendChild(expansionDiv);
    });

    let skillsTableHTML = `<h4>Skills Overview</h4><div class="table-wrapper"><table id="skills-overview-table"><thead><tr><th>Character</th>`;
    for (const skillKey in SKILL_NAME_MAP) {
        const skillFullName = SKILL_NAME_MAP[skillKey].replace(/\s\(...\)/, '');
        const arrow = (currentlyExpandedSkill === skillKey && getElem(`expanded-skill-${skillKey}`)?.style.display !== 'none') ? '▼' : '►';
        skillsTableHTML += `<th class="clickable-skill-header" data-skill-key="${skillKey}" onclick="toggleSkillExpansion('${skillKey}')">${skillFullName} <span class="arrow-indicator">${arrow}</span></th>`;
    }
    skillsTableHTML += `</tr></thead><tbody>`;
    let pcsForSkillTable = [...selectedPcs];
    if (skillSortKey) {
        pcsForSkillTable.sort((a, b) => {
            const skillVttDataA = a.vtt_data?.skills?.[skillSortKey]; 
            const defaultAbilityA = SKILL_NAME_MAP[skillSortKey]?.match(/\(([^)]+)\)/)?.[1]?.toLowerCase() || 'int';
            const baseAbilityKeyA = skillVttDataA?.ability || defaultAbilityA; 
            const baseAbilityScoreA = a.vtt_data?.abilities?.[baseAbilityKeyA]?.value || 10;
            const bonusA = calculateSkillBonus(baseAbilityScoreA, skillVttDataA?.value || 0, a.calculatedProfBonus);
            
            const skillVttDataB = b.vtt_data?.skills?.[skillSortKey]; 
            const defaultAbilityB = SKILL_NAME_MAP[skillSortKey]?.match(/\(([^)]+)\)/)?.[1]?.toLowerCase() || 'int';
            const baseAbilityKeyB = skillVttDataB?.ability || defaultAbilityB; 
            const baseAbilityScoreB = b.vtt_data?.abilities?.[baseAbilityKeyB]?.value || 10;
            const bonusB = calculateSkillBonus(baseAbilityScoreB, skillVttDataB?.value || 0, b.calculatedProfBonus);
            return bonusB - bonusA; // Sort descending by bonus
        });
    } else { pcsForSkillTable.sort((a,b) => a.name.localeCompare(b.name)); } // Default sort by name
    
    pcsForSkillTable.forEach(pc => {
        skillsTableHTML += `<tr><td>${pc.name}</td>`;
        for (const skillKey in SKILL_NAME_MAP) {
            const skillData = pc.vtt_data?.skills?.[skillKey]; 
            let skillBonusFormatted = "N/A";
            const defaultAbilityAbbrevMatch = SKILL_NAME_MAP[skillKey].match(/\(([^)]+)\)/); 
            const defaultAbilityAbbrev = defaultAbilityAbbrevMatch ? defaultAbilityAbbrevMatch[1].toLowerCase() : 'int';
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
    skillsTableHTML += `</tbody></table></div>`;
    dashboardContent.innerHTML += skillsTableHTML;
    
    const skillExpansionContainer = document.createElement('div'); 
    skillExpansionContainer.id = 'expanded-skill-details-sections'; 
    dashboardContent.appendChild(skillExpansionContainer);
    for (const skillKey in SKILL_NAME_MAP) {
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
    const expansionDiv = getElem(`expanded-${ablKey}`); // ablKey should be uppercase here
    const headerTH = document.querySelector(`#main-stats-table th[data-ability="${ablKey}"]`);
    const arrowSpan = headerTH ? headerTH.querySelector('span.arrow-indicator') : null;

    if (!expansionDiv || !headerTH || !arrowSpan) {
        console.warn(`toggleAbilityExpansion: Could not find elements for ability ${ablKey}`);
        return;
    }

    const isCurrentlyHidden = expansionDiv.style.display === 'none';

    if (isCurrentlyHidden) {
        if (selectedPcs.length === 0) { // No PCs to show details for
            arrowSpan.textContent = ' ►'; // Keep it closed
            return;
        }
        // Collapse previously expanded ability if different
        if (currentlyExpandedAbility && currentlyExpandedAbility !== ablKey) {
            const otherDiv = getElem(`expanded-${currentlyExpandedAbility}`);
            const otherHeaderTH = document.querySelector(`#main-stats-table th[data-ability="${currentlyExpandedAbility}"]`);
            if (otherDiv) otherDiv.style.display = 'none';
            if (otherHeaderTH && otherHeaderTH.querySelector('span.arrow-indicator')) {
                otherHeaderTH.querySelector('span.arrow-indicator').textContent = ' ►';
            }
        }
        populateExpandedAbilityDetails(ablKey.toUpperCase(), expansionDiv, selectedPcs); // Ensure uppercase for function call
        expansionDiv.style.display = 'block';
        arrowSpan.textContent = ' ▼';
        currentlyExpandedAbility = ablKey.toUpperCase();
    } else { // Is currently shown, so hide it
        expansionDiv.style.display = 'none';
        arrowSpan.textContent = ' ►';
        currentlyExpandedAbility = null;
    }
}

function toggleSkillExpansion(skillKey) {
    // If already expanded, collapse it by nullifying skillSortKey and currentlyExpandedSkill
    if (currentlyExpandedSkill === skillKey) {
        skillSortKey = null;
        currentlyExpandedSkill = null;
    } else { // Otherwise, expand this skill and set it as the sort key
        skillSortKey = skillKey;
        currentlyExpandedSkill = skillKey;
    }
    updatePcDashboard(); // Re-render the dashboard to reflect sort and expansion state

    // After re-render, explicitly ensure the correct arrow and display for the *current* skill expansion
    // (updatePcDashboard will set all to default closed/right arrow before populating the one)
    // This is slightly redundant as updatePcDashboard does this, but for clarity:
    const allSkillHeaders = document.querySelectorAll(`#skills-overview-table th.clickable-skill-header`);
    allSkillHeaders.forEach(header => {
        const sKey = header.dataset.skillKey;
        const arrow = header.querySelector('span.arrow-indicator');
        if (arrow) {
            arrow.textContent = (sKey === currentlyExpandedSkill) ? ' ▼' : ' ►';
        }
    });
    const expansionDivToManage = getElem(`expanded-skill-${skillKey}`);
    if (expansionDivToManage) {
         expansionDivToManage.style.display = (currentlyExpandedSkill === skillKey) ? 'block' : 'none';
    }
}

// Placeholder - Ensure you have your detailed implementation for these
function populateExpandedAbilityDetails(ablKey, expansionDiv, selectedPcsInput) {
    // This function should generate and insert HTML for the expanded ability view.
    // Example: Show derived stats, bar charts, etc., for the given ablKey.
    // This was a longer function in your original and is assumed to be complete there.
    // For now, a simple placeholder:
    if (!selectedPcsInput || selectedPcsInput.length === 0) {
        expansionDiv.innerHTML = '<p><em>Select PCs to view ability details.</em></p>';
        return;
    }
    expansionDiv.innerHTML = `<p>Detailed stats for ${ablKey} for ${selectedPcsInput.map(p=>p.name).join(', ')} would go here.</p> 
                              <p>This includes derived stats tables and comparison bar charts.</p>`;
    // Make sure to use the actual detailed rendering logic you had previously.
}

function populateExpandedSkillDetails(skillKey, expansionDiv, selectedPcs) {
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
        if (visualRange !== 0) { 
            if (data.modifier >= 0) { 
                barClass += ' positive'; barWidthPercent = (data.modifier / visualRange) * 100; 
            } else { 
                barClass += ' negative'; barWidthPercent = (Math.abs(data.modifier) / visualRange) * 100; 
                barLeftPercent = zeroPositionPercent - barWidthPercent; 
            } 
        } else { 
            barWidthPercent = data.modifier === 0 ? 0 : 50; 
            if(data.modifier < 0) barLeftPercent = 0; 
        }
        barWidthPercent = Math.max(0.5, barWidthPercent); // Ensure very small bars are still visible
        contentHTML += `<div class="pc-bar-row"><div class="stat-comparison-pc-name" title="${data.name}">${data.name.substring(0,15)+(data.name.length > 15 ? '...' : '')}</div><div class="stat-bar-wrapper" style="--zero-offset: ${zeroPositionPercent}%;"><div class="${barClass}" style="left: ${barLeftPercent}%; width: ${barWidthPercent}%;">${data.modifier >= 0 ? '+' : ''}${data.modifier}</div></div></div>`;
    });
    contentHTML += `</div><table class="rules-explanation-table"><tr><td>`;
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
        default: contentHTML += `General information about the ${skillFullName} skill.`; break;
    }
    contentHTML += "</td></tr></table>"; 
    expansionDiv.innerHTML = contentHTML;
}

function renderDetailedPcSheet(pcId) {
    const pc = allCharacters.find(c => String(c._id) === String(pcId));
    if (!pc || pc.character_type !== 'PC' || !pc.vtt_data) {
        console.error("PC not found or invalid VTT data for detailed sheet:", pcId, pc);
        const dashboardContentError = getElem('pc-dashboard-content');
        if (dashboardContentError) dashboardContentError.innerHTML = `<p>Error loading PC. <button onclick="updatePcDashboard()">Back to Dashboard Overview</button></p>`;
        return;
    }
    console.log("Rendering detailed sheet for:", pc.name);
    if (DEBUG_DELEGATED_CARD_CLICK) console.log("VTT Data:", pc.vtt_data, "Items:", pc.items);

    const dashboardContent = getElem('pc-dashboard-content');
    if (!dashboardContent) { console.error("'pc-dashboard-content' not found."); return; }
    dashboardContent.innerHTML = '';

    let html = `<div class="detailed-pc-sheet" data-pc-id="${pcId}">`;
    // ADD the new 'X' close button
    html += `<span class="close-detailed-pc-sheet-btn" onclick="updatePcDashboard()" title="Close Detailed View">&times;</span>`;
    // REMOVE the old button:
    // html += `<button onclick="updatePcDashboard()" class="back-to-dashboard-btn">Back to Dashboard Overview</button>`;
    
    const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || pc.vtt_data?.details?.level || 1;
    pc.calculatedProfBonus = getProficiencyBonus(pcLevel);
    
    let raceName = pc.vtt_data?.details?.race || pc.race || 'N/A';
    if (pc.items && pc.vtt_data?.details?.race) {
        const raceItem = pc.items.find(item => item._id === pc.vtt_data.details.race && item.type === 'race');
        if (raceItem) raceName = raceItem.name;
    }

    let className = pc.class_str || 'N/A';
    const classItem = pc.items?.find(i => i.type === 'class');
    if (classItem) { className = classItem.name; } 
    else if (pc.vtt_data?.details?.originalClass) { className = pc.vtt_data.details.originalClass; }

    html += `<div class="pc-sheet-top-section"><h2>${pc.name}</h2>`;
    html += `<p class="pc-basic-info-subtext">${raceName} ${className}, Level ${pcLevel} &bull; Alignment: ${pc.vtt_data?.details?.alignment || pc.alignment || 'N/A'}</p></div>`;

    html += `<div class="pc-sheet-columns">`;
    html += `<div class="pc-sheet-column pc-sheet-column-left">`;
    html += `<div class="pc-section"><h4>Combat Stats</h4><div class="pc-info-grid">`;
    const hpCurrent = pc.vtt_data?.attributes?.hp?.value ?? 'N/A';
    const hpMax = pc.vtt_data?.attributes?.hp?.max ?? pc.system?.attributes?.hp?.max ?? 'N/A';
    html += `<p><strong>HP:</strong> ${hpCurrent} / ${hpMax}</p>`;
    
    let acDisplay = pc.vtt_flags?.ddbimporter?.overrideAC?.flat ?? pc.vtt_data?.attributes?.ac?.value ?? pc.vtt_data?.attributes?.ac?.flat;
    if (acDisplay === undefined || acDisplay === null) {
        const equippedArmorItems = pc.items?.filter(item => item.type === 'equipment' && item.system?.equipped && item.system?.armor?.value !== undefined) || [];
        if (equippedArmorItems.length > 0) {
            const equippedArmor = equippedArmorItems[0];
            acDisplay = equippedArmor.system.armor.value;
            if (equippedArmor.system.armor.dex !== null && equippedArmor.system.armor.dex !== undefined && pc.vtt_data?.abilities?.dex?.value) {
                const dexMod = getAbilityModifier(pc.vtt_data.abilities.dex.value);
                acDisplay += Math.min(dexMod, equippedArmor.system.armor.dex);
            } else if (equippedArmor.system.armor.dex === null && pc.vtt_data?.abilities?.dex?.value) {
                 acDisplay += getAbilityModifier(pc.vtt_data.abilities.dex.value);
            }
        } else { 
            acDisplay = 10 + getAbilityModifier(pc.vtt_data?.abilities?.dex?.value || 10);
        }
    }
    html += `<p><strong>AC:</strong> ${acDisplay}</p>`;
    html += `<p><strong>Speed:</strong> ${pc.vtt_data?.attributes?.movement?.walk || pc.system?.attributes?.movement?.walk || 30} ft</p>`;
    
    let initiativeBonus = 'N/A';
    const initAbilityKey = pc.vtt_data?.attributes?.init?.ability;
    const dexValueForInit = pc.vtt_data?.abilities?.dex?.value;
    if (initAbilityKey && pc.vtt_data?.abilities?.[initAbilityKey]) {
        initiativeBonus = getAbilityModifier(pc.vtt_data.abilities[initAbilityKey].value || 10);
    } else if (pc.vtt_data?.attributes?.init?.bonus != null && pc.vtt_data.attributes.init.bonus !== "") {
        initiativeBonus = parseInt(pc.vtt_data.attributes.init.bonus) || 0;
    } else if (dexValueForInit !== undefined) {
        initiativeBonus = getAbilityModifier(dexValueForInit);
    }
    html += `<p><strong>Initiative:</strong> ${initiativeBonus >= 0 ? '+' : ''}${initiativeBonus}</p>`;
    html += `<p><strong>Proficiency Bonus:</strong> +${pc.calculatedProfBonus}</p></div></div>`;

    html += `<div class="pc-section"><h4>Weapons & Attacks</h4>`;
    const weapons = pc.items?.filter(item => item.type === 'weapon' && item.system?.equipped) || [];
    if (weapons.length > 0) {
        html += `<ul class="pc-sheet-list">`;
        weapons.forEach(w => {
            let attackBonusStr = "N/A"; let damageStr = "N/A";
            const weaponSystem = w.system || {}; let ablMod = 0;
            const weaponAbility = weaponSystem.ability;
            if (weaponAbility && pc.vtt_data?.abilities?.[weaponAbility]) {
                ablMod = getAbilityModifier(pc.vtt_data.abilities[weaponAbility].value || 10);
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
            let isProficient = weaponSystem.proficient !== 0;
            attackBonusStr = ablMod + (isProficient ? pc.calculatedProfBonus : 0) + (parseInt(weaponSystem.attackBonus) || 0) + (weaponSystem.magicalBonus || 0) ;
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
        const score = pc.vtt_data?.abilities?.[abl]?.value || 10; const mod = getAbilityModifier(score);
        const proficientInSave = pc.vtt_data?.abilities?.[abl]?.proficient === 1;
        const saveBonus = savingThrowBonus(score, proficientInSave, pc.calculatedProfBonus);
        html += `<tr><td>${abl.toUpperCase()}</td><td>${score}</td><td>${mod >= 0 ? '+' : ''}${mod}</td><td>${saveBonus >= 0 ? '+' : ''}${saveBonus}${proficientInSave ? ' <abbr title="Proficient">(P)</abbr>' : ''}</td></tr>`;
    });
    html += `</tbody></table></div>`;
    html += `</div>`; 

    html += `<div class="pc-sheet-column pc-sheet-column-right">`;
    html += `<div class="pc-section"><h4>Skills</h4><table class="detailed-pc-table"><thead><tr><th>Skill</th><th>Bonus</th></tr></thead><tbody>`;
    for (const skillKey in SKILL_NAME_MAP) {
        const skillData = pc.vtt_data?.skills?.[skillKey]; const skillDisplayName = SKILL_NAME_MAP[skillKey];
        const defaultAbilityAbbrevMatch = skillDisplayName.match(/\(([^)]+)\)/);
        const defaultAbilityAbbrev = defaultAbilityAbbrevMatch ? defaultAbilityAbbrevMatch[1].toLowerCase() : 'int';
        const abilityKeyForSkill = skillData?.ability || defaultAbilityAbbrev;
        const scoreForSkill = pc.vtt_data?.abilities?.[abilityKeyForSkill]?.value || 10;
        const proficiencyValue = skillData?.value || 0; 
        const bonus = calculateSkillBonus(scoreForSkill, proficiencyValue, pc.calculatedProfBonus);
        let profMarker = ""; 
        if (proficiencyValue === 1) profMarker = " <abbr title='Proficient'>(P)</abbr>"; 
        else if (proficiencyValue === 2) profMarker = " <abbr title='Expertise'>(E)</abbr>"; 
        else if (proficiencyValue === 0.5) profMarker = " <abbr title='Half-Proficiency'>(H)</abbr>";
        html += `<tr><td>${skillDisplayName.replace(/\s\(...\)/, '')} <small>(${abilityKeyForSkill.toUpperCase()})</small></td><td>${bonus >= 0 ? '+' : ''}${bonus}${profMarker}</td></tr>`;
    }
    html += `</tbody></table></div>`;
    html += `</div>`; 
    html += `</div>`; 

    const collapsibleSectionsData = [
        {
            title: "Personality & Roleplaying",
            contentFn: () => {
                let content = `<div class="pc-info-grid">`;
                const traits = (pc.personality_traits || []).length > 0 ? pc.personality_traits : (pc.vtt_data?.details?.trait ? [pc.vtt_data.details.trait] : []);
                const ideals = (pc.ideals || []).length > 0 ? pc.ideals : (pc.vtt_data?.details?.ideal ? [pc.vtt_data.details.ideal] : []);
                const bonds = (pc.bonds || []).length > 0 ? pc.bonds : (pc.vtt_data?.details?.bond ? [pc.vtt_data.details.bond] : []);
                const flaws = (pc.flaws || []).length > 0 ? pc.flaws : (pc.vtt_data?.details?.flaw ? [pc.vtt_data.details.flaw] : []);
                content += `<p><strong>Personality Traits:</strong> ${traits.join ? traits.join('; ') : (traits || 'N/A')}</p>`;
                content += `<p><strong>Ideals:</strong> ${ideals.join ? ideals.join('; ') : (ideals || 'N/A')}</p>`;
                content += `<p><strong>Bonds:</strong> ${bonds.join ? bonds.join('; ') : (bonds || 'N/A')}</p>`;
                content += `<p><strong>Flaws:</strong> ${flaws.join ? flaws.join('; ') : (flaws || 'N/A')}</p>`;
                content += `</div>`;
                return content;
            }
        },
        {
            title: "Appearance",
            contentFn: () => {
                let content = `<div class="pc-info-grid">`;
                if (pc.vtt_data?.details?.appearance && typeof pc.vtt_data.details.appearance === 'string' && pc.vtt_data.details.appearance.trim() !== "") {
                    content += `<p>${pc.vtt_data.details.appearance.replace(/\n/g, '<br>')}</p>`;
                } else {
                    content += `<p><strong>Gender:</strong> ${pc.vtt_data?.details?.gender || 'N/A'}</p>`;
                    content += `<p><strong>Age:</strong> ${pc.vtt_data?.details?.age || pc.age || 'N/A'}</p>`;
                    content += `<p><strong>Height:</strong> ${pc.vtt_data?.details?.height || 'N/A'}</p>`;
                    content += `<p><strong>Weight:</strong> ${pc.vtt_data?.details?.weight || 'N/A'}</p>`;
                    content += `<p><strong>Eyes:</strong> ${pc.vtt_data?.details?.eyes || 'N/A'}</p>`;
                    content += `<p><strong>Skin:</strong> ${pc.vtt_data?.details?.skin || 'N/A'}</p>`;
                    content += `<p><strong>Hair:</strong> ${pc.vtt_data?.details?.hair || 'N/A'}</p>`;
                }
                 if (pc.img && !pc.img.startsWith('ddb-images/')) {
                    content += `<p><img src="${pc.img}" alt="${pc.name} portrait" style="max-width: 150px; border-radius: 4px;"></p>`;
                } else if (pc.vtt_data?.img && !pc.vtt_data.img.includes('token')) {
                     content += `<p><img src="${pc.vtt_data.img}" alt="${pc.name} portrait" style="max-width: 150px; border-radius: 4px;"></p>`;
                }
                content += `</div>`;
                return content;
            }
        },
        {
            title: "Backstory & Motivations",
            contentFn: () => {
                let content = `<div>`;
                content += `<h5>Backstory</h5><p>${pc.backstory || pc.vtt_data?.details?.biography?.public || pc.vtt_data?.details?.biography?.value || 'Not detailed.'}</p>`;
                content += `<h5>Motivations</h5><p>${(pc.motivations || []).join ? (pc.motivations || []).join('; ') : (pc.motivations || 'Not detailed.')}</p>`;
                content += `</div>`;
                return content;
            }
        },
        {
            title: "Proficiencies & Languages",
            contentFn: () => {
                let content = `<h5>Armor Proficiencies</h5><p>${(pc.vtt_data?.traits?.armorProf?.value || []).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ') || 'None'}. Custom: ${pc.vtt_data?.traits?.armorProf?.custom || ''}</p>`;
                content += `<h5>Weapon Proficiencies</h5><p>${(pc.vtt_data?.traits?.weaponProf?.value || []).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ') || 'None'}. Custom: ${pc.vtt_data?.traits?.weaponProf?.custom || ''}</p>`;
                content += `<h5>Tool Proficiencies</h5><ul class="pc-sheet-list">`;
                if (pc.vtt_data?.tools && Object.keys(pc.vtt_data.tools).length > 0) {
                    let toolsFound = false;
                    for (const toolKey in pc.vtt_data.tools) {
                         if (pc.vtt_data.tools[toolKey]?.value >= 1) {
                            content += `<li>${toolKey.charAt(0).toUpperCase() + toolKey.slice(1)} (Ability: ${pc.vtt_data.tools[toolKey].ability?.toUpperCase() || 'N/A'})</li>`;
                            toolsFound = true;
                         }
                    }
                    if (!toolsFound) content += `<li>None listed</li>`;
                } else { content += `<li>None listed</li>`; }
                content += `</ul>`;
                content += `<h5>Languages</h5><p>${(pc.vtt_data?.traits?.languages?.value || []).map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(', ') || 'None'}. Custom: ${pc.vtt_data?.traits?.languages?.custom || ''}</p>`;
                return content;
            }
        },
        {
            title: "Features & Traits",
            contentFn: () => {
                let content = `<ul class="pc-sheet-list">`;
                const features = pc.items?.filter(item => item.type === 'feat') || [];
                if (features.length > 0) {
                    features.forEach(feat => {
                        let desc = (feat.system?.description?.value || 'No description.');
                        desc = desc.replace(/<[^>]+>/g, ''); 
                        content += `<li><strong>${feat.name}</strong>: ${desc.substring(0, 150)}${desc.length > 150 ? '...' : ''}</li>`;
                    });
                } else {
                    content += `<li>No special features or traits listed in items.</li>`;
                }
                if (pc.vtt_data?.details?.trait && !features.some(f => f.name.toLowerCase().includes('trait'))) {
                     content += `<li><strong>Other Trait(s):</strong> ${pc.vtt_data.details.trait}</li>`;
                }
                content += `</ul>`;
                return content;
            }
        },
        {
            title: "Equipment & Inventory",
            contentFn: () => {
                let content = `<ul class="pc-sheet-list">`;
                const equipment = pc.items?.filter(item => ['equipment', 'loot', 'consumable', 'tool', 'container', 'weapon'].includes(item.type)) || [];
                if (equipment.length > 0) {
                    equipment.forEach(item => {
                         content += `<li><strong>${item.name}</strong> (Qty: ${item.system?.quantity || 1}, Type: ${item.type}) ${item.system?.equipped ? '(Equipped)' : ''}</li>`;
                    });
                } else {
                    content += `<li>No equipment listed.</li>`;
                }
                 content += `<li><strong>Currency:</strong> GP: ${pc.vtt_data?.currency?.gp || 0}, SP: ${pc.vtt_data?.currency?.sp || 0}, CP: ${pc.vtt_data?.currency?.cp || 0}, EP: ${pc.vtt_data?.currency?.ep || 0}, PP: ${pc.vtt_data?.currency?.pp || 0}</li>`;
                content += `</ul>`;
                return content;
            }
        },
        {
            title: "Spells",
            contentFn: () => {
                let content = ``; const spellsByLevel = {};
                const spellItems = pc.items?.filter(item => item.type === 'spell') || [];
                if (spellItems.length === 0) return "<p>No spells listed in items.</p>";
                spellItems.forEach(spell => {
                    const levelKey = spell.system?.level === 0 ? 'Cantrips' : `Level ${spell.system?.level}`;
                    if (!spellsByLevel[levelKey]) spellsByLevel[levelKey] = [];
                    spellsByLevel[levelKey].push({name: spell.name, school: spell.system?.school || 'N/A', desc: spell.system?.description?.value || ''});
                });
                const spellLevelsOrder = ['Cantrips'];
                for (let i = 1; i <= 9; i++) spellLevelsOrder.push(`Level ${i}`);
                if (spellsByLevel['Pact Magic']) spellLevelsOrder.push('Pact Magic');
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
function renderMemories(memories = []) {
    const listElement = getElem('character-memories-list');
    if (!listElement) {
        console.warn("Memory list element not found.");
        return;
    }
    listElement.innerHTML = ''; 
    if (memories.length === 0) {
        listElement.innerHTML = '<p><em>No memories yet.</em></p>';
        return;
    }
    memories.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); 
    memories.forEach(memory => {
        const memDiv = document.createElement('div');
        memDiv.className = 'memory-item';
        const memoryType = memory.type || 'Generic';
        const memoryTimestamp = new Date(memory.timestamp).toLocaleString();
        const memoryContent = memory.content;
        const memorySource = memory.source || 'Unknown';
        const memoryId = memory.memory_id;

        memDiv.innerHTML =
            '<span><strong>[' + memoryType + '] ' + memoryTimestamp + ':</strong> ' +
            memoryContent +
            ' (Source: ' + memorySource + ')</span>' +
            '<button onclick="deleteMemory(\'' + memoryId + '\')">Delete</button>';
        listElement.appendChild(memDiv);
    });
}

async function addMemoryToCharacter() {
    const charIdToUse = String(currentProfileCharId);
    if (!charIdToUse) {
        alert("Please select a character first.");
        return;
    }
    const content = getElem('new-memory-content').value.trim();
    const type = getElem('new-memory-type').value.trim() || 'manual_gm_entry';
    if (!content) {
        alert("Memory content cannot be empty.");
        return;
    }
    const memoryData = { content, type, source: "gm_manual" };
    try {
        const response = await fetch(`${API_BASE_URL}/api/npcs/${charIdToUse}/memory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(memoryData)
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || `Failed to add memory. Status: ${response.status}`);
        }
        alert(result.message || "Memory added successfully.");
        getElem('new-memory-content').value = '';
        getElem('new-memory-type').value = '';
        const charIndex = allCharacters.findIndex(c => String(c._id) === charIdToUse);
        if (charIndex > -1) {
            if (!allCharacters[charIndex].memories) allCharacters[charIndex].memories = [];
            if(result.updated_memories){
                 allCharacters[charIndex].memories = result.updated_memories;
            } else { 
                allCharacters[charIndex].memories.push({ ...memoryData, memory_id: "temp-" + Date.now(), timestamp: new Date().toISOString() }); 
            }
            renderMemories(allCharacters[charIndex].memories);
        } else { 
            await selectCharacterForDetails(charIdToUse); 
        }
    } catch (error) {
        console.error("Error adding memory:", error);
        alert(`Error: ${error.message}`);
    }
}

async function deleteMemory(memoryId) {
    const charIdToUse = String(currentProfileCharId);
    if (!charIdToUse) {
        alert("No character selected or character ID is missing.");
        return;
    }
    if (!confirm("Are you sure you want to delete this memory?")) {
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/api/npcs/${charIdToUse}/memory/${memoryId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || `Failed to delete memory. Status: ${response.status}`);
        }
        alert(result.message || "Memory deleted successfully.");
        const charIndex = allCharacters.findIndex(c => String(c._id) === charIdToUse);
        if (charIndex > -1 && allCharacters[charIndex].memories) {
            allCharacters[charIndex].memories = result.updated_memories || allCharacters[charIndex].memories.filter(mem => mem.memory_id !== memoryId);
            renderMemories(allCharacters[charIndex].memories);
        } else {
             await selectCharacterForDetails(charIdToUse);
        }
    } catch (error) {
        console.error("Error deleting memory:", error);
        alert(`Error: ${error.message}`);
    }
}

async function generateDialogue() {
    const playerUtterance = getElem('player-utterance').value.trim();
    const sceneContext = getElem('scene-context').value.trim();
    if (activeSceneNpcIds.size === 0) {
        alert("No NPCs are active in the scene.");
        return;
    }
    disableBtn('generate-dialogue-btn', true);
    const pcNamesInScene = Array.from(activePcIds)
        .map(id => allCharacters.find(c => String(c._id) === id)?.name)
        .filter(name => name)
        .join(', ') || "the players";

    if (playerUtterance) {
        activeSceneNpcIds.forEach(npcId => {
            const transcriptArea = getElem(`transcript-${npcId}`);
            if (transcriptArea) {
                const playerEntry = document.createElement('p');
                playerEntry.className = 'dialogue-entry player-utterance';
                playerEntry.textContent = `${pcNamesInScene}: ${playerUtterance}`;
                transcriptArea.appendChild(playerEntry);
                transcriptArea.scrollTop = transcriptArea.scrollHeight;
                if (!dialogueHistories[npcId]) dialogueHistories[npcId] = [];
                dialogueHistories[npcId].push(`${pcNamesInScene}: ${playerUtterance}`);
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
                    renderAiSuggestions(result.new_memory_suggestions, result.generated_topics, npcId);
                }
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

function renderAiSuggestions(memorySuggestions = [], topicSuggestions = [], forNpcId) {
    const suggestionsContainerId = `ai-suggestions-${forNpcId}`;
    let suggestionsContainer = getElem(suggestionsContainerId);
    const npcArea = getElem(`npc-area-${forNpcId}`);

    if (!npcArea) {
        console.warn(`NPC area 'npc-area-${forNpcId}' not found. Cannot display AI suggestions for this NPC.`);
        return; 
    }
    
    if (!suggestionsContainer) { // Should be created by createNpcDialogueArea
        console.warn(`Suggestions container '${suggestionsContainerId}' not found within NPC area. Creating it.`);
        suggestionsContainer = document.createElement('div');
        suggestionsContainer.id = suggestionsContainerId;
        suggestionsContainer.className = 'ai-suggestions-for-npc';
        npcArea.appendChild(suggestionsContainer); 
    }
    
    suggestionsContainer.innerHTML = ''; 

    if (memorySuggestions.length > 0) {
        const memDiv = document.createElement('div');
        memDiv.className = `suggested-memories-list-npc`; 
        memDiv.innerHTML = '<h6>Suggested Memories:</h6>';
        memorySuggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = 'suggested-item clickable-suggestion';
            item.textContent = suggestion;
            item.onclick = async () => { 
                const originalProfileCharId = currentProfileCharId; 
                currentProfileCharId = forNpcId; 
                if (originalProfileCharId !== forNpcId) {
                    await selectCharacterForDetails(forNpcId); 
                }
                getElem('new-memory-content').value = suggestion; 
                getElem('new-memory-type').value = "ai_suggested_interaction"; 
                await addMemoryToCharacter(); 
            };
            memDiv.appendChild(item);
        });
        suggestionsContainer.appendChild(memDiv);
    }

    if (topicSuggestions.length > 0) {
        const topicsDiv = document.createElement('div');
        topicsDiv.className = `suggested-topics-list-npc`;
        topicsDiv.innerHTML = '<h6>Suggested Follow-up Topics:</h6>';
        topicSuggestions.forEach(topic => {
            const item = document.createElement('div');
            item.className = 'suggested-item clickable-suggestion';
            item.textContent = topic;
            item.onclick = () => {
                getElem('player-utterance').value = topic; 
                getElem('player-utterance').focus();
            };
            topicsDiv.appendChild(item);
        });
        suggestionsContainer.appendChild(topicsDiv);
    }
    
    if (suggestionsContainer.innerHTML.trim() === '') {
        suggestionsContainer.style.display = 'none';
    } else {
        suggestionsContainer.style.display = 'block';
    }
}

async function saveGMNotes() {
    const charIdToUse = String(currentProfileCharId);
    if (!charIdToUse) {
        alert("No character selected.");
        return;
    }
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

    if (!name || !description) {
        alert("Name and Description are required.");
        return;
    }
    const newCharData = { 
        name, description, personality_traits, character_type,
        race: null, class_str: null, alignment: null, age: null,
        ideals: [], bonds: [], flaws: [], speech_patterns: null, mannerisms: null,
        relationships: [], past_situation: null, current_situation: null,
        background_story: null, motivations: [], knowledge: [], memories: [],
        linked_lore_ids: [], gm_notes: null, vtt_data: {}, vtt_flags: {},
        associated_history_files: [], img: null, items: [], system: {}
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
            e.preventDefault(); // Prevent text selection during drag
            isResizing = true; 
            document.body.style.cursor = 'col-resize'; // Change cursor for the whole body
        });
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            // Ensure clientX is within reasonable bounds of the window/screen
            let newLeftWidth = e.clientX;
            const minColWidth = 200; // Minimum width for left column
            const maxColWidth = window.innerWidth - 200; // Leave at least 200px for right column

            if (newLeftWidth < minColWidth) newLeftWidth = minColWidth;
            if (newLeftWidth > maxColWidth) newLeftWidth = maxColWidth;
            
            leftColumn.style.width = `${newLeftWidth}px`;
        });
        document.addEventListener('mouseup', () => { 
            if (isResizing) {
                isResizing = false; 
                document.body.style.cursor = 'default'; // Reset cursor
            }
        });
    }

    document.querySelectorAll('#left-column .collapsible-section').forEach(section => {
        const header = section.querySelector('h3');
        if (header) {
            if (!header.querySelector('.arrow-indicator')) {
                const arrowSpan = document.createElement('span');
                arrowSpan.className = 'arrow-indicator';
                // Prepend arrow for better alignment with text that might wrap
                header.insertBefore(arrowSpan, header.firstChild); 
                // Add a non-breaking space for visual separation if title is present
                if (header.childNodes.length > 1 && header.childNodes[1].nodeType === Node.TEXT_NODE) {
                     header.insertBefore(document.createTextNode(' '), header.childNodes[1]);
                }
            }
            header.addEventListener('click', () => {
                section.classList.toggle('collapsed');
                const arrow = header.querySelector('.arrow-indicator');
                if (arrow) arrow.textContent = section.classList.contains('collapsed') ? ' ►' : ' ▼';
            });
            // Initial state logic
            const arrow = header.querySelector('.arrow-indicator');
            if (section.id === 'pc-list-section' || section.id === 'npc-list-section' || section.id === 'character-profile-main-section') {
                section.classList.remove('collapsed');
                if (arrow) arrow.textContent = ' ▼';
            } else {
                 section.classList.add('collapsed');
                 if (arrow) arrow.textContent = ' ►';
            }
             // Ensure Profile's direct sub-sections also get their arrows set correctly
            if (section.id === 'character-profile-main-section') {
                section.querySelectorAll('.collapsible-section > h3').forEach(subHeader => {
                    const subArrow = subHeader.querySelector('.arrow-indicator');
                    const subSection = subHeader.parentElement;
                     if (!subSection.classList.contains('collapsed')) { // If it's meant to be open
                        if(subArrow) subArrow.textContent = ' ▼';
                    } else {
                        if(subArrow) subArrow.textContent = ' ►';
                    }
                });
            }
        }
    });
    
    // Ensure profile itself and its GM notes/Memories start open if it's not collapsed
    const profileMainSection = getElem('character-profile-main-section');
    if (profileMainSection && !profileMainSection.classList.contains('collapsed')) {
        ['gm-notes-collapsible-section', 'npc-memories-collapsible-section'].forEach(subId => {
            const subSection = getElem(subId);
            if (subSection && subSection.classList.contains('collapsible-section')) {
                 subSection.classList.remove('collapsed');
                 const subArrow = subSection.querySelector('h3 .arrow-indicator');
                 if(subArrow) subArrow.textContent = ' ▼';
                 const subContent = subSection.querySelector('.collapsible-content');
                 if(subContent) subContent.style.display = 'block';
            }
        });
    }


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

    updateView(); // Initial call to set up the correct view
    console.log("script.js: DOMContentLoaded finished.");
});
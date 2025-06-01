// uiRenderers.js
// Responsibility: Functions that manipulate the DOM to display data.
// Assumes utils.js, config.js, dndCalculations.js, and appState.js are available.


// uiRenderers.js

// --- UTILITY/HELPER RENDERERS (used by multiple main renderers) ---
function createPcQuickViewSectionHTML(isForDashboard) {
    const titleText = PC_QUICK_VIEW_BASE_TITLE; // From config.js
    const fullTitle = isForDashboard ? `${titleText} (Click card for details)` : titleText;
    return `<h4>${fullTitle}</h4><div class="pc-dashboard-grid">`;
}

function generatePcQuickViewCardHTML(pc, isClickableForDetailedView = false) {
    if (!pc) return '';
    pc.vtt_data = pc.vtt_data || { abilities: {}, attributes: { hp: {}, ac: {}, movement: {}, init: {}, spell: {} }, details: {}, skills: {}, traits: { languages: {}, armorProf: {}, weaponProf: {}} };
    pc.vtt_data.abilities = pc.vtt_data.abilities || {};
    pc.vtt_data.attributes = pc.vtt_data.attributes || { hp: {}, ac: {}, movement: {}, init: {}, spell: {} };
    pc.vtt_data.attributes.hp = pc.vtt_data.attributes.hp || {};
    pc.vtt_data.attributes.ac = pc.vtt_data.attributes.ac || {};
    // ... (ensure all nested vtt_data checks from your original script are here) ...

    const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || pc.vtt_data?.details?.level || 1;
    if (pc.calculatedProfBonus === undefined) {
        pc.calculatedProfBonus = window.getProficiencyBonus(pcLevel); // Explicitly use window
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
        const equippedArmor = pc.items?.find(item => item.type === 'equipment' && item.system?.equipped && item.system?.armor?.value !== undefined);
        if (equippedArmor && equippedArmor.system?.armor) {
            acDisplay = equippedArmor.system.armor.value;
            const dexForAC = pc.vtt_data.abilities.dex?.value;
            if (equippedArmor.system.armor.dex !== null && equippedArmor.system.armor.dex !== undefined && dexForAC) {
                const dexMod = window.getAbilityModifier(dexForAC); // Explicitly use window
                acDisplay += Math.min(dexMod, equippedArmor.system.armor.dex);
            } else if (equippedArmor.system.armor.dex === null && dexForAC) {
                 acDisplay += window.getAbilityModifier(dexForAC); // Explicitly use window
            }
        } else {
            acDisplay = 10 + window.getAbilityModifier(pc.vtt_data.abilities.dex?.value || 10); // Explicitly use window
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
    } else if (pc.vtt_data.attributes.init?.bonus !== undefined && pc.vtt_data.attributes.init.bonus !== "") {
        initiativeBonus = parseInt(pc.vtt_data.attributes.init.bonus) || 0;
    } else if (dexValue !== undefined) {
        initiativeBonus = window.getAbilityModifier(dexValue);
    }
    cardHTML += `<p><strong>Initiative:</strong> ${initiativeBonus >= 0 ? '+' : ''}${initiativeBonus}</p>`;

    const spellcastingAbilityKey = pc.system?.attributes?.spellcasting || pc.vtt_data.attributes.spellcasting;
    let spellDcText = "N/A";
    if (spellcastingAbilityKey && pc.vtt_data.abilities[spellcastingAbilityKey]?.value !== undefined) {
        const castingScore = pc.vtt_data.abilities[spellcastingAbilityKey].value || 10;
        spellDcText = window.spellSaveDC(castingScore, pc.calculatedProfBonus); // Explicitly use window
    } else if (pc.vtt_data.attributes.spell?.dc) {
        spellDcText = pc.vtt_data.attributes.spell.dc;
    }
    cardHTML += `<p><strong>Spell DC:</strong> ${spellDcText}</p>`;
    cardHTML += `</div>`;
    return cardHTML;
}

// --- PC Dashboard Rendering ---
function populateExpandedAbilityDetailsUI(ablKey, expansionDiv, selectedPcsInput) {
    // (Copied from previous response - ensure ABILITY_KEYS_ORDER from config.js and calculation functions from dndCalculations.js are globally accessible or passed)
    if (!expansionDiv || !selectedPcsInput || selectedPcsInput.length === 0) {
        if(expansionDiv) expansionDiv.innerHTML = '<p><em>Select PCs to view ability details.</em></p>';
        return;
    }
    expansionDiv.innerHTML = `<h5>Derived Stats for ${ablKey}</h5>`;
    let derivedTable = `<table class="derived-stats-table">`;
    derivedTable += `<tr><th>Stat</th>${selectedPcsInput.map(p => `<th>${p.name.substring(0,10)+(p.name.length > 10 ? '...' : '')}</th>`).join('')}</tr>`;

    const ablKeyLower = ablKey.toLowerCase();
    if (ablKeyLower === 'str') {
        derivedTable += `<tr><td>Carrying Capacity</td>${selectedPcsInput.map(p => `<td>${window.carryingCapacity(p.vtt_data?.abilities?.str?.value)} lbs</td>`).join('')}</tr>`;
        derivedTable += `<tr><td>Push/Drag/Lift</td>${selectedPcsInput.map(p => `<td>${window.pushDragLift(p.vtt_data?.abilities?.str?.value)} lbs</td>`).join('')}</tr>`;
        derivedTable += `<tr><td>Long Jump (Run)</td>${selectedPcsInput.map(p => `<td>${window.longJump(p.vtt_data?.abilities?.str?.value, true)} ft</td>`).join('')}</tr>`;
        derivedTable += `<tr><td>High Jump (Run)</td>${selectedPcsInput.map(p => `<td>${window.highJump(p.vtt_data?.abilities?.str?.value, true)} ft</td>`).join('')}</tr>`;
    } else if (ablKeyLower === 'dex') {
        derivedTable += `<tr><td>Initiative Bonus</td>${selectedPcsInput.map(p => `<td>${window.initiative(p.vtt_data?.abilities?.dex?.value)}</td>`).join('')}</tr>`;
    } else if (ablKeyLower === 'con') {
        derivedTable += `<tr><td>Hold Breath</td>${selectedPcsInput.map(p => `<td>${window.holdBreath(p.vtt_data?.abilities?.con?.value)}</td>`).join('')}</tr>`;
    }
    derivedTable += `</table>`;
    expansionDiv.innerHTML += derivedTable;

    expansionDiv.innerHTML += `<div class="ability-bar-chart-container"><h6>${ablKey} Score Comparison</h6>`;
    const abilityScores = selectedPcsInput.map(pc => ({ name: pc.name, score: pc.vtt_data?.abilities?.[ablKeyLower]?.value || 10 }));
    const allScores = abilityScores.map(d => d.score);
    const dataMin = Math.min(0, ...allScores); const dataMax = Math.max(20, ...allScores);
    const visualRange = dataMax - dataMin;

    abilityScores.sort((a,b) => b.score - a.score).forEach(data => {
        let barWidthPercent = visualRange !== 0 ? ((data.score - dataMin) / visualRange) * 100 : 50;
        barWidthPercent = Math.max(1, Math.min(100, barWidthPercent));
        expansionDiv.innerHTML += `<div class="pc-bar-row"><div class="stat-comparison-pc-name" title="${data.name}">${data.name.substring(0,15)+(data.name.length > 15 ? '...' : '')}</div><div class="stat-bar-wrapper" style="--zero-offset: 0%;"><div class="stat-bar positive" style="left: 0%; width: ${barWidthPercent}%; text-align:center;">${data.score}</div></div></div>`;
    });
    expansionDiv.innerHTML += `</div>`;
}

function populateExpandedSkillDetailsUI(skillKey, expansionDiv, selectedPcs) {
    // (Copied from previous response - ensure SKILL_NAME_MAP from config.js and calculateSkillBonus from dndCalculations.js are globally accessible or passed)
     if (!expansionDiv || !selectedPcs || selectedPcs.length === 0) {
        if(expansionDiv) expansionDiv.innerHTML = '<p><em>Select PCs to view skill details.</em></p>';
        return;
    }
    const skillFullName = SKILL_NAME_MAP[skillKey]?.replace(/\s\(...\)/, '') || skillKey.toUpperCase();
    let contentHTML = `<h5>${skillFullName} Skill Modifiers & Rules</h5><div class="skill-bar-chart-container">`;
    const skillDataForGraph = selectedPcs.map(pc => {
        const skillVttData = pc.vtt_data?.skills?.[skillKey];
        const defaultAbility = SKILL_NAME_MAP[skillKey]?.match(/\(([^)]+)\)/)?.[1]?.toLowerCase() || 'int';
        const baseAbilityKey = skillVttData?.ability || defaultAbility;
        const baseAbilityScore = pc.vtt_data?.abilities?.[baseAbilityKey]?.value || 10;
        const bonus = window.calculateSkillBonus(baseAbilityScore, skillVttData?.value || 0, pc.calculatedProfBonus);
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
        barWidthPercent = Math.max(0.5, barWidthPercent);
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

function updatePcDashboardUI(dashboardContentElement, allCharacters, activePcIds, currentlyExpandedAbility, currentlyExpandedSkill, skillSortKey) {
    // (Copied from previous response - ensure this is fully defined and uses window. for global functions if needed)
    if (!dashboardContentElement) {
        console.error("updatePcDashboardUI: 'pc-dashboard-content' element not found.");
        return;
    }
    dashboardContentElement.innerHTML = ''; // Clear existing content

    const selectedPcs = allCharacters.filter(char => activePcIds.has(String(char._id)) && char.character_type === 'PC' && char.vtt_data);

    if (selectedPcs.length === 0) {
        dashboardContentElement.innerHTML = `<p class="pc-dashboard-no-selection">Select Player Characters from the left panel to view their details and comparisons.</p>`;
        return;
    }

    selectedPcs.forEach(pc => {
        const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || pc.vtt_data?.details?.level || 1;
        pc.calculatedProfBonus = window.getProficiencyBonus(pcLevel);
    });

    let quickViewHTML = createPcQuickViewSectionHTML(true);
    const sortedSelectedPcsByName = [...selectedPcs].sort((a, b) => a.name.localeCompare(b.name));
    sortedSelectedPcsByName.forEach(pc => {
        quickViewHTML += generatePcQuickViewCardHTML(pc, true);
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
            populateExpandedAbilityDetailsUI(ablKey.toUpperCase(), expansionDiv, selectedPcs);
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
        pcsForSkillTable.sort((a, b) => { /* ... (sorting logic from original) ... */
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

            if (pc.vtt_data?.abilities?.[abilityKeyForSkill] && pc.calculatedProfBonus !== undefined) {
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
            populateExpandedSkillDetailsUI(skillKey, expansionDiv, selectedPcs);
        }
        skillExpansionContainer.appendChild(expansionDiv);
    }
}

function renderDetailedPcSheetUI(pcData, dashboardContentElement) {
    // (Ensure this is the full version from your original script, adapted)
    if (!pcData || !dashboardContentElement) {
        console.error("renderDetailedPcSheetUI: PC data or dashboard element missing.");
        if (dashboardContentElement) dashboardContentElement.innerHTML = `<p>Error loading PC. <button onclick="window.handleBackToDashboardOverview()">Back to Dashboard Overview</button></p>`;
        return;
    }
    console.log("Rendering detailed sheet for:", pcData.name);

    dashboardContentElement.innerHTML = ''; // Clear it first

    let html = `<div class="detailed-pc-sheet" data-pc-id="${pcData._id}">`;
    // IMPORTANT: Ensure handleBackToDashboardOverview is globally accessible via window or use programmatic event listener
    html += `<span class="close-detailed-pc-sheet-btn" onclick="window.handleBackToDashboardOverview()" title="Close Detailed View">&times;</span>`;

    const pcLevel = pcData.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pcData.system?.details?.level || pcData.vtt_data?.details?.level || 1;
    pcData.calculatedProfBonus = window.getProficiencyBonus(pcLevel);

    // ... (All the detailed HTML generation logic from your original renderDetailedPcSheet function) ...
    // Replace all calls to getElem within this function with direct DOM manipulation or pass necessary sub-elements.
    // For brevity, I'm not pasting the entire ~200 lines of HTML generation here, but it needs to be complete.
    // Example snippet:
    let raceName = pcData.vtt_data?.details?.race || pcData.race || 'N/A';
    // ...
    html += `<h2>${pcData.name}</h2>`;
    // ... and so on ...
    // --- Collapsible Sections Data ---
    const collapsibleSectionsData = [
        {
            title: "Personality & Roleplaying",
            contentFn: () => { /* ... original contentFn logic ... */ return "<p>Personality Content</p>"; }
        },
        // ... (ALL other collapsible sections from original: Appearance, Backstory, Proficiencies, Features, Equipment, Spells)
    ];

    collapsibleSectionsData.forEach(sectionData => {
        html += `<div class="pc-section collapsible-section collapsed">
                    <h4 style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                        ${sectionData.title} <span class="arrow-indicator">►</span>
                    </h4>
                    <div class="collapsible-content" style="display: none;">${sectionData.contentFn()}</div>
                 </div>`;
    });
    html += `</div>`; // End detailed-pc-sheet
    dashboardContentElement.innerHTML = html;

    // Re-attach collapsible listeners for the detailed sheet (use programmatic listeners)
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
}


// --- MAIN VIEW RENDERER (Ensure this is defined *after* its dependencies like updatePcDashboardUI) ---
function updateMainViewUI(dialogueInterfaceElem, pcDashboardViewElem, pcQuickViewInSceneElem, activeNpcCount, showPcDashboard) {
    if (activeNpcCount > 0) {
        dialogueInterfaceElem.style.display = 'flex';
        pcDashboardViewElem.style.display = 'none';
    } else {
        dialogueInterfaceElem.style.display = 'none';
        pcDashboardViewElem.style.display = 'block';
        pcQuickViewInSceneElem.style.display = 'none';
        pcQuickViewInSceneElem.innerHTML = '';

        const dashboardContent = window.getElem('pc-dashboard-content');
        if (dashboardContent && !dashboardContent.querySelector('.detailed-pc-sheet')) {
             if (showPcDashboard) {
                 // THIS IS THE LINE CAUSING THE ERROR IF updatePcDashboardUI ISN'T DEFINED YET
                 updatePcDashboardUI(dashboardContent, appState.getAllCharacters(), appState.activePcIds, appState.getExpandedAbility(), appState.getExpandedSkill(), appState.getSkillSortKey());
             } else {
                 dashboardContent.innerHTML = `<p class="pc-dashboard-no-selection">Select Player Characters from the left panel to view their details and comparisons.</p>`;
             }
        }
    }
}

// --- Make sure other rendering functions from the previous response are also here ---
// renderNpcListForSceneUI, renderPcListUI, createNpcDialogueAreaUI, removeNpcDialogueAreaUI,
// adjustNpcDialogueAreaWidthsUI, appendMessageToTranscriptUI, renderCharacterProfileUI,
// renderMemoriesUI, renderAssociatedHistoryFilesUI, renderPcQuickViewInSceneUI

// (The rest of your uiRenderers.js content...)

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

// uiRenderers.js (Add or complete these functions)

function createPcQuickViewSectionHTML(isForDashboard) {
    // Assumes PC_QUICK_VIEW_BASE_TITLE is available from config.js
    const titleText = PC_QUICK_VIEW_BASE_TITLE;
    const fullTitle = isForDashboard ? `${titleText} (Click card for details)` : titleText;
    return `<h4>${fullTitle}</h4><div class="pc-dashboard-grid">`; // Ensure class "pc-dashboard-grid" exists
}

// generatePcQuickViewCardHTML should already be in uiRenderers.js from the previous response

function populateExpandedAbilityDetailsUI(ablKey, expansionDiv, selectedPcsInput) {
    // Assumes ABILITY_KEYS_ORDER, getAbilityModifier, carryingCapacity, etc. from dndCalculations.js are global
    if (!expansionDiv || !selectedPcsInput || selectedPcsInput.length === 0) {
        if(expansionDiv) expansionDiv.innerHTML = '<p><em>Select PCs to view ability details.</em></p>';
        return;
    }
    expansionDiv.innerHTML = `<h5>Derived Stats for ${ablKey}</h5>`;
    let derivedTable = `<table class="derived-stats-table">`;
    derivedTable += `<tr><th>Stat</th>${selectedPcsInput.map(p => `<th>${p.name.substring(0,10)+(p.name.length > 10 ? '...' : '')}</th>`).join('')}</tr>`;

    const ablKeyLower = ablKey.toLowerCase();
    if (ablKeyLower === 'str') {
        derivedTable += `<tr><td>Carrying Capacity</td>${selectedPcsInput.map(p => `<td>${carryingCapacity(p.vtt_data?.abilities?.str?.value)} lbs</td>`).join('')}</tr>`;
        derivedTable += `<tr><td>Push/Drag/Lift</td>${selectedPcsInput.map(p => `<td>${pushDragLift(p.vtt_data?.abilities?.str?.value)} lbs</td>`).join('')}</tr>`;
        derivedTable += `<tr><td>Long Jump (Run)</td>${selectedPcsInput.map(p => `<td>${longJump(p.vtt_data?.abilities?.str?.value, true)} ft</td>`).join('')}</tr>`;
        derivedTable += `<tr><td>High Jump (Run)</td>${selectedPcsInput.map(p => `<td>${highJump(p.vtt_data?.abilities?.str?.value, true)} ft</td>`).join('')}</tr>`;
    } else if (ablKeyLower === 'dex') {
        derivedTable += `<tr><td>Initiative Bonus</td>${selectedPcsInput.map(p => `<td>${initiative(p.vtt_data?.abilities?.dex?.value)}</td>`).join('')}</tr>`;
    } else if (ablKeyLower === 'con') {
        derivedTable += `<tr><td>Hold Breath</td>${selectedPcsInput.map(p => `<td>${holdBreath(p.vtt_data?.abilities?.con?.value)}</td>`).join('')}</tr>`;
    }
    derivedTable += `</table>`;
    expansionDiv.innerHTML += derivedTable;

    expansionDiv.innerHTML += `<div class="ability-bar-chart-container"><h6>${ablKey} Score Comparison</h6>`;
    const abilityScores = selectedPcsInput.map(pc => ({ name: pc.name, score: pc.vtt_data?.abilities?.[ablKeyLower]?.value || 10 }));
    const allScores = abilityScores.map(d => d.score);
    const dataMin = Math.min(0, ...allScores); const dataMax = Math.max(20, ...allScores);
    const visualRange = dataMax - dataMin;

    abilityScores.sort((a,b) => b.score - a.score).forEach(data => {
        let barWidthPercent = visualRange !== 0 ? ((data.score - dataMin) / visualRange) * 100 : 50;
        barWidthPercent = Math.max(1, Math.min(100, barWidthPercent));
        expansionDiv.innerHTML += `<div class="pc-bar-row"><div class="stat-comparison-pc-name" title="${data.name}">${data.name.substring(0,15)+(data.name.length > 15 ? '...' : '')}</div><div class="stat-bar-wrapper" style="--zero-offset: 0%;"><div class="stat-bar positive" style="left: 0%; width: ${barWidthPercent}%; text-align:center;">${data.score}</div></div></div>`;
    });
    expansionDiv.innerHTML += `</div>`;
}

function populateExpandedSkillDetailsUI(skillKey, expansionDiv, selectedPcs) {
    // Assumes SKILL_NAME_MAP from config.js, calculateSkillBonus from dndCalculations.js are global
     if (!expansionDiv || !selectedPcs || selectedPcs.length === 0) {
        if(expansionDiv) expansionDiv.innerHTML = '<p><em>Select PCs to view skill details.</em></p>';
        return;
    }
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
        barWidthPercent = Math.max(0.5, barWidthPercent);
        contentHTML += `<div class="pc-bar-row"><div class="stat-comparison-pc-name" title="${data.name}">${data.name.substring(0,15)+(data.name.length > 15 ? '...' : '')}</div><div class="stat-bar-wrapper" style="--zero-offset: ${zeroPositionPercent}%;"><div class="${barClass}" style="left: ${barLeftPercent}%; width: ${barWidthPercent}%;">${data.modifier >= 0 ? '+' : ''}${data.modifier}</div></div></div>`;
    });
    contentHTML += `</div><table class="rules-explanation-table"><tr><td>`;
    // ... (switch statement for skill descriptions from original script) ...
    switch (skillKey) {
        case 'acr': contentHTML += "Your Dexterity (Acrobatics) check covers your attempt to stay on your feet in a tricky situation... (etc.)"; break;
        // Add all other skill cases from your original script.js
        default: contentHTML += `General information about the ${skillFullName} skill.`; break;
    }
    contentHTML += "</td></tr></table>";
    expansionDiv.innerHTML = contentHTML;
}


function updatePcDashboardUI(dashboardContentElement, allCharacters, activePcIds, currentlyExpandedAbility, currentlyExpandedSkill, skillSortKey) {
    if (!dashboardContentElement) {
        console.error("updatePcDashboardUI: 'pc-dashboard-content' element not found.");
        return;
    }
    dashboardContentElement.innerHTML = ''; // Clear existing content

    const selectedPcs = allCharacters.filter(char => activePcIds.has(String(char._id)) && char.character_type === 'PC' && char.vtt_data);

    if (selectedPcs.length === 0) {
        dashboardContentElement.innerHTML = `<p class="pc-dashboard-no-selection">Select Player Characters from the left panel to view their details and comparisons.</p>`;
        return;
    }

    selectedPcs.forEach(pc => {
        const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || pc.vtt_data?.details?.level || 1;
        pc.calculatedProfBonus = getProficiencyBonus(pcLevel); // Assumes getProficiencyBonus is global
    });

    let quickViewHTML = createPcQuickViewSectionHTML(true); // Assumes createPcQuickViewSectionHTML is available
    const sortedSelectedPcsByName = [...selectedPcs].sort((a, b) => a.name.localeCompare(b.name));
    sortedSelectedPcsByName.forEach(pc => {
        quickViewHTML += generatePcQuickViewCardHTML(pc, true); // Assumes generatePcQuickViewCardHTML is available
    });
    quickViewHTML += `</div>`;
    dashboardContentElement.innerHTML += quickViewHTML;

    // Ability Scores Overview Table
    const abilitiesForTable = ABILITY_KEYS_ORDER.map(k => k.toUpperCase()); // Assumes ABILITY_KEYS_ORDER from config.js
    let mainStatsTableHTML = `<h4>Ability Scores Overview</h4><div class="table-wrapper"><table id="main-stats-table"><thead><tr><th>Character</th>`;
    abilitiesForTable.forEach(ablKey => {
        const isExpanded = currentlyExpandedAbility === ablKey && getElem(`expanded-${ablKey}`)?.style.display !== 'none';
        const arrow = isExpanded ? '▼' : '►';
        // Ensure toggleAbilityExpansion is globally accessible or passed as a callback
        mainStatsTableHTML += `<th class="clickable-ability-header" data-ability="${ablKey}" onclick="toggleAbilityExpansion('${ablKey}')">${ablKey} <span class="arrow-indicator">${arrow}</span></th>`;
    });
    mainStatsTableHTML += `</tr></thead><tbody>`;
    sortedSelectedPcsByName.forEach(pc => {
        mainStatsTableHTML += `<tr><td>${pc.name}</td>`;
        ABILITY_KEYS_ORDER.forEach(ablKey => {
            const score = pc.vtt_data?.abilities?.[ablKey]?.value || 10;
            const mod = getAbilityModifier(score); // Assumes getAbilityModifier is global
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
            populateExpandedAbilityDetailsUI(ablKey.toUpperCase(), expansionDiv, selectedPcs);
        }
        abilityExpansionContainer.appendChild(expansionDiv);
    });

    // Skills Overview Table
    // Assumes SKILL_NAME_MAP from config.js and calculateSkillBonus from dndCalculations.js
    let skillsTableHTML = `<h4>Skills Overview</h4><div class="table-wrapper"><table id="skills-overview-table"><thead><tr><th>Character</th>`;
    for (const skillKey in SKILL_NAME_MAP) {
        const skillFullName = SKILL_NAME_MAP[skillKey].replace(/\s\(...\)/, '');
        const isExpanded = currentlyExpandedSkill === skillKey && getElem(`expanded-skill-${skillKey}`)?.style.display !== 'none';
        const arrow = isExpanded ? '▼' : '►';
        // Ensure toggleSkillExpansion is globally accessible or passed as a callback
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
            populateExpandedSkillDetailsUI(skillKey, expansionDiv, selectedPcs);
        }
        skillExpansionContainer.appendChild(expansionDiv);
    }
}

// Make sure renderDetailedPcSheetUI is also defined or correctly moved to uiRenderers.js
// It's a very large function, so ensure all its helper calls (like getAbilityModifier, etc.)
// and DOM manipulations are correctly handled.
function renderDetailedPcSheetUI(pcData, dashboardContentElement) {
    if (!pcData || !dashboardContentElement) {
        console.error("renderDetailedPcSheetUI: PC data or dashboard element missing.");
        if (dashboardContentElement) dashboardContentElement.innerHTML = `<p>Error loading PC. <button onclick="handleBackToDashboardOverview()">Back to Dashboard Overview</button></p>`;
        return;
    }
    // ... (Full implementation from your original script, adapted to use pcData and dashboardContentElement)
    // ... This is a very large function; ensure all sub-logic is ported correctly.
    // ... For example:
    // dashboardContentElement.innerHTML = ''; // Clear it first
    // let html = `<div class="detailed-pc-sheet" data-pc-id="${pcData._id}">`;
    // html += `<span class="close-detailed-pc-sheet-btn" onclick="handleBackToDashboardOverview()" title="Close Detailed View">&times;</span>`;
    // ... rest of the HTML generation and collapsible section logic ...
    // Make sure handleBackToDashboardOverview is defined in app.js or accessible.
    dashboardContentElement.innerHTML = `<p><em>Detailed PC Sheet for ${pcData.name} to be fully implemented here.</em> <button onclick="handleBackToDashboardOverview()">Back to Overview</button></p>`; // Placeholder
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
            // Ensure dissociateCallback is the actual function from characterService/app.js
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

// uiRenderers.js

function renderNpcFactionStandingsUI(npcCharacter, activePcIdsSet, allCharactersArray, contentElement, onStandingChangeCallback) {
    if (!contentElement || !npcCharacter || npcCharacter.character_type !== 'NPC') {
        if (contentElement) contentElement.innerHTML = "<p><em>Faction standings are for NPCs. Ensure an NPC is selected.</em></p>";
        return;
    }

    contentElement.innerHTML = ''; // Clear previous

    const activePcs = allCharactersArray.filter(char => char.character_type === 'PC' && activePcIdsSet.has(String(char._id)));

    if (activePcs.length === 0) {
        contentElement.innerHTML = "<p><em>No PCs selected in the left panel to show standings towards. Add PCs via the main list.</em></p>";
        return;
    }

    activePcs.forEach(pc => {
        const pcIdStr = String(pc._id);
        const standingEntryDiv = document.createElement('div');
        standingEntryDiv.className = 'faction-standing-entry'; // Add this class for styling

        const label = document.createElement('label');
        label.htmlFor = `standing-select-${npcCharacter._id}-${pcIdStr}`;
        label.textContent = `${pc.name}:`;
        label.style.marginRight = "10px"; // Basic styling

        const select = document.createElement('select');
        select.id = `standing-select-${npcCharacter._id}-${pcIdStr}`;
        select.dataset.pcId = pcIdStr;
        select.style.width = "150px"; // Basic styling

        // FACTION_STANDING_SLIDER_ORDER should be available from config.js
        FACTION_STANDING_SLIDER_ORDER.forEach(levelKey => {
            const option = document.createElement('option');
            option.value = levelKey; // The string value from the enum/object
            option.textContent = levelKey;
            select.appendChild(option);
        });

        const currentStandingValue = npcCharacter.pc_faction_standings ? npcCharacter.pc_faction_standings[pcIdStr] : null;
        select.value = currentStandingValue || FACTION_STANDING_LEVELS.INDIFFERENT; // Default to Indifferent

        select.addEventListener('change', (event) => {
            // onStandingChangeCallback is expected to be handleSaveFactionStanding from characterService/app.js
            onStandingChangeCallback(npcCharacter._id, pcIdStr, event.target.value);
        });

        standingEntryDiv.appendChild(label);
        standingEntryDiv.appendChild(select);
        contentElement.appendChild(standingEntryDiv);
    });
}

// If using ES6 modules:
// export { renderNpcListForSceneUI, renderPcListUI, ... };
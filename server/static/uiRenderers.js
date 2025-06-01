// static/uiRenderers.js

window.createPcQuickViewSectionHTML = function(isForDashboard) {
    const titleText = PC_QUICK_VIEW_BASE_TITLE;
    const fullTitle = isForDashboard ? `${titleText} (Click card for details)` : titleText;
    return `<h4>${fullTitle}</h4><div class="pc-dashboard-grid">`;
};

window.generatePcQuickViewCardHTML = function(pc, isClickableForDetailedView = false) {
    // ... (Full function as provided in my last response)
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
        pc.calculatedProfBonus = window.getProficiencyBonus(pcLevel);
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
        spellDcText = window.spellSaveDC(castingScore, pc.calculatedProfBonus);
    } else if (pc.vtt_data.attributes.spell?.dc) {
        spellDcText = pc.vtt_data.attributes.spell.dc;
    }
    cardHTML += `<p><strong>Spell DC:</strong> ${spellDcText}</p>`;
    cardHTML += `</div>`;
    return cardHTML;
};

window.populateExpandedAbilityDetailsUI = function(ablKey, expansionDiv, selectedPcsInput) {
    // (Full function from previous response)
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
};

window.populateExpandedSkillDetailsUI = function(skillKey, expansionDiv, selectedPcs) {
    // (Full function from previous response, including the switch statement for skill descriptions)
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
};

window.updatePcDashboardUI = function(dashboardContentElement, allCharacters, activePcIds, currentlyExpandedAbility, currentlyExpandedSkill, skillSortKey) {
    // (Full function as provided in my last response)
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
            window.populateExpandedSkillDetailsUI(skillKey, expansionDiv, selectedPcs);
        }
        skillExpansionContainer.appendChild(expansionDiv);
    }
};

window.renderDetailedPcSheetUI = function(pcData, dashboardContentElement) {
    // (Full function as provided in my last response, ensure all helpers like getProficiencyBonus are window. prefixed)
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
    
    let acDisplay = pcData.vtt_flags?.ddbimporter?.overrideAC?.flat ?? pcData.vtt_data?.attributes?.ac?.value ?? pcData.vtt_data?.attributes?.ac?.flat;
    if (acDisplay === undefined || acDisplay === null) {
        const equippedArmorItems = pcData.items?.filter(item => item.type === 'equipment' && item.system?.equipped && item.system?.armor?.value !== undefined) || [];
        if (equippedArmorItems.length > 0) {
            const equippedArmor = equippedArmorItems[0];
            acDisplay = equippedArmor.system.armor.value;
            if (equippedArmor.system.armor.dex !== null && equippedArmor.system.armor.dex !== undefined && pcData.vtt_data?.abilities?.dex?.value) {
                const dexMod = window.getAbilityModifier(pcData.vtt_data.abilities.dex.value);
                acDisplay += Math.min(dexMod, equippedArmor.system.armor.dex);
            } else if (equippedArmor.system.armor.dex === null && pcData.vtt_data?.abilities?.dex?.value) {
                 acDisplay += window.getAbilityModifier(pcData.vtt_data.abilities.dex.value);
            }
        } else { 
            acDisplay = 10 + window.getAbilityModifier(pcData.vtt_data?.abilities?.dex?.value || 10);
        }
    }
    html += `<p><strong>AC:</strong> ${acDisplay}</p>`;
    html += `<p><strong>Speed:</strong> ${pcData.vtt_data?.attributes?.movement?.walk || pcData.system?.attributes?.movement?.walk || 30} ft</p>`;
    
    let initiativeBonusDetailed = 'N/A';
    const initAbilityKeyDet = pcData.vtt_data?.attributes?.init?.ability;
    const dexValueForInitDet = pcData.vtt_data?.abilities?.dex?.value;
    if (initAbilityKeyDet && pcData.vtt_data?.abilities?.[initAbilityKeyDet]) {
        initiativeBonusDetailed = window.getAbilityModifier(pcData.vtt_data.abilities[initAbilityKeyDet].value || 10);
    } else if (pcData.vtt_data?.attributes?.init?.bonus != null && pcData.vtt_data.attributes.init.bonus !== "") {
        initiativeBonusDetailed = parseInt(pcData.vtt_data.attributes.init.bonus) || 0;
    } else if (dexValueForInitDet !== undefined) {
        initiativeBonusDetailed = window.getAbilityModifier(dexValueForInitDet);
    }
    html += `<p><strong>Initiative:</strong> ${initiativeBonusDetailed >= 0 ? '+' : ''}${initiativeBonusDetailed}</p>`;
    html += `<p><strong>Proficiency Bonus:</strong> +${pcData.calculatedProfBonus}</p></div></div>`;

    html += `<div class="pc-section"><h4>Weapons & Attacks</h4>`;
    const weaponsDetailed = pcData.items?.filter(item => item.type === 'weapon' && item.system?.equipped) || [];
    if (weaponsDetailed.length > 0) {
        html += `<ul class="pc-sheet-list">`;
        weaponsDetailed.forEach(w => {
            // ... (weapon rendering logic from your original script.js file) ...
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
    html += `</div>`; // End pc-sheet-columns

    const collapsibleSectionsDataDetailed = [ /* ... (Full array from previous response) ... */
        {
            title: "Personality & Roleplaying",
            contentFn: () => { /* ... original contentFn logic ... */ 
                let content = `<div class="pc-info-grid">`;
                const traits = (pcData.personality_traits || []).length > 0 ? pcData.personality_traits : (pcData.vtt_data?.details?.trait ? [pcData.vtt_data.details.trait] : []);
                const ideals = (pcData.ideals || []).length > 0 ? pcData.ideals : (pcData.vtt_data?.details?.ideal ? [pcData.vtt_data.details.ideal] : []);
                const bonds = (pcData.bonds || []).length > 0 ? pcData.bonds : (pcData.vtt_data?.details?.bond ? [pcData.vtt_data.details.bond] : []);
                const flaws = (pcData.flaws || []).length > 0 ? pcData.flaws : (pcData.vtt_data?.details?.flaw ? [pcData.vtt_data.details.flaw] : []);
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
            contentFn: () => { /* ... original contentFn logic ... */ 
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
            contentFn: () => { /* ... original contentFn logic ... */ 
                let content = `<div>`;
                content += `<h5>Backstory</h5><p>${pcData.backstory || pcData.vtt_data?.details?.biography?.public || pcData.vtt_data?.details?.biography?.value || 'Not detailed.'}</p>`;
                content += `<h5>Motivations</h5><p>${(pcData.motivations || []).join ? (pcData.motivations || []).join('; ') : (pcData.motivations || 'Not detailed.')}</p>`;
                content += `</div>`;
                return content;
            }
        },
        {
            title: "Proficiencies & Languages",
            contentFn: () => { /* ... original contentFn logic ... */ 
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
            contentFn: () => { /* ... original contentFn logic ... */ 
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
            contentFn: () => { /* ... original contentFn logic ... */ 
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
            contentFn: () => { /* ... original contentFn logic ... */ 
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
                Object.keys(spellsByLevel).forEach(lvlKey => { // Add any other spell level categories like "Pact Magic"
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
    html += `</div>`; // End detailed-pc-sheet
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
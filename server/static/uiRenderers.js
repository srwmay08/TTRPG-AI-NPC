// static/uiRenderers.js

console.log("uiRenderers.js: Parsing STARTED");

const ABILITY_SCORE_INFO = {
    "STR": { "title": "Strength", "description": "Strength measures bodily power, athletic training, and the extent to which you can exert raw physical force.", "checks_title": "Strength Checks", "checks_description": "A Strength check can model any attempt to lift, push, pull, or break something, to force your body through a space, or to otherwise apply brute force to a situation. The Athletics skill reflects aptitude in certain kinds of Strength checks.", "skills": { "Athletics": "Your Strength (Athletics) check covers difficult situations you encounter while climbing, jumping, or swimming." }, "other_checks_title": "Other Strength Checks", "other_checks": ["Force open a stuck, locked, or barred door", "Break free of bonds", "Push through a tunnel that is too small", "Hang on to a wagon while being dragged behind it", "Tip over a statue", "Keep a boulder from rolling"], "attack_and_damage_title": "Attack Rolls and Damage", "attack_and_damage": "You add your Strength modifier to your attack roll and your damage roll when attacking with a melee weapon.", "lifting_and_carrying_title": "Lifting and Carrying", "lifting_and_carrying": "Your carrying capacity is your Strength score multiplied by 15. You can push, drag, or lift a weight in pounds up to twice your carrying capacity (or 30 times your Strength score)." },
    "DEX": { "title": "Dexterity", "description": "Dexterity measures agility, reflexes, and balance.", "checks_title": "Dexterity Checks", "checks_description": "A Dexterity check can model any attempt to move nimbly, quickly, or quietly, or to keep from falling on tricky footing. The Acrobatics, Sleight of Hand, and Stealth skills reflect aptitude in certain kinds of Dexterity checks.", "skills": { "Acrobatics": "Your Dexterity (Acrobatics) check covers your attempt to stay on your feet in a tricky situation, such as when you’re trying to run across a sheet of ice or balance on a tightrope.", "Sleight of Hand": "Whenever you attempt an act of legerdemain or manual trickery, such as planting something on someone else or concealing an object on your person, make a Dexterity (Sleight of Hand) check.", "Stealth": "Make a Dexterity (Stealth) check when you attempt to conceal yourself from enemies, slink past guards, or sneak up on someone without being seen or heard." }, "other_checks_title": "Other Dexterity Checks", "other_checks": ["Pick a lock", "Disable a trap", "Securely tie up a prisoner", "Wriggle free of bonds", "Play a stringed instrument"], "attack_and_damage_title": "Attack Rolls and Damage", "attack_and_damage": "You add your Dexterity modifier to your attack roll and your damage roll when attacking with a ranged weapon or a melee weapon that has the finesse property.", "armor_class_title": "Armor Class", "armor_class": "Depending on the armor you wear, you might add some or all of your Dexterity modifier to your Armor Class.", "initiative_title": "Initiative", "initiative": "At the beginning of every combat, you roll initiative by making a Dexterity check." },
    "CON": { "title": "Constitution", "description": "Constitution measures health, stamina, and vital force.", "checks_title": "Constitution Checks", "checks_description": "Constitution checks are uncommon, and no skills apply to Constitution checks, because the endurance this ability represents is largely passive. A Constitution check can model your attempt to push beyond normal limits.", "other_checks_title": "Other Constitution Checks", "other_checks": ["Hold your breath", "March or labor for hours without rest", "Go without sleep", "Survive without food or water", "Quaff an entire stein of ale in one go"], "hit_points_title": "Hit Points", "hit_points": "Your Constitution modifier contributes to your hit points. If your Constitution modifier changes, your hit point maximum changes as well, as though you had the new modifier from 1st level." },
    "INT": { "title": "Intelligence", "description": "Intelligence measures mental acuity, accuracy of recall, and the ability to reason.", "checks_title": "Intelligence Checks", "checks_description": "An Intelligence check comes into play when you need to draw on logic, education, memory, or deductive reasoning. The Arcana, History, Investigation, Nature, and Religion skills reflect aptitude in certain kinds of Intelligence checks.", "skills": { "Arcana": "Measures your ability to recall lore about spells, magic items, eldritch symbols, and magical traditions.", "History": "Measures your ability to recall lore about historical events, legendary people, ancient kingdoms, and lost civilizations.", "Investigation": "When you look around for clues and make deductions based on those clues, you make an Intelligence (Investigation) check.", "Nature": "Measures your ability to recall lore about terrain, plants and animals, the weather, and natural cycles.", "Religion": "Measures your ability to recall lore about deities, rites and prayers, religious hierarchies, and holy symbols." }, "spellcasting_ability_title": "Spellcasting Ability", "spellcasting_ability": "Wizards use Intelligence as their spellcasting ability, which helps determine the saving throw DCs of spells they cast." },
    "WIS": { "title": "Wisdom", "description": "Wisdom reflects how attuned you are to the world around you and represents perceptiveness and intuition.", "checks_title": "Wisdom Checks", "checks_description": "A Wisdom check might reflect an effort to read body language, understand someone’s feelings, notice things about the environment, or care for an injured person. The Animal Handling, Insight, Medicine, Perception, and Survival skills reflect aptitude in certain kinds of Wisdom checks.", "skills": { "Animal Handling": "When there is any question whether you can calm down a domesticated animal, keep a mount from getting spooked, or intuit an animal’s intentions, the GM might call for a Wisdom (Animal Handling) check.", "Insight": "Your Wisdom (Insight) check decides whether you can determine the true intentions of a creature, such as when searching out a lie or predicting someone’s next move.", "Medicine": "A Wisdom (Medicine) check lets you try to stabilize a dying companion or diagnose an illness.", "Perception": "Your Wisdom (Perception) check lets you spot, hear, or otherwise detect the presence of something. It measures your general awareness of your surroundings and the keenness of your senses.", "Survival": "The GM might ask you to make a Wisdom (Survival) check to follow tracks, hunt wild game, guide your group through frozen wastelands, or identify signs that owlbears live nearby." }, "spellcasting_ability_title": "Spellcasting Ability", "spellcasting_ability": "Clerics, druids, and rangers use Wisdom as their spellcasting ability." },
    "CHA": { "title": "Charisma", "description": "Charisma measures your ability to interact effectively with others. It includes such factors as confidence and eloquence, and it can represent a charming or commanding personality.", "checks_title": "Charisma Checks", "checks_description": "A Charisma check might arise when you try to influence or entertain others, when you try to make an impression or tell a convincing lie, or when you are navigating a tricky social situation. The Deception, Intimidation, Performance, and Persuasion skills reflect aptitude in certain kinds of Charisma checks.", "skills": { "Deception": "Your Charisma (Deception) check determines whether you can convincingly hide the truth, either verbally or through your actions.", "Intimidation": "When you attempt to influence someone through overt threats, hostile actions, and physical violence, the GM might ask you to make a Charisma (Intimidation) check.", "Performance": "Your Charisma (Performance) check determines how well you can delight an audience with music, dance, acting, storytelling, or some other form of entertainment.", "Persuasion": "When you attempt to influence someone or a group of people with tact, social graces, or good nature, the GM might ask you to make a Charisma (Persuasion) check." }, "spellcasting_ability_title": "Spellcasting Ability", "spellcasting_ability": "Bards, paladins, sorcerers, and warlocks use Charisma as their spellcasting ability." }
};

var UIRenderers = {
    createPcQuickViewSectionHTML: function(isForDashboard) {
        const titleText = PC_QUICK_VIEW_BASE_TITLE;
        const fullTitle = isForDashboard ? `${titleText} (Click card for details)` : titleText;
        return `<h4>${fullTitle}</h4>`;
    },

    generatePcQuickViewCardHTML: function(pc, isClickableForDetailedView = false) {
        if (!pc) return '';
        
        const system = pc.system || pc.vtt_data || {};
        system.abilities = system.abilities || {};
        system.attributes = system.attributes || {};
        system.attributes.hp = system.attributes.hp || {};
        system.attributes.movement = system.attributes.movement || {};
        system.attributes.init = system.attributes.init || {};
        system.details = system.details || {};

        if (typeof pc.calculatedProfBonus === 'undefined') {
            const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || system.details?.level || 1;
            pc.calculatedProfBonus = DNDCalculations.getProficiencyBonus(pcLevel);
        }

        let cardClasses = 'pc-stat-card';
        if (isClickableForDetailedView) {
            cardClasses += ' clickable-pc-card';
        }

        let cardHTML = `<div class="${cardClasses}" data-pc-id="${String(pc._id)}">`;
        cardHTML += `<h4>${pc.name}</h4>`;

        const hpCurrent = system.attributes.hp?.value ?? 'N/A';
        const hpMax = system.attributes.hp?.max ?? 'N/A';
        cardHTML += `<p><strong>HP:</strong> ${hpCurrent} / ${hpMax}</p>`;
        const acDisplayValue = DNDCalculations.calculateDisplayAC(pc);
        cardHTML += `<p><strong>AC:</strong> ${acDisplayValue}</p>`;
        cardHTML += `<p><strong>Prof. Bonus:</strong> +${pc.calculatedProfBonus}</p>`;
        const initiativeBonus = DNDCalculations.getAbilityModifier(system.abilities?.dex?.value || 10);
        cardHTML += `<p><strong>Initiative:</strong> ${initiativeBonus >= 0 ? '+' : ''}${initiativeBonus}</p>`;
        cardHTML += `<p><strong>Speed:</strong> ${system.attributes.movement?.walk || 30} ft</p>`;
        const spellDcText = DNDCalculations.spellSaveDC(pc);
        cardHTML += `<p><strong>Spell DC:</strong> ${spellDcText}</p>`;
        const spellAtkBonusText = DNDCalculations.spellAttackBonus(pc);
        cardHTML += `<p><strong>Spell Atk:</strong> ${spellAtkBonusText || 'N/A'}</p>`;
        cardHTML += `</div>`;
        return cardHTML;
    },

    generateBarChartRowHTML: function(label, value, max_value, bar_max_value) {
        const percentage = (Math.abs(value) / (bar_max_value || max_value)) * 100;
        const bar_color = value >= 0 ? '#4caf50' : '#f44336';
        return `
            <div class="pc-bar-row">
                <div class="stat-comparison-pc-name">${label}</div>
                <div class="stat-bar-wrapper">
                    <div class="stat-bar" style="width: ${percentage}%; background-color: ${bar_color};">${value}</div>
                </div>
            </div>`;
    },

    populateExpandedAbilityDetailsUI: function(abilityKey, expansionDiv, selectedPcs) {
        if (!expansionDiv) { return; }
        const abilityLongName = ABILITY_KEYS_ORDER.find(k => k.startsWith(abilityKey.toLowerCase().substring(0,3))).toUpperCase();
        
        let contentHTML = `<h5>${abilityLongName} Scores</h5>`;
        
        const barChartContainer = document.createElement('div');
        barChartContainer.className = 'ability-bar-chart-container';
        
        const scores = selectedPcs.map(pc => (pc.system?.abilities?.[abilityKey.toLowerCase()]?.value) || 10);
        const maxScore = Math.max(...scores, 10);
    
        selectedPcs.forEach(pc => {
            const score = (pc.system?.abilities?.[abilityKey.toLowerCase()]?.value) || 10;
            const label = pc.name;
            barChartContainer.innerHTML += this.generateBarChartRowHTML(label, score, maxScore, 20);
        });
        
        expansionDiv.innerHTML = contentHTML;
        expansionDiv.appendChild(barChartContainer);

        const associatedSkills = Object.keys(SKILL_NAME_MAP).filter(skill => SKILL_NAME_MAP[skill].includes(`(${abilityLongName.substring(0,3)})`));

        if (associatedSkills.length > 0) {
            let skillsTableHTML = `<h5>Associated Skills</h5><div class="table-wrapper"><table class="detailed-pc-table">`;
            skillsTableHTML += `<thead><tr><th>Character</th>`;
            associatedSkills.forEach(skillKey => {
                skillsTableHTML += `<th>${SKILL_NAME_MAP[skillKey].split(' ')[0]}</th>`;
            });
            skillsTableHTML += `</tr></thead><tbody>`;

            selectedPcs.forEach(pc => {
                skillsTableHTML += `<tr><td>${pc.name}</td>`;
                associatedSkills.forEach(skillKey => {
                    const skillData = pc.system?.skills?.[skillKey];
                    const abilityScore = pc.system?.abilities?.[abilityKey.toLowerCase()]?.value || 10;
                    const bonus = DNDCalculations.calculateSkillBonus(abilityScore, skillData?.value || 0, pc.calculatedProfBonus);
                    skillsTableHTML += `<td>${bonus >= 0 ? '+' : ''}${bonus}</td>`;
                });
                skillsTableHTML += `</tr>`;
            });

            skillsTableHTML += `</tbody></table></div>`;
            expansionDiv.innerHTML += skillsTableHTML;
        }
    },
    
    renderNpcListForContextUI: function(listContainerElement, allCharacters, activeSceneNpcIds, onToggleInSceneCallback, onNameClickCallback, sceneContextFilter) {
        if (!listContainerElement) {
            console.error("UIRenderers.renderNpcListForContextUI: listContainerElement not found");
            return;
        }
        let ul = listContainerElement.querySelector('ul');
        if (!ul) {
            ul = document.createElement('ul');
            listContainerElement.appendChild(ul);
        }
        ul.innerHTML = '';
    
        let npcsToDisplay = allCharacters.filter(char => char.character_type === 'NPC');
    
        if (sceneContextFilter && sceneContextFilter.id) {
            npcsToDisplay = npcsToDisplay.filter(npc =>
                npc.linked_lore_ids && npc.linked_lore_ids.includes(sceneContextFilter.id)
            );
        }
    
        npcsToDisplay.sort((a, b) => a.name.localeCompare(b.name));
    
        if (npcsToDisplay.length === 0) {
            if (sceneContextFilter && sceneContextFilter.id) {
                ul.innerHTML = '<li><p><em>No NPCs are linked to this specific context.</em></p></li>';
            } else {
                ul.innerHTML = '<li><p><em>No NPCs available.</em></p></li>';
            }
            return;
        }
    
        npcsToDisplay.forEach(char => {
            const charIdStr = String(char._id);
            const li = document.createElement('li');
            li.dataset.charId = charIdStr;
            li.style.cursor = "pointer";
    
            if (activeSceneNpcIds.has(charIdStr)) {
                li.classList.add('active-in-scene');
            }
    
            const nameSpan = document.createElement('span');
            nameSpan.textContent = char.name;
            nameSpan.className = 'npc-name-clickable';
            
            li.onclick = async (event) => {
                if (event.target.classList.contains('npc-name-clickable')) {
                    event.stopPropagation();
                    await onNameClickCallback(charIdStr);
                } else {
                    await onToggleInSceneCallback(charIdStr, char.name);
                }
            };
    
            li.appendChild(nameSpan);
            ul.appendChild(li);
        });
    },

    updatePcDashboardUI: function(dashboardContentElement, allCharacters, activePcIds, currentlyExpandedAbility) {
        if (!dashboardContentElement) {
            console.error("UIRenderers.updatePcDashboardUI: 'pc-dashboard-content' element not found.");
            return;
        }

        const selectedPcs = allCharacters.filter(char => activePcIds.has(String(char._id)) && char.character_type === 'PC');

        if (selectedPcs.length === 0) {
            dashboardContentElement.innerHTML = `<p class="pc-dashboard-no-selection">Select Player Characters from the left panel to view their details and comparisons.</p>`;
            return;
        }
        
        let sortedSelectedPcs = [...selectedPcs];
        if (currentlyExpandedAbility) {
            const ablKey = currentlyExpandedAbility.toLowerCase();
            sortedSelectedPcs.sort((a, b) => {
                const scoreA = (a.system?.abilities?.[ablKey]?.value) || 10;
                const scoreB = (b.system?.abilities?.[ablKey]?.value) || 10;
                return scoreB - scoreA;
            });
        } else {
            sortedSelectedPcs.sort((a, b) => a.name.localeCompare(b.name));
        }
    
        let finalHTML = '';
    
        finalHTML += this.createPcQuickViewSectionHTML(true);
        let cardsHTML = '';
        sortedSelectedPcs.forEach(pc => {
            cardsHTML += this.generatePcQuickViewCardHTML(pc, true);
        });
        finalHTML += `<div class="pc-dashboard-grid">${cardsHTML}</div>`;
        
        const abilitiesForTable = ABILITY_KEYS_ORDER.map(k => k.toUpperCase());
        let mainStatsTableHTML = `<h4>Ability Scores & Skills Overview</h4><div class="table-wrapper"><table id="main-stats-table"><thead><tr><th>Character</th>`;
        abilitiesForTable.forEach(ablKey => {
            const isExpanded = currentlyExpandedAbility === ablKey;
            const arrow = isExpanded ? '▼' : '►';
            mainStatsTableHTML += `<th class="clickable-ability-header" data-ability="${ablKey}" onclick="App.toggleAbilityExpansion('${ablKey}')">${ablKey} <span class="arrow-indicator">${arrow}</span></th>`;
        });
        mainStatsTableHTML += `</tr></thead><tbody>`;
        sortedSelectedPcs.forEach(pc => {
            mainStatsTableHTML += `<tr><td>${pc.name}</td>`;
            ABILITY_KEYS_ORDER.forEach(ablKey => {
                const score = (pc.system?.abilities?.[ablKey]?.value) || 10;
                const mod = DNDCalculations.getAbilityModifier(score);
                mainStatsTableHTML += `<td>${score} (${mod >= 0 ? '+' : ''}${mod})</td>`;
            });
            mainStatsTableHTML += `</tr>`;
        });
        if (currentlyExpandedAbility) {
            mainStatsTableHTML += `<tr><td colspan="${abilitiesForTable.length + 1}"><div id="expanded-ability-details" class="expanded-ability-content"></div></td></tr>`;
        }
        mainStatsTableHTML += `</tbody></table></div>`;
        finalHTML += mainStatsTableHTML;
        
        const targetAC = appState.targetAC;
        let roundTotalDpr = 0;
        let estimatedHP = 0;

        selectedPcs.forEach(pc => {
            const pcId = String(pc._id);
            if (appState.selectedAttacks[pcId]) {
                appState.selectedAttacks[pcId].forEach(attackName => {
                    const attackItem = pc.items.find(item => item.name === attackName) || 
                                       (attackName === 'Unarmed Strike' ? { name: "Unarmed Strike", type: "weapon", system: { damage: { base: { denomination: '4', number: 1}}, properties: ['fin']} } : null);

                    if (attackItem) {
                        const dprResults = DNDCalculations.calculateDPR(pc, attackItem, appState.targetAC);
                        roundTotalDpr += parseFloat(dprResults.dpr) || 0;
                    }
                });
            }
        });
        estimatedHP = Math.round(roundTotalDpr * appState.estimatedRounds);

        finalHTML += `
            <div class="dpr-controls-summary">
                <div class="dpr-control-group">
                    <label for="dpr-ac-input">Target AC:</label>
                    <input type="number" id="dpr-ac-input" value="${targetAC}" min="0" max="30">
                </div>
                <div class="dpr-control-group">
                    <label for="round-count-input">Rounds to Sustain:</label>
                    <input type="number" id="round-count-input" value="${appState.estimatedRounds}" min="1" max="20">
                </div>
                <div class="dpr-summary-group">
                    <p><strong>Selected DPR:</strong> <span id="round-total-dpr">${roundTotalDpr.toFixed(2)}</span></p>
                    <p><strong>Est. HP to Survive:</strong> <span id="estimated-monster-hp">${estimatedHP}</span></p>
                </div>
            </div>`;
        
        let dprTableHTML = `<h4>Damage Per Round (DPR)</h4><div class="table-wrapper"><table id="dpr-overview-table">`;
        dprTableHTML += `<thead><tr><th>Character</th><th>Include</th><th>Attack</th><th>DPR (Normal)</th><th>DPR (Advantage)</th></tr></thead><tbody>`;
    
        sortedSelectedPcs.forEach(pc => {
            let attackItems = pc.items.filter(item => {
                if (item.type === 'weapon' && item.system?.damage?.base?.denomination) {
                    return true;
                }
                return false;
            });
            
            attackItems.unshift({ name: "Unarmed Strike", type: "weapon", system: { damage: { base: { denomination: '4', number: 1}}, properties: ['fin']} });

            const validAttackItems = attackItems.filter(item => {
                const dprResults = DNDCalculations.calculateDPR(pc, item, targetAC);
                return dprResults.dpr !== 'N/A';
            });

            if (validAttackItems.length > 0) {
                 validAttackItems.forEach((item, index) => {
                    const dprResults = DNDCalculations.calculateDPR(pc, item, targetAC);
                    const isChecked = appState.isAttackSelected(String(pc._id), item.name);
                    dprTableHTML += `<tr>`;
                    if (index === 0) {
                        dprTableHTML += `<td rowspan="${validAttackItems.length}">${pc.name}</td>`;
                    }
                    dprTableHTML += `<td><input type="checkbox" class="attack-selector" data-pc-id="${pc._id}" data-attack-name="${Utils.escapeHtml(item.name)}" ${isChecked ? 'checked' : ''}></td>`;
                    dprTableHTML += `<td>${dprResults.name}</td><td>${dprResults.dpr}</td><td>${dprResults.dprAdv}</td>`;
                    dprTableHTML += `</tr>`;
                });
            } else {
                dprTableHTML += `<tr><td>${pc.name}</td><td colspan="4">No applicable attacks found</td></tr>`;
            }
        });
    
        dprTableHTML += `</tbody></table></div>`;
        finalHTML += dprTableHTML;
        
        dashboardContentElement.innerHTML = finalHTML;
        
        if (currentlyExpandedAbility) {
            const expansionDiv = Utils.getElem('expanded-ability-details');
            if (expansionDiv) {
                this.populateExpandedAbilityDetailsUI(currentlyExpandedAbility, expansionDiv, sortedSelectedPcs);
            }
        }
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

    renderPcListUI: function(pcListDiv, speakingPcSelect, allCharacters, activePcIds, onPcItemClickCallback, activeNpcIdsSet) {
        if (!pcListDiv) { console.error("UIRenderers.renderPcListUI: pcListDiv not found"); return;}
        pcListDiv.innerHTML = '';
        if (speakingPcSelect) {
            const currentSpeaker = speakingPcSelect.value;
            speakingPcSelect.innerHTML = '<option value="">-- DM/Scene Event --</option>';

            // Add Player Characters
            const pcs = allCharacters.filter(char => char.character_type === 'PC').sort((a, b) => a.name.localeCompare(b.name));
            pcs.forEach(pc => {
                const pcIdStr = String(pc._id);
                const option = document.createElement('option');
                option.value = pcIdStr;
                option.textContent = `(PC) ${pc.name}`;
                speakingPcSelect.appendChild(option);
            });

            // Add a separator
            if (activeNpcIdsSet && activeNpcIdsSet.size > 0 && pcs.length > 0) {
                const separator = document.createElement('option');
                separator.disabled = true;
                separator.textContent = '--- NPCs in Scene ---';
                speakingPcSelect.appendChild(separator);
            }

            // Add Active NPCs
            if (activeNpcIdsSet) {
                const activeNpcs = allCharacters.filter(char => activeNpcIdsSet.has(String(char._id))).sort((a, b) => a.name.localeCompare(b.name));
                activeNpcs.forEach(npc => {
                    const npcIdStr = String(npc._id);
                    const option = document.createElement('option');
                    option.value = npcIdStr;
                    option.textContent = `(NPC) ${npc.name}`;
                    speakingPcSelect.appendChild(option);
                });
            }
            // Try to restore previous selection
            if (Array.from(speakingPcSelect.options).some(opt => opt.value === currentSpeaker)) {
                speakingPcSelect.value = currentSpeaker;
            }
        }
        
        // This part remains the same, for rendering the PC list on the left
        const pcsForList = allCharacters.filter(char => char.character_type === 'PC').sort((a, b) => a.name.localeCompare(b.name));
        if (pcsForList.length === 0) {
            pcListDiv.innerHTML = '<p><em>No Player Characters defined yet.</em></p>';
            return;
        }
        const ul = document.createElement('ul');
        pcsForList.forEach(pc => {
            const pcIdStr = String(pc._id);
            const li = document.createElement('li');
            li.style.cursor = "pointer";
            li.textContent = pc.name;
            li.dataset.charId = pcIdStr;
            li.onclick = () => onPcItemClickCallback(pcIdStr);
            if (activePcIds.has(pcIdStr)) {
                li.classList.add('selected');
            }
            ul.appendChild(li);
        });
        pcListDiv.appendChild(ul);
    },

    createNpcDialogueAreaUI: function(npcCharacter, containerElement) {
        if (!npcCharacter || !containerElement) return;

        const npcIdStr = String(npcCharacter._id);
        const npcName = npcCharacter.name;
        const npcDescription = npcCharacter.description || 'No description available.';

        if (Utils.getElem(`npc-area-${npcIdStr}`)) return;

        const areaDiv = document.createElement('div');
        areaDiv.className = 'npc-dialogue-area';
        areaDiv.id = `npc-area-${npcIdStr}`;

        const nameHeader = document.createElement('h3');
        nameHeader.textContent = npcName;
        areaDiv.appendChild(nameHeader);

        const transcriptDiv = document.createElement('div');
        transcriptDiv.className = 'npc-transcript';
        transcriptDiv.id = `transcript-${npcIdStr}`;

        // --- NEW: Add the description prologue ---
        const descriptionP = document.createElement('p');
        descriptionP.className = 'npc-description-prologue';
        descriptionP.textContent = npcDescription;
        transcriptDiv.appendChild(descriptionP);
        // ---

        const sceneEventP = document.createElement('p');
        sceneEventP.className = 'scene-event';
        sceneEventP.innerHTML = `<em>Dialogue with ${npcName} begins.</em>`;
        transcriptDiv.appendChild(sceneEventP);

        areaDiv.appendChild(transcriptDiv);

        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.id = `ai-suggestions-${npcIdStr}`;
        suggestionsDiv.className = 'ai-suggestions-for-npc';
        suggestionsDiv.style.display = 'none';
        areaDiv.appendChild(suggestionsDiv);
        
        containerElement.appendChild(areaDiv);
    },

    removeNpcDialogueAreaUI: function(npcIdStr, containerElement) {
        const areaDiv = Utils.getElem(`npc-area-${npcIdStr}`);
        if (areaDiv) areaDiv.remove();
        if (appState.getActiveNpcCount() === 0 && containerElement && !containerElement.querySelector('p.scene-event')) {
            containerElement.innerHTML = '<p class="scene-event">Select NPCs from the SCENE tab to add them to the interaction.</p>';
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

    renderSuggestionsArea: function(aiResult, forNpcId) {
        const globalSuggestionsArea = Utils.getElem('ai-suggestions');
        if (!globalSuggestionsArea) return;

        let hasContentToDisplay = false;

        // Part 1: Render Canned Responses for the currently profiled character
        const cannedResponses = appState.cannedResponsesForProfiledChar || {};
        const cannedContainer = Utils.getElem('canned-responses-list');
        const cannedDisplay = Utils.getElem('canned-response-display');
        const prevBtn = Utils.getElem('prev-canned-btn');
        const nextBtn = Utils.getElem('next-canned-btn');
        const sendBtn = Utils.getElem('send-canned-btn');
        
        if (cannedContainer && cannedDisplay && prevBtn && nextBtn && sendBtn) {
            const keys = Object.keys(cannedResponses);
            if (keys.length > 0) {
                hasContentToDisplay = true;
                cannedContainer.style.display = 'flex'; // Show if content exists
                const currentKey = keys[appState.currentCannedResponseIndex];
                const currentResponse = cannedResponses[currentKey] || "Response not found.";
                cannedDisplay.innerHTML = `<p><strong>${Utils.escapeHtml(currentKey)}:</strong> ${Utils.escapeHtml(currentResponse)}</p>`;
                Utils.disableBtn('send-canned-btn', false);
                Utils.disableBtn('prev-canned-btn', appState.currentCannedResponseIndex <= 0);
                Utils.disableBtn('next-canned-btn', appState.currentCannedResponseIndex >= keys.length - 1);
            } else {
                cannedContainer.style.display = 'none'; // Hide if no content
            }
        }

        // Part 2: Render AI Suggestions if they exist for the interacting character
        const profiledCharId = appState.getCurrentProfileCharId();
        if (aiResult && forNpcId && forNpcId === profiledCharId) {
            const suggestionTypes = {
                'memories': { title: 'Suggested Memories', data: aiResult.new_memory_suggestions, render: item => `${Utils.escapeHtml(item)} <button onclick="App.addSuggestedMemoryAsActual('${forNpcId}', '${Utils.escapeHtml(item).replace(/'/g, "\\'")}')">Add</button>` },
                'topics': { title: 'Suggested Conversation Topics', data: aiResult.generated_topics, render: item => `<div class="clickable-suggestion" onclick="App.sendTopicToChat('${Utils.escapeHtml(item).replace(/'/g, "\\'")}')">${Utils.escapeHtml(item)}</div>` },
                'npc-actions': { title: 'Suggested NPC Actions/Thoughts', data: aiResult.suggested_npc_actions, render: item => Utils.escapeHtml(item) },
                'player-checks': { title: 'Suggested Player Checks', data: aiResult.suggested_player_checks, render: item => Utils.escapeHtml(item) }
            };

            for (const [key, config] of Object.entries(suggestionTypes)) {
                const listDiv = Utils.getElem(`suggested-${key}-list`);
                if (listDiv) {
                    if (config.data && config.data.length > 0) {
                        listDiv.style.display = 'flex';
                        listDiv.innerHTML = `<h5>${config.title}</h5>` + config.data.map(item => `<div class="suggested-item">${config.render(item)}</div>`).join('');
                        hasContentToDisplay = true;
                    } else {
                        listDiv.style.display = 'none';
                    }
                }
            }

            const standingChangesDiv = Utils.getElem('suggested-faction-standing-changes');
            if (standingChangesDiv) {
                if (aiResult.suggested_new_standing && aiResult.suggested_standing_pc_id) {
                    standingChangesDiv.style.display = 'flex';
                    const pcForStanding = appState.getCharacterById(aiResult.suggested_standing_pc_id);
                    const pcNameForStanding = pcForStanding ? pcForStanding.name : "the speaker";
                    const standingValue = (typeof aiResult.suggested_new_standing === 'object' && aiResult.suggested_new_standing !== null) ? aiResult.suggested_new_standing.value : aiResult.suggested_new_standing;
                    standingChangesDiv.innerHTML = `<h5>Suggested Faction Standing Change:</h5>
                        <div class="suggested-item">
                            Towards ${Utils.escapeHtml(pcNameForStanding)}: ${Utils.escapeHtml(standingValue)}
                            (Justification: ${Utils.escapeHtml(aiResult.standing_change_justification || 'None')})
                            <button onclick="App.acceptFactionStandingChange('${forNpcId}', '${aiResult.suggested_standing_pc_id}', '${Utils.escapeHtml(standingValue)}')">Accept</button>
                        </div>`;
                    hasContentToDisplay = true;
                } else {
                     standingChangesDiv.style.display = 'none';
                }
            }

        } else { // Clear and HIDE previous AI suggestions if there's no new result
             ['memories', 'topics', 'npc-actions', 'player-checks', 'faction-standing-changes'].forEach(suggType => {
                const targetDiv = Utils.getElem(`suggested-${suggType}-list`);
                if(targetDiv) {
                    targetDiv.style.display = 'none';
                }
             });
        }

        // Final visibility check for the main container
        globalSuggestionsArea.style.display = hasContentToDisplay ? 'flex' : 'none';
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
                    null
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
        let titleHTML = this.createPcQuickViewSectionHTML(false);
        let cardsHTML = '';
        activePcsData.sort((a, b) => a.name.localeCompare(b.name)).forEach(pc => {
            if (typeof pc.calculatedProfBonus === 'undefined') {
                const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || pc.vtt_data?.details?.level || 1;
                pc.calculatedProfBonus = DNDCalculations.getProficiencyBonus(pcLevel);
             }
            cardsHTML += this.generatePcQuickViewCardHTML(pc, true);
        });
        wrapperElement.innerHTML = titleHTML + `<div class="pc-dashboard-grid">${cardsHTML}</div>`;
        wrapperElement.style.display = 'block';
    },

    populateExpandedSkillDetailsUI: function(skillKey, expansionDiv, selectedPcs) {
    if (!expansionDiv) { console.error("populateExpandedSkillDetailsUI: expansionDiv is null for", skillKey); return; }
    const skillFullName = SKILL_NAME_MAP[skillKey] || skillKey;
    expansionDiv.innerHTML = `<h5>${skillFullName} Bonus Details & Comparisons</h5>`;

    const barChartContainer = document.createElement('div');
    barChartContainer.className = 'skill-bar-chart-container';
    expansionDiv.appendChild(barChartContainer);

    selectedPcs.forEach(pc => {
        const skillData = pc.system?.skills?.[skillKey];
        const abilityKeyForSkill = skillData?.ability || SKILL_NAME_MAP[skillKey].match(/\(([^)]+)\)/)[1].toLowerCase();
        const abilityScore = pc.system?.abilities?.[abilityKeyForSkill]?.value || 10;
        const bonus = DNDCalculations.calculateSkillBonus(abilityScore, skillData?.value || 0, pc.calculatedProfBonus);
        barChartContainer.innerHTML += this.generateBarChartRowHTML(pc.name, bonus, bonus, 15);
    });
     expansionDiv.innerHTML += `<p><em>Passive ${skillFullName}: Calculated as 10 + Skill Bonus.</em></p>`;
},

    renderDetailedPcSheetUI: function(pcData, dashboardContentElement) {
        if (!pcData || pcData.character_type !== 'PC' || !(pcData.system)) {
            console.error("UIRenderers.renderDetailedPcSheetUI: PC not found or invalid system data:", pcData);
            if (dashboardContentElement) dashboardContentElement.innerHTML = `<p>Error loading PC. <button onclick="handleBackToDashboardOverview()">Back to Dashboard Overview</button></p>`;
            return;
        }
        dashboardContentElement.innerHTML = ''; 

        const pcLevel = pcData.system?.details?.level || 1;
        pcData.calculatedProfBonus = DNDCalculations.getProficiencyBonus(pcLevel);

        let sheetHTML = `<div class="detailed-pc-sheet">
            <button class="close-detailed-pc-sheet-btn" onclick="handleBackToDashboardOverview()" title="Back to Dashboard Overview">&times;</button>
            <h3>${pcData.name} - Level ${pcLevel} ${pcData.system?.details?.race || ''} ${DNDCalculations.getCharacterClassNames(pcData).join('/') || ''}</h3>`;

        sheetHTML += `<div class="pc-section"><h4>Ability Scores</h4><div class="table-wrapper"><table class="detailed-pc-ability-table"><thead><tr>`;
        ABILITY_KEYS_ORDER.forEach(key => sheetHTML += `<th>${key.toUpperCase()}</th>`);
        sheetHTML += `</tr></thead><tbody><tr>`;
        ABILITY_KEYS_ORDER.forEach(key => {
            const score = (pcData.system?.abilities?.[key]?.value) || 10;
            sheetHTML += `<td>${score}</td>`;
        });
        sheetHTML += `</tr><tr>`;
        ABILITY_KEYS_ORDER.forEach(key => {
            const score = (pcData.system?.abilities?.[key]?.value) || 10;
            const mod = DNDCalculations.getAbilityModifier(score);
            sheetHTML += `<td>(${mod >= 0 ? '+' : ''}${mod})</td>`;
        });
        sheetHTML += `</tr></tbody></table></div></div>`;

        sheetHTML += `<div class="pc-section"><h4>Derived Combat Stats</h4><table class="detailed-pc-table">`;
        const ac = DNDCalculations.calculateDisplayAC(pcData);
        const initiative = DNDCalculations.getAbilityModifier(pcData.system?.abilities?.[pcData.system?.attributes?.init?.ability || 'dex']?.value || 10) + (parseInt(pcData.system?.attributes?.init?.bonus) || 0);
        const speed = pcData.system?.attributes?.movement?.walk ?? 30;
        const spellDC = DNDCalculations.spellSaveDC(pcData);
        const spellAtk = DNDCalculations.spellAttackBonus(pcData);

        sheetHTML += `<tr><th>Armor Class</th><td>${ac}</td></tr>`;
        sheetHTML += `<tr><th>Initiative</th><td>${initiative >= 0 ? '+' : ''}${initiative}</td></tr>`;
        sheetHTML += `<tr><th>Speed</th><td>${speed} ft</td></tr>`;
        sheetHTML += `<tr><th>Proficiency Bonus</th><td>+${pcData.calculatedProfBonus}</td></tr>`;
        sheetHTML += `<tr><th>Spell Save DC</th><td>${spellDC}</td></tr>`;
        sheetHTML += `<tr><th>Spell Attack Bonus</th><td>${spellAtk >= 0 ? '+' : ''}${spellAtk}</td></tr>`;
        sheetHTML += `</table></div>`;

        sheetHTML += `<div class="pc-section"><h4>Skills</h4><div class="table-wrapper"><table class="detailed-pc-table"><thead><tr><th>Skill</th><th>Bonus</th><th>Passive</th></tr></thead><tbody>`;
        for (const skillKey in SKILL_NAME_MAP) {
            const skillData = pcData.system?.skills?.[skillKey];
            const abilityKey = skillData?.ability || SKILL_NAME_MAP[skillKey].match(/\(([^)]+)\)/)[1].toLowerCase();
            const score = pcData.system?.abilities?.[abilityKey]?.value || 10;
            const bonus = DNDCalculations.calculateSkillBonus(score, skillData?.value || 0, pcData.calculatedProfBonus);
            const passive = DNDCalculations.calculatePassiveSkill(score, skillData?.value || 0, pcData.calculatedProfBonus);
            sheetHTML += `<tr><td>${SKILL_NAME_MAP[skillKey]}</td><td>${bonus >= 0 ? '+' : ''}${bonus}</td><td>${passive}</td></tr>`;
        }
        sheetHTML += `</tbody></table></div></div>`;


        sheetHTML += `<div class="pc-section"><h4>Other Details</h4>`;
        sheetHTML += `<p><strong>Alignment:</strong> ${pcData.system?.details?.alignment || 'N/A'}</p>`;
        sheetHTML += `<p><strong>Background:</strong> ${pcData.system?.details?.background || 'N/A'}</p>`;
        const languages = pcData.system?.traits?.languages?.value?.map(lang => lang.charAt(0).toUpperCase() + lang.slice(1)).join(', ') || 'None';
        sheetHTML += `<p><strong>Languages:</strong> ${languages}</p>`;

        const armorProfs = pcData.system?.traits?.armorProf?.value?.join(', ') || 'None';
        sheetHTML += `<p><strong>Armor Proficiencies:</strong> ${armorProfs}</p>`;
        const weaponProfs = pcData.system?.traits?.weaponProf?.value?.join(', ') || 'None';
        sheetHTML += `<p><strong>Weapon Proficiencies:</strong> ${weaponProfs}</p>`;
        sheetHTML += `</div>`;


        sheetHTML += `</div>`;
        dashboardContentElement.innerHTML = sheetHTML;
    },

    updateMainViewUI: function(dialogueInterfaceElem, pcDashboardViewElem, pcQuickViewInSceneElem, activeNpcCount, showPcDashboard) {
        if (!dialogueInterfaceElem || !pcDashboardViewElem || !pcQuickViewInSceneElem) { return; }
        const dashboardContent = Utils.getElem('pc-dashboard-content');
        const isDetailedSheetVisible = dashboardContent && dashboardContent.querySelector('.detailed-pc-sheet');

        if (activeNpcCount > 0 && !isDetailedSheetVisible) {
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
                    this.updatePcDashboardUI(dashboardContent, appState.getAllCharacters(), appState.activePcIds, appState.getExpandedAbility());
                } else {
                    dashboardContent.innerHTML = `<p class="pc-dashboard-no-selection">Select Player Characters from the left panel to view their details and comparisons.</p>`;
                }
            }
        }
        Utils.disableBtn('generate-dialogue-btn', activeNpcCount === 0);
    }
};

window.closeLoreDetailViewUI = UIRenderers.closeLoreDetailViewUI;

console.log("uiRenderers.js: All functions are now part of the UIRenderers namespace. Parsing FINISHED.");
/* server/static/pc-renderers.js */
// Responsibility: Rendering Player Character (PC) related UI elements.

const ABILITY_SCORE_INFO = {
    "STR": { "title": "Strength", "description": "Strength measures bodily power, athletic training, and the extent to which you can exert raw physical force.", "checks_title": "Strength Checks", "checks_description": "A Strength check can model any attempt to lift, push, pull, or break something, to force your body through a space, or to otherwise apply brute force to a situation. The Athletics skill reflects aptitude in certain kinds of Strength checks.", "skills": { "Athletics": "Your Strength (Athletics) check covers difficult situations you encounter while climbing, jumping, or swimming." }, "other_checks_title": "Other Strength Checks", "other_checks": ["Force open a stuck, locked, or barred door", "Break free of bonds", "Push through a tunnel that is too small", "Hang on to a wagon while being dragged behind it", "Tip over a statue", "Keep a boulder from rolling"], "attack_and_damage_title": "Attack Rolls and Damage", "attack_and_damage": "You add your Strength modifier to your attack roll and your damage roll when attacking with a melee weapon.", "lifting_and_carrying_title": "Lifting and Carrying", "lifting_and_carrying": "Your carrying capacity is your Strength score multiplied by 15. You can push, drag, or lift a weight in pounds up to twice your carrying capacity (or 30 times your Strength score)." },
    "DEX": { "title": "Dexterity", "description": "Dexterity measures agility, reflexes, and balance.", "checks_title": "Dexterity Checks", "checks_description": "A Dexterity check can model any attempt to move nimbly, quickly, or quietly, or to keep from falling on tricky footing. The Acrobatics, Sleight of Hand, and Stealth skills reflect aptitude in certain kinds of Dexterity checks.", "skills": { "Acrobatics": "Your Dexterity (Acrobatics) check covers your attempt to stay on your feet in a tricky situation, such as when you’re trying to run across a sheet of ice or balance on a tightrope.", "Sleight of Hand": "Whenever you attempt an act of legerdemain or manual trickery, such as planting something on someone else or concealing an object on your person, make a Dexterity (Sleight of Hand) check.", "Stealth": "Make a Dexterity (Stealth) check when you attempt to conceal yourself from enemies, slink past guards, or sneak up on someone without being seen or heard." }, "other_checks_title": "Other Dexterity Checks", "other_checks": ["Pick a lock", "Disable a trap", "Securely tie up a prisoner", "Wriggle free of bonds", "Play a stringed instrument"], "attack_and_damage_title": "Attack Rolls and Damage", "attack_and_damage": "You add your Dexterity modifier to your attack roll and your damage roll when attacking with a ranged weapon or a melee weapon that has the finesse property.", "armor_class_title": "Armor Class", "armor_class": "Depending on the armor you wear, you might add some or all of your Dexterity modifier to your Armor Class.", "initiative_title": "Initiative", "initiative": "At the beginning of every combat, you roll initiative by making a Dexterity check." },
    "CON": { "title": "Constitution", "description": "Constitution measures health, stamina, and vital force.", "checks_title": "Constitution Checks", "checks_description": "Constitution checks are uncommon, and no skills apply to Constitution checks, because the endurance this ability represents is largely passive. A Constitution check can model your attempt to push beyond normal limits.", "other_checks_title": "Other Constitution Checks", "other_checks": ["Hold your breath", "March or labor for hours without rest", "Go without sleep", "Survive without food or water", "Quaff an entire stein of ale in one go"], "hit_points_title": "Hit Points", "hit_points": "Your Constitution modifier contributes to your hit points. If your Constitution modifier changes, your hit point maximum changes as well, as though you had the new modifier from 1st level." },
    "INT": { "title": "Intelligence", "description": "Intelligence measures mental acuity, accuracy of recall, and the ability to reason.", "checks_title": "Intelligence Checks", "checks_description": "An Intelligence check comes into play when you need to draw on logic, education, memory, or deductive reasoning. The Arcana, History, Investigation, Nature, and Religion skills reflect aptitude in certain kinds of Intelligence checks.", "skills": { "Arcana": "Measures your ability to recall lore about spells, magic items, eldritch symbols, and magical traditions.", "History": "Measures your ability to recall lore about historical events, legendary people, ancient kingdoms, and lost civilizations.", "Investigation": "When you look around for clues and make deductions based on those clues, you make an Intelligence (Investigation) check.", "Nature": "Measures your ability to recall lore about terrain, plants and animals, the weather, and natural cycles.", "Religion": "Measures your ability to recall lore about deities, rites and prayers, religious hierarchies, and holy symbols." }, "spellcasting_ability_title": "Spellcasting Ability", "spellcasting_ability": "Wizards use Intelligence as their spellcasting ability, which helps determine the saving throw DCs of spells they cast." },
    "WIS": { "title": "Wisdom", "description": "Wisdom reflects how attuned you are to the world around you and represents perceptiveness and intuition.", "checks_title": "Wisdom Checks", "checks_description": "A Wisdom check might reflect an effort to read body language, understand someone’s feelings, notice things about the environment, or care for an injured person. The Animal Handling, Insight, Medicine, Perception, and Survival skills reflect aptitude in certain kinds of Wisdom checks.", "skills": { "Animal Handling": "When there is any question whether you can calm down a domesticated animal, keep a mount from getting spooked, or intuit an animal’s intentions, the GM might call for a Wisdom (Animal Handling) check.", "Insight": "Your Wisdom (Insight) check decides whether you can determine the true intentions of a creature, such as when searching out a lie or predicting someone’s next move.", "Medicine": "A Wisdom (Medicine) check lets you try to stabilize a dying companion or diagnose an illness.", "Perception": "Your Wisdom (Perception) check lets you spot, hear, or otherwise detect the presence of something. It measures your general awareness of your surroundings and the keenness of your senses.", "Survival": "The GM might ask you to make a Wisdom (Survival) check to follow tracks, hunt wild game, guide your group through frozen wastelands, or identify signs that owlbears live nearby." }, "spellcasting_ability_title": "Spellcasting Ability", "spellcasting_ability": "Clerics, druids, and rangers use Wisdom as their spellcasting ability." },
    "CHA": { "title": "Charisma", "description": "Charisma measures your ability to interact effectively with others. It includes such factors as confidence and eloquence, and it can represent a charming or commanding personality.", "checks_title": "Charisma Checks", "checks_description": "A Charisma check might arise when you try to influence or entertain others, when you try to make an impression or tell a convincing lie, or when you are navigating a tricky social situation. The Deception, Intimidation, Performance, and Persuasion skills reflect aptitude in certain kinds of Charisma checks.", "skills": { "Deception": "Your Charisma (Deception) check determines whether you can convincingly hide the truth, either verbally or through your actions.", "Intimidation": "When you attempt to influence someone through overt threats, hostile actions, and physical violence, the GM might call for a Charisma (Intimidation) check.", "Performance": "Your Charisma (Performance) check determines how well you can delight an audience with music, dance, acting, storytelling, or some other form of entertainment.", "Persuasion": "When you attempt to influence someone or a group of people with tact, social graces, or good nature, the GM might ask you to make a Charisma (Persuasion) check." }, "spellcasting_ability_title": "Spellcasting Ability", "spellcasting_ability": "Bards, paladins, sorcerers, and warlocks use Charisma as their spellcasting ability." }
};

var PCRenderers = {
    createPcQuickViewSectionHTML: function(isForDashboard) {
        const titleText = typeof PC_QUICK_VIEW_BASE_TITLE !== 'undefined' ? PC_QUICK_VIEW_BASE_TITLE : 'Player Characters';
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

        // --- INLINE STYLES FOR CARD ---
        // We add inline styles here to force the behavior regardless of external CSS class rules
        const cardStyle = isClickableForDetailedView ? 
            'flex: 1 1 0; min-width: 0; width: auto; margin: 0 4px; overflow: hidden;' : 
            '';

        let cardHTML = `<div class="${cardClasses}" style="${cardStyle}" data-pc-id="${String(pc._id)}">`;
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
            barChartContainer.innerHTML += UIWidgets.generateBarChartRowHTML(label, score, maxScore, 20);
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
                    const abilityKeyForSkill = skillData?.ability || SKILL_NAME_MAP[skillKey].match(/\(([^)]+)\)/)[1].toLowerCase();
                    const abilityScore = pc.system?.abilities?.[abilityKeyForSkill]?.value || 10;
                    const bonus = DNDCalculations.calculateSkillBonus(abilityScore, skillData?.value || 0, pc.calculatedProfBonus);
                    skillsTableHTML += `<td>${bonus >= 0 ? '+' : ''}${bonus}</td>`;
                });
                skillsTableHTML += `</tr>`;
            });

            skillsTableHTML += `</tbody></table></div>`;
            expansionDiv.innerHTML += skillsTableHTML;
        }
    },
    
    updatePcDashboardUI: function(dashboardContentElement, allCharacters, activePcIds, currentlyExpandedAbility) {
        console.group("--- [DEBUG] PCRenderers.updatePcDashboardUI ---");
        
        if (!dashboardContentElement) {
            console.error("ERROR: 'dashboardContentElement' is null/undefined. The ID 'pc-dashboard-content' might be missing from index.html.");
            console.groupEnd();
            return;
        }
        console.log("Target Element found:", dashboardContentElement);

        const selectedPcs = allCharacters.filter(char => activePcIds.has(String(char._id)) && (char.character_type === 'PC' || char.character_type === 'Player Character' || char.type === 'Player Character'));
        console.log(`Selected PCs count: ${selectedPcs.length}`);

        if (selectedPcs.length === 0) {
            dashboardContentElement.innerHTML = `<p class="pc-dashboard-no-selection">Select Player Characters from the left panel to view their details and comparisons.</p>`;
            console.groupEnd();
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
            // NOTE: false here because Dashboard view uses grid layout from CSS, not the forced flex row
            cardsHTML += this.generatePcQuickViewCardHTML(pc, false);
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
        console.log("Dashboard rendered.");
        console.groupEnd();
        
        if (currentlyExpandedAbility) {
            const expansionDiv = Utils.getElem('expanded-ability-details');
            if (expansionDiv) {
                this.populateExpandedAbilityDetailsUI(currentlyExpandedAbility, expansionDiv, sortedSelectedPcs);
            }
        }
    },

    renderPcQuickViewInSceneUI: function(wrapperElement, activePcsData) {
        if (!wrapperElement) { console.error("PCRenderers.renderPcQuickViewInSceneUI: wrapperElement not found"); return; }
        
        wrapperElement.innerHTML = '';
        
        if (!activePcsData || activePcsData.length === 0) {
            wrapperElement.style.display = 'none';
            return;
        }

        const container = document.createElement('div');
        container.className = 'collapsible-section expanded';
        
        const header = document.createElement('h4');
        header.className = 'collapsible-header';
        header.style.cursor = 'pointer';
        header.style.margin = '0 0 10px 0';
        header.innerHTML = `Player Characters in Scene <span class="arrow-indicator">▼</span>`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'collapsible-content';
        contentDiv.style.display = 'block';

        activePcsData.sort((a, b) => a.name.localeCompare(b.name));
        
        // 1. Generate Full Cards View (Single Row, No Wrap)
        // flex-wrap: nowrap is key. min-width: 0 on children (in generatePcQuickViewCardHTML) enables shrinking.
        let cardsHTML = `<div id="pc-scene-cards-view" style="display: flex; flex-flow: row nowrap; width: 100%; gap: 10px; overflow-x: hidden;">`;
        activePcsData.forEach(pc => {
             if (typeof pc.calculatedProfBonus === 'undefined') {
                const pcLevel = pc.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pc.system?.details?.level || 1;
                pc.calculatedProfBonus = DNDCalculations.getProficiencyBonus(pcLevel);
             }
            // Passing true here triggers the inline styles for flex items
            cardsHTML += this.generatePcQuickViewCardHTML(pc, true);
        });
        cardsHTML += `</div>`;

        // 2. Generate Compact Names View
        let compactHTML = `<div id="pc-scene-compact-view" style="display:none; flex-flow: row nowrap; overflow-x: auto; gap: 8px; align-items: center; padding-bottom: 4px; scrollbar-width: thin;">`;
        activePcsData.forEach(pc => {
            compactHTML += `<span class="pc-compact-badge" style="flex: 0 0 auto; background: #e2e6ea; padding: 4px 8px; border-radius: 4px; font-weight: bold; border: 1px solid #ccc; white-space: nowrap;">${pc.name}</span>`;
        });
        compactHTML += `</div>`;

        contentDiv.innerHTML = cardsHTML + compactHTML;

        // 3. Toggle Logic
        header.onclick = function() {
            const cardsView = contentDiv.querySelector('#pc-scene-cards-view');
            const compactView = contentDiv.querySelector('#pc-scene-compact-view');
            const arrow = this.querySelector('.arrow-indicator');

            const isCurrentlyExpanded = cardsView.style.display !== 'none';

            if (isCurrentlyExpanded) {
                // Collapse to Compact
                cardsView.style.display = 'none';
                compactView.style.display = 'flex';
                arrow.textContent = '►';
            } else {
                // Expand to Cards
                cardsView.style.display = 'flex'; // Restore flex
                compactView.style.display = 'none';
                arrow.textContent = '▼';
            }
        };

        container.appendChild(header);
        container.appendChild(contentDiv);
        wrapperElement.appendChild(container);
        wrapperElement.style.display = 'block';
    },

    populateExpandedSkillDetailsUI: function(skillKey, expansionDiv, selectedPcs) {
        if (!expansionDiv) { console.error("PCRenderers.populateExpandedSkillDetailsUI: expansionDiv is null for", skillKey); return; }
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
            barChartContainer.innerHTML += UIWidgets.generateBarChartRowHTML(pc.name, bonus, bonus, 15);
        });
         expansionDiv.innerHTML += `<p><em>Passive ${skillFullName}: Calculated as 10 + Skill Bonus.</em></p>`;
    },

    renderDetailedPcSheetUI: function(pcData, dashboardContentElement) {
        console.group("--- [DEBUG] PCRenderers.renderDetailedPcSheetUI ---");
        
        if (!pcData || !(pcData.system)) {
            console.error("ERROR: PC data not found or invalid.", pcData);
            if (dashboardContentElement) dashboardContentElement.innerHTML = `<p>Error loading PC. <button onclick="handleBackToDashboardOverview()">Back to Dashboard Overview</button></p>`;
            console.groupEnd();
            return;
        }

        if (!dashboardContentElement) {
            console.error("ERROR: dashboardContentElement is missing. Cannot render detailed sheet.");
            console.groupEnd();
            return;
        }
        console.log("Target Element:", dashboardContentElement);
        console.log("Data:", pcData.name);

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
        console.log("Detailed sheet rendered.");
        console.groupEnd();
    },

    // --- ADAPTER: Bridge between MainView calls and the detailed logic above ---
    renderPcDashboard: function(pcData) {
        console.log("[DEBUG] renderPcDashboard called.");
        const dashboard = document.getElementById('pc-dashboard-content');
        if (!dashboard) {
            console.error("[DEBUG] CRITICAL: 'pc-dashboard-content' element not found in DOM!");
            return;
        }

        if (pcData) {
            this.renderDetailedPcSheetUI(pcData, dashboard);
        } else {
            // Default Overview
            if (window.AppState) {
               this.updatePcDashboardUI(dashboard, AppState.getAllCharacters(), AppState.activePcIds, AppState.getExpandedAbility());
            }
        }
    },

    // --- HYBRID LIST RENDERER: Handles sidebar lists AND fix for click targets ---
    renderPcListUI: function(arg1, arg2, arg3, arg4, arg5, arg6) {
        console.log("PCRenderers.renderPcListUI called.");
        
        let pcList = [];
        let pcListDiv = document.getElementById('active-pc-list');
        let speakingPcSelect = document.getElementById('speaking-pc-select');
        let activePcIds = window.AppState ? window.AppState.activePcIds : new Set();
        // CRITICAL FIX: Ensure we use the correct callback if available globally, otherwise null
        let onPcItemClickCallback = window.handleTogglePcSelection; 

        // Argument Resolution: Supports new (pcList) and old (lots of args) signatures
        if (Array.isArray(arg1)) {
            pcList = arg1;
        } else {
            if (arg3) {
                 // FIX: Filter for both "PC" and "Player Character" to cover all DB variations
                 pcList = arg3.filter(char => char.character_type === 'PC' || char.character_type === 'Player Character' || char.type === 'Player Character').sort((a, b) => a.name.localeCompare(b.name));
            }
            if (arg1) pcListDiv = arg1;
            if (arg2) speakingPcSelect = arg2;
            if (arg4) activePcIds = arg4;
            if (arg5) onPcItemClickCallback = arg5;
        }

        // Render Sidebar List
        if (pcListDiv) {
            pcListDiv.innerHTML = '';
            if (!pcList || pcList.length === 0) {
                pcListDiv.innerHTML = '<ul><li><em>No active PCs.</em></li></ul>';
            } else {
                const ul = document.createElement('ul');
                pcList.forEach(pc => {
                    const li = document.createElement('li');
                    li.className = 'pc-entry'; 
                    if (activePcIds.has(String(pc._id)) || (window.AppState && window.AppState.activePc && window.AppState.activePc.id === pc._id)) {
                        li.classList.add('selected');
                    }

                    // CSS FIX: Create a clickable text span that fills the row
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'pc-name-clickable';
                    nameSpan.textContent = pc.name;
                    
                    // Event Handler for Sidebar Click
                    nameSpan.onclick = (e) => {
                        e.stopPropagation();
                        console.log("[DEBUG] Clicked PC Name:", pc.name, pc._id);
                        if (onPcItemClickCallback) {
                            onPcItemClickCallback(String(pc._id));
                        } else {
                            console.warn("No callback defined for PC selection");
                        }
                    };

                    li.appendChild(nameSpan);
                    ul.appendChild(li);
                });
                pcListDiv.appendChild(ul);
            }
        }

        // Update Speaking Dropdown (if present)
        if (speakingPcSelect) {
            const currentSpeaker = speakingPcSelect.value;
            speakingPcSelect.innerHTML = '<option value="">-- DM/Scene Event --</option>';

            // PCs
            pcList.forEach(pc => {
                const option = document.createElement('option');
                option.value = String(pc._id);
                option.textContent = `(PC) ${pc.name}`;
                speakingPcSelect.appendChild(option);
            });

            // NPCs (Fetch from AppState since they aren't passed in simple signature)
            if (window.AppState) {
                const activeNpcs = window.AppState.getActiveNpcIds().map(id => window.AppState.getCharacterById(id)).filter(n => n);
                if (activeNpcs.length > 0) {
                    const separator = document.createElement('option');
                    separator.disabled = true;
                    separator.textContent = '--- NPCs in Scene ---';
                    speakingPcSelect.appendChild(separator);
                    
                    activeNpcs.forEach(npc => {
                        const option = document.createElement('option');
                        option.value = String(npc._id);
                        option.textContent = `(NPC) ${npc.name}`;
                        speakingPcSelect.appendChild(option);
                    });
                }
            }

            // Restore selection
            if (Array.from(speakingPcSelect.options).some(opt => opt.value === currentSpeaker)) {
                speakingPcSelect.value = currentSpeaker;
            }
        }
    }
};
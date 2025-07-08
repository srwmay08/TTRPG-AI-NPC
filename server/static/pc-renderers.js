// static/pc-renderers.js
// Responsibility: Functions for rendering Player Character (PC) specific UI elements.

const PCRenderers = {
    renderPcListUI: function(pcListDiv, allCharacters, activePcIds, onPcItemClickCallback) {
        if (!pcListDiv) {
            console.error("PCRenderers.renderPcListUI: pcListDiv not found");
            return;
        }
        pcListDiv.innerHTML = '';
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

    updatePcDashboardUI: function(dashboardContentElement, allCharacters, activePcIds, currentlyExpandedAbility) {
        if (!dashboardContentElement) {
            console.error("PCRenderers.updatePcDashboardUI: 'pc-dashboard-content' element not found.");
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
                UIWidgets.populateExpandedAbilityDetailsUI(currentlyExpandedAbility, expansionDiv, sortedSelectedPcs);
            }
        }
    },
    
    renderDetailedPcSheetUI: function(pcData, dashboardContentElement) {
        if (!pcData || pcData.character_type !== 'PC' || !(pcData.system)) {
            console.error("PCRenderers.renderDetailedPcSheetUI: PC not found or invalid system data:", pcData);
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
    }
};
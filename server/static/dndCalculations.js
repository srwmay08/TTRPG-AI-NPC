// static/dndCalculations.js

const MONSTER_STATS_BY_CR = {
    0: 13, 0.125: 13, 0.25: 13, 0.5: 13, 1: 13, 2: 13, 3: 13, 4: 14, 5: 15,
    6: 15, 7: 15, 8: 16, 9: 16, 10: 17, 11: 17, 12: 17, 13: 18, 14: 18,
    15: 18, 16: 18, 17: 19, 18: 19, 19: 19, 20: 19, 21: 20, 22: 20, 23: 20,
    24: 21, 25: 21, 26: 21, 27: 22, 28: 22, 29: 22, 30: 22
};

const DIE_AVERAGES = {
    'd4': 2.5, 'd6': 3.5, 'd8': 4.5, 'd10': 5.5, 'd12': 6.5, 'd20': 10.5
};

var DNDCalculations = {
    getAbilityModifier: function(score) {
        return Math.floor(((score || 10) - 10) / 2);
    },

    carryingCapacity: function(score) {
        return (score || 10) * 15;
    },

    pushDragLift: function(score) {
        return (score || 10) * 30;
    },

    longJump: function(score, running = true) {
        score = score || 10;
        return running ? score : Math.floor(score / 2);
    },

    highJump: function(score, running = true) {
        score = score || 10;
        const mod = this.getAbilityModifier(score);
        return running ? (3 + mod) : Math.floor((3 + mod) / 2);
    },

    getInitiativeBonus: function(dexModifier, otherBonuses = 0) {
        return dexModifier + (otherBonuses || 0);
    },

    holdBreath: function(conScore) {
        conScore = conScore || 10;
        return Math.max(1 + this.getAbilityModifier(conScore), 0.5) + " minutes";
    },

    savingThrowBonus: function(abilityScore, proficientInSave = false, proficiencyBonus = 0) {
        const mod = this.getAbilityModifier(abilityScore || 10);
        return mod + (proficientInSave ? proficiencyBonus : 0);
    },

    calculateSkillBonus: function(baseStatScore, skillProficiencyValue, proficiencyBonus) {
        const modifier = this.getAbilityModifier(baseStatScore || 10);
        let skillBonus = modifier;
        if (skillProficiencyValue === 1) { // Proficient
            skillBonus += proficiencyBonus;
        } else if (skillProficiencyValue === 2) { // Expertise
            skillBonus += (proficiencyBonus * 2);
        } else if (skillProficiencyValue === 0.5) { // Half-Proficiency (e.g., Jack of All Trades)
            skillBonus += Math.floor(proficiencyBonus / 2);
        }
        return skillBonus;
    },

    calculatePassiveSkill: function(baseStatScore, skillProficiencyValue, proficiencyBonus) {
        const skillBonus = this.calculateSkillBonus(baseStatScore || 10, skillProficiencyValue, proficiencyBonus);
        return 10 + skillBonus;
    },

    getProficiencyBonus: function(level) {
        level = level || 1;
        if (level < 1) return 2;
        if (level <= 4) return 2;
        if (level <= 8) return 3;
        if (level <= 12) return 4;
        if (level <= 16) return 5;
        return 6; // Level 17+
    },

    getUnarmoredAC: function(dexModifier) {
        return 10 + dexModifier;
    },

    getBarbarianUnarmoredAC: function(dexModifier, conModifier) {
        return 10 + dexModifier + conModifier;
    },

    getMonkUnarmoredAC: function(dexModifier, wisModifier) {
        return 10 + dexModifier + wisModifier;
    },

    getMeleeAttackBonus: function(abilityModifier, proficiencyBonus) {
        return abilityModifier + proficiencyBonus;
    },

    getRangedAttackBonus: function(dexModifier, proficiencyBonus) {
        return dexModifier + proficiencyBonus;
    },

    getMeleeDamageBonus: function(abilityModifier) {
        return abilityModifier;
    },

    getRangedDamageBonus: function(dexModifier) {
        return dexModifier;
    },

    CLASS_SPELLCASTING_ABILITIES: {
        'bard': 'cha', 'paladin': 'cha', 'sorcerer': 'cha', 'warlock': 'cha',
        'cleric': 'wis', 'druid': 'wis', 'ranger': 'wis', 'monk': 'wis',
        'wizard': 'int', 'artificer': 'int'
    },

    getCharacterClassNames: function(pcData) {
        const classNames = new Set();
        // 1. Check the primary class_str property (from our JSON definitions)
        if (pcData && pcData.class_str) {
            classNames.add(pcData.class_str.toLowerCase().split('(')[0].trim());
        }
        // 2. Check items array for class items (from VTT imports)
        if (pcData && pcData.items) {
            pcData.items.forEach(item => {
                if (item.type === 'class' && item.name) {
                    classNames.add(item.name.toLowerCase());
                }
            });
        }
        // 3. Fallbacks for other possible data structures
        if (classNames.size === 0 && pcData && pcData.vtt_data?.details?.originalClass) {
            classNames.add(pcData.vtt_data.details.originalClass.toLowerCase());
        }
         if (classNames.size === 0 && pcData && pcData.system?.details?.class) {
            classNames.add(pcData.system.details.class.toLowerCase());
        }
        return Array.from(classNames);
    },

    getSpellcastingAbilityKeyForPC: function(pcData) {
        if (!pcData) return null;
        let mainSpellcastingAttr = pcData.system?.attributes?.spellcasting || pcData.vtt_data?.attributes?.spellcasting;
        if (mainSpellcastingAttr && typeof mainSpellcastingAttr === 'string' && mainSpellcastingAttr.length === 3) {
            return mainSpellcastingAttr.toLowerCase();
        }
        const classNames = this.getCharacterClassNames(pcData);
        if (classNames.length > 0) {
            for (const className of classNames) {
                for (const knownClass in this.CLASS_SPELLCASTING_ABILITIES) {
                    if (className.includes(knownClass)) {
                        return this.CLASS_SPELLCASTING_ABILITIES[knownClass];
                    }
                }
            }
        }
        return null; // Return null if no spellcasting class found
    },

    spellSaveDC: function(pcData) {
        if (!pcData || !(pcData.vtt_data?.abilities || pcData.system?.abilities)) return 'N/A';
        const spellcastingAbilityKey = this.getSpellcastingAbilityKeyForPC(pcData);
        if (!spellcastingAbilityKey) {
             // For non-casters or if ability can't be determined
            return 'N/A';
        }

        const abilities = pcData.system?.abilities || pcData.vtt_data.abilities;
        const abilityScore = abilities[spellcastingAbilityKey]?.value || 10;
        const proficiencyBonus = pcData.calculatedProfBonus ?? 2;

        if (typeof proficiencyBonus !== 'number') return 'N/A (Proficiency Error)';
        return 8 + this.getAbilityModifier(abilityScore) + proficiencyBonus;
    },

    spellAttackBonus: function(pcData) {
        if (!pcData || !(pcData.vtt_data?.abilities || pcData.system?.abilities)) return 'N/A';
        const spellcastingAbilityKey = this.getSpellcastingAbilityKeyForPC(pcData);
        if (!spellcastingAbilityKey) {
            return 'N/A';
        }
        
        const abilities = pcData.system?.abilities || pcData.vtt_data.abilities;
        const abilityScore = abilities[spellcastingAbilityKey]?.value || 10;
        const proficiencyBonus = pcData.calculatedProfBonus ?? 2;
        
        if (typeof proficiencyBonus !== 'number') return 'N/A (Proficiency Error)';
        return this.getAbilityModifier(abilityScore) + proficiencyBonus;
    },

    getShieldBonus: function(pcData) {
        if (pcData && pcData.items) {
            const equippedShield = pcData.items.find(item =>
                item.type === 'equipment' &&
                item.system?.equipped &&
                item.system?.armor?.type === 'shield'
            );
            if (equippedShield && equippedShield.system?.armor) {
                return equippedShield.system.armor.value || 0;
            }
        }
        return 0;
    },
    
    calculateDisplayAC: function(pcData) {
        const armor = pcData.items.find(i => i.system?.equipped && i.type === 'equipment' && i.system?.armor?.value);
        if (armor) {
            let ac = armor.system.armor.value;
            if (armor.system.armor.dex !== null) {
                const dexMod = this.getAbilityModifier(pcData.system.abilities.dex.value);
                ac += Math.min(dexMod, armor.system.armor.dex);
            }
            const shieldBonus = this.getShieldBonus(pcData);
            return ac + shieldBonus;
        }
        // Unarmored
        const dexMod = this.getAbilityModifier(pcData.system.abilities.dex.value);
        let baseAc = 10 + dexMod;
        const classNames = this.getCharacterClassNames(pcData);
        if (classNames.includes('monk')) {
            baseAc = 10 + dexMod + this.getAbilityModifier(pcData.system.abilities.wis.value);
        } else if (classNames.includes('barbarian')) {
            baseAc = 10 + dexMod + this.getAbilityModifier(pcData.system.abilities.con.value);
        }
        const shieldBonus = this.getShieldBonus(pcData);
        return baseAc + shieldBonus;
    },

    getAverageDamage: function(diceString) {
        if (!diceString || typeof diceString !== 'string') return 0;
        const parts = diceString.split('+').map(part => part.trim());
        let totalAverage = 0;
        parts.forEach(part => {
            if (part.includes('d')) {
                const [numDice, dieType] = part.split('d');
                const avg = DIE_AVERAGES[`d${dieType}`];
                if (avg) {
                    totalAverage += (parseInt(numDice, 10) * avg);
                }
            } else if (!isNaN(parseInt(part, 10))) {
                totalAverage += parseInt(part, 10);
            }
        });
        return totalAverage;
    },

    calculateDPR: function(pcData, attackItem, targetAC) {
        if (!pcData || !attackItem || !pcData.system) return { name: attackItem.name, dpr: 'N/A', dprAdv: 'N/A' };

        const pcLevel = pcData.system?.details?.level || 1;
        const profBonus = this.getProficiencyBonus(pcLevel);
        const abilities = pcData.system.abilities;

        let abilityMod = 0;
        let attackBonus = 0;
        let baseDamageDice = [];
        let bonusDamage = 0;
        let attackName = attackItem.name;
        
        const isMonk = this.getCharacterClassNames(pcData).includes('monk');

        // Logic for different attack types
        if (attackItem.type === 'weapon') {
            const weaponData = attackItem.system;
            const isMonkWeapon = isMonk && (weaponData.properties?.includes('fin') || weaponData.type.baseItem === 'shortsword' || weaponData.type.value === 'simpleM');
            
            let abilityKey = 'str';
            if(weaponData.properties?.includes('fin')) {
                abilityKey = abilities.dex.value > abilities.str.value ? 'dex' : 'str';
            }
            if(isMonkWeapon) {
                 abilityKey = abilities.dex.value > abilities.str.value ? 'dex' : 'str';
            }

            abilityMod = this.getAbilityModifier(abilities[abilityKey]?.value || 10);
            attackBonus = abilityMod + profBonus;
            bonusDamage = abilityMod;

            let damageDie = `${weaponData.damage?.base?.number || 1}d${weaponData.damage?.base?.denomination}`;
            if(isMonkWeapon) {
                const monkLevel = pcData.items.find(i => i.type === 'class' && i.name.toLowerCase() === 'monk')?.system.levels || 1;
                const martialArtsDie = (monkLevel >= 17) ? '1d10' : (monkLevel >= 11) ? '1d8' : (monkLevel >= 5) ? '1d6' : '1d4';
                if(this.getAverageDamage(martialArtsDie) > this.getAverageDamage(damageDie)) {
                    damageDie = martialArtsDie;
                }
            }
             baseDamageDice.push(damageDie);

        } else if (attackItem.type === 'spell' && attackItem.system?.activities) {
            // Spell logic remains complex, simplified for now
            return { name: attackName, dpr: 'Spell (TBD)', dprAdv: 'Spell (TBD)' };
        } else {
             return { name: attackName, dpr: 'N/A', dprAdv: 'N/A' };
        }
        
        const isRogue = this.getCharacterClassNames(pcData).includes('rogue');
        if (isRogue && (attackItem.system?.properties?.includes('fin') || attackItem.system?.properties?.includes('rge'))) {
            const rogueLevel = pcData.items.find(i => i.type === 'class' && i.name.toLowerCase() === 'rogue')?.system.levels || 1;
            const sneakAttackDice = Math.ceil(rogueLevel / 2);
            baseDamageDice.push(`${sneakAttackDice}d6`);
        }

        const M = targetAC;
        const A = attackBonus;
        const C = 0.05;
        const D = baseDamageDice.reduce((total, dice) => total + this.getAverageDamage(dice), 0);
        const B = bonusDamage;

        if (D === 0 && B === 0) return { name: attackName, dpr: 'N/A', dprAdv: 'N/A' };

        const baseHitChance = (21 - (M - A)) / 20;
        const H = Math.max(0.05, Math.min(0.95, baseHitChance));
        
        const missChance = 1 - H;
        const HA = 1 - (missChance * missChance);
        const CA = 1 - Math.pow(1 - C, 2);

        const dprNormal = (C * D) + (H * (D + B));
        const dprAdvantage = (CA * D) + (HA * (D + B));

        return {
            name: attackName,
            dpr: dprNormal.toFixed(2),
            dprAdv: dprAdvantage.toFixed(2)
        };
    }
};

console.log("dndCalculations.js: All D&D calculation functions loaded into DNDCalculations namespace.");
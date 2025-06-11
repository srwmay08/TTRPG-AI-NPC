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
        if (pcData && pcData.items) {
            pcData.items.forEach(item => {
                if (item.type === 'class' && item.name) {
                    classNames.add(item.name.toLowerCase());
                }
            });
        }
        if (classNames.size === 0 && pcData && pcData.vtt_data && pcData.vtt_data.details && pcData.vtt_data.details.originalClass) {
            classNames.add(pcData.vtt_data.details.originalClass.toLowerCase());
        }
         if (classNames.size === 0 && pcData && pcData.system && pcData.system.details && pcData.system.details.class) {
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
        return null;
    },

    spellSaveDC: function(pcData) {
        if (!pcData || !pcData.vtt_data || !pcData.vtt_data.abilities) return 'N/A';
        const spellcastingAbilityKey = this.getSpellcastingAbilityKeyForPC(pcData);
        if (!spellcastingAbilityKey) return 'N/A (No Casting Ability)';

        const abilityScore = pcData.vtt_data.abilities[spellcastingAbilityKey]?.value || 10;
        const proficiencyBonus = pcData.calculatedProfBonus != null ? pcData.calculatedProfBonus :
            this.getProficiencyBonus(pcData.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pcData.system?.details?.level || pcData.vtt_data?.details?.level || 1);

        if (typeof proficiencyBonus !== 'number') return 'N/A (Proficiency Error)';
        return 8 + this.getAbilityModifier(abilityScore) + proficiencyBonus;
    },

    spellAttackBonus: function(pcData) {
        if (!pcData || !pcData.vtt_data || !pcData.vtt_data.abilities) return 'N/A';
        const spellcastingAbilityKey = this.getSpellcastingAbilityKeyForPC(pcData);
        if (!spellcastingAbilityKey) return 'N/A (No Casting Ability)';

        const abilityScore = pcData.vtt_data.abilities[spellcastingAbilityKey]?.value || 10;
        const proficiencyBonus = pcData.calculatedProfBonus != null ? pcData.calculatedProfBonus :
            this.getProficiencyBonus(pcData.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pcData.system?.details?.level || pcData.vtt_data?.details?.level || 1);
        
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
        if (!pcData || !pcData.vtt_data || !pcData.vtt_data.abilities) return 'N/A';
        const abilities = pcData.vtt_data.abilities;
        const dexMod = this.getAbilityModifier(abilities.dex?.value);
        const conMod = this.getAbilityModifier(abilities.con?.value);
        const wisMod = this.getAbilityModifier(abilities.wis?.value);
        const classNames = this.getCharacterClassNames(pcData);
        const isMonk = classNames.some(name => name.includes('monk'));
        const isBarbarian = classNames.some(name => name.includes('barbarian'));

        let equippedArmorItem = null;
        if (pcData.items) {
            equippedArmorItem = pcData.items.find(item =>
                item.type === 'equipment' &&
                item.system?.equipped &&
                item.system?.armor &&
                item.system.armor.type !== 'shield'
            );
        }
        const shieldBonus = this.getShieldBonus(pcData);
        let acFromAttributes = pcData.vtt_data.attributes.ac?.value ?? pcData.vtt_data.attributes.ac?.flat;
        let acFromFlags = pcData.vtt_flags?.ddbimporter?.overrideAC?.flat;

        if (typeof acFromFlags === 'number') return acFromFlags;
        if (typeof acFromAttributes === 'number' && acFromAttributes > 0) return acFromAttributes;

        if (!equippedArmorItem) {
            if (isMonk && abilities.wis?.value != null) return 10 + dexMod + wisMod;
            if (isBarbarian && abilities.con?.value != null) return 10 + dexMod + conMod + shieldBonus;
            return 10 + dexMod + shieldBonus;
        }

        if (equippedArmorItem && equippedArmorItem.system?.armor) {
            const armorData = equippedArmorItem.system.armor;
            let baseArmorAC = armorData.value || 0;
            if (armorData.type === 'light') return baseArmorAC + dexMod + shieldBonus;
            if (armorData.type === 'medium') {
                const maxDexBonus = (typeof armorData.dex === 'number' && armorData.dex !== null) ? armorData.dex : 2;
                return baseArmorAC + Math.min(dexMod, maxDexBonus) + shieldBonus;
            }
            if (armorData.type === 'heavy') return baseArmorAC + shieldBonus;
        }
        console.warn("DNDCalculations.calculateDisplayAC: AC calculation falling back to basic unarmored for PC:", pcData.name);
        return 10 + dexMod + shieldBonus;
    },

    getAverageDamage: function(diceString) {
        if (!diceString || typeof diceString !== 'string') return 0;
        let totalAverage = 0;
        const parts = diceString.split('+').map(part => part.trim());
        for (const part of parts) {
            const match = part.toLowerCase().match(/(\d+)d(\d+)/);
            if (match) {
                const numDice = parseInt(match[1]);
                const dieType = `d${match[2]}`;
                totalAverage += numDice * (DIE_AVERAGES[dieType] || 0);
            }
        }
        return totalAverage;
    },

    calculateDPR: function(pcData, attackItem, targetAC) {
        if (!pcData || !attackItem || !attackItem.system) return { name: attackItem.name, dpr: 'N/A', dprAdv: 'N/A' };

        const pcLevel = pcData.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pcData.system?.details?.level || 1;
        const profBonus = DNDCalculations.getProficiencyBonus(pcLevel);
        const abilities = pcData.system.abilities;

        let abilityMod = 0;
        let attackBonus = 0;
        let baseDamageDice = [];
        let bonusDamage = 0;
        let attackName = attackItem.name;

        if (attackItem.type === 'weapon' && attackItem.system?.damage?.base?.denomination) {
            const weaponData = attackItem.system;
            const abilityKey = weaponData.ability || (weaponData.properties?.includes('fin') ? 'dex' : 'str');
            abilityMod = DNDCalculations.getAbilityModifier(abilities[abilityKey]?.value || 10);
            attackBonus = abilityMod + profBonus;
            bonusDamage = abilityMod;
            baseDamageDice.push(`${weaponData.damage.base.number || 1}d${weaponData.damage.base.denomination}`);
        
        } else if (attackItem.type === 'spell' && attackItem.system?.activities) {
            const spellData = attackItem.system;
            let foundActivity = false;
            
            for (const key in spellData.activities) {
                const activity = spellData.activities[key];
                if (activity?.damage?.parts?.length > 0) {
                    const damagePart = activity.damage.parts[0];
                    const damageFormula = damagePart.formula || (damagePart.number && damagePart.denomination ? `${damagePart.number}d${damagePart.denomination}` : damagePart.number);

                    if (damageFormula && typeof damageFormula === 'string' && damageFormula.includes('d')) {
                        const abilityKey = spellData.ability || pcData.system.attributes.spellcasting || 'int';
                        abilityMod = DNDCalculations.getAbilityModifier(abilities[abilityKey]?.value || 10);
                        
                        if (activity.type === 'attack' || (activity.attack && (activity.attack.type === 'ranged' || activity.attack.type === 'melee'))) {
                             attackBonus = abilityMod + profBonus;
                        } else {
                            attackBonus = -99; 
                        }
                       
                        bonusDamage = 0;
                        baseDamageDice.push(damageFormula);
                        
                        if (activity.name) {
                            attackName = `${attackItem.name} (${activity.name})`;
                        }
                        
                        foundActivity = true;
                        break;
                    }
                }
            }
            if (!foundActivity) {
                return { name: attackItem.name, dpr: 'N/A', dprAdv: 'N/A' };
            }
        } else {
             return { name: attackItem.name, dpr: 'N/A', dprAdv: 'N/A' };
        }
        
        const rogueClass = pcData.items.find(i => i.type === 'class' && i.name.toLowerCase() === 'rogue');
        if (rogueClass && (attackItem.system.properties?.includes('fin') || attackItem.system.properties?.includes('rge'))) {
            const sneakAttackDice = Math.ceil(rogueClass.system.levels / 2);
            baseDamageDice.push(`${sneakAttackDice}d6`);
        }

        const M = targetAC;
        const A = attackBonus;
        const C = 0.05;
        const D = baseDamageDice.reduce((total, dice) => total + this.getAverageDamage(dice), 0);
        const B = bonusDamage;

        if (D === 0 && B === 0) return { name: attackItem.name, dpr: 'N/A', dprAdv: 'N/A' };

        const baseHitChance = (A === -99) ? 1.0 : (21 - (M - A)) / 20;
        const H = (A === -99) ? 1.0 : Math.max(0.05, Math.min(0.95, baseHitChance));
        
        const missChance = 1 - H;
        const HA = 1 - (missChance * missChance);
        
        const CA = 1 - Math.pow(1 - C, 2);

        const dprNormal = (A === -99) ? (D + B) : (C * D) + (H * (D + B));
        const dprAdvantage = (A === -99) ? (D + B) : (CA * D) + (HA * (D + B));

        return {
            name: attackName,
            dpr: dprNormal.toFixed(2),
            dprAdv: dprAdvantage.toFixed(2)
        };
    }
};

console.log("dndCalculations.js: All D&D calculation functions loaded into DNDCalculations namespace.");
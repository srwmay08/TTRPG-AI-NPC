// static/dndCalculations.js
// Responsibility: All D&D 5e specific calculation logic.

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

    CLASS_SPELLCASTING_ABILITIES: { // Kept as a property
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

    spellSaveDC: function(pcData) { // Accepts pcData object
        if (!pcData || !pcData.vtt_data || !pcData.vtt_data.abilities) return 'N/A';
        const spellcastingAbilityKey = this.getSpellcastingAbilityKeyForPC(pcData);
        if (!spellcastingAbilityKey) return 'N/A (No Casting Ability)';

        const abilityScore = pcData.vtt_data.abilities[spellcastingAbilityKey]?.value || 10;
        // Ensure calculatedProfBonus is available or calculate it
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
    }
};

console.log("dndCalculations.js: All D&D calculation functions loaded into DNDCalculations namespace.");

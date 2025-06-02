// static/dndCalculations.js
// Responsibility: All D&D 5e specific calculation logic.

/**
 * Calculates the ability modifier for a given score.
 * @param {number} score - The ability score.
 * @returns {number} The ability modifier.
 */
window.getAbilityModifier = function(score) {
    return Math.floor(((score || 10) - 10) / 2);
};

/**
 * Calculates carrying capacity based on Strength score.
 * @param {number} score - The Strength score.
 * @returns {number} Carrying capacity in pounds.
 */
window.carryingCapacity = function(score) {
    return (score || 10) * 15;
};

/**
 * Calculates push, drag, or lift capacity based on Strength score.
 * @param {number} score - The Strength score.
 * @returns {number} Push, drag, or lift capacity in pounds.
 */
window.pushDragLift = function(score) {
    return (score || 10) * 30;
};

/**
 * Calculates long jump distance.
 * @param {number} score - The Strength score.
 * @param {boolean} running - Whether the character has a running start.
 * @returns {number} Long jump distance in feet.
 */
window.longJump = function(score, running = true) {
    score = score || 10;
    return running ? score : Math.floor(score / 2);
};

/**
 * Calculates high jump distance.
 * @param {number} score - The Strength score.
 * @param {boolean} running - Whether the character has a running start.
 * @returns {number} High jump distance in feet.
 */
window.highJump = function(score, running = true) {
    score = score || 10;
    const mod = window.getAbilityModifier(score);
    return running ? (3 + mod) : Math.floor((3 + mod) / 2);
};

/**
 * Calculates the initiative bonus.
 * @param {number} dexModifier - The Dexterity modifier.
 * @param {number} [otherBonuses=0] - Any other miscellaneous bonuses to initiative.
 * @returns {number} The total initiative bonus.
 */
window.getInitiativeBonus = function(dexModifier, otherBonuses = 0) {
    return dexModifier + (otherBonuses || 0);
};

/**
 * Calculates how long a character can hold their breath.
 * @param {number} conScore - The Constitution score.
 * @returns {string} A string describing breath-holding duration.
 */
window.holdBreath = function(conScore) {
    conScore = conScore || 10;
    return Math.max(1 + window.getAbilityModifier(conScore), 0.5) + " minutes";
};

/**
 * Calculates the saving throw bonus for an ability.
 * @param {number} abilityScore - The score of the ability.
 * @param {boolean} [proficientInSave=false] - Whether the character is proficient in this saving throw.
 * @param {number} [proficiencyBonus=0] - The character's proficiency bonus.
 * @returns {number} The saving throw bonus.
 */
window.savingThrowBonus = function(abilityScore, proficientInSave = false, proficiencyBonus = 0) {
    const mod = window.getAbilityModifier(abilityScore || 10);
    return mod + (proficientInSave ? proficiencyBonus : 0);
};

/**
 * Calculates the bonus for a skill check.
 * @param {number} baseStatScore - The score of the ability governing the skill.
 * @param {number} skillProficiencyValue - Proficiency level (0=none, 0.5=half, 1=proficient, 2=expert).
 * @param {number} proficiencyBonus - The character's proficiency bonus.
 * @returns {number} The skill bonus.
 */
window.calculateSkillBonus = function(baseStatScore, skillProficiencyValue, proficiencyBonus) {
    const modifier = window.getAbilityModifier(baseStatScore || 10);
    let skillBonus = modifier;
    if (skillProficiencyValue === 1) { // Proficient
        skillBonus += proficiencyBonus;
    } else if (skillProficiencyValue === 2) { // Expertise
        skillBonus += (proficiencyBonus * 2);
    } else if (skillProficiencyValue === 0.5) { // Half-Proficiency (e.g., Jack of All Trades)
        skillBonus += Math.floor(proficiencyBonus / 2);
    }
    return skillBonus;
};

/**
 * Calculates a passive skill score (e.g., Passive Perception).
 * @param {number} baseStatScore - The score of the ability governing the skill.
 * @param {number} skillProficiencyValue - Proficiency level for the skill.
 * @param {number} proficiencyBonus - The character's proficiency bonus.
 * @returns {number} The passive skill score.
 */
window.calculatePassiveSkill = function(baseStatScore, skillProficiencyValue, proficiencyBonus) {
    const skillBonus = window.calculateSkillBonus(baseStatScore || 10, skillProficiencyValue, proficiencyBonus);
    return 10 + skillBonus;
};

/**
 * Determines the proficiency bonus based on character level.
 * @param {number} level - The character's total level.
 * @returns {number} The proficiency bonus.
 */
window.getProficiencyBonus = function(level) {
    level = level || 1;
    if (level < 1) return 2; // Should not happen, but default
    if (level <= 4) return 2;
    if (level <= 8) return 3;
    if (level <= 12) return 4;
    if (level <= 16) return 5;
    return 6; // Level 17+
};

/**
 * Calculates Unarmored AC (10 + Dex mod).
 * @param {number} dexModifier - The Dexterity modifier.
 * @returns {number} The unarmored Armor Class.
 */
window.getUnarmoredAC = function(dexModifier) {
    return 10 + dexModifier;
};

/**
 * Calculates Barbarian Unarmored AC (10 + Dex mod + Con mod).
 * @param {number} dexModifier - The Dexterity modifier.
 * @param {number} conModifier - The Constitution modifier.
 * @returns {number} The Barbarian's unarmored Armor Class.
 */
window.getBarbarianUnarmoredAC = function(dexModifier, conModifier) {
    return 10 + dexModifier + conModifier;
};

/**
 * Calculates Monk Unarmored AC (10 + Dex mod + Wis mod).
 * @param {number} dexModifier - The Dexterity modifier.
 * @param {number} wisModifier - The Wisdom modifier.
 * @returns {number} The Monk's unarmored Armor Class.
 */
window.getMonkUnarmoredAC = function(dexModifier, wisModifier) {
    return 10 + dexModifier + wisModifier;
};

/**
 * Calculates melee attack bonus (Ability Mod + Proficiency).
 * @param {number} abilityModifier - The relevant ability modifier (Str or Dex for Finesse).
 * @param {number} proficiencyBonus - The character's proficiency bonus.
 * @returns {number} The melee attack bonus.
 */
window.getMeleeAttackBonus = function(abilityModifier, proficiencyBonus) {
    return abilityModifier + proficiencyBonus;
};

/**
 * Calculates ranged attack bonus (Dex Mod + Proficiency).
 * @param {number} dexModifier - The Dexterity modifier.
 * @param {number} proficiencyBonus - The character's proficiency bonus.
 * @returns {number} The ranged attack bonus.
 */
window.getRangedAttackBonus = function(dexModifier, proficiencyBonus) {
    return dexModifier + proficiencyBonus;
};

/**
 * Gets the melee damage bonus (usually Strength modifier, or Dexterity for Finesse).
 * @param {number} abilityModifier - The relevant ability modifier.
 * @returns {number} The melee damage bonus.
 */
window.getMeleeDamageBonus = function(abilityModifier) {
    return abilityModifier;
};

/**
 * Gets the ranged damage bonus (usually Dexterity modifier).
 * @param {number} dexModifier - The Dexterity modifier.
 * @returns {number} The ranged damage bonus.
 */
window.getRangedDamageBonus = function(dexModifier) {
    return dexModifier;
};

// Spellcasting Constants & Helpers
const CLASS_SPELLCASTING_ABILITIES = {
    'bard': 'cha', 'paladin': 'cha', 'sorcerer': 'cha', 'warlock': 'cha',
    'cleric': 'wis', 'druid': 'wis', 'ranger': 'wis', 'monk': 'wis', // Monk's Ki save DC uses Wis
    'wizard': 'int', 'artificer': 'int'
};

/**
 * Extracts character class names from PC data.
 * @param {object} pcData - The player character data object.
 * @returns {string[]} An array of lowercase class names.
 */
window.getCharacterClassNames = function(pcData) {
    const classNames = new Set();
    if (pcData && pcData.items) {
        pcData.items.forEach(item => {
            if (item.type === 'class' && item.name) {
                classNames.add(item.name.toLowerCase());
            }
        });
    }
    // Fallback if items don't list class directly
    if (classNames.size === 0 && pcData && pcData.vtt_data && pcData.vtt_data.details && pcData.vtt_data.details.originalClass) {
        classNames.add(pcData.vtt_data.details.originalClass.toLowerCase());
    }
     if (classNames.size === 0 && pcData && pcData.system && pcData.system.details && pcData.system.details.class) { // Check FVTT system object
        classNames.add(pcData.system.details.class.toLowerCase());
    }
    return Array.from(classNames);
};

/**
 * Determines the primary spellcasting ability key for a PC.
 * @param {object} pcData - The player character data object.
 * @returns {string|null} The spellcasting ability key ('cha', 'wis', 'int') or null.
 */
window.getSpellcastingAbilityKeyForPC = function(pcData) {
    if (!pcData) return null;

    // Prefer explicitly defined spellcasting attribute from VTT data
    let mainSpellcastingAttr = pcData.system?.attributes?.spellcasting || pcData.vtt_data?.attributes?.spellcasting;
    if (mainSpellcastingAttr && typeof mainSpellcastingAttr === 'string' && mainSpellcastingAttr.length === 3) {
        return mainSpellcastingAttr.toLowerCase();
    }

    // Infer from class if not explicitly defined
    const classNames = window.getCharacterClassNames(pcData);
    if (classNames.length > 0) {
        for (const className of classNames) {
            // Iterate through known classes to find a match (e.g., "paladin" in "oath of devotion paladin")
            for (const knownClass in CLASS_SPELLCASTING_ABILITIES) {
                if (className.includes(knownClass)) {
                    return CLASS_SPELLCASTING_ABILITIES[knownClass];
                }
            }
        }
    }
    return null;
};



/**
 * Calculates the spell save DC for a character based on their class.
 * @param {object} pcData - The player character data object.
 * @returns {number|string} The spell save DC or 'N/A'.
 */
window.spellSaveDC = function(pcData) {
    if (!pcData || !pcData.vtt_data || !pcData.vtt_data.abilities) return 'N/A';

    const spellcastingAbilityKey = window.getSpellcastingAbilityKeyForPC(pcData);
    if (!spellcastingAbilityKey) return 'N/A (No Casting Ability)';

    const abilityScore = pcData.vtt_data.abilities[spellcastingAbilityKey]?.value || 10;
    const proficiencyBonus = pcData.calculatedProfBonus != null ? pcData.calculatedProfBonus :
        window.getProficiencyBonus(pcData.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pcData.system?.details?.level || pcData.vtt_data?.details?.level || 1);

    if (typeof proficiencyBonus !== 'number') return 'N/A (Proficiency Error)';

    return 8 + window.getAbilityModifier(abilityScore) + proficiencyBonus;
};

/**
 * Calculates the spell attack bonus for a character based on their class.
 * @param {object} pcData - The player character data object.
 * @returns {number|string} The spell attack bonus or 'N/A'.
 */
window.spellAttackBonus = function(pcData) {
    if (!pcData || !pcData.vtt_data || !pcData.vtt_data.abilities) return 'N/A';

    const spellcastingAbilityKey = window.getSpellcastingAbilityKeyForPC(pcData);
    if (!spellcastingAbilityKey) return 'N/A (No Casting Ability)';

    const abilityScore = pcData.vtt_data.abilities[spellcastingAbilityKey]?.value || 10;
    const proficiencyBonus = pcData.calculatedProfBonus != null ? pcData.calculatedProfBonus :
        window.getProficiencyBonus(pcData.vtt_flags?.ddbimporter?.dndbeyond?.totalLevels || pcData.system?.details?.level || pcData.vtt_data?.details?.level || 1);
    
    if (typeof proficiencyBonus !== 'number') return 'N/A (Proficiency Error)';

    return window.getAbilityModifier(abilityScore) + proficiencyBonus;
};

/**
 * Gets the AC bonus from an equipped shield.
 * @param {object} pcData - The player character data object.
 * @returns {number} The AC bonus from a shield, or 0 if none.
 */
window.getShieldBonus = function(pcData) {
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
};

/**
 * Calculates the display Armor Class for a PC, considering armor, shields, and class features.
 * @param {object} pcData - The player character data object.
 * @returns {number|string} The calculated Armor Class or 'N/A'.
 */
window.calculateDisplayAC = function(pcData) {
    if (!pcData || !pcData.vtt_data || !pcData.vtt_data.abilities) return 'N/A';

    const abilities = pcData.vtt_data.abilities;
    const dexMod = window.getAbilityModifier(abilities.dex?.value);
    const conMod = window.getAbilityModifier(abilities.con?.value);
    const wisMod = window.getAbilityModifier(abilities.wis?.value);

    const classNames = window.getCharacterClassNames(pcData);
    const isMonk = classNames.some(name => name.includes('monk'));
    const isBarbarian = classNames.some(name => name.includes('barbarian'));

    let equippedArmorItem = null;
    if (pcData.items) {
        equippedArmorItem = pcData.items.find(item =>
            item.type === 'equipment' &&
            item.system?.equipped &&
            item.system?.armor &&
            item.system.armor.type !== 'shield' // Ensure it's armor, not a shield
        );
    }
    const shieldBonus = window.getShieldBonus(pcData);

    // 1. Check for explicit AC overrides (like from D&D Beyond importer or manual entry)
    // These often come from `pcData.vtt_flags.ddbimporter.overrideAC.flat` or `pcData.vtt_data.attributes.ac.value`
    // The quick view card already uses a complex logic for this, let's try to be consistent.
    let acFromAttributes = pcData.vtt_data.attributes.ac?.value ?? pcData.vtt_data.attributes.ac?.flat;
    let acFromFlags = pcData.vtt_flags?.ddbimporter?.overrideAC?.flat;

    if (typeof acFromFlags === 'number') {
        return acFromFlags; // Highest priority if explicitly set by importer
    }
    if (typeof acFromAttributes === 'number' && acFromAttributes > 0) {
        // This value might already include shield or other bonuses.
        // If it's a calculated value from FVTT, it's often the most accurate.
        return acFromAttributes;
    }

    // 2. Unarmored AC for Monk or Barbarian (if no armor worn)
    if (!equippedArmorItem) {
        if (isMonk && abilities.wis?.value != null) { // Monk Unarmored Defense
            // Monk's Unarmored Defense doesn't stack with a shield.
            return 10 + dexMod + wisMod;
        }
        if (isBarbarian && abilities.con?.value != null) { // Barbarian Unarmored Defense
             // Barbarian's Unarmored Defense can be used with a shield.
            return 10 + dexMod + conMod + shieldBonus;
        }
        // Standard Unarmored
        return 10 + dexMod + shieldBonus;
    }

    // 3. AC from Equipped Armor
    if (equippedArmorItem && equippedArmorItem.system?.armor) {
        const armorData = equippedArmorItem.system.armor;
        let baseArmorAC = armorData.value || 0; // This is the armor's direct AC value (e.g., 11 for leather, 14 for chain shirt, 18 for plate)

        if (armorData.type === 'light') {
            return baseArmorAC + dexMod + shieldBonus;
        } else if (armorData.type === 'medium') {
            // Medium armor has a dex cap, usually 2, unless specified otherwise by `armorData.dex`
            const maxDexBonus = (typeof armorData.dex === 'number' && armorData.dex !== null) ? armorData.dex : 2;
            return baseArmorAC + Math.min(dexMod, maxDexBonus) + shieldBonus;
        } else if (armorData.type === 'heavy') {
            return baseArmorAC + shieldBonus; // Dex mod doesn't apply (unless specific feats, which this doesn't handle yet)
        }
    }

    // Fallback to basic unarmored if no other calculation applies (should be rare if data is good)
    console.warn("AC calculation falling back to basic unarmored for PC:", pcData.name);
    return 10 + dexMod + shieldBonus;
};

console.log("dndCalculations.js: All D&D calculation functions loaded.");

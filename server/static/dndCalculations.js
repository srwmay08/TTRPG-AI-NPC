// dndCalculations.js
// Responsibility: All D&D 5e specific calculation logic.

window.getAbilityModifier = function(score) { return Math.floor(((score || 10) - 10) / 2); }
window.carryingCapacity = function(score) { return (score || 10) * 15; }
window.pushDragLift = function(score) { return (score || 10) * 30; }
window.longJump = function(score, running = true) { score = score || 10; return running ? score : Math.floor(score / 2); }
window.highJump = function(score, running = true) { score = score || 10; const mod = getAbilityModifier(score); return running ? (3 + mod) : Math.floor((3 + mod) / 2); } // Note: uses getAbilityModifier
window.initiative = function(dexScore) { return getAbilityModifier(dexScore || 10); } // Note: uses getAbilityModifier
window.holdBreath = function(conScore) { conScore = conScore || 10; return Math.max(1 + getAbilityModifier(conScore), 0.5) + " minutes"; } // Note: uses getAbilityModifier
window.spellSaveDC = function(castingStatScore, proficiencyBonus) { return 8 + getAbilityModifier(castingStatScore || 10) + proficiencyBonus; } // Note: uses getAbilityModifier
window.spellAttackBonus = function(castingStatScore, proficiencyBonus) { return getAbilityModifier(castingStatScore || 10) + proficiencyBonus; } // Note: uses getAbilityModifier
window.savingThrowBonus = function(abilityScore, proficientInSave = false, proficiencyBonus = 0) { const mod = getAbilityModifier(abilityScore || 10); return mod + (proficientInSave ? proficiencyBonus : 0); } // Note: uses getAbilityModifier
window.calculateSkillBonus = function(baseStatScore, skillProficiencyValue, proficiencyBonus) { const modifier = getAbilityModifier(baseStatScore || 10); let skillBonus = modifier; if (skillProficiencyValue === 1) { skillBonus += proficiencyBonus; } else if (skillProficiencyValue === 2) { skillBonus += (proficiencyBonus * 2); } else if (skillProficiencyValue === 0.5) { skillBonus += Math.floor(proficiencyBonus / 2); } return skillBonus; } // Note: uses getAbilityModifier
window.calculatePassiveSkill = function(baseStatScore, skillProficiencyValue, proficiencyBonus) { const skillBonus = calculateSkillBonus(baseStatScore || 10, skillProficiencyValue, proficiencyBonus); return 10 + skillBonus; } // Note: uses calculateSkillBonus
window.getProficiencyBonus = function(level) { level = level || 1; if (level < 1) return 2; if (level <= 4) return 2; if (level <= 8) return 3; if (level <= 12) return 4; if (level <= 16) return 5; return 6; }

// Important: Functions like getAbilityModifier are used by other functions in this file.
// If window.getAbilityModifier is not yet defined when another function here tries to call it
// (due to script parsing order within this file itself), it could cause issues.
// A safer way for internal calls within this "module" is to call them directly if they are defined above,
// or ensure all functions are defined before being assigned to window if there are interdependencies.
// For now, simple top-level assignment and calls to window.functionName should work if functions are simple or defined in order.

// A slightly safer pattern for inter-dependent functions in the same file without ES6 modules:
/*
(function(global) {
    function getAbilityModifier(score) { ... }
    function highJump(score, running = true) {
        const mod = getAbilityModifier(score); // Calls local getAbilityModifier
        return ...;
    }
    // ... other functions ...

    global.getAbilityModifier = getAbilityModifier;
    global.highJump = highJump;
    // ... export other functions to global ...
    global.getProficiencyBonus = function(level) { ... };

})(window);
*/
// For now, the direct `window.fnName = function...` should resolve the immediate ReferenceError
// as long as `dndCalculations.js` is loaded before `appState.js`.
// static/dndCalculations.js
// Responsibility: All D&D 5e specific calculation logic.

window.getAbilityModifier = function(score) { return Math.floor(((score || 10) - 10) / 2); };
window.carryingCapacity = function(score) { return (score || 10) * 15; };
window.pushDragLift = function(score) { return (score || 10) * 30; };
window.longJump = function(score, running = true) { score = score || 10; return running ? score : Math.floor(score / 2); };
window.highJump = function(score, running = true) { score = score || 10; const mod = window.getAbilityModifier(score); return running ? (3 + mod) : Math.floor((3 + mod) / 2); };
window.initiative = function(dexScore) { return window.getAbilityModifier(dexScore || 10); };
window.holdBreath = function(conScore) { conScore = conScore || 10; return Math.max(1 + window.getAbilityModifier(conScore), 0.5) + " minutes"; };
window.spellSaveDC = function(castingStatScore, proficiencyBonus) { return 8 + window.getAbilityModifier(castingStatScore || 10) + proficiencyBonus; };
window.spellAttackBonus = function(castingStatScore, proficiencyBonus) { return window.getAbilityModifier(castingStatScore || 10) + proficiencyBonus; };
window.savingThrowBonus = function(abilityScore, proficientInSave = false, proficiencyBonus = 0) { const mod = window.getAbilityModifier(abilityScore || 10); return mod + (proficientInSave ? proficiencyBonus : 0); };
window.calculateSkillBonus = function(baseStatScore, skillProficiencyValue, proficiencyBonus) { const modifier = window.getAbilityModifier(baseStatScore || 10); let skillBonus = modifier; if (skillProficiencyValue === 1) { skillBonus += proficiencyBonus; } else if (skillProficiencyValue === 2) { skillBonus += (proficiencyBonus * 2); } else if (skillProficiencyValue === 0.5) { skillBonus += Math.floor(proficiencyBonus / 2); } return skillBonus; };
window.calculatePassiveSkill = function(baseStatScore, skillProficiencyValue, proficiencyBonus) { const skillBonus = window.calculateSkillBonus(baseStatScore || 10, skillProficiencyValue, proficiencyBonus); return 10 + skillBonus; };
window.getProficiencyBonus = function(level) { level = level || 1; if (level < 1) return 2; if (level <= 4) return 2; if (level <= 8) return 3; if (level <= 12) return 4; if (level <= 16) return 5; return 6; };
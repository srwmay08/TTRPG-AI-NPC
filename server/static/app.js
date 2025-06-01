// static/app.js

document.addEventListener('DOMContentLoaded', async () => {
    console.log("app.js: DOMContentLoaded event fired.");
    try {
        await window.initializeAppCharacters(); // This itself calls updateMainView
        await window.fetchAndRenderHistoryFiles();
        window.setupResizer();
        window.setupCollapsibleSections();
        window.assignButtonEventHandlers();
        // Initial call after everything else in DOMContentLoaded
        setTimeout(window.updateMainView, 0); // <-- DEFER THIS CALL
    } catch (e) {
        console.error("Error during initial app setup:", e);
        const body = document.querySelector('body');
        if (body) body.innerHTML = `<h1>Critical Error Initializing Application: ${e.message}. Please check console.</h1><pre>${e.stack}</pre>`;
    }
    console.log("app.js: DOMContentLoaded finished.");
});

window.updateMainView = function() {
    console.log("updateMainView called"); // Add a log to see when it's called
    const dialogueInterfaceElem = window.getElem('dialogue-interface');
    const pcDashboardViewElem = window.getElem('pc-dashboard-view');
    const pcQuickViewInSceneElem = window.getElem('pc-quick-view-section-in-scene');

    if (!dialogueInterfaceElem || !pcDashboardViewElem || !pcQuickViewInSceneElem) {
        console.error("updateMainView: Critical UI element(s) missing. dialogueInterface:", dialogueInterfaceElem, "pcDashboardView:", pcDashboardViewElem, "pcQuickViewInScene:", pcQuickViewInSceneElem);
        return; // Exit if main containers aren't found
    }

    // ... (rest of the function as provided before)
    const activeNpcCount = appState.getActiveNpcCount();
    const showPcDashboard = appState.getActivePcCount() > 0;

    window.updateMainViewUI(dialogueInterfaceElem, pcDashboardViewElem, pcQuickViewInSceneElem, activeNpcCount, showPcDashboard);

    if (activeNpcCount > 0 && appState.getActivePcCount() > 0) {
        const activePcsData = appState.getAllCharacters().filter(char => appState.hasActivePc(String(char._id)));
        window.renderPcQuickViewInSceneUI(pcQuickViewInSceneElem, activePcsData);
    } else {
        if (pcQuickViewInSceneElem) {
            pcQuickViewInSceneElem.style.display = 'none';
            pcQuickViewInSceneElem.innerHTML = '';
        }
    }
    
    // Conditional disableBtn
    const generateBtn = window.getElem('generate-dialogue-btn');
    if (generateBtn) {
        window.disableBtn('generate-dialogue-btn', appState.getActiveNpcCount() === 0);
    } else {
        // This warning might still appear on the very first load if dialogue-interface is hidden
        // console.warn("generate-dialogue-btn not found during updateMainView, this might be okay if dialogue interface is hidden.");
    }
};

window.handleToggleNpcInScene = async function(npcIdStr, npcName) {
    const multiNpcContainer = window.getElem('multi-npc-dialogue-container');
    if (!multiNpcContainer) {
        console.error("Multi-NPC dialogue container not found.");
        return;
    }

    const isAdding = !appState.hasActiveNpc(npcIdStr);
    const speakingPcSelect = window.getElem('speaking-pc-select');
    const currentSpeakingPcId = speakingPcSelect ? speakingPcSelect.value : null;

    if (isAdding) {
        appState.addActiveNpc(npcIdStr);
        window.createNpcDialogueAreaUI(npcIdStr, npcName, multiNpcContainer);
        appState.initDialogueHistory(npcIdStr);
        const toggledNpc = appState.getCharacterById(npcIdStr);

        if (toggledNpc && (appState.getActivePcCount() > 0 || currentSpeakingPcId === "")) {
            const sceneContext = window.getElem('scene-context').value.trim();
            const activePcNames = appState.getActivePcIds().map(pcId => appState.getCharacterById(pcId)?.name || "a PC");
            const greetingPayload = {
                scene_context: sceneContext || `${activePcNames.join(', ')} ${activePcNames.length > 1 ? 'are' : 'is'} present.`,
                player_utterance: `(System: You, ${toggledNpc.name}, have just become aware of ${activePcNames.join(', ')} in the scene. Offer a greeting or initial reaction.)`,
                active_pcs: activePcNames,
                speaking_pc_id: currentSpeakingPcId,
                recent_dialogue_history: []
            };
            setTimeout(() => window.triggerNpcInteraction(npcIdStr, toggledNpc.name, greetingPayload, true), 100);
        }

        const otherNpcIdsInScene = appState.getActiveNpcIds().filter(id => id !== npcIdStr);
        if (otherNpcIdsInScene.length > 0 && toggledNpc) {
            const arrivalMessageForOthers = `(System Observation: ${toggledNpc.name} has just arrived or become prominent in the scene.)`;
            otherNpcIdsInScene.forEach(async (existingNpcId) => {
                const existingNpc = appState.getCharacterById(existingNpcId);
                if (!existingNpc) return;

                const transcriptArea = window.getElem(`transcript-${existingNpcId}`);
                if (transcriptArea) {
                     window.appendMessageToTranscriptUI(transcriptArea, arrivalMessageForOthers, 'scene-event');
                     appState.addDialogueToHistory(existingNpcId, arrivalMessageForOthers);
                }
                const sceneContext = window.getElem('scene-context').value.trim();
                const activePcNames = appState.getActivePcIds().map(pcId => appState.getCharacterById(pcId)?.name || "a PC");
                const reactionPayload = {
                    scene_context: sceneContext,
                    player_utterance: arrivalMessageForOthers,
                    active_pcs: activePcNames,
                    speaking_pc_id: currentSpeakingPcId,
                    recent_dialogue_history: appState.getRecentDialogueHistory(existingNpcId)
                };
                if (transcriptArea) {
                    const thinkingEntry = document.createElement('p');
                    thinkingEntry.className = 'scene-event';
                    thinkingEntry.id = `thinking-${existingNpcId}-arrival-${window.slugify(toggledNpc.name)}`;
                    thinkingEntry.textContent = `${existingNpc.name} notices ${toggledNpc.name}...`;
                    transcriptArea.appendChild(thinkingEntry);
                    transcriptArea.scrollTop = transcriptArea.scrollHeight;
                }
                await window.triggerNpcInteraction(existingNpcId, existingNpc.name, reactionPayload, false, `thinking-${existingNpcId}-arrival-${window.slugify(toggledNpc.name)}`);
            });
        }
    } else {
        appState.removeActiveNpc(npcIdStr);
        window.removeNpcDialogueAreaUI(npcIdStr, multiNpcContainer);
        appState.deleteDialogueHistory(npcIdStr);
    }

    const placeholderEvent = multiNpcContainer.querySelector('p.scene-event');
    if (appState.getActiveNpcCount() > 0 && placeholderEvent) {
        placeholderEvent.remove();
    } else if (appState.getActiveNpcCount() === 0 && !placeholderEvent) {
        multiNpcContainer.innerHTML = '<p class="scene-event">Select NPCs to add them to the scene.</p>';
    }

    window.adjustNpcDialogueAreaWidthsUI(multiNpcContainer);
    window.renderNpcListForSceneUI(window.getElem('character-list'), appState.getAllCharacters(), appState.activeSceneNpcIds, window.handleToggleNpcInScene, window.handleSelectCharacterForDetails);
    window.updateMainView();
};

window.triggerNpcInteraction = async function(npcIdStr, npcName, payload, isGreeting = false, thinkingMessageId = null) {
    const transcriptArea = window.getElem(`transcript-${npcIdStr}`);
    if (!transcriptArea) {
        console.error(`Transcript area for NPC ID ${npcIdStr} not found.`);
        return;
    }
    let thinkingMessageElement = thinkingMessageId ? window.getElem(thinkingMessageId) : null;

    if (!thinkingMessageElement && isGreeting) {
        const sceneEventP = document.createElement('p');
        sceneEventP.className = 'scene-event';
        sceneEventP.textContent = `${npcName} is formulating a response...`;
        transcriptArea.appendChild(sceneEventP);
        transcriptArea.scrollTop = transcriptArea.scrollHeight;
        thinkingMessageElement = sceneEventP;
    }

    try {
        const result = await window.generateNpcDialogue(npcIdStr, payload); // from apiService
        if(thinkingMessageElement && thinkingMessageElement.parentNode) thinkingMessageElement.remove();

        window.appendMessageToTranscriptUI(transcriptArea, `${npcName}: ${result.npc_dialogue}`, 'dialogue-entry npc-response');
        appState.addDialogueToHistory(npcIdStr, `${npcName}: ${result.npc_dialogue}`);
        window.renderAiSuggestionsContent(result, npcIdStr); // from uiRenderers (ensure this is defined on window)
    } catch (error) {
        console.error(`Error generating dialogue for ${npcName}:`, error);
        if(thinkingMessageElement && thinkingMessageElement.parentNode) thinkingMessageElement.remove();
        window.appendMessageToTranscriptUI(transcriptArea, `${npcName}: (Error: ${error.message})`, 'dialogue-entry npc-response');
        appState.addDialogueToHistory(npcIdStr, `${npcName}: (Error generating dialogue)`);
    }
    transcriptArea.scrollTop = transcriptArea.scrollHeight;
};

window.handleGenerateDialogue = async function() {
    const playerUtterance = window.getElem('player-utterance').value.trim();
    const sceneContext = window.getElem('scene-context').value.trim();
    const speakingPcSelect = window.getElem('speaking-pc-select');
    const speakingPcId = speakingPcSelect ? speakingPcSelect.value : null;

    if (!playerUtterance && !sceneContext.trim() && playerUtterance !== "") {
        alert("Please enter player dialogue or ensure scene context is descriptive.");
        return;
    }
    window.disableBtn('generate-dialogue-btn', true);

    const activePcsNames = appState.getActivePcIds().map(id => appState.getCharacterById(id)?.name).filter(name => name);
    let speakerDisplayName = "Player";
    if (speakingPcId && speakingPcId !== "") {
        const pc = appState.getCharacterById(speakingPcId);
        if (pc) speakerDisplayName = pc.name;
        else speakerDisplayName = speakingPcId; // Fallback if ID not found in characters (e.g. old ID)
    } else if (speakingPcId === "") {
        speakerDisplayName = "DM/Scene Event";
    }

    appState.getActiveNpcIds().forEach(npcId => {
        const transcriptArea = window.getElem(`transcript-${npcId}`);
        if (transcriptArea && playerUtterance) {
            window.appendMessageToTranscriptUI(transcriptArea, `${speakerDisplayName}: ${playerUtterance}`, 'dialogue-entry player-utterance');
            appState.addDialogueToHistory(npcId, `${speakerDisplayName}: ${playerUtterance}`);
        }
        const npc = appState.getCharacterById(npcId);
        if (transcriptArea && npc) {
            const thinkingEntry = document.createElement('p');
            thinkingEntry.className = 'scene-event';
            thinkingEntry.id = `thinking-${npcId}-main`;
            thinkingEntry.textContent = `${npc.name} is formulating a response...`;
            transcriptArea.appendChild(thinkingEntry);
            transcriptArea.scrollTop = transcriptArea.scrollHeight;
        }
    });

    const dialoguePromises = appState.getActiveNpcIds().map(npcId => {
        const npc = appState.getCharacterById(npcId);
        if (!npc) return Promise.resolve();

        const payload = {
            scene_context: sceneContext,
            player_utterance: playerUtterance,
            active_pcs: activePcsNames,
            speaking_pc_id: speakingPcId,
            recent_dialogue_history: appState.getRecentDialogueHistory(npcId, 10)
        };
        return window.triggerNpcInteraction(npcId, npc.name, payload, false, `thinking-${npcId}-main`);
    });

    await Promise.all(dialoguePromises);

    if (playerUtterance) window.getElem('player-utterance').value = '';
    window.disableBtn('generate-dialogue-btn', false);
};

window.handleTogglePcSelection = function(pcIdStr) {
    appState.toggleActivePc(pcIdStr);
    window.renderPcListUI(window.getElem('active-pc-list'), window.getElem('speaking-pc-select'), appState.getAllCharacters(), appState.activePcIds, window.handleTogglePcSelection);
    window.updateMainView();

    const currentProfileChar = appState.getCurrentProfileChar();
    if (currentProfileChar && currentProfileChar.character_type === 'NPC') {
        window.renderNpcFactionStandingsUI(currentProfileChar, appState.activePcIds, appState.getAllCharacters(), window.getElem('npc-faction-standings-content'), window.handleSaveFactionStanding);
    }
};

window.handleBackToDashboardOverview = function() {
    const dashboardContent = window.getElem('pc-dashboard-content');
    if (dashboardContent) {
        const detailedSheet = dashboardContent.querySelector('.detailed-pc-sheet');
        if (detailedSheet) detailedSheet.remove();
    }
    appState.setExpandedAbility(null);
    appState.setExpandedSkill(null);
    appState.setSkillSortKey(null);
    window.updateMainView();
};

window.toggleAbilityExpansion = function(ablKey) {
    const currentAbility = appState.getExpandedAbility();
    if (currentAbility === ablKey) {
        appState.setExpandedAbility(null);
    } else {
        appState.setExpandedAbility(ablKey);
        appState.setExpandedSkill(null); // Collapse skills when expanding abilities
    }
    window.updateMainView();
};

window.toggleSkillExpansion = function(skillKey) {
    const currentSkill = appState.getExpandedSkill();
    if (currentSkill === skillKey) {
        appState.setExpandedSkill(null);
        appState.setSkillSortKey(null);
    } else {
        appState.setExpandedSkill(skillKey);
        appState.setSkillSortKey(skillKey);
        appState.setExpandedAbility(null); // Collapse abilities when expanding skills
    }
    window.updateMainView();
};

window.addSuggestedMemoryAsActual = async function(npcId, memoryContent) {
    if (!npcId || !memoryContent) return;
    const character = appState.getCharacterById(npcId);
    if (!character || character.character_type !== 'NPC') {
        alert("Cannot add memory: Invalid NPC ID or character is not an NPC.");
        return;
    }
    try {
        const memoryData = { content: memoryContent, type: "AI_suggestion", source: "AI suggestion" };
        const response = await window.addMemoryToNpc(npcId, memoryData);
        const charToUpdate = appState.getCharacterById(npcId);
        if (charToUpdate && response.updated_memories) {
            charToUpdate.memories = response.updated_memories;
            appState.updateCharacterInList(charToUpdate);
            if (appState.getCurrentProfileCharId() === npcId) {
                window.renderMemoriesUI(charToUpdate.memories, window.getElem('character-memories-list'), window.handleDeleteMemory);
            }
        }
        alert(`Suggested memory added to ${character.name}.`);
    } catch (error) {
        console.error("Error adding suggested memory:", error);
        alert("Error adding suggested memory: " + error.message);
    }
};

window.acceptFactionStandingChange = async function(npcIdToUpdate, pcTargetId, newStanding) {
    if (!npcIdToUpdate || !pcTargetId || !newStanding) {
        alert("Missing information to update faction standing.");
        return;
    }
    const npc = appState.getCharacterById(npcIdToUpdate);
    const pc = appState.getCharacterById(pcTargetId);
    if (!npc || !pc) {
        alert("NPC or PC not found for faction standing update.");
        return;
    }

    if (confirm(`Change ${npc.name}'s standing towards ${pc.name} to ${newStanding}?`)) {
        await window.handleSaveFactionStanding(npcIdToUpdate, pcTargetId, newStanding);
    }
};
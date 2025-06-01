// app.js
// Responsibility: Application entry point, initialization, and coordination.
// Assumes all other modules are loaded and their functions/objects are available globally or via imports.

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("app.js: DOMContentLoaded event fired.");
    try {
        await initializeAppCharacters(); // from characterService.js
        await fetchAndRenderHistoryFiles(); // from characterService.js
        setupResizer(); // from eventHandlers.js
        setupCollapsibleSections(); // from eventHandlers.js
        assignButtonEventHandlers(); // from eventHandlers.js
        updateMainView(); // Initial view setup
    } catch (e) {
        console.error("Error during initial app setup:", e);
        // Display a user-friendly error message on the page if critical parts fail
        const body = document.querySelector('body');
        if (body) body.innerHTML = "<h1>Critical Error Initializing Application. Please check console.</h1>";
    }
    console.log("app.js: DOMContentLoaded finished.");
});


// --- Core Application Logic / Event Handlers ---

function updateMainView() {
    const dialogueInterfaceElem = getElem('dialogue-interface');
    const pcDashboardViewElem = getElem('pc-dashboard-view');
    const pcQuickViewInSceneElem = getElem('pc-quick-view-section-in-scene');

    if (!dialogueInterfaceElem || !pcDashboardViewElem || !pcQuickViewInSceneElem) {
        console.error("updateMainView: Critical UI element(s) missing.");
        return;
    }

    const activeNpcCount = appState.getActiveNpcCount();
    const showPcDashboard = appState.getActivePcCount() > 0;

    updateMainViewUI(dialogueInterfaceElem, pcDashboardViewElem, pcQuickViewInSceneElem, activeNpcCount, showPcDashboard);

    if (activeNpcCount > 0 && appState.getActivePcCount() > 0) {
        const activePcsData = appState.getAllCharacters().filter(char => appState.hasActivePc(String(char._id)));
        renderPcQuickViewInSceneUI(pcQuickViewInSceneElem, activePcsData);
    } else {
        pcQuickViewInSceneElem.style.display = 'none';
        pcQuickViewInSceneElem.innerHTML = '';
    }
     disableBtn('generate-dialogue-btn', appState.getActiveNpcCount() === 0);
}


async function handleToggleNpcInScene(npcIdStr, npcName) {
    const multiNpcContainer = getElem('multi-npc-dialogue-container');
    if (!multiNpcContainer) {
        console.error("Multi-NPC dialogue container not found.");
        return;
    }

    const isAdding = !appState.hasActiveNpc(npcIdStr);
    const speakingPcSelect = getElem('speaking-pc-select');
    const currentSpeakingPcId = speakingPcSelect ? speakingPcSelect.value : null;


    if (isAdding) {
        appState.addActiveNpc(npcIdStr);
        createNpcDialogueAreaUI(npcIdStr, npcName, multiNpcContainer); // from uiRenderers.js
        appState.initDialogueHistory(npcIdStr);
        const toggledNpc = appState.getCharacterById(npcIdStr);

        // Greeting logic
        if (toggledNpc && (appState.getActivePcCount() > 0 || currentSpeakingPcId === "")) {
            const sceneContext = getElem('scene-context').value.trim();
            const activePcNames = appState.getActivePcIds().map(pcId => appState.getCharacterById(pcId)?.name || "a PC");
            const greetingPayload = {
                scene_context: sceneContext || `${activePcNames.join(', ')} ${activePcNames.length > 1 ? 'are' : 'is'} present.`,
                player_utterance: `(System: You, ${toggledNpc.name}, have just become aware of ${activePcNames.join(', ')} in the scene. Offer a greeting or initial reaction.)`,
                active_pcs: activePcNames,
                speaking_pc_id: currentSpeakingPcId,
                recent_dialogue_history: []
            };
             // Trigger greeting after a short delay to allow UI to update
            setTimeout(() => triggerNpcInteraction(npcIdStr, toggledNpc.name, greetingPayload, true), 100);
        }

        // Reaction from other NPCs
        const otherNpcIdsInScene = appState.getActiveNpcIds().filter(id => id !== npcIdStr);
        if (otherNpcIdsInScene.length > 0 && toggledNpc) {
            const arrivalMessageForOthers = `(System Observation: ${toggledNpc.name} has just arrived or become prominent in the scene.)`;
            otherNpcIdsInScene.forEach(async (existingNpcId) => {
                const existingNpc = appState.getCharacterById(existingNpcId);
                if (!existingNpc) return;

                const transcriptArea = getElem(`transcript-${existingNpcId}`);
                if (transcriptArea) {
                     appendMessageToTranscriptUI(transcriptArea, arrivalMessageForOthers, 'scene-event');
                     appState.addDialogueToHistory(existingNpcId, arrivalMessageForOthers);
                }
                const sceneContext = getElem('scene-context').value.trim();
                const activePcNames = appState.getActivePcIds().map(pcId => appState.getCharacterById(pcId)?.name || "a PC");
                const reactionPayload = {
                    scene_context: sceneContext,
                    player_utterance: arrivalMessageForOthers,
                    active_pcs: activePcNames,
                    speaking_pc_id: currentSpeakingPcId,
                    recent_dialogue_history: appState.getRecentDialogueHistory(existingNpcId)
                };
                if (transcriptArea) { // Add thinking message
                    const thinkingEntry = document.createElement('p');
                    thinkingEntry.className = 'scene-event';
                    thinkingEntry.id = `thinking-${existingNpcId}-arrival-${slugify(toggledNpc.name)}`; // slugify needed
                    thinkingEntry.textContent = `${existingNpc.name} notices ${toggledNpc.name}...`;
                    transcriptArea.appendChild(thinkingEntry);
                    transcriptArea.scrollTop = transcriptArea.scrollHeight;
                }
                await triggerNpcInteraction(existingNpcId, existingNpc.name, reactionPayload, false, `thinking-${existingNpcId}-arrival-${slugify(toggledNpc.name)}`);
            });
        }

    } else {
        appState.removeActiveNpc(npcIdStr);
        removeNpcDialogueAreaUI(npcIdStr, multiNpcContainer); // from uiRenderers.js
        appState.deleteDialogueHistory(npcIdStr);
    }

    const placeholderEvent = multiNpcContainer.querySelector('p.scene-event');
    if (appState.getActiveNpcCount() > 0 && placeholderEvent) {
        placeholderEvent.remove();
    } else if (appState.getActiveNpcCount() === 0 && !placeholderEvent) {
        multiNpcContainer.innerHTML = '<p class="scene-event">Select NPCs to add them to the scene.</p>';
    }

    adjustNpcDialogueAreaWidthsUI(multiNpcContainer); // from uiRenderers.js
    renderNpcListForSceneUI(getElem('character-list'), appState.getAllCharacters(), appState.activeSceneNpcIds, handleToggleNpcInScene, handleSelectCharacterForDetails); // Re-render list
    updateMainView();
}

function slugify(text) { // Simple slugify, move to utils.js if used more broadly
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
}


async function triggerNpcInteraction(npcIdStr, npcName, payload, isGreeting = false, thinkingMessageId = null) {
    const transcriptArea = getElem(`transcript-${npcIdStr}`);
    if (!transcriptArea) {
        console.error(`Transcript area for NPC ID ${npcIdStr} not found.`);
        return;
    }
     let thinkingMessageElement = thinkingMessageId ? getElem(thinkingMessageId) : null;

    if (!thinkingMessageElement && isGreeting) { // Add default thinking message if not already present for greetings
        const sceneEventP = document.createElement('p');
        sceneEventP.className = 'scene-event';
        sceneEventP.textContent = `${npcName} is formulating a response...`;
        transcriptArea.appendChild(sceneEventP);
        transcriptArea.scrollTop = transcriptArea.scrollHeight;
        thinkingMessageElement = sceneEventP;
    }


    try {
        const result = await generateNpcDialogue(npcIdStr, payload); // from apiService.js
        if(thinkingMessageElement && thinkingMessageElement.parentNode) thinkingMessageElement.remove();


        appendMessageToTranscriptUI(transcriptArea, `${npcName}: ${result.npc_dialogue}`, 'dialogue-entry npc-response');
        appState.addDialogueToHistory(npcIdStr, `${npcName}: ${result.npc_dialogue}`);

        // renderAiSuggestionsUI - needs its own module or part of dialogueAreaRenderer.js
        // renderAiSuggestions(result.new_memory_suggestions, result.generated_topics, npcIdStr, ...);
         const suggestionsContainerId = `ai-suggestions-${npcIdStr}`;
         const suggestionsContainer = getElem(suggestionsContainerId);
         if (suggestionsContainer) {
             renderAiSuggestionsContent(
                 result, // Pass the whole result object
                 npcIdStr,
                 suggestionsContainer, // Pass the container to render into
                 appState.getCurrentProfileCharId() === npcIdStr // Check if this NPC is the one in the profile for global suggestions
             );
         }


    } catch (error) {
        console.error(`Error generating dialogue for ${npcName}:`, error);
        if(thinkingMessageElement && thinkingMessageElement.parentNode) thinkingMessageElement.remove();
        appendMessageToTranscriptUI(transcriptArea, `${npcName}: (Error: ${error.message})`, 'dialogue-entry npc-response');
        appState.addDialogueToHistory(npcIdStr, `${npcName}: (Error generating dialogue)`);
    }
    transcriptArea.scrollTop = transcriptArea.scrollHeight;
}
function renderAiSuggestionsContent(aiResult, forNpcId, suggestionsContainerElement, isProfiledNpc) {
    // Simplified: this needs to be fleshed out like your original renderAiSuggestions
    // It should populate the specific suggestion divs inside suggestionsContainerElement
    // For now, a placeholder:
    if (!suggestionsContainerElement) return;
    suggestionsContainerElement.innerHTML = ''; // Clear previous
    suggestionsContainerElement.style.display = 'none'; // Hide by default

    let contentGenerated = false;

    if (aiResult.new_memory_suggestions && aiResult.new_memory_suggestions.length > 0) {
        // ... render memory suggestions ...
        contentGenerated = true;
    }
    if (aiResult.suggested_npc_actions && aiResult.suggested_npc_actions.length > 0) {
        const actionsList = getElem(`suggested-npc-actions-list-npc-${forNpcId}`) || suggestionsContainerElement.querySelector(`#suggested-npc-actions-list-npc-${forNpcId}`);
        if (actionsList) {
            actionsList.innerHTML = `<h5>NPC Actions/Thoughts:</h5>` + aiResult.suggested_npc_actions.map(action => `<div class="suggested-item">${action}</div>`).join('');
            contentGenerated = true;
        }
    }
    // ... (render other suggestion types: player_checks, faction_standing_changes)

    if (contentGenerated) {
        suggestionsContainerElement.style.display = 'block';
    }

    // Also handle global AI suggestions if isProfiledNpc
    if (isProfiledNpc) {
        // ... update global suggestion lists (e.g., #suggested-memories-list) ...
    }
}


async function handleGenerateDialogue() {
    const playerUtterance = getElem('player-utterance').value.trim();
    const sceneContext = getElem('scene-context').value.trim();
    const speakingPcSelect = getElem('speaking-pc-select');
    const speakingPcId = speakingPcSelect ? speakingPcSelect.value : null;

    if (!playerUtterance && !sceneContext) {
        alert("Please enter player dialogue or scene context.");
        return;
    }
     disableBtn('generate-dialogue-btn', true); // Disable button during generation

    const activePcs = appState.getActivePcIds().map(id => appState.getCharacterById(id)?.name).filter(name => name);

    // Add player utterance to all active NPC transcripts
    appState.getActiveNpcIds().forEach(npcId => {
        const transcriptArea = getElem(`transcript-${npcId}`);
        if (transcriptArea && playerUtterance) {
            let speakerName = "Player";
            if(speakingPcId && speakingPcId !== "") {
                const pc = appState.getCharacterById(speakingPcId);
                if(pc) speakerName = pc.name;
            } else if (speakingPcId === "") {
                speakerName = "DM/Scene Event";
            }
             appendMessageToTranscriptUI(transcriptArea, `${speakerName}: ${playerUtterance}`, 'dialogue-entry player-utterance');
             appState.addDialogueToHistory(npcId, `${speakerName}: ${playerUtterance}`);
        }
         // Add thinking message
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
        if (!npc) return Promise.resolve(); // Should not happen if IDs are managed well

        const payload = {
            scene_context: sceneContext,
            player_utterance: playerUtterance,
            active_pcs: activePcs,
            speaking_pc_id: speakingPcId,
            recent_dialogue_history: appState.getRecentDialogueHistory(npcId, 10) // Get more history
        };
        return triggerNpcInteraction(npcId, npc.name, payload, false, `thinking-${npcId}-main`);
    });

    await Promise.all(dialoguePromises);

    getElem('player-utterance').value = ''; // Clear input after sending
    disableBtn('generate-dialogue-btn', false); // Re-enable button
}


function handleTogglePcSelection(pcIdStr) {
    appState.toggleActivePc(pcIdStr);
    renderPcListUI(getElem('active-pc-list'), getElem('speaking-pc-select'), appState.getAllCharacters(), appState.activePcIds, handleTogglePcSelection);
    updateMainView();

    const currentProfileChar = appState.getCurrentProfileChar();
    if (currentProfileChar && currentProfileChar.character_type === 'NPC') {
        // Re-render faction standings for the currently profiled NPC as PC selection changed
        renderNpcFactionStandingsUI(currentProfileChar, appState.getActivePcIds(), appState.getAllCharacters(), getElem('npc-faction-standings-content'), handleSaveFactionStanding);
    }
}

// If using ES6 modules:
// import { initializeAppCharacters, ... } from './characterService.js';
// import { setupResizer, ... } from './eventHandlers.js';
// ... etc.
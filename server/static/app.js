// static/app.js

document.addEventListener('DOMContentLoaded', async () => {
    console.log("app.js: DOMContentLoaded event fired.");
    try {
        await window.initializeAppCharacters();

        window.setupResizer();
        window.setupCollapsibleSections();
        window.assignButtonEventHandlers(); // Ensure this is comprehensive
        window.setupTabControls();
        window.setupSceneContextSelector();
        window.setupDashboardClickHandlers(); // For PC cards in dashboard and scene view

        setTimeout(window.updateMainView, 0);
    } catch (e) {
        console.error("Error during initial app setup:", e);
        const body = document.querySelector('body');
        if (body) body.innerHTML = `<h1>Critical Error Initializing Application: ${e.message}. Please check console.</h1><pre>${e.stack}</pre>`;
    }
    console.log("app.js: DOMContentLoaded finished.");
});

window.setupTabControls = function() {
    const tabLinks = document.querySelectorAll('#left-column-header .tabs .tab-link');
    const tabContents = document.querySelectorAll('#left-column-content .tab-content');

    window.openTab = function(event, tabName) {
        tabContents.forEach(tab => tab.classList.remove('active-tab'));
        tabLinks.forEach(link => link.classList.remove('active'));

        const targetTab = document.getElementById(tabName);
        if(targetTab) targetTab.classList.add('active-tab');

        let clickedButton = event ? event.currentTarget : null;
        if (!clickedButton) { // If called programmatically without an event
            tabLinks.forEach(link => { if(link.getAttribute('onclick').includes(tabName)) clickedButton = link; });
        }
        if(clickedButton) clickedButton.classList.add('active');


        if (tabName === 'tab-npcs') {
            const currentProfileId = appState.getCurrentProfileCharId();
            if (currentProfileId) {
                const char = appState.getCharacterById(currentProfileId);
                // Only re-render if it's an NPC, or clear if it's a PC or no char
                window.renderCharacterProfileUI(char, window.profileElementIds);
            } else {
                 window.renderCharacterProfileUI(null, window.profileElementIds);
            }
        }
        if (tabName === 'tab-lore' && !appState.getCurrentLoreEntryId()) {
            if(typeof window.closeLoreDetailViewUI === 'function'){
                window.closeLoreDetailViewUI();
            }
        }
        if (tabName === 'tab-scene') {
            window.renderNpcListForContextUI(
                window.getElem('character-list-scene-tab'),
                appState.getAllCharacters(),
                appState.activeSceneNpcIds,
                window.handleToggleNpcInScene,
                window.handleSelectCharacterForDetails, // This will handle tab switching if needed
                appState.currentSceneContextFilter
            );
            // If no NPC is currently selected for profile view, clear it
            // This logic is now handled within renderCharacterProfileUI
        }
    }

    if (tabLinks.length > 0 && tabContents.length > 0) {
        const sceneTabButton = Array.from(tabLinks).find(link => link.getAttribute('onclick').includes("'tab-scene'"));
        if (sceneTabButton) {
            sceneTabButton.click();
        } else {
            tabLinks[0].click();
        }
    }
};

window.setupSceneContextSelector = function() {
    const typeSelector = window.getElem('scene-context-type-filter');
    const entrySelector = window.getElem('scene-context-selector');

    if (typeSelector) {
        typeSelector.addEventListener('change', () => {
            window.populateSceneContextSelectorUI();
            entrySelector.value = "";
            appState.currentSceneContextFilter = null;
             window.renderNpcListForContextUI(
                window.getElem('character-list-scene-tab'),
                appState.getAllCharacters(),
                appState.activeSceneNpcIds,
                window.handleToggleNpcInScene,
                window.handleSelectCharacterForDetails,
                null
            );
        });
    }

    if (entrySelector) {
        entrySelector.addEventListener('change', (event) => {
            const selectedLoreId = event.target.value;
            if (selectedLoreId) {
                appState.currentSceneContextFilter = { type: 'lore', id: selectedLoreId };
            } else {
                appState.currentSceneContextFilter = null;
            }
            window.renderNpcListForContextUI(
                window.getElem('character-list-scene-tab'),
                appState.getAllCharacters(),
                appState.activeSceneNpcIds,
                window.handleToggleNpcInScene,
                window.handleSelectCharacterForDetails,
                appState.currentSceneContextFilter
            );
        });
    }
};

window.setupDashboardClickHandlers = function() {
    const pcDashboardContent = window.getElem('pc-dashboard-content');
    if (pcDashboardContent) {
        pcDashboardContent.addEventListener('click', function(event) {
            const clickedCard = event.target.closest('.clickable-pc-card');
            if (clickedCard) {
                const pcIdToRender = clickedCard.dataset.pcId;
                if (pcIdToRender) {
                    const pcData = appState.getCharacterById(pcIdToRender);
                    if (pcData) {
                        window.renderDetailedPcSheetUI(pcData, pcDashboardContent);
                    }
                }
            }
        });
    }

    const pcQuickViewInScene = window.getElem('pc-quick-view-section-in-scene');
    if (pcQuickViewInScene) {
        pcQuickViewInScene.addEventListener('click', function(event) {
            const clickedCard = event.target.closest('.clickable-pc-card');
            if (clickedCard) {
                const pcIdToRender = clickedCard.dataset.pcId;
                if (pcIdToRender) {
                    window.handlePcQuickViewCardClick(pcIdToRender);
                }
            }
        });
    }
};

window.handlePcQuickViewCardClick = function(pcId) {
    const pcData = appState.getCharacterById(pcId);
    if (pcData) {
        const dialogueInterface = window.getElem('dialogue-interface');
        const pcDashboardView = window.getElem('pc-dashboard-view');
        const dashboardContent = window.getElem('pc-dashboard-content');

        if (dialogueInterface) dialogueInterface.style.display = 'none';
        if (pcDashboardView) pcDashboardView.style.display = 'block';

        window.renderDetailedPcSheetUI(pcData, dashboardContent);
    }
};


window.updateMainView = function() {
    console.log("app.js: window.updateMainView called.");
    const dialogueInterfaceElem = window.getElem('dialogue-interface');
    const pcDashboardViewElem = window.getElem('pc-dashboard-view');
    const pcQuickViewInSceneElem = window.getElem('pc-quick-view-section-in-scene');

    if (!dialogueInterfaceElem || !pcDashboardViewElem || !pcQuickViewInSceneElem) {
        console.error("app.js/updateMainView: Critical UI container element(s) missing."); return;
    }

    const activeNpcCount = appState.getActiveNpcCount();
    const dashboardContent = window.getElem('pc-dashboard-content');
    const isDetailedSheetVisible = dashboardContent && dashboardContent.querySelector('.detailed-pc-sheet');

    if (activeNpcCount > 0 && !isDetailedSheetVisible) {
        dialogueInterfaceElem.style.display = 'flex';
        pcDashboardViewElem.style.display = 'none';
        const activePcsData = appState.getAllCharacters().filter(char => appState.hasActivePc(String(char._id)));
        window.renderPcQuickViewInSceneUI(pcQuickViewInSceneElem, activePcsData);

    } else if (isDetailedSheetVisible) {
        dialogueInterfaceElem.style.display = 'none';
        pcDashboardViewElem.style.display = 'block';
        pcQuickViewInSceneElem.style.display = 'none';
        pcQuickViewInSceneElem.innerHTML = '';
    }
    else {
        dialogueInterfaceElem.style.display = 'none';
        pcDashboardViewElem.style.display = 'block';
        pcQuickViewInSceneElem.style.display = 'none';
        pcQuickViewInSceneElem.innerHTML = '';

        if (appState.getActivePcCount() > 0) {
            window.updatePcDashboardUI(dashboardContent, appState.getAllCharacters(), appState.activePcIds, appState.getExpandedAbility(), appState.getExpandedSkill(), appState.getSkillSortKey());
        } else {
            dashboardContent.innerHTML = `<p class="pc-dashboard-no-selection">Select Player Characters from the left panel to view their details and comparisons.</p>`;
        }
    }
    window.disableBtn('generate-dialogue-btn', activeNpcCount === 0);
    console.log("app.js: window.updateMainView finished.");
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
                // Refined greeting prompt
                player_utterance: `(System Directive: You are ${toggledNpc.name}. You have just become aware of ${activePcNames.join(', ')} in the scene. Greet them or offer an initial reaction in character.)`,
                active_pcs: activePcNames,
                speaking_pc_id: currentSpeakingPcId,
                recent_dialogue_history: []
            };
            setTimeout(() => window.triggerNpcInteraction(npcIdStr, toggledNpc.name, greetingPayload, true, `thinking-${npcIdStr}-greeting`), 100);
        }
        // ... (notify other NPCs as before, this logic seems okay) ...
         const otherNpcIdsInScene = Array.from(appState.getActiveNpcIds()).filter(id => id !== npcIdStr);
        if (otherNpcIdsInScene.length > 0 && toggledNpc) {
            const arrivalMessageForOthers = `(System Observation: ${toggledNpc.name} has just arrived or become prominent in the scene.)`;
            otherNpcIdsInScene.forEach(async (existingNpcId) => {
                // ... (existing notification logic seems fine, ensure it uses triggerNpcInteraction correctly)
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
    window.renderNpcListForContextUI(
        window.getElem('character-list-scene-tab'),
        appState.getAllCharacters(),
        appState.activeSceneNpcIds,
        window.handleToggleNpcInScene,
        window.handleSelectCharacterForDetails,
        appState.currentSceneContextFilter
    );
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
        sceneEventP.id = `thinking-${npcIdStr}-greeting`; // Unique ID for greeting thinking message
        sceneEventP.textContent = `${npcName} is formulating a response...`;
        transcriptArea.appendChild(sceneEventP);
        transcriptArea.scrollTop = transcriptArea.scrollHeight;
        thinkingMessageElement = sceneEventP;
    }

    try {
        const result = await window.generateNpcDialogue(npcIdStr, payload);
        if(thinkingMessageElement && thinkingMessageElement.parentNode) thinkingMessageElement.remove();

        window.appendMessageToTranscriptUI(transcriptArea, `${npcName}: ${result.npc_dialogue}`, 'dialogue-entry npc-response');
        appState.addDialogueToHistory(npcIdStr, `${npcName}: ${result.npc_dialogue}`);
        window.renderAiSuggestionsContent(result, npcIdStr);
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
        else speakerDisplayName = speakingPcId;
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
        appState.setExpandedSkill(null);
    }
    window.updatePcDashboardUI(window.getElem('pc-dashboard-content'), appState.getAllCharacters(), appState.activePcIds, appState.getExpandedAbility(), appState.getExpandedSkill(), appState.getSkillSortKey());
};

window.toggleSkillExpansion = function(skillKey) {
    const currentSkill = appState.getExpandedSkill();
    if (currentSkill === skillKey) {
        appState.setExpandedSkill(null);
        appState.setSkillSortKey(null);
    } else {
        appState.setExpandedSkill(skillKey);
        appState.setSkillSortKey(skillKey);
        appState.setExpandedAbility(null);
    }
    window.updatePcDashboardUI(window.getElem('pc-dashboard-content'), appState.getAllCharacters(), appState.activePcIds, appState.getExpandedAbility(), appState.getExpandedSkill(), appState.getSkillSortKey());
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
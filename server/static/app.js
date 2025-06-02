// static/app.js

var App = {
    initializeApp: async function() {
        console.log("App.js: DOMContentLoaded event fired. Initializing App...");
        try {
            // Ensure other namespaces are available if not already loaded by script tags
            // This is usually handled by the order of <script> tags in index.html

            await CharacterService.initializeAppCharacters();

            EventHandlers.setupResizer();
            EventHandlers.setupCollapsibleSections();
            EventHandlers.assignButtonEventHandlers(); 
            this.setupTabControls(); // Use 'this' for internal App methods
            this.setupSceneContextSelector();
            this.setupDashboardClickHandlers();

            setTimeout(this.updateMainView, 0); // Use 'this'
        } catch (e) {
            console.error("App.js: Error during initial app setup:", e);
            const body = document.querySelector('body');
            if (body) body.innerHTML = `<h1>Critical Error Initializing Application: ${e.message}. Please check console.</h1><pre>${e.stack}</pre>`;
        }
        console.log("App.js: DOMContentLoaded finished.");
    },

    openTab: function(event, tabName) { 
        const tabLinks = document.querySelectorAll('#left-column-header .tabs .tab-link');
        const tabContents = document.querySelectorAll('#left-column-content .tab-content');

        tabContents.forEach(tab => tab.classList.remove('active-tab'));
        tabLinks.forEach(link => link.classList.remove('active'));

        const targetTab = document.getElementById(tabName);
        if(targetTab) targetTab.classList.add('active-tab');

        let clickedButton = event ? event.currentTarget : null;
        if (!clickedButton) { 
            tabLinks.forEach(link => { if(link.getAttribute('onclick').includes(`openTab(event, '${tabName}')`)) clickedButton = link; });
        }
        if(clickedButton) clickedButton.classList.add('active');

        if (tabName === 'tab-npcs') {
            const currentProfileId = appState.getCurrentProfileCharId();
            if (currentProfileId) {
                const char = appState.getCharacterById(currentProfileId);
                UIRenderers.renderCharacterProfileUI(char, CharacterService.profileElementIds);
            } else {
                 UIRenderers.renderCharacterProfileUI(null, CharacterService.profileElementIds);
            }
        }
        if (tabName === 'tab-lore' && !appState.getCurrentLoreEntryId()) {
            // UIRenderers.closeLoreDetailViewUI is exposed to window by uiRenderers.js
            if(typeof closeLoreDetailViewUI === 'function'){
                closeLoreDetailViewUI();
            }
        }
        if (tabName === 'tab-scene') {
            UIRenderers.renderNpcListForContextUI(
                Utils.getElem('character-list-scene-tab'),
                appState.getAllCharacters(),
                appState.activeSceneNpcIds,
                this.handleToggleNpcInScene, // Use 'this'
                CharacterService.handleSelectCharacterForDetails,
                appState.currentSceneContextFilter
            );
        }
    },

    setupTabControls: function() {
        const tabLinks = document.querySelectorAll('#left-column-header .tabs .tab-link');
        // The onclick attributes in HTML call window.openTab, 
        // which is set to App.openTab at the end of this file.

        if (tabLinks.length > 0) {
            // Attempt to find the 'SCENE' tab button to click it by default
            const sceneTabButton = Array.from(tabLinks).find(link => {
                const onclickAttr = link.getAttribute('onclick');
                return onclickAttr && onclickAttr.includes("'tab-scene'");
            });
            
            if (sceneTabButton) {
                sceneTabButton.click(); // This will call window.openTab -> App.openTab
            } else if (tabLinks[0]) {
                // Fallback to clicking the first tab if 'SCENE' tab isn't found or configured as expected
                tabLinks[0].click(); 
            }
        }
    },

    setupSceneContextSelector: function() {
        const typeSelector = Utils.getElem('scene-context-type-filter');
        const entrySelector = Utils.getElem('scene-context-selector');

        if (typeSelector) {
            typeSelector.addEventListener('change', () => {
                UIRenderers.populateSceneContextSelectorUI();
                if (entrySelector) entrySelector.value = ""; // Reset entry selector
                appState.currentSceneContextFilter = null;
                 UIRenderers.renderNpcListForContextUI(
                    Utils.getElem('character-list-scene-tab'),
                    appState.getAllCharacters(),
                    appState.activeSceneNpcIds,
                    this.handleToggleNpcInScene, // Use 'this'
                    CharacterService.handleSelectCharacterForDetails,
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
                UIRenderers.renderNpcListForContextUI(
                    Utils.getElem('character-list-scene-tab'),
                    appState.getAllCharacters(),
                    appState.activeSceneNpcIds,
                    this.handleToggleNpcInScene, // Use 'this'
                    CharacterService.handleSelectCharacterForDetails,
                    appState.currentSceneContextFilter
                );
            });
        }
    },

    setupDashboardClickHandlers: function() {
        const pcDashboardContent = Utils.getElem('pc-dashboard-content');
        if (pcDashboardContent) {
            pcDashboardContent.addEventListener('click', function(event) {
                const clickedCard = event.target.closest('.clickable-pc-card');
                if (clickedCard) {
                    const pcIdToRender = clickedCard.dataset.pcId;
                    if (pcIdToRender) {
                        const pcData = appState.getCharacterById(pcIdToRender);
                        if (pcData) {
                            UIRenderers.renderDetailedPcSheetUI(pcData, pcDashboardContent);
                        }
                    }
                }
            });
        }

        const pcQuickViewInScene = Utils.getElem('pc-quick-view-section-in-scene');
        if (pcQuickViewInScene) {
            pcQuickViewInScene.addEventListener('click', function(event) {
                const clickedCard = event.target.closest('.clickable-pc-card');
                if (clickedCard) {
                    const pcIdToRender = clickedCard.dataset.pcId;
                    if (pcIdToRender) {
                        App.handlePcQuickViewCardClick(pcIdToRender); // Use App namespace
                    }
                }
            });
        }
    },

    handlePcQuickViewCardClick: function(pcId) {
        const pcData = appState.getCharacterById(pcId);
        if (pcData) {
            const dialogueInterface = Utils.getElem('dialogue-interface');
            const pcDashboardView = Utils.getElem('pc-dashboard-view');
            const dashboardContent = Utils.getElem('pc-dashboard-content');

            if (dialogueInterface) dialogueInterface.style.display = 'none';
            if (pcDashboardView) pcDashboardView.style.display = 'block';

            UIRenderers.renderDetailedPcSheetUI(pcData, dashboardContent);
        }
    },

    updateMainView: function() {
        console.log("App.js: App.updateMainView called.");
        const dialogueInterfaceElem = Utils.getElem('dialogue-interface');
        const pcDashboardViewElem = Utils.getElem('pc-dashboard-view');
        const pcQuickViewInSceneElem = Utils.getElem('pc-quick-view-section-in-scene');

        if (!dialogueInterfaceElem || !pcDashboardViewElem || !pcQuickViewInSceneElem) {
            console.error("App.js/updateMainView: Critical UI container element(s) missing."); return;
        }

        const activeNpcCount = appState.getActiveNpcCount();
        const dashboardContent = Utils.getElem('pc-dashboard-content');
        const isDetailedSheetVisible = dashboardContent && dashboardContent.querySelector('.detailed-pc-sheet');

        if (activeNpcCount > 0 && !isDetailedSheetVisible) {
            dialogueInterfaceElem.style.display = 'flex';
            pcDashboardViewElem.style.display = 'none';
            const activePcsData = appState.getAllCharacters().filter(char => appState.hasActivePc(String(char._id)));
            UIRenderers.renderPcQuickViewInSceneUI(pcQuickViewInSceneElem, activePcsData);

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
                UIRenderers.updatePcDashboardUI(dashboardContent, appState.getAllCharacters(), appState.activePcIds, appState.getExpandedAbility(), appState.getExpandedSkill(), appState.getSkillSortKey());
            } else {
                if(dashboardContent) dashboardContent.innerHTML = `<p class="pc-dashboard-no-selection">Select Player Characters from the left panel to view their details and comparisons.</p>`;
            }
        }
        Utils.disableBtn('generate-dialogue-btn', activeNpcCount === 0);
        console.log("App.js: App.updateMainView finished.");
    },

    handleToggleNpcInScene: async function(npcIdStr, npcName) {
        const multiNpcContainer = Utils.getElem('multi-npc-dialogue-container');
        if (!multiNpcContainer) {
            console.error("Multi-NPC dialogue container not found.");
            return;
        }

        const isAdding = !appState.hasActiveNpc(npcIdStr);
        const speakingPcSelect = Utils.getElem('speaking-pc-select');
        const currentSpeakingPcId = speakingPcSelect ? speakingPcSelect.value : null;

        if (isAdding) {
            appState.addActiveNpc(npcIdStr);
            UIRenderers.createNpcDialogueAreaUI(npcIdStr, npcName, multiNpcContainer);
            appState.initDialogueHistory(npcIdStr);
            const toggledNpc = appState.getCharacterById(npcIdStr);

            if (toggledNpc && (appState.getActivePcCount() > 0 || (currentSpeakingPcId !== null && currentSpeakingPcId === ""))) {
                 const sceneContext = Utils.getElem('scene-context').value.trim();
                 const activePcNames = appState.getActivePcIds().map(pcId => appState.getCharacterById(pcId)?.name || "a PC");
                 const greetingPayload = {
                    scene_context: sceneContext || `${activePcNames.join(', ')} ${activePcNames.length > 1 ? 'are' : 'is'} present.`,
                    player_utterance: `(System Directive: You are ${toggledNpc.name}. You have just become aware of ${activePcNames.join(', ')} in the scene. Greet them or offer an initial reaction in character.)`,
                    active_pcs: activePcNames,
                    speaking_pc_id: currentSpeakingPcId,
                    recent_dialogue_history: []
                };
                setTimeout(() => App.triggerNpcInteraction(npcIdStr, toggledNpc.name, greetingPayload, true, `thinking-${npcIdStr}-greeting`), 100);
            }
            // const otherNpcIdsInScene = Array.from(appState.getActiveNpcIds()).filter(id => id !== npcIdStr);
            // if (otherNpcIdsInScene.length > 0 && toggledNpc) {
                // Logic for notifying other NPCs can be added here if needed
            // }
        } else {
            appState.removeActiveNpc(npcIdStr);
            UIRenderers.removeNpcDialogueAreaUI(npcIdStr, multiNpcContainer);
            appState.deleteDialogueHistory(npcIdStr);
        }

        const placeholderEvent = multiNpcContainer.querySelector('p.scene-event');
        if (appState.getActiveNpcCount() > 0 && placeholderEvent) {
            placeholderEvent.remove();
        } else if (appState.getActiveNpcCount() === 0 && !placeholderEvent) {
            multiNpcContainer.innerHTML = '<p class="scene-event">Select NPCs from the SCENE tab to add them to the interaction.</p>';
        }

        UIRenderers.adjustNpcDialogueAreaWidthsUI(multiNpcContainer);
        UIRenderers.renderNpcListForContextUI(
            Utils.getElem('character-list-scene-tab'),
            appState.getAllCharacters(),
            appState.activeSceneNpcIds,
            App.handleToggleNpcInScene, // Pass the namespaced function
            CharacterService.handleSelectCharacterForDetails,
            appState.currentSceneContextFilter
        );
        App.updateMainView();
    },

    triggerNpcInteraction: async function(npcIdStr, npcName, payload, isGreeting = false, thinkingMessageId = null) {
        const transcriptArea = Utils.getElem(`transcript-${npcIdStr}`);
        if (!transcriptArea) {
            console.error(`Transcript area for NPC ID ${npcIdStr} not found.`);
            return;
        }
        let thinkingMessageElement = thinkingMessageId ? Utils.getElem(thinkingMessageId) : null;

        if (!thinkingMessageElement && isGreeting) {
            const sceneEventP = document.createElement('p');
            sceneEventP.className = 'scene-event';
            sceneEventP.id = `thinking-${npcIdStr}-greeting`;
            sceneEventP.textContent = `${npcName} is formulating a response...`;
            transcriptArea.appendChild(sceneEventP);
            transcriptArea.scrollTop = transcriptArea.scrollHeight;
            thinkingMessageElement = sceneEventP;
        }

        try {
            const result = await ApiService.generateNpcDialogue(npcIdStr, payload);
            if(thinkingMessageElement && thinkingMessageElement.parentNode) thinkingMessageElement.remove();

            UIRenderers.appendMessageToTranscriptUI(transcriptArea, `${npcName}: ${result.npc_dialogue}`, 'dialogue-entry npc-response');
            appState.addDialogueToHistory(npcIdStr, `${npcName}: ${result.npc_dialogue}`);
            UIRenderers.renderAiSuggestionsContent(result, npcIdStr);
        } catch (error) {
            console.error(`Error generating dialogue for ${npcName}:`, error);
            if(thinkingMessageElement && thinkingMessageElement.parentNode) thinkingMessageElement.remove();
            UIRenderers.appendMessageToTranscriptUI(transcriptArea, `${npcName}: (Error: ${error.message})`, 'dialogue-entry npc-response');
            appState.addDialogueToHistory(npcIdStr, `${npcName}: (Error generating dialogue)`);
        }
        transcriptArea.scrollTop = transcriptArea.scrollHeight;
    },

    handleGenerateDialogue: async function() {
        const playerUtterance = Utils.getElem('player-utterance').value.trim();
        const sceneContext = Utils.getElem('scene-context').value.trim();
        const speakingPcSelect = Utils.getElem('speaking-pc-select');
        const speakingPcId = speakingPcSelect ? speakingPcSelect.value : null;

        if (!playerUtterance && !sceneContext.trim() && playerUtterance !== "") { // Ensure empty utterance IS processed if context exists
            alert("Please enter player dialogue or ensure scene context is descriptive.");
            return;
        }
        Utils.disableBtn('generate-dialogue-btn', true);

        const activePcsNames = appState.getActivePcIds().map(id => appState.getCharacterById(id)?.name).filter(name => name);
        let speakerDisplayName = "Player";
        if (speakingPcId && speakingPcId !== "") {
            const pc = appState.getCharacterById(speakingPcId);
            if (pc) speakerDisplayName = pc.name;
            // else speakerDisplayName = speakingPcId; // Avoid showing ID if name not found
        } else if (speakingPcId === "") {
            speakerDisplayName = "DM/Scene Event";
        }

        appState.getActiveNpcIds().forEach(npcId => {
            const transcriptArea = Utils.getElem(`transcript-${npcId}`);
            if (transcriptArea && playerUtterance) { // Only append player utterance if it exists
                UIRenderers.appendMessageToTranscriptUI(transcriptArea, `${speakerDisplayName}: ${playerUtterance}`, 'dialogue-entry player-utterance');
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
            if (!npc) return Promise.resolve(); // Should not happen if activeNpcIds is correct

            const payload = {
                scene_context: sceneContext,
                player_utterance: playerUtterance,
                active_pcs: activePcsNames,
                speaking_pc_id: speakingPcId,
                recent_dialogue_history: appState.getRecentDialogueHistory(npcId, 10) // Get last 10 lines
            };
            return App.triggerNpcInteraction(npcId, npc.name, payload, false, `thinking-${npcId}-main`);
        });

        await Promise.all(dialoguePromises);

        if (playerUtterance) Utils.getElem('player-utterance').value = ''; // Clear only if there was an utterance
        Utils.disableBtn('generate-dialogue-btn', false);
    },

    handleTogglePcSelection: function(pcIdStr) {
        appState.toggleActivePc(pcIdStr);
        UIRenderers.renderPcListUI(Utils.getElem('active-pc-list'), Utils.getElem('speaking-pc-select'), appState.getAllCharacters(), appState.activePcIds, App.handleTogglePcSelection);
        App.updateMainView();

        const currentProfileChar = appState.getCurrentProfileChar();
        if (currentProfileChar && currentProfileChar.character_type === 'NPC') {
            UIRenderers.renderNpcFactionStandingsUI(currentProfileChar, appState.activePcIds, appState.getAllCharacters(), Utils.getElem('npc-faction-standings-content'), App.handleSaveFactionStanding);
        }
    },

    handleBackToDashboardOverview: function() {
        const dashboardContent = Utils.getElem('pc-dashboard-content');
        if (dashboardContent) {
            const detailedSheet = dashboardContent.querySelector('.detailed-pc-sheet');
            if (detailedSheet) detailedSheet.remove();
        }
        appState.setExpandedAbility(null);
        appState.setExpandedSkill(null);
        appState.setSkillSortKey(null);
        App.updateMainView();
    },

    toggleAbilityExpansion: function(ablKey) {
        const currentAbility = appState.getExpandedAbility();
        if (currentAbility === ablKey) {
            appState.setExpandedAbility(null);
        } else {
            appState.setExpandedAbility(ablKey);
            appState.setExpandedSkill(null); // Close skill expansion if ability is opened
        }
        UIRenderers.updatePcDashboardUI(Utils.getElem('pc-dashboard-content'), appState.getAllCharacters(), appState.activePcIds, appState.getExpandedAbility(), appState.getExpandedSkill(), appState.getSkillSortKey());
    },

    toggleSkillExpansion: function(skillKey) {
        const currentSkill = appState.getExpandedSkill();
        if (currentSkill === skillKey) {
            appState.setExpandedSkill(null);
            appState.setSkillSortKey(null);
        } else {
            appState.setExpandedSkill(skillKey);
            appState.setSkillSortKey(skillKey); // Sort by this skill
            appState.setExpandedAbility(null); // Close ability expansion if skill is opened
        }
        UIRenderers.updatePcDashboardUI(Utils.getElem('pc-dashboard-content'), appState.getAllCharacters(), appState.activePcIds, appState.getExpandedAbility(), appState.getExpandedSkill(), appState.getSkillSortKey());
    },

    addSuggestedMemoryAsActual: async function(npcId, memoryContent) {
        if (!npcId || !memoryContent) return;
        const character = appState.getCharacterById(npcId);
        if (!character || character.character_type !== 'NPC') {
            alert("Cannot add memory: Invalid NPC ID or character is not an NPC.");
            return;
        }
        try {
            const memoryData = { content: memoryContent, type: "AI_suggestion", source: "AI suggestion" };
            const response = await ApiService.addMemoryToNpc(npcId, memoryData);
            const charToUpdate = appState.getCharacterById(npcId);
            if (charToUpdate && response.updated_memories) {
                charToUpdate.memories = response.updated_memories;
                appState.updateCharacterInList(charToUpdate);
                if (appState.getCurrentProfileCharId() === npcId) {
                    // handleDeleteMemory is globally available from CharacterService re-export
                    UIRenderers.renderMemoriesUI(charToUpdate.memories, Utils.getElem('character-memories-list'), handleDeleteMemory); 
                }
            }
            alert(`Suggested memory added to ${character.name}.`);
        } catch (error) {
            console.error("App.js: Error adding suggested memory:", error);
            alert("Error adding suggested memory: " + error.message);
        }
    },

    acceptFactionStandingChange: async function(npcIdToUpdate, pcTargetId, newStanding) {
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
            // handleSaveFactionStanding is globally available from CharacterService re-export
            await handleSaveFactionStanding(npcIdToUpdate, pcTargetId, newStanding);
        }
    },

    // Re-assign CharacterService handlers to App namespace for consistency if preferred,
    // or rely on their global re-export from characterService.js for HTML onclicks.
    // For internal JS calls, it's cleaner to use CharacterService.method directly.
    // The below are primarily for if HTML onclicks were to call App.method instead of window.method
    handleSaveGmNotes: CharacterService.handleSaveGmNotes,
    handleAddMemory: CharacterService.handleAddMemory,
    handleDeleteMemory: CharacterService.handleDeleteMemory,
    handleSaveFactionStanding: CharacterService.handleSaveFactionStanding,
    handleAssociateHistoryFile: CharacterService.handleAssociateHistoryFile,
    handleDissociateHistoryFile: CharacterService.handleDissociateHistoryFile,
    handleCharacterCreation: CharacterService.handleCharacterCreation,
    handleCreateLoreEntry: CharacterService.handleCreateLoreEntry,
    handleSelectLoreEntryForDetails: CharacterService.handleSelectLoreEntryForDetails,
    handleUpdateLoreEntryGmNotes: CharacterService.handleUpdateLoreEntryGmNotes,
    handleDeleteLoreEntry: CharacterService.handleDeleteLoreEntry,
    handleLinkLoreToCharacter: CharacterService.handleLinkLoreToCharacter,
    handleUnlinkLoreFromCharacter: CharacterService.handleUnlinkLoreFromCharacter
};

document.addEventListener('DOMContentLoaded', App.initializeApp);

// Expose to window ONLY those functions directly called by HTML onclick attributes
// Ensure these names match what's in the HTML.
window.openTab = App.openTab;
window.handleToggleNpcInScene = App.handleToggleNpcInScene; // If called from HTML
window.handleGenerateDialogue = App.handleGenerateDialogue; // If called from HTML
window.handleTogglePcSelection = App.handleTogglePcSelection; // If called from HTML
window.handleBackToDashboardOverview = App.handleBackToDashboardOverview; // If called from HTML
window.toggleAbilityExpansion = App.toggleAbilityExpansion; // If called from HTML
window.toggleSkillExpansion = App.toggleSkillExpansion; // If called from HTML
window.addSuggestedMemoryAsActual = App.addSuggestedMemoryAsActual; // For dynamically created buttons
window.acceptFactionStandingChange = App.acceptFactionStandingChange; // For dynamically created buttons

// Functions from CharacterService that are assigned to buttons in assignButtonEventHandlers
// are called as CharacterService.methodName, so they don't need to be on window unless
// HTML directly calls window.functionName. The re-exports at the bottom of characterService.js
// cover the case where elements.callback() in UIRenderers might expect them globally.
// For UIRenderers.closeLoreDetailViewUI, it's already exported to window in uiRenderers.js.

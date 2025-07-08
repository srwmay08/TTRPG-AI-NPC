// static/app.js
// Responsibility: Main application logic and event orchestration.

var App = {
    initializeApp: async function() {
        console.log("App.js: DOMContentLoaded event fired. Initializing App...");
        try {
            await CharacterService.initializeAppCharacters();

            EventHandlers.setupResizer();
            EventHandlers.setupCollapsibleSections(); 
            EventHandlers.assignButtonEventHandlers(); 
            this.setupTabControls(); 
            this.setupSceneContextSelector();
            this.setupDashboardClickHandlers();

            const dashboardView = Utils.getElem('pc-dashboard-view');
            if (dashboardView) {
                dashboardView.addEventListener('change', (event) => {
                    if (event.target.classList.contains('attack-selector')) {
                        const pcId = event.target.dataset.pcId;
                        const attackName = event.target.dataset.attackName;
                        appState.toggleAttackSelection(pcId, attackName);
                        this.updateMainView();
                    } else if (event.target.id === 'round-count-input') {
                        appState.estimatedRounds = parseInt(event.target.value, 10) || 1;
                        this.updateMainView();
                    } else if (event.target.id === 'dpr-ac-input') {
                         const newAC = parseInt(event.target.value, 10);
                        if (!isNaN(newAC)) {
                            appState.targetAC = newAC;
                            this.updateMainView();
                        }
                    }
                });
            }

            setTimeout(() => this.updateMainView(), 0); 
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
            tabLinks.forEach(link => { 
                const onclickAttr = link.getAttribute('onclick');
                if (onclickAttr && onclickAttr.includes(`openTab(event, '${tabName}')`)) {
                    clickedButton = link;
                }
            });
        }
        if(clickedButton) clickedButton.classList.add('active');

        if (tabName === 'tab-npcs') {
            const currentProfileId = appState.getCurrentProfileCharId();
            CharacterService.handleSelectCharacterForDetails(currentProfileId);
        }
        if (tabName === 'tab-lore' && !appState.getCurrentLoreEntryId()) {
            if(typeof LoreRenderers.closeLoreDetailViewUI === 'function'){
                LoreRenderers.closeLoreDetailViewUI();
            }
        }
        if (tabName === 'tab-scene') {
            NPCRenderers.renderNpcListForContextUI(
                Utils.getElem('character-list-scene-tab'),
                appState.getAllCharacters(),
                appState.activeSceneNpcIds,
                this.handleToggleNpcInScene, 
                CharacterService.handleSelectCharacterForDetails,
                appState.getCurrentSceneContextFilter()
            );
        }
    },

    setupTabControls: function() {
        const tabLinks = document.querySelectorAll('#left-column-header .tabs .tab-link');
        if (tabLinks.length > 0) {
            const sceneTabButton = Array.from(tabLinks).find(link => {
                const onclickAttr = link.getAttribute('onclick');
                return onclickAttr && onclickAttr.includes("'tab-scene'");
            });
            
            if (sceneTabButton) {
                sceneTabButton.click(); 
            } else if (tabLinks[0]) {
                tabLinks[0].click(); 
            }
        }
    },

    setupSceneContextSelector: function() {
        const typeSelector = Utils.getElem('scene-context-type-filter');
        const entrySelector = Utils.getElem('scene-context-selector');

        if (typeSelector) {
            typeSelector.addEventListener('change', () => { 
                LoreRenderers.populateSceneContextSelectorUI();
                if (entrySelector) entrySelector.value = ""; 
                appState.setCurrentSceneContextFilter(null); 
                 NPCRenderers.renderNpcListForContextUI(
                    Utils.getElem('character-list-scene-tab'),
                    appState.getAllCharacters(),
                    appState.activeSceneNpcIds,
                    App.handleToggleNpcInScene, 
                    CharacterService.handleSelectCharacterForDetails,
                    null 
                );
                this.updateMainView();
            });
        }

        if (entrySelector) {
            entrySelector.addEventListener('change', (event) => { 
                const selectedLoreId = event.target.value;
                if (selectedLoreId) {
                    appState.setCurrentSceneContextFilter({ type: 'lore', id: selectedLoreId });
                } else {
                    appState.setCurrentSceneContextFilter(null);
                }
                NPCRenderers.renderNpcListForContextUI(
                    Utils.getElem('character-list-scene-tab'),
                    appState.getAllCharacters(),
                    appState.activeSceneNpcIds,
                    App.handleToggleNpcInScene, 
                    CharacterService.handleSelectCharacterForDetails,
                    appState.getCurrentSceneContextFilter()
                );
                this.updateMainView();
            });
        }
        NPCRenderers.renderNpcListForContextUI(
            Utils.getElem('character-list-scene-tab'),
            appState.getAllCharacters(),
            appState.activeSceneNpcIds,
            App.handleToggleNpcInScene,
            CharacterService.handleSelectCharacterForDetails,
            null
        );
    },

    setupDashboardClickHandlers: function() {
        const handleCardClick = (event) => {
            const clickedCard = event.target.closest('.clickable-pc-card');
            if (clickedCard) {
                const pcIdToRender = clickedCard.dataset.pcId;
                if (pcIdToRender) {
                    const pcData = appState.getCharacterById(pcIdToRender);
                    if (pcData) {
                        const pcDashboardView = Utils.getElem('pc-dashboard-view');
                        const dialogueInterface = Utils.getElem('dialogue-interface');
                        if (pcDashboardView.style.display === 'none') {
                            if(dialogueInterface) dialogueInterface.style.display = 'none';
                            pcDashboardView.style.display = 'block';
                            const pcQuickViewInSceneElem = Utils.getElem('pc-quick-view-section-in-scene');
                            if(pcQuickViewInSceneElem) pcQuickViewInSceneElem.style.display = 'none';
                        }
                        PCRenderers.renderDetailedPcSheetUI(pcData, Utils.getElem('pc-dashboard-content'));
                    }
                }
            }
        };

        const pcDashboardContent = Utils.getElem('pc-dashboard-content');
        if (pcDashboardContent) {
            pcDashboardContent.removeEventListener('click', handleCardClick); 
            pcDashboardContent.addEventListener('click', handleCardClick);
        }

        const pcQuickViewInScene = Utils.getElem('pc-quick-view-section-in-scene');
        if (pcQuickViewInScene) {
            pcQuickViewInScene.removeEventListener('click', handleCardClick);
            pcQuickViewInScene.addEventListener('click', handleCardClick);
        }
    },
    
    updateMainView: function() {
        console.log("App.js: App.updateMainView called.");
        MainView.updateMainViewUI(
            Utils.getElem('dialogue-interface'),
            Utils.getElem('pc-dashboard-view'),
            Utils.getElem('pc-quick-view-section-in-scene'),
            appState.getActiveNpcCount(),
            appState.getActivePcCount() > 0
        );
        console.log("App.js: App.updateMainView finished.");
    },

    handleToggleNpcInScene: async function(npcIdStr, npcName) {
        const multiNpcContainer = Utils.getElem('multi-npc-dialogue-container');
        if (!multiNpcContainer) {
            console.error("Multi-NPC dialogue container not found.");
            return;
        }
    
        const isAdding = !appState.hasActiveNpc(npcIdStr);
    
        if (isAdding) {
            appState.addActiveNpc(npcIdStr);
            const toggledNpc = appState.getCharacterById(npcIdStr);
            if (!toggledNpc) {
                console.error(`Could not find character data for ID: ${npcIdStr}`);
                appState.removeActiveNpc(npcIdStr); // Clean up
                return;
            }
    
            NPCRenderers.createNpcDialogueAreaUI(toggledNpc, multiNpcContainer);
            appState.initDialogueHistory(npcIdStr);
            
            const intro = toggledNpc.canned_conversations?.introduction;
            const sceneContext = Utils.getElem('scene-context').value.trim();
            const activePcNames = appState.getActivePcIds().map(pcId => appState.getCharacterById(pcId)?.name || "a PC");
            const speakingPcSelect = Utils.getElem('speaking-pc-select');
            const currentSpeakingPcId = speakingPcSelect ? speakingPcSelect.value : null;

            if (intro) {
                const payload = {
                    scene_context: sceneContext || `${activePcNames.join(', ')} are present.`,
                    player_utterance: `(System Directive: Canned Response Used) The response was: "${intro}"`,
                    active_pcs: activePcNames,
                    speaking_pc_id: currentSpeakingPcId,
                    recent_dialogue_history: []
                };
                setTimeout(() => App.triggerNpcInteraction(npcIdStr, toggledNpc.name, payload, true, `thinking-${npcIdStr}-greeting`), 100);

            } else {
                const greetingPayload = {
                    scene_context: sceneContext || `${activePcNames.join(', ')} ${activePcNames.length > 1 ? 'are' : 'is'} present.`,
                    player_utterance: `(System Directive: You are ${toggledNpc.name}. You have just become aware of ${activePcNames.join(', ')} in the scene. Greet them or offer an initial reaction in character.)`,
                    active_pcs: activePcNames,
                    speaking_pc_id: currentSpeakingPcId,
                    recent_dialogue_history: []
                };
                setTimeout(() => App.triggerNpcInteraction(npcIdStr, toggledNpc.name, greetingPayload, true, `thinking-${npcIdStr}-greeting`), 100);
            }
        } else {
            appState.removeActiveNpc(npcIdStr);
            NPCRenderers.removeNpcDialogueAreaUI(npcIdStr, multiNpcContainer);
            appState.deleteDialogueHistory(npcIdStr);
        }
    
        const placeholderEvent = multiNpcContainer.querySelector('p.scene-event');
        if (appState.getActiveNpcCount() > 0 && placeholderEvent) {
            placeholderEvent.remove();
        } else if (appState.getActiveNpcCount() === 0 && !placeholderEvent) {
            multiNpcContainer.innerHTML = '<p class="scene-event">Select NPCs from the SCENE tab to add them to the interaction.</p>';
        }
    
        NPCRenderers.renderNpcListForContextUI(
            Utils.getElem('character-list-scene-tab'),
            appState.getAllCharacters(),
            appState.activeSceneNpcIds,
            App.handleToggleNpcInScene,
            CharacterService.handleSelectCharacterForDetails,
            appState.getCurrentSceneContextFilter()
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

            NPCRenderers.appendMessageToTranscriptUI(transcriptArea, `${npcName}: ${result.npc_dialogue}`, 'dialogue-entry npc-response');
            appState.addDialogueToHistory(npcIdStr, `${npcName}: ${result.npc_dialogue}`);
            
            appState.setCurrentProfileCharId(npcIdStr); 
            const interactingChar = appState.getCharacterById(npcIdStr);
            if (interactingChar) {
                appState.setCannedResponsesForProfiledChar(interactingChar.canned_conversations || {});
            }
            appState.lastAiResultForProfiledChar = result;

            NPCRenderers.renderSuggestionsArea(result, npcIdStr);
        } catch (error) {
            console.error(`Error generating dialogue for ${npcName}:`, error);
            if(thinkingMessageElement && thinkingMessageElement.parentNode) thinkingMessageElement.remove();
            NPCRenderers.appendMessageToTranscriptUI(transcriptArea, `${npcName}: (Error: ${error.message})`, 'dialogue-entry npc-response');
            appState.addDialogueToHistory(npcIdStr, `${npcName}: (Error generating dialogue)`);
        }
        transcriptArea.scrollTop = transcriptArea.scrollHeight;
    },

    handleGenerateDialogue: async function() {
        const playerUtterance = Utils.getElem('player-utterance').value.trim();
        const sceneContext = Utils.getElem('scene-context').value.trim();
        const speakingPcSelect = Utils.getElem('speaking-pc-select');
        const speakerId = speakingPcSelect ? speakingPcSelect.value : null;

        if (!playerUtterance) {
            alert("Please enter player dialogue to send to the NPCs.");
            return;
        }
        Utils.disableBtn('generate-dialogue-btn', true);

        const speaker = appState.getCharacterById(speakerId);
        const speakerDisplayName = speaker ? speaker.name : "DM/Scene Event";
        const isSpeakerAnNpc = speaker && speaker.character_type === 'NPC';

        const activeNpcIds = appState.getActiveNpcIds();
        const activePcsNames = appState.getActivePcIds().map(id => appState.getCharacterById(id)?.name).filter(name => name);

        const listeningNpcIds = activeNpcIds.filter(id => id !== speakerId);

        activeNpcIds.forEach(npcId => {
            const transcriptArea = Utils.getElem(`transcript-${npcId}`);
            if (transcriptArea) {
                const messageClass = (isSpeakerAnNpc && speakerId === npcId) ? 'dialogue-entry npc-response' : 'dialogue-entry player-utterance';
                NPCRenderers.appendMessageToTranscriptUI(transcriptArea, `${speakerDisplayName}: ${playerUtterance}`, messageClass);
                appState.addDialogueToHistory(npcId, `${speakerDisplayName}: ${playerUtterance}`);
            }
        });

        listeningNpcIds.forEach(npcId => {
            const npc = appState.getCharacterById(npcId);
            const transcriptArea = Utils.getElem(`transcript-${npcId}`);
            if (transcriptArea && npc) {
                const thinkingEntry = document.createElement('p');
                thinkingEntry.className = 'scene-event';
                thinkingEntry.id = `thinking-${npcId}-main`;
                thinkingEntry.textContent = `${npc.name} is formulating a response...`;
                transcriptArea.appendChild(thinkingEntry);
                transcriptArea.scrollTop = transcriptArea.scrollHeight;
            }
        });

        const dialoguePromises = listeningNpcIds.map(npcId => {
            const npc = appState.getCharacterById(npcId);
            if (!npc) return Promise.resolve();

            const payload = {
                scene_context: sceneContext,
                player_utterance: playerUtterance,
                active_pcs: activePcsNames,
                speaking_pc_id: speakerId,
                recent_dialogue_history: appState.getRecentDialogueHistory(npcId, 10)
            };
            return App.triggerNpcInteraction(npcId, npc.name, payload, false, `thinking-${npcId}-main`);
        });

        await Promise.all(dialoguePromises);

        if (playerUtterance) Utils.getElem('player-utterance').value = '';
        Utils.disableBtn('generate-dialogue-btn', false);
    },

    handleTogglePcSelection: function(pcIdStr) {
        appState.toggleActivePc(pcIdStr);
        NPCRenderers.renderPcListUI(
            Utils.getElem('active-pc-list'), 
            Utils.getElem('speaking-pc-select'), 
            appState.getAllCharacters(), 
            appState.activePcIds, 
            App.handleTogglePcSelection,
            appState.activeSceneNpcIds
        );
        App.updateMainView();

        const currentProfileChar = appState.getCurrentProfileChar();
        if (currentProfileChar && currentProfileChar.character_type === 'NPC') {
            NPCRenderers.renderNpcFactionStandingsUI(currentProfileChar, appState.activePcIds, appState.getAllCharacters(), Utils.getElem('npc-faction-standings-content'), CharacterService.handleSaveFactionStanding);
        }
    },

    handleBackToDashboardOverview: function() {
        const dashboardContent = Utils.getElem('pc-dashboard-content');
        if (dashboardContent) {
            const detailedSheet = dashboardContent.querySelector('.detailed-pc-sheet');
            if (detailedSheet) detailedSheet.remove();
        }
        appState.setExpandedAbility(null);
        App.updateMainView();
    },

    toggleAbilityExpansion: function(ablKey) {
        const currentAbility = appState.getExpandedAbility();
        appState.setExpandedAbility(currentAbility === ablKey ? null : ablKey);
        PCRenderers.updatePcDashboardUI(Utils.getElem('pc-dashboard-content'), appState.getAllCharacters(), appState.activePcIds, appState.getExpandedAbility());
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
                    NPCRenderers.renderMemoriesUI(charToUpdate.memories, Utils.getElem('character-memories-list'), CharacterService.handleDeleteMemory);
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
            await CharacterService.handleSaveFactionStanding(npcIdToUpdate, pcTargetId, newStanding);
        }
    },

    useSpecificCannedResponse: function(topic) {
        const profiledCharId = appState.getCurrentProfileCharId();
        if (!profiledCharId) return;

        if (!appState.hasActiveNpc(profiledCharId)) {
            alert("The profiled NPC must be in the current scene to use a canned response.");
            return;
        }

        const profiledChar = appState.getCharacterById(profiledCharId);
        if (!profiledChar) return;

        const cannedResponses = appState.cannedResponsesForProfiledChar || {};
        const cannedResponseText = cannedResponses[topic];
        if (!cannedResponseText) {
            console.error(`Canned response for topic "${topic}" not found.`);
            return;
        }

        const transcriptArea = Utils.getElem(`transcript-${profiledCharId}`);
        if (transcriptArea) {
            NPCRenderers.appendMessageToTranscriptUI(transcriptArea, `${profiledChar.name}: ${cannedResponseText}`, 'dialogue-entry npc-response');
            appState.addDialogueToHistory(profiledCharId, `${profiledChar.name}: ${cannedResponseText}`);
        } else {
            console.error("Could not find transcript area for active NPC:", profiledCharId);
        }
    },
    
    sendTopicToChat: function(topic) {
        const playerUtteranceElem = Utils.getElem('player-utterance');
        if (playerUtteranceElem) {
            playerUtteranceElem.value = topic;
            playerUtteranceElem.focus();
        }
    },

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

document.addEventListener('DOMContentLoaded', App.initializeApp.bind(App));

// Global assignments for inline HTML onclick handlers
window.openTab = App.openTab;
window.handleToggleNpcInScene = App.handleToggleNpcInScene;
window.handleGenerateDialogue = App.handleGenerateDialogue; 
window.handleTogglePcSelection = App.handleTogglePcSelection; 
window.handleBackToDashboardOverview = App.handleBackToDashboardOverview; 
window.toggleAbilityExpansion = App.toggleAbilityExpansion; 
window.addSuggestedMemoryAsActual = App.addSuggestedMemoryAsActual; 
window.acceptFactionStandingChange = App.acceptFactionStandingChange;
window.useSpecificCannedResponse = App.useSpecificCannedResponse;
window.sendTopicToChat = App.sendTopicToChat;
// server/static/app.js

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
            if(typeof closeLoreDetailViewUI === 'function'){
                closeLoreDetailViewUI();
            }
        }
        if (tabName === 'tab-scene') {
            UIRenderers.renderNpcListForContextUI(
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
                UIRenderers.populateSceneContextSelectorUI();
                if (entrySelector) entrySelector.value = ""; 
                appState.setCurrentSceneContextFilter(null); 
                 UIRenderers.renderNpcListForContextUI(
                    Utils.getElem('character-list-scene-tab'),
                    appState.getAllCharacters(),
                    appState.activeSceneNpcIds,
                    App.handleToggleNpcInScene, 
                    CharacterService.handleSelectCharacterForDetails,
                    null 
                );
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
                UIRenderers.renderNpcListForContextUI(
                    Utils.getElem('character-list-scene-tab'),
                    appState.getAllCharacters(),
                    appState.activeSceneNpcIds,
                    App.handleToggleNpcInScene, 
                    CharacterService.handleSelectCharacterForDetails,
                    appState.getCurrentSceneContextFilter()
                );
            });
        }
        UIRenderers.renderNpcListForContextUI(
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
                        UIRenderers.renderDetailedPcSheetUI(pcData, Utils.getElem('pc-dashboard-content'));
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
            dialogueInterfaceElem.style.display = 'block';
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
                UIRenderers.updatePcDashboardUI(dashboardContent, appState.getAllCharacters(), appState.activePcIds, appState.getExpandedAbility());
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
        // Get other NPCs who are already in the scene BEFORE adding the new one
        const otherNpcIds = appState.getActiveNpcIds();

        appState.addActiveNpc(npcIdStr);
        UIRenderers.createNpcDialogueAreaUI(npcIdStr, npcName, multiNpcContainer);
        appState.initDialogueHistory(npcIdStr);

        const toggledNpc = appState.getCharacterById(npcIdStr);
        const sceneContext = Utils.getElem('scene-context').value.trim();
        const activePcNames = appState.getActivePcIds().map(pcId => appState.getCharacterById(pcId)?.name || "a PC");

        // 1. Tell the NEW NPC about everyone else who is already there.
        const otherNpcNames = otherNpcIds.map(id => appState.getCharacterById(id)?.name || "another NPC");
        const allPresentNames = [...activePcNames, ...otherNpcNames];
        
        let greetingUtterance;
        if (allPresentNames.length > 0) {
            greetingUtterance = `(System Directive: You are ${toggledNpc.name}. You have just become aware of ${allPresentNames.join(', ')} in the scene. Greet them or offer an initial reaction in character.)`;
        } else {
            greetingUtterance = `(System Directive: You are ${toggledNpc.name}. Describe your arrival or what you are doing upon entering the scene.)`;
        }
        
        const greetingPayload = {
            scene_context: sceneContext,
            player_utterance: greetingUtterance,
            active_pcs: activePcNames,
            speaking_pc_id: currentSpeakingPcId,
            recent_dialogue_history: []
        };
        setTimeout(() => App.triggerNpcInteraction(npcIdStr, npcName, greetingPayload, true, `thinking-${npcIdStr}-greeting`), 100);

        // 2. Tell all OTHER existing NPCs about the NEW arrival.
        otherNpcIds.forEach(existingNpcId => {
            const existingNpc = appState.getCharacterById(existingNpcId);
            if (existingNpc) {
                const reactionPayload = {
                    scene_context: sceneContext,
                    player_utterance: `(System Directive: ${npcName} has just entered the scene. React to their arrival in character.)`,
                    active_pcs: activePcNames,
                    speaking_pc_id: null, // Event is from the DM/scene
                    recent_dialogue_history: appState.getRecentDialogueHistory(existingNpcId, 10)
                };
                const transcriptArea = Utils.getElem(`transcript-${existingNpcId}`);
                if (transcriptArea) {
                    const thinkingEntry = document.createElement('p');
                    thinkingEntry.className = 'scene-event';
                    thinkingEntry.id = `thinking-${existingNpcId}-reaction`;
                    thinkingEntry.textContent = `${existingNpc.name} notices ${npcName}...`;
                    transcriptArea.appendChild(thinkingEntry);
                    transcriptArea.scrollTop = transcriptArea.scrollHeight;
                }
                setTimeout(() => App.triggerNpcInteraction(existingNpcId, existingNpc.name, reactionPayload, false, `thinking-${existingNpcId}-reaction`), 200);
            }
        });

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

    UIRenderers.renderNpcListForContextUI(
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

            UIRenderers.appendMessageToTranscriptUI(transcriptArea, `${npcName}: ${result.npc_dialogue}`, 'dialogue-entry npc-response');
            appState.addDialogueToHistory(npcIdStr, `${npcName}: ${result.npc_dialogue}`);
            
            // Set this NPC as the one we're seeing suggestions for.
            appState.setCurrentProfileCharId(npcIdStr); 
            const interactingChar = appState.getCharacterById(npcIdStr);
            if (interactingChar) {
                appState.setCannedResponsesForProfiledChar(interactingChar.canned_conversations || {});
            }
            appState.lastAiResultForProfiledChar = result;

            UIRenderers.renderSuggestionsArea(result, npcIdStr);
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

    // --- FIX: Determine who is listening ---
    const listeningNpcIds = activeNpcIds.filter(id => id !== speakerId);

    // Display the utterance in all appropriate transcripts
    activeNpcIds.forEach(npcId => {
        const transcriptArea = Utils.getElem(`transcript-${npcId}`);
        if (transcriptArea) {
            // An NPC's own speech should appear as an 'npc-response', not a 'player-utterance'
            const messageClass = (isSpeakerAnNpc && speakerId === npcId) ? 'dialogue-entry npc-response' : 'dialogue-entry player-utterance';
            UIRenderers.appendMessageToTranscriptUI(transcriptArea, `${speakerDisplayName}: ${playerUtterance}`, messageClass);
            appState.addDialogueToHistory(npcId, `${speakerDisplayName}: ${playerUtterance}`);
        }
    });

    // Show "thinking" message only for listening NPCs
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

    // --- FIX: Only listening NPCs generate a response ---
    const dialoguePromises = listeningNpcIds.map(npcId => {
        const npc = appState.getCharacterById(npcId);
        if (!npc) return Promise.resolve();

        const payload = {
            scene_context: sceneContext,
            player_utterance: playerUtterance,
            active_pcs: activePcsNames,
            speaking_pc_id: speakerId, // This can now be an NPC ID
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
        UIRenderers.renderPcListUI(
            Utils.getElem('active-pc-list'), 
            Utils.getElem('speaking-pc-select'), 
            appState.getAllCharacters(), 
            appState.activePcIds, 
            App.handleTogglePcSelection,
            appState.activeSceneNpcIds // Add this argument
        );
        App.updateMainView();

        const currentProfileChar = appState.getCurrentProfileChar();
        if (currentProfileChar && currentProfileChar.character_type === 'NPC') {
            UIRenderers.renderNpcFactionStandingsUI(currentProfileChar, appState.activePcIds, appState.getAllCharacters(), Utils.getElem('npc-faction-standings-content'), CharacterService.handleSaveFactionStanding);
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
        UIRenderers.updatePcDashboardUI(Utils.getElem('pc-dashboard-content'), appState.getAllCharacters(), appState.activePcIds, appState.getExpandedAbility());
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
                    UIRenderers.renderMemoriesUI(charToUpdate.memories, Utils.getElem('character-memories-list'), CharacterService.handleDeleteMemory);
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

    cycleCannedResponse: function(direction) {
        const keys = Object.keys(appState.cannedResponsesForProfiledChar);
        if (keys.length === 0) return;

        let newIndex = appState.currentCannedResponseIndex + direction;

        if (newIndex < 0) newIndex = 0;
        if (newIndex >= keys.length) newIndex = keys.length - 1;

        appState.currentCannedResponseIndex = newIndex;
        UIRenderers.renderSuggestionsArea(appState.lastAiResultForProfiledChar, appState.getCurrentProfileCharId());
    },

    useCannedResponse: async function() {
    const profiledCharId = appState.getCurrentProfileCharId();
    if (!profiledCharId) return;

    if (!appState.hasActiveNpc(profiledCharId)) {
        alert("The profiled NPC must be in the current scene to use a canned response.");
        return;
    }

    const profiledChar = appState.getCharacterById(profiledCharId);
    if (!profiledChar) return;

    const keys = Object.keys(appState.cannedResponsesForProfiledChar);
    if (keys.length === 0) return;

    const currentKey = keys[appState.currentCannedResponseIndex];
    const cannedResponseText = appState.cannedResponsesForProfiledChar[currentKey];
    if (!cannedResponseText) return;

    // 1. Append the canned response directly to the NPC's transcript
    const transcriptArea = Utils.getElem(`transcript-${profiledCharId}`);
    if (transcriptArea) {
        UIRenderers.appendMessageToTranscriptUI(transcriptArea, `${profiledChar.name}: ${cannedResponseText}`, 'dialogue-entry npc-response');
        appState.addDialogueToHistory(profiledCharId, `${profiledChar.name}: ${cannedResponseText}`);
    } else {
        console.error("Could not find transcript area for active NPC:", profiledCharId);
        return;
    }

    // 2. Trigger all other NPCs to react to the canned statement
    const sceneContext = Utils.getElem('scene-context').value.trim();
    const activePcNames = appState.getActivePcIds().map(id => appState.getCharacterById(id)?.name).filter(name => name);
    const otherNpcIds = appState.getActiveNpcIds().filter(id => id !== profiledCharId);

    const reactionPromises = otherNpcIds.map(otherNpcId => {
        const otherNpc = appState.getCharacterById(otherNpcId);
        if (otherNpc) {
            const otherTranscriptArea = Utils.getElem(`transcript-${otherNpcId}`);
            if (otherTranscriptArea) {
                const thinkingEntry = document.createElement('p');
                thinkingEntry.className = 'scene-event';
                thinkingEntry.id = `thinking-${otherNpcId}-canned-reaction`;
                thinkingEntry.textContent = `${otherNpc.name} is formulating a response...`;
                otherTranscriptArea.appendChild(thinkingEntry);
                otherTranscriptArea.scrollTop = otherTranscriptArea.scrollHeight;
            }

            const payload = {
                scene_context: sceneContext,
                player_utterance: `(System Directive: ${profiledChar.name} just said, "${cannedResponseText}". React to this statement in character.)`,
                active_pcs: activePcNames,
                speaking_pc_id: null, // NPC to NPC interaction
                recent_dialogue_history: appState.getRecentDialogueHistory(otherNpcId, 10)
            };
            return App.triggerNpcInteraction(otherNpcId, otherNpc.name, payload, false, `thinking-${otherNpcId}-canned-reaction`);
        }
        return Promise.resolve();
    });

    await Promise.all(reactionPromises);
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

window.openTab = App.openTab;
window.handleToggleNpcInScene = App.handleToggleNpcInScene;
window.handleGenerateDialogue = App.handleGenerateDialogue; 
window.handleTogglePcSelection = App.handleTogglePcSelection; 
window.handleBackToDashboardOverview = App.handleBackToDashboardOverview; 
window.toggleAbilityExpansion = App.toggleAbilityExpansion; 
window.addSuggestedMemoryAsActual = App.addSuggestedMemoryAsActual; 
window.acceptFactionStandingChange = App.acceptFactionStandingChange;
window.cycleCannedResponse = App.cycleCannedResponse;
window.useCannedResponse = App.useCannedResponse;
window.sendTopicToChat = App.sendTopicToChat;
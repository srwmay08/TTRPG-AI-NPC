// static/app.js

var App = {
    initializeApp: async function() {
        console.log("App.js: DOMContentLoaded event fired. Initializing App...");
        try {
            await CharacterService.initializeAppCharacters();

            EventHandlers.setupResizer();
            EventHandlers.setupCollapsibleSections(); // This sets up dashboard card clicks too
            EventHandlers.assignButtonEventHandlers(); 
            this.setupTabControls(); 
            this.setupSceneContextSelector();
            // setupDashboardClickHandlers might be redundant if setupCollapsibleSections handles it,
            // but explicit call ensures scene view cards are also handled if their structure differs.
            this.setupDashboardClickHandlers(); // Call to ensure all clickable cards are handled

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
            // Attempt to load/re-render profile even if it was previously an error
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
        // ... (previous implementation)
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
        // ... (previous implementation)
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
                    this.handleToggleNpcInScene, 
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
                    this.handleToggleNpcInScene, 
                    CharacterService.handleSelectCharacterForDetails,
                    appState.getCurrentSceneContextFilter()
                );
            });
        }
    },

    setupDashboardClickHandlers: function() {
        // This function ensures click handlers are set for PC cards in *both* dashboard and scene views.
        // Event delegation is used on parent containers.

        const handleCardClick = (event) => {
            const clickedCard = event.target.closest('.clickable-pc-card');
            if (clickedCard) {
                const pcIdToRender = clickedCard.dataset.pcId;
                if (pcIdToRender) {
                    const pcData = appState.getCharacterById(pcIdToRender);
                    if (pcData) {
                        // Determine if we should switch to dashboard view or if already there
                        const pcDashboardView = Utils.getElem('pc-dashboard-view');
                        const dialogueInterface = Utils.getElem('dialogue-interface');
                        if (pcDashboardView.style.display === 'none') {
                            if(dialogueInterface) dialogueInterface.style.display = 'none';
                            pcDashboardView.style.display = 'block';
                            // If switching views, also hide the scene's quick PC view
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
            // Remove existing listener to avoid duplicates if this function is called multiple times
            pcDashboardContent.removeEventListener('click', handleCardClick); 
            pcDashboardContent.addEventListener('click', handleCardClick);
        }

        const pcQuickViewInScene = Utils.getElem('pc-quick-view-section-in-scene');
        if (pcQuickViewInScene) {
            pcQuickViewInScene.removeEventListener('click', handleCardClick);
            pcQuickViewInScene.addEventListener('click', handleCardClick);
        }
    },
    
    // handlePcQuickViewCardClick is now effectively merged into setupDashboardClickHandlers's logic
    // If it were separate, it would look like this:
    // handlePcQuickViewCardClick: function(pcId) {
    //     const pcData = appState.getCharacterById(pcId);
    //     if (pcData) {
    //         const dialogueInterface = Utils.getElem('dialogue-interface');
    //         const pcDashboardView = Utils.getElem('pc-dashboard-view');
    //         const dashboardContent = Utils.getElem('pc-dashboard-content');

    //         if (dialogueInterface) dialogueInterface.style.display = 'none';
    //         if (pcDashboardView) pcDashboardView.style.display = 'block';
    //         // Hide the scene's quick PC view if it was clicked
    //         const pcQuickViewInSceneElem = Utils.getElem('pc-quick-view-section-in-scene');
    //         if(pcQuickViewInSceneElem) pcQuickViewInSceneElem.style.display = 'none';


    //         UIRenderers.renderDetailedPcSheetUI(pcData, dashboardContent);
    //     }
    // },

    updateMainView: function() {
        // ... (previous implementation, ensure it calls UIRenderers.updatePcDashboardUI correctly)
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
        // ... (previous implementation, ensure calls to UIRenderers, App, CharacterService are correct)
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
            App.handleToggleNpcInScene, 
            CharacterService.handleSelectCharacterForDetails,
            appState.getCurrentSceneContextFilter()
        );
        App.updateMainView();
    },

    triggerNpcInteraction: async function(npcIdStr, npcName, payload, isGreeting = false, thinkingMessageId = null) {
        // ... (previous implementation seems okay)
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
        // ... (previous implementation seems okay)
        const playerUtterance = Utils.getElem('player-utterance').value.trim();
        const sceneContext = Utils.getElem('scene-context').value.trim();
        const speakingPcSelect = Utils.getElem('speaking-pc-select');
        const speakingPcId = speakingPcSelect ? speakingPcSelect.value : null;

        if (!playerUtterance && !sceneContext.trim() && playerUtterance !== "") { 
            alert("Please enter player dialogue or ensure scene context is descriptive.");
            return;
        }
        Utils.disableBtn('generate-dialogue-btn', true);

        const activePcsNames = appState.getActivePcIds().map(id => appState.getCharacterById(id)?.name).filter(name => name);
        let speakerDisplayName = "Player";
        if (speakingPcId && speakingPcId !== "") {
            const pc = appState.getCharacterById(speakingPcId);
            if (pc) speakerDisplayName = pc.name;
        } else if (speakingPcId === "") {
            speakerDisplayName = "DM/Scene Event";
        }

        appState.getActiveNpcIds().forEach(npcId => {
            const transcriptArea = Utils.getElem(`transcript-${npcId}`);
            if (transcriptArea && playerUtterance) { 
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
            if (!npc) return Promise.resolve(); 

            const payload = {
                scene_context: sceneContext,
                player_utterance: playerUtterance,
                active_pcs: activePcsNames,
                speaking_pc_id: speakingPcId,
                recent_dialogue_history: appState.getRecentDialogueHistory(npcId, 10) 
            };
            return App.triggerNpcInteraction(npcId, npc.name, payload, false, `thinking-${npcId}-main`);
        });

        await Promise.all(dialoguePromises);

        if (playerUtterance) Utils.getElem('player-utterance').value = ''; 
        Utils.disableBtn('generate-dialogue-btn', false);
    },

    handleTogglePcSelection: function(pcIdStr) {
        // ... (previous implementation seems okay, ensure handleSaveFactionStanding is global or App.handleSaveFactionStanding)
        appState.toggleActivePc(pcIdStr);
        UIRenderers.renderPcListUI(Utils.getElem('active-pc-list'), Utils.getElem('speaking-pc-select'), appState.getAllCharacters(), appState.activePcIds, App.handleTogglePcSelection);
        App.updateMainView();

        const currentProfileChar = appState.getCurrentProfileChar();
        if (currentProfileChar && currentProfileChar.character_type === 'NPC') {
            UIRenderers.renderNpcFactionStandingsUI(currentProfileChar, appState.activePcIds, appState.getAllCharacters(), Utils.getElem('npc-faction-standings-content'), handleSaveFactionStanding); // handleSaveFactionStanding from window
        }
    },

    handleBackToDashboardOverview: function() {
        // ... (previous implementation seems okay)
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
        // ... (previous implementation seems okay)
        const currentAbility = appState.getExpandedAbility();
        if (currentAbility === ablKey) {
            appState.setExpandedAbility(null);
        } else {
            appState.setExpandedAbility(ablKey);
            appState.setExpandedSkill(null); 
        }
        UIRenderers.updatePcDashboardUI(Utils.getElem('pc-dashboard-content'), appState.getAllCharacters(), appState.activePcIds, appState.getExpandedAbility(), appState.getExpandedSkill(), appState.getSkillSortKey());
    },

    toggleSkillExpansion: function(skillKey) {
        // ... (previous implementation seems okay)
        const currentSkill = appState.getExpandedSkill();
        if (currentSkill === skillKey) {
            appState.setExpandedSkill(null);
            appState.setSkillSortKey(null);
        } else {
            appState.setExpandedSkill(skillKey);
            appState.setSkillSortKey(skillKey); 
            appState.setExpandedAbility(null); 
        }
        UIRenderers.updatePcDashboardUI(Utils.getElem('pc-dashboard-content'), appState.getAllCharacters(), appState.activePcIds, appState.getExpandedAbility(), appState.getExpandedSkill(), appState.getSkillSortKey());
    },

    addSuggestedMemoryAsActual: async function(npcId, memoryContent) {
        // ... (previous implementation, ensure handleDeleteMemory is global or App.handleDeleteMemory)
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
                    UIRenderers.renderMemoriesUI(charToUpdate.memories, Utils.getElem('character-memories-list'), handleDeleteMemory); // handleDeleteMemory from window
                }
            }
            alert(`Suggested memory added to ${character.name}.`);
        } catch (error) {
            console.error("App.js: Error adding suggested memory:", error);
            alert("Error adding suggested memory: " + error.message);
        }
    },

    acceptFactionStandingChange: async function(npcIdToUpdate, pcTargetId, newStanding) {
        // ... (previous implementation, ensure handleSaveFactionStanding is global or App.handleSaveFactionStanding)
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
            await handleSaveFactionStanding(npcIdToUpdate, pcTargetId, newStanding); // handleSaveFactionStanding from window
        }
    },

    // These are assigned from CharacterService for direct calls if needed,
    // but eventHandlers.js should be calling CharacterService.method directly.
    // This is more of a fallback or for potential direct HTML calls to App.method.
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

// Ensure 'this' context for initializeApp when called by DOMContentLoaded
document.addEventListener('DOMContentLoaded', App.initializeApp.bind(App));

// Expose to window ONLY those functions directly called by HTML onclick attributes
window.openTab = App.openTab;
window.handleToggleNpcInScene = App.handleToggleNpcInScene;
window.handleGenerateDialogue = App.handleGenerateDialogue; 
window.handleTogglePcSelection = App.handleTogglePcSelection; 
window.handleBackToDashboardOverview = App.handleBackToDashboardOverview; 
window.toggleAbilityExpansion = App.toggleAbilityExpansion; 
window.toggleSkillExpansion = App.toggleSkillExpansion; 
window.addSuggestedMemoryAsActual = App.addSuggestedMemoryAsActual; 
window.acceptFactionStandingChange = App.acceptFactionStandingChange;

// Functions from CharacterService are re-exported globally in characterService.js
// for callbacks. If HTML directly calls window.handleSomeCharacterServiceMethod(),
// those explicit assignments in characterService.js will handle it.

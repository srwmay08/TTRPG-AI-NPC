/* server/static/app.js */
// Responsibility: Main application logic and event orchestration.

// Compatibility helper: Ensure AppState/appState are interchangeable
if (typeof AppState === 'undefined' && typeof appState !== 'undefined') {
    window.AppState = appState;
} else if (typeof appState === 'undefined' && typeof AppState !== 'undefined') {
    window.appState = AppState;
}

var App = {
    initializeApp: async function() {
        console.log("App.js: DOMContentLoaded event fired. Initializing App...");
        try {
            // Initialize State defaults if needed
            if (!AppState.currentView) AppState.currentView = 'scene';

            await CharacterService.initializeAppCharacters();

            // Setup Layout & Global Handlers
            this.setupResizer(); 
            if (window.EventHandlers && EventHandlers.setupCollapsibleSections) {
                EventHandlers.setupCollapsibleSections();
            }
            if (window.EventHandlers && EventHandlers.assignButtonEventHandlers) {
                EventHandlers.assignButtonEventHandlers();
            }

            this.setupTabControls(); 
            this.setupSceneContextSelector();
            this.setupDashboardClickHandlers();

            const dashboardView = document.getElementById('pc-dashboard-view');
            if (dashboardView) {
                dashboardView.addEventListener('change', (event) => {
                    if (event.target.classList.contains('attack-selector')) {
                        const pcId = event.target.dataset.pcId;
                        const attackName = event.target.dataset.attackName;
                        if (AppState.toggleAttackSelection) AppState.toggleAttackSelection(pcId, attackName);
                        this.updateMainView();
                    } else if (event.target.id === 'round-count-input') {
                        AppState.estimatedRounds = parseInt(event.target.value, 10) || 1;
                        this.updateMainView();
                    } else if (event.target.id === 'dpr-ac-input') {
                         const newAC = parseInt(event.target.value, 10);
                        if (!isNaN(newAC)) {
                            AppState.targetAC = newAC;
                            this.updateMainView();
                        }
                    }
                });
            }

            // Initial View Update
            setTimeout(() => this.updateMainView(), 0); 

        } catch (e) {
            console.error("App.js: Error during initial app setup:", e);
        }
        console.log("App.js: DOMContentLoaded finished.");
    },

    // --- Layout Helpers ---
    setupResizer: function() {
        const resizer = document.getElementById('resizer');
        const leftCol = document.getElementById('left-column');
        if (!resizer || !leftCol) return;

        let isResizing = false;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            resizer.classList.add('active');
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            let newWidth = e.clientX;
            if (newWidth < 200) newWidth = 200;
            if (newWidth > window.innerWidth * 0.6) newWidth = window.innerWidth * 0.6;
            leftCol.style.width = `${newWidth}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
                resizer.classList.remove('active');
            }
        });
    },

    // --- Tab & View Logic ---
    openTab: function(event, tabName) { 
        if (window.openTab) {
            const tabContents = document.querySelectorAll('.tab-content');
            tabContents.forEach(tab => {
                tab.style.display = 'none';
                tab.classList.remove('active-tab');
            });
            
            const tabLinks = document.querySelectorAll('.tab-link');
            tabLinks.forEach(link => link.classList.remove('active'));

            const target = document.getElementById(tabName);
            if (target) {
                target.style.display = 'block';
                target.classList.add('active-tab');
            }
            if (event && event.currentTarget) {
                event.currentTarget.classList.add('active');
            }
        }

        if (tabName === 'tab-npcs') {
            const currentProfileId = AppState.getCurrentProfileCharId();
            CharacterService.handleSelectCharacterForDetails(currentProfileId);
        }
        if (tabName === 'tab-lore' && !AppState.getCurrentLoreEntryId()) {
            if(window.LoreRenderers && typeof LoreRenderers.closeLoreDetailViewUI === 'function'){
                LoreRenderers.closeLoreDetailViewUI();
            }
        }
        if (tabName === 'tab-scene') {
            AppState.currentView = 'scene';
            this.updateMainView();
            
            if (window.NPCRenderers) {
                NPCRenderers.renderNpcListForContextUI(
                    document.getElementById('character-list-scene-tab'),
                    AppState.getAllCharacters(),
                    AppState.activeSceneNpcIds,
                    this.handleToggleNpcInScene, 
                    CharacterService.handleSelectCharacterForDetails,
                    AppState.getCurrentSceneContextFilter()
                );
            }
        }
    },

    setupTabControls: function() {
        const tabLinks = document.querySelectorAll('#left-column-header .tabs .tab-link');
        if (tabLinks.length > 0) {
            const sceneTabButton = Array.from(tabLinks).find(link => {
                const onclickAttr = link.getAttribute('onclick');
                return onclickAttr && onclickAttr.includes("'tab-scene'");
            });
            if (sceneTabButton) sceneTabButton.click(); 
            else tabLinks[0].click(); 
        }
    },

    setupSceneContextSelector: function() {
        const typeSelector = document.getElementById('scene-context-type-filter');
        const entrySelector = document.getElementById('scene-context-selector');

        if (typeSelector) {
            typeSelector.addEventListener('change', () => { 
                if (window.LoreRenderers) LoreRenderers.populateSceneContextSelectorUI();
                if (entrySelector) entrySelector.value = ""; 
                AppState.setCurrentSceneContextFilter(null); 
                
                if (window.NPCRenderers) {
                    NPCRenderers.renderNpcListForContextUI(
                        document.getElementById('character-list-scene-tab'),
                        AppState.getAllCharacters(),
                        AppState.activeSceneNpcIds,
                        App.handleToggleNpcInScene, 
                        CharacterService.handleSelectCharacterForDetails,
                        null 
                    );
                }
                this.updateMainView();
            });
        }

        if (entrySelector) {
            entrySelector.addEventListener('change', (event) => { 
                const selectedLoreId = event.target.value;
                if (selectedLoreId) {
                    AppState.setCurrentSceneContextFilter({ type: 'lore', id: selectedLoreId });
                } else {
                    AppState.setCurrentSceneContextFilter(null);
                }
                
                if (window.NPCRenderers) {
                    NPCRenderers.renderNpcListForContextUI(
                        document.getElementById('character-list-scene-tab'),
                        AppState.getAllCharacters(),
                        AppState.activeSceneNpcIds,
                        App.handleToggleNpcInScene, 
                        CharacterService.handleSelectCharacterForDetails,
                        AppState.getCurrentSceneContextFilter()
                    );
                }
                this.updateMainView();
            });
        }
    },

    setupDashboardClickHandlers: function() {
        const dashboard = document.getElementById('pc-dashboard-view');
        if (dashboard) {
            dashboard.addEventListener('click', (e) => {
                // Delegate clicks if needed
            });
        }
    },
    
    // --- CORE UPDATE FUNCTION ---
    updateMainView: function() {
        console.log("App.js: App.updateMainView called.");
        if (window.MainView && MainView.update) {
            MainView.update(); 
        } else {
            console.error("MainView.update is missing!");
        }
        console.log("App.js: App.updateMainView finished.");
    },

    // --- Interaction Logic ---

    handleToggleNpcInScene: async function(npcIdStr, npcName) {
        const multiNpcContainer = document.getElementById('multi-npc-dialogue-container');
        if (!multiNpcContainer) return;
    
        const isAdding = !AppState.hasActiveNpc(npcIdStr);
    
        if (isAdding) {
            AppState.addActiveNpc(npcIdStr);
            const toggledNpc = AppState.getCharacterById(npcIdStr);
            if (!toggledNpc) {
                AppState.removeActiveNpc(npcIdStr);
                return;
            }
    
            if (window.NPCRenderers) NPCRenderers.createNpcDialogueAreaUI(toggledNpc, multiNpcContainer);
            AppState.initDialogueHistory(npcIdStr);
            
            // Generate Greeting Logic
            const intro = toggledNpc.canned_conversations?.introduction;
            const sceneContext = document.getElementById('scene-context') ? document.getElementById('scene-context').value.trim() : "";
            const activePcNames = AppState.getActivePcIds().map(pcId => AppState.getCharacterById(pcId)?.name || "a PC");
            const speakingPcSelect = document.getElementById('speaking-pc-select');
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
            AppState.removeActiveNpc(npcIdStr);
            if (window.NPCRenderers) NPCRenderers.removeNpcDialogueAreaUI(npcIdStr, multiNpcContainer);
            AppState.deleteDialogueHistory(npcIdStr);
        }
    
        const placeholderEvent = multiNpcContainer.querySelector('p.scene-event');
        if (AppState.getActiveNpcCount() > 0 && placeholderEvent) {
            placeholderEvent.remove();
        } else if (AppState.getActiveNpcCount() === 0 && !placeholderEvent) {
            multiNpcContainer.innerHTML = '<p class="scene-event">Select NPCs from the SCENE tab to add them to the interaction.</p>';
        }
    
        if (window.NPCRenderers) {
            NPCRenderers.renderNpcListForContextUI(
                document.getElementById('character-list-scene-tab'),
                AppState.getAllCharacters(),
                AppState.activeSceneNpcIds,
                App.handleToggleNpcInScene,
                CharacterService.handleSelectCharacterForDetails,
                AppState.getCurrentSceneContextFilter()
            );
        }
        App.updateMainView();
    },

    triggerNpcInteraction: async function(npcIdStr, npcName, payload, isGreeting = false, thinkingMessageId = null) {
        const transcriptArea = document.getElementById(`transcript-${npcIdStr}`);
        if (!transcriptArea) return;

        let thinkingMessageElement = thinkingMessageId ? document.getElementById(thinkingMessageId) : null;

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

            if (window.NPCRenderers) {
                NPCRenderers.appendMessageToTranscriptUI(transcriptArea, `${npcName}: ${result.npc_dialogue}`, 'dialogue-entry npc-response');
                NPCRenderers.renderSuggestionsArea(result, npcIdStr);
            }
            AppState.addDialogueToHistory(npcIdStr, `${npcName}: ${result.npc_dialogue}`);
            
            AppState.setCurrentProfileCharId(npcIdStr); 
            const interactingChar = AppState.getCharacterById(npcIdStr);
            if (interactingChar) {
                AppState.setCannedResponsesForProfiledChar(interactingChar.canned_conversations || {});
            }
            AppState.lastAiResultForProfiledChar = result;

        } catch (error) {
            console.error(`Error generating dialogue for ${npcName}:`, error);
            if(thinkingMessageElement && thinkingMessageElement.parentNode) thinkingMessageElement.remove();
            if (window.NPCRenderers) {
                NPCRenderers.appendMessageToTranscriptUI(transcriptArea, `${npcName}: (Error: ${error.message})`, 'dialogue-entry npc-response');
            }
            AppState.addDialogueToHistory(npcIdStr, `${npcName}: (Error generating dialogue)`);
        }
        transcriptArea.scrollTop = transcriptArea.scrollHeight;
    },

    handleGenerateDialogue: async function() {
        const playerUtterance = document.getElementById('player-utterance').value.trim();
        const sceneContext = document.getElementById('scene-context') ? document.getElementById('scene-context').value.trim() : "";
        const speakingPcSelect = document.getElementById('speaking-pc-select');
        const speakerId = speakingPcSelect ? speakingPcSelect.value : null;

        if (!playerUtterance) {
            alert("Please enter player dialogue to send to the NPCs.");
            return;
        }
        Utils.disableBtn('generate-dialogue-btn', true);

        const speaker = AppState.getCharacterById(speakerId);
        const speakerDisplayName = speaker ? speaker.name : "DM/Scene Event";
        const isSpeakerAnNpc = speaker && speaker.character_type === 'NPC';

        const activeNpcIds = AppState.getActiveNpcIds();
        const activePcsNames = AppState.getActivePcIds().map(id => AppState.getCharacterById(id)?.name).filter(name => name);

        const listeningNpcIds = activeNpcIds.filter(id => id !== speakerId);

        activeNpcIds.forEach(npcId => {
            const transcriptArea = document.getElementById(`transcript-${npcId}`);
            if (transcriptArea && window.NPCRenderers) {
                const messageClass = (isSpeakerAnNpc && speakerId === npcId) ? 'dialogue-entry npc-response' : 'dialogue-entry player-utterance';
                NPCRenderers.appendMessageToTranscriptUI(transcriptArea, `${speakerDisplayName}: ${playerUtterance}`, messageClass);
                AppState.addDialogueToHistory(npcId, `${speakerDisplayName}: ${playerUtterance}`);
            }
        });

        listeningNpcIds.forEach(npcId => {
            const npc = AppState.getCharacterById(npcId);
            const transcriptArea = document.getElementById(`transcript-${npcId}`);
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
            const npc = AppState.getCharacterById(npcId);
            if (!npc) return Promise.resolve();

            const payload = {
                scene_context: sceneContext,
                player_utterance: playerUtterance,
                active_pcs: activePcsNames,
                speaking_pc_id: speakerId,
                recent_dialogue_history: AppState.getRecentDialogueHistory(npcId, 10)
            };
            return App.triggerNpcInteraction(npcId, npc.name, payload, false, `thinking-${npcId}-main`);
        });

        await Promise.all(dialoguePromises);

        if (playerUtterance) document.getElementById('player-utterance').value = '';
        Utils.disableBtn('generate-dialogue-btn', false);
    },

    handleTogglePcSelection: function(pcIdStr) {
        // 1. Update State
        AppState.toggleActivePc(pcIdStr);
        AppState.currentView = 'pc'; 
        
        // 2. Refresh PC Lists
        if (window.PCRenderers) {
            // FIX: Check for both 'Player Character' AND 'PC' to match your database
            const allPcs = AppState.getAllCharacters().filter(c => c.type === 'Player Character' || c.character_type === 'Player Character' || c.character_type === 'PC');
            PCRenderers.renderPcListUI(allPcs);
        }

        // 3. Update Speaking Dropdown
        const select = document.getElementById('speaking-pc-select');
        if (select) {
            const currentVal = select.value;
            select.innerHTML = '<option value="">-- DM/Scene Event --</option>';
            AppState.activePcIds.forEach(id => {
                const pc = AppState.getCharacterById(id);
                if (pc) {
                    const opt = document.createElement('option');
                    opt.value = pc.id;
                    opt.textContent = pc.name;
                    select.appendChild(opt);
                }
            });
            // FIX: activePcIds is a Set, so use .has()
            if (AppState.activePcIds.has(currentVal)) select.value = currentVal;
        }

        // 4. Update Main View
        App.updateMainView();

        // 5. Update Faction Standings
        const currentProfileChar = AppState.getCurrentProfileChar();
        if (currentProfileChar && currentProfileChar.character_type === 'NPC' && window.NPCRenderers) {
            NPCRenderers.renderNpcFactionStandingsUI(currentProfileChar, AppState.activePcIds, AppState.getAllCharacters(), document.getElementById('npc-faction-standings-content'), CharacterService.handleSaveFactionStanding);
        }
    },

    handleBackToDashboardOverview: function() {
        const dashboardContent = document.getElementById('pc-dashboard-content');
        if (dashboardContent) {
            const detailedSheet = dashboardContent.querySelector('.detailed-pc-sheet');
            if (detailedSheet) detailedSheet.remove();
        }
        AppState.setExpandedAbility(null);
        App.updateMainView();
    },

    toggleAbilityExpansion: function(ablKey) {
        const currentAbility = AppState.getExpandedAbility();
        AppState.setExpandedAbility(currentAbility === ablKey ? null : ablKey);
        if(window.PCRenderers) {
            PCRenderers.updatePcDashboardUI(document.getElementById('pc-dashboard-content'), AppState.getAllCharacters(), AppState.activePcIds, AppState.getExpandedAbility());
        }
    },

    addSuggestedMemoryAsActual: async function(npcId, memoryContent) {
        if (!npcId || !memoryContent) return;
        const character = AppState.getCharacterById(npcId);
        if (!character || character.character_type !== 'NPC') {
            alert("Cannot add memory: Invalid NPC ID or character is not an NPC.");
            return;
        }
        try {
            const memoryData = { content: memoryContent, type: "AI_suggestion", source: "AI suggestion" };
            const response = await ApiService.addMemoryToNpc(npcId, memoryData);
            const charToUpdate = AppState.getCharacterById(npcId);
            if (charToUpdate && response.updated_memories) {
                charToUpdate.memories = response.updated_memories;
                AppState.updateCharacterInList(charToUpdate);
                if (AppState.getCurrentProfileCharId() === npcId && window.NPCRenderers) {
                    NPCRenderers.renderMemoriesUI(charToUpdate.memories, document.getElementById('character-memories-list'), CharacterService.handleDeleteMemory);
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
        const npc = AppState.getCharacterById(npcIdToUpdate);
        const pc = AppState.getCharacterById(pcTargetId);
        if (!npc || !pc) {
            alert("NPC or PC not found for faction standing update.");
            return;
        }

        if (confirm(`Change ${npc.name}'s standing towards ${pc.name} to ${newStanding}?`)) {
            await CharacterService.handleSaveFactionStanding(npcIdToUpdate, pcTargetId, newStanding);
        }
    },

    useSpecificCannedResponse: function(topic) {
        const profiledCharId = AppState.getCurrentProfileCharId();
        if (!profiledCharId) return;

        if (!AppState.hasActiveNpc(profiledCharId)) {
            alert("The profiled NPC must be in the current scene to use a canned response.");
            return;
        }

        const profiledChar = AppState.getCharacterById(profiledCharId);
        if (!profiledChar) return;

        const cannedResponses = AppState.cannedResponsesForProfiledChar || {};
        const cannedResponseText = cannedResponses[topic];
        if (!cannedResponseText) {
            console.error(`Canned response for topic "${topic}" not found.`);
            return;
        }

        const transcriptArea = document.getElementById(`transcript-${profiledCharId}`);
        if (transcriptArea && window.NPCRenderers) {
            NPCRenderers.appendMessageToTranscriptUI(transcriptArea, `${profiledChar.name}: ${cannedResponseText}`, 'dialogue-entry npc-response');
            AppState.addDialogueToHistory(profiledCharId, `${profiledChar.name}: ${cannedResponseText}`);
        }
    },
    
    sendTopicToChat: function(topic) {
        const playerUtteranceElem = document.getElementById('player-utterance');
        if (playerUtteranceElem) {
            playerUtteranceElem.value = topic;
            playerUtteranceElem.focus();
        }
    },

    // Called when data is finished loading from CharacterService
    onCharactersLoaded: function() {
        console.log("App.js: Characters loaded.");
        if (AppState.characters) {
            // FIX: Robust check for 'PC' or 'Player Character'
            const pcs = AppState.characters.filter(c => 
                c.character_type === 'Player Character' || 
                c.character_type === 'PC' ||
                c.type === 'Player Character'
            );
            PCRenderers.renderPcListUI(pcs);
        }
    },

    // Mappings to Service Functions
    handleSaveGmNotes: function(a, b) { return CharacterService.handleSaveGmNotes(a, b); },
    handleAddMemory: function(a, b, c) { return CharacterService.handleAddMemory(a, b, c); },
    handleDeleteMemory: function(a, b) { return CharacterService.handleDeleteMemory(a, b); },
    handleSaveFactionStanding: function(a, b, c) { return CharacterService.handleSaveFactionStanding(a, b, c); },
    handleAssociateHistoryFile: function(a, b) { return CharacterService.handleAssociateHistoryFile(a, b); },
    handleDissociateHistoryFile: function(a, b) { return CharacterService.handleDissociateHistoryFile(a, b); },
    handleCharacterCreation: function(e) { return CharacterService.handleCharacterCreation(e); },
    handleCreateLoreEntry: function(e) { return CharacterService.handleCreateLoreEntry(e); },
    handleSelectLoreEntryForDetails: function(id) { return CharacterService.handleSelectLoreEntryForDetails(id); },
    handleUpdateLoreEntryGmNotes: function(id, notes) { return CharacterService.handleUpdateLoreEntryGmNotes(id, notes); },
    handleDeleteLoreEntry: function(id) { return CharacterService.handleDeleteLoreEntry(id); },
    handleLinkLoreToCharacter: function(loreId, charId) { return CharacterService.handleLinkLoreToCharacter(loreId, charId); },
    handleUnlinkLoreFromCharacter: function(loreId, charId) { return CharacterService.handleUnlinkLoreFromCharacter(loreId, charId); }
};

// Initialize
document.addEventListener('DOMContentLoaded', App.initializeApp.bind(App));

// Global Exports
window.App = App;
window.openTab = App.openTab.bind(App);
window.handleToggleNpcInScene = App.handleToggleNpcInScene.bind(App);
window.handleGenerateDialogue = App.handleGenerateDialogue.bind(App);
window.handleTogglePcSelection = App.handleTogglePcSelection.bind(App);
window.handleBackToDashboardOverview = App.handleBackToDashboardOverview.bind(App);
window.toggleAbilityExpansion = App.toggleAbilityExpansion.bind(App);
window.addSuggestedMemoryAsActual = App.addSuggestedMemoryAsActual.bind(App);
window.acceptFactionStandingChange = App.acceptFactionStandingChange.bind(App);
window.useSpecificCannedResponse = App.useSpecificCannedResponse.bind(App);
window.sendTopicToChat = App.sendTopicToChat.bind(App);
if (window.LoreRenderers) {
    window.closeLoreDetailViewUI = LoreRenderers.closeLoreDetailViewUI;
}
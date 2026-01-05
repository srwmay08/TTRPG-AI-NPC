/* server/static/main-view.js */
// Responsibility: Managing the main application view layout.

var MainView = { 
    // New Standard Name (Called by App.js)
    update: function() {
        // Gather necessary state
        const dialogueInterfaceElem = document.getElementById('dialogue-interface');
        const pcDashboardViewElem = document.getElementById('pc-dashboard-view');
        const pcQuickViewInSceneElem = document.getElementById('pc-quick-view-section-in-scene');
        const npcProfileViewElem = document.getElementById('npc-profile-view'); // Reused for Lore as well
        
        if (!dialogueInterfaceElem || !pcDashboardViewElem || !pcQuickViewInSceneElem || !npcProfileViewElem) return;

        // Use global state
        const activeNpcCount = window.AppState ? window.AppState.getActiveNpcCount() : 0;
        const currentView = window.AppState ? window.AppState.currentView : 'scene';

        // LOGIC:
        // 1. PC View
        // 2. NPC View
        // 3. Lore View (NEW)
        // 4. Scene View (Default)
        
        if (currentView === 'pc') {
            dialogueInterfaceElem.style.display = 'none';
            pcDashboardViewElem.style.display = 'block';
            npcProfileViewElem.style.display = 'none';
            pcQuickViewInSceneElem.style.display = 'none';
            
            // Render the dashboard content
            if (window.PCRenderers && window.AppState) {
                const activePc = window.AppState.activePc;
                PCRenderers.renderPcDashboard(activePc);
            }
            
        } else if (currentView === 'npc') {
            dialogueInterfaceElem.style.display = 'none';
            pcDashboardViewElem.style.display = 'none';
            npcProfileViewElem.style.display = 'block';
            pcQuickViewInSceneElem.style.display = 'none';
            
            // Content is rendered by NPCRenderers.renderCharacterProfileUI when selected
            
        } else if (currentView === 'lore') {
            // --- NEW: LORE VIEW ---
            dialogueInterfaceElem.style.display = 'none';
            pcDashboardViewElem.style.display = 'none';
            npcProfileViewElem.style.display = 'block'; // Reuse the right-column container
            pcQuickViewInSceneElem.style.display = 'none';

            // Render Lore Content
            if (window.LoreRenderers && window.AppState) {
                 const loreEntry = window.AppState.getLoreEntryById(window.AppState.getCurrentLoreEntryId());
                 LoreRenderers.renderLoreProfileUI(loreEntry);
            }

        } else {
            // Default: Scene View
            dialogueInterfaceElem.style.display = 'flex'; // Flex for layout
            pcDashboardViewElem.style.display = 'none';
            npcProfileViewElem.style.display = 'none';
            
            // Render the Quick View of PCs at the top of the scene
            if (window.PCRenderers && window.AppState) {
                const activePcsData = window.AppState.getAllCharacters().filter(char => window.AppState.hasActivePc(String(char._id)));
                PCRenderers.renderPcQuickViewInSceneUI(pcQuickViewInSceneElem, activePcsData);
            }
        }

        // Button state
        if (window.Utils) {
            Utils.disableBtn('generate-dialogue-btn', activeNpcCount === 0);
        }
    },

    // Alias for backward compatibility if older code calls it
    updateMainViewUI: function() {
        this.update();
    }
};
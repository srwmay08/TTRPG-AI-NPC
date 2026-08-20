/**
 * server/static/main-view.js
 * 
 * Responsibility: Managing the main application view layout and visibility toggling.
 * This module acts as the central router for the UI, determining which 
 * major components (PC Dashboard, NPC Profile, Lore View, or Scene) 
 * should be displayed based on the current global application state.
 */

var MainView = { 
    /**
     * Updates the DOM visibility states for the primary application sections.
     * Called whenever the global state changes (e.g., clicking a tab or selecting a character).
     */
    update: function() {
        // Gather necessary DOM elements responsible for major view states
        const dialogueInterfaceElem = document.getElementById('dialogue-interface');
        const pcDashboardViewElem = document.getElementById('pc-dashboard-view');
        const pcQuickViewInSceneElem = document.getElementById('pc-quick-view-section-in-scene');
        const npcProfileViewElem = document.getElementById('npc-profile-view'); // Reused for Lore as well
        
        // Fail gracefully if the DOM hasn't fully loaded yet
        if (!dialogueInterfaceElem || !pcDashboardViewElem || !pcQuickViewInSceneElem || !npcProfileViewElem) return;

        // Retrieve current context from the global AppState store
        const activeNpcCount = window.AppState ? window.AppState.getActiveNpcCount() : 0;
        const currentView = window.AppState ? window.AppState.currentView : 'scene';

        // View Routing Logic:
        // 1. PC View: Shows the detailed dashboard for player characters.
        // 2. NPC View: Shows the profile/stats/history for an NPC.
        // 3. Lore View: Reuses the NPC profile container to show worldbuilding details.
        // 4. Scene View: The default conversational UI.
        
        if (currentView === 'pc') {
            dialogueInterfaceElem.style.display = 'none';
            pcDashboardViewElem.style.display = 'block';
            npcProfileViewElem.style.display = 'none';
            pcQuickViewInSceneElem.style.display = 'none';
            
            // Delegate rendering of the dashboard content to the specific PC renderer
            if (window.PCRenderers && window.AppState) {
                const activePc = window.AppState.activePc;
                PCRenderers.renderPcDashboard(activePc);
            }
            
        } else if (currentView === 'npc') {
            dialogueInterfaceElem.style.display = 'none';
            pcDashboardViewElem.style.display = 'none';
            npcProfileViewElem.style.display = 'block';
            pcQuickViewInSceneElem.style.display = 'none';
            
            // Note: Content is rendered separately by NPCRenderers.renderCharacterProfileUI 
            // when the character is explicitly selected.
            
        } else if (currentView === 'lore') {
            dialogueInterfaceElem.style.display = 'none';
            pcDashboardViewElem.style.display = 'none';
            npcProfileViewElem.style.display = 'block'; // Reuse the right-column container for Lore
            pcQuickViewInSceneElem.style.display = 'none';

            // Delegate rendering of the Lore Content
            if (window.LoreRenderers && window.AppState) {
                 const loreEntry = window.AppState.getLoreEntryById(window.AppState.getCurrentLoreEntryId());
                 LoreRenderers.renderLoreProfileUI(loreEntry);
            }

        } else {
            // Default Fallback: Scene View (The active conversation panel)
            dialogueInterfaceElem.style.display = 'flex'; // Uses flex for the multi-NPC container layout
            pcDashboardViewElem.style.display = 'none';
            npcProfileViewElem.style.display = 'none';
            
            // Explicitly HIDE the old top-level PC Quick View box to avoid duplicating 
            // the PC inputs now that we have the dynamic bottom flex row.
            pcQuickViewInSceneElem.style.display = 'none';
        }

        // --- Interaction State Logic ---
        
        // Disable the legacy single-generate button if no NPCs are active in the scene
        if (window.Utils) {
            Utils.disableBtn('generate-dialogue-btn', activeNpcCount === 0);
        }
        
        // Disable the newly injected dynamic generate buttons from the flex row when no NPCs are active.
        // Also applies visual styling (opacity/cursor) to indicate disabled state.
        const dynamicBtns = document.querySelectorAll('.dynamic-generate-btn');
        dynamicBtns.forEach(btn => {
            btn.disabled = (activeNpcCount === 0);
            if (activeNpcCount === 0) {
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            } else {
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }
        });
    },

    /**
     * Alias for backward compatibility. 
     * Ensures older UI calls don't break after the refactor to standard naming conventions.
     */
    updateMainViewUI: function() {
        this.update();
    }
};
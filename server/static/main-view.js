/* server/static/main-view.js */
// Responsibility: Managing the main application view layout.

var MainView = { 
    // New Standard Name (Called by App.js)
    update: function() {
        // Gather necessary state
        const dialogueInterfaceElem = document.getElementById('dialogue-interface');
        const pcDashboardViewElem = document.getElementById('pc-dashboard-view');
        const pcQuickViewInSceneElem = document.getElementById('pc-quick-view-section-in-scene');
        const dashboardContent = document.getElementById('pc-dashboard-content');
        
        if (!dialogueInterfaceElem || !pcDashboardViewElem || !pcQuickViewInSceneElem) return;

        // Use global state
        const activeNpcCount = window.AppState ? window.AppState.getActiveNpcCount() : 0;
        const currentView = window.AppState ? window.AppState.currentView : 'scene';

        // LOGIC:
        // 1. If we are in "PC View" (clicked a PC in sidebar), show Dashboard.
        // 2. If we are in "Scene View" (clicked Scene tab), show Dialogue Interface.
        
        if (currentView === 'pc') {
            dialogueInterfaceElem.style.display = 'none';
            pcDashboardViewElem.style.display = 'block';
            pcQuickViewInSceneElem.style.display = 'none';
            
            // Render the dashboard content
            if (window.PCRenderers && window.AppState) {
                // If we have an active PC, render details, otherwise render overview
                const activePc = window.AppState.activePc;
                PCRenderers.renderPcDashboard(activePc);
            }
            
        } else {
            // Default: Scene View
            dialogueInterfaceElem.style.display = 'flex'; // Flex for layout
            pcDashboardViewElem.style.display = 'none';
            
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
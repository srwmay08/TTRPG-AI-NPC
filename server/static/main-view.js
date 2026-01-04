// static/main-view.js
// Responsibility: Managing the main application view layout.

var MainView = { // Changed to var for consistency with other files, or could be const.
    updateMainViewUI: function(dialogueInterfaceElem, pcDashboardViewElem, pcQuickViewInSceneElem, activeNpcCount, showPcDashboard) {
        if (!dialogueInterfaceElem || !pcDashboardViewElem || !pcQuickViewInSceneElem) { return; }
        const dashboardContent = Utils.getElem('pc-dashboard-content');
        const isDetailedSheetVisible = dashboardContent && dashboardContent.querySelector('.detailed-pc-sheet');

        if (activeNpcCount > 0 && !isDetailedSheetVisible) {
            dialogueInterfaceElem.style.display = 'block';
            pcDashboardViewElem.style.display = 'none';
            const activePcsData = appState.getAllCharacters().filter(char => appState.hasActivePc(String(char._id)));
            // Updated to use PCRenderers
            PCRenderers.renderPcQuickViewInSceneUI(pcQuickViewInSceneElem, activePcsData);
        } else if (isDetailedSheetVisible) {
            dialogueInterfaceElem.style.display = 'none';
            pcDashboardViewElem.style.display = 'block';
            pcQuickViewInSceneElem.style.display = 'none';
            pcQuickViewInSceneElem.innerHTML = '';
        } else {
            dialogueInterfaceElem.style.display = 'none';
            pcDashboardViewElem.style.display = 'block';
            pcQuickViewInSceneElem.style.display = 'none';
            pcQuickViewInSceneElem.innerHTML = '';

            if (dashboardContent) {
                if (showPcDashboard) {
                    // Updated to use PCRenderers
                    PCRenderers.updatePcDashboardUI(dashboardContent, appState.getAllCharacters(), appState.activePcIds, appState.getExpandedAbility());
                } else {
                    dashboardContent.innerHTML = `<p class="pc-dashboard-no-selection">Select Player Characters from the left panel to view their details and comparisons.</p>`;
                }
            }
        }
        Utils.disableBtn('generate-dialogue-btn', activeNpcCount === 0);
    }
};
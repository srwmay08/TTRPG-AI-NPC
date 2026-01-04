// static/uiRenderers.js
// This file is now largely refactored into pc-renderers.js, npc-renderers.js, lore-renderers.js, and ui-widgets.js.
// Any remaining global functions or shared logic that doesn't fit elsewhere could reside here.
// For now, it serves as a placeholder.

// Removing the large ABILITY_SCORE_INFO constant as it's moved to pc-renderers.js
// Removing the UIRenderers namespace as functions are moved.

console.log("uiRenderers.js: Refactoring COMPLETE. This file is now deprecated for most rendering logic.");

// Keeping the global assignment for closeLoreDetailViewUI if it's still needed from App.js's window.openTab
// However, App.js should call LoreRenderers.closeLoreDetailViewUI directly.
// This line can likely be removed if App.js is updated.
// window.closeLoreDetailViewUI = LoreRenderers.closeLoreDetailViewUI;
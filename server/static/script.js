// static/script.js
// This file is now largely superseded by the more modular JS files (app.js, appState.js, etc.)
// For clarity and to avoid conflicts, its previous content (global variables and functions)
// has been integrated into those more specific files.
// This file can be kept minimal or used for truly global, simple, non-module-specific scripts if any arise.

console.log("script.js: Loaded (expected to be minimal or empty if all logic is modularized).");

// If there's any leftover global initialization that HAS to be here, it would go below.
// However, best practice is to move it to app.js or a relevant module.

// Example of a truly global utility that might remain (though utils.js is better):
// window.escapeHtml = function(unsafe) {
//     if (typeof unsafe !== 'string') return '';
//     return unsafe
//          .replace(/&/g, "&amp;")
//          .replace(/</g, "&lt;")
//          .replace(/>/g, "&gt;")
//          .replace(/"/g, "&quot;")
//          .replace(/'/g, "&#039;");
// }
// This specific escapeHtml is now in utils.js.
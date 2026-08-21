/**
 * static/utils.js
 * 
 * Responsibility: General-purpose utility and formatting functions.
 * Provides safe DOM lookups, string slugification, HTML sanitization, 
 * and UI element state modifications.
 */

var Utils = {
    /** Safe shortcut wrapper for document.getElementById */
    getElem: function(id) {
        return document.getElementById(id);
    },

    /** Safely updates the text content of a DOM node, warning if the ID is missing. */
    updateText: function(id, text) {
        const elem = this.getElem(id); 
        if (elem) {
            elem.textContent = text;
        } else {
            console.warn(`Utils.updateText: Element with ID '${id}' not found.`);
        }
    },

    /** Safely toggles the disabled state of a button element. */
    disableBtn: function(id, disabled) {
        const elem = this.getElem(id); 
        if (elem) {
            elem.disabled = disabled;
        } else {
            console.warn(`Utils.disableBtn: Element with ID '${id}' not found.`);
        }
    },

    /** Converts a human-readable title string into a clean URL-safe slug. */
    slugify: function(text) {
        if (text === null || typeof text === 'undefined') return '';
        return text.toString().toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w-]+/g, '')
            .replace(/--+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '');
    },

    /**
     * Sanitizes raw text strings by escaping dangerous HTML characters 
     * to prevent Cross-Site Scripting (XSS) attacks in dynamic views.
     * 
     * @param {string} unsafe - The raw, untrusted input string.
     * @returns {string} The safely escaped string.
     */
    escapeHtml: function(unsafe) {
        if (typeof unsafe !== 'string') {
            if (unsafe === null || typeof unsafe === 'undefined') return '';
            try {
                unsafe = String(unsafe);
            } catch (e) {
                console.error("Utils.escapeHtml: Could not convert to string for escaping:", unsafe, e);
                return '';
            }
        }
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
};
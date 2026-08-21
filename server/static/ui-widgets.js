/**
 * static/ui-widgets.js
 * 
 * Responsibility: Generic, reusable UI component generators.
 * Houses modular building blocks like visual progress bars used across stats comparisons.
 */

var UIWidgets = {
    /**
     * Generates an HTML string representing a proportional comparative bar chart row.
     * Used on the PC Dashboard to compare ability scores and skill modifiers.
     * 
     * @param {string} label - The text label appearing to the left of the bar (e.g., character name).
     * @param {number} value - The numeric value being represented.
     * @param {number} max_value - The maximum scale value for proportional calculation.
     * @param {number} [bar_max_value] - Optional override for the scale cap.
     * @returns {string} The fully compiled HTML string for the bar row.
     */
    generateBarChartRowHTML: function(label, value, max_value, bar_max_value) {
        // Calculate percentage width, handling negative ability modifiers gracefully via Math.abs
        const percentage = (Math.abs(value) / (bar_max_value || max_value)) * 100;
        
        // Color code: Green for positive or neutral, Red for negative values
        const bar_color = value >= 0 ? '#4caf50' : '#f44336';
        
        return `
            <div class="pc-bar-row">
                <div class="stat-comparison-pc-name">${label}</div>
                <div class="stat-bar-wrapper">
                    <div class="stat-bar" style="width: ${percentage}%; background-color: ${bar_color};">${value}</div>
                </div>
            </div>`;
    }
};
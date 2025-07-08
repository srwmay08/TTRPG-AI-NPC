// static/ui-widgets.js
// Responsibility: Generic, reusable UI components.

var UIWidgets = {
    generateBarChartRowHTML: function(label, value, max_value, bar_max_value) {
        const percentage = (Math.abs(value) / (bar_max_value || max_value)) * 100;
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
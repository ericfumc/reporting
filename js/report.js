/**
 * Wraps text without breaking words and aligns subsequent lines
 * @param {string} text - The text to wrap
 * @param {number} maxLen - Maximum characters per line
 * @param {number} indent - Number of spaces to prepend on lines after first
 * @returns {string} - Wrapped text
 */
function wrapText(text, maxLen, indent = 0) {
    if (!text) return '';
    const words = text.split(/\s+/);
    let lines = [];
    let currentLine = '';
    const prefix = ' '.repeat(indent);

    for (let word of words) {
        if ((currentLine + (currentLine ? ' ' : '') + word).length > maxLen) {
            // Line full → push and start new
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine += (currentLine ? ' ' : '') + word;
        }
    }
    if (currentLine) lines.push(currentLine);

    // Add indentation to all lines except first
    return lines.map((line, idx) => idx === 0 ? line : prefix + line).join('\n');
}

/**
 * Builds the ICCR report text from template and field values
 * @param {string} templateKey - Currently selected template
 * @param {Object} templates - All loaded templates
 * @param {Object} fieldInputs - Map of field label -> input element
 * @param {HTMLInputElement} diagnosisInput - Optional diagnosis line
 * @param {number} maxFieldLen - Max field label length
 * @param {number} wrapWidth - Max characters per line
 * @param {string} separator - Field label/value separator
 * @returns {string} - Formatted report text
 */
function buildReport(templateKey, templates, fieldInputs, diagnosisInput, maxFieldLen = 36, wrapWidth = 72, separator = ":") {
    const tpl = templates[templateKey];
    const diag = (diagnosisInput.value || '').trim();
    let report = '';
    const indent = maxFieldLen + separator.length;

    // Optional final diagnosis
    if (diag) {
        report += 'FINAL DIAGNOSIS\n' + '-'.repeat(15) + '\n' + diag + '\n\n';
    }

    tpl.categories.forEach(cat => {
        const catLines = [];
        cat.fields.forEach(f => {
            const v = (fieldInputs[f.label].value || '').trim();
            if (!v) return;

            // Skip empty or uninformative values
            const low = v.toLowerCase();
            if (['n/a', 'not applicable', 'none', 'nil'].includes(low)) return;

            // Prepare aligned first line
            const paddedLabel = (f.label + ' '.repeat(maxFieldLen)).slice(0, maxFieldLen);
            const firstLineLabel = paddedLabel + separator;

            // Wrap text for the value
            const wrappedValue = wrapText(v, wrapWidth, indent);

            // Combine first line with remaining wrapped lines
            const wrappedLines = wrappedValue.split('\n');
            if (wrappedLines.length === 1) {
                catLines.push(firstLineLabel + wrappedLines[0]);
            } else {
                catLines.push(firstLineLabel +'1' + wrappedLines[0]);
                catLines.push(wrappedLines.slice(1).join('\n'));
            }
        });

        if (catLines.length) {
            report += cat.name.toUpperCase() + '\n' + '-'.repeat(80) + '\n' + catLines.join('\n') + '\n\n';
        }
    });

    return report.replace(/\s+$/, ''); // Trim trailing spaces/newlines
}

const fs = require('fs');

const utilityMap = [
    { class: 'max-w-500', style: 'max-width: 500px;' },
    { class: 'max-w-400', style: 'max-width: 400px;' },
    { class: 'p-30', style: 'padding: 30px;' },
    { class: 'flex-justify-end', style: 'justify-content: flex-end;' },
    { class: 'flex-justify-between', style: 'justify-content: space-between;' },

    { class: 'text-underline', style: 'text-decoration: underline;' },
    { class: 'mb-0', style: 'margin-bottom: 0;' },
    { class: 'mb-12', style: 'margin-bottom: 12px;' },

    { class: 'border-dashed-ccc', style: 'border: 1px dashed #ccc;' },
    { class: 'border-bce0ff', style: 'border: 1px solid #bce0ff;' },
    { class: 'border-var-border', style: 'border: 1px solid var(--border-color);' },

    { class: 'bg-eef7ff', style: 'background: #eef7ff;' },
    { class: 'bg-green', style: 'background-color: #28a745;' },
    { class: 'text-primary', style: 'color: #007bff;' },

    { class: 'max-h-500', style: 'max-height: 500px;' },
    { class: 'max-h-300', style: 'max-height: 300px;' },
    { class: 'line-height-16', style: 'line-height: 1.6;' },

    { class: 'border-collapse', style: 'border-collapse: collapse;' },
    { class: 'opacity-8', style: 'opacity: 0.8;' },

    { class: 'px-12-py-6', style: 'padding: 6px 12px;' },
    { class: 'px-10-py-5', style: 'padding: 5px 10px;' },
    { class: 'px-15-py-5', style: 'padding: 5px 15px;' },
    { class: 'color-text-main', style: 'color: var(--text-main);' }
];

let html = fs.readFileSync('index.html', 'utf8');
let styleCss = fs.readFileSync('css/style.css', 'utf8');

// Append utility classes to style.css if they don't exist
const newCss = [];
utilityMap.forEach(u => {
    const cssBlock = `.${u.class} { ${u.style} }`;
    if (!styleCss.includes(`.${u.class} {`)) {
        newCss.push(cssBlock);
        styleCss += '\n' + cssBlock;
    }
});
fs.writeFileSync('css/style.css', styleCss, 'utf8');

const htmlRe = /<[^>]+style="([^"]+)"[^>]*>/g;

let count = 0;
html = html.replace(htmlRe, (match, styleAttr) => {
    let classesToAdd = [];
    let remainingStyle = styleAttr;

    utilityMap.forEach(u => {
        if (remainingStyle.includes(u.style)) {
            classesToAdd.push(u.class);
            remainingStyle = remainingStyle.replace(u.style, '').trim();
        }
    });

    remainingStyle = remainingStyle.replace(/;\s*;/g, ';').replace(/^\s*;\s*/, '').trim();

    if (classesToAdd.length > 0) {
        count++;
        let newTag = match;
        const classMatch = newTag.match(/class="([^"]+)"/);
        if (classMatch) {
            newTag = newTag.replace(classMatch[0], `class="${classMatch[1]} ${classesToAdd.join(' ')}"`);
        } else {
            newTag = newTag.replace(/style="/, `class="${classesToAdd.join(' ')}" style="`);
        }

        if (remainingStyle === '') {
            newTag = newTag.replace(/style="[^\"]*"/, '');
        } else {
            newTag = newTag.replace(/style="[^\"]*"/, `style="${remainingStyle}"`);
        }

        newTag = newTag.replace(/\s+/g, ' ').replace(/ >/g, '>');
        return newTag;
    }
    return match;
});

// Specific hardcoded replacements for the weird DATA CORRUPTED ones to clean up logic
html = html.replace('style="color: #ffff00; border: 2px solid #ffff00;"', 'class="text-warning border-warning"');
if (!styleCss.includes('.text-warning { color: #ffff00; }')) {
    fs.appendFileSync('css/style.css', '\n.text-warning { color: #ffff00; }\n.border-warning { border: 2px solid #ffff00; }');
}

fs.writeFileSync('index.html', html, 'utf8');
console.log(`Updated ${count} elements in index.html - pass 3`);

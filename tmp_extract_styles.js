const fs = require('fs');

const utilityMap = [
    { class: 'mt-15', style: 'margin-top: 15px;' },
    { class: 'mb-15', style: 'margin-bottom: 15px;' },
    { class: 'mt-10', style: 'margin-top: 10px;' },
    { class: 'mb-10', style: 'margin-bottom: 10px;' },
    { class: 'mt-20', style: 'margin-top: 20px;' },
    { class: 'mb-20', style: 'margin-bottom: 20px;' },
    { class: 'mt-25', style: 'margin-top: 25px;' },
    { class: 'mb-5', style: 'margin-bottom: 5px;' },

    { class: 'fs-08', style: 'font-size: 0.8rem;' },
    { class: 'fs-085', style: 'font-size: 0.85rem;' },
    { class: 'fs-09', style: 'font-size: 0.9rem;' },
    { class: 'fs-095', style: 'font-size: 0.95rem;' },
    { class: 'fs-12', style: 'font-size: 1.2rem;' },
    { class: 'fs-15', style: 'font-size: 1.5rem;' },
    { class: 'fs-18', style: 'font-size: 1.8rem;' },
    { class: 'fw-bold', style: 'font-weight: bold;' },

    { class: 'text-center', style: 'text-align: center;' },
    { class: 'text-muted', style: 'color: #666;' },
    { class: 'text-muted-888', style: 'color: #888;' },
    { class: 'text-danger', style: 'color: #ff4d4d;' },
    { class: 'text-danger-dark', style: 'color: #d9534f;' },

    { class: 'flex-row', style: 'display: flex;' },
    { class: 'flex-center', style: 'display: flex; align-items: center;' },
    { class: 'flex-wrap', style: 'display: flex; flex-wrap: wrap;' },
    { class: 'flex-center-wrap', style: 'display: flex; align-items: center; flex-wrap: wrap;' },
    { class: 'gap-5', style: 'gap: 5px;' },
    { class: 'gap-6', style: 'gap: 6px;' },
    { class: 'gap-8', style: 'gap: 8px;' },
    { class: 'gap-10', style: 'gap: 10px;' },
    { class: 'gap-15', style: 'gap: 15px;' },

    { class: 'flex-1', style: 'flex: 1;' },
    { class: 'flex-2', style: 'flex: 2;' },
    { class: 'w-100', style: 'width: 100%;' },
    { class: 'w-auto', style: 'width: auto;' },
    { class: 'm-0', style: 'margin: 0;' },

    { class: 'cursor-pointer', style: 'cursor: pointer;' },
    { class: 'cursor-not-allowed', style: 'cursor: not-allowed;' },

    { class: 'p-5', style: 'padding: 5px;' },
    { class: 'p-8', style: 'padding: 8px;' },
    { class: 'p-10', style: 'padding: 10px;' },
    { class: 'p-15', style: 'padding: 15px;' },
    { class: 'p-20', style: 'padding: 20px;' },

    { class: 'bg-white', style: 'background: #fff;' },
    { class: 'bg-light', style: 'background: #f8f9fa;' },
    { class: 'bg-lighter', style: 'background: #f9f9f9;' },

    { class: 'border-radius-4', style: 'border-radius: 4px;' },
    { class: 'border-radius-6', style: 'border-radius: 6px;' },
    { class: 'border-radius-8', style: 'border-radius: 8px;' }
];

let html = fs.readFileSync('index.html', 'utf8');
let styleCss = fs.readFileSync('css/style.css', 'utf8');

// Append utility classes to style.css if they don't exist
const newCss = [];
newCss.push('\n/* Utility Classes generated for inline style removal */');
utilityMap.forEach(u => {
    const cssBlock = `.${u.class} { ${u.style} }`;
    if (!styleCss.includes(`.${u.class} {`)) {
        newCss.push(cssBlock);
        styleCss += '\n' + cssBlock;
    }
});
fs.writeFileSync('css/style.css', styleCss, 'utf8');

// The matching can be tricky because multiple styles might be concatenated.
// e.g. style="margin-top: 15px; font-weight: bold;"
// A robust way: parse HTML tags, parse style attribute, map styles to classes, remove mapped styles from style attr.
const htmlRe = /<[^>]+style="([^"]+)"[^>]*>/g;

let count = 0;
html = html.replace(htmlRe, (match, styleAttr) => {
    let classesToAdd = [];
    let remainingStyle = styleAttr;

    // Sort logic to match longest first if needed
    utilityMap.forEach(u => {
        if (remainingStyle.includes(u.style)) {
            classesToAdd.push(u.class);
            remainingStyle = remainingStyle.replace(u.style, '').trim();
        }
    });

    // Clean up empty semicolons/spaces in remaining style
    remainingStyle = remainingStyle.replace(/;\s*;/g, ';').replace(/^\s*;\s*/, '').trim();

    if (classesToAdd.length > 0) {
        count++;
        // Reconstruct the tag
        let newTag = match;
        // Inject classes
        const classMatch = newTag.match(/class="([^"]+)"/);
        if (classMatch) {
            newTag = newTag.replace(classMatch[0], `class="${classMatch[1]} ${classesToAdd.join(' ')}"`);
        } else {
            // insert class attribute before style
            newTag = newTag.replace(/style="/, `class="${classesToAdd.join(' ')}" style="`);
        }

        if (remainingStyle === '') {
            newTag = newTag.replace(/style="[^\"]*"/, '');
        } else {
            newTag = newTag.replace(/style="[^\"]*"/, `style="${remainingStyle}"`);
        }

        // Clean up empty class or multiple spaces
        newTag = newTag.replace(/\s+/g, ' ').replace(/ >/g, '>');
        return newTag;
    }
    return match;
});

fs.writeFileSync('index.html', html, 'utf8');
console.log(`Updated ${count} elements in index.html`);

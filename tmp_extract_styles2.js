const fs = require('fs');

const utilityMap = [
    { class: 'align-center', style: 'align-items: center;' },
    { class: 'align-flex-start', style: 'align-items: flex-start;' },
    { class: 'align-flex-end', style: 'align-items: flex-end;' },

    { class: 'flex-wrap', style: 'flex-wrap: wrap;' },
    { class: 'flex-col', style: 'flex-direction: column;' },

    { class: 'd-inline-block', style: 'display: inline-block;' },
    { class: 'd-none', style: 'display: none;' },
    { class: 'd-flex', style: 'display: flex;' },

    { class: 'mw-140', style: 'min-width: 140px;' },
    { class: 'mw-150', style: 'min-width: 150px;' },
    { class: 'mw-160', style: 'min-width: 160px;' },
    { class: 'mw-200', style: 'min-width: 200px;' },

    { class: 'w-80', style: 'width: 80px;' },

    { class: 'border-dee2e6', style: 'border: 1px solid #dee2e6;' },
    { class: 'border-eee', style: 'border: 1px solid #eee;' },
    { class: 'border-b-ddd', style: 'border-bottom: 2px solid #ddd;' },
    { class: 'border-t-f0f0f0', style: 'border-top: 1px solid #f0f0f0;' },
    { class: 'border-b-eee', style: 'border-bottom: 1px solid #eee;' },
    { class: 'border-dashed-ced4da', style: 'border: 1px dashed #ced4da;' },

    { class: 'bg-info', style: 'background-color: #17a2b8;' },
    { class: 'bg-purple', style: 'background-color: #6f42c1;' },
    { class: 'bg-secondary', style: 'background-color: #6c757d;' },
    { class: 'bg-eee', style: 'background: #eee;' },

    { class: 'text-white', style: 'color: #fff;' },
    { class: 'text-right', style: 'text-align: right;' },
    { class: 'text-left', style: 'text-align: left;' },

    { class: 'p-6', style: 'padding: 6px;' },
    { class: 'px-20-py-8', style: 'padding: 8px 20px;' },
    { class: 'px-10-py-6', style: 'padding: 6px 10px;' },
    { class: 'px-15-py-6', style: 'padding: 6px 15px;' },
    { class: 'px-15-py-8', style: 'padding: 8px 15px;' },
    { class: 'pt-12', style: 'padding-top: 12px;' },
    { class: 'pb-8', style: 'padding-bottom: 8px;' },

    { class: 'ml-5', style: 'margin-left: 5px;' },
    { class: 'mt-8', style: 'margin-top: 8px;' },

    { class: 'mh-400', style: 'max-height: 400px;' },
    { class: 'mh-350', style: 'max-height: 350px;' },
    { class: 'overflow-y-auto', style: 'overflow-y: auto;' },
    { class: 'sticky-top-0', style: 'position: sticky; top: 0;' }
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

fs.writeFileSync('index.html', html, 'utf8');
console.log(`Updated ${count} elements in index.html - pass 2`);

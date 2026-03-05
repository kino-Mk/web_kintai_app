const fs = require('fs');
const path = require('path');
const dir = './js';

const rules = [
    // Firestore calls
    { from: /db\.collection\("([^"]+)"\)/g, to: "db.collection('$1')" },
    { from: /\.orderBy\("([^"]+)"(,\s*"([^"]+)")?\)/g, to: (match, p1, p2, p3) => { return p3 ? `.orderBy('${p1}', '${p3}')` : `.orderBy('${p1}')`; } },
    { from: /\.where\("([^"]+)"/g, to: ".where('$1'" },
    { from: /,\s*"([^"]+)"\)/g, to: ", '$1')" },
    { from: /\.doc\("([^"]+)"\)/g, to: ".doc('$1')" },

    // DOM calls
    { from: /getElementById\("([^"]+)"\)/g, to: "getElementById('$1')" },
    { from: /querySelector\("([^"]+)"\)/g, to: "querySelector('$1')" },
    { from: /querySelectorAll\("([^"]+)"\)/g, to: "querySelectorAll('$1')" },
    { from: /classList\.add\("([^"]+)"\)/g, to: "classList.add('$1')" },
    { from: /classList\.remove\("([^"]+)"\)/g, to: "classList.remove('$1')" },
    { from: /classList\.toggle\("([^"]+)"/g, to: "classList.toggle('$1'" },
    { from: /addEventListener\("([^"]+)"/g, to: "addEventListener('$1'" },

    // Console calls
    { from: /console\.log\("([^"]+)"/g, to: "console.log('$1'" },
    { from: /console\.error\("([^"]+)"/g, to: "console.error('$1'" },

    // await showAlert / showConfirm
    { from: /await showAlert\("([^"]+)"\)/g, to: "await showAlert('$1')" },
    { from: /await showConfirm\("([^"]+)"\)/g, to: "await showConfirm('$1')" }
];

const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
let totalReplacements = 0;

files.forEach(f => {
    const filePath = path.join(dir, f);
    let original = fs.readFileSync(filePath, 'utf8');
    let content = original;

    rules.forEach(r => {
        content = content.replace(r.from, r.to);
    });

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${f}`);
        totalReplacements++;
    }
});

console.log(`Total files updated: ${totalReplacements}`);

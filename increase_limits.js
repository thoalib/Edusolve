const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'apps', 'api', 'src');

function updateLimits(dir) {
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      updateLimits(fullPath);
    } else if (fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      content = content.replace(/\.limit\((\d+)\)/g, (match, num) => {
        const val = parseInt(num, 10);
        // We do not want to change .limit(1) which is for single row lookups.
        if (val > 1 && val <= 500) {
          changed = true;
          return `.limit(2000)`;
        }
        return match;
      });
      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log('Updated limits in:', fullPath.replace(srcDir, ''));
      }
    }
  }
}

updateLimits(srcDir);
console.log('Done increasing limits!');

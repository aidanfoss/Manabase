const fs = require('fs');
const path = require('path');

function walk(dir, fileList = []) {
  if (dir.includes('node_modules') || dir.includes('.git') || dir.endsWith('.csv') || dir.endsWith('.json')) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walk(filePath, fileList);
    } else {
      if (['.js', '.cjs'].includes(path.extname(filePath))) {
          fileList.push(filePath);
      }
    }
  }
  return fileList;
}

const files = walk('c:/Users/bossf/Documents/Projects/Manabase/backend');
const emojiRegex = /\p{Extended_Pictographic}/gu;
const consoleLogRegex = /console\.log\([^)]*\);?/g;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  // Remove emojis
  content = content.replace(emojiRegex, '');
  
  // Minimal console.log strategy: comment them out instead of deleting so we don't break multi-line
  // Actually, a simple regex might break things. Let's just remove simple console.logs
  // To be safe, we'll replace `console.log(` with `// console.log(`
  content = content.replace(/^[ \t]*console\.log\(/gm, '// console.log(');
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated backend file: ${file}`);
  }
}

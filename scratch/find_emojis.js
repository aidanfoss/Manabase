const fs = require('fs');
const path = require('path');

function walk(dir, fileList = []) {
  if (dir.includes('node_modules') || dir.includes('.git')) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walk(filePath, fileList);
    } else {
      if (['.js', '.jsx', '.ts', '.tsx', '.css', '.md', '.cjs', '.html'].includes(path.extname(filePath))) {
          fileList.push(filePath);
      }
    }
  }
  return fileList;
}

const files = [...walk('c:/Users/bossf/Documents/Projects/Manabase/frontend'), ...walk('c:/Users/bossf/Documents/Projects/Manabase/backend')];
const emojiRegex = /\p{Extended_Pictographic}/gu;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const matches = content.match(emojiRegex);
  if (matches) {
    console.log(file, ':', [...new Set(matches)].join(' '));
  }
}

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
      if (['.jsx', '.js'].includes(path.extname(filePath))) {
          fileList.push(filePath);
      }
    }
  }
  return fileList;
}

const files = walk('c:/Users/bossf/Documents/Projects/Manabase/frontend/src');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  // Find cases where I injected HTML-like strings as literal strings which broke because of unescaped quotes.
  // Match ANY icon that was injected inside double quotes
  // e.g. "{condition ? 'foo' : "<Icon style={{ ... }} /> Text"}"
  
  content = content.replace(/"(<[A-Za-z]+Icon[^>]+>)([^"]*)"/g, '<>$1$2</>');
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Fixed JSX string wrapping in ${file}`);
  }
}

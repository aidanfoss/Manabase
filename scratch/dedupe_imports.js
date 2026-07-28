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
  
  // Find all `import { ... } from "@heroicons/react/24/solid";`
  // There might be multiple lines.
  const regex = /import\s+\{([^}]+)\}\s+from\s+['"]@heroicons\/react\/24\/solid['"];?/g;
  
  let match;
  let allImports = new Set();
  
  while ((match = regex.exec(content)) !== null) {
    const imports = match[1].split(',').map(s => s.trim()).filter(Boolean);
    imports.forEach(i => allImports.add(i));
  }
  
  if (allImports.size > 0) {
    // Remove all old imports
    content = content.replace(regex, '');
    
    // Create new unified import
    const newImport = `import { ${Array.from(allImports).join(', ')} } from "@heroicons/react/24/solid";\n`;
    
    // Add it after import React
    if (content.includes('import React')) {
      content = content.replace(/import React.*?;/, match => match + '\n' + newImport);
    } else {
      content = newImport + content;
    }
  }
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Deduped imports in ${file}`);
  }
}

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
  // Specifically: "<ArrowPathIcon style={{ width: "1.2em", height: "1.2em", verticalAlign: "middle", marginRight: "4px" }} /> Resync All"
  
  content = content.replace(/"<([A-Za-z]+Icon) style=\{\{ width: "1\.2em", height: "1\.2em", verticalAlign: "middle", marginRight: "4px" \}\} \/>([^"]+)"/g, 
    '<><$1 style={{ width: "1.2em", height: "1.2em", verticalAlign: "middle", marginRight: "4px" }} />$2</>'
  );

  content = content.replace(/"<([A-Za-z]+Icon) style=\{\{ width: "1\.2em", height: "1\.2em" \}\} \/>([^"]*)"/g, 
    '<><$1 style={{ width: "1.2em", height: "1.2em" }} />$2</>'
  );

  content = content.replace(/'<([A-Za-z]+Icon) style=\{\{ width: "1\.2em", height: "1\.2em", verticalAlign: "middle", marginRight: "4px" \}\} \/>([^']+)'/g, 
    '<><$1 style={{ width: "1.2em", height: "1.2em", verticalAlign: "middle", marginRight: "4px" }} />$2</>'
  );
  
  // also InviteLanding cases:
  // '<h2 style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}><EnvelopeIcon style={{ width: "1.5em", height: "1.5em" }} /> Checking Invite Link...</h2>'
  // If it was inside single quotes in the original regex replacement. Wait, no, InviteLanding was replacing the whole <h2> element which was NOT in quotes, it was JSX!
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Fixed JSX string wrapping in ${file}`);
  }
}

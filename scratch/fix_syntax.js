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
  
  // This regex matches the exact injected JSX string, handling the broken quotes issue.
  // It matches: <IconName className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} />
  // We want to remove this if it's adjacent to a quote (which means it was originally inside a string).
  // Actually, let's just find ANY instance of this exact string pattern that is causing syntax errors and remove it.
  // Wait, if it's in JSX like <div><TrashIcon .../> Delete</div>, it won't have quotes around the className attribute that break string literals. It has quotes around inline-icon: className="inline-icon"
  // The ONLY place it breaks is when the emoji was inside a double-quoted string: " 🔑 " -> " <KeyIcon className="inline-icon"...
  // If it was inside single quotes: ' 🔑 ' -> ' <KeyIcon className="inline-icon"... -> this doesn't break syntax, but is ugly.
  // If it was inside backticks: ` 🔑 ` -> ` <KeyIcon className="inline-icon"... -> this doesn't break syntax, but is ugly.
  
  // Let's replace the literal string with nothing:
  const uglyJSX = /<[A-Za-z]+Icon className="inline-icon" style=\{\{ width: '1\.2em', height: '1\.2em', verticalAlign: 'middle', marginRight: '4px' \}\} \/> /g;
  
  // If we just remove uglyJSX everywhere, we also remove it from the valid JSX places!
  // We need to ONLY remove it if it's inside a string.
  // But wait, the valid JSX places ALSO have `uglyJSX`.
  // Wait, in `replace_all_frontend.js`, I ONLY inserted this exact `uglyJSX`.
  // Did it insert it into valid JSX? Yes, e.g. `<button>🗑</button>` became `<button><TrashIcon.../></button>`.
  // That IS valid JSX. We want to KEEP it there.
  // We ONLY want to remove it from `console.log("...<Trash... ")`, `alert("...")`, etc.
  
  // Since we know the context of `console.log` and `alert` and `toast` and `showToast`:
  content = content.replace(/(console\.log\([^)]*)<[A-Za-z]+Icon[^>]+>\s*/g, '$1');
  content = content.replace(/(console\.error\([^)]*)<[A-Za-z]+Icon[^>]+>\s*/g, '$1');
  content = content.replace(/(alert\([^)]*)<[A-Za-z]+Icon[^>]+>\s*/g, '$1');
  content = content.replace(/(showToast\([^)]*)<[A-Za-z]+Icon[^>]+>\s*/g, '$1');
  content = content.replace(/(setError\([^)]*)<[A-Za-z]+Icon[^>]+>\s*/g, '$1');
  
  // What about "✅ Success"? It might be in an object, e.g. { message: "✅ Success" }
  // Let's find any double quote followed by <IconName or <IconName followed by double quote.
  // Because it was `"✅ "` and became `"<IconName ... /> "`
  content = content.replace(/"<[A-Za-z]+Icon className="inline-icon" [^>]+>\s*/g, '"');
  content = content.replace(/'<[A-Za-z]+Icon className="inline-icon" [^>]+>\s*/g, "'");
  content = content.replace(/`<[A-Za-z]+Icon className="inline-icon" [^>]+>\s*/g, "`");
  
  // Also if it was at the end of a string:
  content = content.replace(/<[A-Za-z]+Icon className="inline-icon" [^>]+>"/g, '"');
  
  // Also any other places where it's inside quotes. 
  // Let's just fix the syntax error: `" ... <IconName className="inline-icon" ... /> ... "`
  // The simplest is to match the exact broken string.
  // In AuthContext.jsx: console.log("<KeyIcon className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} /> SSO Login token detected from redirect");
  // The above regex `"<[A-Za-z]+Icon...` handles this!
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Fixed string literal icons in ${file}`);
  }
}

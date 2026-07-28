const fs = require('fs');
const path = require('path');

const replacements = [
  // DecksHub & DecksManager
  { from: '🔄 Resync All', to: '<ArrowPathIcon style={{ width: "1.2em", height: "1.2em", verticalAlign: "middle", marginRight: "4px" }} /> Resync All', icons: ['ArrowPathIcon'] },
  { from: '➕ Import New Deck', to: '<PlusIcon style={{ width: "1.2em", height: "1.2em", verticalAlign: "middle", marginRight: "4px" }} /> Import New Deck', icons: ['PlusIcon'] },
  { from: '<div style={{ fontSize: \'3rem\', marginBottom: \'1rem\' }}>📦</div>', to: '<div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}><ArchiveBoxIcon style={{ width: "3rem", height: "3rem" }} /></div>', icons: ['ArchiveBoxIcon'] },
  { from: '<span>🔄</span>', to: '<span><ArrowPathIcon style={{ width: "1.2em", height: "1.2em" }} /></span>', icons: ['ArrowPathIcon'] },
  { from: '⚙️ Edit Options', to: '<Cog6ToothIcon style={{ width: "1.2em", height: "1.2em", verticalAlign: "middle", marginRight: "4px" }} /> Edit Options', icons: ['Cog6ToothIcon'] },
  { from: '🔄 Sync Deck to Manabase', to: '<ArrowPathIcon style={{ width: "1.2em", height: "1.2em", verticalAlign: "middle", marginRight: "4px" }} /> Sync Deck to Manabase', icons: ['ArrowPathIcon'] },
  { from: '💾 Save Defaults', to: '<DocumentArrowDownIcon style={{ width: "1.2em", height: "1.2em", verticalAlign: "middle", marginRight: "4px" }} /> Save Defaults', icons: ['DocumentArrowDownIcon'] },
  
  // InviteLanding
  { from: '<h2>📩 Checking Invite Link...</h2>', to: '<h2 style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}><EnvelopeIcon style={{ width: "1.5em", height: "1.5em" }} /> Checking Invite Link...</h2>', icons: ['EnvelopeIcon'] },
  { from: '<div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>', to: '<div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}><ExclamationTriangleIcon style={{ width: "3rem", height: "3rem" }} /></div>', icons: ['ExclamationTriangleIcon'] },
  { from: '<div style={{ fontSize: "3.5rem", marginBottom: "0.5rem" }}>👥</div>', to: '<div style={{ display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}><UserGroupIcon style={{ width: "3.5rem", height: "3.5rem" }} /></div>', icons: ['UserGroupIcon'] },
  { from: '🎉 Accept & Join Playgroup', to: '<CheckCircleIcon style={{ width: "1.2em", height: "1.2em", verticalAlign: "middle", marginRight: "6px" }} /> Accept & Join Playgroup', icons: ['CheckCircleIcon'] },
  { from: '🔐 Log In / Create Account', to: '<LockClosedIcon style={{ width: "1.2em", height: "1.2em", verticalAlign: "middle", marginRight: "6px" }} /> Log In / Create Account', icons: ['LockClosedIcon'] },
  { from: '🌐 Sign in with Google', to: '<GlobeAltIcon style={{ width: "1.2em", height: "1.2em", verticalAlign: "middle", marginRight: "6px" }} /> Sign in with Google', icons: ['GlobeAltIcon'] },
  { from: '💬 Sign in with Discord', to: '<ChatBubbleOvalLeftEllipsisIcon style={{ width: "1.2em", height: "1.2em", verticalAlign: "middle", marginRight: "6px" }} /> Sign in with Discord', icons: ['ChatBubbleOvalLeftEllipsisIcon'] },
  { from: '<h2>⚠️ Checking Invite Link...</h2>', to: '<h2 style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}><ExclamationTriangleIcon style={{ width: "1.5em", height: "1.5em" }} /> Checking Invite Link...</h2>', icons: ['ExclamationTriangleIcon'] }, // Just in case

  // LandCycleSelector
  { from: '"🟩 Top Tier (Always Enter Untapped)"', to: '"Top Tier (Always Enter Untapped)"', icons: [] },
  { from: '"🟨 Mid Tier (Sometimes Enter Untapped)"', to: '"Mid Tier (Sometimes Enter Untapped)"', icons: [] },
  { from: '"🟥 Bottom Tier (Always Enter Tapped)"', to: '"Bottom Tier (Always Enter Tapped)"', icons: [] },

  // LandPresetSelector
  { from: '⚙️ Manage', to: '<Cog6ToothIcon style={{ width: "1.2em", height: "1.2em", verticalAlign: "middle", marginRight: "4px" }} /> Manage', icons: ['Cog6ToothIcon'] }
];

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
  let usedIcons = new Set();
  
  for (const rep of replacements) {
    if (content.includes(rep.from)) {
      content = content.split(rep.from).join(rep.to);
      rep.icons.forEach(i => usedIcons.add(i));
    }
  }
  
  if (content !== original) {
    if (usedIcons.size > 0) {
      const importStr = `import { ${Array.from(usedIcons).join(', ')} } from "@heroicons/react/24/solid";\n`;
      
      // Insert after the first line (often import React) or just prepend
      if (content.includes('import React')) {
        content = content.replace(/import React.*?;/, match => match + '\n' + importStr);
      } else {
        content = importStr + content;
      }
    }
    
    // As a final sweep for this file, just strip any remaining unreplaced emojis
    // Wait, let's not blindly strip just yet, to avoid breaking logic if an emoji was used in string splitting, 
    // but the user wants them gone. The find_emojis script said they are mostly in strings.
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu;
    // content = content.replace(emojiRegex, ''); // Only if we want to obliterate remaining.

    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file} with icons: ${Array.from(usedIcons).join(', ')}`);
  }
}

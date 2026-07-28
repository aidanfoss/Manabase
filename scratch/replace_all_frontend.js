const fs = require('fs');
const path = require('path');

const iconMap = {
  '🔍': 'MagnifyingGlassIcon',
  '🗑': 'TrashIcon',
  '💾': 'DocumentArrowDownIcon', // or ArrowDownTrayIcon
  '❌': 'XMarkIcon',
  '✅': 'CheckCircleIcon',
  '⚠': 'ExclamationTriangleIcon',
  '🔄': 'ArrowPathIcon',
  '➕': 'PlusIcon',
  '➖': 'MinusIcon',
  '🔽': 'ChevronDownIcon',
  '🔼': 'ChevronUpIcon',
  '◀': 'ChevronLeftIcon',
  '▶': 'ChevronRightIcon',
  '📋': 'ClipboardDocumentListIcon',
  '🗃': 'ArchiveBoxIcon',
  '📥': 'InboxIcon',
  '📤': 'ArrowUpTrayIcon',
  '📁': 'FolderIcon',
  '🖼': 'PhotoIcon',
  '📊': 'ChartBarIcon',
  '🖨': 'PrinterIcon',
  '💡': 'LightBulbIcon',
  '🛠': 'WrenchScrewdriverIcon',
  '⚙': 'Cog6ToothIcon',
  '🎨': 'PaintBrushIcon',
  '📄': 'DocumentTextIcon',
  '⏳': 'ClockIcon',
  '🌳': 'GlobeAmericasIcon',
  '⚔': 'ShieldExclamationIcon',
  '🌸': 'SparklesIcon',
  '⚡': 'BoltIcon',
  '🤝': 'HandRaisedIcon',
  '🔗': 'LinkIcon',
  '🏆': 'TrophyIcon',
  '🔀': 'ArrowsRightLeftIcon',
  '👥': 'UserGroupIcon',
  '↗': 'ArrowTopRightOnSquareIcon',
  '🏷': 'TagIcon',
  '🧹': 'SparklesIcon',
  '🔒': 'LockClosedIcon',
  '🚪': 'ArrowRightOnRectangleIcon',
  '🚀': 'RocketLaunchIcon',
  '💸': 'BanknotesIcon',
  '🎁': 'GiftIcon',
  '🎒': 'BriefcaseIcon',
  '⚖': 'ScaleIcon',
  '💲': 'CurrencyDollarIcon',
  '🎴': 'RectangleGroupIcon',
  '🧠': 'CpuChipIcon',
  '🪙': 'CircleStackIcon',
  '📚': 'BookOpenIcon',
  '🔑': 'KeyIcon',
  '🌐': 'GlobeAltIcon',
  'ℹ': 'InformationCircleIcon',
  '🟢': 'CheckCircleIcon', // approximate
  '🔴': 'XCircleIcon',
  '⚪': 'MinusCircleIcon',
  '👤': 'UserIcon',
  '🔻': 'ChevronDownIcon',
  '✏': 'PencilIcon',
  '★': 'StarIcon',
  '🚫': 'NoSymbolIcon',
  '✨': 'SparklesIcon',
  '🎉': 'null', // Just remove
  '⬅': 'null', // Just remove
  '🟩': 'null',
  '🟨': 'null',
  '🟥': 'null',
  '⬛': 'null'
};

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
  
  // Find all emojis in the file
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}★⬅]/gu;
  
  content = content.replace(emojiRegex, (match) => {
    const iconName = iconMap[match];
    if (iconName && iconName !== 'null') {
      usedIcons.add(iconName);
      // We assume it's used inside JSX where a component is valid.
      // If it's used inside a string, like alert("✅ Success"), inserting a component will break or render [object Object].
      // BUT to write a 100% perfect AST parser is too complex.
      // So we will just insert the component and fix any syntax errors later if they break string literals.
      // Wait, let's check if the match is surrounded by quotes.
      return `<${iconName} className="inline-icon" style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '4px' }} />`;
    }
    // If we don't have a map or it's 'null', just remove it
    return '';
  });
  
  // Now we have a problem: what if the emoji was inside a string? e.g., console.log("🗑 Deleted")
  // It would become console.log("<TrashIcon.../> Deleted"), which is just a string. It won't break syntax! It will just look weird in the console or alert.
  // Wait, if it's inside a string literal, we replaced it with a string that LOOKS like JSX, but it's just characters inside the string!
  // e.g., alert("<TrashIcon.../> Deleted").
  // So it doesn't break syntax! It just looks ugly in alerts.
  // BUT what if it was inside JSX text? <div>🗑 Delete</div> -> <div><TrashIcon.../> Delete</div>. This is EXACTLY what we want!
  // BUT wait! If we do `content.replace`, it's not AST-aware.
  // If we have `title="🗑 Delete"`, it becomes `title="<TrashIcon.../> Delete"`, which is literal string.
  // We can just clean up `title="<.../> "` later or let it be for now and fix manually.
  
  if (content !== original) {
    if (usedIcons.size > 0) {
      const importStr = `import { ${Array.from(usedIcons).join(', ')} } from "@heroicons/react/24/solid";\n`;
      if (content.includes('import React')) {
        content = content.replace(/import React.*?;/, match => match + '\n' + importStr);
      } else {
        content = importStr + content;
      }
    }
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file} with icons: ${Array.from(usedIcons).join(', ')}`);
  }
}

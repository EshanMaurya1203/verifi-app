const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) { 
      walkDir(dirPath, callback);
    } else {
      if (dirPath.endsWith('.tsx') || dirPath.endsWith('.ts')) {
        callback(dirPath);
      }
    }
  });
}

function transformFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  // Specific literal replacements
  content = content.replace(/bg-\[#080808\]/g, 'bg-background');
  content = content.replace(/text-\[#edede9\]/g, 'text-foreground');
  content = content.replace(/text-\[#b9ff4b\]/g, 'text-primary');
  content = content.replace(/bg-\[#b9ff4b\]/g, 'bg-primary');
  content = content.replace(/hover:bg-\[#b9ff4b\]/g, 'hover:bg-primary');
  content = content.replace(/hover:bg-\[#d5ff93\]/g, 'hover:bg-primary/90');
  content = content.replace(/hover:text-\[#d5ff93\]/g, 'hover:text-primary/80');
  content = content.replace(/text-\[#080808\]/g, 'text-primary-foreground');
  content = content.replace(/hover:text-\[#080808\]/g, 'hover:text-primary-foreground');
  content = content.replace(/text-\[#a0a09a\]/g, 'text-muted-foreground');
  content = content.replace(/text-\[#606060\]/g, 'text-muted-foreground');
  content = content.replace(/text-\[#333333\]/g, 'text-muted-foreground');
  content = content.replace(/bg-\[#0f0f0f\](\/70)?/g, 'bg-card');
  content = content.replace(/bg-\[#121212\]/g, 'bg-muted');
  content = content.replace(/bg-\[#151515\]/g, 'bg-muted');
  content = content.replace(/bg-\[#1a1a1a\]/g, 'bg-accent');
  content = content.replace(/bg-\[#1e1e1e\]/g, 'bg-accent');
  content = content.replace(/bg-\[#141414\]/g, 'bg-accent');
  content = content.replace(/bg-\[#0d1f00\]/g, 'bg-primary/20');
  
  content = content.replace(/hover:bg-\[#121212\]/g, 'hover:bg-accent hover:text-accent-foreground');
  content = content.replace(/hover:bg-\[#141414\]/g, 'hover:bg-accent hover:text-accent-foreground');
  
  content = content.replace(/shadow-\[0_0_20px_rgba\(185,255,75,0\.05\)\]/g, 'shadow-sm');
  content = content.replace(/shadow-\[0_0_20px_rgba\(185,255,75,0\.08\)\]/g, 'shadow-md');
  content = content.replace(/shadow-\[0_0_50px_rgba\(185,255,75,0\.14\)\]/g, 'shadow-lg');
  content = content.replace(/bg-\[radial-gradient\(circle_at_top,rgba\(185,255,75,0\.14\),rgba\(13,13,13,0\.96\)_55%\)\]/g, 'bg-card');
  content = content.replace(/hover:text-\[#edede9\]/g, 'hover:text-foreground');
  
  content = content.replace(/border-\[rgba\(185,255,75,0\.2\)\]/g, 'border-primary/20');
  content = content.replace(/border-\[rgba\(185,255,75,0\.25\)\]/g, 'border-primary/20');
  content = content.replace(/border-\[#[a-fA-F0-9]{6}\]/g, 'border-border');
  
  content = content.replace(/bg-\[rgba\(8,8,8,0\.85\)\]/g, 'bg-background/85');
  content = content.replace(/bg-\[rgba\(8,8,8,0\.92\)\]/g, 'bg-background/92');
  
  // Custom
  content = content.replace(/border-border(.*?text-primary)/g, 'border-primary$1');
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

walkDir(path.join(__dirname, 'src'), transformFile);
console.log('done');

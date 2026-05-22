const fs = require('fs');
const path = require('path');

const srcDir = 'c:/Users/darkm/OneDrive/Desktop/KEO MONI/myos---personal-operating-system/src';

function searchFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchFiles(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('avatar_url') || content.includes('profile_avatar') || content.includes('AvatarImage') || content.includes('resolveDriveImage')) {
        console.log(`Found in: ${fullPath}`);
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (line.includes('avatar_url') || line.includes('profile_avatar') || line.includes('AvatarImage') || line.includes('resolveDriveImage')) {
            console.log(`  Line ${index + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

searchFiles(srcDir);

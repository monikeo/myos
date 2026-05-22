import fs from "fs";
import path from "path";

function processFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, "utf8");

  // Keep rounded-full for exact circles (avatars, indicators)
  // Replace standard rounded properties with rounded-none
  const original = content;
  content = content
    .replace(/\brounded-2xl\b/g, "rounded-none")
    .replace(/\brounded-3xl\b/g, "rounded-none")
    .replace(/\brounded-xl\b/g, "rounded-none")
    .replace(/\brounded-lg\b/g, "rounded-none")
    .replace(/\brounded-md\b/g, "rounded-none")
    .replace(/\brounded-sm\b/g, "rounded-none")
    .replace(/\brounded-2x\b/g, "rounded-none")
    .replace(/\brounded-\[20px\]\b/g, "rounded-none")
    .replace(/\brounded-\[30px\]\b/g, "rounded-none");

  if (content !== original) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`⚡ Unrounded UI in: ${path.basename(filePath)}`);
  }
}

function scanDir(dir: string) {
  if (!fs.existsSync(dir)) return;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (item !== "node_modules" && item !== ".git" && item !== "dist") {
        scanDir(fullPath);
      }
    } else if (stat.isFile() && (item.endsWith(".tsx") || item.endsWith(".ts") || item.endsWith(".css"))) {
      processFile(fullPath);
    }
  }
}

const rootDir = process.cwd();
console.log("🛠️  Initiating flat aesthetic overhaul in: " + rootDir);
scanDir(path.join(rootDir, "src"));
console.log("🎉 Flat design overhaul complete!");

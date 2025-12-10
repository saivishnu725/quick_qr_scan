import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = __dirname + "/..";
const srcDir = path.join(rootDir, "src");
const distDir = path.join(rootDir, "dist", "firefox");

// recursively delete directory
function rmrf(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, entry);
        const stat = fs.lstatSync(fullPath);
        if (stat.isDirectory()) {
            rmrf(fullPath);
        } else {
            fs.unlinkSync(fullPath);
        }
    }
    fs.rmdirSync(dir);
}

// recursively copy src -> dest
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    for (const entry of fs.readdirSync(src)) {
        const srcPath = path.join(src, entry);
        const destPath = path.join(dest, entry);
        const stat = fs.lstatSync(srcPath);
        if (stat.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function main() {
    // clean
    if (fs.existsSync(distDir)) {
        console.log("Cleaning dist directory...");
        rmrf(distDir);
    }

    // copy
    console.log("Copying files...");
    copyDir(srcDir, distDir);

    // rename firefox manfiest
    const firefoxManifestPathSrc = path.join(distDir, "manifest.firefox.json");
    const manifestPath = path.join(distDir, "manifest.json");

    if (!fs.existsSync(firefoxManifestPathSrc)) {
        console.error("Error: Firefox manifest file does not exist.");
        process.exit(1);
    }

    fs.renameSync(firefoxManifestPathSrc, manifestPath);

    // remove chrome manifest
    const chromeManifestPath = path.join(distDir, "manifest.chrome.json");
    if (fs.existsSync(chromeManifestPath)) {
        fs.unlinkSync(chromeManifestPath);
    }

    console.log("Firefox build complete!");
}

main();
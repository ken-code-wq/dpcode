import { execSync } from "child_process";
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const RESOURCES_DIR = join(__dirname, "../apps/desktop/resources");

function resizePng(source: string, target: string, size: number) {
  execSync(`sips -s format png -z ${size} ${size} "${source}" --out "${target}"`, { stdio: "ignore" });
}

function generateIcns(sourcePng: string, targetIcns: string) {
  const iconsetDir = join(__dirname, `../temp_${Date.now()}.iconset`);
  mkdirSync(iconsetDir, { recursive: true });

  const sizes = [
    { name: "icon_16x16.png", size: 16 },
    { name: "icon_16x16@2x.png", size: 32 },
    { name: "icon_32x32.png", size: 32 },
    { name: "icon_32x32@2x.png", size: 64 },
    { name: "icon_128x128.png", size: 128 },
    { name: "icon_128x128@2x.png", size: 256 },
    { name: "icon_256x256.png", size: 256 },
    { name: "icon_256x256@2x.png", size: 512 },
    { name: "icon_512x512.png", size: 512 },
    { name: "icon_512x512@2x.png", size: 1024 },
  ];

  for (const { name, size } of sizes) {
    resizePng(sourcePng, join(iconsetDir, name), size);
  }

  execSync(`iconutil -c icns "${iconsetDir}" -o "${targetIcns}"`, { stdio: "inherit" });
  rmSync(iconsetDir, { recursive: true, force: true });
  console.log(`Generated ICNS: ${targetIcns}`);
}

function generateIco(sourcePng: string, targetIco: string) {
  // Generate multi-resolution ICO file containing 16, 32, 48, 64, 128, 256 PNGs
  const sizes = [16, 32, 48, 64, 128, 256];
  const pngBuffers: Buffer[] = [];
  const tempFiles: string[] = [];

  for (const size of sizes) {
    const tempFile = join(__dirname, `../temp_${size}_${Date.now()}.png`);
    resizePng(sourcePng, tempFile, size);
    pngBuffers.push(readFileSync(tempFile));
    tempFiles.push(tempFile);
  }

  // ICO header: 6 bytes
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Image type: ICO
  header.writeUInt16LE(sizes.length, 4); // Number of images

  const directories: Buffer[] = [];
  let currentOffset = 6 + sizes.length * 16;

  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i]!;
    const pngBuffer = pngBuffers[i]!;
    const dirEntry = Buffer.alloc(16);
    
    dirEntry.writeUInt8(size >= 256 ? 0 : size, 0); // Width
    dirEntry.writeUInt8(size >= 256 ? 0 : size, 1); // Height
    dirEntry.writeUInt8(0, 2); // Color palette
    dirEntry.writeUInt8(0, 3); // Reserved
    dirEntry.writeUInt16LE(1, 4); // Color planes
    dirEntry.writeUInt16LE(32, 6); // Bits per pixel
    dirEntry.writeUInt32LE(pngBuffer.length, 8); // Image data size
    dirEntry.writeUInt32LE(currentOffset, 12); // Image data offset

    directories.push(dirEntry);
    currentOffset += pngBuffer.length;
  }

  const finalIcoBuffer = Buffer.concat([
    header,
    ...directories,
    ...pngBuffers,
  ]);

  writeFileSync(targetIco, finalIcoBuffer);
  
  for (const tempFile of tempFiles) {
    rmSync(tempFile, { force: true });
  }

  console.log(`Generated ICO: ${targetIco}`);
}

async function main() {
  const haloPng = join(RESOURCES_DIR, "halo.png");
  const haloNightlyPng = join(RESOURCES_DIR, "halo-nightly.png");

  if (!existsSync(haloPng)) {
    console.error(`Source standard logo does not exist at: ${haloPng}`);
    process.exit(1);
  }
  if (!existsSync(haloNightlyPng)) {
    console.error(`Source nightly logo does not exist at: ${haloNightlyPng}`);
    process.exit(1);
  }

  // 1. Standard logo -> icon.icns, icon.ico, icon.png
  console.log("Compiling standard app icon assets...");
  generateIcns(haloPng, join(RESOURCES_DIR, "icon.icns"));
  generateIco(haloPng, join(RESOURCES_DIR, "icon.ico"));
  resizePng(haloPng, join(RESOURCES_DIR, "icon.png"), 1024);

  // 2. Nightly logo -> icon-legacy.icns, icon-legacy.png
  console.log("Compiling nightly app icon assets...");
  generateIcns(haloNightlyPng, join(RESOURCES_DIR, "icon-legacy.icns"));
  resizePng(haloNightlyPng, join(RESOURCES_DIR, "icon-legacy.png"), 1024);

  console.log("Icon compilation complete!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

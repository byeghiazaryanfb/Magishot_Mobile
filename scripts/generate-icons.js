const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '../assets/logo.svg');
const svgBuffer = fs.readFileSync(svgPath);

// iOS icon sizes (actual pixel sizes)
const iosIcons = [
  { size: 40, name: 'icon-20@2x.png' },    // 20x20 @2x
  { size: 60, name: 'icon-20@3x.png' },    // 20x20 @3x
  { size: 58, name: 'icon-29@2x.png' },    // 29x29 @2x
  { size: 87, name: 'icon-29@3x.png' },    // 29x29 @3x
  { size: 80, name: 'icon-40@2x.png' },    // 40x40 @2x
  { size: 120, name: 'icon-40@3x.png' },   // 40x40 @3x
  { size: 120, name: 'icon-60@2x.png' },   // 60x60 @2x
  { size: 180, name: 'icon-60@3x.png' },   // 60x60 @3x
  { size: 1024, name: 'icon-1024.png' },   // App Store
];

// Android icon sizes
const androidIcons = [
  { size: 48, folder: 'mipmap-mdpi' },
  { size: 72, folder: 'mipmap-hdpi' },
  { size: 96, folder: 'mipmap-xhdpi' },
  { size: 144, folder: 'mipmap-xxhdpi' },
  { size: 192, folder: 'mipmap-xxxhdpi' },
];

const iosOutputDir = path.join(__dirname, '../ios/EverHomeMobileApp/Images.xcassets/AppIcon.appiconset');
const androidResDir = path.join(__dirname, '../android/app/src/main/res');

async function generateIcons() {
  console.log('Generating iOS icons...');

  for (const icon of iosIcons) {
    const outputPath = path.join(iosOutputDir, icon.name);
    await sharp(svgBuffer)
      .resize(icon.size, icon.size)
      .png()
      .toFile(outputPath);
    console.log(`  Created: ${icon.name} (${icon.size}x${icon.size})`);
  }

  console.log('\nGenerating Android icons...');

  for (const icon of androidIcons) {
    const folderPath = path.join(androidResDir, icon.folder);

    // ic_launcher.png
    await sharp(svgBuffer)
      .resize(icon.size, icon.size)
      .png()
      .toFile(path.join(folderPath, 'ic_launcher.png'));

    // ic_launcher_round.png (same for now)
    await sharp(svgBuffer)
      .resize(icon.size, icon.size)
      .png()
      .toFile(path.join(folderPath, 'ic_launcher_round.png'));

    console.log(`  Created: ${icon.folder}/ic_launcher.png (${icon.size}x${icon.size})`);
  }

  console.log('\nDone!');
}

generateIcons().catch(console.error);

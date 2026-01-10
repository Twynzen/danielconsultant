/**
 * PNG to WebP Converter
 * Converts all PNG files in gif* folders to WebP format
 * Expected savings: ~80% reduction in file size
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, 'src', 'assets');
const QUALITY = 80; // WebP quality (80 is good balance of quality/size)

// Folders to convert
const FOLDERS = [
  'gifDaniel',
  'gifllmlocal',
  'gifagents',
  'gifintegrations',
  'gifrag',
  'gifgithub'
];

async function convertFolder(folderName) {
  const folderPath = path.join(ASSETS_DIR, folderName);

  if (!fs.existsSync(folderPath)) {
    console.log(`  Skipping ${folderName} - folder not found`);
    return { converted: 0, savedBytes: 0 };
  }

  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.png'));
  let totalSaved = 0;
  let converted = 0;

  console.log(`\n  Converting ${folderName}/ (${files.length} files)...`);

  for (const file of files) {
    const inputPath = path.join(folderPath, file);
    const outputPath = path.join(folderPath, file.replace('.png', '.webp'));

    try {
      const inputStats = fs.statSync(inputPath);

      await sharp(inputPath)
        .webp({ quality: QUALITY })
        .toFile(outputPath);

      const outputStats = fs.statSync(outputPath);
      const saved = inputStats.size - outputStats.size;
      totalSaved += saved;
      converted++;

      // Progress indicator every 10 files
      if (converted % 10 === 0) {
        process.stdout.write(`    ${converted}/${files.length} done\r`);
      }
    } catch (err) {
      console.error(`    Error converting ${file}: ${err.message}`);
    }
  }

  console.log(`    ${converted} files converted, saved ${(totalSaved / 1024 / 1024).toFixed(2)} MB`);

  return { converted, savedBytes: totalSaved };
}

async function deleteOriginalPngs(folderName) {
  const folderPath = path.join(ASSETS_DIR, folderName);

  if (!fs.existsSync(folderPath)) return 0;

  const pngFiles = fs.readdirSync(folderPath).filter(f => f.endsWith('.png'));
  const webpFiles = fs.readdirSync(folderPath).filter(f => f.endsWith('.webp'));

  // Only delete PNGs that have corresponding WebP files
  let deleted = 0;
  for (const png of pngFiles) {
    const webp = png.replace('.png', '.webp');
    if (webpFiles.includes(webp)) {
      fs.unlinkSync(path.join(folderPath, png));
      deleted++;
    }
  }

  return deleted;
}

async function main() {
  console.log('========================================');
  console.log('  PNG to WebP Converter');
  console.log('  Quality: ' + QUALITY + '%');
  console.log('========================================');

  let totalConverted = 0;
  let totalSaved = 0;

  // Step 1: Convert all PNGs to WebP
  console.log('\nStep 1: Converting PNG to WebP...');

  for (const folder of FOLDERS) {
    const result = await convertFolder(folder);
    totalConverted += result.converted;
    totalSaved += result.savedBytes;
  }

  console.log('\n----------------------------------------');
  console.log(`  Total converted: ${totalConverted} files`);
  console.log(`  Total saved: ${(totalSaved / 1024 / 1024).toFixed(2)} MB`);
  console.log('----------------------------------------');

  // Step 2: Ask about deleting originals
  console.log('\nStep 2: Deleting original PNG files...');

  let totalDeleted = 0;
  for (const folder of FOLDERS) {
    const deleted = await deleteOriginalPngs(folder);
    if (deleted > 0) {
      console.log(`    Deleted ${deleted} PNGs from ${folder}/`);
      totalDeleted += deleted;
    }
  }

  console.log('\n========================================');
  console.log('  CONVERSION COMPLETE!');
  console.log(`  ${totalConverted} files converted`);
  console.log(`  ${totalDeleted} original PNGs deleted`);
  console.log(`  ~${(totalSaved / 1024 / 1024).toFixed(1)} MB saved`);
  console.log('========================================');
  console.log('\nNext step: Update code references from .png to .webp');
}

main().catch(console.error);

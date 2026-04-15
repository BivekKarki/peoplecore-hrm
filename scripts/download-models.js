/**
 * PeopleCore HRM — Face Recognition Model Downloader
 * Run once: node scripts/download-models.js
 *
 * Downloads ~6MB of model files from face-api.js GitHub releases
 * into public/models/ so the browser can load them.
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const BASE_URL = 'https://github.com/justadudewhohacks/face-api.js/raw/master/weights';

const MODEL_FILES = [
  // Tiny face detector (fast, lightweight)
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  // 68-point face landmark detection
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  // Face recognition (128-dim descriptor)
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
];

const MODELS_DIR = path.join(__dirname, '..', 'public', 'models');

// Create models directory
if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
  console.log('✓ Created public/models/');
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    // Check if already downloaded
    if (fs.existsSync(dest)) {
      const size = fs.statSync(dest).size;
      if (size > 100) {
        console.log(`  ↷ Already exists: ${path.basename(dest)} (${(size/1024).toFixed(1)}KB)`);
        return resolve();
      }
    }

    const file = fs.createWriteStream(dest);
    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }

      res.pipe(file);
      file.on('finish', () => {
        file.close();
        const size = fs.statSync(dest).size;
        console.log(`  ✓ Downloaded: ${path.basename(dest)} (${(size/1024).toFixed(1)}KB)`);
        resolve();
      });
    });

    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });

    file.on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function main() {
  console.log('\n🔍 PeopleCore — Downloading face recognition models...\n');

  let success = 0;
  let failed  = 0;

  for (const filename of MODEL_FILES) {
    const url  = `${BASE_URL}/${filename}`;
    const dest = path.join(MODELS_DIR, filename);
    try {
      await download(url, dest);
      success++;
    } catch (err) {
      console.error(`  ✗ Failed: ${filename} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${'─'.repeat(50)}`);
  if (failed === 0) {
    console.log(`✅ All ${success} model files downloaded successfully!`);
    console.log(`   Location: public/models/`);
    console.log(`\n   You can now use face recognition features.`);
    console.log(`   Kiosk: http://localhost:3000/kiosk\n`);
  } else {
    console.log(`⚠  ${success} succeeded, ${failed} failed.`);
    console.log(`   Check your internet connection and try again.\n`);
    process.exit(1);
  }
}

main();

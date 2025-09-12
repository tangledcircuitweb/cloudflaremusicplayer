#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// MP3 frame header parsing for timestamp indexing
function parseMP3Duration(buffer) {
  // Simple MP3 duration estimation - ~128kbps average
  // For production, use a proper MP3 parser library
  const fileSize = buffer.length;
  const bitrate = 128000; // 128 kbps average
  const duration = Math.floor((fileSize * 8) / bitrate);
  return duration;
}

function createTimestampIndex(buffer) {
  const duration = parseMP3Duration(buffer);
  const index = {};
  
  // Create index every second
  // For CBR MP3s, byte position is linear
  // For VBR, this is approximate but good enough for seeking
  for (let second = 0; second <= duration; second++) {
    const bytePosition = Math.floor((second / duration) * buffer.length);
    index[second] = bytePosition;
  }
  
  return { duration, index };
}

async function uploadToKV(filePath) {
  const filename = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  
  console.log(`Processing ${filename} (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
  
  // Create timestamp index
  const { duration, index: timestampIndex } = createTimestampIndex(fileBuffer);
  console.log(`  Duration: ${duration} seconds`);
  console.log(`  Index points: ${Object.keys(timestampIndex).length}`);
  
  // Prepare KV entries
  const audioKey = `audio:${filename}`;
  const indexKey = `audio-index:${filename}`;
  
  const metadata = {
    filename,
    size: fileBuffer.length,
    duration,
    uploadedAt: new Date().toISOString(),
    contentType: 'audio/mpeg'
  };
  
  // In production, use wrangler KV put commands
  console.log(`  Would store:`);
  console.log(`    - ${audioKey} (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`    - ${indexKey} (timestamp index)`);
  console.log(`    - Metadata:`, metadata);
  
  // For local testing, save to disk
  const outputDir = path.join(__dirname, 'kv-simulation');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Store audio file
  fs.writeFileSync(path.join(outputDir, `${audioKey}.mp3`), fileBuffer);
  
  // Store index
  fs.writeFileSync(
    path.join(outputDir, `${indexKey}.json`),
    JSON.stringify({ metadata, timestampIndex }, null, 2)
  );
  
  return { audioKey, indexKey, metadata };
}

async function main() {
  const audioDir = path.join(__dirname, 'src', 'epicscripture');
  const files = fs.readdirSync(audioDir)
    .filter(f => f.endsWith('.mp3'))
    .slice(0, 5); // First 5 files
  
  console.log(`Uploading ${files.length} files to KV...\n`);
  
  const uploaded = [];
  for (const file of files) {
    const filePath = path.join(audioDir, file);
    const result = await uploadToKV(filePath);
    uploaded.push(result);
    console.log('✓ Processed\n');
  }
  
  // Create master index
  const masterIndex = {
    tracks: uploaded.map(u => u.metadata),
    updatedAt: new Date().toISOString()
  };
  
  console.log('Creating master index...');
  fs.writeFileSync(
    path.join(__dirname, 'kv-simulation', 'audio-metadata.json'),
    JSON.stringify(masterIndex, null, 2)
  );
  
  console.log('\nUpload complete! Files ready for KV storage.');
  console.log('\nTo actually upload to Cloudflare KV, run:');
  uploaded.forEach(({ audioKey, indexKey }) => {
    console.log(`  wrangler kv:key put "${audioKey}" --path kv-simulation/${audioKey}.mp3 --binding AUDIO_STORE`);
    console.log(`  wrangler kv:key put "${indexKey}" --path kv-simulation/${indexKey}.json --binding AUDIO_STORE`);
  });
}

main().catch(console.error);
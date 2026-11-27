#!/usr/bin/env node
/**
 * CStore CI/CD Auto-Publisher
 * Automatically chunks large APKs (up to 500MB) and publishes/updates them directly on CStore via Supabase.
 * Zero external dependencies — runs directly in Node.js 18+ (GitHub Actions runner).
 */

import fs from 'node:fs';
import path from 'node:path';

// Parse CLI arguments
const args = process.argv.slice(2);
function getArg(flag, fallback = '') {
  const index = args.indexOf(flag);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return fallback;
}

const apkPath = getArg('--apk') || process.env.APK_PATH;
const appName = getArg('--name') || process.env.APP_NAME;
const appVersion = getArg('--version') || process.env.APP_VERSION || 'v1.0.0';
const description = getArg('--description') || process.env.APP_DESCRIPTION || 'Auto-published build via GitHub Actions CI/CD';
const iconUrl = getArg('--icon') || process.env.ICON_URL || null;

const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2YmpvZXh6Zndlc2dpYXBkY3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NjY2NzgsImV4cCI6MjA5MDM0MjY3OH0.SOhCZuFLN5iowxGyed3c3nN7qPaIRnQNth3UCSVt0-k';

const supabaseUrl = (getArg('--supabaseUrl') || process.env.SUPABASE_URL || 'https://cvbjoexzfwesgiapdcve.supabase.co').replace(/\/$/, '');
const rawToken = getArg('--token') || process.env.CSTORE_DEPLOY_TOKEN || getArg('--supabaseKey') || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

let targetUserId = null;
let supabaseKey = DEFAULT_SUPABASE_ANON_KEY;

if (rawToken.startsWith('cstore_usr_')) {
  targetUserId = rawToken.replace('cstore_usr_', '').trim();
} else if (rawToken.startsWith('eyJ')) {
  supabaseKey = rawToken.trim();
} else if (rawToken && rawToken.length >= 32 && rawToken.includes('-')) {
  targetUserId = rawToken.trim();
}

if (!apkPath) {
  console.error('[CStore CI/CD] Error: Missing --apk path.');
  process.exit(1);
}

if (!fs.existsSync(apkPath)) {
  console.error(`[CStore CI/CD] Error: APK file not found at: ${apkPath}`);
  process.exit(1);
}

const CHUNK_SIZE = 9 * 1024 * 1024; // 9MB chunks
const resolvedAppName = appName || path.basename(apkPath, '.apk').replace(/[-_]/g, ' ');

async function runPublisher() {
  console.log('==============================================');
  console.log(`[CStore CI/CD] Starting Deployment for: ${resolvedAppName}`);
  console.log(`[CStore CI/CD] Target Version: ${appVersion}`);
  console.log(`[CStore CI/CD] APK File: ${apkPath}`);
  console.log('==============================================');

  const fileBuffer = fs.readFileSync(apkPath);
  const totalBytes = fileBuffer.length;
  const sizeMB = (totalBytes / (1024 * 1024)).toFixed(1) + ' MB';
  const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);
  const isChunked = totalChunks > 1;
  const cleanBaseName = path.basename(apkPath).replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileId = `${Date.now()}_${cleanBaseName}`;

  console.log(`[CStore CI/CD] File size: ${sizeMB} (${totalBytes} bytes)`);
  console.log(`[CStore CI/CD] Chunk strategy: ${isChunked ? `${totalChunks} slices of 9MB` : 'Single file upload'}`);

  let finalFileUrl = '';

  if (isChunked) {
    const urlBase = `chunked_${fileId}`;
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalBytes);
      const chunkSlice = fileBuffer.subarray(start, end);
      const chunkPath = `${urlBase}_part_${i}`;

      process.stdout.write(`[CStore CI/CD] Uploading chunk ${i + 1}/${totalChunks} (${(chunkSlice.length / (1024 * 1024)).toFixed(1)} MB)... `);
      
      const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/cstore-apps/${chunkPath}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/octet-stream',
          'x-upsert': 'true'
        },
        body: chunkSlice
      });

      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        console.log('FAILED');
        throw new Error(`Failed to upload chunk ${i}: ${errorText}`);
      }
      console.log('DONE');
    }
    finalFileUrl = `${supabaseUrl}/storage/v1/object/public/cstore-apps/${urlBase}`;
  } else {
    const singlePath = `${Date.now()}-${cleanBaseName}`;
    process.stdout.write(`[CStore CI/CD] Uploading single APK (${sizeMB})... `);
    
    const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/cstore-apps/${singlePath}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/vnd.android.package-archive',
        'x-upsert': 'true'
      },
      body: fileBuffer
    });

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      console.log('FAILED');
      throw new Error(`Failed to upload APK: ${errorText}`);
    }
    console.log('DONE');
    finalFileUrl = `${supabaseUrl}/storage/v1/object/public/cstore-apps/${singlePath}`;
  }

  console.log(`[CStore CI/CD] Public Storage URL: ${finalFileUrl}`);

  // Query existing app
  const queryRes = await fetch(`${supabaseUrl}/rest/v1/apps?name=ilike.${encodeURIComponent(resolvedAppName)}&select=*`, {
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey
    }
  });

  const existingApps = await queryRes.json();
  const existingApp = existingApps?.[0];

  if (existingApp) {
    console.log(`[CStore CI/CD] Existing app found: ${existingApp.name} (id: ${existingApp.id}). Performing Version Update...`);
    
    // Save version history
    await fetch(`${supabaseUrl}/rest/v1/app_versions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_id: existingApp.id,
        version: existingApp.version,
        file_url: existingApp.file_url,
        size: existingApp.size,
        changelog: `Superseded by GitHub Actions CI/CD build ${appVersion}`
      })
    });

    // Update app record
    const updateBody = {
      version: appVersion,
      file_url: finalFileUrl,
      size: sizeMB,
      is_chunked: isChunked,
      chunk_count: totalChunks,
      upload_source: 'github',
      updated_at: new Date().toISOString()
    };
    if (!existingApp.user_id && targetUserId) {
      updateBody.user_id = targetUserId;
    }

    const patchRes = await fetch(`${supabaseUrl}/rest/v1/apps?id=eq.${existingApp.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateBody)
    });

    if (!patchRes.ok) throw new Error(await patchRes.text());

    // Mark any active update teaser for this app as published
    try {
      await fetch(`${supabaseUrl}/rest/v1/upcoming_releases?existing_app_id=eq.${existingApp.id}&is_published=eq.false`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          is_published: true,
          updated_at: new Date().toISOString()
        })
      });
      console.log(`[CStore CI/CD] Upcoming update teaser for ${existingApp.name} marked as published!`);
    } catch (_) {}

    console.log(`[CStore CI/CD] SUCCESS: Updated ${existingApp.name} to ${appVersion}!`);
  } else {
    // Check if an upcoming release teaser exists
    const upcomingRes = await fetch(`${supabaseUrl}/rest/v1/upcoming_releases?app_name=ilike.${encodeURIComponent(resolvedAppName)}&is_published=eq.false&select=*`, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey
      }
    });

    const upcomingList = await upcomingRes.json();
    const teaser = upcomingList?.[0];

    let appOwnerId = teaser?.created_by || targetUserId || null;
    let publisherName = teaser?.creator_name || 'CStore Developer';
    let publisherEmail = teaser?.creator_email || 'developer@cstore.local';

    if (appOwnerId) {
      try {
        const uRes = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${appOwnerId}&select=*`, {
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey
          }
        });
        const uList = await uRes.json();
        if (uList && uList[0]) {
          publisherName = uList[0].name || publisherName;
          publisherEmail = uList[0].email || publisherEmail;
        }
      } catch (_) {}
    }

    // Create new app record
    const insertRes = await fetch(`${supabaseUrl}/rest/v1/apps`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        name: resolvedAppName,
        version: appVersion,
        description: teaser?.description || description,
        file_url: finalFileUrl,
        icon_url: iconUrl || teaser?.icon_url || null,
        size: sizeMB,
        is_chunked: isChunked,
        chunk_count: totalChunks,
        download_count: 0,
        user_id: appOwnerId,
        publisher_name: publisherName,
        publisher_email: publisherEmail,
        upload_source: 'github'
      })
    });

    if (!insertRes.ok) throw new Error(await insertRes.text());
    const insertedApp = (await insertRes.json())?.[0];

    // If teaser existed, mark as published
    if (teaser) {
      await fetch(`${supabaseUrl}/rest/v1/upcoming_releases?id=eq.${teaser.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          is_published: true,
          published_app_id: insertedApp.id,
          updated_at: new Date().toISOString()
        })
      });
      console.log(`[CStore CI/CD] SUCCESS: Released ${resolvedAppName} from Coming Soon pipeline into live store!`);
    } else {
      console.log(`[CStore CI/CD] SUCCESS: Published brand new app ${resolvedAppName} to CStore!`);
    }
  }

  console.log('==============================================');
  console.log('[CStore CI/CD] Deployment Complete!');
  console.log('==============================================');
}

runPublisher().catch(err => {
  console.error('[CStore CI/CD] Error during deployment:', err);
  process.exit(1);
});

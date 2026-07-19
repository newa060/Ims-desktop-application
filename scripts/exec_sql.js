/**
 * exec_sql.js
 * Executes SQL against Supabase using the Management API.
 * Run: node scripts/exec_sql.js supabase/relink_final.sql
 *
 * Requires SUPABASE_ACCESS_TOKEN in .env
 * Get it from: https://app.supabase.com/account/tokens
 */
require('dotenv').config();
const fs    = require('fs');
const path  = require('path');
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN; // personal access token
const sqlFile      = process.argv[2];

if (!sqlFile) { console.error('Usage: node scripts/exec_sql.js <file.sql>'); process.exit(1); }

// Extract project ref from URL
const ref = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '').split('/')[0];
const sql = fs.readFileSync(path.join(process.cwd(), sqlFile), 'utf8');

console.log(`Project ref: ${ref}`);
console.log(`SQL file: ${sqlFile} (${Math.round(Buffer.byteLength(sql) / 1024)}KB)`);

if (!ACCESS_TOKEN) {
  console.log('\nNo SUPABASE_ACCESS_TOKEN found in .env');
  console.log('Get your personal access token from: https://app.supabase.com/account/tokens');
  console.log('Then add to .env: SUPABASE_ACCESS_TOKEN=your_token_here');
  console.log('\nAlternatively, copy supabase/relink_final.sql and paste it in the Supabase SQL Editor.');
  console.log('The file is at:', path.resolve(sqlFile));
  process.exit(0);
}

const body = JSON.stringify({ query: sql });
const req  = https.request({
  hostname: 'api.supabase.com',
  port: 443,
  path: `/v1/projects/${ref}/database/query`,
  method: 'POST',
  headers: {
    'Authorization':  'Bearer ' + ACCESS_TOKEN,
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
}, res => {
  let buf = '';
  res.on('data', d => buf += d);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      const parsed = JSON.parse(buf);
      console.log(JSON.stringify(parsed, null, 2).substring(0, 1000));
    } catch {
      console.log(buf.substring(0, 500));
    }
  });
});
req.on('error', e => console.error('Error:', e.message));
req.write(body);
req.end();

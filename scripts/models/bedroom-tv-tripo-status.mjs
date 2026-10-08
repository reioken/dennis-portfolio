import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Record only observed browser jobs or actual local GLBs; never submit generation through this script.
const manifestPath = 'scripts/models/bedroom-tv-tripo.references.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 3) {
  const [action, id, value] = args.slice(i, i + 3);
  const entry = manifest.references.find(r => r.id === id);
  if (!entry || !value) throw new Error(`Unknown or incomplete entry: ${id}`);
  if (action === '--job') {
    const url = new URL(value);
    if (url.origin !== 'https://studio.tripo3d.ai' || !/^\/workspace\/generate\/[a-f0-9-]{36}$/.test(url.pathname)) throw new Error('Unexpected job URL');
    entry.tripo = { ...entry.tripo, status: 'submitted', jobUrl: url.href, generator: 'H3.1 Best Quality', generationCredits: 30, privacy: 'Private' };
  } else if (['--download', '--texture', '--polish'].includes(action)) {
    const bytes = fs.readFileSync(value);
    if (bytes.subarray(0, 4).toString() !== 'glTF') throw new Error(`${id}: expected a GLB`);
    const details = { sha256: crypto.createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
    const relativePath = path.relative(process.cwd(), path.resolve(value)).replaceAll('\\', '/');
    if (action === '--download') entry.tripo = { ...entry.tripo, status: 'downloaded', sourceGlb: relativePath, ...details };
    else if (action === '--texture') entry.tripo = { ...entry.tripo, textureStatus: 'downloaded', textureResolution: '4K', textureCredits: 20, removeLighting: true, texturedGlb: relativePath, texturedSha256: details.sha256, texturedBytes: details.bytes };
    else entry.blender = { ...entry.blender, status: 'polished', outputGlb: relativePath, ...details };
  } else throw new Error(`Unknown action: ${action}`);
}
for (const entry of manifest.references) if (entry.tripo.status === 'awaiting-account-sign-in') entry.tripo.status = 'reference-ready';
const downloaded = manifest.references.filter(r => r.tripo.status === 'downloaded').length;
const submitted = manifest.references.filter(r => r.tripo.jobUrl).length;
const polished = manifest.references.filter(r => r.blender.status === 'polished').length;
const textured = manifest.references.filter(r => r.tripo.textureStatus === 'downloaded').length;
manifest.status = `${submitted}/15 Tripo jobs recorded; ${downloaded}/15 geometry GLBs saved; ${textured}/15 4K texture GLBs saved; ${polished}/15 polished`;
if (manifest.assembly?.visualApproval === 'rejected') manifest.status += '; v2 visually rejected by Dennis; correction candidate unapproved';
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(manifest.status);

import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(resolve(root, 'dist/manifest.webmanifest'), 'utf8'));
if (manifest.display !== 'standalone' || manifest.scope !== '/' || manifest.start_url !== '/') throw Error('Invalid PWA scope or display.');
for (const icon of manifest.icons) await access(resolve(root, 'dist', icon.src.slice(1)));
const html = await readFile(resolve(root, 'dist/index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"/g)) {
  if (/^(https?:|#|\.\/$)/.test(match[1])) continue;
  await access(resolve(root, 'dist', match[1].replace(/^\//, '')));
}
for (const name of ['app', 'model', 'snapshot', 'pwa', 'handover', 'handover-ui', 'handover-state', 'handover-sync', 'handover-config', 'motion', 'part-marks', 'job-status', 'job-status-ui', 'print', 'batch', 'batch-ui', 'qrcode', 'sw']) {
  const code = await readFile(resolve(root, 'dist', name + '.js'), 'utf8');
  new Script(code, { filename: name + '.js' });
}
const sw = await readFile(resolve(root, 'dist/sw.js'), 'utf8');
for (const match of sw.matchAll(/'(\/[^']*)'/g)) {
  await access(resolve(root, 'dist', match[1] === '/' ? 'index.html' : match[1].slice(1)));
}
for (const name of ['model','part-marks']) {
  const client=await readFile(resolve(root,'dist',name+'.js'),'utf8');
  const server=await readFile(resolve(root,'supabase/functions/_shared',name+'.js'),'utf8');
  if(client!==server)throw Error('Redeploy the handover function with the current '+name+' rules.');
}
console.log('Build ready: PWA manifest, icons, shell files, HTML references, and JavaScript checked. Output: dist/');

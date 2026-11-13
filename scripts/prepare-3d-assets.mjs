import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.resolve(process.argv[2] || path.join(root, '.artifacts', '3d-assets'));
const assetDir = path.join(destination, 'assets', '3d');
const cacheDir = path.join(root, '.cache', '3d-assets');
const cacheAssetDir = path.join(cacheDir, 'assets', '3d');
await mkdir(assetDir, { recursive: true });
await mkdir(cacheAssetDir, { recursive: true });
const assetPath = path.join(assetDir, 'sailing-pinnace.glb');
const cachedAssetPath = path.join(cacheAssetDir, 'sailing-pinnace.glb');
const licenseText = 'Sailing pinnace (ship) by James Ray Cock, Rico Cilliers, Nicolò Zubbini, Yann Kervran / Poly Haven.\\n' +
  'Source: https://www.innerscene.com/tools/library/3d-parts/sailing-pinnace-ship-1aa984c2\\n' +
  'License: CC0 / Public Domain. Free to use, modify and redistribute, including commercially.\\n';
const validGlb = async file => {
  try { const { stat, open } = await import('node:fs/promises'); const info = await stat(file); const handle = await open(file, 'r'); const head = Buffer.alloc(4); await handle.read(head, 0, 4, 0); await handle.close(); return info.size > 1000000 && head.toString('ascii') === 'glTF'; }
  catch { return false; }
};
if (await validGlb(cachedAssetPath)) {
  await (await import('node:fs/promises')).copyFile(cachedAssetPath, assetPath);
  await writeFile(path.join(assetDir, 'LICENSE.txt'), licenseText);
  console.log('Modelo 3D reutilizado desde caché persistente; no se descarga de nuevo.');
} else {
const source = 'https://files.innerscene.com/library/sailing-pinnace-ship-1aa984c2/ab8b022f166a4f291f95/polyhaven-ship-pinnace.glb';
const response = await fetch(source, { redirect: 'follow', signal: AbortSignal.timeout(120000) });
if (!response.ok) throw new Error('Descarga del modelo 3D fallida: HTTP ' + response.status);
const bytes = Buffer.from(await response.arrayBuffer());
if (bytes.length < 1000000 || bytes.toString('ascii', 0, 4) !== 'glTF') {
  throw new Error('El modelo GLB descargado está incompleto o no tiene cabecera glTF válida (' + bytes.length + ' bytes).');
}
await writeFile(assetPath, bytes);
await writeFile(path.join(assetDir, 'LICENSE.txt'),
  'Sailing pinnace (ship) by James Ray Cock, Rico Cilliers, Nicolò Zubbini, Yann Kervran / Poly Haven.\n' +
  'Source: https://www.innerscene.com/tools/library/3d-parts/sailing-pinnace-ship-1aa984c2\n' +
  'License: CC0 / Public Domain. Free to use, modify and redistribute, including commercially.\n');
console.log('Modelo 3D descargado y validado:', assetPath, (bytes.length / 1024 / 1024).toFixed(1) + ' MB');

import { readFile } from 'node:fs/promises';

const base = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!base || !key) throw new Error('Faltan las credenciales de Supabase en el entorno protegido.');
const paths = (await readFile('scripts/storage-cleanup-target.txt', 'utf8')).split(/\r?\n/).map(x => x.trim()).filter(x => x && !x.startsWith('#')));
if (!paths.length) throw new Error('No hay objetos de almacenamiento autorizados para eliminar.');
for (const objectPath of paths) {
  const encoded = objectPath.split('/').map(encodeURIComponent).join('/');
  const url = base + '/storage/v1/object/nexo-videos/' + encoded;
  const headers = { apikey: key, Authorization: 'Bearer ' + key };
  const response = await fetch(url, { method: 'DELETE', headers, signal: AbortSignal.timeout(60000) });
  if (!response.ok && response.status !== 404) throw new Error('Supabase Storage rechazó la eliminación (' + response.status + '): ' + (await response.text()).slice(0, 400));
  if (response.status === 404) console.log('El objeto ya no existía; se continúa con la verificación:', objectPath);
  const verify = await fetch(url, { method: 'HEAD', headers, signal: AbortSignal.timeout(30000) });
  if (verify.status !== 404) throw new Error('No se pudo verificar el borrado del objeto ' + objectPath + ' (HTTP ' + verify.status + ').');
  console.log('Objeto eliminado y verificado:', objectPath);
}

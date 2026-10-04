/** Shared request: the hall's loading manager and the console await the same bytes. */
export const DOCK_MODEL = '/models/navigation-marquee-v2.glb.gz?v=f48b04d9';
let pending: Promise<ArrayBuffer> | undefined;
export function prepareDockAsset() {
  if (!pending) pending = fetch(DOCK_MODEL).then(async response => {
    if (!response.ok) throw new Error('Navigation model unavailable');
    const bytes=await response.arrayBuffer(), magic=new Uint8Array(bytes,0,2);
    return magic[0]===31 && magic[1]===139
      ? new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
      : bytes;
  }).catch(error => { pending=undefined; throw error; });
  return pending;
}

import * as THREE from 'three';

/** What the hall's texture code needs from a loader; THREE.TextureLoader satisfies it too. */
export type TextureSource = {
  manager: THREE.LoadingManager;
  load(url: string, onLoad?: (texture: THREE.Texture) => void, onProgress?: (event: ProgressEvent) => void, onError?: (error: unknown) => void): THREE.Texture;
};

// The same browser gate three's GLTFLoader uses for its ImageBitmapLoader (Safari < 17 and Firefox < 98 decode
// ImageBitmaps with broken options); everywhere else the GLB images of the hall already arrive as ImageBitmaps.
const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
const safari = /^((?!chrome|android).)*safari/i.test(ua);
const safariVersion = safari ? Number(ua.match(/Version\/(\d+)/)?.[1] ?? -1) : -1;
const firefoxVersion = ua.includes('Firefox') ? Number(ua.match(/Firefox\/(\d+)\./)?.[1] ?? -1) : -1;
const bitmapsWork = typeof createImageBitmap === 'function' && typeof fetch === 'function'
  && !(safari && safariVersion < 17) && !(firefoxVersion !== -1 && firefoxVersion < 98);

/**
 * TextureLoader with the same synchronous API, but the image is decoded off the main thread.
 * An HTMLImageElement is decoded inside texSubImage2D: 26 room and hardware maps cost 922 ms of a phone
 * exhibit's 1040 ms of uploads at CPU ×4, against 14 ms for the 47 GLB textures that were already
 * ImageBitmaps (dev profile 2026-10-05). WebGL ignores UNPACK_FLIP_Y / PREMULTIPLY for ImageBitmaps, so the
 * orientation, alpha and colour conversion that the upload would have applied are read from the texture when
 * its bytes arrive (callers set flipY/colorSpace synchronously after load()) and baked into the decode.
 */
export class BitmapTextureLoader implements TextureSource {
  private fallback: THREE.TextureLoader;
  constructor(readonly manager: THREE.LoadingManager) {
    this.fallback = new THREE.TextureLoader(manager);
  }

  load(url: string, onLoad?: (texture: THREE.Texture) => void, onProgress?: (event: ProgressEvent) => void, onError?: (error: unknown) => void) {
    if (!bitmapsWork) return this.fallback.load(url, onLoad, onProgress, onError);
    const texture = new THREE.Texture();
    const resolved = this.manager.resolveURL(url);
    this.manager.itemStart(resolved);
    fetch(resolved, { credentials: 'same-origin' })
      .then(response => {
        if (!response.ok) throw new Error(`${response.status} ${resolved}`);
        return response.blob();
      })
      .then(blob => createImageBitmap(blob, {
        imageOrientation: texture.flipY ? 'flipY' : 'none',
        premultiplyAlpha: texture.premultiplyAlpha ? 'premultiply' : 'none',
        colorSpaceConversion: texture.colorSpace === THREE.NoColorSpace ? 'none' : 'default',
      }))
      .then(bitmap => {
        texture.image = bitmap;
        texture.needsUpdate = true;
        onLoad?.(texture);
        this.manager.itemEnd(resolved);
      })
      .catch(error => {
        onError?.(error);
        this.manager.itemError(resolved);
        this.manager.itemEnd(resolved);
      });
    return texture;
  }
}

/** Decoded binaries shared by every scene of the page: a phone exhibit or the console no longer re-inflates them. */
const inflated = new Map<string, Promise<ArrayBuffer | null>>();
export function inflatedBinary(url: string): Promise<ArrayBuffer | null> {
  let pending = inflated.get(url);
  if (!pending) {
    pending = fetch(url).then(async response => {
      if (!response.ok) return null;
      const buffer = await response.arrayBuffer();
      const magic = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
      if (magic[0] !== 0x1f || magic[1] !== 0x8b) return buffer;
      return new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    });
    // A failed request may be retried by the next scene.
    pending.then(result => { if (!result) inflated.delete(url); }, () => inflated.delete(url));
    inflated.set(url, pending);
  }
  return pending;
}

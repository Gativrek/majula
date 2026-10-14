/**
 * Bytes to base64, which is how `@capacitor/filesystem` carries binary files
 * across the native bridge.
 *
 * `String.fromCharCode(...bytes)` on a whole PDF overflows the call stack, since every
 * byte becomes an argument, so conversion runs in fixed-size chunks.
 */

const CHUNK = 0x8000;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }
  return btoa(binary);
}

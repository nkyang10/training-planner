/**
 * Remove metadata from an uploaded photo before it is stored (2026-11-05).
 *
 * A photo of an injury can carry GPS, device serials and timestamps in EXIF. The coach only needs the pixels, so the
 * web strips the metadata first: JPEG APP1/APP2 segments and the PNG eXIf chunk. The function is pure, takes bytes and
 * returns bytes; it does not decode or re-encode the image.
 */
export function stripExif(bytes: Uint8Array, contentType: string): Uint8Array {
  if (contentType === "image/jpeg") return stripJpegMetadata(bytes);
  if (contentType === "image/png") return stripPngMetadata(bytes);
  return bytes;
}

function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  const chunks: Uint8Array[] = [bytes.subarray(0, 2)];
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1] ?? 0;
    // Start of scan: copy the rest verbatim (the compressed image data is not a metadata segment).
    if (marker === 0xda) {
      chunks.push(bytes.subarray(offset));
      return concat(chunks);
    }
    const length = ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0);
    if (length < 2 || offset + 2 + length > bytes.length) break;
    const segment = bytes.subarray(offset, offset + 2 + length);
    const isMetadata = marker === 0xe1 || marker === 0xe2 || marker === 0xed || marker === 0xee || marker === 0xef;
    if (!isMetadata) chunks.push(segment);
    offset += 2 + length;
  }
  chunks.push(bytes.subarray(offset));
  return concat(chunks);
}

function stripPngMetadata(bytes: Uint8Array): Uint8Array {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 8 || signature.some((value, index) => bytes[index] !== value)) return bytes;
  const chunks: Uint8Array[] = [bytes.subarray(0, 8)];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = ((bytes[offset] ?? 0) << 24) | ((bytes[offset + 1] ?? 0) << 16) | ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0);
    const end = offset + 12 + length;
    if (length < 0 || end > bytes.length) break;
    const type = String.fromCharCode(bytes[offset + 4] ?? 0, bytes[offset + 5] ?? 0, bytes[offset + 6] ?? 0, bytes[offset + 7] ?? 0);
    const chunk = bytes.subarray(offset, end);
    if (type !== "eXIf") chunks.push(chunk);
    offset = end;
    if (type === "IEND") break;
  }
  return concat(chunks);
}

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

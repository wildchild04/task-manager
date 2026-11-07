/** The image types content may hold, recognised by their bytes. SVG is never accepted. */
export const CONTENT_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

/** The largest item that may be stored: 10 MB. */
export const MAX_CONTENT_BYTES = 10 * 1024 * 1024;

const EXTENSIONS: Record<ContentType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

/** A stored item's ID: the SHA-256 of its bytes in hex, plus its type's extension. */
export const CONTENT_ID_PATTERN = /^[0-9a-f]{64}\.(png|jpg|gif|webp)$/;

export type StoredContent = { id: string; type: ContentType; size: number };

/**
 * Where binary content lives. The file system now; an object store or CDN can
 * implement the same four methods later. Asynchronous because a network-backed
 * store will be.
 */
export interface ContentRepository {
  /** Stores bytes of a known type; storing the same bytes again returns the same item. */
  put(bytes: Uint8Array, type: ContentType): Promise<StoredContent>;
  get(id: string): Promise<(StoredContent & { bytes: Uint8Array }) | undefined>;
  delete(id: string): Promise<void>;
  /** Where browsers load the item from: an app path for the file system, a CDN URL for a CDN. */
  url(id: string): string;
}

export function isContentId(id: string): boolean {
  return CONTENT_ID_PATTERN.test(id);
}

/** The type an ID names, or `undefined` for a malformed ID. */
export function contentTypeOf(id: string): ContentType | undefined {
  const match = CONTENT_ID_PATTERN.exec(id);
  if (!match) return undefined;
  return CONTENT_TYPES.find((type) => EXTENSIONS[type] === match[1]);
}

/** The ID bytes of a type are stored under. */
export async function contentIdOf(bytes: Uint8Array, type: ContentType): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>));
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex}.${EXTENSIONS[type]}`;
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

/** The image type of some bytes, read from their signature (what a file claims to be is ignored). */
export function detectImageType(bytes: Uint8Array): ContentType | undefined {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, ascii("GIF87a")) || startsWith(bytes, ascii("GIF89a"))) return "image/gif";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "image/webp";
  return undefined;
}

export type ImageSize = { width: number; height: number };

const u16be = (b: Uint8Array, i: number) => (b[i]! << 8) | b[i + 1]!;
const u16le = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8);
const u24le = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16);
const u32be = (b: Uint8Array, i: number) => ((b[i]! << 24) >>> 0) + ((b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!);

/** JPEG start-of-frame markers (baseline, progressive, lossless, …); not DHT, JPG or DAC. */
const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function jpegSize(b: Uint8Array): ImageSize | undefined {
  let i = 2;
  while (i + 9 <= b.length) {
    if (b[i] !== 0xff) return undefined;
    const marker = b[i + 1]!;
    if (marker === 0xff) {
      i += 1; // fill byte
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2; // markers without a length
      continue;
    }
    if (JPEG_SOF.has(marker)) return { height: u16be(b, i + 5), width: u16be(b, i + 7) };
    if (marker === 0xd9 || marker === 0xda) return undefined; // end of image, or scan data before any frame
    i += 2 + u16be(b, i + 2);
  }
  return undefined;
}

function webpSize(b: Uint8Array): ImageSize | undefined {
  const chunk = String.fromCharCode(...b.subarray(12, 16));
  if (chunk === "VP8 " && b.length >= 30) return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  if (chunk === "VP8L" && b.length >= 25 && b[20] === 0x2f) {
    const bits = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X" && b.length >= 30) return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  return undefined;
}

/** An image's pixel dimensions, read from its header, or `undefined` when they can't be read. */
export function imageSize(bytes: Uint8Array, type: ContentType): ImageSize | undefined {
  let size: ImageSize | undefined;
  if (type === "image/png") size = bytes.length >= 24 ? { width: u32be(bytes, 16), height: u32be(bytes, 20) } : undefined;
  else if (type === "image/gif") size = bytes.length >= 10 ? { width: u16le(bytes, 6), height: u16le(bytes, 8) } : undefined;
  else if (type === "image/jpeg") size = jpegSize(bytes);
  else size = webpSize(bytes);
  return size && size.width > 0 && size.height > 0 ? size : undefined;
}

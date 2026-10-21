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

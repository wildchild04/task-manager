import type { AppServices } from "~/composition";
import { contentTypeOf, detectImageType, MAX_CONTENT_BYTES } from "~/domain/content/content.repository";

export const TOO_BIG = "Images can be at most 10 MB";
export const NOT_AN_IMAGE = "Only PNG, JPEG, GIF and WebP images are accepted";

/**
 * `POST /api/content`: the body is one file's raw bytes. Stores it when it's a
 * supported image within the limit, judged by its bytes, not its declared type.
 */
export async function uploadContent(services: AppServices, request: Request): Promise<Response> {
  if (request.method !== "POST") return Response.json({ message: "Use POST" }, { status: 405 });
  const declared = Number(request.headers.get("content-length"));
  if (declared > MAX_CONTENT_BYTES) return Response.json({ message: TOO_BIG }, { status: 413 });
  const bytes = await readBody(request, MAX_CONTENT_BYTES);
  if (!bytes) return Response.json({ message: TOO_BIG }, { status: 413 });
  const type = detectImageType(bytes);
  if (!type) return Response.json({ message: NOT_AN_IMAGE }, { status: 415 });
  const stored = await services.content.put(bytes, type);
  return Response.json({ ...stored, url: services.content.url(stored.id) }, { status: 201 });
}

/** `GET /content/:id`: a stored item's bytes, cached for good since an item never changes. */
export async function serveContent(services: AppServices, id: string): Promise<Response> {
  const type = contentTypeOf(id);
  const item = type && (await services.content.get(id));
  if (!item) return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
  return new Response(item.bytes as Uint8Array<ArrayBuffer>, {
    headers: {
      "content-type": item.type,
      "content-length": String(item.size),
      "x-content-type-options": "nosniff",
      "content-disposition": "inline",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

/** The request body, or `undefined` once it passes `limit` bytes (reading stops there). */
async function readBody(request: Request, limit: number): Promise<Uint8Array | undefined> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

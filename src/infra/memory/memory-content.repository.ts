import {
  type ContentRepository,
  type ContentType,
  contentIdOf,
  contentTypeOf,
  type StoredContent,
} from "~/domain/content/content.repository";

/** Content in a map, for tests. Same IDs and URLs as the file-system repository. */
export class MemoryContentRepository implements ContentRepository {
  private readonly items = new Map<string, Uint8Array>();

  constructor(private readonly basePath = "") {}

  async put(bytes: Uint8Array, type: ContentType): Promise<StoredContent> {
    const id = await contentIdOf(bytes, type);
    if (!this.items.has(id)) this.items.set(id, bytes.slice());
    return { id, type, size: bytes.byteLength };
  }

  async get(id: string): Promise<(StoredContent & { bytes: Uint8Array }) | undefined> {
    const type = contentTypeOf(id);
    const bytes = type && this.items.get(id);
    return bytes && type ? { id, type, size: bytes.byteLength, bytes: bytes.slice() } : undefined;
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }

  url(id: string): string {
    return `${this.basePath}/content/${id}`;
  }
}

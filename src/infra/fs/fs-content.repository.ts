import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  type ContentRepository,
  type ContentType,
  contentIdOf,
  contentTypeOf,
  type StoredContent,
} from "~/domain/content/content.repository";

/**
 * Content as files under a folder: `<root>/<first two hex chars>/<id>`. Each
 * item is written to a temporary file and renamed into place, so it's there
 * completely or not at all. Served by the app at `<base>/content/<id>`.
 */
export class FsContentRepository implements ContentRepository {
  constructor(
    private readonly root: string,
    /** The path the app is served under (`/task-manager`), empty at the root. */
    private readonly basePath = "",
  ) {}

  async put(bytes: Uint8Array, type: ContentType): Promise<StoredContent> {
    const id = await contentIdOf(bytes, type);
    const stored = { id, type, size: bytes.byteLength };
    const path = this.pathOf(id);
    if (await exists(path)) return stored;
    await mkdir(join(this.root, id.slice(0, 2)), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, bytes);
      await rename(temporary, path);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
    return stored;
  }

  async get(id: string): Promise<(StoredContent & { bytes: Uint8Array }) | undefined> {
    const type = contentTypeOf(id);
    if (!type) return undefined;
    try {
      const bytes = new Uint8Array(await readFile(this.pathOf(id)));
      return { id, type, size: bytes.byteLength, bytes };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    if (!contentTypeOf(id)) return;
    await rm(this.pathOf(id), { force: true });
  }

  url(id: string): string {
    return `${this.basePath}/content/${id}`;
  }

  /** Only called with checked IDs, so the path can't leave the root. */
  private pathOf(id: string): string {
    return join(this.root, id.slice(0, 2), id);
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

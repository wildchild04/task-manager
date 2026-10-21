import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FsContentRepository } from "~/infra/fs/fs-content.repository";
import { MemoryContentRepository } from "~/infra/memory/memory-content.repository";

import { contentRepositoryContract } from "./contract/content-repository.contract";

const tempRoot = () => mkdtemp(join(tmpdir(), "content-"));

contentRepositoryContract("memory", (basePath) => new MemoryContentRepository(basePath));
contentRepositoryContract("file system", async (basePath) => new FsContentRepository(await tempRoot(), basePath));

describe("file-system content", () => {
  it("keeps items in two-character folders and leaves no temporary files", async () => {
    const root = await tempRoot();
    const repo = new FsContentRepository(root);
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1]);
    const { id } = await repo.put(bytes, "image/jpeg");
    await repo.put(bytes, "image/jpeg");
    expect(await readdir(root)).toEqual([id.slice(0, 2)]);
    expect(await readdir(join(root, id.slice(0, 2)))).toEqual([id]);
    expect(Array.from(await readFile(join(root, id.slice(0, 2), id)))).toEqual(Array.from(bytes));
    expect(repo.url(id)).toBe(`/content/${id}`);
  });
});

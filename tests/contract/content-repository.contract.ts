import { beforeEach, describe, expect, it } from "vitest";

import type { ContentRepository } from "~/domain/content/content.repository";

const png = (...extra: number[]) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...extra]);

export function contentRepositoryContract(name: string, factory: (basePath: string) => Promise<ContentRepository> | ContentRepository) {
  describe(`${name}: content repository contract`, () => {
    let repo: ContentRepository;

    beforeEach(async () => {
      repo = await factory("/task-manager");
    });

    it("stores bytes and returns them by ID", async () => {
      const stored = await repo.put(png(1, 2, 3), "image/png");
      expect(stored).toMatchObject({ type: "image/png", size: 11 });
      expect(stored.id).toMatch(/^[0-9a-f]{64}\.png$/);
      const item = await repo.get(stored.id);
      expect(item).toMatchObject(stored);
      expect(Array.from(item!.bytes)).toEqual(Array.from(png(1, 2, 3)));
    });

    it("gives the same ID for the same bytes", async () => {
      const first = await repo.put(png(7), "image/png");
      const second = await repo.put(png(7), "image/png");
      expect(second).toEqual(first);
      expect((await repo.put(png(8), "image/png")).id).not.toBe(first.id);
    });

    it("treats unknown and malformed IDs as missing", async () => {
      expect(await repo.get(`${"0".repeat(64)}.png`)).toBeUndefined();
      expect(await repo.get("../app.sqlite")).toBeUndefined();
      await expect(repo.delete("../app.sqlite")).resolves.toBeUndefined();
    });

    it("deletes an item", async () => {
      const { id } = await repo.put(png(9), "image/png");
      await repo.delete(id);
      expect(await repo.get(id)).toBeUndefined();
      await repo.delete(id);
    });

    it("serves items from the app's content path", async () => {
      const { id } = await repo.put(png(), "image/png");
      expect(repo.url(id)).toBe(`/task-manager/content/${id}`);
    });
  });
}

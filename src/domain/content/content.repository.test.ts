import { describe, expect, it } from "vitest";

import { contentIdOf, contentTypeOf, detectImageType, isContentId } from "./content.repository";

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(values.flatMap((value) => (typeof value === "string" ? Array.from(value, (c) => c.charCodeAt(0)) : [value])));

describe("detectImageType", () => {
  it("reads PNG, JPEG, GIF and WebP signatures", () => {
    expect(detectImageType(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectImageType(bytes("GIF87a"))).toBe("image/gif");
    expect(detectImageType(bytes("GIF89a", 1))).toBe("image/gif");
    expect(detectImageType(bytes("RIFF", 0, 0, 0, 0, "WEBPVP8 "))).toBe("image/webp");
  });

  it("refuses SVG, other files and truncated signatures", () => {
    expect(detectImageType(bytes('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeUndefined();
    expect(detectImageType(bytes("%PDF-1.7"))).toBeUndefined();
    expect(detectImageType(bytes("RIFF", 0, 0, 0, 0, "WAVE"))).toBeUndefined();
    expect(detectImageType(bytes(0x89, "PN"))).toBeUndefined();
    expect(detectImageType(new Uint8Array())).toBeUndefined();
  });
});

describe("content IDs", () => {
  it("are the SHA-256 of the bytes plus the type's extension", async () => {
    const id = await contentIdOf(bytes("abc"), "image/png");
    expect(id).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad.png");
    expect(await contentIdOf(bytes("abc"), "image/jpeg")).toMatch(/\.jpg$/);
    expect(isContentId(id)).toBe(true);
    expect(contentTypeOf(id)).toBe("image/png");
  });

  it("are checked against their form", () => {
    for (const id of ["../app.sqlite", "abc.png", `${"a".repeat(64)}.svg`, `${"A".repeat(64)}.png`, `${"a".repeat(64)}.png/..`]) {
      expect(isContentId(id)).toBe(false);
      expect(contentTypeOf(id)).toBeUndefined();
    }
    expect(contentTypeOf(`${"0".repeat(64)}.webp`)).toBe("image/webp");
  });
});

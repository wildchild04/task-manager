import { describe, expect, it } from "vitest";

import { imageSize } from "~/domain/content/content.repository";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((part) => (typeof part === "string" ? Array.from(part, (c) => c.charCodeAt(0)) : part)));
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le16 = (n: number) => [n & 255, n >> 8];
const le24 = (n: number) => [n & 255, (n >> 8) & 255, n >> 16];

/** A 32×32 JPEG as the browser draws it (JFIF, baseline). */
const JPEG_32 = Uint8Array.from(atob("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAAgACADAREAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD5fr+yz58KACgAoAKACgAoAKACgAoAKACgAoAKACgAoA//2Q=="), (c) => c.charCodeAt(0));

describe("imageSize", () => {
  it("reads a PNG's IHDR", () => {
    const png = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], be32(13), "IHDR", be32(1200), be32(800), [8, 6, 0, 0, 0]);
    expect(imageSize(png, "image/png")).toEqual({ width: 1200, height: 800 });
  });

  it("reads a GIF's screen descriptor", () => {
    expect(imageSize(bytes("GIF89a", le16(320), le16(240), [0, 0, 0]), "image/gif")).toEqual({ width: 320, height: 240 });
  });

  it("finds a JPEG's frame after other segments", () => {
    expect(imageSize(JPEG_32, "image/jpeg")).toEqual({ width: 32, height: 32 });
    const progressive = bytes([0xff, 0xd8], [0xff, 0xe1, 0, 4, 0, 0], [0xff, 0xff], [0xff, 0xc2, 0, 11, 8], [0x02, 0x58, 0x03, 0x20], [1, 1, 0x11, 0]);
    expect(imageSize(progressive, "image/jpeg")).toEqual({ width: 800, height: 600 });
  });

  it("reads each WebP flavour", () => {
    const riff = (chunk: string, body: number[]) => bytes("RIFF", be32(0), "WEBP", chunk, be32(0), body);
    expect(imageSize(riff("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, ...le16(640), ...le16(480)]), "image/webp")).toEqual({ width: 640, height: 480 });
    const lossless = ((100 - 1) | ((50 - 1) << 14)) >>> 0;
    expect(imageSize(riff("VP8L", [0x2f, lossless & 255, (lossless >> 8) & 255, (lossless >> 16) & 255, lossless >>> 24]), "image/webp")).toEqual({ width: 100, height: 50 });
    expect(imageSize(riff("VP8X", [0, 0, 0, 0, ...le24(4095), ...le24(2047)]), "image/webp")).toEqual({ width: 4096, height: 2048 });
  });

  it("gives up on truncated or unknown headers", () => {
    expect(imageSize(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png")).toBeUndefined();
    expect(imageSize(bytes([0xff, 0xd8, 0xff, 0xda, 0, 2]), "image/jpeg")).toBeUndefined();
    expect(imageSize(bytes([0xff, 0xd8, 0xff, 0xe0, 0, 200]), "image/jpeg")).toBeUndefined();
    expect(imageSize(bytes("RIFF", be32(0), "WEBP", "ALPH"), "image/webp")).toBeUndefined();
  });
});

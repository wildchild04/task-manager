import { beforeEach, describe, expect, it } from "vitest";

import { NOT_AN_IMAGE, serveContent, TOO_BIG, uploadContent } from "../../app/lib/content.server";
import { type AppServices, createInMemoryServices } from "~/composition";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff, 0xe0];

describe("content routes", () => {
  let services: AppServices;

  beforeEach(() => {
    services = createInMemoryServices({ basePath: "/task-manager" });
  });

  const upload = async (body: BodyInit, headers: Record<string, string> = {}) => {
    const response = await uploadContent(services, new Request("http://app/api/content", { method: "POST", body, headers }));
    return { status: response.status, body: (await response.json()) as Record<string, any> };
  };

  it("stores a PNG and serves it with its type, nosniff and an immutable cache", async () => {
    const bytes = new Uint8Array([...PNG, ...new Array(300).fill(7)]);
    const { status, body } = await upload(bytes);
    expect(status).toBe(201);
    expect(body).toMatchObject({ type: "image/png", size: 308 });
    expect(body.id).toMatch(/^[0-9a-f]{64}\.png$/);
    expect(body.url).toBe(`/task-manager/content/${body.id}`);

    const served = await serveContent(services, body.id);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
    expect(served.headers.get("x-content-type-options")).toBe("nosniff");
    expect(served.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(Array.from(new Uint8Array(await served.arrayBuffer()))).toEqual(Array.from(bytes));
  });

  it("answers the same ID for the same image", async () => {
    const first = await upload(new Uint8Array([...JPEG, 1]));
    const second = await upload(new Uint8Array([...JPEG, 1]));
    expect(second.body.id).toBe(first.body.id);
    expect(first.body.type).toBe("image/jpeg");
  });

  it("refuses an SVG declared as a PNG, storing nothing", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    expect(await upload(svg, { "content-type": "image/png" })).toEqual({ status: 415, body: { message: NOT_AN_IMAGE } });
  });

  it("refuses an image over 10 MB", async () => {
    const big = new Uint8Array(12 * 1024 * 1024);
    big.set(JPEG);
    expect(await upload(big)).toEqual({ status: 413, body: { message: TOO_BIG } });
  });

  it("refuses a body that grows past the limit without a declared length", async () => {
    const chunk = new Uint8Array(1024 * 1024);
    chunk.set(JPEG);
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent++ < 11) controller.enqueue(chunk);
        else controller.close();
      },
    });
    const request = new Request("http://app/api/content", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    expect((await uploadContent(services, request)).status).toBe(413);
  });

  it("answers 404 for unknown and malformed IDs", async () => {
    expect((await serveContent(services, `${"0".repeat(64)}.png`)).status).toBe(404);
    expect((await serveContent(services, "../app.sqlite")).status).toBe(404);
  });
});

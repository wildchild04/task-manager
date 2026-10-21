import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, type Page, test } from "@playwright/test";

import { createWorkspacePage, paragraphs, resourceName, writeParagraphs } from "./helpers";

test.describe.configure({ mode: "serial" });

/**
 * Spec coverage:
 * - block-editor: Adding images; Image blocks in the editor
 * - content-storage: Uploading images; Serving content
 * - page-viewer: Images
 * - agent-api: Images in Markdown
 */

const contentFolder = fileURLToPath(new URL("../.tmp/content/", import.meta.url));
const images = (page: Page) => page.locator(".editor-body .block-image");
/** What each top-level block is, in order: an image, or a paragraph and its text. */
const outline = (page: Page) =>
  page.locator(".editor-body > div > [data-block], .editor-body > [data-block]").evaluateAll((blocks) =>
    blocks.map((block) => (block.querySelector(".block-image") ? "image" : `text:${block.textContent ?? ""}`)),
  );

/** A real image drawn in the browser: `size` pixels square, as PNG or JPEG bytes (base64). */
async function drawImage(page: Page, size: number, type: "image/png" | "image/jpeg", color = "#c33"): Promise<Buffer> {
  const base64 = await page.evaluate(
    async ({ size, type, color }) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const context = canvas.getContext("2d")!;
      context.fillStyle = color;
      context.fillRect(0, 0, size, size);
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), type));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary);
    },
    { size, type, color },
  );
  return Buffer.from(base64, "base64");
}

type FileSpec = { name: string; type: string; base64?: string; filler?: number };

/** Dispatches a paste or drop carrying files (and optionally text) on an element. */
async function dispatchFiles(
  page: Page,
  selector: string,
  kind: "paste" | "drop",
  files: FileSpec[],
  options: { text?: string; clientY?: number } = {},
) {
  await page.locator(selector).first().evaluate(
    (target, { kind, files, text, clientY }) => {
      const data = new DataTransfer();
      for (const file of files) {
        const bytes = file.base64
          ? Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0))
          : (() => {
              const filler = new Uint8Array(file.filler!);
              filler.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
              return filler;
            })();
        data.items.add(new File([bytes], file.name, { type: file.type }));
      }
      if (text) data.setData("text/plain", text);
      if (kind === "paste") {
        const event = new Event("paste", { bubbles: true, cancelable: true });
        Object.defineProperty(event, "clipboardData", { value: data });
        target.dispatchEvent(event);
      } else {
        const rect = target.getBoundingClientRect();
        for (const type of ["dragover", "drop"]) {
          target.dispatchEvent(
            new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data, clientX: rect.left + 20, clientY: clientY ?? rect.bottom }),
          );
        }
      }
    },
    { kind, files, text: options.text, clientY: options.clientY },
  );
}

const asFile = (name: string, type: string, bytes: Buffer): FileSpec => ({ name, type, base64: bytes.toString("base64") });

test("the Image slash command uploads a picked PNG in place of the paragraph", async ({ page }, testInfo) => {
  await createWorkspacePage(page, resourceName(testInfo, "Slash image"));
  await writeParagraphs(page, [""]);
  const png = await drawImage(page, 40, "image/png");

  await paragraphs(page).first().click();
  const chooser = page.waitForEvent("filechooser");
  await page.keyboard.type("/image");
  await page.keyboard.press("Enter");
  const uploaded = page.waitForResponse((response) => response.url().endsWith("/api/content") && response.status() === 201);
  await (await chooser).setFiles({ name: "shot.png", mimeType: "image/png", buffer: png });
  const { id, url } = (await (await uploaded).json()) as { id: string; url: string };

  await expect(images(page)).toHaveCount(1);
  await expect(images(page).locator("img")).toHaveAttribute("src", url);
  await expect.poll(() => images(page).locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(40);
  expect(await outline(page)).toEqual(["image", "text:"]);
  // The caret is in the empty paragraph after the image.
  await page.keyboard.type("After");
  await expect(paragraphs(page)).toHaveText(["After"]);
  expect(existsSync(`${contentFolder}${id.slice(0, 2)}/${id}`)).toBe(true);

  const served = await page.request.get(url);
  expect(served.headers()["content-type"]).toBe("image/png");
  expect(served.headers()["x-content-type-options"]).toBe("nosniff");
  expect(served.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");

  // Saved: a reload shows it, read-only first and then in the editor.
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(images(page).locator("img")).toHaveAttribute("src", url);
});

test("cancelling the picker leaves the paragraph as it is, without /image", async ({ page }, testInfo) => {
  await createWorkspacePage(page, resourceName(testInfo, "Cancel picker"));
  await writeParagraphs(page, ["Keep"]);
  await paragraphs(page).first().click();
  await page.keyboard.press("End");
  const chooser = page.waitForEvent("filechooser");
  await page.keyboard.type(" /image");
  await page.keyboard.press("Enter");
  await (await chooser).setFiles([]);
  await expect(paragraphs(page)).toHaveText(["Keep "]);
  await expect(images(page)).toHaveCount(0);
});

test("a pasted screenshot follows the paragraph, and one undo removes it", async ({ page }, testInfo) => {
  await createWorkspacePage(page, resourceName(testInfo, "Paste image"));
  await writeParagraphs(page, ["See below", "Last"]);
  const png = await drawImage(page, 24, "image/png", "#3a3");
  await paragraphs(page).first().click();
  await dispatchFiles(page, '.editor-body .editable[data-type="paragraph"]', "paste", [asFile("image.png", "image/png", png)], {
    text: "image.png",
  });
  await expect(images(page)).toHaveCount(1);
  expect(await outline(page)).toEqual(["text:See below", "image", "text:Last"]);
  await page.keyboard.press("Control+z");
  await expect(images(page)).toHaveCount(0);
  expect(await outline(page)).toEqual(["text:See below", "text:Last"]);
});

test("two dropped JPEGs follow the block under the pointer, in order; other files do nothing", async ({ page }, testInfo) => {
  await createWorkspacePage(page, resourceName(testInfo, "Drop images"));
  await writeParagraphs(page, ["First", "Second", "Third"]);
  const small = await drawImage(page, 16, "image/jpeg");
  const large = await drawImage(page, 32, "image/jpeg", "#33c");
  const second = paragraphs(page).nth(1);
  const box = (await second.boundingBox())!;
  await dispatchFiles(page, ".page-editor", "drop", [asFile("a.jpg", "image/jpeg", small), asFile("b.jpg", "image/jpeg", large)], {
    clientY: box.y + box.height - 2,
  });
  await expect(images(page)).toHaveCount(2);
  expect(await outline(page)).toEqual(["text:First", "text:Second", "image", "image", "text:Third"]);
  await expect
    .poll(() => images(page).locator("img").evaluateAll((all) => all.map((img) => (img as HTMLImageElement).naturalWidth)))
    .toEqual([16, 32]);

  await dispatchFiles(page, ".page-editor", "drop", [{ name: "notes.txt", type: "text/plain", base64: btoa("hello") }]);
  await page.waitForTimeout(300);
  await expect(images(page)).toHaveCount(2);
  expect(await outline(page)).toEqual(["text:First", "text:Second", "image", "image", "text:Third"]);
});

test("a file that's too big is named, and the others are still added", async ({ page }, testInfo) => {
  await createWorkspacePage(page, resourceName(testInfo, "Too big"));
  await writeParagraphs(page, ["Here"]);
  const png = await drawImage(page, 8, "image/png");
  await paragraphs(page).first().click();
  await dispatchFiles(page, '.editor-body .editable[data-type="paragraph"]', "paste", [
    { name: "huge.png", type: "image/png", filler: 20 * 1024 * 1024 },
    asFile("small.png", "image/png", png),
  ]);
  await expect(page.getByRole("alert")).toContainText("huge.png is too big: images can be at most 10 MB");
  await expect(images(page)).toHaveCount(1);

  // The server refuses one that claims to be an image but isn't, by its bytes.
  const svg = await page.request.post("/api/content", { data: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), headers: { "content-type": "image/png" } });
  expect(svg.status()).toBe(415);
});

test("Backspace after an image keeps it; alt text is edited from the handle menu and undone", async ({ page }, testInfo) => {
  await createWorkspacePage(page, resourceName(testInfo, "Image editing"));
  await writeParagraphs(page, ["Before", "After"]);
  const png = await drawImage(page, 20, "image/png");
  await paragraphs(page).first().click();
  await dispatchFiles(page, '.editor-body .editable[data-type="paragraph"]', "paste", [asFile("x.png", "image/png", png)]);
  await expect(images(page)).toHaveCount(1);

  await paragraphs(page).nth(1).click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("!");
  expect(await outline(page)).toEqual(["text:Before!", "image", "text:After"]);
  // Arrow keys step over it (keeping the caret's horizontal place).
  await page.keyboard.press("ArrowDown");
  await page.keyboard.type("?");
  expect(await outline(page)).toEqual(["text:Before!", "image", "text:After?"]);

  const block = page.locator(".editor-body [data-block]").filter({ has: page.locator(".block-image") });
  await block.hover();
  await block.getByRole("button", { name: "Drag to move, or open block actions" }).click();
  await page.getByRole("menuitem", { name: "Alt text…" }).click();
  const dialog = page.getByRole("dialog", { name: "Alt text" });
  await dialog.getByRole("textbox").fill("Server rack, front view");
  await dialog.getByRole("textbox").press("Enter");
  await expect(images(page).locator("img")).toHaveAttribute("alt", "Server rack, front view");
  await page.keyboard.press("Control+z");
  await expect(images(page).locator("img")).toHaveAttribute("alt", "");
});

test("an external image from pasted Markdown shows its error state when broken, and agents read images back", async ({ page }, testInfo) => {
  await createWorkspacePage(page, resourceName(testInfo, "External image"));
  await writeParagraphs(page, ["Start"]);
  const png = await drawImage(page, 12, "image/png");
  await paragraphs(page).first().click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await paragraphs(page).nth(1).evaluate((target) => {
    const data = new DataTransfer();
    data.setData("text/plain", "![Broken chart](http://127.0.0.1:57321/missing.png)");
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: data });
    target.dispatchEvent(event);
  });
  await expect(images(page)).toHaveCount(1);
  await expect(images(page).getByRole("img", { name: "Broken chart" })).toContainText("Image unavailable: Broken chart");

  await paragraphs(page).first().click();
  const uploaded = page.waitForResponse((response) => response.url().endsWith("/api/content") && response.status() === 201);
  await dispatchFiles(page, '.editor-body .editable[data-type="paragraph"]', "paste", [asFile("shot.png", "image/png", png)]);
  const { id } = (await (await uploaded).json()) as { id: string };
  await expect(images(page)).toHaveCount(2);

  // Once saved, an agent reads both: the uploaded one by its absolute URL.
  const pageId = new URL(page.url()).pathname.split("/").at(-1)!;
  const readAsAgent = async () => {
    const read = await page.request.get(`/api/agent/page/${pageId}`, {
      headers: { authorization: "Bearer playwright-agent-token", "x-agent-name": "playwright" },
    });
    return ((await read.json()) as { markdown: string }).markdown;
  };
  await expect.poll(readAsAgent).toContain(`![](http://127.0.0.1:57321/content/${id})`);
  expect(await readAsAgent()).toContain("![Broken chart](http://127.0.0.1:57321/missing.png)");
});

import { describe, expect, it } from "vitest";

import * as text from "~/editor/rich-text";

const bold = [{ text: "Hello ", marks: ["bold" as const] }, { text: "world" }];

describe("rich text editing", () => {
  it("normalizes: drops empty spans and merges equal neighbours", () => {
    expect(text.normalize([{ text: "a" }, { text: "" }, { text: "b", marks: [] }, { text: "c", marks: ["bold"] }])).toEqual([
      { text: "ab" },
      { text: "c", marks: ["bold"] },
    ]);
  });

  it("slices and joins at offsets, keeping marks", () => {
    expect(text.slice(bold, 3, 8)).toEqual([{ text: "lo ", marks: ["bold"] }, { text: "wo" }]);
    expect(text.concat(text.slice(bold, 0, 3), text.slice(bold, 3))).toEqual(bold);
  });

  it("types with the marks of the text before the caret", () => {
    expect(text.insert(bold, 2, "X")).toEqual([{ text: "HeXllo ", marks: ["bold"] }, { text: "world" }]);
    expect(text.insert(bold, 6, "X")).toEqual([{ text: "Hello X", marks: ["bold"] }, { text: "world" }]);
    expect(text.insert(bold, 0, "X")).toEqual([{ text: "XHello ", marks: ["bold"] }, { text: "world" }]);
  });

  it("doesn't extend a link past its end, but types inside it", () => {
    const linked = [{ text: "site", marks: [{ type: "link" as const, href: "https://x.dev" }] }];
    expect(text.insert(linked, 4, "!")).toEqual([...linked, { text: "!" }]);
    expect(text.insert(linked, 2, "!")[0]).toEqual({ text: "si!te", marks: [{ type: "link", href: "https://x.dev" }] });
  });

  it("replaces a selection with the marks of its first character", () => {
    expect(text.replace(bold, 4, 8, "-")).toEqual([{ text: "Hell-", marks: ["bold"] }, { text: "rld" }]);
  });

  it("toggles a mark on and off over a range", () => {
    const on = text.toggleMark(bold, 6, 11, "bold");
    expect(on).toEqual([{ text: "Hello world", marks: ["bold"] }]);
    expect(text.toggleMark(on, 0, 5, "bold")).toEqual([{ text: "Hello" }, { text: " world", marks: ["bold"] }]);
    expect(text.toggleMark(bold, 3, 8, "italic")).toEqual([
      { text: "Hel", marks: ["bold"] },
      { text: "lo ", marks: ["bold", "italic"] },
      { text: "wo", marks: ["italic"] },
      { text: "rld" },
    ]);
  });

  it("sets, reads and removes links", () => {
    const linked = text.setLink(bold, 6, 11, "https://x.dev");
    expect(text.linkAt(linked, 6, 11)).toBe("https://x.dev");
    expect(text.linkAt(linked, 4, 11)).toBeUndefined();
    expect(text.setLink(linked, 6, 11, null)).toEqual(bold);
  });

  it("moves by characters and words, keeping emoji whole", () => {
    expect(text.previousCharacter("a👍b", 3)).toBe(1);
    expect(text.nextCharacter("a👍b", 1)).toBe(3);
    expect(text.previousWord("hello big world", 15)).toBe(10);
    expect(text.previousWord("hello big  ", 11)).toBe(6);
    expect(text.nextWord("hello big world", 5)).toBe(9);
  });
});

describe("link around the caret", () => {
  const link = { type: "link" as const, href: "https://x.dev" };
  const content = [{ text: "see " }, { text: "the ", marks: [link] }, { text: "site", marks: ["bold" as const, link] }, { text: " now" }];

  it("finds the whole link from inside it or touching either end, across differently marked spans", () => {
    for (const offset of [4, 6, 12]) expect(text.linkRangeAt(content, offset)).toEqual({ start: 4, end: 12, href: "https://x.dev" });
  });

  it("finds nothing away from links", () => {
    expect(text.linkRangeAt(content, 2)).toBeUndefined();
    expect(text.linkRangeAt(content, 14)).toBeUndefined();
  });
});

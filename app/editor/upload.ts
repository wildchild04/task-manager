import { MAX_CONTENT_BYTES } from "~/domain/content/content.repository";

import { withBase } from "../lib/base-path";

/** What the file picker offers, and what pasting or dropping takes as images. */
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/gif,image/webp";

/** The image files among pasted or dropped files (other files are left alone). */
export const imageFiles = (files: Iterable<File> | ArrayLike<File>) => Array.from(files).filter((file) => file.type.startsWith("image/"));

/** An uploaded image: its content ID and the URL it loads from. */
export type Uploaded = { id: string; url: string };

/**
 * Uploads files one at a time, in order. Returns the uploaded images and, for
 * each file refused or failed, a message naming it and why.
 */
export async function uploadImages(files: readonly File[]): Promise<{ uploaded: Uploaded[]; errors: string[] }> {
  const uploaded: Uploaded[] = [];
  const errors: string[] = [];
  for (const file of files) {
    const name = file.name || "The image";
    if (file.size > MAX_CONTENT_BYTES) {
      errors.push(`${name} is too big: images can be at most 10 MB`);
      continue;
    }
    try {
      const response = await fetch(withBase("/api/content"), { method: "POST", body: file });
      if (response.status === 201) {
        const body = (await response.json()) as { id: string; url: string };
        uploaded.push({ id: body.id, url: body.url });
      } else if (response.status === 413) {
        errors.push(`${name} is too big: images can be at most 10 MB`);
      } else if (response.status === 415) {
        errors.push(`${name} isn't a supported image: use PNG, JPEG, GIF or WebP`);
      } else {
        errors.push(`${name} couldn't be uploaded`);
      }
    } catch {
      errors.push(`${name} couldn't be uploaded`);
    }
  }
  return { uploaded, errors };
}

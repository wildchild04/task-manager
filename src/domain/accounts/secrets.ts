import { createHash, scryptSync, timingSafeEqual } from "node:crypto";

/** Random bytes; injected so tests are deterministic. */
export type RandomBytes = (size: number) => Buffer;

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;

/** `scrypt$N$r$p$salt$hash`, salt and hash in base64url. */
export function hashPassword(password: string, salt: Buffer): string {
  const hash = scryptSync(password.normalize("NFKC"), salt, KEY_LENGTH, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = scryptSync(password.normalize("NFKC"), Buffer.from(salt, "base64url"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** SHA-256 of a random token, in base64url: enough for secrets that are random themselves. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("base64url");

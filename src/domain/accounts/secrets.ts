import { createCipheriv, createDecipheriv, createHash, randomBytes as cryptoRandomBytes, scryptSync, timingSafeEqual } from "node:crypto";

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

/** Keeps agents' tokens encrypted at rest, so they can be shown again. */
export interface TokenCipher {
  /** `context` (the agent's ID) is bound to the ciphertext: it decrypts only with the same one. */
  encrypt(plain: string, context: string): string;
  /** `undefined` when it can't be decrypted (another key or context). */
  decrypt(stored: string, context: string): string | undefined;
}

export const SECRET_KEY_MIN = 32;

/** AES-256-GCM under the SHA-256 of `SECRET_KEY`, stored as `v1.<iv>.<ciphertext+tag>` in base64url. */
export class AesTokenCipher implements TokenCipher {
  private readonly key: Buffer;

  constructor(
    secret: string,
    private readonly randomBytes: RandomBytes = cryptoRandomBytes,
  ) {
    if (secret.length < SECRET_KEY_MIN) throw new Error(`SECRET_KEY must be at least ${SECRET_KEY_MIN} characters`);
    this.key = createHash("sha256").update(secret).digest();
  }

  encrypt(plain: string, context: string): string {
    const iv = this.randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv).setAAD(Buffer.from(context));
    const sealed = Buffer.concat([cipher.update(plain, "utf8"), cipher.final(), cipher.getAuthTag()]);
    return ["v1", iv.toString("base64url"), sealed.toString("base64url")].join(".");
  }

  decrypt(stored: string, context: string): string | undefined {
    const [version, iv, sealed] = stored.split(".");
    if (version !== "v1" || !iv || !sealed) return undefined;
    const bytes = Buffer.from(sealed, "base64url");
    try {
      const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(iv, "base64url")).setAAD(Buffer.from(context));
      decipher.setAuthTag(bytes.subarray(bytes.length - 16));
      return Buffer.concat([decipher.update(bytes.subarray(0, bytes.length - 16)), decipher.final()]).toString("utf8");
    } catch {
      return undefined;
    }
  }
}

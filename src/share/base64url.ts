/**
 * Browser-safe base64url <-> UTF-8 string codec. NO node `Buffer` at import
 * time: it prefers `btoa`/`atob` (browser) and falls back to a guarded `Buffer`
 * only at CALL time (node/dev scripts). Both encode the SAME bytes, so a string
 * shared in one environment decodes in the other.
 *
 * base64url (RFC 4648 §5): `+`->`-`, `/`->`_`, padding `=` stripped — so the
 * output is URL- and copy-paste-safe (no characters needing escaping).
 */

function utf8ToBytes(str: string): number[] {
  // encodeURIComponent yields %XX for every non-ASCII byte; decode back to bytes.
  const escaped = encodeURIComponent(str);
  const bytes: number[] = [];
  for (let i = 0; i < escaped.length; i += 1) {
    const ch = escaped[i];
    if (ch === "%") {
      bytes.push(parseInt(escaped.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(ch.charCodeAt(0));
    }
  }
  return bytes;
}

function bytesToUtf8(bytes: number[]): string {
  let escaped = "";
  for (const b of bytes) {
    escaped += "%" + b.toString(16).padStart(2, "0");
  }
  return decodeURIComponent(escaped);
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Pure base64 (standard alphabet) over a byte array — no platform globals. */
function bytesToBase64(bytes: number[]): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? "=" : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? "=" : B64[b2 & 63];
  }
  return out;
}

function base64ToBytes(b64: string): number[] {
  const clean = b64.replace(/=+$/, "");
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const v = B64.indexOf(ch);
    if (v < 0) continue;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytes;
}

/** Encode a UTF-8 string to base64url. */
export function encodeBase64Url(input: string): string {
  const b64 = bytesToBase64(utf8ToBytes(input));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode a base64url string back to UTF-8. Inverse of `encodeBase64Url`. */
export function decodeBase64Url(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  return bytesToUtf8(base64ToBytes(b64));
}

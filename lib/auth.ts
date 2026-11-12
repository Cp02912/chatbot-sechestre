// Autentificare simplă cu parolă unică. Doar Web Crypto — compatibil edge și Node.
export const COOKIE_NAME = "hotarari_auth";
export const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const enc = new TextEncoder();

export function authEnabled(): boolean {
  return !!process.env.APP_PASSWORD;
}

/** În producție fără APP_PASSWORD aplicația refuză să funcționeze. */
export function misconfigured(): boolean {
  return process.env.NODE_ENV === "production" && !process.env.APP_PASSWORD;
}

function secretMaterial(): string {
  return process.env.AUTH_SECRET || `pw:${process.env.APP_PASSWORD || ""}`;
}

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secretMaterial()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

/** Comparație în timp constant (pe lungimi egale). */
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

async function sha256Hex(s: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

export async function passwordMatches(input: string): Promise<boolean> {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return false;
  return safeEqual(await sha256Hex(input), await sha256Hex(pw));
}

export async function createToken(): Promise<string> {
  const exp = Date.now() + MAX_AGE_SECONDS * 1000;
  return `${exp}.${await hmac(`v1.${exp}`)}`;
}

export async function verifyToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!sig || !Number.isFinite(exp) || exp < Date.now()) return false;
  return safeEqual(sig, await hmac(`v1.${exp}`));
}

function cookieFrom(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

/** Protecție la nivel de rută API (în plus față de middleware). Returnează un Response dacă accesul e refuzat. */
export async function guard(req: Request): Promise<Response | null> {
  if (misconfigured()) {
    return Response.json({ error: "Serverul nu este configurat: lipsește APP_PASSWORD." }, { status: 503 });
  }
  if (!authEnabled()) return null;
  if (await verifyToken(cookieFrom(req.headers.get("cookie"), COOKIE_NAME))) return null;
  return Response.json({ error: "Neautentificat." }, { status: 401 });
}

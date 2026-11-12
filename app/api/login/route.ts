import { COOKIE_NAME, MAX_AGE_SECONDS, authEnabled, createToken, misconfigured, passwordMatches } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (misconfigured()) return Response.json({ error: "Lipsește APP_PASSWORD." }, { status: 503 });
  if (!authEnabled()) return Response.json({ ok: true });
  let password = "";
  try {
    const b = await req.json();
    password = typeof b?.password === "string" ? b.password : "";
  } catch {
    /* gol */
  }
  if (!(await passwordMatches(password))) {
    await new Promise((r) => setTimeout(r, 800));
    return Response.json({ error: "Parolă incorectă." }, { status: 401 });
  }
  const token = await createToken();
  const secure = process.env.NODE_ENV === "production" || req.headers.get("x-forwarded-proto") === "https";
  const cookie = [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    `Max-Age=${MAX_AGE_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json", "set-cookie": cookie },
  });
}

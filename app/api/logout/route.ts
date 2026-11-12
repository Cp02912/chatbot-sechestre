import { COOKIE_NAME } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "content-type": "application/json",
      "set-cookie": `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
    },
  });
}

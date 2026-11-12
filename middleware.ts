import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, authEnabled, misconfigured, verifyToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (misconfigured()) {
    if (isApi) return NextResponse.json({ error: "Serverul nu este configurat: lipsește APP_PASSWORD." }, { status: 503 });
    return new NextResponse(
      '<!doctype html><html lang="ro"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hotărâri — căutare</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#111"><p>Aplicația nu este configurată: lipsește variabila de mediu <code>APP_PASSWORD</code>.</p></body></html>',
      { status: 503, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }
  if (!authEnabled()) return NextResponse.next();

  if (pathname === "/login" || pathname === "/api/login" || pathname === "/api/logout") return NextResponse.next();

  if (await verifyToken(req.cookies.get(COOKIE_NAME)?.value)) return NextResponse.next();

  if (isApi) return NextResponse.json({ error: "Neautentificat." }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

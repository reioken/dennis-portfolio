const COOKIE = "fd_studio_ok";

const STUDIO_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; upgrade-insecure-requests";

const OVERLAY_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; upgrade-insecure-requests";

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

/** Strip duplicate global CSP/XFO so Firefox can frame overlay.html */
function withStudioHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  headers.delete("Content-Security-Policy");
  headers.delete("X-Frame-Options");
  headers.delete("Cross-Origin-Opener-Policy");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  const isOverlay =
    pathname === "/studio/overlay" ||
    pathname === "/studio/overlay/" ||
    pathname.endsWith("/overlay.html");
  headers.set("Content-Security-Policy", isOverlay ? OVERLAY_CSP : STUDIO_CSP);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const password = env.STUDIO_PASSWORD || "penis123";

  if (url.pathname === "/studio/api/login" && request.method === "POST") {
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    if (String(body.password || "") === String(password)) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": `${COOKIE}=1; Path=/studio; HttpOnly; Secure; SameSite=Lax; Max-Age=1209600`,
        },
      });
    }
    return new Response(JSON.stringify({ ok: false }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (url.pathname === "/studio/api/logout") {
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `${COOKIE}=; Path=/studio; Max-Age=0`,
      },
    });
  }

  const publicExact = new Set([
    "/studio/login.html",
    "/studio/login",
    "/studio/login/",
    "/studio/login/index.html",
    "/studio/login.js",
    "/studio/styles.css",
    "/studio/favicon.ico",
    "/studio/assets/studio_mark.png",
    "/studio/assets/logos/floordirekt-studio-lockup.png",
  ]);
  if (publicExact.has(url.pathname)) {
    return withStudioHeaders(await next(), url.pathname);
  }

  const cookie = request.headers.get("Cookie") || "";
  const authed = cookie.split(";").some((c) => c.trim() === `${COOKIE}=1`);
  if (!authed) {
    if (url.pathname.startsWith("/studio/api/")) return unauthorized();
    return Response.redirect(new URL("/studio/login/", url), 302);
  }

  return withStudioHeaders(await next(), url.pathname);
}

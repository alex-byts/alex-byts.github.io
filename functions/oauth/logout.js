import { sha256Base64Url } from "../_shared/crypto.js";
import { parseCookies, clearSessionCookie } from "../_shared/cookies.js";

export async function onRequestPost(context) {
  const origin = context.request.headers.get("Origin");
  const expectedOrigin = context.env.PUBLIC_BASE_URL;

  if (origin !== expectedOrigin) {
    return new Response("Origem inválida", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const cookies = parseCookies(context.request);
  const sessionValue = cookies["__Host-session"];

  if (sessionValue) {
    const sessionIdHash = await sha256Base64Url(sessionValue);
    await context.env.DB.prepare(`DELETE FROM sessions WHERE id_hash = ?`)
      .bind(sessionIdHash).run();
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Set-Cookie": clearSessionCookie(),
      "Cache-Control": "no-store",
    },
  });
}
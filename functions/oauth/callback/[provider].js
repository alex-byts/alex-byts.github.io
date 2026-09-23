import { sha256Base64Url } from "../../_shared/crypto.js";
import { parseCookies, clearTxCookie, setSessionCookie } from "../../_shared/cookies.js";
import { PROVIDERS, getClientCreds } from "../../_shared/providers.js";
import { verifyGoogleIdToken } from "../../_shared/oidc.js";
import { randomToken } from "../../_shared/crypto.js";

export async function onRequestGet(context) {
  const { provider } = context.params;
  if (!PROVIDERS[provider]) {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(context.request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error || !code || !state) {
    return new Response("Falha na autorização", { status: 400 });
  }

  // 1. Exige o cookie de transação
  const cookies = parseCookies(context.request);
  const txCookieValue = cookies["__Host-oauth-tx"];
  if (!txCookieValue) {
    return new Response("Transação ausente", { status: 400 });
  }

  // 2. Localiza a transação no D1 pelo hash do cookie
  const txIdHash = await sha256Base64Url(txCookieValue);
  const now = Math.floor(Date.now() / 1000);
  const tx = await context.env.DB.prepare(
    `SELECT * FROM oauth_transactions WHERE id_hash = ? AND expires_at > ?`
  ).bind(txIdHash, now).first();

  if (!tx) {
    return new Response("Transação inválida ou expirada", { status: 400 });
  }

  // 3. Confere o state
  const stateHash = await sha256Base64Url(state);
  if (stateHash !== tx.state_hash) {
    return new Response("State inválido", { status: 400 });
  }

  // 4. Apaga a transação ANTES de prosseguir (evita reutilização)
  await context.env.DB.prepare(`DELETE FROM oauth_transactions WHERE id_hash = ?`)
    .bind(txIdHash).run();

  const cfg = PROVIDERS[provider];
  const { id: clientId, secret: clientSecret } = getClientCreds(context.env, provider);
  const baseUrl = context.env.PUBLIC_BASE_URL;
  const redirectUri = `${baseUrl}/oauth/callback/${provider}`;

  // 5. Troca o código pelo token
  const tokenRes = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: tx.code_verifier,
    }),
  });

  if (!tokenRes.ok) {
    return new Response("Falha ao trocar o código", { status: 400 });
  }
  const tokenData = await tokenRes.json();

  let identity;

  if (provider === "google") {
    // 6a. Valida o id_token criptograficamente
    identity = await verifyGoogleIdToken(tokenData.id_token, tx.nonce, context.env);
    identity.issuer = "https://accounts.google.com";
  } else {
    // 6b. GitHub: usa o access_token para consultar o perfil
    if (!tokenData.access_token || !/^bearer$/i.test(tokenData.token_type || "")) {
      return new Response("Resposta de token inválida", { status: 400 });
    }
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10",
        "User-Agent": "oauth-lab-alex",
      },
    });
    if (!userRes.ok) {
      return new Response("Falha ao consultar perfil do GitHub", { status: 400 });
    }
    const userData = await userRes.json();
    if (!Number.isInteger(userData.id)) {
      return new Response("Perfil do GitHub inválido", { status: 400 });
    }

    identity = {
      issuer: "https://github.com",
      subject: String(userData.id),
      email: userData.email || null,
      displayName: userData.name || userData.login || null,
    };

    // 7. Revoga a autorização concedida à OAuth App (limpa o access_token do lado do GitHub)
    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    const revokeRes = await fetch(
      `https://api.github.com/applications/${clientId}/grant`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2026-03-10",
          "User-Agent": "oauth-lab-alex",
        },
        body: JSON.stringify({ access_token: tokenData.access_token }),
      }
    );
    if (revokeRes.status !== 204) {
      return new Response("Falha ao revogar autorização do GitHub", { status: 400 });
    }
  }

  // 8. Cria a sessão local opaca
  const sessionValue = randomToken();
  const sessionIdHash = await sha256Base64Url(sessionValue);
  const sessionExpiresAt = now + 8 * 60 * 60; // 8 horas

  await context.env.DB.prepare(
    `INSERT INTO sessions (id_hash, issuer, subject, email, display_name, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    sessionIdHash,
    identity.issuer,
    identity.subject,
    identity.email,
    identity.displayName,
    sessionExpiresAt,
    now
  ).run();

  // 9. Limpa o cookie temporário e define o cookie de sessão; redireciona
  const headers = new Headers();
  headers.append("Set-Cookie", clearTxCookie());
  headers.append("Set-Cookie", setSessionCookie(sessionValue));
  headers.set("Location", baseUrl);

  return new Response(null, { status: 302, headers });
}
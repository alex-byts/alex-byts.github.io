import { randomToken, sha256Base64Url } from "../../_shared/crypto.js";
import { setTxCookie } from "../../_shared/cookies.js";
import { PROVIDERS, getClientCreds } from "../../_shared/providers.js";

export async function onRequestGet(context) {
  const { provider } = context.params;
  if (!PROVIDERS[provider]) {
    return new Response("Not found", { status: 404 });
  }

  const cfg = PROVIDERS[provider];
  const { id: clientId } = getClientCreds(context.env, provider);
  const baseUrl = context.env.PUBLIC_BASE_URL;

  // Valores da transação
  const txCookieValue = randomToken();
  const state = randomToken();
  const codeVerifier = randomToken();
  const nonce = provider === "google" ? randomToken() : null;

  const codeChallenge = await sha256Base64Url(codeVerifier);
  const txIdHash = await sha256Base64Url(txCookieValue);
  const stateHash = await sha256Base64Url(state);

  const expiresAt = Math.floor(Date.now() / 1000) + 600; // 10 min

  await context.env.DB.prepare(
    `INSERT INTO oauth_transactions (id_hash, provider, state_hash, nonce, code_verifier, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(txIdHash, provider, stateHash, nonce, codeVerifier, expiresAt).run();

  const redirectUri = `${baseUrl}/oauth/callback/${provider}`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  if (cfg.scope) params.set("scope", cfg.scope);
  if (nonce) params.set("nonce", nonce);

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${cfg.authorizeUrl}?${params.toString()}`,
      "Set-Cookie": setTxCookie(txCookieValue),
    },
  });
}
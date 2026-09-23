// Decodifica uma string Base64URL de volta para bytes
function base64UrlDecode(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "===".slice((padded.length + 3) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlDecodeToJson(str) {
  const bytes = base64UrlDecode(str);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text);
}

export async function verifyGoogleIdToken(idToken, expectedNonce, env) {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("id_token malformado");
  }
  const [headerB64, payloadB64, signatureB64] = parts;

  const header = base64UrlDecodeToJson(headerB64);
  if (header.alg !== "RS256") {
    throw new Error("algoritmo inesperado");
  }

  // 1. Descobre o endpoint de chaves públicas do Google
  const discoveryRes = await fetch("https://accounts.google.com/.well-known/openid-configuration");
  const discovery = await discoveryRes.json();

  // 2. Busca o conjunto de chaves públicas (JWKS)
  const jwksRes = await fetch(discovery.jwks_uri);
  const jwks = await jwksRes.json();

  // 3. Seleciona a chave certa pelo "kid" do cabeçalho
  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    throw new Error("chave pública não encontrada");
  }

  // 4. Importa a chave pública para o formato que a Web Crypto API entende
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  // 5. Verifica a assinatura sobre "header.payload" (exatamente como veio, sem re-serializar)
  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlDecode(signatureB64);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signature,
    signedData
  );
  if (!valid) {
    throw new Error("assinatura inválida");
  }

  // 6. Só depois de confirmar a assinatura, confia no conteúdo (claims)
  const payload = base64UrlDecodeToJson(payloadB64);
  const now = Math.floor(Date.now() / 1000);

  if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") {
    throw new Error("issuer inválido");
  }
  if (payload.aud !== env.GOOGLE_CLIENT_ID) {
    throw new Error("audience inválida");
  }
  if (payload.exp < now) {
    throw new Error("token expirado");
  }
  if (payload.iat > now + 60) {
    throw new Error("iat no futuro");
  }
  if (payload.nonce !== expectedNonce) {
    throw new Error("nonce não corresponde");
  }

  return {
    subject: payload.sub,
    email: payload.email || null,
    displayName: payload.name || null,
  };
}
export function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const cookies = {};
  header.split(";").forEach((part) => {
    const [key, ...rest] = part.trim().split("=");
    if (key) cookies[key] = rest.join("=");
  });
  return cookies;
}

export function setTxCookie(value) {
  return `__Host-oauth-tx=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
}

export function clearTxCookie() {
  return `__Host-oauth-tx=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function setSessionCookie(value) {
  return `__Host-session=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`;
}

export function clearSessionCookie() {
  return `__Host-session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
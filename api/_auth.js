const crypto = require("node:crypto");

const LOGIN_ID = process.env.RSI_LOGIN_ID || "kim";
const LOGIN_PASSWORD = process.env.RSI_LOGIN_PASSWORD || "1234";
const SESSION_COOKIE = "rsi_signal_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const SESSION_SECRET = process.env.RSI_SESSION_SECRET || "rsi-signal-local-secret";

function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const separator = item.indexOf("=");
        if (separator === -1) return [item, ""];
        return [item.slice(0, separator), decodeURIComponent(item.slice(separator + 1))];
      })
  );
}

function timingSafeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function sign(payload) {
  return crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");
}

function createSessionToken(id) {
  const payload = Buffer.from(JSON.stringify({
    id,
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000
  })).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

function readSession(request) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !timingSafeEqualText(signature, sign(payload))) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session.id || session.expiresAt < Date.now()) return null;
    return { id: session.id };
  } catch {
    return null;
  }
}

function setSessionCookie(response, token) {
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=${SESSION_TTL_SECONDS}`
  );
}

function clearSessionCookie(response) {
  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=0`);
}

function requireSession(request, response) {
  const user = readSession(request);
  if (!user) {
    response.status(401).json({ error: "login required" });
    return null;
  }
  return user;
}

function credentialsAreValid(id, password) {
  return timingSafeEqualText(id, LOGIN_ID) && timingSafeEqualText(password, LOGIN_PASSWORD);
}

module.exports = {
  clearSessionCookie,
  createSessionToken,
  credentialsAreValid,
  readSession,
  requireSession,
  setSessionCookie
};

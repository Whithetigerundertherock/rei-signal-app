const {
  createSessionToken,
  credentialsAreValid,
  setSessionCookie
} = require("./_auth");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "method not allowed" });
    return;
  }

  const body = request.body && typeof request.body === "object" ? request.body : {};
  const id = String(body.id || "").trim();
  const password = String(body.password || "");

  if (!credentialsAreValid(id, password)) {
    response.status(401).json({ error: "아이디 또는 비밀번호가 맞지 않습니다." });
    return;
  }

  setSessionCookie(response, createSessionToken(id));
  response.status(200).json({ ok: true, user: { id } });
};

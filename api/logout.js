const { clearSessionCookie } = require("./_auth");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "method not allowed" });
    return;
  }

  clearSessionCookie(response);
  response.status(200).json({ ok: true });
};

const { requireSession } = require("../_auth");

async function readBody(request) {
  if (request.body && typeof request.body === "object") return request.body;

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

module.exports = async function handler(request, response) {
  if (!requireSession(request, response)) return;

  if (request.method !== "POST") {
    response.status(405).json({ error: "method not allowed" });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    response.status(400).json({ error: "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required" });
    return;
  }

  const body = await readBody(request);
  const text = String(body.text || "").trim();

  if (!text) {
    response.status(400).json({ error: "text is required" });
    return;
  }

  const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  });

  const payload = await telegramResponse.json().catch(() => ({}));

  if (!telegramResponse.ok || payload.ok === false) {
    response.status(502).json({ error: payload.description || "telegram request failed" });
    return;
  }

  response.status(200).json({ ok: true });
};

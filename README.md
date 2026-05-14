# RSI Signal App

Dark mobile web prototype for RSI alerts and AI stock recommendations.

Run locally for development:

```bash
npm start
```

Then visit http://127.0.0.1:5175/

Telegram alerts are sent through the local server when alert RSI conditions are triggered.
Set these environment variables before starting the server:

```bash
TELEGRAM_BOT_TOKEN=your_bot_token TELEGRAM_CHAT_ID=your_chat_id node server.js
```

## Render deployment

This repo includes `render.yaml` for a Render web service with a persistent disk.

Use a paid Render instance type such as `starter`. Render Free web services spin down after idle time, and their local filesystem is ephemeral, so they are not suitable for always-on RSI alerts.

Required Render environment variables:

```bash
RSI_LOGIN_ID=your_login_id
RSI_LOGIN_PASSWORD=your_login_password
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

Applied alert settings are saved under `ALERT_DATA_DIR` (`/var/data` on Render). Keep the Render service running to receive Telegram alerts even when the web page is closed.

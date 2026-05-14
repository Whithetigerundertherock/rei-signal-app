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

This repo includes `render.yaml` for a Render Free web service.

Render Free web services spin down after idle time, and their local filesystem is ephemeral. For free alert checks while the web page is closed, configure an external scheduler such as cron-job.org to call the cron endpoint every 5-10 minutes.

Required Render environment variables:

```bash
RSI_LOGIN_ID=your_login_id
RSI_LOGIN_PASSWORD=your_login_password
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
CRON_SECRET=long_random_secret
```

Cron URL:

```bash
https://YOUR_RENDER_URL/api/cron/check-alerts?secret=CRON_SECRET
```

Applied alert settings are saved to the service filesystem. On Render Free, re-apply alert settings after a redeploy, restart, or spin-down if they disappear.

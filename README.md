# RSI Signal App

Dark mobile web prototype for RSI alerts and AI stock recommendations.

Open with the local indicator server:

```bash
cd rsi-signal-app
node server.js
```

Then visit http://127.0.0.1:5175/

Telegram alerts are sent through the local server when alert RSI conditions are triggered.
Set these environment variables before starting the server:

```bash
TELEGRAM_BOT_TOKEN=your_bot_token TELEGRAM_CHAT_ID=your_chat_id node server.js
```

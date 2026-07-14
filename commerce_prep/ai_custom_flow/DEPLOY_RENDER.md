# Render Deployment

Public service name:

`augnach-ai-custom-flow-20260714a`

Expected public URL:

`https://augnach-ai-custom-flow-20260714a.onrender.com`

## Pre-Deploy

1. Rotate the Meshy API key that was pasted into chat.
2. Confirm the Squarespace `$5` starter product exists at:
   `https://www.augnach.com/shop/p/custom-design-starter`
3. Keep the app root as:
   `commerce_prep/ai_custom_flow`

## Render Settings

Use `render.yaml` in this folder as the service blueprint, or create a Render Web Service manually with:

- Runtime: `Node`
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/api/config`
- Node version: `20`

Environment variables:

```text
PUBLIC_BASE_URL=https://augnach-ai-custom-flow-20260714a.onrender.com
SHOP_BASE_URL=https://www.augnach.com
CONTACT_EMAIL=375351feng@gmail.com
CUSTOM_STARTER_CHECKOUT_URL=https://www.augnach.com/shop/p/custom-design-starter
ALLOWED_ORIGINS=https://www.augnach.com,http://localhost:8795,http://127.0.0.1:8795
MESHY_API_KEY=<rotated server-side key>
MESHY_ENABLE_LIVE_CALLS=true
MESHY_DAILY_AUTOMATION_ENABLED=true
MESHY_DAILY_CREDIT_BUDGET=5
AUTOMATION_SECRET=<strong random value>
```

## Post-Deploy Checks

```powershell
Invoke-RestMethod "https://augnach-ai-custom-flow-20260714a.onrender.com/api/config"
Invoke-RestMethod "https://augnach-ai-custom-flow-20260714a.onrender.com/api/catalog/search?q=dragon%20gift"
Invoke-WebRequest "https://augnach-ai-custom-flow-20260714a.onrender.com/custom"
Invoke-WebRequest "https://augnach-ai-custom-flow-20260714a.onrender.com/embed.js"
```

## Squarespace Code Block

Paste the contents of `squarespace-embed.html` into a Squarespace Code Block.

The widget calls the Render API from `https://www.augnach.com`, which is included in `ALLOWED_ORIGINS`.

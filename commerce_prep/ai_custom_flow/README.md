# Aug & Ach AI Product Search + Custom Meshy Flow

This mini app backs a Squarespace-friendly AI search/custom request experience for `https://www.augnach.com`.

## Run Locally

```powershell
cd "C:\codex sum it up\commerce_prep\ai_custom_flow"
npm test
npm start
```

Open `http://localhost:8795` for search and `http://localhost:8795/custom` for the custom-design page.

## Render Deployment

Target service URL:

`https://augnach-showcase.onrender.com`

See `DEPLOY_RENDER.md` for exact Render settings, env vars, and post-deploy checks.

## Production Env

Copy `.env.example` into the hosting provider settings. Keep `MESHY_API_KEY` server-side only. Since a key was pasted into chat, rotate it before enabling live calls.

Important production settings:

- `MESHY_ENABLE_LIVE_CALLS=true` allows paid customer Meshy starts after payment confirmation is supplied.
- `MESHY_DAILY_AUTOMATION_ENABLED=true` allows hidden daily draft generation within `MESHY_DAILY_CREDIT_BUDGET`.
- `CUSTOM_STARTER_CHECKOUT_URL` should point to the live Squarespace `$5` starter product once it exists.
- `ALLOWED_ORIGINS` must include `https://www.augnach.com` and local dev origins.

## Squarespace Embed

Use `squarespace-embed.html` as the ready-to-paste Code Block template.

## Endpoints

- `GET /api/catalog/search?q=dragon`
- `POST /api/custom-requests`
- `POST /api/meshy/start`
- `GET /api/meshy/status/:id`
- `POST /api/automation/daily-meshy`

Draft generated products are written under `data/drafts/` as hidden review items, never published automatically.

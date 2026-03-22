# WoW Calendar

Weekly calendar PWA with local-first storage (IndexedDB) and Google Calendar two-way sync.

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Create local env file:

```bash
cp .env.example .env
```

3. Set `VITE_GOOGLE_CLIENT_ID` in `.env`.

4. Start dev server:

```bash
npm run dev
```

## Google OAuth setup

1. Go to Google Cloud Console.
2. Create/select a project and enable **Google Calendar API**.
3. Configure OAuth consent screen.
4. Create OAuth client credentials of type **Web application**.
5. Add authorized JavaScript origins:
   - `http://localhost:5173`
   - your production origin
6. Copy client ID into `VITE_GOOGLE_CLIENT_ID`.

## Sync behavior

- Local events are stored in IndexedDB and remain usable offline.
- Sync pushes pending create/update/delete operations to Google `primary` calendar.
- If outbound changes are high, app prompts for confirmation before push.
- After push, app pulls remote events and merges updates back locally.

## Deploy to GitHub Pages

This project is configured for project-pages deployment at `/wow-calendar/`.

```bash
npm run deploy
```

This will:

1. Build the app (`predeploy`).
2. Publish `dist` to the `gh-pages` branch.

After first deploy, set GitHub repository Pages source to `gh-pages` branch (root).

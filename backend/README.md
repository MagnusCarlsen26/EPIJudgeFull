# EPIJudge TS Backend

Express backend for cloud execution through a self-hosted Judge0 instance.

## Local Development

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

The service expects Judge0 at `JUDGE0_BASE_URL`. It reads generated problem metadata from `../frontend/public/data` and judge assets from `../judge-assets`.

## API

- `GET /api/health`
- `GET /api/languages`
- `POST /api/runs`
- `GET /api/runs/:runId`

## Judge0

Run the local self-hosted Judge0 instance from the repo root:

```bash
cd ../judge0
docker compose up -d
curl http://localhost:2358/languages
```

Then run this backend:

```bash
cd ../backend
npm run dev
```

At startup the backend calls Judge0 `/languages` and warns if the configured Python, C++, or Java language ids are not available. `GET /api/health` also reports whether Judge0 is reachable.

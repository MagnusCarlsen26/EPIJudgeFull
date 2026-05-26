# EPIJudge

Practice UI and TypeScript backend for running EPI tests through a local Judge0
instance.

## Local Development

Start Judge0:

```bash
cd judge0
docker compose up -d
```

Start the backend:

```bash
cd backend
npm install
npm run dev
```

Start the frontend:

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`. The committed frontend config points at the local
backend on `http://localhost:8000`, and `backend/.env` points at Judge0 on
`http://localhost:2358`.

Useful checks:

```bash
curl http://localhost:2358/languages
curl http://localhost:8000/api/health
```

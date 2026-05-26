# Local Judge0

This folder runs a local self-hosted Judge0 CE instance for EPIJudge.

```bash
cd judge0
docker compose up -d
curl http://localhost:2358/languages
```

The backend is configured to call Judge0 at `http://localhost:2358`.

If you enable `AUTHN_TOKEN` in `judge0.conf`, set the same token in
`backend/.env` as `JUDGE0_AUTH_TOKEN`.

Stop Judge0:

```bash
cd judge0
docker compose down
```

Remove the local Judge0 database volume:

```bash
cd judge0
docker compose down -v
```

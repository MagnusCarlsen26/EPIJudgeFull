# EPI Python Practice Backend

FastAPI backend for the EPI Python practice UI.

## Local Development

```bash
pip install -r requirements.txt
uvicorn app.server:app --reload --host 127.0.0.1 --port 8000
```

Set `FRONTEND_ORIGINS` to a comma-separated list of allowed frontend origins in deployed environments.

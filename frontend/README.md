# Project Management System frontend

## Environment setup

Copy `.env.example` to `.env.local` and adjust the API URL if the backend is
running somewhere other than `http://127.0.0.1:8000`:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
```

`.env.local` and other local environment files are ignored by Git. Never put
passwords, session IDs, or API secrets in a Vite environment variable.

The backend currently creates a server-side session on `POST /auth/login` and
expects its returned `session_id` as a query parameter on protected requests.
The API client accepts that value through the per-request `sessionId` option;
it does not store or persist it.

## Commands

```bash
npm run dev
npm run build
npm run lint
```

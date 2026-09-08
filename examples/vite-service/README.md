# Example: Vite service (`compose-service`)

A front-end dev server where the app and its test runner are both Docker Compose
services. This is the shape most Vite/Next projects use.

## Install

```bash
npm install -D @snowdev/cli
```

Add to `package.json`:

```json
{
  "scripts": {
    "dev": "snowdev run dev",
    "stag": "snowdev run stag",
    "prod": "snowdev run prod",
    "down": "snowdev down",
    "logs": "snowdev logs",
    "test": "snowdev task test",
    "doctor": "snowdev doctor"
  }
}
```

## Use

```bash
npm run dev      # docker compose up, attached (foreground) on :5173
npm run logs     # follow logs
npm run down     # stop the dev containers (never removes volumes)
npm test         # isolated Compose project "vite-service-task-test", cleaned up after
```

The `beforeRun` hook copies `.env.example` to `.env` on the first run. It uses
only `node:fs` — no shell, no `exec`.

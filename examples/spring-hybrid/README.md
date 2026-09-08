# Example: Spring Boot hybrid (`host-app-with-compose-deps`)

The application runs on the host (`./mvnw spring-boot:run`); Docker Compose only
starts PostgreSQL. `run dev` brings the database up detached and waits for it to
be healthy, runs the `afterDependenciesReady` migration hook, then starts the
host process attached. `stag`/`prod` run the host process in the background with
a PID file under `.snowdev/`.

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
    "doctor": "snowdev doctor"
  }
}
```

## Use

```bash
npm run dev        # db up (--wait) -> flyway:migrate hook -> ./mvnw spring-boot:run (attached)
npm run down       # stops the host process (SIGTERM, then SIGKILL), then docker compose down
npx snowdev ps     # container status plus the recorded host-process PID
```

The `afterDependenciesReady` hook calls `exec("./mvnw", ["-q", "flyway:migrate"])`
— an explicit argument array, never a shell string — and throws on a non-zero
exit so `run` aborts before the app starts.

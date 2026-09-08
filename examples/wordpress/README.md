# Example: WordPress (`compose-service`)

WordPress and MariaDB run as Compose services. `run dev` starts both attached on
`http://localhost:8080`.

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
npm run dev                    # wordpress + db up, attached on :8080
npm run down                   # stop the containers; volumes (wp-content, db-data) are kept
npx snowdev reset dev --yes    # only when you really want to drop the local volumes
```

The `beforeRun` hook generates `config/wp-secrets.php` with `node:crypto` if it
does not exist yet, so each checkout gets its own salts without a committed
secret. Compose mounts that file into the container read-only.

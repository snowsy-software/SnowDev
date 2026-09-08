# Example: container CLI (`container-cli`)

The container is a one-off command, not a long-running service. `run dev` issues
`docker compose run --rm tool` and exits with the tool's status. There is no
`down` to run — nothing stays up.

## Install

```bash
npm install -D @snowdev/cli
```

Add to `package.json`:

```json
{
  "scripts": {
    "dev": "snowdev run dev",
    "lint": "snowdev task lint",
    "doctor": "snowdev doctor"
  }
}
```

## Use

```bash
npm run dev      # docker compose run --rm tool
npm run lint     # runs the JS `hooks.task.lint` hook (node --check scripts/tool.mjs)
```

`lint` has no Compose `tasks.lint`, so `snowdev task lint` falls through to the
`hooks.task.lint` function. It calls `exec("node", ["--check", "scripts/tool.mjs"])`
and throws on a non-zero exit.

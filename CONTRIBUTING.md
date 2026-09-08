# Contributing to SnowDev

Thanks for helping improve SnowDev. Until the repository is made public, contributions are coordinated with the repository maintainers and must remain within the private repository.

## Development setup

Use Node.js 20.19.0 or newer, then run `npm install`. Before proposing a change, run:

```bash
npm run typecheck
npm run lint
npx prettier --check .
npm test
npm run pack:check
```

## Contribution expectations

- Keep changes focused and add tests for behavior changes.
- Do not add credentials, `.env` files, production data, internal hostnames, or project-specific Docker assets.
- Use cross-platform Node process APIs; command execution must not depend on `shell: true`.
- Preserve the safety contract: destructive operations require explicit confirmation and staging/production commands must not implicitly tear down environments.
- Update documentation when a public command or its safety behavior changes.

## Reporting issues

Use the private tracker while this repository remains private. Do not file security-sensitive details in a normal issue; follow [SECURITY.md](SECURITY.md).

By contributing, you agree that your contribution may be distributed under the Apache License 2.0.

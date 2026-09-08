# SnowDev

[简体中文](README-ZH.md)

SnowDev is a Node.js command-line tool for orchestrating repeatable local development workflows. It will provide a consistent interface around project-owned Docker Compose files, host processes, environment loading, health checks, and safety controls.

## Status

This is the private, pre-release repository. It is intentionally not yet published to npm or made public. The current `0.0.0` CLI provides Phase 1 foundations, including `doctor`; lifecycle commands remain planned work.

## Requirements

- Node.js 20.19.0 or later
- npm 10 or later (recommended)

## Local development

```bash
npm install
npm run build
node dist/cli.js --help
```

Quality checks:

```bash
npm run typecheck
npm run lint
npx prettier --check .
npm test
npm run pack:check
```

## Documentation

Start with the [documentation map](docs/README.md). It links the architecture, engineering, configuration and command, security, testing, and local-development standards. Contributors and AI collaborators must also follow [AGENTS.md](AGENTS.md).

`pack:check` runs `npm pack --dry-run`. The package allowlist is defined in `package.json`; source, tests, repository docs, environment files, and CI configuration must not enter the npm tarball.

Format files with `npx prettier --write .`. Check available dependency updates without changing files with `npx npm-check-updates`; apply approved updates with `npx npm-check-updates -u` followed by `npm install`.

## Publication status

Do not run `npm publish` or change the GitHub repository visibility before the maintainers approve the public release. See [the release gate](docs/release-gate.md) for the required checks, including npm scope ownership verification.

## License

Licensed under the [Apache License 2.0](LICENSE). See [NOTICE](NOTICE) for attribution notices.

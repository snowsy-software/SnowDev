# Public release gate

The repository must remain private until the first approved public npm package release. This document is a release checklist, not authorization to publish.

## Before making the repository public

1. Obtain maintainer approval for the repository visibility change and npm publication.
2. Review all history, documentation, examples, test fixtures, and generated files for credentials, internal branding, hostnames, ports, Docker assets, customer data, or other non-public material.
3. Confirm `LICENSE`, `NOTICE`, `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md` are correct for public use.
4. Enable a public security-reporting route and configure repository governance settings.

## npm identity decision

`@snowdev/cli` is a pre-release placeholder. A maintainer authenticated to npm must verify the scope is owned and eligible for public publication immediately before the first release:

```bash
npm whoami
npm access ls-packages @snowdev
npm view @snowdev/cli version
```

If `@snowdev` cannot be owned and used publicly, select a new public scope that does not contain internal or customer branding, update `package.json`, documentation, and package metadata together, then repeat the packaging review. Do not publish an unscoped or alternative name without maintainer approval.

## Package gate

Run these from a clean checkout:

```bash
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test
npm run pack:check
```

Inspect the `npm pack --dry-run` file list. It may contain only the compiled distribution, package metadata, README, LICENSE, NOTICE, required templates, and type declarations. It must not contain source, tests, `.env` files, secrets, repository-specific Docker assets, or unrelated documents.

Only after all checks pass and explicit approval is recorded may the release owner create a release and run the approved public publication process.

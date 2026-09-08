# Security Policy

## Reporting a vulnerability

Please do not disclose suspected vulnerabilities in a public issue, pull request, discussion, or commit. While this repository is private, report them through the repository owner's private security contact or GitHub private vulnerability reporting if it has been enabled.

Include a clear description, affected version or commit, reproduction steps, impact, and any suggested mitigation. Maintainers will acknowledge receipt, assess the report, and coordinate a fix before public disclosure.

## Scope

Security reports are especially valuable for command execution, environment-file handling, log redaction, Docker Compose argument construction, destructive operations, and release packaging. Never include real secrets in a report; redact or replace them with safe placeholders.

## Supported versions

Before the first public npm release, only the current private development branch is supported. A version support matrix and public reporting route will be published with the first public release.

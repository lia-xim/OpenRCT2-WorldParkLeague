# Security Policy

## Supported versions

Security-sensitive reports should target the latest version on the `main` branch or the latest published release.

## What to report privately

Please report these privately instead of opening a public issue:

- credential leaks
- supply-chain concerns
- malicious plugin behavior
- remote code execution concerns
- anything that could corrupt player saves at scale

## How to report

If GitHub private security reporting is available for the repository, use it.

If not, contact the maintainer directly on GitHub and clearly mark the report as `Security`.

## What to include

- affected version
- reproduction steps
- impact
- whether a public issue already exists
- any proof-of-concept or relevant logs

## Non-security bugs

Crashes, balance issues, UI bugs, and normal save-migration bugs should usually go through regular GitHub issues unless they also create a serious security or mass save-corruption risk.

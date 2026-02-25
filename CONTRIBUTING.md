# Contributing to tang-edge

## Getting Started

```bash
git clone https://github.com/tang-edge/tang-edge.git
cd tang-edge
bun install
bun test
```

## Development

```bash
bun run dev           # wrangler dev server
bun run dev-server.ts # standalone (in-memory storage)
bun test --watch      # tests in watch mode
```

## Coding Standards

- TypeScript strict mode (`strict: true` in tsconfig)
- No `any` types — use proper typing
- Tests required for all new functionality (`bun test`)
- Type checking must pass (`bunx tsc --noEmit`)

## Developer Certificate of Origin

All contributions must be signed off (`git commit -s`) to certify you have the right to submit the work under the project's license. See [developercertificate.org](https://developercertificate.org).

## Pull Requests

1. Fork the repo and create your branch from `main`
2. Write tests for any new functionality
3. Ensure all tests pass: `bun test`
4. Ensure types check: `bunx tsc --noEmit`
5. Open a PR with a clear description

### PR Checklist

- [ ] No secrets or credentials in code
- [ ] No breaking changes to the Tang protocol
- [ ] Tests added/updated for new functionality
- [ ] README updated if adding new platforms or features

## Code Review

All PRs are reviewed by the maintainer before merge. Reviews check:

- Correctness: does the code do what it claims?
- Security: no credential leaks, no injection vectors, safe crypto usage
- Tests: new functionality has test coverage
- Compatibility: no breaking changes to the Tang protocol or existing APIs

## Project Structure

```
src/
├── crypto/       # JWK, ECMR, JWS, key generation
├── routes/       # HTTP endpoints (adv, rec, rotate)
├── storage/
│   ├── adapters/ # Platform-specific storage backends
│   └── kv-store.ts # Key management logic
└── platforms/    # Entry points per provider
```

## Adding a New Storage Backend

1. Create `src/storage/adapters/your-backend.ts` implementing `TangStorage` from `src/storage/interface.ts`
2. Add tests in `tests/storage/your-backend.test.ts` using the shared suite from `tests/storage/adapter-shared.ts`
3. Add deployment docs in `docs/your-platform.md`

## Adding a New Platform

1. Create `src/platforms/your-platform.ts` with the platform entry point
2. Add deployment guide in `docs/your-platform.md`
3. Update the supported platforms table in `README.md`

## Reporting Bugs

Use [GitHub Issues](https://github.com/tang-edge/tang-edge/issues) with the bug report template.

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## License

By contributing, you agree that your contributions will be licensed under GPL-3.0-only.

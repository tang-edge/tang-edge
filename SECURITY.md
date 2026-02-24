# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in tang-edge, please report it responsibly:

1. **Do NOT open a public issue.**
2. Use [GitHub Security Advisories](https://github.com/tang-edge/tang-edge/security/advisories/new) to report privately.

## Scope

tang-edge implements the Tang cryptographic protocol. Security-relevant areas include:

- **Cryptographic operations** — ECMR key exchange, JWS signing, JWK thumbprinting
- **Key storage** — Private key handling across storage adapters
- **Authentication** — ROTATE_TOKEN validation
- **Input validation** — Client key format and curve point validation

## Security Design

- Private keys never leave the server — only public keys are advertised
- The Tang protocol is safe by design — public keys are not secret
- ECMR exchange results are useless without the corresponding LUKS header
- ROTATE_TOKEN must be set as a secret/environment variable, never in config files
- Timing-safe token comparison on rotation endpoint (constant-time XOR)
- Request body size limit on `/rec` endpoint (4 KB max)
- Input validation: curve (P-521), coordinate length, key type, algorithm

## Design Decisions

### Rotated keys remain accessible via `/rec`

After key rotation, old keys are archived (`.{thp}.jwk` prefix) and excluded from `/adv` responses. However, `/rec/:thp` still accepts rotated key thumbprints for ECMR exchange.

This is **intentional** and follows the Tang protocol: existing clevis clients that were bound with old keys must still be able to unlock. Removing rotated keys would brick disks that haven't been re-bound.

To fully revoke a key, delete it from storage directly (e.g. via `wrangler kv key delete`).

### ROTATE_TOKEN minimum strength

Use a cryptographically random token of at least 32 characters. A weak token (even with timing-safe comparison) is vulnerable to brute-force. Pair with WAF rate limiting on `/rotate`.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

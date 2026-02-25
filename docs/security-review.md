# Security Review

Last reviewed: 2026-02-25

## Scope

Full review of tang-edge cryptographic implementation and HTTP API surface.

## Threat Model

| Threat | Mitigation |
|--------|-----------|
| Private key exfiltration | Keys never leave storage; only public JWKs are exposed via `/adv` |
| Malicious key exchange input | Curve validation (P-521 only), coordinate length check, key type and algorithm enforcement |
| Unauthorized key rotation | ROTATE_TOKEN required, constant-time comparison prevents timing attacks |
| Request flooding / DoS | 4 KB body size limit on `/rec`; WAF rate limiting recommended |
| ECMR result misuse | Exchange result is useless without the corresponding LUKS header |
| Storage adapter compromise | Keys are platform-isolated (KV, DynamoDB, etc.); access controlled by platform IAM |

## OWASP Top 10 Assessment

| Category | Status | Notes |
|----------|--------|-------|
| A01 Broken Access Control | Mitigated | ROTATE_TOKEN gates write operations; read-only endpoints are public by design (Tang protocol) |
| A02 Cryptographic Failures | N/A | No passwords or sessions; ECMR uses P-521 (256-bit security) |
| A03 Injection | Mitigated | No SQL/shell; JSON input parsed by runtime; JWK fields validated against strict schema |
| A04 Insecure Design | Mitigated | Follows original Tang protocol design; fail-safe defaults |
| A05 Security Misconfiguration | Documented | SECURITY.md and deployment docs describe required configuration |
| A06 Vulnerable Components | Monitored | Dependabot + Snyk monitor dependencies weekly |
| A07 Auth Failures | Mitigated | Only `/rotate` requires auth; timing-safe token comparison |
| A08 Data Integrity Failures | Mitigated | Signed releases with SLSA provenance; JWS signatures on advertised keys |
| A09 Logging Failures | Accepted | Minimal logging by design — no sensitive data to log |
| A10 SSRF | N/A | Server does not make outbound requests |

## Cryptographic Review

- **Algorithm**: ECMR (Elliptic Curve Menezes-Qu-Vanstone) on P-521
- **Key generation**: `crypto.subtle.generateKey` with `ECDH` + `P-521`
- **JWS signatures**: ES512 (ECDSA with SHA-512)
- **No custom crypto**: All operations use Web Crypto API (platform-provided)
- **No weak algorithms**: No SHA-1, no P-192/P-224, no RSA with small keys

## Input Validation

All client-supplied JWKs are validated before use:
- `kty` must be `EC`
- `crv` must be `P-521`
- `x` and `y` coordinates must be exactly 88 characters (base64url-encoded 66 bytes)
- `alg` if present must be `ECDH`
- No extra fields accepted

## Tools Used

- CodeQL (SAST) — runs on every push and PR
- Snyk — dependency vulnerability monitoring
- Fuzz testing — base64url, JWK validation, ECMR exchange
- 176+ unit tests covering crypto, routes, storage, and input validation

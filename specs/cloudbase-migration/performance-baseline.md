# CloudBase shadow performance baseline

Measured on 2026-09-23 from the migration workstation in mainland China against the
CloudBase default test domain. Each path was requested twice with `cache-control:
no-cache`; the first root request includes an HTTP function cold start. These are
shadow-environment baselines, not final custom-domain acceptance results.

| Path | Result | First TTFB | Warm TTFB |
| --- | ---: | ---: | ---: |
| `/` | 307 to login | 2752 ms | 182 ms |
| `/login` | 200 | 146 ms | 91 ms |
| `/forgot-password` | 200 | 125 ms | 92 ms |
| `/api/push/public-key` | 401 when signed out | 611 ms | 78 ms |
| `/manifest.webmanifest` | 200 | 87 ms | 115 ms |
| `/offline` | 200 | 174 ms | 78 ms |

Authenticated home, check-in, plans, photos, friends, database-query timing, and
final-domain measurements remain gated on migrated-user password reset and custom
domain binding.

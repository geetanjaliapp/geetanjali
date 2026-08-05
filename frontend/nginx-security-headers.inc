# Security headers — included in every location block that uses add_header
# (nginx add_header in a child block replaces parent add_header directives)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
# CSP notes (see todos/releases/v1.40.0/phase-1-csp-restoration.md):
#   media-src blob:  - TTS plays generated audio via createObjectURL (TTSContext.tsx).
#                      Narrows to 'self' once TTS moves to same-origin URLs (Phase 4).
#   img-src blob:    - ShareModal renders its card preview from a canvas blob. Permanent.
#   sha256-...       - inline theme script in index.html. src/test/csp.test.ts recomputes this
#                      from index.html and fails CI if the two drift.
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'sha256-jEoj6xfYPkmGqX9AnKnD18sSjSkQwqtDc560JE82h3M=' https://cloud.umami.is; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self'; media-src 'self' blob:; connect-src 'self' https://geetanjaliapp.com https://cloud.umami.is https://*.ingest.sentry.io; frame-ancestors 'self'; base-uri 'self'; form-action 'self';" always;

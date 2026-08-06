# Security headers — included in every location block that uses add_header
# (nginx add_header in a child block replaces parent add_header directives)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
# CSP notes (see todos/releases/v1.40.0/phase-1-csp-restoration.md):
#   media-src blob:  - No longer used: TTS now plays a same-origin /api/v1/tts/audio/<key>.mp3
#                      URL. Kept for one release so a client still running JS cached from before
#                      that change keeps working across the deploy. Drop the blob: source once
#                      this build has been live long enough for those to age out, and update
#                      src/test/csp.test.ts to assert its absence.
#   img-src blob:    - ShareModal renders its card preview from a canvas blob. Permanent.
#   sha256-...       - inline theme script in index.html. src/test/csp.test.ts recomputes this
#                      from index.html and fails CI if the two drift.
#   umami hosts      - script loads from cloud.umami.is but events POST to gateway.umami.is.
#                      Allowing only the first lets the script load and silently drop every event.
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'sha256-jEoj6xfYPkmGqX9AnKnD18sSjSkQwqtDc560JE82h3M=' https://cloud.umami.is; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self'; media-src 'self' blob:; connect-src 'self' https://geetanjaliapp.com https://cloud.umami.is https://gateway.umami.is https://*.ingest.sentry.io; frame-ancestors 'self'; base-uri 'self'; form-action 'self';" always;

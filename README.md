# visitor-counter

Cloudflare Worker backing the visible visitor count on
`signals.debasisnishank.com`. The site is static on GitHub Pages, so the
count lives in Workers KV.

    GET /?site=signals          increment (once per visitor per day) and return
    GET /?site=signals&peek=1   return the count without claiming a visit

CORS is restricted to that origin.

The portfolio used to call this as well. A visible count suits a links page,
not the site someone reads before deciding whether to hire you, so it was
removed there and this no longer accepts that origin.

## Privacy

The visitor's IP is never stored. It is combined with the date and a
server-side salt, hashed with SHA-256, and only that hash is kept — as a
marker with a 24 hour TTL meaning "already counted today". So the number is
daily unique visitors rather than a refresh-inflated hit count, and nothing
identifying is retained. No cookies, so no consent banner.

The fingerprint deliberately excludes the User-Agent. Including it let a
single client inflate the count just by varying a header it controls; the IP,
set by Cloudflare's edge, is the only input a caller cannot trivially forge.
The trade is that visitors sharing an IP count once between them.

## Deploy

    npx wrangler deploy
    npx wrangler secret put SALT     # any random string

## Note on accuracy

KV is eventually consistent, so two visitors landing in the same instant can
race and lose a count. For a personal site that is an acceptable trade for
staying on the free tier.

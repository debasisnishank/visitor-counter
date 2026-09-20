# visitor-counter

Cloudflare Worker backing the visible visitor counts on
`debasisnishank.com` and `signals.debasisnishank.com`. Both sites are static
on GitHub Pages, so the count lives in Workers KV.

    GET /?site=portfolio        increment (once per visitor per day) and return
    GET /?site=signals&peek=1   return the count without claiming a visit

CORS is restricted to those two origins.

## Privacy

The visitor's IP is never stored. It is combined with the user agent, the
date and a server-side salt, hashed with SHA-256, and only that hash is kept
— as a marker with a 24 hour TTL meaning "already counted today". So the
number is daily unique visitors rather than a refresh-inflated hit count, and
nothing identifying is retained. No cookies, so no consent banner.

## Deploy

    npx wrangler deploy
    npx wrangler secret put SALT     # any random string

## Note on accuracy

KV is eventually consistent, so two visitors landing in the same instant can
race and lose a count. For a personal site that is an acceptable trade for
staying on the free tier.

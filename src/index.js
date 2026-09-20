/**
 * Visitor counter for debasisnishank.com and signals.debasisnishank.com.
 *
 * Both sites are static on GitHub Pages, so there is nowhere to keep a count.
 * This Worker holds it in KV and hands it back over CORS.
 *
 * Privacy: the visitor's IP is never stored. It is combined with the date and
 * a server-side salt, hashed, and the hash is kept only as a 24h "already
 * counted today" marker. That gives daily unique visitors rather than a
 * refresh-inflated hit count, without retaining anything that identifies
 * anyone.
 *
 * The fingerprint deliberately excludes the User-Agent. It used to include it,
 * which meant a single client could inflate the count freely just by varying a
 * header it controls. IP alone is the only input here the caller cannot
 * trivially forge. The trade is that visitors sharing an IP — an office, a
 * mobile carrier's CGNAT — count once between them; under-counting a shared
 * network is much the lesser problem.
 */

const ALLOWED_ORIGINS = new Set([
  'https://debasisnishank.com',
  'https://www.debasisnishank.com',
  'https://signals.debasisnishank.com',
]);

// Named sites, so an open endpoint can't be used to spin up arbitrary keys.
const SITES = new Set(['portfolio', 'signals']);

const DAY_SECONDS = 86400;

async function fingerprint(parts) {
  const data = new TextEncoder().encode(parts.join('|'));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
    // The count changes; never let a CDN or browser pin it.
    'Cache-Control': 'no-store',
  };
}

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  });

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? '';
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405, cors);

    const url = new URL(request.url);
    const site = url.searchParams.get('site');
    if (!SITES.has(site)) return json({ error: 'unknown site' }, 400, cors);

    const countKey = `count:${site}`;
    let count = Number.parseInt((await env.COUNTER.get(countKey)) ?? '0', 10) || 0;

    // `peek` lets a page show the number without claiming a visit.
    if (url.searchParams.get('peek') === '1') return json({ site, count }, 200, cors);

    const fp = await fingerprint([
      site,
      // Set by Cloudflare's edge; not something the caller can spoof.
      request.headers.get('CF-Connecting-IP') ?? '',
      new Date().toISOString().slice(0, 10),
      env.SALT ?? 'fallback-salt',
    ]);
    const seenKey = `seen:${site}:${fp}`;

    if (!(await env.COUNTER.get(seenKey))) {
      count += 1;
      await env.COUNTER.put(countKey, String(count));
      await env.COUNTER.put(seenKey, '1', { expirationTtl: DAY_SECONDS });
    }

    return json({ site, count }, 200, cors);
  },
};

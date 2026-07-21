/* =========================================================
   Onterra, live industry news (serverless function)
   Pulls fresh Nigerian oil & gas headlines server-side from
   Google News RSS (no API key, no CORS issues) and returns
   them as blog-ready JSON. The blog calls this on its own,
   so the news section keeps itself up to date with no work.

   Each headline also gets a relevant stock photo, searched
   across free photo APIs in this order (whichever keys are
   configured as Netlify environment variables):
     1. UNSPLASH_ACCESS_KEY  (api.unsplash.com)
     2. PEXELS_API_KEY       (api.pexels.com)
     3. PIXABAY_API_KEY      (pixabay.com/api)
   With no keys set, the site falls back to its built-in
   placeholder images, nothing breaks.

   Tune what it tracks by editing QUERY below.
   ========================================================= */

const QUERY =
  'Nigeria oil and gas OR marginal field OR NUPRC OR crude oil production OR upstream';

const FEED_URL =
  'https://news.google.com/rss/search?q=' +
  encodeURIComponent(QUERY) +
  '&hl=en-NG&gl=NG&ceid=NG:en';

const MAX_ITEMS = 6;

function decodeEntities(s = '') {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function stripTags(s = '') {
  return decodeEntities(s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function pick(block, name) {
  const m = block.match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)</' + name + '>', 'i'));
  return m ? decodeEntities(m[1]) : '';
}

function toISO(d) {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

function hashId(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return 'news-' + (h >>> 0).toString(36);
}

/* ---------- relevant image search -------------------------------------- */

// Headline topic -> strong visual search query. First match wins.
// A literal headline ("NUPRC issues guidance...") searches terribly;
// a topic ("government energy policy") finds a usable photo every time.
const TOPIC_QUERIES = [
  [/refin/i, 'oil refinery industrial'],
  [/pipelin/i, 'oil pipeline industry'],
  [/\brig\b|drill|wellhead|\bwell\b/i, 'oil rig drilling platform'],
  [/\blng\b|natural gas|gas plant|gas project/i, 'natural gas plant energy'],
  [/fuel|petrol|pump price|diesel|pms/i, 'fuel station pumps'],
  [/tanker|vessel|shipping|export|cargo|terminal/i, 'oil tanker ship sea'],
  [/opec|price|market|barrel|brent|trading/i, 'oil barrels industry market'],
  [/power|electricit|grid/i, 'power plant energy'],
  [/nnpc|nuprc|regulat|policy|minist|government|senate|law|licen/i, 'nigeria government business'],
  [/invest|fund|deal|acquisition|financ|billion|million|equity/i, 'business meeting handshake deal'],
  [/environment|spill|clean|emission|flar/i, 'industrial environment smoke'],
  [/offshore|deepwater|fpso/i, 'offshore oil platform ocean'],
];

function queryFor(title) {
  for (const [re, q] of TOPIC_QUERIES) if (re.test(title)) return q;
  // fallback: the 3 longest words of the headline plus industry context
  const words = title
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .slice(0, 3);
  return (words.join(' ') + ' oil gas industry').trim();
}

function fetchTimeout(url, opts = {}, ms = 3500) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  return fetch(url, { ...opts, signal: ctl.signal }).finally(() => clearTimeout(t));
}

// Each provider returns {url, credit} or null. `n` varies the pick so
// different headlines with the same topic don't all share one photo.
async function searchUnsplash(q, n) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  const r = await fetchTimeout(
    'https://api.unsplash.com/search/photos?per_page=6&orientation=landscape&query=' +
      encodeURIComponent(q),
    { headers: { Authorization: 'Client-ID ' + key } }
  );
  if (!r.ok) return null;
  const d = await r.json();
  const hit = d.results && d.results.length ? d.results[n % d.results.length] : null;
  return hit ? { url: hit.urls.regular, credit: 'Photo: ' + (hit.user?.name || 'Unsplash') + ' / Unsplash' } : null;
}

async function searchPexels(q, n) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  const r = await fetchTimeout(
    'https://api.pexels.com/v1/search?per_page=6&orientation=landscape&query=' +
      encodeURIComponent(q),
    { headers: { Authorization: key } }
  );
  if (!r.ok) return null;
  const d = await r.json();
  const hit = d.photos && d.photos.length ? d.photos[n % d.photos.length] : null;
  return hit ? { url: hit.src.large2x || hit.src.large, credit: 'Photo: ' + (hit.photographer || 'Pexels') + ' / Pexels' } : null;
}

async function searchPixabay(q, n) {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return null;
  const r = await fetchTimeout(
    'https://pixabay.com/api/?image_type=photo&orientation=horizontal&safesearch=true&per_page=6&key=' +
      key + '&q=' + encodeURIComponent(q)
  );
  if (!r.ok) return null;
  const d = await r.json();
  const hit = d.hits && d.hits.length ? d.hits[n % d.hits.length] : null;
  return hit ? { url: hit.largeImageURL || hit.webformatURL, credit: 'Photo: Pixabay' } : null;
}

async function findImage(title, seed) {
  const q = queryFor(title);
  const n = Math.abs(seed) || 0;
  for (const provider of [searchUnsplash, searchPexels, searchPixabay]) {
    try {
      const hit = await provider(q, n);
      if (hit) return hit;
    } catch {
      /* provider down or slow, try the next */
    }
  }
  return null;
}

/* ---------- handler ----------------------------------------------------- */

export async function handler() {
  try {
    const res = await fetch(FEED_URL, {
      headers: { 'User-Agent': 'OnterraNewsBot/1.0 (+https://onterra.ng)' },
    });
    if (!res.ok) throw new Error('feed status ' + res.status);
    const xml = await res.text();

    const items = [];
    const blocks = xml.split('<item>').slice(1);
    for (const raw of blocks) {
      const block = raw.split('</item>')[0];
      const fullTitle = pick(block, 'title');
      const link = pick(block, 'link');
      if (!fullTitle || !link) continue;

      // Google News titles read "Headline - Source"
      let title = fullTitle;
      let source = 'Industry News';
      const sep = fullTitle.lastIndexOf(' - ');
      if (sep > 0) {
        title = fullTitle.slice(0, sep).trim();
        source = fullTitle.slice(sep + 3).trim();
      }

      const date = toISO(pick(block, 'pubDate'));
      if (!date) continue;

      let excerpt = stripTags(pick(block, 'description'));
      if (excerpt.length > 180) excerpt = excerpt.slice(0, 177).trim() + '…';

      items.push({
        id: hashId(link),
        title,
        tag: 'Industry News',
        date,
        author: source,
        excerpt,
        link,
        external: true,
      });
    }

    // de-duplicate by title, newest first, cap
    const seen = new Set();
    const posts = items
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .filter((p) => {
        const k = p.title.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, MAX_ITEMS);

    // attach a relevant photo to every headline, all searches in parallel
    await Promise.all(
      posts.map(async (p, i) => {
        const hit = await findImage(p.title, i + p.id.length);
        if (hit) {
          p.image = hit.url;
          p.imageCredit = hit.credit;
        }
      })
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        // Netlify CDN caches the response for 30 min, so the feed is fast,
        // we never hammer the sources, and photo API rate limits stay tiny.
        'Cache-Control': 'public, max-age=600, s-maxage=1800',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ posts, fetchedAt: new Date().toISOString() }),
    };
  } catch (err) {
    // Never break the page: return an empty feed and let curated posts show.
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=120' },
      body: JSON.stringify({ posts: [], error: String(err && err.message || err) }),
    };
  }
}

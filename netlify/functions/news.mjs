/* =========================================================
   Onterra, live industry news (serverless function)
   Pulls fresh Nigerian oil & gas headlines server-side from
   Google News RSS (no API key, no CORS issues) and returns
   them as blog-ready JSON. The blog calls this on its own,
   so the news section keeps itself up to date with no work.

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

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        // Netlify CDN caches the response for 30 min, so the feed is fast
        // and we never hammer the source.
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

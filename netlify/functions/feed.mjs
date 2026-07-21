// Onterra RSS feed — fetches curated posts and returns RSS 2.0 XML
// Consumed by Brevo RSS-to-email automation at /feed.xml
// Route: /feed.xml  →  /.netlify/functions/feed  (see netlify.toml)

const SITE_URL  = 'https://onterra.ng';
const POSTS_URL = `${SITE_URL}/data/posts.json`;

function esc(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const handler = async () => {
  let posts = [];

  try {
    const res = await fetch(POSTS_URL);
    if (res.ok) {
      posts = await res.json();
    }
  } catch (e) {
    console.error('feed: could not fetch posts.json:', e.message);
  }

  // Sort newest first
  posts = posts
    .filter(p => p && p.date && p.title)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);

  const items = posts.map(p => {
    const link   = `${SITE_URL}/#insights`;
    const pubDate = new Date(p.date).toUTCString();
    const desc   = esc(p.excerpt || '');
    return `
  <item>
    <title>${esc(p.title)}</title>
    <link>${link}</link>
    <guid isPermaLink="false">${esc(p.id || p.title)}</guid>
    <pubDate>${pubDate}</pubDate>
    <description>${desc}</description>
    ${p.author ? `<author>${esc(p.author)}</author>` : ''}
    ${p.tag    ? `<category>${esc(p.tag)}</category>` : ''}
  </item>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Onterra Nigeria, Insights &amp; News</title>
  <link>${SITE_URL}</link>
  <description>Perspectives on marginal fields, Nigerian upstream and the road to first oil.</description>
  <language>en</language>
  <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
  ${items}
</channel>
</rss>`;

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
    body: xml,
  };
};

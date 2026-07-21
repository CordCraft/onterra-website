// Onterra, save a generated image into the GitHub repo
//
// Second half of the /admin/studio.html flow: after you preview a
// generated image and like it, this downloads it from fal.ai and
// commits it to github.com/CordCraft/onterra-website under
// images/insights/. The commit triggers a Netlify deploy, so the
// image is live on the site about a minute later.
//
// Requires a Netlify Identity login (same as /admin).
//
// Required Netlify env vars:
//   GITHUB_TOKEN  — fine-grained personal access token, ONLY the
//                   onterra-website repo, permission Contents: Read and write

const REPO = 'CordCraft/onterra-website';
const BRANCH = 'main';

function slugify(s) {
  return (
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) ||
    'article'
  );
}

export async function handler(event, context) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };

  const user = context.clientContext && context.clientContext.user;
  if (!user) {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Log in first (same login as /admin).' }) };
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'GITHUB_TOKEN env var not set in Netlify.' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { url = '', title = '' } = body;
  if (!url || !title) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'url and title are required' }) };
  }

  // Only fetch from fal.ai's own hosting, never an arbitrary URL.
  let host;
  try { host = new URL(url).hostname; } catch { host = ''; }
  if (!/(^|\.)fal\.(media|ai|run)$/.test(host)) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'URL must be a fal.ai image URL' }) };
  }

  try {
    // 1. download the generated image
    const imgRes = await fetch(url);
    if (!imgRes.ok) throw new Error('image fetch ' + imgRes.status);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) throw new Error('image too large');

    const gh = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'onterra-studio',
      'Content-Type': 'application/json',
    };

    // 2. pick a free filename (add a suffix if the slug already exists)
    let name = slugify(title);
    let path = `images/insights/${name}.jpg`;
    const exists = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`,
      { headers: gh }
    );
    if (exists.ok) {
      name = `${name}-${Date.now().toString(36)}`;
      path = `images/insights/${name}.jpg`;
    }

    // 3. commit it
    const put = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
      method: 'PUT',
      headers: gh,
      body: JSON.stringify({
        message: `Article image: ${title}`,
        content: buf.toString('base64'),
        branch: BRANCH,
      }),
    });
    if (!put.ok) {
      const err = await put.text();
      console.error('GitHub commit failed', put.status, err.slice(0, 300));
      throw new Error('GitHub commit failed (' + put.status + '). Check GITHUB_TOKEN permissions.');
    }

    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: '/' + path,
        note: 'Committed. Netlify is deploying it now; it will be live in about a minute.',
      }),
    };
  } catch (e) {
    console.error('save-image error:', e.message);
    return { statusCode: 502, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
}

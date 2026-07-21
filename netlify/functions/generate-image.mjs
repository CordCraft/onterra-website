// Onterra, protected article image generation (fal.ai FLUX)
//
// Called from /admin/studio.html. Requires a Netlify Identity login:
// the browser sends the user's Identity JWT and Netlify fills
// context.clientContext.user only when the token is valid. Anyone
// without a login gets a 401, so the fal.ai key can never be spent
// by strangers.
//
// Required Netlify env var:  FAL_KEY  (your fal.ai API key)

const HOUSE_STYLE =
  'Cinematic professional photograph for an oil and gas industry publication. ' +
  'Nigerian upstream petroleum context. Moody dark navy blue and deep teal ' +
  'tones with warm amber highlights, dramatic late evening light, shallow ' +
  'depth of field, high detail, editorial quality, no text, no watermark, ' +
  "no people's faces in close-up.";

export async function handler(event, context) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };

  const user = context.clientContext && context.clientContext.user;
  if (!user) {
    return {
      statusCode: 401,
      headers: cors,
      body: JSON.stringify({ error: 'Log in first (same login as /admin).' }),
    };
  }

  const FAL_KEY = process.env.FAL_KEY;
  if (!FAL_KEY) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: 'FAL_KEY env var not set in Netlify.' }),
    };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const title = (body.title || '').trim();
  const style = (body.style || '').trim();
  if (!title) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Title is required' }) };
  }

  // schnell: ~$0.003, 2-4s. dev: ~$0.025, better quality, 5-10s.
  const model = body.model === 'dev' ? 'dev' : 'schnell';
  const prompt = `${HOUSE_STYLE} Subject: ${style || title}.`;

  try {
    const r = await fetch(`https://fal.run/fal-ai/flux/${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size: 'landscape_16_9',
        num_images: 1,
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('fal.ai error', r.status, err.slice(0, 300));
      return {
        statusCode: 502,
        headers: cors,
        body: JSON.stringify({ error: `fal.ai returned ${r.status}. Check the FAL_KEY and your fal.ai balance.` }),
      };
    }

    const data = await r.json();
    const url = data.images && data.images[0] && data.images[0].url;
    if (!url) {
      return { statusCode: 502, headers: cors, body: JSON.stringify({ error: 'No image in fal.ai response' }) };
    }

    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, model, prompt }),
    };
  } catch (e) {
    console.error('generate-image error:', e.message);
    return {
      statusCode: 502,
      headers: cors,
      body: JSON.stringify({ error: 'Generation failed or timed out. Try the schnell model.' }),
    };
  }
}

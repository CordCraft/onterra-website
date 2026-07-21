// Onterra investor lead capture + Brevo contact sync
//
// Required Netlify env var (Dashboard → Site config → Environment variables):
//   BREVO_API_KEY  — your Brevo v3 API key
//
// Brevo list: "Onterra Family", ID = 2
//
// Sender setup (one-time, before first use):
//   Brevo → Senders & IPs → Senders → Add a sender
//   Use: Onterra Nigeria <info@onterra.ng>, then click the verification
//   link Brevo emails to that inbox. For best deliverability also add the
//   DKIM/SPF DNS records Brevo shows under Senders & IPs → Domains.

const BREVO_LIST_ID  = 2;
const SENDER_EMAIL   = 'info@onterra.ng';   // must be verified in Brevo
const SENDER_NAME    = 'Onterra Nigeria';
const NOTIFY_EMAIL   = 'info@onterra.ng';   // lead alerts land here
const SITE_URL       = 'https://onterra.ng';

const DOCS = [
  { label: 'Financial Model (Excel)',          url: `${SITE_URL}/assets/docs/Onterra-Nigeria-Financial-Model.xlsx` },
  { label: 'Investor Pitch Deck (PowerPoint)', url: `${SITE_URL}/assets/docs/Onterra-Nigeria-Investor-Pitch-Deck.pptx` },
  { label: 'One-Page Summary (PDF)',           url: `${SITE_URL}/assets/docs/Onterra-Nigeria-One-Pager.pdf` },
];

export const handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { name = '', email = '', phone = '', company = '', designation = '' } = body;
  if (!email || !name) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Name and email required' }) };
  }

  const API_KEY = process.env.BREVO_API_KEY;
  if (!API_KEY) {
    console.error('BREVO_API_KEY env var not set');
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Server misconfiguration' }) };
  }

  const brevo = {
    'Content-Type': 'application/json',
    'api-key': API_KEY,
  };

  const [firstName, ...rest] = name.trim().split(' ');
  const lastName = rest.join(' ');

  // ── 1. Add/update contact in Brevo (standard attributes only) ──────────
  // Note: FIRSTNAME, LASTNAME, SMS, COMPANY are standard Brevo attributes.
  // To also store DESIGNATION: Brevo → Contacts → Settings → Attributes → add text attribute named DESIGNATION.
  const contactAttrs = {
    FIRSTNAME: firstName,
    LASTNAME:  lastName,
    SMS:       phone,
    COMPANY:   company,
  };

  try {
    const r = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: brevo,
      body: JSON.stringify({
        email,
        attributes:    contactAttrs,
        listIds:       [BREVO_LIST_ID],
        updateEnabled: true,
      }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      if (err.code !== 'duplicate_parameter') {
        console.error('Brevo contacts error:', JSON.stringify(err));
      }
    }
  } catch (e) {
    console.error('Brevo contacts network error:', e.message);
    return { statusCode: 502, headers: cors, body: JSON.stringify({ error: 'Could not reach Brevo. Try again.' }) };
  }

  // ── 2. Welcome email to the investor with document links ────────────────
  const docRows = DOCS.map(d => `
    <tr><td style="padding:5px 0">
      <a href="${d.url}"
         style="display:block;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);
                border-radius:8px;padding:14px 20px;color:#F2A900;font-weight:700;
                font-size:14px;text-decoration:none;font-family:Arial,sans-serif">
        ${d.label} &rarr;
      </a>
    </td></tr>`).join('');

  const investorEmail = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#070b12;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#070b12;padding:40px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#0b1421;border-radius:12px;max-width:600px;width:100%">
  <tr><td style="padding:28px 36px;border-bottom:1px solid rgba(255,255,255,.08)">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:12px;vertical-align:middle">
        <svg viewBox="0 0 100 100" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 14 L80 70 H20 Z" fill="none" stroke="#F2A900" stroke-width="6"/>
          <circle cx="50" cy="74" r="9" fill="#F2A900"/>
        </svg>
      </td>
      <td style="vertical-align:middle">
        <div style="color:#fff;font-weight:700;font-size:15px;letter-spacing:3px;font-family:Arial,sans-serif">ONTERRA</div>
        <div style="color:#93a6b8;font-size:10px;letter-spacing:2px;font-family:Arial,sans-serif">NIGERIA LIMITED</div>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:36px">
    <p style="color:#F2A900;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0 0 14px;font-family:Arial,sans-serif">Investor Materials</p>
    <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 18px;line-height:1.3;font-family:Arial,sans-serif">
      Hello ${firstName}, your documents are ready.
    </h1>
    <p style="color:#93a6b8;font-size:14px;line-height:1.75;margin:0 0 28px;font-family:Arial,sans-serif">
      Thank you for your interest in the Onterra marginal field investment opportunity.
      Click each link below to download your three confidential investor documents directly.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">${docRows}</table>
    <p style="color:#5b6b7a;font-size:12px;line-height:1.7;margin:28px 0 0;font-family:Arial,sans-serif">
      Strictly confidential. For qualified investors only. Financial projections are indicative,
      based on base-case assumptions. PIA 2021 fiscal terms should be confirmed with a tax adviser.
    </p>
  </td></tr>
  <tr><td style="padding:0 36px 32px">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(242,169,0,.07);border-radius:8px;border:1px solid rgba(242,169,0,.18)">
      <tr><td style="padding:20px 24px">
        <p style="color:#fff;font-size:14px;font-weight:700;margin:0 0 12px;font-family:Arial,sans-serif">Ready to discuss?</p>
        <a href="https://wa.me/2348147669552?text=Hello%20Onterra%2C%20I%20reviewed%20the%20materials%20and%20would%20like%20to%20discuss%20further."
           style="display:inline-block;background:#F2A900;color:#1a1100;font-weight:700;
                  font-size:13px;padding:11px 22px;border-radius:100px;text-decoration:none;font-family:Arial,sans-serif">
          Message us on WhatsApp
        </a>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,.08)">
    <p style="color:#5b6b7a;font-size:11px;margin:0;font-family:Arial,sans-serif">
      No. 4 Adetunji Street, Lagos, Nigeria &nbsp;&middot;&nbsp; +234 814 766 9552 &nbsp;&middot;&nbsp; onterra.ng
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  // ── 3. Lead-alert email to Onterra ──────────────────────────────────────
  const isDownload = !!(designation || company || phone); // heuristic: gate form, not newsletter
  const notifyHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:30px">
<div style="background:#fff;border-radius:10px;padding:28px 32px;max-width:520px;margin:0 auto">
  <p style="color:#F2A900;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin:0 0 12px">New Lead</p>
  <h2 style="color:#0b1421;margin:0 0 20px;font-size:20px">${isDownload ? 'Investor documents downloaded' : 'Newsletter signup'}</h2>
  <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;line-height:2">
    <tr><td style="color:#666;width:120px">Name</td><td style="color:#111;font-weight:600">${name}</td></tr>
    <tr><td style="color:#666">Email</td><td style="color:#111">${email}</td></tr>
    ${phone       ? `<tr><td style="color:#666">Phone</td><td style="color:#111">${phone}</td></tr>` : ''}
    ${company     ? `<tr><td style="color:#666">Company</td><td style="color:#111">${company}</td></tr>` : ''}
    ${designation ? `<tr><td style="color:#666">Role</td><td style="color:#111">${designation}</td></tr>` : ''}
  </table>
  <div style="margin-top:20px">
    <a href="https://wa.me/${encodeURIComponent(phone.replace(/\D/g,'') || '2348147669552')}?text=Hi%20${encodeURIComponent(firstName)}%2C%20thanks%20for%20your%20interest%20in%20Onterra."
       style="display:inline-block;background:#25D366;color:#fff;font-weight:700;padding:10px 20px;border-radius:100px;text-decoration:none;font-size:13px">
      Reply on WhatsApp
    </a>
  </div>
</div>
</body></html>`;

  // Send both emails concurrently
  const emailPayloads = [
    // Welcome to investor
    {
      sender:      { name: SENDER_NAME, email: SENDER_EMAIL },
      to:          [{ email, name }],
      subject:     'Your Onterra Nigeria investor materials',
      htmlContent: investorEmail,
    },
    // Alert to Onterra
    {
      sender:      { name: SENDER_NAME, email: SENDER_EMAIL },
      to:          [{ email: NOTIFY_EMAIL, name: 'Abiola Onikoyi' }],
      subject:     `New ${isDownload ? 'investor lead' : 'newsletter subscriber'}: ${name} ${company ? `(${company})` : ''}`.trim(),
      htmlContent: notifyHtml,
    },
  ];

  await Promise.allSettled(
    emailPayloads.map(payload =>
      fetch('https://api.brevo.com/v3/smtp/email', {
        method:  'POST',
        headers: brevo,
        body:    JSON.stringify(payload),
      }).then(async r => {
        if (!r.ok) console.error('Brevo email error:', JSON.stringify(await r.json().catch(() => ({}))));
      }).catch(e => console.error('Brevo email network error:', e.message))
    )
  );

  return {
    statusCode: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true }),
  };
};

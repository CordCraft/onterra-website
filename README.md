# Onterra Nigeria Limited, Website

Marketing site for **Onterra Nigeria Limited**, an oil & gas consultancy that develops and
facilitates marginal field acquisition and production in Nigeria, **from purchase to first oil**.

Built with **GSAP** (scroll animation), **Three.js** (animated 3D reservoir hero) and a
**self-updating blog**. Hosted on **Netlify** at **onterra.ng**.

---

## The auto-updating blog (two parts, zero JSON editing)

The Insights section combines two sources automatically:

1. **Live industry news, fully automatic.** A serverless function
   ([`netlify/functions/news.mjs`](netlify/functions/news.mjs)) pulls fresh Nigerian oil & gas
   headlines (NUPRC, marginal fields, crude, upstream) from Google News, server-side, and the
   blog shows them as cards. **It refreshes itself. You do nothing.** Tune what it tracks by
   editing the `QUERY` line in that file.
2. **Your own articles, written in a dashboard.** Visit **onterra.ng/admin**, log in, and write
   posts in a normal editor with an image uploader. Behind the scenes it saves into
   `data/posts.json`, **so you never touch JSON**. Your newest article is featured at the top;
   live news fills the rest.

If either source is down, the other still shows, the page never breaks.

---

## Publishing & setup on Netlify (one-time)

The dashboard and the news function need the site deployed from a **Git repo** (not drag-and-drop).
Steps:

### 1. Put the site in a Git repo
- Create a free **GitHub** account and a new repository.
- Upload the contents of this `onterra-website` folder to it (GitHub's "upload files" works, or use
  `git`). `index.html` must sit at the repo root.

### 2. Connect it to your Netlify site
- In Netlify: **Site configuration → Build & deploy → Continuous deployment → Link repository**,
  and pick your GitHub repo. (If your current site was a drag-and-drop, link the repo to that same
  site so the **onterra.ng** domain carries over.)
- No build command is needed; `netlify.toml` already sets `publish = "."` and the functions folder.
- Deploy. The live news function goes live automatically at `/api/news`.

### 3. Turn on the /admin dashboard (Decap CMS)
- Netlify: **Site configuration → Identity → Enable Identity.**
- Under Identity → **Registration**, set it to **Invite only** (so only you can log in).
- Identity → **Services → Git Gateway → Enable.**
- Identity → **Invite users** → invite your own email. Accept the email, set a password.
- Go to **onterra.ng/admin**, log in, and publish. Done.

> Local preview of the dashboard (optional, needs Node): run `npx decap-server` in one terminal
> and serve the site in another; `local_backend: true` in `admin/config.yml` points the editor at it.

### DNS
You've already pointed **onterra.ng** at Netlify. Once propagation finishes (can take up to a few
hours), Netlify auto-provisions HTTPS. Nothing else to do.

---

## Run it locally

The blog fetches files, so use a small web server (not `file://`):

```bash
python -m http.server 8000   # then open http://localhost:8000
```

Locally the live-news cards won't appear (the function only runs on Netlify), so you'll see your
curated posts only, that's expected.

---

## File map

```
onterra-website/
├── index.html              ← page content & sections
├── css/styles.css          ← styling (brand colours in :root at the top)
├── js/three-hero.js        ← animated 3D reservoir hero
├── js/main.js              ← GSAP animations, menu, counters, contact form
├── js/blog.js              ← merges curated posts + live news, renders feed
├── data/posts.json         ← your articles (managed for you via /admin)
├── admin/                  ← the /admin dashboard (Decap CMS)
│   ├── index.html
│   └── config.yml
├── netlify/functions/
│   └── news.mjs            ← live oil & gas news engine
├── netlify.toml            ← Netlify config (publish dir, function, redirects, headers)
└── README.md
```

## Quick edits

| Want to change… | Where |
|---|---|
| What news topics are tracked | `QUERY` in `netlify/functions/news.mjs` |
| How many news items show | `MAX_ITEMS` in the same file |
| Brand colours | `:root` at top of `css/styles.css` |
| Phone / WhatsApp | search `2348147669552` and `+234 814 766 9552` |
| Address | search `Adetunji Street` in `index.html` |
| Your own blog posts | the **/admin** dashboard (no code) |

## Contact details wired in
- **Address:** No. 4 Adetunji Street, Lagos, Nigeria
- **Phone / WhatsApp:** +234 814 766 9552 (contact form & buttons open a pre-filled WhatsApp chat)

## Brand assets
`assets/brand/` holds the logo system: `onterra-mark.svg` (emblem), `onterra-logo-dark.svg`
(for dark backgrounds), `onterra-logo-light.svg` (for white backgrounds, letterheads) and
`og-image.png` (the social share card). Regenerate the share card with
`python build_og_image.py` (script lives in Downloads).

## News card photos (automatic)
`netlify/functions/news.mjs` attaches a relevant stock photo to every live headline.
Add any of these free API keys as Netlify environment variables and it starts working,
in this order of preference: `UNSPLASH_ACCESS_KEY`, `PEXELS_API_KEY`, `PIXABAY_API_KEY`.
No keys set = the built-in placeholder images keep showing. Nothing breaks either way.

## Article images on demand (fal.ai, only when you choose)
**Image Studio, works from any computer:** visit **onterra.ng/admin/studio.html**, log in
(same Netlify Identity login as /admin), describe the article, preview the image, then
click Save. The image is committed to GitHub and deploys with the site; paste the printed
path into the editor's Image field in /admin.
Needs two Netlify env vars: `FAL_KEY` (fal.ai API key) and `GITHUB_TOKEN` (fine-grained
GitHub token, only this repo, permission Contents: Read and write). Generation is blocked
for anyone not logged in, so the keys cannot be spent by strangers.
Costs: about $0.003 per fast draft, $0.025 per best-quality image.

**Local fallback (this computer only):** put `FAL_KEY=your-key` in a gitignored `.env`
next to `index.html`, then `python tools/generate-article-image.py "Your article title"`.

## Where visitor data lives
Every gate signup and newsletter subscriber is stored in **Brevo → Contacts**, list
"Onterra Family" (ID 2), with name, phone, and company attributes. Export any time via
Brevo → Contacts → Export. Each investor-gate signup also emails a lead alert to
**info@onterra.ng** with the person's full details, so your inbox is a second record.

## Still to come (per your note)
- Real company numbers (currently the stats are safe placeholders, edit in `index.html`).
- Your own field/operation photos (drop into `images/`, see image notes).

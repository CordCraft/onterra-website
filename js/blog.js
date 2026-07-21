/* =========================================================
   ONTERRA, auto-updating blog
   Combines two sources, sorts by date, renders the feed:
     1. data/posts.json  -> Onterra's own articles, written in
        the /admin dashboard (you never edit JSON by hand).
     2. /api/news         -> live Nigerian oil & gas headlines
        from a serverless function (refreshes on its own).
   The newest Onterra article is featured; live news fills the
   rest. Degrades gracefully if either source is unavailable
   (e.g. when previewing locally without Netlify functions).
   ========================================================= */
(function () {
  const mount = document.getElementById('blog');
  const updated = document.getElementById('insightsUpdated');
  const reader = document.getElementById('reader');
  const readerContent = document.getElementById('readerContent');
  const readerClose = document.getElementById('readerClose');
  if (!mount) return;

  const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

  const fmt = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso || '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const renderBody = (body) => {
    if (!body) return '';
    try { return window.marked ? window.marked.parse(body) : body; }
    catch (e) { return body; }
  };

  // Fallback image so a missing/broken link never shows blank
  const fallback = (seed) =>
    `https://picsum.photos/seed/onterra-${encodeURIComponent(seed || 'oil')}/1200/750`;

  function imgWithFallback(src, seed, alt) {
    const img = new Image();
    img.alt = alt || '';
    img.loading = 'lazy';
    img.addEventListener('load', function () {
      const wrap = img.closest('.post__media');
      if (wrap) wrap.classList.add('is-loaded');
    });
    img.addEventListener('error', function () {
      if (img.dataset.fellBack) return;
      img.dataset.fellBack = '1';
      img.src = fallback(seed);
    });
    img.src = src || fallback(seed);
    return img;
  }

  function render(posts) {
    mount.innerHTML = '';
    posts.forEach((p, i) => {
      const card = document.createElement('article');
      card.className = 'post' + (i === 0 ? ' post--feature' : '');
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', 'Read: ' + p.title);

      const media = document.createElement('div');
      media.className = 'post__media';
      const tag = document.createElement('span');
      tag.className = 'post__tag';
      tag.textContent = p.tag || 'Insight';
      media.appendChild(tag);
      const im = imgWithFallback(p.image, p.seed || p.id, p.title);
      if (p.imageCredit) im.title = p.imageCredit;
      media.appendChild(im);

      const ctaLabel = p.external
        ? 'Read on ' + (p.author || 'source') + ' →'
        : 'Read insight →';

      const body = document.createElement('div');
      body.className = 'post__body';
      body.innerHTML =
        `<div class="post__meta">${fmt(p.date)} · ${p.author || 'Onterra'}</div>` +
        `<h3 class="post__title">${p.title}</h3>` +
        `<p class="post__excerpt">${p.excerpt || ''}</p>` +
        `<span class="post__more">${ctaLabel}</span>`;

      card.appendChild(media);
      card.appendChild(body);

      const open = () => {
        if (p.external && p.link) {
          window.open(p.link, '_blank', 'noopener');
        } else {
          openReader(p);
        }
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
      mount.appendChild(card);
    });

    const newest = posts.map((p) => p.date).filter(Boolean).sort().pop();
    if (updated && newest) updated.textContent = 'Last updated ' + fmt(newest);

    if (window.gsap) {
      gsap.from('.post', {
        opacity: 0, y: 30, duration: 0.7, stagger: 0.08, ease: 'power3.out',
        scrollTrigger: { trigger: '#blog', start: 'top 85%' },
      });
    }
  }

  function openReader(p) {
    if (!reader) return;
    const hero = p.image
      ? `<div class="reader__hero"><img src="${p.image}" alt="${p.title}"
            onerror="this.onerror=null;this.src='${fallback(p.seed || p.id)}'"></div>`
      : '';
    readerContent.innerHTML =
      hero +
      `<div class="post__meta">${(p.tag || 'Insight')} · ${fmt(p.date)} · ${p.author || 'Onterra'}</div>` +
      `<h1>${p.title}</h1>` +
      (p.body ? renderBody(p.body) : `<p>${p.excerpt || ''}</p>`);
    reader.classList.add('is-open');
    reader.setAttribute('aria-hidden', 'false');
    readerContent.scrollTop = 0;
    document.body.style.overflow = 'hidden';
  }

  function closeReader() {
    if (!reader) return;
    reader.classList.remove('is-open');
    reader.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (readerClose) readerClose.addEventListener('click', closeReader);
  if (reader) reader.addEventListener('click', (e) => { if (e.target === reader) closeReader(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeReader(); });

  // ---- Load both sources in parallel; either may fail safely ----
  const bust = Math.floor(Date.now() / 60000);
  const getCurated = fetch('data/posts.json?ts=' + bust)
    .then((r) => (r.ok ? r.json() : { posts: [] }))
    .then((d) => (d.posts || []).map((p) => ({ ...p, external: false })))
    .catch(() => []);

  const getNews = fetch('/api/news')
    .then((r) => (r.ok ? r.json() : { posts: [] }))
    .then((d) => d.posts || [])
    .catch(() => []);

  Promise.all([getCurated, getNews]).then(([curated, news]) => {
    const all = [...curated, ...news].filter((p) => p && p.title);
    if (!all.length) {
      mount.innerHTML =
        '<p class="blog__loading">Insights will appear here once deployed. ' +
        'Live news loads from <code>/api/news</code> on Netlify; your own posts come from the ' +
        '<code>/admin</code> dashboard.</p>';
      return;
    }
    all.sort(byDateDesc);

    // Feature the newest Onterra-authored post if there is one; else newest overall.
    const feature = curated.slice().sort(byDateDesc)[0] || all[0];
    const rest = all.filter((p) => p !== feature);
    render([feature, ...rest]);
  });
})();

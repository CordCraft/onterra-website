/* Onterra investor gate: intercepts download buttons, collects contact details,
   calls /api/subscribe, then triggers all three document downloads. */

(function () {
  const DOCS = [
    '/assets/docs/Onterra-Nigeria-Financial-Model.xlsx',
    '/assets/docs/Onterra-Nigeria-Investor-Pitch-Deck.pptx',
    '/assets/docs/Onterra-Nigeria-One-Pager.pdf',
  ];

  const modal    = document.getElementById('gateModal');
  const form     = document.getElementById('gateForm');
  const closeBtn = document.getElementById('gateClose');
  const success  = document.getElementById('gateSuccess');
  const submitBtn = document.getElementById('gateSubmit');

  function openGate() {
    modal.removeAttribute('aria-hidden');
    modal.setAttribute('aria-modal', 'true');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => modal.classList.add('is-open'));
    setTimeout(() => { const first = form.querySelector('input'); if (first) first.focus(); }, 160);
  }

  function closeGate() {
    modal.classList.remove('is-open');
    setTimeout(() => {
      modal.setAttribute('aria-hidden', 'true');
      modal.removeAttribute('aria-modal');
      document.body.style.overflow = '';
      success.hidden = true;
      form.hidden = false;
      form.reset();
      submitBtn.disabled = false;
      submitBtn.textContent = 'Get the documents';
    }, 320);
  }

  // Any element with data-gate opens the modal
  document.querySelectorAll('[data-gate]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); openGate(); });
  });

  modal.addEventListener('click', e => { if (e.target === modal) closeGate(); });
  closeBtn.addEventListener('click', closeGate);
  document.getElementById('gateSuccessClose').addEventListener('click', closeGate);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.getAttribute('aria-hidden')) closeGate(); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    const data = Object.fromEntries(new FormData(form));

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Server error');

      // Show success state
      form.hidden = true;
      success.hidden = false;

      // Stagger downloads so browsers don't block them
      DOCS.forEach((url, i) => {
        setTimeout(() => {
          const a = Object.assign(document.createElement('a'), { href: url, download: '' });
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }, i * 900);
      });
    } catch {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Get the documents';
      const err = document.getElementById('gateError');
      if (err) { err.hidden = false; setTimeout(() => { err.hidden = true; }, 5000); }
    }
  });

  // Newsletter-only signup (name + email, no document gate)
  const nlForm = document.getElementById('newsletterForm');
  if (nlForm) {
    const nlBtn = nlForm.querySelector('button[type="submit"]');
    const nlMsg = document.getElementById('nlMsg');

    nlForm.addEventListener('submit', async e => {
      e.preventDefault();
      nlBtn.disabled = true;
      nlBtn.textContent = 'Subscribing…';

      const { name, email } = Object.fromEntries(new FormData(nlForm));

      try {
        const res = await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email }),
        });
        if (!res.ok) throw new Error();
        if (nlMsg) { nlMsg.textContent = 'You\'re subscribed. Welcome to the Onterra family.'; nlMsg.hidden = false; }
        nlBtn.textContent = 'Subscribed';
        nlForm.reset();
      } catch {
        nlBtn.disabled = false;
        nlBtn.textContent = 'Subscribe';
        if (nlMsg) { nlMsg.textContent = 'Something went wrong. Please try again.'; nlMsg.hidden = false; }
      }
    });
  }
})();

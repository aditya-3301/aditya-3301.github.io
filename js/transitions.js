/* ==========================================================================
   transitions.js — dolly-zoom page transitions between index.html and
   gallery.html (all 4 legs: outbound forward, outbound reverse, and both
   arrivals). Split out of mainscript.js so this is the only file that needs
   handing over for anything transition-related.

   Depends on: GSAP (loaded globally), and mainscript.js's particle-bg IIFE
   for window.__dollyParticlePause/__dollyParticleResume (optional-chained
   below, so this still works fine if that script isn't present/loaded yet).
   Load this AFTER mainscript.js.
   ========================================================================== */

// The SVG feDisplacementMap "liquid glass" backdrop-filter (see the perf-mode
// block in mainstyle.css that force-disables it mid-transition) occasionally
// comes back blank once dolly-active/pt-arriving is lifted - Chromium
// sometimes just never repaints an SVG-referenced backdrop-filter it had
// switched off, even though the property value is back to normal. Toggling
// the inline value off then back on across two animation frames forces a
// fresh paint, which reliably brings the distortion back every time.
function forceGlassRepaint(){
  const glassEls = document.querySelectorAll(
    '[data-app-nav] div[style*="glass-filter"], .gallery-nav-inner, .photo-subnav-inner, .specimen, .tag-chip, .fieldlog'
  );
  requestAnimationFrame(() => {
    glassEls.forEach(el => { el.style.backdropFilter = 'none'; el.style.webkitBackdropFilter = 'none'; });
    requestAnimationFrame(() => {
      glassEls.forEach(el => { el.style.removeProperty('backdrop-filter'); el.style.removeProperty('-webkit-backdrop-filter'); });
    });
  });
}

/* ------------------------------------------------------------------------
   Dolly-zoom page transition: index.html "View Photography" -> gallery.html

   Concept: the camera pushes forward through whatever part of the page is
   currently on screen, while a portal (the gallery, waiting behind the
   glass) rushes in from depth to meet it. Only elements actually visible
   in the viewport at click-time are animated, each with its own depth/
   tilt proportional to its offset from viewport centre - so the push
   reads as one continuous 3D camera move, not a canned page-wide effect.
   Navigation happens once the portal fully covers the screen; gallery.html
   picks the illusion back up on arrival (see the matching block at the
   bottom of this file, gated on the pt-arriving flag it sets before nav).
   ------------------------------------------------------------------------ */
(() => {
  const cta = document.querySelector('.photo-cta');
  if (!cta || typeof gsap === 'undefined') return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Warm the destination the moment intent is likely, so the portal never
  // has to wait on it once it covers the screen.
  let prefetched = false;
  function prefetchGallery(){
    if (prefetched) return; prefetched = true;
    const l = document.createElement('link');
    l.rel = 'prefetch'; l.href = cta.getAttribute('href'); l.as = 'document';
    document.head.appendChild(l);
  }
  cta.addEventListener('mouseenter', prefetchGallery, { once: true });
  cta.addEventListener('touchstart', prefetchGallery, { once: true, passive: true });
  cta.addEventListener('focus', prefetchGallery, { once: true });

  const portal = document.createElement('div');
  portal.className = 'dolly-portal';
  portal.innerHTML = '<span class="dolly-portal-label">Photography</span>';
  document.body.appendChild(portal);

  const DOLLY_SELECTORS = 'nav[data-app-nav], header, .hero, .fieldlog, #projects, #experience, footer.site-footer, .bg-image, #particle-bg';

  cta.addEventListener('click', (e) => {
    e.preventDefault();
    if (document.documentElement.classList.contains('dolly-active')) return;
    const href = cta.getAttribute('href');
    prefetchGallery();

    if (reduceMotion) {
      sessionStorage.setItem('pt-arrive', '1');
      window.location.href = href;
      return;
    }

    document.documentElement.classList.add('dolly-active');
    const vw = innerWidth, vh = innerHeight, cx = vw / 2, cy = vh / 2;

    // Only the elements actually on screen right now take part - a scroll
    // position showing just the Photography paragraph animates differently
    // than one showing the full page, by design.
    const targets = Array.from(document.querySelectorAll(DOLLY_SELECTORS)).filter(el => {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw && r.width > 0 && r.height > 0;
    });

    window.__dollyParticlePause && window.__dollyParticlePause();
    gsap.set(targets, { filter: 'blur(0px) brightness(1)', transformOrigin: '50% 50%', transformPerspective: 1400, willChange: 'transform, filter' });

    const tl = gsap.timeline({
      defaults: { ease: 'power2.in' },
      onComplete: () => {
        sessionStorage.setItem('pt-arrive', '1');
        window.location.href = href;
      }
    });

    targets.forEach(el => {
      const r = el.getBoundingClientRect();
      // Offset from viewport centre, normalised -1..1: this is what turns a
      // flat scale into a genuine forward push - elements near the centre
      // (usually the CTA itself) barely move, peripheral ones sweep past
      // faster, exactly like a real dolly shot.
      const dx = (r.left + r.width / 2 - cx) / cx;
      const dy = (r.top + r.height / 2 - cy) / cy;
      const isCta = el.contains(cta) || el === cta;
      tl.to(el, {
        z: isCta ? 60 : 340 + Math.random() * 90,
        x: `+=${dx * 120}`,
        y: `+=${dy * 120}`,
        rotationX: dy * -5,
        rotationY: dx * 5,
        scale: isCta ? 1.06 : 1.2,
        filter: 'blur(9px) brightness(0.5)',
        duration: 0.85,
      }, 0);
    });

    // The CTA leads the push, staying sharp a beat longer than everything
    // else, since it's the thing the eye is on when the click happens.
    tl.to(cta, { z: 140, scale: 1.15, filter: 'blur(4px) brightness(0.85)', transformPerspective: 1400, duration: 0.55 }, 0.15);

    tl.set(portal, { display: 'flex' }, 0)
      .fromTo(portal, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.8, ease: 'power2.out' }, 0.2)
      .fromTo(portal.querySelector('.dolly-portal-label'),
        { opacity: 0, y: 16, scale: 0.94 },
        { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'power2.out' }, 0.5);
  });

  // Bfcache guard: if the user hits Back from gallery.html, some browsers
  // restore this page from bfcache exactly as it was frozen mid-transition
  // (zoomed/blurred targets, cursor:wait, portal visible) without re-running
  // any script. `pageshow` with event.persisted fires on that restore even
  // though nothing else did, so this is the one place we can catch it and
  // put the page back to a normal resting state.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    gsap.killTweensOf(DOLLY_SELECTORS);
    gsap.killTweensOf(portal);
    gsap.set(DOLLY_SELECTORS, { clearProps: 'all' });
    gsap.set(portal, { display: 'none', opacity: 0, scale: 0.7 });
    gsap.set(portal.querySelector('.dolly-portal-label'), { opacity: 0 });
    document.documentElement.classList.remove('dolly-active');
    forceGlassRepaint();
    window.__dollyParticleResume && window.__dollyParticleResume();
  });
})();

/* ------------------------------------------------------------------------
   Dolly-zoom page transition, reverse leg: gallery.html "← Aditya" ->
   index.html. Same push-through-the-screen concept as the forward shot
   above, just aimed at the gallery's own on-screen elements, landing on
   index.html (see the matching arrival block further down, gated on
   pt-arriving-home).
   ------------------------------------------------------------------------ */
(() => {
  const back = document.querySelector('.gallery-nav-back');
  if (!back || typeof gsap === 'undefined') return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let prefetched = false;
  function prefetchHome(){
    if (prefetched) return; prefetched = true;
    const l = document.createElement('link');
    l.rel = 'prefetch'; l.href = back.getAttribute('href'); l.as = 'document';
    document.head.appendChild(l);
  }
  back.addEventListener('mouseenter', prefetchHome, { once: true });
  back.addEventListener('touchstart', prefetchHome, { once: true, passive: true });
  back.addEventListener('focus', prefetchHome, { once: true });

  const portal = document.getElementById('dollyPortal');
  // innerHTML (not textContent) so the "Aditya" half can reuse the exact same
  // per-letter coloured spans as the hero h1 - that's what lets the portal
  // text sit under the real hero name without a visible recolour/reflow snap.
  if (portal) portal.querySelector('.dolly-portal-label').innerHTML =
    '<span class="dolly-name"><span class="letters">' +
    '<span class="letter" style="--hc:var(--rust)">A</span>' +
    '<span class="letter" style="--hc:var(--moss)">d</span>' +
    '<span class="letter" style="--hc:var(--amber)">i</span>' +
    '<span class="letter" style="--hc:var(--teal)">t</span>' +
    '<span class="letter" style="--hc:var(--clay)">y</span>' +
    '<span class="letter" style="--hc:var(--sage)">a</span>' +
    '</span></span> <span class="dolly-surname">Shankar</span>';

  const DOLLY_SELECTORS_BACK = '.gallery-nav, .gallery-page-head, .photo-grid, .bg-image';

  back.addEventListener('click', (e) => {
    e.preventDefault();
    if (document.documentElement.classList.contains('dolly-active')) return;
    const href = back.getAttribute('href');
    prefetchHome();

    if (reduceMotion) {
      sessionStorage.setItem('pt-arrive-home', '1');
      window.location.href = href;
      return;
    }

    document.documentElement.classList.add('dolly-active');
    const vw = innerWidth, vh = innerHeight, cx = vw / 2, cy = vh / 2;

    const targets = Array.from(document.querySelectorAll(DOLLY_SELECTORS_BACK)).filter(el => {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw && r.width > 0 && r.height > 0;
    });

    window.__dollyParticlePause && window.__dollyParticlePause();
    gsap.set(targets, { filter: 'blur(0px) brightness(1)', transformOrigin: '50% 50%', transformPerspective: 1400, willChange: 'transform, filter' });

    const tl = gsap.timeline({
      defaults: { ease: 'power2.in' },
      onComplete: () => {
        sessionStorage.setItem('pt-arrive-home', '1');
        window.location.href = href;
      }
    });

    targets.forEach(el => {
      const r = el.getBoundingClientRect();
      const dx = (r.left + r.width / 2 - cx) / cx;
      const dy = (r.top + r.height / 2 - cy) / cy;
      const isBack = el.contains(back) || el === back;
      tl.to(el, {
        z: isBack ? 60 : 340 + Math.random() * 90,
        x: `+=${dx * 120}`,
        y: `+=${dy * 120}`,
        rotationX: dy * -5,
        rotationY: dx * 5,
        scale: isBack ? 1.06 : 1.2,
        filter: 'blur(9px) brightness(0.5)',
        duration: 0.85,
      }, 0);
    });

    tl.to(back, { z: 140, scale: 1.15, filter: 'blur(4px) brightness(0.85)', transformPerspective: 1400, duration: 0.55 }, 0.15);

    if (portal) {
      tl.set(portal, { display: 'flex' }, 0)
        .fromTo(portal, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.8, ease: 'power2.out' }, 0.2)
        .fromTo(portal.querySelector('.dolly-portal-label'),
          { opacity: 0, y: 16, scale: 0.94 },
          { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'power2.out' }, 0.5);
    }
  });

  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    gsap.killTweensOf(DOLLY_SELECTORS_BACK);
    if (portal) gsap.killTweensOf(portal);
    gsap.set(DOLLY_SELECTORS_BACK, { clearProps: 'all' });
    if (portal) {
      gsap.set(portal, { display: 'none', opacity: 0, scale: 0.7 });
      gsap.set(portal.querySelector('.dolly-portal-label'), { opacity: 0 });
    }
    document.documentElement.classList.remove('dolly-active');
    forceGlassRepaint();
    window.__dollyParticleResume && window.__dollyParticleResume();
  });
})();

/* ------------------------------------------------------------------------
   Index-side arrival: the reverse half's landing. Mirrors the gallery-side
   arrival block below, gated on pt-arriving-home instead of pt-arriving.
   ------------------------------------------------------------------------ */
(() => {
  if (!document.documentElement.classList.contains('pt-arriving-home')) return;
  document.documentElement.classList.remove('pt-arriving-home');

  const portal = document.getElementById('dollyPortalHome');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The nav is handled separately from the rest: it contains a descendant
  // div with `backdrop-filter: url(#glass-filter-...)` (the liquid-glass
  // pill). Animating `filter` or `transform`/`scale` directly on an
  // ANCESTOR of an SVG-referenced backdrop-filter element corrupts/blanks
  // that backdrop-filter in Chromium - it's not a paint timing issue, so no
  // amount of repainting the glass div itself fixes it. The nav gets a
  // plain opacity fade instead; everything else keeps the full blur+scale
  // treatment.
  const navEl = document.querySelector('nav[data-app-nav]');
  const blurTargets = ['header', '.hero', '.fieldlog', '#projects', '#experience', 'footer.site-footer', '.bg-image']
    .map(sel => document.querySelector(sel)).filter(Boolean);
  const targets = navEl ? [navEl, ...blurTargets] : blurTargets;

  if (reduceMotion || typeof gsap === 'undefined') {
    targets.forEach(el => { el.style.opacity = ''; el.style.transform = ''; el.style.filter = ''; });
    if (portal) portal.style.display = 'none';
    return;
  }

  gsap.set(blurTargets, { opacity: 0, scale: 1.07, filter: 'blur(7px)', transformOrigin: '50% 50%', transformPerspective: 1400 });
  if (navEl) gsap.set(navEl, { opacity: 0 });
  if (portal) gsap.set(portal, { display: 'flex', opacity: 1, scale: 1 });

  gsap.timeline({ delay: 0.05, defaults: { ease: 'power2.out' } })
    .to(blurTargets, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.9, stagger: 0.06 }, 0)
    .to(navEl || [], { opacity: 1, duration: 0.9 }, 0)
    .to(portal, {
      opacity: 0, scale: 1.15, duration: 0.7, ease: 'power2.inOut',
      onComplete: () => { if (portal) portal.style.display = 'none'; document.documentElement.classList.remove('dolly-active'); }
    }, 0.15);

  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    gsap.killTweensOf(targets);
    if (portal) gsap.killTweensOf(portal);
    gsap.set(targets, { clearProps: 'all' });
    if (portal) { gsap.set(portal, { clearProps: 'all' }); portal.style.display = 'none'; }
    document.documentElement.classList.remove('dolly-active');
  });
})();

/* ------------------------------------------------------------------------
   Gallery-side arrival: the reverse half of the shot above. gallery.html's
   inline head script sets html.pt-arriving synchronously (before first
   paint) whenever sessionStorage carries the pt-arrive flag, and renders
   the portal already covering the screen via CSS - so there's never a
   frame of bare gallery visible underneath. From here we just let the
   portal recede while the real gallery settles in from a slightly
   forward-pushed state, as if the camera never actually stopped moving.
   ------------------------------------------------------------------------ */
(() => {
  if (!document.documentElement.classList.contains('pt-arriving')) return;
  document.documentElement.classList.remove('pt-arriving');

  const portal = document.getElementById('dollyPortal');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Same reasoning as the index-side arrival: .gallery-nav wraps a
  // .gallery-nav-inner glass pill with an SVG-referenced backdrop-filter,
  // so it can't have filter/transform animated on it directly without
  // corrupting that backdrop-filter. Opacity-only fade for the nav.
  const navEl = document.querySelector('.gallery-nav');
  const blurTargets = ['.gallery-page-head', '.photo-grid', '.bg-image']
    .map(sel => document.querySelector(sel)).filter(Boolean);
  const targets = navEl ? [navEl, ...blurTargets] : blurTargets;

  if (reduceMotion || typeof gsap === 'undefined') {
    targets.forEach(el => { el.style.opacity = ''; el.style.transform = ''; el.style.filter = ''; });
    if (portal) portal.style.display = 'none';
    return;
  }

  gsap.set(blurTargets, { opacity: 0, scale: 1.07, filter: 'blur(7px)', transformOrigin: '50% 50%', transformPerspective: 1400 });
  if (navEl) gsap.set(navEl, { opacity: 0 });
  if (portal) gsap.set(portal, { display: 'flex', opacity: 1, scale: 1 });

  gsap.timeline({ delay: 0.05, defaults: { ease: 'power2.out' } })
    .to(blurTargets, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.9, stagger: 0.06 }, 0)
    .to(navEl || [], { opacity: 1, duration: 0.9 }, 0)
    .to(portal, {
      opacity: 0, scale: 1.15, duration: 0.7, ease: 'power2.inOut',
      onComplete: () => { if (portal) portal.style.display = 'none'; document.documentElement.classList.remove('dolly-active'); }
    }, 0.15);

  // Same bfcache guard as index.html: if gallery.html itself gets restored
  // from bfcache mid-arrival, clear the leftover blur/scale/opacity so it

  // doesn't come back looking half-materialized.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    gsap.killTweensOf(targets);
    if (portal) gsap.killTweensOf(portal);
    gsap.set(targets, { clearProps: 'all' });
    if (portal) { gsap.set(portal, { clearProps: 'all' }); portal.style.display = 'none'; }
    document.documentElement.classList.remove('dolly-active');
    forceGlassRepaint();
  });
})();
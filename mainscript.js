// Canvas particle-network background: floating dots + connecting lines + a
// mouse "grab" line, self-contained (no particles.js dependency).
(() => {
  const canvas = document.getElementById('particle-bg');
  const ctx = canvas.getContext('2d');
  const colors = ['#8A9A5B', '#C1502E', '#D6A24C', '#4C8C86']; // moss, rust, amber, teal
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Low-power tier: weak RAM/cores or a coarse (touch) pointer, where mouse-grab
  // lines are moot anyway. Used only to cap cost, never to change the desktop look.
  const LOW_POWER = (navigator.deviceMemory && navigator.deviceMemory <= 4)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
    || window.matchMedia('(pointer: coarse)').matches;
  const MAX_DPR = LOW_POWER ? 1 : 2;
  const DENSITY_DIVISOR = LOW_POWER ? 24000 : 16000; // fewer particles/px^2 on weak devices
  const MAX_PARTICLES = LOW_POWER ? 55 : 90;

  let w, h, dpr, particles = [];
  const mouse = { x: null, y: null };
  const LINK_DIST = 140;
  const GRAB_DIST = 160;
  let lastW = 0, lastH = 0;
  let paused = false;

  // iOS/Android Safari fire 'resize' repeatedly while the address bar
  // slides away during the first scroll (innerHeight keeps changing).
  // Only rebuild the particle field on a real width change - a toolbar
  // hide/show only changes height and shouldn't reshuffle the background.
  function resize(force) {
    const widthChanged = innerWidth !== lastW;
    const heightChanged = innerHeight !== lastH;
    if (!force && !widthChanged && !heightChanged) return;

    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    w = canvas.width = innerWidth * dpr;
    h = canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';

    if (force || widthChanged) rebuildParticles();
    lastW = innerWidth;
    lastH = innerHeight;
  }

  function rebuildParticles() {
    const count = Math.min(MAX_PARTICLES, Math.floor((innerWidth * innerHeight) / DENSITY_DIVISOR));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3 * dpr,
      vy: (Math.random() - 0.5) * 0.3 * dpr,
      r: (Math.random() * 1.5 + 1) * dpr,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));
    // extra cluster near the top-center, around the nav pill, so the glass distortion has more dots to refract
    const topBandCount = LOW_POWER ? 15 : 25;
    const topBandHeight = 140 * dpr;
    const centerBandWidth = w * 0.32;
    const centerBandStart = (w - centerBandWidth) / 2;
    for (let i = 0; i < topBandCount; i++) {
      particles.push({
        x: centerBandStart + Math.random() * centerBandWidth,
        y: Math.random() * topBandHeight,
        vx: (Math.random() - 0.5) * 0.3 * dpr,
        vy: (Math.random() - 0.5) * 0.15 * dpr,
        r: (Math.random() * 1.5 + 1) * dpr,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
  }

  function step() {
    ctx.clearRect(0, 0, w, h);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.95;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const linkDistPx = LINK_DIST * dpr, linkDistSq = linkDistPx * linkDistPx;
    const grabDistPx = GRAB_DIST * dpr, grabDistSq = grabDistPx * grabDistPx;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const distSq = dx * dx + dy * dy;
        // Cheap squared-distance reject first; sqrt only runs for pairs that are
        // actually going to be drawn (the vast majority of n^2 pairs aren't).
        if (distSq < linkDistSq) {
          const dist = Math.sqrt(distSq);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = 'rgba(180,180,170,' + (1 - dist / linkDistPx) * .4 + ')';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      if (mouse.x != null) {
        const dx = particles[i].x - mouse.x, dy = particles[i].y - mouse.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < grabDistSq) {
          const dist = Math.sqrt(distSq);
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = 'rgba(140,180,255,' + (1 - dist / grabDistPx) * .8 + ')';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
    if (!reduceMotion && !paused) requestAnimationFrame(step);
  }

  // Stop the rAF loop entirely while the tab/app is backgrounded - a canvas
  // nobody can see was previously still repainting ~60x/sec on every device.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      paused = true;
    } else if (paused) {
      paused = false;
      if (!reduceMotion) requestAnimationFrame(step);
    }
  });

  window.addEventListener('resize', () => resize(false), { passive: true });
  window.addEventListener('mousemove', e => { mouse.x = e.clientX * dpr; mouse.y = e.clientY * dpr; }, { passive: true });
  window.addEventListener('mouseleave', () => { mouse.x = null; mouse.y = null; });

  resize(true);
  step(); // draw at least one static frame even if reduced motion is on
})();

// Nav clock: renders local time/date, refreshed every 30s (cheap enough to
// not need rAF or a tighter interval).
function tick(){
    const d = new Date();
    let h = d.getHours(), m = d.getMinutes();
    const ampm = h >= 12 ? 'pm' : 'am';
    h = h % 12 || 12;
    const time = `${h}:${m.toString().padStart(2,'0')}`;
    const date = d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
    document.getElementById('clock').innerHTML = `<b>${time}</b> ${ampm}<br/>${date}`;
}
tick(); setInterval(tick, 1000*30);

// Main GSAP-driven interactions IIFE: scroll animations, hero entrance, nav,
// cards, cursor, and the name/surname particle-explosion easter eggs below.
// Scoped separately from the particle-bg IIFE above, so LOW_POWER is
// recomputed here rather than shared - each file section is self-contained.
(function(){
  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LOW_POWER = (navigator.deviceMemory && navigator.deviceMemory <= 4)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
    || window.matchMedia('(pointer: coarse)').matches;
  if (LOW_POWER) document.body.classList.add('low-power');

  /* Smooth scroll base (Lenis + GSAP ticker) */
  let lenis;
  if (!reduceMotion && typeof Lenis !== 'undefined'){
    lenis = new Lenis({ duration: 1.05, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    const lenisTick = (time)=>{ lenis.raf(time * 1000); };
    gsap.ticker.add(lenisTick);
    gsap.ticker.lagSmoothing(0);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) gsap.ticker.remove(lenisTick);
      else gsap.ticker.add(lenisTick);
    });
  }

  /* Wraps text into per-word spans so tagline/specimen copy can animate word-by-word */
  function wrapWords(selector) {
    document.querySelectorAll(selector).forEach(el => {
      const text = el.innerText;
      el.innerHTML = '';
      el.style.perspective = '1000px';
      el.style.transformStyle = 'preserve-3d';
      
      let html = '';
      text.split(/(\s+)/).forEach(part => {
        if (part.trim() === '') {
          html += part;
        } else {
          html += `<span class="word" style="display:inline-block">${part}</span>`;
        }
      });
      el.innerHTML = html;
    });
  }
  wrapWords('.tagline, .specimen p');

  /* Hero entrance: letters stagger in, then eyebrow/tagline follow */
  const tl = gsap.timeline({ defaults:{ ease:'power3.out' } });
  tl.set('.letters .letter, .lang-cycle, .eyebrow, .tagline .word', { opacity:0 })
    .set('.letters .letter', { y:24 })
    .set('.eyebrow', { y:-8 })
    .set('.tagline .word', { y:20, rotationX: -40 })
    .to('.letters .letter', { opacity:1, y:0, duration:.7, stagger:.06 }, 0.1)
    .to('.lang-cycle', { opacity:1, duration:.7 }, 0.35)
    .to('.eyebrow', { opacity:1, y:0, duration:.5 }, 0)
    .to('.tagline .word', { opacity:1, y:0, rotationX: 0, duration:.6, stagger:0.02 }, 0.55);

  /* Pinned hero moment: eyebrow + tagline crossfade out while pinned */
  /* CRITICAL: This must be declared before elements below it so pinSpacing is calculated correctly */
  let heroPin;
  if (!reduceMotion){
    heroPin = ScrollTrigger.create({
      trigger: '.hero', start:'top top', end:'+=60%', pin:true, pinSpacing:true,
      onUpdate: (self)=>{
        gsap.to('.eyebrow, .tagline', { opacity: 1 - self.progress, duration:.1, overwrite:'auto' });
        gsap.to('.hero h1', { scale: 1 - self.progress*0.08, duration:.1, overwrite:'auto' });
      }
    });

    // Scrubs the hero name out as the pin releases
    ScrollTrigger.create({
      trigger: '.hero',
      start: () => heroPin.end,
      end: () => heroPin.end + window.innerHeight * 0.3,
      scrub: true,
      animation: gsap.timeline()
        .to('.hero h1', { opacity: 0, scale: 0.6, y: 50, duration: 1 }, 0)
    });
  }

  /* Nav pill morphs (blur/padding/opacity) as the page scrolls past the hero */
  gsap.to(':root', {
    '--nav-blur': '32px',
    '--nav-sat': '220%',
    '--nav-pad-v': '6px',
    '--nav-pad-h': '10px',
    '--nav-bg-1-a': 0.15,
    '--nav-bg-2-a': 0.06,
    ease: "power1.inOut",
    scrollTrigger: {
      trigger: 'body',
      start: "top -10%",
      end: "top -40%",
      scrub: true
    }
  });

  /* Section-based accent theming: toggles the scoped theme-* class from the
     CSS above as each section crosses the middle of the viewport. toggleClass
     handles add/remove on every direction (enter, enter-back, leave, leave-back)
     automatically, so the two classes can't stack or get stuck on one another. */
  ['projects','experience'].forEach(id=>{
    const section = document.getElementById(id);
    if (!section) return;
    ScrollTrigger.create({
      trigger: section, start:'top 60%', end:'bottom 60%',
      toggleClass: { targets: 'body', className: `theme-${id}` }
    });
  });

  // NOTE: background parallax + scroll-progress bar (both scrub against
  // 'bottom bottom') are created further down, AFTER initProjectsRail() runs -
  // see the comment near that function. Creating them here, before the
  // projects rail's pinned height exists, would measure the shorter
  // pre-rail document height and cap them out around the end of Projects
  // instead of tracking all the way to the real page bottom.

  /* Footer line: draws in from the left instead of just appearing, once the
     footer scrolls into view. transform-origin:left is set in the CSS above. */
  gsap.set('.footer-line', { scaleX: 0 });
  ScrollTrigger.create({
    trigger: '.site-footer', start: 'top 95%',
    onEnter: () => gsap.to('.footer-line', { scaleX: 1, duration: 1, ease: 'power3.out', overwrite:'auto' }),
    onEnterBack: () => gsap.to('.footer-line', { scaleX: 1, duration: 1, ease: 'power3.out', overwrite:'auto' })
  });


  /* Section headings: fade/rise in on scroll, with a text-scramble reveal */
  const scrambleChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*';
  
  document.querySelectorAll('.section-head').forEach(head=>{
    const textEls = head.querySelectorAll('.section-num, h2');
    textEls.forEach(el => el.dataset.text = el.innerText);

    gsap.from(head, {
      opacity:0, y:30, duration:.7, ease:'power3.out',
      scrollTrigger:{ 
        trigger: head, 
        start:'top 85%',
        onEnter: () => {
          // Kicks off the CSS gradient-underline draw (.section-head h2::after)
          head.classList.add('head-inview');
          textEls.forEach(el => {
            const originalText = el.dataset.text;
            const length = originalText.length;
            const scrambleObj = { progress: 0 };
            
            gsap.to(scrambleObj, {
              progress: 1,
              duration: 0.6,
              ease: "none",
              onUpdate: function() {
                const progress = this.targets()[0].progress;
                let scrambled = '';
                for (let i = 0; i < length; i++) {
                  if (progress >= (i / length)) {
                    scrambled += originalText[i];
                  } else if (originalText[i] === ' ') {
                    scrambled += ' ';
                  } else {
                    scrambled += scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
                  }
                }
                el.innerText = scrambled;
              },
              onComplete: () => el.innerText = originalText
            });
          });
        }
      }
    });
  });
  
  /* 8/10. Projects rail + card reveals + glass refraction + magnetic tilt.
     Wrapped in a function and called once fonts/layout are final (see bottom of
     this script). ROOT CAUSE OF THE "invisible project cards" BUG: every card's
     reveal/refraction ScrollTrigger below uses containerAnimation: railTween.
     GSAP freezes (never advances) the render state of a containerAnimation-based
     ScrollTrigger the moment ScrollTrigger.refresh() is called again AFTER that
     trigger has already been created - the tween's internal time keeps ticking
     but its eased ratio sticks at 0 forever, so opacity/y never animate even
     though nothing throws and toggleActions fire normally. The previous fix
     attempt (three ScrollTrigger.refresh() calls: sync, fonts.ready, load) is
     exactly what triggered this, because mm.add() below ran BEFORE any of those
     refreshes, so every one of them corrupted the freshly-created card triggers.
     Fix: create these containerAnimation triggers only once, after fonts are
     ready, and never call ScrollTrigger.refresh() again afterward. */
  function initProjectsRail(){
  let mm = gsap.matchMedia();
  mm.add({
    desktop: "(min-width: 768px)",
    mobile: "(max-width: 767px)"
  }, (context) => {
    let { desktop } = context.conditions;
    const grid = document.querySelector('.specimen-grid');
    if (!grid) return;
    let railTween;
    
    if (desktop) {
      grid.classList.add('rail-mode');
      let getScrollAmount = () => -(grid.scrollWidth - window.innerWidth + 300);
      
      railTween = gsap.to(grid, {
        x: getScrollAmount,
        ease: "none"
      });

      ScrollTrigger.create({
        trigger: "#projects",
        start: "top 10%", // pin slightly below top to show section head
        end: () => `+=${grid.scrollWidth - window.innerWidth + 300}`,
        pin: true,
        animation: railTween,
        scrub: 1,
        invalidateOnRefresh: true
      });
    }

    gsap.utils.toArray('.specimen').forEach((card, i)=>{
      // Project card reveal (fade + rise + word stagger) on scroll
      // NOTE: this used to be a gsap.timeline().from(...) driven purely by
      // toggleActions on a containerAnimation-based ScrollTrigger. GSAP silently
      // fails to render opacity/y for that exact combo (timeline + .from()'s
      // runBackwards + containerAnimation): the tween's internal time/progress
      // advances correctly (confirmed via inspection) but the DOM never gets
      // updated, so every card stayed permanently invisible. Driving the same
      // reveal from plain onEnter/onLeaveBack callbacks with direct gsap.to()
      // calls sidesteps that broken code path entirely and renders reliably.
      const words = card.querySelectorAll('.word');
      gsap.set(card, { opacity: 0, y: 40 });
      if (words.length > 0) gsap.set(words, { opacity: 0, y: 20, rotationX: -40 });

      const playReveal = () => {
        gsap.to(card, { opacity:1, y:0, duration:.7, ease:'power3.out', delay: desktop ? 0 : (i%3)*0.08, overwrite:'auto' });
        if (words.length > 0) {
          gsap.to(words, { opacity:1, y:0, rotationX:0, duration:0.6, ease:'power3.out', stagger:0.02, delay: desktop ? 0 : (i%3)*0.08 + 0.2, overwrite:'auto' });
        }
      };
      const resetReveal = () => {
        gsap.set(card, { opacity: 0, y: 40 });
        if (words.length > 0) gsap.set(words, { opacity: 0, y: 20, rotationX: -40 });
      };

      ScrollTrigger.create({
        trigger: card,
        start: desktop ? 'left 85%' : 'top 88%',
        containerAnimation: desktop ? railTween : null,
        onEnter: playReveal,
        onEnterBack: playReveal,
        onLeaveBack: resetReveal
      });

      

      // Magnetic tilt + CSS cursor-follow spotlight on each card (desktop and mobile)
      const xTo = gsap.quickTo(card, "rotationY", {duration: 0.4, ease: "power3"}),
            yTo = gsap.quickTo(card, "rotationX", {duration: 0.4, ease: "power3"}),
            zTo = gsap.quickTo(card, "rotationZ", {duration: 0.5, ease: "power3"});

      const mouseMove = (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--x', `${x}px`);
        card.style.setProperty('--y', `${y}px`);
        const rx = (x / rect.width) - 0.5;
        const ry = (y / rect.height) - 0.5;
        xTo(rx * 28);
        yTo(-ry * 28);
        // Slight twist keyed to the horizontal offset - keeps the tilt from
        // feeling like a flat gimbal. Small on purpose (max ~2.5deg).
        zTo(rx * 2.5);
      };
      const mouseLeave = () => { xTo(0); yTo(0); zTo(0); };
      
      card.addEventListener("mousemove", mouseMove);
      card.addEventListener("mouseleave", mouseLeave);
      
      // cleanup listeners if matchMedia runs again
      return () => {
        card.removeEventListener("mousemove", mouseMove);
        card.removeEventListener("mouseleave", mouseLeave);
      };
    });

    return () => { 
      if(desktop) grid.classList.remove('rail-mode'); 
    };
  });
  } // end initProjectsRail()

  /* Nav links pull subtly toward the cursor - same quickTo pattern as the project cards */
  if (!isTouchDevice() && !reduceMotion) {
    document.querySelectorAll('nav[data-app-nav] a').forEach(link => {
      const lx = gsap.quickTo(link, "x", { duration: 0.3, ease: "power3" }),
            ly = gsap.quickTo(link, "y", { duration: 0.3, ease: "power3" });
      link.addEventListener('mousemove', (e) => {
        const r = link.getBoundingClientRect();
        lx((e.clientX - (r.left + r.width / 2)) * 0.35);
        ly((e.clientY - (r.top + r.height / 2)) * 0.35);
      });
      link.addEventListener('mouseleave', () => { lx(0); ly(0); });
    });
  }
  /* Photo category subnav: filters the grid (used on the standalone gallery
     page's top bar; safely no-ops if these elements aren't on the page). */
  const photoSubnav = document.getElementById('photoSubnav');
  const photoGrid = document.getElementById('photoGrid');
  if (photoSubnav && photoGrid) {
    photoSubnav.addEventListener('click', (e) => {
      const btn = e.target.closest('.photo-subnav-cat');
      if (!btn) return;
      photoSubnav.querySelectorAll('.photo-subnav-cat').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.cat;
      photoGrid.querySelectorAll('.photo-card').forEach(card => {
        card.classList.toggle('hidden-cat', cat !== 'all' && card.dataset.cat !== cat);
      });
      // Soft re-entry for the cards that survive the filter - masks the
      // instant reflow from display:none toggling with a quick stagger.
      if (!reduceMotion) {
        gsap.fromTo(photoGrid.querySelectorAll('.photo-card:not(.hidden-cat)'),
          { opacity: 0, y: 14, scale: .97 },
          { opacity: 1, y: 0, scale: 1, duration: .35, ease: 'power2.out',
            stagger: .03, overwrite: 'auto', clearProps: 'opacity,transform' }
        );
      }
    });
  }

  /* Lightbox: click a photo card to open its full-res version (or play its
     video, for the one storms card backed by an actual .mp4 clip). */
  const lightbox = document.getElementById('photoLightbox');
  const lightboxImg = document.getElementById('photoLightboxImg');
  const lightboxVideo = document.getElementById('photoLightboxVideo');
  const lightboxClose = document.getElementById('photoLightboxClose');
  if (photoGrid && lightbox && lightboxImg) {
    photoGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.photo-card');
      if (!card) return;
      const img = card.querySelector('img');
      if (img.dataset.video) {
        lightboxImg.style.display = 'none';
        lightboxVideo.style.display = '';
        lightboxVideo.src = img.dataset.video;
        lightboxVideo.play();
      } else {
        lightboxVideo.pause();
        lightboxVideo.style.display = 'none';
        lightboxVideo.src = '';
        lightboxImg.style.display = '';
        lightboxImg.src = img.dataset.full || img.src;
        lightboxImg.alt = img.alt;
      }
      lightbox.classList.add('visible');
    });
    const closeLightbox = () => {
      lightbox.classList.remove('visible');
      lightboxImg.src = '';
      lightboxVideo.pause();
      lightboxVideo.src = '';
    };
    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
  }

  function isTouchDevice(){ return window.matchMedia('(pointer: coarse)').matches; }

  /* Magnetic hover on the photo CTA + skill tags - same quickTo pattern as
     the nav links above, just a gentler pull (0.25 vs 0.35) since these are
     smaller targets. Separate element loop/closures, so it can't interfere
     with the nav's own magnetic effect. */
  if (!isTouchDevice() && !reduceMotion) {
    document.querySelectorAll('.photo-cta, .tag-chip').forEach(el => {
      const mx = gsap.quickTo(el, "x", { duration: 0.3, ease: "power3" }),
            my = gsap.quickTo(el, "y", { duration: 0.3, ease: "power3" });
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        mx((e.clientX - (r.left + r.width / 2)) * 0.25);
        my((e.clientY - (r.top + r.height / 2)) * 0.25);
      });
      el.addEventListener('mouseleave', () => { mx(0); my(0); });
    });
  }

  /* Top nav scrollspy indicator: highlights the active section link */
  const navLinks = { photography: document.querySelector('[data-nav="photography"]'), projects: document.querySelector('[data-nav="projects"]'), experience: document.querySelector('[data-nav="experience"]') };
  const indicator = document.querySelector('.nav-indicator');
  let activeNavLink = null;
  function syncIndicatorToActive(){
    if (activeNavLink) gsap.set(indicator, { x: activeNavLink.offsetLeft, width: activeNavLink.offsetWidth });
  }
  function moveIndicator(link){
    if (!link || !indicator) return;
    activeNavLink = link;
    gsap.to(indicator, {
      opacity:1, x: link.offsetLeft, width: link.offsetWidth,
      duration:.35, ease:'power2.out', overwrite:'auto',
      // The nav's own width/x can still be mid-animation (wordmark morph, rail
      // pin reflow) when this tween starts, so the offsetLeft/width captured
      // above can be stale by the time it lands. Re-measure once more on
      // completion so the pill never parks on a boundary calculated too early.
      onComplete: syncIndicatorToActive
    });
    Object.values(navLinks).forEach(a=> a && a.classList.remove('active'));
    link.classList.add('active');
  }
  function hideIndicator(){
    activeNavLink = null;
    gsap.to(indicator, { opacity:0, duration:.25, ease:'power2.out', overwrite:'auto' });
    Object.values(navLinks).forEach(a=> a && a.classList.remove('active'));
  }
  // BUG FIX: the indicator's x/width were only ever committed once, at the moment
  // a section's onEnter/onEnterBack fired. Nothing reset it when scrolling back up
  // above "Projects", and nothing kept it in sync with the nav's own layout shifting
  // (the wordmark morph above grows/shrinks the nav width while scrubbing), so
  // scrolling down then back up left the pill parked at a stale x/width, visibly
  // misaligned/overlapping the wrong link - exactly the reported glitch.
  // These triggers must NOT be created here - same trap as the bg-image/scroll-progress
  // triggers below: the projects rail's pin hasn't been added to the document yet at
  // this point in the script, so ScrollTrigger measures the shorter pre-rail page and
  // every start/end percentage lands compressed - which is why "About Me" (and, as a
  // knock-on effect, "Photography" right after it) was firing while still in Projects.
  // Creation is deferred into createFullPageScrollTriggers(), called only once the rail
  // pin exists.
  function createNavScrollspyTriggers(){
    const scrollspyDefs = [
      { id: 'projects',    start: 'top 40%',    end: 'bottom 40%', idx: 0 },
      { id: 'experience',  start: 'top 40%',    end: 'bottom 40%', idx: 1 },
      { sel: '.photo-cta', start: 'top 50%',    end: 'bottom top', idx: 2 }
    ];
    scrollspyDefs.forEach(({ id, sel, start, end, idx }) => {
      const section = sel ? document.querySelector(sel) : document.getElementById(id);
      if (!section) return;
      const linkKey = id || 'photography';
      ScrollTrigger.create({
        trigger: section, start, end,
        onEnter: ()=> moveIndicator(navLinks[linkKey]),
        onEnterBack: ()=> moveIndicator(navLinks[linkKey]),
        onLeaveBack: ()=> { if (idx === 0) hideIndicator(); }
      });
    });
  }
  // Keep the pill glued to its link while the nav's own width is still animating
  // (e.g. right after a resize, or while other layout-affecting tweens run).
  ScrollTrigger.addEventListener('refresh', syncIndicatorToActive);
  let navResizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(navResizeTimer);
    navResizeTimer = setTimeout(syncIndicatorToActive, 150);
  }, { passive: true });
  
  // Custom cursor: a dot that follows the pointer and grows on hoverable elements
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  if (!isTouch && !reduceMotion) {
    document.body.classList.add('has-custom-cursor');
    const cursorDot = document.querySelector('.cursor-dot');
    const cursorRing = document.querySelector('.cursor-ring');
    let isHoveringTarget = false;

    // Position quick setters
    const dotX = gsap.quickTo(cursorDot, "left", {duration: 0.1, ease: "power3"});
    const dotY = gsap.quickTo(cursorDot, "top", {duration: 0.1, ease: "power3"});
    const ringX = gsap.quickTo(cursorRing, "left", {duration: 0.4, ease: "power3"});
    const ringY = gsap.quickTo(cursorRing, "top", {duration: 0.4, ease: "power3"});

    window.addEventListener("mousemove", e => {
      dotX(e.clientX); dotY(e.clientY);
      ringX(e.clientX); ringY(e.clientY);
    });

    // Hover effects
    const hoverTargets = document.querySelectorAll('.specimen, nav[data-app-nav] a, .letters .letter');
    hoverTargets.forEach(target => {
      target.addEventListener('mouseenter', () => {
        isHoveringTarget = true;
        gsap.to(cursorRing, { scale: 1.8, borderColor: 'var(--moss)', backgroundColor: 'rgba(138, 154, 91, 0.1)', boxShadow: '0 0 0 8px rgba(138,154,91,0.12)', duration: 0.3 });
        gsap.to(cursorDot, { scale: 0, duration: 0.2 });
      });
      target.addEventListener('mouseleave', () => {
        isHoveringTarget = false;
        gsap.to(cursorRing, { scale: 1, borderColor: 'var(--rust)', backgroundColor: 'transparent', boxShadow: '0 0 0 0 rgba(255,255,255,0)', duration: 0.3 });
        gsap.to(cursorDot, { scale: 1, duration: 0.2 });
      });
    });

    // Click feedback: quick elastic squeeze on the ring + an expanding ripple burst,
    // so every click reads as a deliberate, satisfying action rather than a dead tap.
    window.addEventListener('mousedown', (e) => {
      gsap.to(cursorRing, { scale: (isHoveringTarget ? 1.8 : 1) * 0.75, duration: 0.15, ease: 'power2.out' });

      const ripple = document.createElement('div');
      ripple.className = 'cursor-ripple';
      ripple.style.left = e.clientX + 'px';
      ripple.style.top = e.clientY + 'px';
      document.body.appendChild(ripple);
      gsap.fromTo(ripple,
        { scale: 0, opacity: 0.9 },
        { scale: 3.2, opacity: 0, duration: 0.6, ease: 'power2.out', onComplete: () => ripple.remove() }
      );
    });
    window.addEventListener('mouseup', () => {
      gsap.to(cursorRing, { scale: isHoveringTarget ? 1.8 : 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    });
  }

  // Name letters: click to shatter into particles, then reform.
  document.querySelectorAll('.letters .letter').forEach(letter => {
    let busy = false;
    letter.addEventListener('click', () => {
      if (busy || reduceMotion) return;
      busy = true;
      const rect = letter.getBoundingClientRect();
      const color = getComputedStyle(letter).color;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const bits = [];
      const PARTICLE_COUNT = LOW_POWER ? 24 : 40;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const bit = document.createElement('span');
        bit.className = 'letter-particle';
        bit.style.left = cx + 'px';
        bit.style.top = cy + 'px';
        bit.style.background = color;
        document.body.appendChild(bit);
        bits.push(bit);
      }

      gsap.set(letter, { opacity: 0 });
      bits.forEach(bit => {
        // Hand-rolled ballistic arc (no plugin needed): velocity/angle decomposed
        // into vx/vy, gravity pulls vy down each frame, friction bleeds speed off
        // both axes - onUpdate integrates position every tick, giving a genuine
        // curved arc rather than a straight lerp to a fixed endpoint.
        const angle = -90 + (Math.random() - 0.5) * 150; // upward-biased cone
        const velocity = 90 + Math.random() * 90;
        const gravity = 380, friction = 0.15;
        const rad = angle * Math.PI / 180;
        let vx = Math.cos(rad) * velocity;
        let vy = Math.sin(rad) * velocity;
        let px = 0, py = 0;
        gsap.to(bit, {
          scale: 0,
          opacity: 0,
          duration: 1.0 + Math.random() * 0.5,
          ease: 'power1.out',
          onUpdate: function () {
            const dt = gsap.ticker.deltaRatio(60) / 60;
            vy += gravity * dt;
            vx *= (1 - friction * dt);
            vy *= (1 - friction * dt);
            px += vx * dt;
            py += vy * dt;
            gsap.set(bit, { x: px, y: py });
          }
        });
      });

      gsap.to(letter, {
        opacity: 1, delay: 0.5, duration: 0.4, ease: 'power2.out',
        onStart: () => gsap.fromTo(letter, { scale: 0.4, y: -6 }, { scale: 1, y: 0, duration: 0.4, ease: 'back.out(2)' }),
        onComplete: () => { bits.forEach(b => b.remove()); busy = false; }
      });
    });
  });

  // Surname: same shatter-into-particles interaction as the first name.
  // The cycling word is a CSS ::after with its own 24s swap timer - we don't
  // touch that animation at all, just hide the real element and mask the
  // click behind a burst of particles for a beat, then bring it back.
  const surname = document.querySelector('.lang-cycle');
  const LANG_WORDS = ['Shankar', 'Шанкар', 'シャンカル', '샹카르', 'शंकर'];
  const LANG_BLOCK = 24 / LANG_WORDS.length; // seconds per language in the CSS loop
  const LANG_HOLD  = 0.11 * 24;              // lands mid-hold (9%-13%), fully visible

  // Jumps the CSS-driven ::after straight to the next language's held frame,
  // instead of waiting on wherever the 24s loop naturally is.
  function jumpToNextLanguage(el){
    const current = getComputedStyle(el, '::after').content.replace(/"/g, '');
    const idx = LANG_WORDS.indexOf(current);
    const next = ((idx === -1 ? 0 : idx) + 1) % LANG_WORDS.length;
    const delay = -(next * LANG_BLOCK + LANG_HOLD);
    el.classList.add('lang-reset');
    void el.offsetWidth; // force reflow so the animation actually restarts
    el.style.setProperty('--lang-delay', delay + 's');
    el.classList.remove('lang-reset');
  }

  if (surname) {
    let surnameBusy = false;
    surname.addEventListener('click', () => {
      if (surnameBusy || reduceMotion) return;
      surnameBusy = true;
      const rect = surname.getBoundingClientRect();
      const color = getComputedStyle(surname).color;
      const cy = rect.top + rect.height / 2;
      const bits = [];
      const PARTICLE_COUNT = LOW_POWER ? 24 : 40;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const bit = document.createElement('span');
        bit.className = 'letter-particle';
        bit.style.left = (rect.left + Math.random() * rect.width) + 'px';
        bit.style.top = cy + 'px';
        bit.style.background = color;
        document.body.appendChild(bit);
        bits.push(bit);
      }

      gsap.set(surname, { opacity: 0 });
      bits.forEach(bit => {
        const angle = -90 + (Math.random() - 0.5) * 180;
        const velocity = 60 + Math.random() * 70;
        const gravity = 260, friction = 0.1;
        const rad = angle * Math.PI / 180;
        let vx = Math.cos(rad) * velocity;
        let vy = Math.sin(rad) * velocity;
        let px = 0, py = 0;
        gsap.to(bit, {
          scale: 0,
          opacity: 0,
          duration: 3.5 + Math.random() * 0.5,
          ease: 'power1.out',
          onUpdate: function () {
            const dt = gsap.ticker.deltaRatio(60) / 60;
            vy += gravity * dt;
            vx *= (1 - friction * dt);
            vy *= (1 - friction * dt);
            px += vx * dt;
            py += vy * dt;
            gsap.set(bit, { x: px, y: py });
          }
        });
      });

      gsap.to(surname, {
        opacity: 1, delay: .5, duration: 0.4, ease: 'power2.out',   
        onStart: () => { jumpToNextLanguage(surname); gsap.fromTo(surname, { scale: 0.6 }, { scale: 1, duration: 0.4, ease: 'back.out(2)' }); },
        onComplete: () => { bits.forEach(b => b.remove()); surnameBusy = false; }
      });
    });
  }

  /* Static glass map — fixed width/height, matching the reference bar exactly
     (no ResizeObserver, no dynamic regeneration; width is fixed, not fluid). */

  /* Draggable, inertia-scrolled, auto-looping "field log" ticker strip */
  const track = document.querySelector('.fieldlog-track');
  if (track) {
    const singleWidth = track.scrollWidth + 48; // add the 48px gap
    track.innerHTML += track.innerHTML; // Duplicate for seamless looping
    
    const wrap = gsap.utils.wrap(-singleWidth, 0);
    let loopTween;
    
    function startLoop() {
      if(loopTween) loopTween.kill();
      loopTween = gsap.to(track, {
        x: `-=${singleWidth}`,
        duration: 38,
        ease: "none",
        repeat: -1,
        modifiers: {
          x: gsap.utils.unitize(wrap)
        }
      });
    }
    startLoop();

    let dragResumeTimer;
    function resumeLoop() {
      clearTimeout(dragResumeTimer);
      dragResumeTimer = setTimeout(() => {
        startLoop();
      }, 2000);
    }

    Draggable.create(track, {
      type: "x",
      inertia: true,
      trigger: ".fieldlog",
      modifiers: {
        x: wrap
      },
      onDragStart: () => {
        if(loopTween) loopTween.pause();
        clearTimeout(dragResumeTimer);
      },
      onThrowComplete: resumeLoop,
      onDragEnd: function() {
        if (!this.tween || !this.tween.isActive()) {
          resumeLoop();
        }
      }
    });
  }

  // Fix for the invisible-project-cards bug (see the comment above initProjectsRail):
  // 1) Refresh once now so every OTHER trigger created above (hero pin, section-head
  //    reveals, nav morph, glow parallax) is accurate even before
  //    webfonts finish loading. None of those use containerAnimation, so refreshing
  //    them repeatedly is harmless.
  // 2) Only THEN create the rail + card ScrollTriggers (which do use
  //    containerAnimation), once fonts are ready so their start/end pixel math is
  //    correct from the start - and crucially, refresh() is never called again
  //    afterward, which is what was silently freezing their opacity/y tweens at 0.
  ScrollTrigger.refresh();

  // Background parallax + scroll-progress bar: both track the full document
  // height ('bottom bottom'), so they have to be created only after the
  // projects rail's pinned scroll height is in place - otherwise they measure
  // the shorter pre-rail document and cap out around the end of Projects
  // instead of the real page bottom.
  function createFullPageScrollTriggers(){
    gsap.to('.bg-image', {
      backgroundPositionY: '65%',
      ease: 'none',
      scrollTrigger: { trigger: 'body', start: 'top top', end: 'bottom bottom', scrub: 0.6 }
    });
    gsap.to('.scroll-progress', {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: 'body', start: 'top top', end: 'bottom bottom', scrub: 0.3 }
    });
    createNavScrollspyTriggers();
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { initProjectsRail(); createFullPageScrollTriggers(); });
  } else {
    window.addEventListener('load', () => { initProjectsRail(); createFullPageScrollTriggers(); });
  }
})();

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

    gsap.set(targets, { filter: 'blur(0px) brightness(1)', transformOrigin: '50% 50%', transformPerspective: 1400 });

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
  if (portal) portal.querySelector('.dolly-portal-label').textContent = 'Aditya Shankar';

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

    gsap.set(targets, { filter: 'blur(0px) brightness(1)', transformOrigin: '50% 50%', transformPerspective: 1400 });

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
  const targets = ['nav[data-app-nav]', 'header', '.hero', '.fieldlog', '#projects', '#experience', 'footer.site-footer', '.bg-image']
    .map(sel => document.querySelector(sel)).filter(Boolean);

  if (reduceMotion || typeof gsap === 'undefined') {
    if (portal) portal.style.display = 'none';
    targets.forEach(el => { el.style.opacity = ''; el.style.transform = ''; el.style.filter = ''; });
    return;
  }

  gsap.set(targets, { opacity: 0, scale: 1.07, filter: 'blur(7px)', transformOrigin: '50% 50%', transformPerspective: 1400 });
  if (portal) gsap.set(portal, { display: 'flex', opacity: 1, scale: 1 });

  gsap.timeline({ delay: 0.05, defaults: { ease: 'power2.out' } })
    .to(targets, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.9, stagger: 0.06 }, 0)
    .to(portal, {
      opacity: 0, scale: 1.15, duration: 0.7, ease: 'power2.inOut',
      onComplete: () => { if (portal) portal.style.display = 'none'; }
    }, 0.15);

  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    gsap.killTweensOf(targets);
    if (portal) gsap.killTweensOf(portal);
    gsap.set(targets, { clearProps: 'all' });
    if (portal) { gsap.set(portal, { clearProps: 'all' }); portal.style.display = 'none'; }
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
  const targets = ['.gallery-nav', '.gallery-page-head', '.photo-grid', '.bg-image']
    .map(sel => document.querySelector(sel)).filter(Boolean);

  if (reduceMotion || typeof gsap === 'undefined') {
    if (portal) portal.style.display = 'none';
    targets.forEach(el => { el.style.opacity = ''; el.style.transform = ''; el.style.filter = ''; });
    return;
  }

  gsap.set(targets, { opacity: 0, scale: 1.07, filter: 'blur(7px)', transformOrigin: '50% 50%', transformPerspective: 1400 });
  if (portal) gsap.set(portal, { display: 'flex', opacity: 1, scale: 1 });

  gsap.timeline({ delay: 0.05, defaults: { ease: 'power2.out' } })
    .to(targets, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.9, stagger: 0.06 }, 0)
    .to(portal, {
      opacity: 0, scale: 1.15, duration: 0.7, ease: 'power2.inOut',
      onComplete: () => { if (portal) portal.style.display = 'none'; }
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
  });
})();
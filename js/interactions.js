// Section 2: content-area interactions — projects rail, magnetic hover,
// gallery filter/lightbox, nav scrollspy. Depends on core.js loading first
// (uses ScrollTrigger, GSAP). Exposes initProjectsRail() and
// createNavScrollspyTriggers() as globals since effects-and-boot.js calls
// them from its bootstrap sequencing.
(function(){
  if (typeof gsap === 'undefined') return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
     video, for the one storms card backed by an actual .mp4 clip). Left/right
     arrow keys step to the next/previous photo in the currently filtered set
     without closing the lightbox. */
  const lightbox = document.getElementById('photoLightbox');
  const lightboxImg = document.getElementById('photoLightboxImg');
  const lightboxVideo = document.getElementById('photoLightboxVideo');
  const lightboxClose = document.getElementById('photoLightboxClose');
  let currentCard = null;
  if (photoGrid && lightbox && lightboxImg) {
    const showCard = (card) => {
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
      currentCard = card;
    };

    // Re-queried on every step rather than cached once, so arrow nav always
    // matches whatever the category filter currently has visible.
    const visibleCards = () => Array.from(photoGrid.querySelectorAll('.photo-card:not(.hidden-cat)'));

    const stepLightbox = (delta) => {
      const cards = visibleCards();
      const i = cards.indexOf(currentCard);
      if (i === -1 || !cards.length) return;
      showCard(cards[(i + delta + cards.length) % cards.length]);
    };

    photoGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.photo-card');
      if (!card) return;
      showCard(card);
      lightbox.classList.add('visible');
    });
    const closeLightbox = () => {
      lightbox.classList.remove('visible');
      lightboxImg.src = '';
      lightboxVideo.pause();
      lightboxVideo.src = '';
      currentCard = null;
    };
    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('visible')) return;
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowRight') { e.preventDefault(); stepLightbox(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); stepLightbox(-1); }
    });
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

  // Expose for effects-and-boot.js's bootstrap sequencing
  window.initProjectsRail = initProjectsRail;
  window.createNavScrollspyTriggers = createNavScrollspyTriggers;
})();
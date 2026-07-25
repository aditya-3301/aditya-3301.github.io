// Section 3: cursor + shatter easter eggs + field-log ticker + bootstrap.
// Must load after core.js and interactions.js — the bootstrap at the
// bottom calls window.initProjectsRail() and
// window.createNavScrollspyTriggers() (defined in interactions.js), and
// relies on ScrollTrigger/Lenis already being set up by core.js.
(function(){
  // Easter egg: a little signature for anyone poking around devtools.
  // Kept outside the gsap guard below so it still fires even if GSAP
  // failed to load for some reason.
  const boxWidth = 30;
  const label = 'ADITYA SHANKAR';
  const pad = Math.floor((boxWidth - label.length) / 2);
  const banner =
    '┌' + '─'.repeat(boxWidth) + '┐\n' +
    '│' + ' '.repeat(pad) + label + ' '.repeat(boxWidth - pad - label.length) + '│\n' +
    '└' + '─'.repeat(boxWidth) + '┘';
  // A single console.log call, Discord-style: one big styled entry rather
  // than several small ones, so devtools can't collapse/group it away.
  console.log(
    '%c' + banner + '\n\n%cPoking around in here, huh? I like the curiosity.' +
    '\n%cBuilt with GSAP, Lenis, and more SVG backdrop-filters than is strictly reasonable.' +
    '\n%cCode lives at github.com/aditya-3301',
    'color:#8A9A5B;font-family:monospace;font-size:16px;font-weight:bold;line-height:1.4;',
    'color:#EDE6D6;font-family:monospace;font-size:13px;',
    'color:#B8B0A0;font-family:monospace;font-size:11px;',
    'color:#4C8C86;font-family:monospace;font-size:11px;'
  );

  if (typeof gsap === 'undefined') return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LOW_POWER = (navigator.deviceMemory && navigator.deviceMemory <= 4)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
    || window.matchMedia('(pointer: coarse)').matches;

  // Custom cursor: a dot that follows the pointer and grows on hoverable elements
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  if (!isTouch && !reduceMotion) {
    document.body.classList.add('has-custom-cursor');
    const cursorDot = document.querySelector('.cursor-dot');
    const cursorRing = document.querySelector('.cursor-ring');
    let isHoveringTarget = false;

    // Position: quickSetter is GSAP's un-eased, no-tween option for "set this
    // every mousemove" - the dot/ring now land exactly on the pointer every
    // frame instead of catching up to it, which is what was reading as lag.
    // Centering (-50%/-50%) is done via xPercent/yPercent rather than a CSS
    // transform so it keeps composing correctly with the hover scale tweens
    // below (those animate through GSAP's own transform cache too).
    gsap.set([cursorDot, cursorRing], { xPercent: -50, yPercent: -50 });
    const setDotX = gsap.quickSetter(cursorDot, "x", "px");
    const setDotY = gsap.quickSetter(cursorDot, "y", "px");
    const setRingX = gsap.quickSetter(cursorRing, "x", "px");
    const setRingY = gsap.quickSetter(cursorRing, "y", "px");

    window.addEventListener("mousemove", e => {
      setDotX(e.clientX); setDotY(e.clientY);
      setRingX(e.clientX); setRingY(e.clientY);
    }, { passive: true });

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
    window.createNavScrollspyTriggers();
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { window.initProjectsRail(); createFullPageScrollTriggers(); });
  } else {
    window.addEventListener('load', () => { window.initProjectsRail(); createFullPageScrollTriggers(); });
  }
})();
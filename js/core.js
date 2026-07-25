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
    if (!reduceMotion && !paused && !window.__dollyPaused) requestAnimationFrame(step);
  }

  // Called by the dolly transitions (mainscript.js, further down) - the
  // canvas is one of the elements they blur/scale into the portal, so
  // there's no point still paying for its per-frame particle math while
  // it's unreadable anyway. Resuming re-arms the loop from scratch.
  window.__dollyParticlePause = () => { window.__dollyPaused = true; };
  window.__dollyParticleResume = () => {
    window.__dollyPaused = false;
    if (!reduceMotion && !paused) requestAnimationFrame(step);
  };

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

// Main GSAP interactions IIFE, part 1: Lenis smooth-scroll, hero entrance,
// hero pin, nav pill morph, section theming, footer line, heading scramble.
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
})();

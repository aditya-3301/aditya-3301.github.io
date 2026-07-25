# Site structure

```
/
  index.html
  gallery.html
  mainstyle.css
  js/
    core.js
    interactions.js
    effects-and-boot.js
    transitions.js
```

Script load order matters and must stay exactly as below (all `defer`, so
order is what governs execution, not file position in the HTML):

```html
<script defer src="js/core.js"></script>
<script defer src="js/interactions.js"></script>
<script defer src="js/effects-and-boot.js"></script>
<script defer src="js/transitions.js"></script>
```

---

## HTML

**`index.html`**
The main/home page — hero, projects, experience, footer, nav. Also holds
the `<html>` head script that detects Safari (for the glass-filter CSS
fallback) and checks `sessionStorage` for the `pt-arrive-home` flag set by
`transitions.js` when arriving back from the gallery.

**`gallery.html`**
The standalone photography page — filterable photo grid, lightbox, its own
nav with a back-to-home link. Same head-script pattern as `index.html`, but
checks the `pt-arrive` flag instead.

---

## CSS

**`mainstyle.css`**
All styling: design tokens (`--moss`, `--rust`, `--amber`, `--teal`, etc.),
layout, the liquid-glass nav look (including the perf-mode block that
force-disables `backdrop-filter` while a page transition is mid-flight),
Safari fallbacks for the SVG-filter glass effect, and low-power-device
overrides.

---

## JavaScript

**`js/core.js`**
Runs first — the page skeleton and load-time setup:
- Canvas particle-network background (`#particle-bg`), fully self-contained
- Nav clock (`#clock`, ticks every 30s)
- Lenis smooth-scroll wiring
- `wrapWords()` helper (splits copy into per-word spans for stagger animation)
- Hero entrance timeline, pinned hero scroll moment
- Nav pill morph (blur/padding/opacity scrub as you scroll past the hero)
- Section-accent theming (`theme-projects`/`theme-experience` body classes)
- Footer line draw-in
- Section heading reveals (fade/rise + text-scramble effect)

**`js/interactions.js`**
Runs second — everything in the content sections:
- `initProjectsRail()` — desktop horizontal-scroll rail vs. mobile stack,
  card reveals, magnetic 3D tilt, cursor-follow spotlight
- Nav-link magnetic pull
- Photo category subnav filter (gallery page; no-ops safely on index)
- Lightbox (photo/video viewer)
- Magnetic hover on the photo CTA + skill tags
- Nav scrollspy indicator (`moveIndicator`/`hideIndicator`/`syncIndicatorToActive`,
  `createNavScrollspyTriggers()`)

Exposes `window.initProjectsRail` and `window.createNavScrollspyTriggers`
as globals, since `effects-and-boot.js` calls both from its bootstrap
sequencing.

**`js/effects-and-boot.js`**
Runs third — cursor/click effects and final page bootstrap:
- Custom cursor (dot + ring, hover states, click ripple)
- Hero letter click-to-shatter-into-particles effect
- Surname click-to-shatter + language-cycle jump
- Field-log ticker (draggable, inertia-scrolled, auto-looping strip)
- Bootstrap sequencing: `ScrollTrigger.refresh()`, then
  `window.initProjectsRail()` + `createFullPageScrollTriggers()`
  (background parallax, scroll-progress bar, scrollspy triggers) once fonts
  are ready — this ordering is load-bearing, see the comment in the file

**`js/transitions.js`**
The dolly-zoom page-transition system between `index.html` and
`gallery.html`. Four legs in one file (kept together deliberately — tightly
coupled, order-sensitive):
1. Outbound forward (index → gallery, `.photo-cta` click)
2. Outbound reverse (gallery → index, `.gallery-nav-back` click)
3. Index-side arrival (landing half of leg 2)
4. Gallery-side arrival (landing half of leg 1)

Also defines `forceGlassRepaint()`, a small helper that nudges the
liquid-glass `backdrop-filter` to repaint after a transition ends. Note:
the nav elements (`nav[data-app-nav]` / `.gallery-nav`) are deliberately
excluded from the arrival `filter`/`scale` tween and only get an opacity
fade — animating `filter`/`transform` on an ancestor of an SVG-referenced
`backdrop-filter` element corrupts that backdrop-filter in Chromium, which
is why the nav glass could go blank on arrival before this fix.

Relies on `window.__dollyParticlePause`/`__dollyParticleResume` (defined in
`core.js`'s particle-bg IIFE) to pause the particle canvas during the
transition — must load after `core.js`.
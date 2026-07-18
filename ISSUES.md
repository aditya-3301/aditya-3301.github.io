# Mobile Compatibility & Optimization Issues

**Branch:** `issues/mobile-and-optimization`  
**Last Updated:** 2026-07-18  
**Status:** Issues listed (implementation pending)

---

## 🎨 **DESIGN PHILOSOPHY**
> **Keep all glass morphism, particle effects, and sleek animations on capable devices.**  
> **Reduce (don't remove) on low-RAM/low-power devices only.**
>
> - Glass effects, particles, animations = core visual identity of the site
> - LOW_POWER detection already in place; use it to degrade gracefully
> - Examples: full SVG filters → blur() fallback; 90 particles → 35 particles; 60fps → 30fps
> - Goal: site looks premium on powerful devices, but still beautiful and responsive on weak devices

---

## 🚨 CRITICAL PERFORMANCE ISSUES

### 1. **Massive Unoptimized Background Images**
- **File:** `image.jpg` (423 KB), `image2.png` (1.5 MB)  
- **Impact:** Page load time, mobile data usage  
- **Location:** `index.html:64`, `gallery.html:78`  
- **Issue:** Both images loaded full-res regardless of device. Background image never smaller than desktop anyway.
- **Needs:** Image optimization, WebP conversion, responsive background sizes, mobile breakpoints with smaller variants

### 2. **Gallery Images Have No Thumbnails**
- **File:** `gallery.html:174-194` (all photo-cards)  
- **Impact:** Gallery lags when scrolling/filtering (you mentioned this!), especially on mobile  
- **Issue:** Images render at full resolution as thumbnails. Lightbox loads full-res image on click but no lazy placeholder
- **Needs:** 
  - Low-res JPEG placeholders (~30-50KB) for thumbnail grid
  - Progressive image loading (blur-up or skeleton)
  - `loading="lazy"` on img tags (partially done but no srcset)
  - Thumbnail srcset with 2-3 size variants (140px, 280px, 420px max)

### 3. **No Responsive Images Anywhere**
- **Files:** `gallery.html`, `mainscript.js` (particle colors in data URLs)  
- **Issue:** All `src` attributes hardcoded; no `srcset` or `sizes` attributes  
- **Needs:** 
  - Gallery: `srcset` with 1x/2x variants + `sizes="(min-width:1100px) 140px, (min-width:768px) calc(50vw - 20px), calc(100vw - 20px)"`
  - Lightbox full-res: serve 1x on mobile, 2x on desktop only
  - Background images: CSS media queries for mobile/tablet variants

### 4. **SVG Filter Definitions Embedded 3 Times**
- **Files:** `index.html:25-56`, `gallery.html:109-138`  
- **Impact:** Bloats HTML, duplicated code (3 separate filter defs in gallery alone)  
- **Issue:** `nav-glass-distortion`, `card-glass-distortion`, `glass-filter-gallery-dyn`, `glass-filter-photopanel` all inlined  
- **Needs:** Move to external `.svg` file, import via `<use>`, or single shared defs in a template

---

## 📱 MOBILE COMPATIBILITY ISSUES

### 5. **No Safe Area Inset Handling on Notched Phones**
- **File:** `index.html:5` (viewport meta exists but incomplete), `mainstyle.css:214`  
- **Issue:** 
  - Nav is `fixed top-6` (24px); doesn't account for notch on iPhone 13+, Dynamic Island, or Android cutouts
  - `env(safe-area-inset-top)` only used for mobile nav, not main nav
  - gallery.html nav also fixed at top:24px without notch awareness
- **Needs:** 
  - Update main nav: `top: max(1.5rem, env(safe-area-inset-top))`
  - Add `env(safe-area-inset-*)` to all fixed/sticky elements
  - Test on iPhone 13/14/15, Pixel 6+ with system UI

### 6. **Backdrop-Filter Fallback on Older iOS (Keep Glass Where Possible)**
- **Files:** `index.html:6-16` (safari detection), `mainstyle.css:216-234` (fallbacks exist but incomplete)  
- **Issue:** 
  - Safari on iOS 14-15 doesn't support `backdrop-filter` with `url(#...)` SVG filters
  - Fallback to `blur()` exists for `is-safari` class but may not cover all versions
  - iPad Safari might behave differently than iPhone Safari
  - `-webkit-backdrop-filter` has browser-specific bugs on iOS 16+
- **Needs:** 
  - Test on iOS 14, 15, 16, 17 — keep glass effect if it works
  - Verify `-webkit-backdrop-filter` actually works; if not, fallback to `blur(14px) saturate(160%)`
  - **Don't remove glass** — just use fallback blur on older versions that don't support SVG filters

### 7. **No Touch Feedback on Interactive Elements**
- **Files:** `mainscript.js:621-633` (hover targets), `mainstyle.css` (hover states everywhere)  
- **Issue:** 
  - `.specimen`, `.tag-chip`, `.photo-cta`, `.photo-subnav-cat` all have `:hover` effects but no `:active`/`:touch` alternatives
  - Magnetic hover (quickTo on mousemove) doesn't work on touch; no alternative focus/active state
  - Custom cursor hidden on touch but no "tap feedback" (scale, opacity pulse)
  - Photo lightbox close button small (38x38px); hard to tap on small phones
- **Needs:** 
  - Add `:active` states matching `:hover` for all buttons/cards
  - Add `@media (hover: none)` blocks with alternative touch feedback (brief scale-up on tap)
  - Increase touch target sizes to 44x44px minimum (WCAG guideline)
  - Add visual pressed state for buttons (active, disabled states)

### 8. **Custom Cursor Breaks Mobile Usability**
- **Files:** `mainscript.js:602-653`, `mainstyle.css:442-463`  
- **Issue:** 
  - Custom cursor hidden when `pointer: coarse` detected (touchscreen)
  - But custom cursor dot/ring still exist in DOM; unnecessary memory
  - No fallback visual feedback on touch; default system cursor is better
  - Cursor tracking runs 60x/sec on desktop; no pointer events API checks
- **Needs:** 
  - Entirely skip custom cursor initialization on touch devices
  - Don't create cursor elements if `pointer: coarse`
  - Consider disabling on low-power devices (already checks but could be more aggressive)

### 9. **Gallery Grid Unresponsive on Very Small Phones**
- **File:** `mainstyle.css:368-370`  
- **Issue:** 
  - `grid-template-columns:repeat(auto-fill,minmax(140px,1fr))` means 140px min width per card
  - On iPhone SE (375px width, 16px padding = 343px available): only 2 cards per row, lots of wasted space
  - No mobile-specific grid breakpoint (should be 100px or 120px on small screens)
- **Needs:** 
  - `@media (max-width: 480px)` with `minmax(100px, 1fr)` or `minmax(80px, 1fr)`
  - Consider single column on screens < 360px
  - Test on iPhone SE, iPhone 12 mini, Galaxy A12

### 10. **Fieldlog Ticker Draggable Only Works on Desktop**
- **Files:** `mainscript.js:827-844` (Draggable), `mainstyle.css:162-180`  
- **Issue:** 
  - Draggable.create() runs on all devices but `trigger: ".fieldlog"` requires mouse
  - On touch, ticker doesn't respond to swipe; just auto-loops
  - No visual indicator that ticker is draggable/swipeable
  - InertiaPlugin loaded but only for this one element
- **Needs:** 
  - Add touch support (swap Draggable trigger or use touch-action CSS)
  - Add visual hint on first load (pulse, fade-in, or text "swipe to scroll")
  - Consider if ticker worth the complexity on mobile (might be better as static)

### 11. **Smooth Scroll (Lenis) Issues on Older Android**
- **File:** `mainscript.js:168-178` (Lenis initialization)  
- **Issue:** 
  - Lenis has compatibility issues on Android Chrome < 90, Samsung Internet < 14
  - No fallback if Lenis fails to load from CDN
  - Smooth scroll conflicts with browser's own momentum scrolling on iOS
  - May cause jank on low-end Android phones with weak GPUs
- **Needs:** 
  - Feature-detect Lenis support (try/catch around Lenis instantiation)
  - Test on Android 9, 10, 11 (Galaxy A10, etc.)
  - Consider disabling on LOW_POWER devices (already checks `reduceMotion` but not device class)

### 12. **No Dark Mode Detection (@media prefers-color-scheme)**
- **File:** `mainstyle.css` (entire file)  
- **Issue:** 
  - Page is dark by design but ignores system dark/light mode preference
  - Users with forced light mode accessibility setting can't override
  - No color palette fallback for light mode users
- **Needs:** 
  - Add `@media (prefers-color-scheme: light)` block with light variant colors
  - Invert bg/ink values and adjust contrast

### 13. **No High-Contrast Mode (@media prefers-contrast)**
- **File:** `mainstyle.css` (entire file)  
- **Issue:** 
  - Users with `prefers-contrast: more` see low-contrast text (--ink-dim, --ink-faint too subtle)
  - Glass effects hard to see if user has contrast requirement
  - Disabled buttons/elements might be invisible
- **Needs:** 
  - Add `@media (prefers-contrast: more)` with higher contrast colors
  - Remove/tone down glass blur effects in this mode

### 14. **No Reduced Motion Handling for Entrance Animations**
- **File:** `mainscript.js:160` (reduceMotion checked) + `mainscript.js:202-210` (hero entrance IIFE)  
- **Issue:** 
  - Hero entrance checks `reduceMotion` BUT entrance timeline still created and runs (just without rAF loop if true)
  - Particles don't reduce on low-end phones; only on user preference
  - Lenis skipped if `reduceMotion` but other GSAP tweens still run; inconsistent
- **Needs:** 
  - Skip hero entrance animations entirely if `reduceMotion` true (don't create timeline)
  - Apply `prefers-reduced-motion` to particle reduce logic (not just LOW_POWER)
  - Disable magnetic effects on cards/nav if `reduceMotion`

---

## ⚡ OPTIMIZATION ISSUES

### 15. **Particle Canvas Performance on Low-End Devices (Reduce, Don't Remove)**
- **File:** `mainscript.js:3-138` (entire particle IIFE)  
- **Issue:** 
  - Checks LOW_POWER but still creates canvas + repaints at 60fps
  - On 2-core phone with 2GB RAM, particle system still runs (just fewer particles)
  - Visibility change listener helps (pauses when tab hidden) but still wastes battery
  - Canvas redraw is GPU-intensive; could be optimized further
- **Needs:** 
  - **Keep particles on most devices** — they're a core visual feature
  - On LOW_POWER: reduce particle count even more (already does 55 vs 90) — could go to 30-35
  - Could reduce link distance (LINK_DIST) on LOW_POWER for fewer line calculations
  - Could reduce animation frame rate on LOW_POWER (30fps instead of 60fps)
  - Visibility change listener already good — keep it

### 16. **Multiple Heavy Animation Libraries from CDN**
- **Files:** `index.html:171-176`, `gallery.html:207-208`  
- **Issue:** 
  - GSAP 3.12.5: 35KB gzip
  - ScrollTrigger: 22KB gzip
  - Flip, Draggable, InertiaPlugin: 10KB each
  - Lenis: 8KB gzip
  - Tailwind CSS: loaded from CDN (!)
  - Total: ~90KB+ JavaScript just for animations/scroll
  - No bundle tree-shaking; all features loaded
- **Needs:** 
  - Move to npm + build step, tree-shake unused GSAP plugins
  - Drop Flip (not used in code)
  - Replace Draggable + InertiaPlugin with simpler custom touch handler
  - Self-host fonts & Lenis in bundle
  - Remove Tailwind from CDN (only used for few utilities; could be handwritten CSS)

### 17. **Tailwind CSS Loaded from CDN**
- **File:** `index.html:21`, `gallery.html:24`  
- **Issue:** 
  - `<script src="https://cdn.tailwindcss.com"></script>` = entire Tailwind runtime injected
  - Adds 50KB+ JavaScript that runs at page load
  - JIT compilation on every page load (not production-optimized)
  - Only a few Tailwind classes used: `hidden`, `md:block`, `flex`, `items-center`, etc. (could be 5 lines of CSS)
- **Needs:** 
  - Remove Tailwind CDN
  - Replace Tailwind utilities with plain CSS (they're already in mainstyle.css)
  - Or use Tailwind CLI locally with tree-shake

### 18. **No CSS Minification or Concatenation**
- **Files:** `index.html:22`, `gallery.html:25` (separate CSS file loaded)  
- **Issue:** 
  - `mainstyle.css` is 27KB unminified
  - Could be reduced to ~18KB with minification
  - Inline critical CSS for above-fold content not extracted
- **Needs:** 
  - Minify CSS (remove comments, whitespace)
  - Inline critical CSS (nav, hero, header) in `<style>` tag
  - Defer non-critical CSS with `media="print"` + JS swap

### 19. **No Critical CSS Extraction**
- **File:** `index.html:22` (CSS loaded in <link>, blocks rendering)  
- **Issue:** 
  - Entire CSS file loaded before page renders
  - FCP (First Contentful Paint) delayed by CSS parse time
  - 27KB CSS on slow 3G = 2-3s delay
- **Needs:** 
  - Extract above-fold CSS (nav, hero, header): ~3-4KB
  - Inline in `<style>` tag
  - Load rest async with JavaScript

### 20. **Font Loading Strategy Suboptimal**
- **File:** `index.html:19-20`, `gallery.html:22-23`  
- **Issue:** 
  - 4 Google Fonts loaded (Work Sans, Newsreader, JetBrains Mono, Noto Sans Devanagari)
  - `display=swap` is good but fonts still block if not cached
  - Noto Sans Devanagari only used for one text element in `.lang-cycle`; unnecessary weight
  - No font subsetting (full character sets loaded)
- **Needs:** 
  - Remove Noto Sans Devanagari or self-host subset (only ASCII + Devanagari needed)
  - Add `font-display=swap` if not already (verify URL)
  - Preload critical fonts (Newsreader): `<link rel="preload" as="font" ... crossorigin>`
  - Consider system font stack fallback

### 21. **No Lazy Loading for Hero Image / Background Parallax**
- **File:** `mainstyle.css:203-210` (bg-image)  
- **Issue:** 
  - Background image (image.jpg, 423KB) loaded immediately even if user never scrolls down
  - Gallery background (image2.png, 1.5MB) loaded immediately on gallery.html
  - No intersection observer; both loaded on page load
- **Needs:** 
  - Load background images only when scrolling toward them
  - Or lazy-load via CSS `content-visibility`
  - Or move to a lower-priority fetch

### 22. **Mouse Move Listener Runs at 60fps Without Throttling**
- **File:** `mainscript.js:615-617` (cursor position update), `mainscript.js:133` (particles)  
- **Issue:** 
  - `window.addEventListener('mousemove', ...)` fires 60x/sec on modern displays
  - quickTo() animations run on every event (GSAP internally throttles but still expensive)
  - Custom cursor, particle grab line, magnetic hover all update simultaneously
  - No mobile check; runs even if user on touchscreen (but cursor hidden anyway)
- **Needs:** 
  - Throttle mousemove to 30fps or use `requestAnimationFrame`
  - Or combine all mousemove handlers into one function
  - Skip if `pointer: coarse` detected

### 23. **Resize Listener Causes Layout Thrashing**
- **File:** `mainscript.js:596-599` (resize timer)  
- **Issue:** 
  - `window.addEventListener('resize', ...)` fires many times during resize
  - `syncIndicatorToActive()` reads `offsetLeft` and `offsetWidth` (forces layout recalc)
  - 150ms debounce helps but could be worse on low-end phones
- **Needs:** 
  - Use ResizeObserver instead of resize event (more efficient)
  - Batch reads/writes to avoid layout thrashing

### 24. **Visibility Change Listener Incomplete**
- **File:** `mainscript.js:123-130` (particles visibility), `mainscript.js:174-177` (Lenis visibility)  
- **Issue:** 
  - Particle canvas pauses when tab hidden (good)
  - Lenis ticker paused when hidden (good)
  - But magnetic hover, custom cursor, resize listeners still fire in background tab
  - GSAP ScrollTriggers might still trigger if page is scrolled programmatically
- **Needs:** 
  - Pause all animation listeners when tab hidden
  - Resume only active listeners on tab visible

### 25. **No Lazy Loading for Non-Critical JavaScript**
- **File:** `index.html:171-177`, `gallery.html:207-209`  
- **Issue:** 
  - GSAP, ScrollTrigger, Lenis all loaded before page interactive
  - User can't interact until all JS parsed/executed (even though hero entrance animates after 0.1s)
  - Draggable, Flip, InertiaPlugin loaded even if no JS errors (wasteful)
- **Needs:** 
  - Defer non-critical libs: load after `DOMContentLoaded`
  - Or lazy-load GSAP plugins only if animation section scrolls into view

### 26. **SVG Filter Performance on Weak GPUs (Reduce, Don't Remove)**
- **File:** `mainstyle.css:250-266` (low-power tier already exists but incomplete)  
- **Issue:** 
  - feDisplacementMap + feColorMatrix + feBlend + feGaussianBlur = expensive GPU ops
  - Already has `body.low-power` fallback to plain blur+saturate (good!)
  - But GPU detection might be wrong (false positive on new weak phones, false negative on gaming phones)
- **Needs:** 
  - **Keep glass effects on capable devices** — they're core visual identity
  - On LOW_POWER: use existing fallback (blur+saturate instead of SVG filters) — already does this
  - Could also reduce blur amount on LOW_POWER: `blur(8px) saturate(150%)` instead of `blur(14px) saturate(160%)`
  - Test on actual weak devices (Galaxy A10, Moto E) to verify fallback looks good
  - GPU detection is okay; could fine-tune thresholds if needed

### 27. **No HTTP/2 Push or Preload Hints**
- **File:** `index.html:19` (preconnect exists but incomplete)  
- **Issue:** 
  - `<link rel="preconnect" href="https://fonts.googleapis.com">` is good
  - Missing preload for actual font files: `<link rel="preload" as="font" href="...">`
  - No preconnect for CDN domains (cdnjs.cloudflare.com, cdn.tailwindcss.com, unpkg.com, assets.codepen.io)
- **Needs:** 
  - Add `<link rel="preconnect" href="https://cdnjs.cloudflare.com">`
  - Preload critical fonts
  - Add `dns-prefetch` for CDN domains

### 28. **No Service Worker / Offline Support**
- **Files:** All  
- **Issue:** 
  - Every image, script, CDN dependency causes new network request
  - No offline support; page blank if network fails mid-load
  - Perfect use case for a service worker (images cache well, scripts rarely change)
- **Needs:** 
  - Register service worker to cache static assets
  - Implement stale-while-revalidate strategy for images
  - Offline fallback page

### 29. **No Image Compression or Format Conversion**
- **Files:** `image.jpg` (423KB), `image2.png` (1.5MB), gallery images  
- **Issue:** 
  - image.jpg likely not optimized (could be 100-150KB)
  - image2.png should be JPEG or WebP (1.5MB is massive for a single image)
  - No AVIF format offered (newest/smallest)
  - No 2x/3x DPI variants
- **Needs:** 
  - Compress image.jpg to <150KB
  - Convert image2.png to JPEG or WebP (<300KB)
  - Generate AVIF versions
  - Create mobile-specific variants (smaller crops or lower res)
  - Gallery: compress thumbnails to <30KB, full-res to <500KB each

### 30. **No Code Splitting for Gallery Page**
- **Files:** `mainscript.js` (loaded on both index.html and gallery.html)  
- **Issue:** 
  - Gallery page loads mainscript.js which includes hero/project animations unused on gallery
  - Particle system, hero entrance, project rail code all wasted ~15KB
  - Custom cursor code loaded but hidden in gallery
- **Needs:** 
  - Split mainscript.js into common.js + index.js + gallery.js
  - Or use dynamic import() to load gallery-specific code only on gallery.html

---

## 🎯 MOBILE-FIRST BREAKPOINTS NEEDED

### 31. **No Mobile-Specific Styles for Many Elements**
- **Files:** `mainstyle.css`, `index.html` (inline styles)  
- **Issue:** 
  - Hero h1 uses `clamp(2.6rem, 7.5vw, 7rem)` which is good
  - But other elements have fixed sizes that might not scale well:
    - `.hero` min-height 82vh (OK on mobile but eats battery on old phones)
    - `.specimen` padding 36px 32px (too much on small phones; should be 24px 20px)
    - `.photo-grid` gap 12px (could be 8px on phones)
    - `.fieldlog-track` gap 56px (could be 32px on phones)
    - Section padding 120px 5vw (could be 80px on mobile)
  - No max-width caps on mobile (--ink-dim text at 100vw width is hard to read)
- **Needs:** 
  - Add `@media (max-width: 640px)` for spacing adjustments
  - Add `@media (max-width: 480px)` for ultra-small phones
  - Add `max-width: 100vw` to sections to prevent overflow

### 32. **Fixed Header / Nav Issues on Mobile**
- **File:** `mainstyle.css:48-69`, `gallery.html:31-46`  
- **Issue:** 
  - Header padding 24px 5vw with 5vw sides means header shrinks on small screens
  - Nav pill at `top:24px` is hardcoded; should use `env(safe-area-inset-top)`
  - No handling for iOS address bar show/hide (innerHeight changes on scroll)
- **Needs:** 
  - Make header padding responsive: `@media (max-width: 640px) { padding: 16px 4vw }`
  - Update nav top to `top: max(1.5rem, env(safe-area-inset-top))`

---

## 🔗 EXTERNAL DEPENDENCIES BLOAT

### 33. **Heavy Dependency on Unused GSAP Plugins**
- **Issue:** Flip plugin loaded but never used in code  
- **Fix:** Remove Flip from script tags, tree-shake in build process

### 34. **CDN Failure Fallback Missing**
- **Files:** All script loads  
- **Issue:** If cdnjs.cloudflare.com is down, entire page breaks
- **Needs:** 
  - Add fallback CDN or self-hosted copies
  - Or check `window.gsap` after script load; show fallback UI if missing

---

## 📊 SUMMARY TABLE

| Issue # | Severity | Category | Fix Complexity | Approx Savings |
|---------|----------|----------|-----------------|-----------------|
| 1 | 🔴 Critical | Images | Medium | 200KB+ |
| 2 | 🔴 Critical | Images | Medium | Massive (gallery usability) |
| 3 | 🔴 Critical | Images | Medium | 100-200KB |
| 4 | 🟠 High | Code | Low | 2-5KB |
| 5 | 🟠 High | Mobile | Medium | UX fix |
| 6 | 🟡 Medium | Mobile | Low | Keep glass + fallback |
| 7 | 🟠 High | Mobile | Medium | UX fix |
| 8 | 🟡 Medium | Mobile | Low | 2KB |
| 9 | 🟡 Medium | Mobile | Low | UX fix |
| 10 | 🟡 Medium | Mobile | Low | UX fix |
| 11 | 🟡 Medium | Mobile | Medium | Compat fix |
| 12 | 🟡 Medium | A11y | Low | A11y fix |
| 13 | 🟡 Medium | A11y | Low | A11y fix |
| 14 | 🟡 Medium | A11y | Low | A11y fix |
| 15 | 🟡 Medium | Optimization | Low | Reduce on low-power |
| 16 | 🔴 Critical | Optimization | High | 90KB+ JavaScript |
| 17 | 🔴 Critical | Optimization | Low | 50KB JavaScript |
| 18 | 🟡 Medium | Optimization | Low | 9KB |
| 19 | 🟠 High | Optimization | Medium | FCP improvement |
| 20 | 🟡 Medium | Optimization | Medium | 20-30KB |
| 21 | 🟠 High | Optimization | Medium | Battery (lazy load) |
| 22 | 🟡 Medium | Optimization | Low | Battery/CPU |
| 23 | 🟡 Medium | Optimization | Low | Layout efficiency |
| 24 | 🟡 Medium | Optimization | Low | Battery |
| 25 | 🟠 High | Optimization | Medium | 90KB+ deferred |
| 26 | 🟡 Medium | Optimization | Low | Fallback already there |
| 27 | 🟡 Medium | Optimization | Low | Network waterfall |
| 28 | 🟠 High | Optimization | High | Offline + caching |
| 29 | 🔴 Critical | Images | High | 1-1.2MB+ |
| 30 | 🟡 Medium | Optimization | High | 15KB per page |
| 31 | 🟡 Medium | Mobile | Low | Readability fix |
| 32 | 🟡 Medium | Mobile | Low | UX fix |
| 33 | 🟡 Medium | Optimization | Low | 5KB |
| 34 | 🟡 Medium | Reliability | Medium | Error resilience |

---

## ✅ IMPLEMENTATION ROADMAP (Priority Order)

**Phase 1 (Critical - Image Optimization):** *Saves 1-1.2MB*
- Issue #29: Compress/convert image.jpg and image2.png
- Issue #1: Create responsive variants
- Issue #2: Generate thumbnail versions for gallery
- Issue #3: Add srcset/sizes to all images

**Phase 2 (Critical - JavaScript Bloat):** *Saves 90KB+ JS*
- Issue #16: Tree-shake GSAP, drop Flip, replace Draggable (keep glass animations!)
- Issue #17: Remove Tailwind CDN, use plain CSS
- Issue #25: Lazy-load non-critical libs

**Phase 3 (High Priority - Mobile UX):** *Keep glass, add mobile support*
- Issue #5: Safe area insets
- Issue #6: Test backdrop-filter on iOS; use blur() fallback if needed (keep glass!)
- Issue #7: Touch feedback + active states
- Issue #9: Gallery grid responsiveness
- Issue #15: Reduce particles on LOW_POWER (35 instead of 90; keep effect!)
- Issue #26: Already has low-power fallback (blur+saturate); verify it looks good

**Phase 4 (Medium Priority - Performance):** *Saves 30-50KB*
- Issue #19: Extract critical CSS
- Issue #20: Font optimization
- Issue #21: Lazy-load backgrounds
- Issue #4: Dedupe SVG filters

**Phase 5 (Polish - Accessibility & UX):**
- Issue #12-14: Dark mode + high contrast + prefers-reduced-motion
- Issue #10-11: Fieldlog & Lenis mobile support
- Issue #31-32: Mobile breakpoints

---

## 🧪 TESTING CHECKLIST

- [ ] Test on iPhone SE, iPhone 12 mini, iPhone 13 Pro Max (iOS 16+, 17)
- [ ] Test on Pixel 6a, Galaxy A12, Galaxy S22 Ultra (Android 12, 13, 14)
- [ ] Test on iPad (Safari, Chrome)
- [ ] Test on poor network (throttle to "slow 3G" in DevTools)
- [ ] Test on low-end device (2GB RAM, 2-core CPU) if possible
- [ ] Lighthouse audit (mobile)
- [ ] WebPageTest with real device
- [ ] Test touch interactions: tap, swipe, long-press
- [ ] Test keyboard navigation (tab, enter, escape)
- [ ] Test with screen reader (NVDA, JAWS)


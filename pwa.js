// =============================================================================
//  PWA gate + landscape lock.
//
//  Two overlays, both mobile-only:
//    1. INSTALL GATE   — mobile browser, not installed: the game is unreachable
//                        until it is added to the home screen. No skip.
//    2. ROTATE BLOCKER — installed on a device that ignores the manifest's
//                        orientation (iOS has no lock API): pauses everything
//                        until the phone is turned.
//
//  Desktop is untouched: the platform check is user-agent based on purpose, so
//  a touchscreen laptop can never trip it.
//
//  Communicates with the game by event only (`ts3:pause` / `ts3:resume`), so
//  this file works whether or not main.js has finished loading.
// =============================================================================

const ua = navigator.userAgent || '';

const isAndroid = /Android/.test(ua);
// iPadOS 13+ reports as desktop Safari, hence the MacIntel + touch heuristic.
// Android must be ruled out FIRST: that heuristic also matches an Android UA
// running on Mac hardware (device emulation), which would misroute the user to
// the iOS instructions.
const isIOS = !isAndroid && (
  /iPad|iPhone|iPod/.test(ua) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
);
const isMobile = isIOS || isAndroid;

// iOS only allows installation from Safari. Everything else on iOS is a dead end.
const isIOSNonSafari = isIOS && /CriOS|FxiOS|EdgiOS|OPiOS|Brave/.test(ua);

function standalone() {
  return window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches;
}

const isStandalone = standalone();

// Expose for QA / the game's own diagnostics.
window.__ts3pwa = { isIOS, isAndroid, isMobile, isIOSNonSafari, isStandalone, standalone };

// -----------------------------------------------------------------------------
//  Service worker — only needed so Android will offer installation.
// -----------------------------------------------------------------------------
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err =>
      console.info('[pwa] service worker not registered:', err.message));
  });
}

// -----------------------------------------------------------------------------
//  1. INSTALL GATE
// -----------------------------------------------------------------------------
const gate = document.getElementById('pwaGate');
const rotate = document.getElementById('rotateBlock');

function showGate() {
  if (!gate) return;
  gate.hidden = false;
  document.documentElement.classList.add('gated');

  const ios = document.getElementById('gateIOS');
  const android = document.getElementById('gateAndroid');
  const safari = document.getElementById('gateSafari');

  if (isIOSNonSafari) {
    safari.hidden = false;
  } else if (isIOS) {
    ios.hidden = false;
  } else {
    android.hidden = false;
  }
}

if (isMobile && !isStandalone) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showGate, { once: true });
  } else {
    showGate();
  }
}

// --- Android: the native install prompt --------------------------------------
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  const hint = document.getElementById('androidManual');
  if (btn) {
    btn.hidden = false;
    if (hint) hint.hidden = true;
    btn.onclick = async () => {
      btn.disabled = true;
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (_) {}
      deferredPrompt = null;
      btn.disabled = false;
      btn.hidden = true;
      if (hint) hint.hidden = false;
    };
  }
});

// If the event never fires (already installable-blocked, or an unsupported
// browser), the manual menu instructions stay visible — they are the default.

window.addEventListener('appinstalled', () => {
  const inner = gate && gate.querySelector('.gate-inner');
  if (inner) {
    inner.innerHTML =
      '<h1>INSTALLED</h1>' +
      '<p class="gate-sub">Open Traffic Simulator 3000 from your home screen.</p>';
  }
});

// -----------------------------------------------------------------------------
//  2. LANDSCAPE LOCK
// -----------------------------------------------------------------------------

// Android honours the manifest, but ask explicitly too. Must be inside a
// gesture on some builds, and throws on every browser that lacks it.
let lockTried = false;
function tryLockLandscape() {
  if (lockTried) return;
  lockTried = true;
  try {
    const o = screen.orientation;
    if (o && typeof o.lock === 'function') {
      o.lock('landscape').catch(() => { /* iOS, and Android without fullscreen */ });
    }
  } catch (_) { /* no orientation API */ }
}

if (isStandalone && isMobile) {
  addEventListener('pointerdown', tryLockLandscape, { once: true, passive: true });
  addEventListener('touchend', tryLockLandscape, { once: true, passive: true });
}

// --- the portrait blocker ----------------------------------------------------
// iOS has no lock API at all, so this is the fallback. It also covers an
// Android device where lock() was refused.
let rotateShown = false;

// Viewport shape is the authority: it is what actually decides whether the
// cockpit is playable. The orientation media query is only a fallback, because
// it can lag a rotation on iOS and is unreliable under device emulation.
function portrait() {
  const w = window.innerWidth, h = window.innerHeight;
  if (w > 0 && h > 0) return h > w;
  return window.matchMedia('(orientation: portrait)').matches;
}

function checkOrientation() {
  if (!rotate) return;
  const shouldBlock = isMobile && standalone() && portrait();
  if (shouldBlock === rotateShown) return;
  rotateShown = shouldBlock;

  rotate.hidden = !shouldBlock;
  document.documentElement.classList.toggle('rotated', shouldBlock);
  // pause the sim and the audio while the blocker is up
  dispatchEvent(new CustomEvent(shouldBlock ? 'ts3:pause' : 'ts3:resume'));
}

// Catch the case where the game was launched in portrait to begin with, plus
// every later change. orientationchange fires before the viewport settles on
// iOS, hence the resize listener and the deferred re-check.
addEventListener('orientationchange', () => { checkOrientation(); setTimeout(checkOrientation, 250); });
addEventListener('resize', checkOrientation);
if (window.matchMedia) {
  const mq = window.matchMedia('(orientation: portrait)');
  if (mq.addEventListener) mq.addEventListener('change', checkOrientation);
}

// Safety net. iOS standalone is unreliable about firing orientationchange /
// resize at all, and a stuck blocker would make the game unplayable. A half
// second poll costs nothing and guarantees the overlay can never wedge.
if (isMobile) setInterval(checkOrientation, 500);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkOrientation, { once: true });
} else {
  checkOrientation();
}

window.__ts3pwa.checkOrientation = checkOrientation;

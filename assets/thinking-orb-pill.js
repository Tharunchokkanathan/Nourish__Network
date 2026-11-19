/**
 * ThinkingOrbUI - iOS Style Loading HUD for Jakub Antalik's official thinking-orbs
 * Visual style: Medium-sized square black box HUD with centered thinking orb & operation-specific text
 * Reference: https://github.com/Jakubantalik/thinking-orbs
 *
 * Supported official states (at size 64 scale):
 * "breathing"  -> Loading.... (general page boot & transitions)
 * "searching"  -> Refreshing.... / Searching.... (listings search, history refresh, GPS)
 * "working"    -> Confirming order.... / Processing.... (order checkout, atomic reservation)
 * "solving"    -> Signing in.... / Verifying.... / Returning to HQ.... (login, admin verification)
 * "weaving"    -> Validating PIN.... / Creating account.... (handover verification, signup)
 * "composing"  -> Publishing listing.... (adding food item)
 * "connecting" -> Switching account.... / Connecting.... (user switching, socket sync)
 * "listening"  -> Listening.... (realtime notifications)
 * "shaping"    -> Initializing.... (camera/sensor init)
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['ThinkingOrbs'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./thinking-orbs.js'));
  } else {
    root.ThinkingOrbUI = factory(root.ThinkingOrbs);
    if (root) {
      root.showThinkingOrb = root.ThinkingOrbUI.show;
      root.hideThinkingOrb = root.ThinkingOrbUI.hide;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function (ThinkingOrbs) {
  'use strict';

  const DEFAULT_LABELS = {
    breathing: 'Loading....',
    searching: 'Searching....',
    working: 'Processing....',
    solving: 'Verifying....',
    listening: 'Listening....',
    connecting: 'Connecting....',
    weaving: 'Validating....',
    composing: 'Publishing....',
    shaping: 'Initializing....'
  };

  /**
   * Instantiate an animated Thinking Orb on a <canvas>
   * @param {HTMLCanvasElement} canvas
   * @param {Object} options
   */
  function createOrb(canvas, options = {}) {
    if (!canvas || !canvas.getContext) {
      return { stop: () => {}, start: () => {}, setState: () => {}, destroy: () => {} };
    }

    const engine = ThinkingOrbs || (typeof window !== 'undefined' && window.ThinkingOrbs);
    if (!engine || !engine.resolvePreset) {
      console.warn('ThinkingOrbs engine not loaded yet');
      return { stop: () => {}, start: () => {}, setState: () => {}, destroy: () => {} };
    }

    const {
      state = 'breathing',
      size = 64, // Medium scale: 64px
      speed = 1,
      dark = true,
      paused = false,
      dots = 1,
      dotSize = 1
    } = options;

    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    canvas.style.display = 'block';

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { stop: () => {}, start: () => {}, setState: () => {}, destroy: () => {} };
    }

    let currentState = state;
    let currentSpeed = speed;
    let isPaused = paused;
    let animId = 0;
    let isRunning = false;

    let preset = engine.resolvePreset(currentState, size);
    let opts = dots !== 1 ? engine.scaleCounts(preset.opts, Math.max(0.1, dots)) : preset.opts;
    if (dotSize !== 1) opts = engine.scaleRadii(opts, Math.max(0.1, dotSize));

    // Pure uncolored dots ("dont change any colour, let it be")
    const tint = undefined;

    function render(tSec) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const frameFn = engine.MODE_FRAMES[preset.mode];
      if (frameFn) {
        engine.paintFrame(ctx, frameFn(size, tSec, opts), dark, tint);
      }
    }

    function loop() {
      const effSpeed = preset.speed * currentSpeed;
      render((performance.now() / 1000) * effSpeed);
      if (isRunning) {
        animId = requestAnimationFrame(loop);
      }
    }

    function start() {
      if (isRunning || isPaused) return;
      isRunning = true;
      animId = requestAnimationFrame(loop);
    }

    function stop() {
      isRunning = false;
      if (animId) {
        cancelAnimationFrame(animId);
        animId = 0;
      }
    }

    function setState(newState) {
      if (!newState || newState === currentState) return;
      currentState = newState;
      preset = engine.resolvePreset(currentState, size);
      opts = dots !== 1 ? engine.scaleCounts(preset.opts, Math.max(0.1, dots)) : preset.opts;
      if (dotSize !== 1) opts = engine.scaleRadii(opts, Math.max(0.1, dotSize));
    }

    // Paint initial frame
    render(0.6);
    if (!isPaused) {
      start();
    }

    return {
      start,
      stop,
      setState,
      destroy: stop
    };
  }

  /**
   * Create an iOS style medium square black box HUD
   */
  function createHUD(text, state = 'breathing', size = 64) {
    const hud = document.createElement('div');
    hud.className = 'thinking-orb-hud';
    hud.setAttribute('role', 'status');
    hud.setAttribute('aria-live', 'polite');

    const canvas = document.createElement('canvas');
    canvas.className = 'thinking-orb-canvas';

    const span = document.createElement('span');
    span.className = 'thinking-orb-text';
    span.textContent = text || DEFAULT_LABELS[state] || 'Loading....';

    hud.appendChild(canvas);
    hud.appendChild(span);

    const orb = createOrb(canvas, { state, size, dark: true });

    return {
      element: hud,
      orb,
      setText(newText) {
        span.textContent = newText;
      },
      setState(newState) {
        orb.setState(newState);
        if (!text) {
          span.textContent = DEFAULT_LABELS[newState] || 'Loading....';
        }
      },
      destroy() {
        orb.destroy();
        if (hud.parentNode) {
          hud.parentNode.removeChild(hud);
        }
      }
    };
  }

  // Alias createPill for backwards compatibility
  const createPill = createHUD;

  // Global Overlay Singleton
  let overlayEl = null;
  let activeHUD = null;
  let hideTimeout = null;
  let safetyWatchdogTimeout = null;

  function ensureOverlay() {
    if (overlayEl && document.body.contains(overlayEl)) return overlayEl;

    overlayEl = document.createElement('div');
    overlayEl.className = 'thinking-orb-overlay';
    overlayEl.id = 'thinking-orb-global-overlay';

    // Tap backdrop to dismiss if stuck
    overlayEl.addEventListener('click', (e) => {
      if (e.target === overlayEl) {
        hide(0);
      }
    });

    document.body.appendChild(overlayEl);
    return overlayEl;
  }

  /**
   * Show global iOS style square black box HUD overlay
   * @param {string|Object} textOrOptions
   * @param {string} [optionalState]
   */
  function show(textOrOptions = 'Loading....', optionalState = 'breathing') {
    if (typeof document === 'undefined' || !document.body) return;

    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }

    // Auto-dismiss safety watchdog: guarantee HUD never hangs more than 5000ms
    if (safetyWatchdogTimeout) clearTimeout(safetyWatchdogTimeout);
    safetyWatchdogTimeout = setTimeout(() => {
      hide(0);
    }, 5000);

    let text = 'Loading....';
    let state = 'breathing';

    if (typeof textOrOptions === 'object' && textOrOptions !== null) {
      text = textOrOptions.text || DEFAULT_LABELS[textOrOptions.state || 'breathing'] || 'Loading....';
      state = textOrOptions.state || 'breathing';
    } else if (typeof textOrOptions === 'string') {
      text = textOrOptions;
      state = optionalState || 'breathing';
    }

    const overlay = ensureOverlay();

    if (activeHUD) {
      activeHUD.setText(text);
      activeHUD.setState(state);
    } else {
      overlay.innerHTML = '';
      activeHUD = createHUD(text, state, 64);
      overlay.appendChild(activeHUD.element);
    }

    // Force reflow for CSS transition
    void overlay.offsetWidth;
    overlay.classList.add('visible');
  }

  /**
   * Hide global HUD overlay
   */
  function hide(delayMs = 120) {
    if (safetyWatchdogTimeout) {
      clearTimeout(safetyWatchdogTimeout);
      safetyWatchdogTimeout = null;
    }

    if (!overlayEl) return;

    if (hideTimeout) clearTimeout(hideTimeout);

    if (delayMs <= 0) {
      overlayEl.classList.remove('visible');
      if (activeHUD) {
        activeHUD.destroy();
        activeHUD = null;
      }
      overlayEl.innerHTML = '';
      hideTimeout = null;
      return;
    }

    hideTimeout = setTimeout(() => {
      if (overlayEl) {
        overlayEl.classList.remove('visible');
      }
      setTimeout(() => {
        if (activeHUD) {
          activeHUD.destroy();
          activeHUD = null;
        }
        if (overlayEl) {
          overlayEl.innerHTML = '';
        }
      }, 250);
      hideTimeout = null;
    }, delayMs);
  }

  /**
   * Mount an inline HUD into any container
   * @param {HTMLElement|string} containerOrSelector
   * @param {string} text
   * @param {string} state
   * @param {number} size
   */
  function renderHUD(containerOrSelector, text = 'Loading....', state = 'breathing', size = 64) {
    if (typeof document === 'undefined') return null;

    const container = typeof containerOrSelector === 'string'
      ? document.querySelector(containerOrSelector)
      : containerOrSelector;

    if (!container) return null;

    container.innerHTML = '';
    const hud = createHUD(text, state, size);
    hud.element.classList.add('inline');
    container.appendChild(hud.element);
    return hud;
  }

  const renderPill = renderHUD;

  /**
   * Automatically scans for elements with class .thinking-orb-slot and renders live HUDs
   */
  function initSlots(root = document) {
    if (!root || !root.querySelectorAll) return;
    const slots = root.querySelectorAll('.thinking-orb-slot');
    slots.forEach(slot => {
      const text = slot.getAttribute('data-text') || 'Loading....';
      const state = slot.getAttribute('data-state') || 'breathing';
      renderHUD(slot, text, state, 64);
    });
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pageshow', () => hide(0));
    window.addEventListener('popstate', () => hide(0));
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlayEl && overlayEl.classList.contains('visible')) {
        hide(0);
      }
    });
  }

  return {
    createOrb,
    createHUD,
    createPill,
    renderHUD,
    renderPill,
    initSlots,
    show,
    hide,
    LABELS: DEFAULT_LABELS
  };
});

/**
 * ThinkingOrbUI - UI Component for Jakub Antalik's official thinking-orbs
 * Visual style: Sleek dark capsule pill matching reference specification
 * Supports all 9 official states:
 * "working" | "searching" | "solving" | "listening" | "connecting" |
 * "weaving" | "composing" | "breathing" | "shaping"
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
    breathing: 'Thinking....',
    searching: 'Searching....',
    working: 'Working....',
    solving: 'Solving....',
    listening: 'Listening....',
    connecting: 'Connecting....',
    weaving: 'Weaving....',
    composing: 'Composing....',
    shaping: 'Shaping....'
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
      size = 32,
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

    // Pure dots without color tinting ("dont change any colour, let it be")
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
   * Create a DOM capsule pill containing an animated thinking orb and label
   */
  function createPill(text, state = 'breathing', size = 32) {
    const pill = document.createElement('div');
    pill.className = 'thinking-orb-pill';
    pill.setAttribute('role', 'status');
    pill.setAttribute('aria-live', 'polite');

    const canvas = document.createElement('canvas');
    canvas.className = 'thinking-orb-canvas';

    const span = document.createElement('span');
    span.className = 'thinking-orb-text';
    span.textContent = text || DEFAULT_LABELS[state] || 'Thinking....';

    pill.appendChild(canvas);
    pill.appendChild(span);

    const orb = createOrb(canvas, { state, size, dark: true });

    return {
      element: pill,
      orb,
      setText(newText) {
        span.textContent = newText;
      },
      setState(newState) {
        orb.setState(newState);
        if (!text) {
          span.textContent = DEFAULT_LABELS[newState] || 'Thinking....';
        }
      },
      destroy() {
        orb.destroy();
        if (pill.parentNode) {
          pill.parentNode.removeChild(pill);
        }
      }
    };
  }

  // Global Overlay Singleton
  let overlayEl = null;
  let activePill = null;
  let hideTimeout = null;

  function ensureOverlay() {
    if (overlayEl && document.body.contains(overlayEl)) return overlayEl;

    overlayEl = document.createElement('div');
    overlayEl.className = 'thinking-orb-overlay';
    overlayEl.id = 'thinking-orb-global-overlay';
    document.body.appendChild(overlayEl);
    return overlayEl;
  }

  /**
   * Show global floating capsule pill overlay
   * @param {string|Object} textOrOptions
   * @param {string} [optionalState]
   */
  function show(textOrOptions = 'Thinking....', optionalState = 'breathing') {
    if (typeof document === 'undefined' || !document.body) return;

    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }

    let text = 'Thinking....';
    let state = 'breathing';

    if (typeof textOrOptions === 'object' && textOrOptions !== null) {
      text = textOrOptions.text || DEFAULT_LABELS[textOrOptions.state || 'breathing'] || 'Thinking....';
      state = textOrOptions.state || 'breathing';
    } else if (typeof textOrOptions === 'string') {
      text = textOrOptions;
      state = optionalState || 'breathing';
    }

    const overlay = ensureOverlay();

    if (activePill) {
      activePill.setText(text);
      activePill.setState(state);
    } else {
      overlay.innerHTML = '';
      activePill = createPill(text, state, 32);
      overlay.appendChild(activePill.element);
    }

    // Force reflow for CSS transition
    void overlay.offsetWidth;
    overlay.classList.add('visible');
  }

  /**
   * Hide global floating capsule pill overlay
   */
  function hide(delayMs = 120) {
    if (!overlayEl) return;

    if (hideTimeout) clearTimeout(hideTimeout);

    hideTimeout = setTimeout(() => {
      if (overlayEl) {
        overlayEl.classList.remove('visible');
      }
      setTimeout(() => {
        if (activePill) {
          activePill.destroy();
          activePill = null;
        }
        if (overlayEl) {
          overlayEl.innerHTML = '';
        }
      }, 250);
      hideTimeout = null;
    }, delayMs);
  }

  /**
   * Mount an inline capsule pill into any container
   * @param {HTMLElement|string} containerOrSelector
   * @param {string} text
   * @param {string} state
   * @param {number} size
   */
  function renderPill(containerOrSelector, text = 'Thinking....', state = 'breathing', size = 32) {
    if (typeof document === 'undefined') return null;

    const container = typeof containerOrSelector === 'string'
      ? document.querySelector(containerOrSelector)
      : containerOrSelector;

    if (!container) return null;

    container.innerHTML = '';
    const pill = createPill(text, state, size);
    pill.element.classList.add('inline');
    container.appendChild(pill.element);
    return pill;
  }

  /**
   * Automatically scans for elements with class .thinking-orb-slot and renders live pills
   */
  function initSlots(root = document) {
    if (!root || !root.querySelectorAll) return;
    const slots = root.querySelectorAll('.thinking-orb-slot');
    slots.forEach(slot => {
      const text = slot.getAttribute('data-text') || 'Thinking....';
      const state = slot.getAttribute('data-state') || 'breathing';
      renderPill(slot, text, state, 32);
    });
  }

  return {
    createOrb,
    createPill,
    renderPill,
    initSlots,
    show,
    hide,
    LABELS: DEFAULT_LABELS
  };
});

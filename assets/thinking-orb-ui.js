/**
 * Nourish Network — Thinking Orb iOS/Mac Style Loading System
 * Powered by Jakub Antalik's Thinking Orbs Engine
 */

(function (window) {
    'use strict';

    // Shared clock for all orbs so they stay perfectly in phase
    const startTime = performance.now();

    class OrbInstance {
        constructor(canvas, options = {}) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.size = options.size || 64;
            this.state = options.state || 'searching'; // 'searching' is the sharp dotted globe
            this.theme = options.theme || 'auto'; // 'dark', 'light', 'auto'
            this.speed = options.speed || 1.18;
            this.tint = options.tint || null;
            this.animId = null;

            this.init();
        }

        init() {
            if (!this.canvas || !this.ctx) return;
            const dpr = Math.min(window.devicePixelRatio || 2, 2);
            this.canvas.width = Math.round(this.size * dpr);
            this.canvas.height = Math.round(this.size * dpr);
            this.canvas.style.width = `${this.size}px`;
            this.canvas.style.height = `${this.size}px`;

            this.tick();
        }

        resolveTheme() {
            if (this.theme === 'dark') return true;
            if (this.theme === 'light') return false;
            // auto theme detection: dark by default unless light-theme is active
            const isLight = document.body.classList.contains('light-theme') || 
                            document.documentElement.classList.contains('light-theme') ||
                            document.documentElement.getAttribute('data-theme') === 'light';
            return !isLight;
        }

        tick() {
            if (!this.canvas || !this.canvas.isConnected) {
                this.animId = null;
                return;
            }

            const engine = window.ThinkingOrbsEngine;
            if (engine && this.ctx) {
                const dpr = Math.min(window.devicePixelRatio || 2, 2);
                this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                this.ctx.clearRect(0, 0, this.size, this.size);

                const elapsedSeconds = (performance.now() - startTime) / 1000;
                const { mode, speed, opts } = engine.resolvePreset(this.state, this.size);
                const frameFn = engine.MODE_FRAMES && engine.MODE_FRAMES[mode];
                if (frameFn) {
                    const frame = frameFn(this.size, elapsedSeconds * speed * this.speed, opts);
                    const isDark = this.resolveTheme();
                    engine.paintFrame(this.ctx, frame, isDark, this.tint);
                }
            }

            this.animId = requestAnimationFrame(() => this.tick());
        }

        destroy() {
            if (this.animId) {
                cancelAnimationFrame(this.animId);
                this.animId = null;
            }
        }
    }

    // ─── UI HELPERS & TEMPLATES ───────────────────────────────────────────────

    /**
     * Generate HTML for an iOS/Mac styled thinking orb card
     */
    function createOrbHTML(options = {}) {
        const id = options.id || `orb-${Math.random().toString(36).substring(2, 9)}`;
        const size = options.size || 64;
        const title = options.title || 'Loading Nourish Network…';
        const subtitle = options.subtitle || 'Synchronizing with live community network';
        const state = options.state || 'searching';
        const inline = options.inline || false;

        if (inline) {
            return `
                <div class="ios-orb-inline" id="${id}-wrap" data-orb-id="${id}" style="display: inline-flex; align-items: center; gap: 10px;">
                    <canvas id="${id}" data-size="${size}" data-state="${state}" style="width: ${size}px; height: ${size}px;"></canvas>
                    <span class="ios-orb-inline-text" style="font-size: 0.88rem; color: rgba(255,255,255,0.8);">${title}</span>
                </div>
            `;
        }

        return `
            <div class="ios-orb-card" id="${id}-wrap" data-orb-id="${id}">
                <div class="ios-orb-canvas-wrap">
                    <canvas id="${id}" data-size="${size}" data-state="${state}" style="width: ${size}px; height: ${size}px; display: block; margin: 0 auto;"></canvas>
                </div>
                <div class="ios-orb-title">${title}</div>
                <div class="ios-orb-subtitle">${subtitle}</div>
            </div>
        `;
    }

    /**
     * Mounts a ThinkingOrb canvas inside an element or by canvas ID
     */
    function mount(canvasOrId, options = {}) {
        const canvas = typeof canvasOrId === 'string' ? document.getElementById(canvasOrId) : canvasOrId;
        if (!canvas) return null;
        return new OrbInstance(canvas, options);
    }

    /**
     * Automatically finds and mounts all uninitialized canvases with data-state or inside .ios-orb-card
     */
    function scanAndMount(root = document) {
        const canvases = root.querySelectorAll('canvas[data-state]:not([data-orb-mounted])');
        canvases.forEach(canvas => {
            canvas.setAttribute('data-orb-mounted', 'true');
            const size = parseInt(canvas.dataset.size, 10) || 64;
            const state = canvas.dataset.state || 'searching';
            const theme = canvas.dataset.theme || 'auto';
            mount(canvas, { size, state, theme });
        });
    }

    /**
     * Show global iOS-style modal orb loader
     */
    function showGlobal(title = 'Loading Nourish Network…', subtitle = 'Synchronizing real-time community data', state = 'searching') {
        if (window._globalOrbHideTimeout) {
            clearTimeout(window._globalOrbHideTimeout);
            window._globalOrbHideTimeout = null;
        }

        let overlay = document.getElementById('nn-global-orb-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'nn-global-orb-overlay';
            overlay.className = 'ios-orb-global-overlay';
            document.body.appendChild(overlay);
        }

        // If overlay is already open, smoothly update text instead of tearing down canvas
        const existingTitle = document.getElementById('nn-global-orb-title');
        const existingSub = document.getElementById('nn-global-orb-subtitle');
        if (existingTitle && existingSub && window._currentGlobalOrbInstance && overlay.style.display === 'flex') {
            existingTitle.textContent = title;
            existingSub.textContent = subtitle;
            overlay.style.opacity = '1';
            return;
        }

        const orbId = 'global-thinking-orb-canvas';
        overlay.innerHTML = `
            <div class="ios-orb-card ios-orb-card-modal">
                <div class="ios-orb-canvas-wrap">
                    <canvas id="${orbId}" data-size="64" data-state="${state}"></canvas>
                </div>
                <div class="ios-orb-title" id="nn-global-orb-title">${title}</div>
                <div class="ios-orb-subtitle" id="nn-global-orb-subtitle">${subtitle}</div>
            </div>
        `;
        overlay.style.display = 'flex';
        void overlay.offsetWidth; // force reflow
        overlay.style.opacity = '1';

        const canvas = document.getElementById(orbId);
        if (canvas) {
            canvas.setAttribute('data-orb-mounted', 'true');
            if (window._currentGlobalOrbInstance) {
                window._currentGlobalOrbInstance.destroy();
            }
            window._currentGlobalOrbInstance = mount(canvas, { size: 64, state });
        }
    }

    /**
     * Hide global orb loader
     */
    function hideGlobal() {
        if (window._globalOrbHideTimeout) {
            clearTimeout(window._globalOrbHideTimeout);
        }

        const overlay = document.getElementById('nn-global-orb-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            window._globalOrbHideTimeout = setTimeout(() => {
                overlay.style.display = 'none';
                if (window._currentGlobalOrbInstance) {
                    window._currentGlobalOrbInstance.destroy();
                    window._currentGlobalOrbInstance = null;
                }
                window._globalOrbHideTimeout = null;
            }, 300);
        }

        // Also fade out initial preloader if present
        const preloader = document.getElementById('nn-app-preloader');
        if (preloader && preloader.style.display !== 'none') {
            preloader.style.opacity = '0';
            setTimeout(() => {
                preloader.style.display = 'none';
            }, 300);
        }
    }

    /**
     * Helper to render orb loader in any container element
     */
    function renderIn(container, title, subtitle, state = 'searching', size = 64) {
        if (!container) return;
        const orbId = `orb-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        container.innerHTML = createOrbHTML({ id: orbId, title, subtitle, state, size });
        const canvas = document.getElementById(orbId);
        if (canvas) {
            canvas.setAttribute('data-orb-mounted', 'true');
            mount(canvas, { size, state });
        }
    }

    // Expose public API
    window.ThinkingOrbUI = {
        OrbInstance,
        createOrbHTML,
        mount,
        scanAndMount,
        showGlobal,
        hideGlobal,
        renderIn
    };

    // Auto-scan on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => scanAndMount());
    } else {
        scanAndMount();
    }

})(typeof window !== 'undefined' ? window : this);


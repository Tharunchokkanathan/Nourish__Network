document.addEventListener('DOMContentLoaded', () => {
    // 1. Configuration - Dynamic API Detection
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_BASE = isLocal ? '/api' : 'https://nourish-network-4bit.onrender.com/api';

    // 1. Initial State
    const state = {
        activePortal: 'home', 
        cart: [],
        listings: [],
        communityComments: [
            {
                name: "Chef Marco",
                org: "Grand Hotel",
                text: "Nourish Network has completely changed how we give back. We used to throw away kilos of premium food a day; now it feeds kids at the local orphanage within hours.",
                stars: 5,
                img: "https://i.pravatar.cc/100?img=1"
            }
        ],
        stats: { totalMealsSaved: 0, totalKgShared: 0, totalVendors: 0, totalNGOs: 0 }
    };

    // --- ATTACH GLOBAL DOCK LISTENERS ---
    function wireDockButtons() {
        console.log("WireDockButtons: Initializing dock listeners...");
        
        const loginDock = document.getElementById('login-toggle-dock');
        if (loginDock) {
            loginDock.onclick = (e) => {
                e.preventDefault();
                console.log("Dock: Login/Logout Clicked");
                const token = sessionStorage.getItem('nourishToken');
                if (token) {
                    if (confirm("Are you sure you want to logout?")) logout();
                } else {
                    showLoginForm();
                }
            };
        }

        const addDock = document.getElementById('add-listing-dock');
        if (addDock) {
            addDock.onclick = (e) => {
                e.preventDefault();
                console.log("Dock: Add Listing Clicked");
                const section = document.getElementById('add-listing-section');
                if (section) {
                    section.scrollIntoView({ behavior: 'smooth' });
                    section.style.boxShadow = '0 0 40px var(--primary-color)';
                    setTimeout(() => section.style.boxShadow = '', 1500);
                } else {
                    console.warn("Add Listing section not found in current portal");
                }
            };
        }

        const settingsDock = document.getElementById('settings-toggle-dock');
        if (settingsDock) {
            settingsDock.onclick = (e) => {
                e.preventDefault();
                console.log("Dock: Settings Clicked");
                if (typeof window.openSettings === 'function') {
                    window.openSettings();
                } else {
                    // Fallback if the function isn't globally exposed yet
                    const modal = document.getElementById('settingsModal');
                    if (modal) {
                        modal.style.display = 'flex';
                        // Trigger loadProfile if possible
                        const event = new CustomEvent('open-settings');
                        document.dispatchEvent(event);
                    }
                }
            };
        }

        const cartDock = document.getElementById('cart-toggle-dock');
        if (cartDock) {
            cartDock.onclick = (e) => {
                e.preventDefault();
                console.log("Dock: Cart Clicked");
                const drawer = document.getElementById('cart-drawer');
                if (drawer) drawer.classList.add('active');
            };
        }

        const homeDock = document.querySelector('.bottom-nav .nav-item[href="#home"]');
        if (homeDock) {
            homeDock.onclick = (e) => {
                e.preventDefault();
                console.log("Dock: Home Clicked");
                if (state.activePortal !== 'home') {
                    if (sessionStorage.getItem('nourishToken')) logout();
                    else { state.activePortal = 'home'; renderPortal(); }
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
        }
    }
    
    wireDockButtons();

    // --- BACKEND SYNC ENGINE ---
    async function refreshState(silent = false) {
        try {
            const user = JSON.parse(sessionStorage.getItem('nourishUser') || '{}');
            let url = `${API_BASE}/listings`;
            if (state.activePortal === 'seller' && user.id) {
                url += `?vendorId=${user.id}`;
            }

            const listRes = await fetch(url);
            if (listRes.ok) {
                const rawListings = await listRes.json();
                state.listings = rawListings.map(item => ({
                    ...item,
                    qty: item.quantity || item.qty || 0,
                    expiry: item.expiryTime || item.expiry || null,
                    img: (item.imageUrl || item.img || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600").startsWith('/uploads') 
                        ? (isLocal ? '' : 'https://nourish-network-4bit.onrender.com') + (item.imageUrl || item.img)
                        : (item.imageUrl || item.img)
                }));
            }

            const statsRes = await fetch(`${API_BASE}/stats`);
            if (statsRes.ok) {
                state.stats = await statsRes.json();
                updateLiveStats();
            }

            if (silent) {
                if (state.activePortal === 'seller' && typeof renderSellerListings === 'function') {
                    renderSellerListings();
                } else if (state.activePortal === 'buyer' && typeof renderExchangeGrid === 'function') {
                    renderExchangeGrid();
                }
            } else {
                renderPortal();
            }
            
            if (typeof renderImpactMap === 'function') {
                renderImpactMap();
            }
        } catch (err) {
            console.error("Backend Sync Failed:", err);
        }
    }

    checkSession();

    // --- SESSION PERSISTENCE ---
    function checkSession() {
        console.log("Checking session...");
        const userStr = sessionStorage.getItem('nourishUser');
        const token = sessionStorage.getItem('nourishToken');
        if (userStr && token) {
            const user = JSON.parse(userStr);
            const type = (user.type || user.accountType || user.role || '').toLowerCase();
            state.activePortal = (type === 'restaurant' || type === 'vendor' || type === 'seller') ? 'seller' : 'buyer';
            console.log("Session found, active portal:", state.activePortal);
            refreshState();
        } else {
            console.log("No session found.");
            refreshState();
        }
    }

    function updateLiveStats() {
        const listedEl = document.querySelector('[data-target-stat="listed"]');
        const fulfilledEl = document.querySelector('[data-target-stat="fulfilled"]');
        const vendorsEl = document.querySelector('[data-target-stat="vendors"]');
        const ngosEl = document.querySelector('[data-target-stat="ngos"]');
        
        if (listedEl) listedEl.setAttribute('data-target', Math.round(state.stats.totalMealsSaved || 0));
        if (fulfilledEl) fulfilledEl.setAttribute('data-target', Math.round(state.stats.totalKgShared || 0));
        if (vendorsEl) vendorsEl.setAttribute('data-target', state.stats.totalVendors || 0);
        if (ngosEl) ngosEl.setAttribute('data-target', state.stats.totalNGOs || 0);
        
        startCounters();
    }


    // 2. Scroll Animations Setup using Intersection Observer
    const animateElements = document.querySelectorAll('.animate-on-scroll');

    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const scrollObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                // Optional: Stop observing after animation triggers once
                // observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    animateElements.forEach(el => scrollObserver.observe(el));

    // 2. Navbar Background on Scroll
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // 3. Animated Counters Setup
    const counters = document.querySelectorAll('.stat-number');
    let hasCounted = false;

    const counterObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !hasCounted) {
            hasCounted = true;
            startCounters();
        }
    }, { threshold: 0.5 });

    const impactSection = document.getElementById('counter-section');
    if (impactSection) {
        counterObserver.observe(impactSection);
    }

    function startCounters() {
        counters.forEach(counter => {
            const target = +counter.getAttribute('data-target');
            const duration = 2000; // ms
            const stepTime = Math.abs(Math.floor(duration / target));

            // To prevent browser locking for large numbers, we do frame-based animation
            let startTime = null;

            function updateCounter(currentTime) {
                if (!startTime) startTime = currentTime;
                const progress = currentTime - startTime;

                const current = Math.min(Math.floor((progress / duration) * target), target);

                // Format with commas
                counter.innerText = current.toLocaleString();

                if (progress < duration) {
                    requestAnimationFrame(updateCounter);
                } else {
                    counter.innerText = target.toLocaleString() + (counter.getAttribute('data-target') > 1000 ? '+' : '');
                }
            }
            requestAnimationFrame(updateCounter);
        });
    }

    // 4. Dynamic Review Slider Implementation
    let sliderInterval = null;

    function renderReviewsSlider() {
        const slider = document.getElementById('reviewSlider');
        const dotsContainer = document.getElementById('sliderDots');
        if (!slider || !dotsContainer) return;

        // Stop current interval
        if (sliderInterval) clearInterval(sliderInterval);

        // Clear existing
        slider.innerHTML = '';
        dotsContainer.innerHTML = '';

        if (state.communityComments.length === 0) return;

        state.communityComments.forEach((comment, idx) => {
            let starsMarkup = '';
            for (let i = 0; i < 5; i++) {
                starsMarkup += `<i class="${i < Math.floor(comment.stars) ? 'fa-solid' : 'fa-regular'} fa-star"></i>`;
            }

            const slide = document.createElement('div');
            slide.className = `review-slide glass-card ${idx === 0 ? 'active' : ''}`;
            slide.innerHTML = `
                <div class="stars">${starsMarkup}</div>
                <p class="review-text">"${comment.text}"</p>
                <div class="reviewer">
                    <div class="avatar"><img src="${comment.img || 'https://i.pravatar.cc/100?img=' + (idx + 10)}" alt="Avatar"></div>
                    <div class="info">
                        <strong>${comment.name}</strong>
                        <span>${comment.org}</span>
                    </div>
                </div>
            `;
            slider.appendChild(slide);

            const dot = document.createElement('div');
            dot.className = `dot ${idx === 0 ? 'active' : ''}`;
            dot.addEventListener('click', () => goToSlide(idx));
            dotsContainer.appendChild(dot);
        });

        let currentSlide = 0;
        const slides = slider.querySelectorAll('.review-slide');
        const dots = dotsContainer.querySelectorAll('.dot');

        function updateSlides() {
            if (slides.length === 0) return;
            slides.forEach((slide, idx) => {
                slide.classList.toggle('active', idx === currentSlide);
                if (dots[idx]) dots[idx].classList.toggle('active', idx === currentSlide);
            });
        }

        function nextSlide() {
            if (slides.length <= 1) return;
            currentSlide = (currentSlide + 1) % slides.length;
            updateSlides();
        }

        function prevSlide() {
            if (slides.length <= 1) return;
            currentSlide = (currentSlide - 1 + slides.length) % slides.length;
            updateSlides();
        }

        function goToSlide(idx) {
            currentSlide = idx;
            updateSlides();
        }

        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        if (prevBtn) prevBtn.onclick = prevSlide;
        if (nextBtn) nextBtn.onclick = nextSlide;
        
        if (slides.length > 1) {
            sliderInterval = setInterval(nextSlide, 5000);
        }
    }
    renderReviewsSlider();

    // 5. Smooth Scrolling for Internal Links (excluding modal triggers)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');

            // Skip modal trigger links
            if (targetId === '#join' && this.closest('.nav-buttons')) return;

            e.preventDefault();
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80, // adjust for navbar height
                    behavior: 'smooth'
                });
            }
        });
    });

    // =========================================
    // AUTH MODAL LOGIC
    // =========================================
    const authModal = document.getElementById('authModal');
    const closeModal = document.getElementById('closeModal');
    const toggleLoginBtn = document.getElementById('toggleLogin');
    const toggleRegisterBtn = document.getElementById('toggleRegister');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const modalTitle = document.getElementById('modalTitle');
    const modalSubtitle = document.getElementById('modalSubtitle');

    // Open Modal from ALL "Join" / "Donate" buttons
    const joinButtons = document.querySelectorAll('a[href="#join"]');
    joinButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            authModal.classList.add('active');

            // Show modal

            const btnText = btn.innerText.toLowerCase();
            if (btnText.includes('log in')) {
                showLoginForm();
            } else {
                showRegisterForm();
            }
        });
    });

    // Close Modal
    function closeAuthModal() {
        authModal.classList.remove('active');
        // Show dock back if we are on home
        syncDock();
    }

    closeModal.addEventListener('click', closeAuthModal);

    // Close on overlay click
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) {
            closeAuthModal();
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && authModal.classList.contains('active')) {
            closeAuthModal();
        }
    });

    // Toggle Forms
    function showLoginForm() {
        authModal.classList.add('active');

        toggleRegisterBtn.classList.remove('active');
        toggleLoginBtn.classList.add('active');
        registerForm.classList.remove('active');
        loginForm.classList.add('active');
        modalTitle.innerText = "Welcome Back";
        modalSubtitle.innerText = "Log in to continue your impact.";
    }

    function showRegisterForm() {
        authModal.classList.add('active');

        toggleLoginBtn.classList.remove('active');
        toggleRegisterBtn.classList.add('active');
        loginForm.classList.remove('active');
        registerForm.classList.add('active');
        modalTitle.innerText = "Join the Network";
        modalSubtitle.innerText = "Create an account to get started.";
    }

    toggleLoginBtn.addEventListener('click', showLoginForm);

    toggleRegisterBtn.addEventListener('click', showRegisterForm);


    // =========================================
    // TOAST NOTIFICATIONS LOGIC
    // =========================================
    const toastContainer = document.getElementById('toastContainer');


    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        // Define Icon based on type
        let iconMarkup = '<i class="fa-solid fa-circle-check"></i>';
        if (type === 'error') {
            iconMarkup = '<i class="fa-solid fa-circle-exclamation"></i>';
        } else if (type === 'info') {
            iconMarkup = '<i class="fa-solid fa-circle-info"></i>';
        }

        toast.innerHTML = `
            <div class="toast-icon">${iconMarkup}</div>
            <div class="toast-message">${message}</div>
        `;

        toastContainer.appendChild(toast);

        // Trigger Animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400); // wait for exit animation
        }, 3000);
    }

    // =========================================
    // API INTEGRATION & FORM HANDLING
    // =========================================


    // Helper to toggle button loading state
    function setLoading(btn, isLoading, originalText) {
        if (isLoading) {
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
            btn.disabled = true;
        } else {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    // Check if user is already logged in
    const user = JSON.parse(sessionStorage.getItem('nourishUser'));
    if (user) {
        // Also update any "Join Now" or "Donate Food" buttons on the landing page
        const heroActions = document.querySelectorAll('.hero-action a, .action-card button');
        heroActions.forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                // If they are already logged in, redirect them to their portal inside the SPA
                const portal = user.type === 'vendor' || user.type === 'restaurant' ? 'seller' : 'buyer';
                state.activePortal = portal;
                renderPortal();
                updateLiquidIndicator();
            };
        });
    }

    // --- Demo Login Fillers ---
    const btnDemoSeller = document.getElementById('btn-demo-seller');
    const btnDemoBuyer = document.getElementById('btn-demo-buyer');

    if (btnDemoSeller) {
        btnDemoSeller.addEventListener('click', () => {
            const emailInput = document.getElementById('loginEmail');
            const passInput = document.getElementById('loginPassword');
            if (emailInput && passInput) {
                emailInput.value = 'serverdemo@gmail.com';
                passInput.value = 'demo123';
                // Trigger form submission
                loginForm.requestSubmit(); 
            }
        });
    }

    if (btnDemoBuyer) {
        btnDemoBuyer.addEventListener('click', () => {
            const emailInput = document.getElementById('loginEmail');
            const passInput = document.getElementById('loginPassword');
            if (emailInput && passInput) {
                emailInput.value = 'ngodemo@gmail.com';
                passInput.value = 'demo123';
                // Trigger form submission
                loginForm.requestSubmit();
            }
        });
    }

    // -------------------------

    // 1. Login Form Submit
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value.trim();

        if (!email || !password) {
            showToast("Please enter both email and password.", "error");
            return;
        }

        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        setLoading(submitBtn, true, originalText);



        try {
            const response = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                showToast(`Welcome back, ${data.user.name || email}!`);
                
                // Save user and JWT token to localStorage
                sessionStorage.setItem('nourishUser', JSON.stringify(data.user));
                if (data.token) sessionStorage.setItem('nourishToken', data.token);
                
                setTimeout(() => {
                    authModal.classList.remove('active');
                    if (data.user) {
                        const t = (data.user.type || data.user.accountType || data.user.role || '').toLowerCase();
                        state.activePortal = (t === 'restaurant' || t === 'vendor' || t === 'seller') ? 'seller' : 'buyer';
                    }
                    refreshState();
                }, 1000);
            } else {
                showToast(data.error || "Login failed", "error");
            }
        } catch (error) {
            showToast("Network error. Is the server running?", "error");
        } finally {
            setLoading(submitBtn, false, originalText);
        }
    });

    // 2. Registration Form Submit
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const accountType = document.querySelector('input[name="accountType"]:checked').value;
        const organizationName = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value.trim();

        if (!organizationName || !email || !password) {
            showToast("Please fill in all required fields, including a password.", "error");
            return;
        }

        const submitBtn = registerForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        setLoading(submitBtn, true, originalText);

        try {
            const response = await fetch(`${API_BASE}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountType, organizationName, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                showToast("Account created! Logging you in...");
                
                // Server auto-logs in on register — save user + token
                if (data.user) sessionStorage.setItem('nourishUser', JSON.stringify(data.user));
                if (data.token) sessionStorage.setItem('nourishToken', data.token);

                setTimeout(() => {
                    authModal.classList.remove('active');
                    if (data.user) {
                        const t = (data.user.type || data.user.accountType || data.user.role || '').toLowerCase();
                        state.activePortal = (t === 'restaurant' || t === 'vendor' || t === 'seller') ? 'seller' : 'buyer';
                    }
                    refreshState();
                }, 1000);
            } else {
                showToast(data.error || "Registration failed", "error");
            }
        } catch (error) {
            showToast("Network error. Please try again later.", "error");
        } finally {
            setLoading(submitBtn, false, originalText);
        }
    });

    // 3. Contact Form Submit
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const subject = document.getElementById('subject').value;
            const message = document.getElementById('message').value;

            const submitBtn = contactForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;

            setLoading(submitBtn, true, originalText);

            try {
                const response = await fetch(`${API_BASE}/contact`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, subject, message })
                });

                const data = await response.json();

                if (response.ok) {
                    showToast("Message sent successfully! We'll be in touch.", "info");
                    contactForm.reset();
                } else {
                    showToast(data.error || "Failed to send message", "error");
                }
            } catch (error) {
                showToast("Network error. Please try again later.", "error");
            } finally {
                setLoading(submitBtn, false, originalText);
            }
        });
    }

    // =========================================
    // SCROLL-SPY (FOR BOTTOM DOCK)
    // =========================================
    const bottomNavItems = document.querySelectorAll('.bottom-nav .nav-item');
    const sections = document.querySelectorAll('section, header');

    const scrollSpyOptions = {
        rootMargin: '-10% 0px -80% 0px',
        threshold: 0
    };

    const scrollSpyObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                if (!id) return;
                
                bottomNavItems.forEach(item => {
                    item.classList.remove('active');
                    if (item.getAttribute('href') === `#${id}`) {
                        item.classList.add('active');
                    }
                });
            }
        });
    }, scrollSpyOptions);

    sections.forEach(section => scrollSpyObserver.observe(section));

    // =========================================
    // THEME TOGGLE LOGIC (Elite Midnight/Zen)
    // =========================================
    const themeToggle = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;

    if (themeToggle) {
        const themeIcon = themeToggle.querySelector('i');

        // Check for saved theme or default to dark
        const savedTheme = localStorage.getItem('nourishTheme') || 'dark';
        htmlElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme, themeIcon);

        themeToggle.addEventListener('click', () => {
            const currentTheme = htmlElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            htmlElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('nourishTheme', newTheme);
            updateThemeIcon(newTheme, themeIcon);
            
            // Visual feedback
            showToast(`Switched to ${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} Mode`, 'info');
        });
    }

    function updateThemeIcon(theme, icon) {
        if (!icon) return;
        if (theme === 'dark') {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }
    // NN-PORTAL ECOSYSTEM LOGIC (CORE)
    // =========================================

    // 2. Selectors
    const portalsRoot = document.getElementById('nn-portals-root');
    const homePortal = document.getElementById('home-portal');
    const swHome = document.getElementById('sw-home');
    const swSeller = document.getElementById('sw-seller');
    const swBuyer = document.getElementById('sw-buyer');
    const cartToggle = document.getElementById('cart-toggle');
    const cartDrawer = document.getElementById('cart-drawer');
    const closeCart = document.getElementById('close-cart');
    const globalSearch = document.getElementById('global-search');
    const nearMeToggle = document.getElementById('near-me-toggle');

    // Use event delegation globally for modal close buttons to avoid attachment issues
    document.addEventListener('click', (e) => {
        // Cart Close
        if (e.target.closest('#close-cart') && cartDrawer) {
            cartDrawer.classList.remove('active');
        }
    });

    // 3. Portal Switcher Logic
    function initSwitcher() {
        // Wire up logo to go home
        const logo = document.querySelector('.navbar .logo');
        if (logo) {
            logo.addEventListener('click', (e) => {
                e.preventDefault();
                state.activePortal = 'home';
                renderPortal();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
        
        // Wire up Dock Home button
        const dockHome = document.querySelector('.bottom-nav .nav-item[href="#home"]');
        if (dockHome) {
            dockHome.addEventListener('click', (e) => {
                e.preventDefault();
                if (state.activePortal !== 'home') {
                    // Auto-logout when going home from a dashboard
                    if (sessionStorage.getItem('nourishToken')) {
                        logout();
                    } else {
                        state.activePortal = 'home';
                        renderPortal();
                    }
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        // Wire up Dock Add Listing button (Seller)
        const addDockItem = document.getElementById('add-listing-dock');
        if (addDockItem) {
            addDockItem.addEventListener('click', (e) => {
                e.preventDefault();
                const formSection = document.getElementById('add-listing-section');
                if (formSection) {
                    formSection.scrollIntoView({ behavior: 'smooth' });
                    // Highlight the form
                    formSection.style.boxShadow = '0 0 30px var(--primary-color)';
                    setTimeout(() => formSection.style.boxShadow = '', 2000);
                }
            });
        }

        // Wire up Dock Cart button (Buyer)
        const cartDockItem = document.getElementById('cart-toggle-dock');
        if (cartDockItem) {
            cartDockItem.addEventListener('click', (e) => {
                e.preventDefault();
                if (cartDrawer) {
                    cartDrawer.classList.add('active');
                }
            });
        }

        // Handle window resize to keep indicator in sync
        window.addEventListener('resize', updateLiquidIndicator);

        // Start Expiry Countdown Loop
        setInterval(updateAllCountdowns, 1000);
    }

    function updateAllCountdowns() {
        const timerElements = document.querySelectorAll('.nn-expiry-timer');
        timerElements.forEach(el => {
            const expiry = el.dataset.expiry;
            const itemId = el.dataset.id;
            if (!expiry) return;

            const now = new Date().getTime();
            const distance = new Date(expiry).getTime() - now;

            if (distance < 0) {
                el.innerHTML = "00:00:00";
                el.className = "nn-expiry-timer timer-expired";
                const card = el.closest('.nn-food-card');
                if (card && !card.classList.contains('is-expired')) {
                    card.classList.add('is-expired');
                    const btn = card.querySelector('.btn-primary');
                    if (btn) {
                        btn.disabled = true;
                        btn.innerText = "EXPIRED";
                    }
                }
                return;
            }

            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            const timeStr = 
                String(hours).padStart(2, '0') + ":" + 
                String(minutes).padStart(2, '0') + ":" + 
                String(seconds).padStart(2, '0');

            el.innerHTML = timeStr;

            // Update Colors & Animations
            if (distance > 2 * 3600000) { // > 2 hours
                el.className = "nn-expiry-timer timer-safe";
            } else if (distance > 30 * 60000) { // 30m - 2h
                el.className = "nn-expiry-timer timer-warning";
            } else { // < 30m
                el.className = "nn-expiry-timer timer-urgent";
            }
        });
    }

    function updateLiquidIndicator() {
        // Removed as the top pill switcher was replaced by the bottom dock.
    }

    // 4. Rendering Engine
    function renderPortal() {
        syncDock();
        syncPortalSwitcher();
        if (state.activePortal === 'home') {
            if (homePortal) homePortal.style.display = 'block';
            if (portalsRoot) portalsRoot.style.display = 'none';
        } else {
            if (homePortal) homePortal.style.display = 'none';
            if (portalsRoot) {
                portalsRoot.style.display = 'block';
                portalsRoot.classList.remove('portal-reveal');
                void portalsRoot.offsetWidth; // Trigger reflow
                portalsRoot.classList.add('portal-reveal');
            }
            if (state.activePortal === 'seller') {
                renderSellerPortal();
            } else if (state.activePortal === 'buyer') {
                renderBuyerPortal();
            }
        }
    }

    function syncDock() {
        // --- Login/Logout text ---
        const loginTextDock = document.getElementById('login-text-dock');
        const loginIconDock = document.querySelector('#login-toggle-dock i');
        const userToken = sessionStorage.getItem('nourishToken');
        const navProfileBtn = document.getElementById('nav-profile-btn');
        const navAvatarImg = document.getElementById('nav-avatar-img');

        if (userToken) {
            if (loginTextDock) loginTextDock.innerText = 'Logout';
            if (loginIconDock) { loginIconDock.classList.remove('fa-user'); loginIconDock.classList.add('fa-right-from-bracket'); }
            // Show avatar in navbar
            if (navProfileBtn) navProfileBtn.style.display = 'flex';
            // Update avatar src from session
            const user = JSON.parse(sessionStorage.getItem('nourishUser') || '{}');
            if (navAvatarImg && user.avatarUrl) navAvatarImg.src = user.avatarUrl;
            else if (navAvatarImg && user.id) navAvatarImg.src = `https://i.pravatar.cc/150?u=${user.id}`;
        } else {
            if (loginTextDock) loginTextDock.innerText = 'Login';
            if (loginIconDock) { loginIconDock.classList.remove('fa-right-from-bracket'); loginIconDock.classList.add('fa-user'); }
            // Hide avatar in navbar
            if (navProfileBtn) navProfileBtn.style.display = 'none';
        }

        // --- Always keep the dock visible ---
        const bottomNav = document.querySelector('.bottom-nav');
        if (bottomNav) {
            bottomNav.style.cssText += '; display: block !important; opacity: 1 !important; visibility: visible !important;';
        }

        // --- Show/hide dock items based on portal ---
        // IDs from index.html: cart-toggle-dock (buyer), add-listing-dock (seller)
        const cartDockItem  = document.getElementById('cart-toggle-dock');
        const addDockItem   = document.getElementById('add-listing-dock');
        const loginDockItem = document.getElementById('login-toggle-dock');
        const settingsDockItem = document.getElementById('settings-toggle-dock');
        const settingsNavItem = document.getElementById('settings-toggle-nav');
        const landingItems  = document.querySelectorAll('.landing-only');

        if (state.activePortal === 'buyer') {
            landingItems.forEach(el => el.style.setProperty('display', 'none', 'important'));
            if (cartDockItem)  cartDockItem.style.setProperty('display', 'flex', 'important');
            if (addDockItem)   addDockItem.style.setProperty('display', 'none', 'important');
            if (settingsDockItem) settingsDockItem.style.setProperty('display', 'flex', 'important');
            if (loginDockItem) loginDockItem.style.setProperty('display', 'flex', 'important');
        } else if (state.activePortal === 'seller') {
            landingItems.forEach(el => el.style.setProperty('display', 'none', 'important'));
            if (cartDockItem)  cartDockItem.style.setProperty('display', 'none', 'important');
            if (addDockItem)   addDockItem.style.setProperty('display', 'flex', 'important');
            if (settingsDockItem) settingsDockItem.style.setProperty('display', 'flex', 'important');
            if (loginDockItem) loginDockItem.style.setProperty('display', 'flex', 'important');
        } else {
            landingItems.forEach(el => el.style.setProperty('display', 'flex', 'important'));
            if (cartDockItem)  cartDockItem.style.setProperty('display', 'none', 'important');
            if (addDockItem)   addDockItem.style.setProperty('display', 'none', 'important');
            if (settingsDockItem) settingsDockItem.style.setProperty('display', 'none', 'important');
            if (loginDockItem) loginDockItem.style.setProperty('display', 'flex', 'important');
        }
    }

    function syncPortalSwitcher() {
        // Removed as the top pill switcher was replaced by the bottom dock.
    }

    function logout() {
        sessionStorage.removeItem('nourishUser');
        sessionStorage.removeItem('nourishToken');
        state.activePortal = 'home';
        state.cart = [];
        renderPortal();
        updateLiquidIndicator();
        syncDock();
        showToast("Logged out successfully.", "info");
    }


    function renderSellerPortal() {
        const user = JSON.parse(sessionStorage.getItem('nourishUser') || '{}');
        const sellerListings = state.listings.filter(l => l.vendorId == user.id);

        let totalMealsDonated = 0;
        sellerListings.forEach(item => { totalMealsDonated += parseFloat(item.qty) || 0; });
        
        let badgeName = 'Member';
        let badgeClass = 'badge-member';
        if (totalMealsDonated >= 500) { badgeName = 'Platinum Elite'; badgeClass = 'badge-platinum'; }
        else if (totalMealsDonated >= 100) { badgeName = 'Gold'; badgeClass = 'badge-gold'; }
        else if (totalMealsDonated >= 50) { badgeName = 'Silver Partner'; badgeClass = 'badge-silver'; }

        portalsRoot.innerHTML = `
            <div class="portal-wrapper" style="padding-top: 80px; min-height: 100vh;">

                <div class="container" style="max-width: 1300px; margin: 0 auto; padding: 1.5rem 2rem 3rem;">

                    <h1 class="seller-page-title" style="display: flex; align-items: center; gap: 20px;">
                        <span class="premium-title">SELLER'S DASHBOARD</span>
                    </h1>

                    <!-- Zone B: My Listed Foods -->

                    <!-- Zone B: My Listed Foods -->
                    <div class="seller-listings-header">
                        <h2>LISTINGS</h2>
                        <span class="listings-count-badge">${state.listings.length} items</span>
                    </div>
                    <div class="items-grid" id="my-listings-container" style="margin-bottom: 4rem;">
                        <!-- Listings will render here -->
                    </div>

                    <!-- Zone A: Add Food Panel -->
                    <div class="seller-form-card" id="add-listing-section">
                        <div class="seller-form-header">
                            <h3>NEW LISTING</h3>
                        </div>
                        <form id="add-food-form" class="add-food-grid">
                            <input type="hidden" id="p-id" value="">
                            <div class="form-group">
                                <label>Food Name</label>
                                <input type="text" id="p-name" class="form-control" placeholder="e.g. Idli & Sambar" required>
                            </div>
                            <div class="form-group">
                                <label>Category</label>
                                <select id="p-cat" class="form-control">
                                    <option>Cooked</option><option>Packaged</option><option>Produce</option>
                                    <option>Bakery</option><option>Beverages</option><option>Desserts</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Quantity (Portions)</label>
                                <input type="number" id="p-qty" class="form-control" value="10" min="1" required>
                            </div>
                            <div class="form-group">
                                <label>Price per Portion (₹)</label>
                                <input type="number" id="p-price" class="form-control" value="20" min="0" required>
                            </div>
                            <div class="form-group">
                                <label>Expiry Date & Time</label>
                                <input type="datetime-local" id="p-expiry" class="form-control" required>
                            </div>
                            <div class="form-group full-width">
                                <label>Short Description</label>
                                <textarea id="p-desc" class="form-control" rows="2" placeholder="Describe the food freshness, ingredients, etc..."></textarea>
                            </div>

                            <div class="full-width" style="display:flex; gap: 10px;">
                                <button type="submit" id="submit-btn" class="nn-publish-btn"><i class="fa-solid fa-leaf"></i> Publish Listing</button>
                                <button type="button" id="cancel-edit-btn" class="nn-cancel-btn" style="display:none;"><i class="fa-solid fa-xmark"></i> Cancel Edit</button>
                            </div>
                        </form>
                    </div>

                    <!-- Community Feedback -->
                    <div class="seller-form-card" style="margin-top: 4rem;">
                        <div class="seller-form-header">
                            <h3>SHARE A THOUGHT</h3>
                        </div>
                        <form id="portal-comment-form" class="nn-form">
                            <div class="form-group">
                                <label>Your Experience</label>
                                <textarea id="portal-comment-text" class="form-control" rows="2" placeholder="How was your experience today?" required></textarea>
                            </div>
                            <button type="submit" class="nn-publish-btn" style="width: 100%;">Share with Community <i class="fa-solid fa-paper-plane"></i></button>
                        </form>
                    </div>

                </div>
            </div>
        `;
        renderSellerListings();
        attachSellerListeners();
        attachPortalCommentListeners();
        initImpactChart();
    }

    function renderSellerListings() {
        const container = document.getElementById('my-listings-container');
        if (!container) return;

        const user = JSON.parse(sessionStorage.getItem('nourishUser'));
        if (!user) return;

        // Filter to show only THIS seller's items
        const myItems = state.listings.filter(l => l.vendorId == user.id);

        if (myItems.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; padding: 4rem; text-align: center; background: var(--bg-card); border-radius: 20px; border: 1px dashed var(--border-glow);">
                    <i class="fa-solid fa-utensils" style="font-size: 3rem; color: var(--accent-primary); opacity: 0.5; margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-muted);">You haven't listed any food yet. Use the form below to start rescuing!</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = myItems.map((item, idx) => `
            <div class="nn-food-card stagger-item ${item.qty <= 0 ? 'is-sold-out' : ''} ${new Date(item.expiry) < new Date() ? 'is-expired' : ''}" data-id="${item.id}" style="animation-delay: ${idx * 0.05}s">
                <div class="nn-card-img-wrap">
                    <img src="${item.img}" alt="${item.name}" loading="lazy">
                    <div class="nn-card-img-overlay"></div>
                    <div class="nn-card-badges">
                        <span class="nn-badge nn-badge-cat">${item.category}</span>
                        <span class="nn-badge nn-badge-qty ${item.qty <= 0 ? 'nn-badge-sold' : ''}"><i class="fa-solid fa-utensils"></i> ${item.qty <= 0 ? 'Sold Out' : item.qty + ' left'}</span>
                    </div>
                    <div class="nn-card-vendor"><i class="fa-solid fa-store"></i> ${item.vendorName}</div>
                </div>
                <div class="nn-expiry-container">
                    <span class="nn-expiry-label">Expires in:</span>
                    <div class="nn-expiry-timer" data-expiry="${item.expiry}" data-id="${item.id}">--:--:--</div>
                </div>
                <div class="nn-card-body">
                    <h3 class="nn-card-title">${item.name}</h3>
                    <p class="nn-card-desc">${item.description || 'No description provided.'}</p>
                    <div class="nn-card-meta">
                        <div class="nn-card-price">₹${item.price}<span>/portion</span></div>
                        <div class="nn-card-expiry"><i class="fa-regular fa-clock"></i> ${new Date(item.expiry).toLocaleDateString('en-IN', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}</div>
                    </div>
                </div>
                <div class="nn-card-footer">
                    <button class="nn-action-btn nn-edit-btn edit-btn" data-id="${item.id}"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                    <button class="nn-action-btn nn-delete-btn delete-btn" data-id="${item.id}"><i class="fa-solid fa-trash-can"></i> Delete</button>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.dataset.id;
                const item = state.listings.find(l => l.id == id);
                if (item) {
                    document.getElementById('p-id').value = item.id;
                    document.getElementById('p-name').value = item.name;
                    document.getElementById('p-cat').value = item.category;
                    document.getElementById('p-qty').value = item.qty;
                    document.getElementById('p-price').value = item.price;
                    document.getElementById('p-desc').value = item.description || '';
                    if (item.expiry) {
                        try {
                            const d = new Date(item.expiry);
                            document.getElementById('p-expiry').value = d.toISOString().slice(0, 16);
                        } catch(e) {}
                    }
                    document.getElementById('submit-btn').innerHTML = '💾 Save Changes';
                    document.getElementById('cancel-edit-btn').style.display = 'block';
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (!confirm("Are you sure you want to delete this listing?")) return;

                const token = sessionStorage.getItem('nourishToken');
                if (!token) return;

                try {
                    const response = await fetch(`${API_BASE}/listings/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (response.ok) {
                        showToast("Listing deleted successfully.");
                        refreshState();
                    } else {
                        const data = await response.json();
                        showToast(data.error || "Delete failed", "error");
                    }
                } catch (err) {
                    showToast("Network error.", "error");
                }
            });
        });
    }

    function renderBuyerPortal() {
        portalsRoot.innerHTML = `
            <div class="buyer-portal-layout animate-reveal" style="padding-top: 120px;">
                <div class="container" style="max-width: 1300px; margin: 0 auto;">
                    <h1 class="seller-page-title"><span class="premium-title">BUYER'S DASHBOARD</span></h1>
                    <p style="margin-bottom: 3rem; color: var(--text-muted); font-size: 1.1rem;">Fresh, freshly prepared meals from local restaurants — ready for you to claim.</p>

                    <div class="items-grid" id="exchange-grid">
                        <!-- Cards will render here -->
                    </div>

                    <!-- Community Feedback -->
                    <div class="seller-form-card" style="margin-top: 4rem;">
                        <div class="seller-form-header">
                            <h3>SHARE A THOUGHT</h3>
                        </div>
                        <form id="portal-comment-form" class="nn-form">
                            <div class="form-group">
                                <label>Your Experience</label>
                                <textarea id="portal-comment-text" class="form-control" rows="2" placeholder="How was your experience today?" required></textarea>
                            </div>
                            <button type="submit" class="nn-publish-btn" style="width: 100%;">Share with Community <i class="fa-solid fa-paper-plane"></i></button>
                        </form>
                    </div>
                </div>
            </div>
        `;
        renderExchangeGrid();
        attachPortalCommentListeners();
    }

    function renderExchangeGrid() {
        const grid = document.getElementById('exchange-grid');
        if (!grid) return;

        grid.innerHTML = state.listings.map((item, idx) => {
            const avatarImg = item.vendorAvatar ? item.vendorAvatar : `https://i.pravatar.cc/150?u=${item.vendorId || item.id}`;
            const bioText = item.vendorBio ? `<div style="font-size: 0.75rem; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${item.vendorBio}</div>` : '';

            return `
            <div class="nn-food-card stagger-item ${item.qty <= 0 ? 'is-sold-out' : ''} ${new Date(item.expiry) < new Date() ? 'is-expired' : ''}" data-id="${item.id}" style="animation-delay: ${idx * 0.05}s">
                ${item.qty <= 0 ? '<div class="nn-sold-out-badge"><i class="fa-solid fa-ban"></i> Sold Out</div>' : ''}
                <div class="nn-card-img-wrap">
                    <img src="${item.img}" alt="${item.name}" loading="lazy">
                    <div class="nn-card-img-overlay"></div>
                    <div class="nn-card-badges">
                        <span class="nn-badge nn-badge-cat">${item.category}</span>
                        <span class="nn-badge nn-badge-qty ${item.qty <= 5 && item.qty > 0 ? 'nn-badge-low' : ''}"><i class="fa-solid fa-utensils"></i> ${item.qty} left</span>
                    </div>
                    <div class="nn-card-vendor" style="display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.6); padding: 5px 10px; border-radius: 20px;">
                        <img src="${avatarImg}" style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--border-glow); object-fit: cover;">
                        <div style="display: flex; flex-direction: column; text-align: left;">
                            <div style="display: flex; align-items: center; gap: 5px;">
                                <strong style="font-size: 0.85rem; color: white;">${item.vendorName}</strong>
                                ${item.isVerified ? '<i class="fa-solid fa-circle-check" style="color: #fbbf24; font-size: 0.7rem;" title="Verified Partner"></i>' : ''}
                            </div>
                            ${item.fssaiCode ? `<div style="font-size: 0.65rem; color: #10b981; font-weight: bold;">FSSAI: ${item.fssaiCode}</div>` : bioText}
                        </div>
                    </div>
                </div>
                <div class="nn-expiry-container">
                    <span class="nn-expiry-label">Expires in:</span>
                    <div class="nn-expiry-timer" data-expiry="${item.expiry}" data-id="${item.id}">--:--:--</div>
                </div>
                <div class="nn-card-body">
                    <h3 class="nn-card-title">${item.name}</h3>
                    <p class="nn-card-desc">${item.description || ''}</p>
                    <div class="nn-card-meta">
                        <div class="nn-card-price">₹${item.price}<span>/portion</span></div>
                        <div class="nn-card-expiry"><i class="fa-regular fa-clock"></i> ${new Date(item.expiry).toLocaleDateString('en-IN', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}</div>
                    </div>
                </div>
                <div class="nn-card-footer nn-card-footer-buyer">
                    <div class="nn-stepper">
                        <button class="nn-step-btn stepper-btn minus" data-id="${item.id}"><i class="fa-solid fa-minus"></i></button>
                        <span class="nn-step-val stepper-val" id="stepper-${item.id}">1</span>
                        <button class="nn-step-btn stepper-btn plus" data-id="${item.id}"><i class="fa-solid fa-plus"></i></button>
                    </div>
                    <button class="nn-add-btn add-btn" data-id="${item.id}" ${item.qty <= 0 ? 'disabled' : ''}>
                        <i class="fa-solid fa-cart-plus"></i> Add to Basket
                    </button>
                </div>
            </div>
            `;
        }).join('');
        
        attachBuyerListeners();
    }

    // 5. Cart & Basket Logic
    function attachBuyerListeners() {
        document.querySelectorAll('.stepper-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.dataset.id;
                const span = document.getElementById(`stepper-${id}`);
                let val = parseInt(span.innerText);
                const item = state.listings.find(l => l.id == id);
                if (btn.classList.contains('plus')) {
                    if (val < item.qty) val++;
                } else {
                    if (val > 1) val--;
                }
                span.innerText = val;
            });
        });

        document.querySelectorAll('.add-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.dataset.id;
                const item = state.listings.find(l => l.id == id);
                const qtyToAdd = parseInt(document.getElementById(`stepper-${id}`).innerText);
                
                if (item && item.qty >= qtyToAdd) {
                    addToCart(item, qtyToAdd, e);
                }
            });
        });
    }

    function addToCart(item, qtyToAdd, e) {
        item.qty -= qtyToAdd; // reduce live portions
        
        const existingCartItem = state.cart.find(c => c.item.id === item.id);
        if (existingCartItem) {
            existingCartItem.qty += qtyToAdd;
        } else {
            state.cart.push({ item: item, qty: qtyToAdd });
        }
        
        updateCartBadge();
        renderExchangeGrid();
        
        // Fly Animation
        const rect = e.target.getBoundingClientRect();
        const flyItem = document.createElement('div');
        flyItem.className = 'flying-item';
        flyItem.style.left = rect.left + 'px';
        flyItem.style.top = rect.top + 'px';
        document.body.appendChild(flyItem);

        const flyTarget = cartToggle || document.getElementById('cart-toggle-dock') || document.body;
        const target = flyTarget.getBoundingClientRect();
        
        flyItem.animate([
            { left: rect.left + 'px', top: rect.top + 'px', transform: 'scale(1)' },
            { left: target.left + 'px', top: target.top + 'px', transform: 'scale(0.1)' }
        ], {
            duration: 800,
            easing: 'cubic-bezier(0.165, 0.84, 0.44, 1)'
        }).onfinish = () => flyItem.remove();

        showToast(`${qtyToAdd} portions of ${item.name} added to your basket!`, 'success');
        renderCartItems();
    }

    function updateCartBadge() {
        const counts = document.querySelectorAll('.cart-count');
        const totalItems = state.cart.reduce((sum, c) => sum + c.qty, 0);
        counts.forEach(c => c.innerText = totalItems);
    }

    function renderCartItems() {
        const list = document.getElementById('cart-items-list');
        if (!list) return;

        if (state.cart.length === 0) {
            list.innerHTML = '<div class="empty-cart-msg">Your basket is empty. 🌱</div>';
            updateCartTotals();
            return;
        }

        list.innerHTML = state.cart.map((cartItem, idx) => `
            <div class="cart-item-row" style="display:flex; justify-content:space-between; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-glow);">
                <div>
                    <strong>${cartItem.item.name}</strong><br>
                    <small>${cartItem.item.vendorName}</small><br>
                    <div class="stepper-wrap" style="display:flex; align-items:center; gap: 10px; margin-top: 5px;">
                        <button class="cart-minus btn-outline btn-sm" data-idx="${idx}" style="padding: 2px 8px; color: var(--text-color); border-color: var(--border-glow);"><i class="fa-solid fa-minus"></i></button>
                        <span style="font-weight: bold;">${cartItem.qty}</span>
                        <button class="cart-plus btn-outline btn-sm" data-idx="${idx}" style="padding: 2px 8px; color: var(--text-color); border-color: var(--border-glow);"><i class="fa-solid fa-plus"></i></button>
                    </div>
                </div>
                <div style="text-align: right; display: flex; flex-direction: column; justify-content: space-between;">
                    <strong>₹${cartItem.item.price * cartItem.qty}</strong>
                    <button class="remove-item" data-idx="${idx}" style="background:none; border:none; color:#e74c3c; cursor:pointer; margin-top: 5px;"><i class="fa-solid fa-trash"></i> Remove</button>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.cart-minus').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = btn.dataset.idx;
                const cartItem = state.cart[idx];
                if (cartItem.qty > 1) {
                    cartItem.qty--;
                    const originalListing = state.listings.find(l => l.id === cartItem.item.id);
                    if (originalListing) originalListing.qty++;
                } else {
                    const removedCartItem = state.cart.splice(idx, 1)[0];
                    const originalListing = state.listings.find(l => l.id === removedCartItem.item.id);
                    if (originalListing) originalListing.qty += removedCartItem.qty;
                }
                renderCartItems();
                updateCartBadge();
                renderExchangeGrid();
            });
        });

        document.querySelectorAll('.cart-plus').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = btn.dataset.idx;
                const cartItem = state.cart[idx];
                const originalListing = state.listings.find(l => l.id === cartItem.item.id);
                if (originalListing && originalListing.qty > 0) {
                    cartItem.qty++;
                    originalListing.qty--;
                    renderCartItems();
                    updateCartBadge();
                    renderExchangeGrid();
                } else {
                    showToast("No more portions available!", "error");
                }
            });
        });

        document.querySelectorAll('.remove-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = btn.dataset.idx;
                const removedCartItem = state.cart.splice(idx, 1)[0];
                const originalListing = state.listings.find(l => l.id === removedCartItem.item.id);
                if (originalListing) {
                    originalListing.qty += removedCartItem.qty;
                }
                
                renderCartItems();
                updateCartBadge();
                renderExchangeGrid();
            });
        });

        updateCartTotals();
    }

    function updateCartTotals() {
        const subtotal = state.cart.reduce((sum, c) => sum + (c.item.price * c.qty), 0);
        document.getElementById('cart-subtotal').innerText = `₹${subtotal}`;
        document.getElementById('cart-total').innerText = `₹${subtotal}`;
    }

    // 6. Form Handling (Seller)
    function attachSellerListeners() {
        const form = document.getElementById('add-food-form');
        const cancelBtn = document.getElementById('cancel-edit-btn');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                form.reset();
                document.getElementById('p-id').value = '';
                document.getElementById('submit-btn').innerHTML = '<i class="fa-solid fa-leaf"></i> Publish Listing';
                cancelBtn.style.display = 'none';
            });
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const pId = document.getElementById('p-id').value;
                const name = document.getElementById('p-name').value;
                const category = document.getElementById('p-cat').value;
                const qty = document.getElementById('p-qty').value;
                const price = document.getElementById('p-price').value;
                const description = document.getElementById('p-desc').value;
                const expiry = document.getElementById('p-expiry').value;

                const token = sessionStorage.getItem('nourishToken');
                if (!token) {
                    showToast("Please login to publish your listing.", "info");
                    const authModal = document.getElementById('authModal');
                    if (authModal) authModal.classList.add('active');
                    return;
                }

                const payload = {
                    name, category, quantity: parseInt(qty), 
                    price: parseFloat(price), description,
                    expiryTime: expiry ? new Date(expiry).toISOString() : null
                };

                try {
                    let response;
                    if (pId) {
                        // UPDATE
                        response = await fetch(`${API_BASE}/listings/${pId}`, {
                            method: 'PUT',
                            headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify(payload)
                        });
                    } else {
                        // CREATE
                        response = await fetch(`${API_BASE}/listings`, {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify(payload)
                        });
                    }

                    const data = await response.json();
                    if (response.ok) {
                        showToast(pId ? "Listing updated! 🌱" : "Published successfully! 🌱", "success");
                        form.reset();
                        document.getElementById('p-id').value = '';
                        document.getElementById('submit-btn').innerHTML = '<i class="fa-solid fa-leaf"></i> Publish Listing';
                        if(cancelBtn) cancelBtn.style.display = 'none';
                        refreshState(); // Refresh everything
                    } else {
                        showToast(data.error || "Operation failed", "error");
                    }
                } catch (err) {
                    showToast("Network error while publishing.", "error");
                }
            });
        }
    }




    // 7. Initialize Everything

    
    const openCart = () => cartDrawer.classList.add('active');
    
    cartToggle.addEventListener('click', openCart);
    // Dock Portal-Specific Listeners
    const cartToggleDock = document.getElementById('cart-toggle-dock');
    if (cartToggleDock) {
        cartToggleDock.addEventListener('click', (e) => {
            e.preventDefault();
            openCart();
        });
    }

    const addListingDock = document.getElementById('add-listing-dock');
    if (addListingDock) {
        addListingDock.addEventListener('click', (e) => {
            e.preventDefault();
            const section = document.getElementById('add-listing-section');
            if (section) {
                section.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                state.activePortal = 'seller';
                renderPortal();
                setTimeout(() => {
                    document.getElementById('add-listing-section')?.scrollIntoView({ behavior: 'smooth' });
                }, 500);
            }
        });
    }



    
    // Community Hub / Comments Logic
    function renderCommunityWall() {
        const wall = document.getElementById('comment-list');
        if (!wall) return;
        
        // We only show the latest 10 comments in the wall
        wall.innerHTML = state.communityComments.slice().reverse().map((c, idx) => `
            <div class="comment-bubble" style="animation-delay: ${idx * 0.1}s;">
                <strong style="color: ${c.org.includes('Seller') || c.org.includes('Hotel') ? 'var(--accent-secondary)' : 'var(--accent-primary)'};">
                    ${c.name} <span style="font-weight: 400; opacity: 0.6; font-size: 0.8rem;">• ${c.org}</span>
                </strong>
                <p>"${c.text}"</p>
            </div>
        `).join('');
    }

    // Portal Specific Comments
    function renderPortalComments() {
        const wall = document.getElementById('portal-comments-list');
        if (!wall) return;
        
        wall.innerHTML = state.communityComments.slice().reverse().map(c => `
            <div class="comment-item" style="border-bottom: 1px solid var(--border-glow); padding-bottom: 1rem; margin-bottom: 1rem;">
                <strong style="color: ${c.org.includes('Seller') || c.org.includes('Hotel') ? 'var(--accent-secondary)' : 'var(--accent-primary)'};">${c.name} (${c.org})</strong>
                <p style="font-size: 0.9rem; margin-top: 0.5rem; color: var(--text-muted);">${c.text}</p>
            </div>
        `).join('');
    }

    function attachPortalCommentListeners() {
        const form = document.getElementById('portal-comment-form');
        const input = document.getElementById('portal-comment-text');
        if (!form || !input) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const token = sessionStorage.getItem('nourishToken');
            if (!token) {
                showToast("Please login to share your thoughts.", "info");
                showLoginForm();
                return;
            }

            const text = input.value.trim();
            if (!text) return;

            const isSeller = state.activePortal === 'seller';
            const role = isSeller ? 'Premium Vendor' : 'Community Partner';
            const orgName = isSeller ? 'Seller Dashboard' : 'NGO / Recipient';
            
            state.communityComments.push({
                name: role,
                org: orgName,
                text: text,
                stars: 5,
                img: `https://i.pravatar.cc/100?img=${Math.floor(Math.random() * 70)}`
            });

            renderCommunityWall();
            renderReviewsSlider();
            
            input.value = '';
            showToast("Your thoughts have been shared with the community!", "success");
        });
    }

    const commentForm = document.getElementById('comment-form');
    const commentText = document.getElementById('comment-text');

    if (commentForm) {
        commentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = commentText.value.trim();
            if (!text) return;

            const isSeller = state.activePortal === 'seller';
            const role = isSeller ? 'Premium Vendor' : 'Community Partner';
            const orgName = isSeller ? 'Seller Dashboard' : 'NGO / Recipient';
            
            // Add to state
            state.communityComments.push({
                name: role,
                org: orgName,
                text: text,
                stars: 5,
                img: `https://i.pravatar.cc/100?img=${Math.floor(Math.random() * 70)}`
            });

            // Re-render both parts
            renderCommunityWall();
            renderReviewsSlider();
            
            commentText.value = '';
            showToast("Your thoughts have been shared with the community!", "success");
        });
    }
    
    // Initial render for the wall if it exists
    renderCommunityWall();


    
    closeCart.addEventListener('click', () => cartDrawer.classList.remove('active'));
    document.querySelector('.cart-drawer-overlay').addEventListener('click', () => cartDrawer.classList.remove('active'));

    document.getElementById('confirm-claim').addEventListener('click', async () => {
        if (state.cart.length === 0) {
            showToast("Basket is empty!", "error");
            return;
        }

        const token = sessionStorage.getItem('nourishToken');
        if (!token) {
            showToast("Please login to place an order.", "info");
            showLoginForm();
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/checkout`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    items: state.cart.map(c => ({ 
                        listingId: c.item.id, 
                        quantity: c.qty,
                        price: c.item.price 
                    })),
                    notes: "Nourish Network Web Claim"
                })
            });

            const data = await response.json();

            if (response.ok) {
                showToast(data.message || "Order confirmed! 🌱", "success");
                state.cart = [];
                updateCartBadge();
                renderCartItems();
                cartDrawer.classList.remove('active');
                refreshState(); // Refresh to show sold items
            } else {
                showToast(data.error || "Checkout failed", "error");
            }
        } catch (error) {
            showToast("Connection error during checkout.", "error");
        }
    });

    // --- BOOTSTRAP APP ---
    initSwitcher();
    renderReviewsSlider();
    renderCommunityWall();
    updateCartBadge();
    initImpactMap();
    checkSession();

    // Real-time silent polling every 5 seconds
    setInterval(() => refreshState(true), 5000);

    // --- IMPACT MAP ENGINE ---
    let impactMap = null;
    let impactLayer = null;

    function initImpactMap() {
        const mapContainer = document.getElementById('impact-map');
        if (!mapContainer) return;

        // Initialize map centered on a hub (e.g., Chennai)
        impactMap = L.map('impact-map', {
            scrollWheelZoom: false,
            zoomControl: false
        }).setView([13.0827, 80.2707], 12);

        L.control.zoom({ position: 'bottomright' }).addTo(impactMap);

        // Dark Mode Map Layer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap'
        }).addTo(impactMap);

        impactLayer = L.layerGroup().addTo(impactMap);
    }

    function getCoords(id, baseLat, baseLng, offset = 0.05) {
        // pseudo-random but consistent coordinate generation based on ID
        const seed = id * 12345.6789;
        const latOff = (Math.sin(seed) * offset);
        const lngOff = (Math.cos(seed) * offset);
        return [baseLat + latOff, baseLng + lngOff];
    }

    window.renderImpactMap = function() {
        if (!impactLayer) return;
        impactLayer.clearLayers();

        const baseCoords = [13.0827, 80.2707];
        const drawnVendors = new Set();
        const drawnBuyers = new Set();

        // Main Hub
        const hubIcon = L.divIcon({
            className: 'custom-map-marker',
            html: `<div style="background: #f1c40f; width: 14px; height: 14px; border-radius: 50%; box-shadow: 0 0 20px #f1c40f;"></div>`,
            iconSize: [14, 14]
        });
        L.marker(baseCoords, { icon: hubIcon }).addTo(impactLayer).bindPopup(`<strong>Main Hub</strong><br>Chennai`);

        state.listings.forEach(listing => {
            const vendorId = listing.vendorId || 1;
            const vendorPos = getCoords(vendorId, baseCoords[0], baseCoords[1], 0.08);

            if (!drawnVendors.has(vendorId)) {
                drawnVendors.add(vendorId);
                const vIcon = L.divIcon({
                    className: 'custom-map-marker',
                    html: `<div style="background: #10b981; width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 15px #10b981;"></div>`,
                    iconSize: [12, 12]
                });
                L.marker(vendorPos, { icon: vIcon }).addTo(impactLayer).bindPopup(`<strong>${listing.vendorName || 'Food Vendor'}</strong><br>SELLER`);
            }

            if (listing.status === 'claimed' || listing.status === 'sold') {
                const buyerId = listing.claimedBy || (vendorId + 100); // fallback
                const buyerPos = getCoords(buyerId, baseCoords[0], baseCoords[1], 0.1);

                if (!drawnBuyers.has(buyerId)) {
                    drawnBuyers.add(buyerId);
                    const bIcon = L.divIcon({
                        className: 'custom-map-marker',
                        html: `<div style="background: #3498db; width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 15px #3498db;"></div>`,
                        iconSize: [12, 12]
                    });
                    L.marker(buyerPos, { icon: bIcon }).addTo(impactLayer).bindPopup(`<strong>NGO Partner</strong><br>BUYER`);
                }

                // Draw path
                L.polyline([vendorPos, buyerPos], {
                    color: '#10b981',
                    weight: 2,
                    opacity: 0.5,
                    dashArray: '5, 10',
                    lineJoin: 'round'
                }).addTo(impactLayer);
            }
        });
    }

    function initImpactChart() {
        const ctx = document.getElementById('impactChart');
        if (!ctx || !window.Chart) return;

        const user = JSON.parse(sessionStorage.getItem('nourishUser') || '{}');
        const sellerListings = state.listings.filter(l => l.vendorId == user.id);

        // Group data by date
        const dateData = {};
        const chronListings = [...sellerListings].reverse(); 
        chronListings.forEach(item => {
            const dateObj = new Date(item.datePosted || Date.now());
            const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const qty = parseFloat(item.qty) || 0;
            dateData[dateStr] = (dateData[dateStr] || 0) + qty;
        });
        
        const labels = Object.keys(dateData);
        const data = Object.values(dateData);

        if (window.impactChartInstance) window.impactChartInstance.destroy();
        window.impactChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.length ? labels : ['Today'],
                datasets: [{
                    label: 'Meals Saved',
                    data: data.length ? data : [0],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#10b981'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // =========================================
    // SETTINGS / PROFILE MODAL LOGIC
    // =========================================
    window.openSettings = function() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.style.display = 'flex';
            // Role-specific field visibility
            const fssaiWrap = document.getElementById('fssaiFieldWrap');
            const subtitle = modal.querySelector('p');
            const isSeller = state.activePortal === 'seller';
            if (fssaiWrap) fssaiWrap.style.display = isSeller ? 'block' : 'none';
            if (subtitle) subtitle.textContent = isSeller 
                ? "Manage your restaurant's profile, compliance & pickup details"
                : "Manage your NGO's profile and pickup details";
            document.dispatchEvent(new CustomEvent('load-profile-data'));
        }
    };

    function attachSettingsListeners() {
        const settingsToggle = document.getElementById('settings-toggle-dock');
        const settingsModal = document.getElementById('settingsModal');
        const closeSettingsModal = document.getElementById('closeSettingsModal');
        const settingsForm = document.getElementById('settingsForm');
        const bioInput = document.getElementById('bioInput');
        const locationInput = document.getElementById('locationInput');
        const contactPersonInput = document.getElementById('contactPersonInput');
        const publicPhoneInput = document.getElementById('publicPhoneInput');
        const websiteInput = document.getElementById('websiteInput');
        const fssaiInput = document.getElementById('fssaiInput');
        const pickupWindowInput = document.getElementById('pickupWindowInput');
        const pickupInstructionsInput = document.getElementById('pickupInstructionsInput');
        const verificationBadge = document.getElementById('verificationBadgeContainer');
        const avatarInput = document.getElementById('avatarInput');
        const avatarPreview = document.getElementById('avatarPreview');

        if (!settingsModal) return;

        async function loadProfile() {
            try {
                const token = sessionStorage.getItem('nourishToken');
                const res = await fetch(`${API_BASE}/user/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const profile = await res.json();
                    if (bioInput) bioInput.value = profile.bio || '';
                    if (locationInput) locationInput.value = profile.address || '';
                    if (contactPersonInput) contactPersonInput.value = profile.contactPerson || '';
                    if (publicPhoneInput) publicPhoneInput.value = profile.publicPhone || '';
                    if (websiteInput) websiteInput.value = profile.website || '';
                    if (fssaiInput) fssaiInput.value = profile.fssaiCode || '';
                    if (pickupWindowInput) pickupWindowInput.value = profile.pickupWindow || '';
                    if (pickupInstructionsInput) pickupInstructionsInput.value = profile.pickupInstructions || '';
                    
                    if (verificationBadge) {
                        verificationBadge.style.display = profile.isVerified ? 'block' : 'none';
                    }

                    if (profile.avatarUrl && avatarPreview) {
                        avatarPreview.src = profile.avatarUrl;
                    }
                    // Update the sessionStorage copy too just in case
                    sessionStorage.setItem('nourishUser', JSON.stringify({
                        ...JSON.parse(sessionStorage.getItem('nourishUser') || '{}'),
                        bio: profile.bio,
                        address: profile.address,
                        avatarUrl: profile.avatarUrl,
                        contactPerson: profile.contactPerson,
                        publicPhone: profile.publicPhone,
                        website: profile.website,
                        fssaiCode: profile.fssaiCode,
                        pickupWindow: profile.pickupWindow,
                        pickupInstructions: profile.pickupInstructions,
                        isVerified: profile.isVerified
                    }));
                }
            } catch (e) { console.error(e); }
        }

        const settingsToggleDock = document.getElementById('settings-toggle-dock');
        const settingsToggleNav = document.getElementById('settings-toggle-nav');

        if (settingsToggleDock) {
            settingsToggleDock.onclick = (e) => {
                e.preventDefault();
                console.log("Settings DOCK clicked");
                loadProfile();
                settingsModal.style.display = 'flex';
            };
        }

        if (settingsToggleNav) {
            settingsToggleNav.onclick = (e) => {
                e.preventDefault();
                console.log("Settings NAV clicked");
                loadProfile();
                settingsModal.style.display = 'flex';
            };
        }

        document.addEventListener('click', (e) => {
            if (e.target.closest('#closeSettingsModal') && settingsModal) {
                settingsModal.style.display = 'none';
            }
        });

        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) settingsModal.style.display = 'none';
        });

        if (avatarInput) {
            avatarInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => { avatarPreview.src = ev.target.result; };
                    reader.readAsDataURL(file);
                    
                    const formData = new FormData();
                    formData.append('image', file);
                    try {
                        const token = sessionStorage.getItem('nourishToken');
                        const uploadRes = await fetch(`${API_BASE}/upload`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` },
                            body: formData
                        });
                        if (uploadRes.ok) {
                            const data = await uploadRes.json();
                            avatarPreview.dataset.uploadedUrl = data.imageUrl;
                        }
                    } catch(err) {
                        showToast('Avatar upload failed.', 'error');
                    }
                }
            });
        }

        if (settingsForm) {
            settingsForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const saveBtn = document.getElementById('saveSettingsBtn');
                const originalText = saveBtn.innerText;
                saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';
                saveBtn.disabled = true;

                const bio = bioInput.value.trim();
                const address = locationInput.value.trim();
                const contactPerson = contactPersonInput ? contactPersonInput.value.trim() : '';
                const publicPhone = publicPhoneInput ? publicPhoneInput.value.trim() : '';
                const website = websiteInput ? websiteInput.value.trim() : '';
                const fssaiCode = fssaiInput ? fssaiInput.value.trim() : '';
                const pickupWindow = pickupWindowInput ? pickupWindowInput.value.trim() : '';
                const pickupInstructions = pickupInstructionsInput ? pickupInstructionsInput.value.trim() : '';
                
                let avatarUrl = avatarPreview.dataset.uploadedUrl;
                if (!avatarUrl && avatarPreview.src && !avatarPreview.src.includes('pravatar')) {
                    avatarUrl = avatarPreview.src;
                }

                try {
                    const token = sessionStorage.getItem('nourishToken');
                    const res = await fetch(`${API_BASE}/user/me`, {
                        method: 'PUT',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}` 
                        },
                        body: JSON.stringify({ 
                            bio, address, avatarUrl, contactPerson, 
                            publicPhone, website, fssaiCode, 
                            pickupWindow, pickupInstructions 
                        })
                    });

                    if (res.ok) {
                        showToast("Profile updated successfully!", "success");
                        settingsModal.style.display = 'none';
                        // Update navbar avatar immediately
                        const navImg = document.getElementById('nav-avatar-img');
                        if (navImg && avatarUrl) navImg.src = avatarUrl;
                        refreshState(true);
                    } else {
                        showToast("Failed to update profile.", "error");
                    }
                } catch (err) {
                    showToast("Network error.", "error");
                } finally {
                    saveBtn.innerText = originalText;
                    saveBtn.disabled = false;
                }
            });
        }
        // Listen for the custom event to load data
        document.addEventListener('load-profile-data', loadProfile);
        
        const settingsNavBtn = document.getElementById('settings-toggle-nav');
        if (settingsNavBtn) {
            settingsNavBtn.onclick = (e) => {
                e.preventDefault();
                window.openSettings();
            };
        }
    }

    attachSettingsListeners();

});

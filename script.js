document.addEventListener('DOMContentLoaded', () => {
    // 1. Configuration
    const API_BASE = 'https://nourish-network-4bit.onrender.com/api';

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
            },
            {
                name: "Sarah Jenkins",
                org: "Hope Shelter NGO",
                text: "As a small shelter, getting consistent, nutritious food was a daily struggle. This platform gives us dignity and reliability. We are immensely grateful.",
                stars: 5,
                img: "https://i.pravatar.cc/100?img=5"
            },
            {
                name: "David Lee",
                org: "Event Catering Co.",
                text: "The interface is so easy to use. I can share our freshly prepared catering food in 2 minutes, and a volunteer comes to pick it up. Everyone in hospitality should join.",
                stars: 5,
                img: "https://i.pravatar.cc/100?img=33"
            }
        ],
        vendors: [
            { id: 101, name: "Mathsya Mess", cat: "South Indian", rating: 4.8, dist: "1.2 km" },
            { id: 102, name: "Annapoorna Catering", cat: "Bakery & Sweets", rating: 4.5, dist: "0.8 km" },
            { id: 103, name: "Green Leaf Salads", cat: "Healthy", rating: 4.9, dist: "2.5 km" }
        ],
        stats: { totalListings: 0, totalClaimed: 0, totalVendors: 0, totalNGOs: 0 }
    };

    // --- BACKEND SYNC ENGINE ---
    async function refreshState() {
        try {
            // Fetch Listings
            const listRes = await fetch(`${API_BASE}/listings`);
            if (listRes.ok) {
                const rawListings = await listRes.json();
                // Normalize keys for frontend (quantity -> qty, expiryTime -> expiry, imageUrl -> img)
                state.listings = rawListings.map(item => {
                    let finalImg = item.imageUrl || item.img || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600";
                    // If image is a local upload path, point to the production server
                    if (finalImg.startsWith('/uploads')) {
                        finalImg = 'https://nourish-network-4bit.onrender.com' + finalImg;
                    }
                    return {
                        ...item,
                        qty: item.quantity || item.qty || 0,
                        expiry: item.expiryTime || item.expiry || null,
                        img: finalImg
                    };
                });
            }


            // Fetch Stats
            const statsRes = await fetch(`${API_BASE}/stats`);
            if (statsRes.ok) {
                state.stats = await statsRes.json();
                updateLiveStats();
            }

            // Re-render current portal
            renderPortal();
        } catch (err) {
            console.error("Backend Sync Failed:", err);
        }
    }

    function updateLiveStats() {
        const listedEl = document.querySelector('[data-target-stat="listed"]');
        const fulfilledEl = document.querySelector('[data-target-stat="fulfilled"]');
        
        if (listedEl) listedEl.setAttribute('data-target', state.stats.totalListings);
        if (fulfilledEl) fulfilledEl.setAttribute('data-target', state.stats.totalClaimed);
        
        // Re-trigger counters if visible
        if (hasCounted) startCounters();
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
    const user = JSON.parse(localStorage.getItem('nourishUser'));
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
                localStorage.setItem('nourishUser', JSON.stringify(data.user));
                if (data.token) localStorage.setItem('nourishToken', data.token);
                
                setTimeout(() => {
                    authModal.classList.remove('active');
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
                if (data.user) localStorage.setItem('nourishUser', JSON.stringify(data.user));
                if (data.token) localStorage.setItem('nourishToken', data.token);

                setTimeout(() => {
                    authModal.classList.remove('active');
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

    // 3. Portal Switcher Logic
    function initSwitcher() {
        updateLiquidIndicator();
        [swHome, swSeller, swBuyer].forEach(btn => {
            if(!btn) return;
            btn.addEventListener('click', () => {
                const portal = btn.dataset.portal;
                
                // Auth Check: Portals require login
                if (portal !== 'home') {
                    const token = localStorage.getItem('nourishToken');
                    if (!token) {
                        showToast(`Please login to access the ${portal === 'seller' ? 'Seller' : 'Buyer'} Portal.`, 'info');
                        showLoginForm();
                        return;
                    }
                }

                state.activePortal = portal;
                
                // UI Toggle
                swHome.classList.toggle('active', portal === 'home');
                swSeller.classList.toggle('active', portal === 'seller');
                swBuyer.classList.toggle('active', portal === 'buyer');
                
                updateLiquidIndicator();
                renderPortal();
                if (portal !== 'home') showToast(`Dashboard Loaded`, 'success');
            });
        });

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
        const indicator = document.getElementById('portal-indicator');
        const activeBtn = document.querySelector('.portal-btn.active');
        if (!indicator || !activeBtn) return;

        indicator.style.width = `${activeBtn.offsetWidth}px`;
        indicator.style.transform = `translateX(${activeBtn.offsetLeft - 4}px)`;
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
        const landingItems = document.querySelectorAll('.landing-only');
        const buyerItems = document.querySelectorAll('.buyer-only');
        const sellerItems = document.querySelectorAll('.seller-only');
        
        const loginTextDock = document.getElementById('login-text-dock');
        const loginIconDock = document.querySelector('#login-toggle-dock i');
        const userToken = localStorage.getItem('nourishToken');

        if (userToken) {
            if (loginTextDock) loginTextDock.innerText = 'Logout';
            if (loginIconDock) {
                loginIconDock.classList.remove('fa-user');
                loginIconDock.classList.add('fa-right-from-bracket');
            }
        } else {
            if (loginTextDock) loginTextDock.innerText = 'Login';
            if (loginIconDock) {
                loginIconDock.classList.remove('fa-right-from-bracket');
                loginIconDock.classList.add('fa-user');
            }
        }

        const bottomNav = document.querySelector('.bottom-nav');
        
        // Ensure dock is visible (it will naturally be behind the modal due to lower z-index)
        if (bottomNav) {
            bottomNav.style.setProperty('display', 'block', 'important');
            bottomNav.style.setProperty('opacity', '1', 'important');
            bottomNav.style.setProperty('visibility', 'visible', 'important');
        }

        if (state.activePortal === 'buyer') {
            landingItems.forEach(el => el.style.display = 'none');
            buyerItems.forEach(el => el.style.display = 'flex');
            sellerItems.forEach(el => el.style.display = 'none');
        } else if (state.activePortal === 'seller') {
            landingItems.forEach(el => el.style.display = 'none');
            buyerItems.forEach(el => el.style.display = 'none');
            sellerItems.forEach(el => el.style.display = 'flex');
        } else {
            // Home Portal
            landingItems.forEach(el => el.style.display = 'flex');
            buyerItems.forEach(el => el.style.display = 'none');
            sellerItems.forEach(el => el.style.display = 'none');
        }
    }

    function syncPortalSwitcher() {
        const swSeller = document.getElementById('sw-seller') || document.querySelector('.portal-btn[data-portal="seller"]');
        const swBuyer = document.getElementById('sw-buyer') || document.querySelector('.portal-btn[data-portal="buyer"]');
        const swHome = document.getElementById('sw-home') || document.querySelector('.portal-btn[data-portal="home"]');
        
        const userData = localStorage.getItem('nourishUser');
        const token = localStorage.getItem('nourishToken');
        
        if (userData && token) {
            try {
                const user = JSON.parse(userData);
                // Broadest possible check for user role/type
                const accountType = (user.type || user.accountType || user.role || "").toLowerCase();
                
                const isSeller = ['vendor', 'restaurant', 'seller'].some(r => accountType.includes(r));
                const isBuyer = ['ngo', 'shelter', 'buyer'].some(r => accountType.includes(r));

                if (isSeller) {
                    if (swSeller) swSeller.style.setProperty('display', 'flex', 'important');
                    if (swBuyer) {
                        swBuyer.style.setProperty('display', 'none', 'important');
                        // Safety: If somehow on buyer portal, force back to home
                        if (state.activePortal === 'buyer') {
                            state.activePortal = 'home';
                            renderPortal();
                        }
                    }
                } else if (isBuyer) {
                    if (swSeller) {
                        swSeller.style.setProperty('display', 'none', 'important');
                        // Safety: If somehow on seller portal, force back to home
                        if (state.activePortal === 'seller') {
                            state.activePortal = 'home';
                            renderPortal();
                        }
                    }
                    if (swBuyer) swBuyer.style.setProperty('display', 'flex', 'important');
                }
            } catch (e) {
                console.error("Auth Sync Error:", e);
            }
        } else {
            // Logged out: All portals available for preview (redirects to login on click)
            if (swSeller) swSeller.style.setProperty('display', 'flex', 'important');
            if (swBuyer) swBuyer.style.setProperty('display', 'flex', 'important');
        }
        
        // Reposition the liquid indicator
        setTimeout(updateLiquidIndicator, 150);
    }

    function logout() {
        localStorage.removeItem('nourishUser');
        localStorage.removeItem('nourishToken');
        state.activePortal = 'home';
        state.cart = [];
        renderPortal();
        updateLiquidIndicator();
        syncDock();
        showToast("Logged out successfully.", "info");
    }


    function renderSellerPortal() {
        portalsRoot.innerHTML = `
            <div class="portal-wrapper" style="padding-top: 120px; min-height: 100vh;">

                <div class="container" style="max-width: 1300px; margin: 0 auto; padding: 2.5rem 2rem 5rem;">

                    <h1 class="seller-page-title"><span class="premium-title">SELLER'S DASHBOARD</span></h1>

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
    }

    function renderSellerListings() {
        const container = document.getElementById('my-listings-container');
        if (!container) return;

        const user = JSON.parse(localStorage.getItem('nourishUser'));
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

                const token = localStorage.getItem('nourishToken');
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

        grid.innerHTML = state.listings.map((item, idx) => `
            <div class="nn-food-card stagger-item ${item.qty <= 0 ? 'is-sold-out' : ''} ${new Date(item.expiry) < new Date() ? 'is-expired' : ''}" data-id="${item.id}" style="animation-delay: ${idx * 0.05}s">
                ${item.qty <= 0 ? '<div class="nn-sold-out-badge"><i class="fa-solid fa-ban"></i> Sold Out</div>' : ''}
                <div class="nn-card-img-wrap">
                    <img src="${item.img}" alt="${item.name}" loading="lazy">
                    <div class="nn-card-img-overlay"></div>
                    <div class="nn-card-badges">
                        <span class="nn-badge nn-badge-cat">${item.category}</span>
                        <span class="nn-badge nn-badge-qty ${item.qty <= 5 && item.qty > 0 ? 'nn-badge-low' : ''}"><i class="fa-solid fa-utensils"></i> ${item.qty} left</span>
                    </div>
                    <div class="nn-card-vendor"><i class="fa-solid fa-store"></i> ${item.vendorName}</div>
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
        `).join('');
        
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

        const target = cartToggle.getBoundingClientRect();
        
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

                const token = localStorage.getItem('nourishToken');
                if (!token) {
                    showToast("Please login to publish your listing.", "info");
                    showLoginForm();
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

    const addListingDock = document.getElementById('open-add-listing-dock');
    if (addListingDock) {
        addListingDock.addEventListener('click', (e) => {
            e.preventDefault();
            const section = document.getElementById('add-listing-section');
            if (section) {
                section.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                // If not on seller dashboard, switch to it
                state.activePortal = 'seller';
                renderPortal();
                setTimeout(() => {
                    document.getElementById('add-listing-section')?.scrollIntoView({ behavior: 'smooth' });
                }, 500);
            }
        });
    }

});
    const loginToggleDock = document.getElementById('login-toggle-dock');
    if (loginToggleDock) {
        loginToggleDock.addEventListener('click', (e) => {
            e.preventDefault();
            const token = localStorage.getItem('nourishToken');
            if (token) {
                if (confirm("Are you sure you want to logout?")) {
                    logout();
                }
            } else {
                showLoginForm();
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

            const token = localStorage.getItem('nourishToken');
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

    const addListingDock = document.getElementById('add-listing-dock');
    if (addListingDock) {
        addListingDock.addEventListener('click', (e) => {
            e.preventDefault();
            const section = document.getElementById('add-listing-section');
            if (section) {
                window.scrollTo({
                    top: section.offsetTop - 100,
                    behavior: 'smooth'
                });
            }
        });
    }
    
    closeCart.addEventListener('click', () => cartDrawer.classList.remove('active'));
    document.querySelector('.cart-drawer-overlay').addEventListener('click', () => cartDrawer.classList.remove('active'));

    document.getElementById('confirm-claim').addEventListener('click', async () => {
        if (state.cart.length === 0) {
            showToast("Basket is empty!", "error");
            return;
        }

        const token = localStorage.getItem('nourishToken');
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


    // Check for existing session
    const savedUser = localStorage.getItem('nourishUser');
    if (savedUser) {
        refreshState();
    } else {
        renderPortal(); // Just show home
        refreshState(); // Get public listings
    }

    // --- IMPACT MAP ENGINE ---
    function initImpactMap() {
        const mapContainer = document.getElementById('impact-map');
        if (!mapContainer) return;

        // Initialize map centered on a hub (e.g., Chennai)
        const map = L.map('impact-map', {
            scrollWheelZoom: false,
            zoomControl: false
        }).setView([13.0827, 80.2707], 12);

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Dark Mode Map Layer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        // Add some realistic simulated points for the hackathon
        const points = [
            { pos: [13.0827, 80.2707], name: "Main Hub", type: "hub" },
            { pos: [13.0475, 80.2089], name: "Grand Hotel", type: "seller" },
            { pos: [13.0674, 80.2376], name: "Hope Shelter", type: "buyer" },
            { pos: [13.0067, 80.2206], name: "Catering Co.", type: "seller" },
            { pos: [13.1143, 80.2872], name: "Community Kitchen", type: "buyer" }
        ];

        points.forEach(p => {
            const color = p.type === 'seller' ? '#10b981' : (p.type === 'buyer' ? '#3498db' : '#f1c40f');
            const icon = L.divIcon({
                className: 'custom-map-marker',
                html: `<div style="background: ${color}; width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 15px ${color};"></div>`,
                iconSize: [12, 12]
            });
            L.marker(p.pos, { icon }).addTo(map).bindPopup(`<strong>${p.name}</strong><br>${p.type.toUpperCase()}`);
        });

        // Draw connections for "Active Paths"
        const paths = [
            [[13.0475, 80.2089], [13.0674, 80.2376]],
            [[13.0067, 80.2206], [13.1143, 80.2872]]
        ];

        paths.forEach(path => {
            L.polyline(path, {
                color: '#10b981',
                weight: 2,
                opacity: 0.5,
                dashArray: '5, 10',
                lineJoin: 'round'
            }).addTo(map);
        });
    }

});

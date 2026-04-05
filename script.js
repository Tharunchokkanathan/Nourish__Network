document.addEventListener('DOMContentLoaded', () => {
    // 1. Scroll Animations Setup using Intersection Observer
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

    // 4. Review Slider Implementation
    const slides = document.querySelectorAll('.review-slide');
    const dotsContainer = document.getElementById('sliderDots');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    if (slides.length > 0) {
        let currentSlide = 0;

        // Create dots
        slides.forEach((_, idx) => {
            const dot = document.createElement('div');
            dot.classList.add('dot');
            if (idx === 0) dot.classList.add('active');
            dot.addEventListener('click', () => goToSlide(idx));
            dotsContainer.appendChild(dot);
        });

        const dots = document.querySelectorAll('.dot');

        // Initialize first slide
        slides[0].classList.add('active');

        function updateSlides() {
            slides.forEach((slide, idx) => {
                slide.classList.remove('active');
                dots[idx].classList.remove('active');
            });
            slides[currentSlide].classList.add('active');
            dots[currentSlide].classList.add('active');
        }

        function nextSlide() {
            currentSlide = (currentSlide + 1) % slides.length;
            updateSlides();
        }

        function prevSlide() {
            currentSlide = (currentSlide - 1 + slides.length) % slides.length;
            updateSlides();
        }

        function goToSlide(idx) {
            currentSlide = idx;
            updateSlides();
        }

        nextBtn.addEventListener('click', nextSlide);
        prevBtn.addEventListener('click', prevSlide);

        // Optional Auto-play
        setInterval(nextSlide, 5000);
    }

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

            // If the button text contains "Log In", show Login. Otherwise show Register.
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
        toggleRegisterBtn.classList.remove('active');
        toggleLoginBtn.classList.add('active');
        registerForm.classList.remove('active');
        loginForm.classList.add('active');
        modalTitle.innerText = "Welcome Back";
        modalSubtitle.innerText = "Log in to continue your impact.";
    }

    function showRegisterForm() {
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

    // Set Base URL for the API
    // Using a relative path makes the code work seamlessly on localhost AND the live internet domain.
    const API_BASE = '/api';

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
    const checkLoginStatus = () => {
        const user = JSON.parse(localStorage.getItem('nourishUser'));
        if (user) {
            const navButtons = document.querySelector('.nav-buttons');
            if (navButtons) {
                navButtons.innerHTML = `<a href="dashboard.html" class="btn btn-outline"><i class="fa-solid fa-user"></i> Dashboard</a>`;
            }
            // Also update any "Join Now" or "Donate Food" buttons on the landing page
            const heroActions = document.querySelectorAll('.hero-action a, .action-card button');
            heroActions.forEach(btn => {
                btn.onclick = (e) => {
                    e.preventDefault();
                    window.location.href = 'dashboard.html';
                };
            });
        }
    };
    checkLoginStatus();

    // --- Demo Login Fillers ---
    const btnDemoSeller = document.getElementById('btn-demo-seller');
    const btnDemoBuyer = document.getElementById('btn-demo-buyer');

    if (btnDemoSeller) {
        btnDemoSeller.addEventListener('click', () => {
            document.getElementById('loginEmail').value = 'seller@demo.com';
            document.getElementById('loginPassword').value = 'demo123';
        });
    }

    if (btnDemoBuyer) {
        btnDemoBuyer.addEventListener('click', () => {
            document.getElementById('loginEmail').value = 'buyer@demo.com';
            document.getElementById('loginPassword').value = 'demo123';
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
                    window.location.href = 'dashboard.html';
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
                    window.location.href = 'dashboard.html';
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
    // =========================================
    // NN-PORTAL ECOSYSTEM LOGIC (CORE)
    // =========================================

    // 1. Initial State & Mock Data
    const state = {
        activePortal: 'seller', // default
        cart: [],
        listings: [
            { 
                id: 1, vendorId: 101, vendorName: "Mathsya Mess", category: "Cooked", 
                name: "Vegetable Biryani", price: 40, qty: 15, unit: "Plate",
                expiry: new Date(Date.now() + 3 * 3600000), condition: "Fresh",
                allergens: ["Spicy"], storage: "Keep in thermal containers", 
                status: "available", pickup: true, radius: 0, 
                img: "https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?w=400"
            },
            { 
                id: 2, vendorId: 102, vendorName: "Annapoorna Catering", category: "Bakery", 
                name: "Assorted Bread Box", price: 25, qty: 8, unit: "Pack",
                expiry: new Date(Date.now() + 24 * 3600000), condition: "Day-Old",
                allergens: ["Gluten"], storage: "Cool dry place", 
                status: "available", pickup: true, radius: 0,
                img: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400"
            }
        ],
        vendors: [
            { id: 101, name: "Mathsya Mess", cat: "South Indian", rating: 4.8, dist: "1.2 km" },
            { id: 102, name: "Annapoorna Catering", cat: "Bakery & Sweets", rating: 4.5, dist: "0.8 km" },
            { id: 103, name: "Green Leaf Salads", cat: "Healthy", rating: 4.9, dist: "2.5 km" }
        ],
        stats: { listed: 450, fulfilled: 320, revenue: 12500, co2: 85 }
    };

    // 2. Selectors
    const portalsRoot = document.getElementById('nn-portals-root');
    const swSeller = document.getElementById('sw-seller');
    const swBuyer = document.getElementById('sw-buyer');
    const cartToggle = document.getElementById('cart-toggle');
    const cartDrawer = document.getElementById('cart-drawer');
    const closeCart = document.getElementById('close-cart');
    const globalSearch = document.getElementById('global-search');
    const nearMeToggle = document.getElementById('near-me-toggle');

    // 3. Portal Switcher Logic
    function initSwitcher() {
        [swSeller, swBuyer].forEach(btn => {
            btn.addEventListener('click', () => {
                const portal = btn.dataset.portal;
                state.activePortal = portal;
                
                // UI Toggle
                swSeller.classList.toggle('active', portal === 'seller');
                swBuyer.classList.toggle('active', portal === 'buyer');
                
                renderPortal();
                showToast(`Switched to ${portal === 'seller' ? 'Seller' : 'Buyer'} Portal`, 'info');
            });
        });
    }

    // 4. Rendering Engine
    function renderPortal() {
        portalsRoot.style.display = 'block';
        if (state.activePortal === 'seller') {
            renderSellerPortal();
        } else {
            renderBuyerPortal();
        }
    }

    function renderSellerPortal() {
        portalsRoot.innerHTML = `
            <div class="seller-portal-layout animate-reveal">
                <aside class="portal-sidebar glass">
                    <div class="sidebar-nav">
                        <a href="#" class="nav-link active"><i class="fa-solid fa-chart-pie"></i> Dashboard</a>
                        <a href="#" class="nav-link"><i class="fa-solid fa-plus-circle"></i> Add Food Listing</a>
                        <a href="#" class="nav-link"><i class="fa-solid fa-boxes-stacked"></i> My Listed Foods</a>
                        <a href="#" class="nav-link"><i class="fa-solid fa-truck-ramp-box"></i> Donation Tracker</a>
                        <a href="#" class="nav-link"><i class="fa-solid fa-gears"></i> Settings</a>
                    </div>
                    <div class="user-profile-mini">
                        <img src="https://i.pravatar.cc/100?img=12" alt="Seller">
                        <div><strong>Mathsya Mess</strong><br><small>Premium Vendor</small></div>
                    </div>
                </aside>
                
                <main class="portal-main-content">
                    <!-- Zone D: Stats -->
                    <div class="stats-bar animate-on-scroll fade-up">
                        <div class="stat-card glass">
                            <span class="stat-val">${state.stats.listed}kg</span>
                            <small>Total Listed</small>
                        </div>
                        <div class="stat-card glass">
                            <span class="stat-val">${state.stats.fulfilled}</span>
                            <small>Orders Fulfilled</small>
                        </div>
                        <div class="stat-card glass">
                            <span class="stat-val">₹${state.stats.revenue}</span>
                            <small>Revenue Earned</small>
                        </div>
                        <div class="stat-card glass">
                            <span class="stat-val">${state.stats.co2}kg</span>
                            <small>CO₂ Saved</small>
                        </div>
                    </div>

                    <h2 class="portal-section-title" style="margin-top: 4rem;">Post Surplus Food</h2>
                    
                    <!-- Zone A: Add Food Panel -->
                    <div class="glass-card add-food-card animate-on-scroll fade-up">
                        <form id="add-food-form" class="add-food-grid">
                            <div class="form-group">
                                <label>Food Name</label>
                                <input type="text" id="p-name" class="form-control" placeholder="e.g. Tomato Pasta" required>
                            </div>
                            <div class="form-group">
                                <label>Category</label>
                                <select id="p-cat" class="form-control">
                                    <option>Cooked</option><option>Packaged</option><option>Produce</option>
                                    <option>Bakery</option><option>Beverages</option><option>Desserts</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Price (₹)</label>
                                <input type="number" id="p-price" class="form-control" value="20">
                            </div>
                            <div class="form-group">
                                <label>Qty / Unit</label>
                                <div style="display:flex; gap: 5px;">
                                    <input type="number" id="p-qty" class="form-control" style="width: 60px;" value="10">
                                    <select id="p-unit" class="form-control">
                                        <option>Plate</option><option>Kg</option><option>Pack</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Expiry Date & Time</label>
                                <input type="datetime-local" id="p-expiry" class="form-control" required>
                            </div>
                            <div class="form-group">
                                <label>Condition</label>
                                <select id="p-cond" class="form-control">
                                    <option>Fresh</option><option>Day-Old</option><option>Frozen</option>
                                </select>
                            </div>
                            <div class="form-group full-width">
                                <label>Allergen Info (Multi-select)</label>
                                <div class="allergen-chips" style="display:flex; gap:10px; flex-wrap:wrap;">
                                    <label><input type="checkbox" value="Nuts"> Nuts</label>
                                    <label><input type="checkbox" value="Dairy"> Dairy</label>
                                    <label><input type="checkbox" value="Gluten"> Gluten</label>
                                    <label><input type="checkbox" value="Vegan"> Vegan</label>
                                </div>
                            </div>
                            <div class="form-group full-width">
                                <div class="drag-drop-zone">
                                    <i class="fa-solid fa-cloud-arrow-up"></i>
                                    <p>Click or drag image to upload food photo</p>
                                </div>
                            </div>
                            <button type="submit" class="btn btn-primary full-width" style="background: var(--accent-secondary); color: white;">🌱 Publish Listing</button>
                        </form>
                    </div>

                    <!-- Zone B: My Listed Foods -->
                    <h2 class="portal-section-title">My Listed Foods</h2>
                    <div class="my-listings-grid" id="my-listings-container">
                        <!-- Listings will render here -->
                    </div>
                </main>
            </div>
        `;
        renderSellerListings();
        attachSellerListeners();
    }

    function renderSellerListings() {
        const container = document.getElementById('my-listings-container');
        if (!container) return;
        
        container.innerHTML = state.listings.filter(l => l.vendorId === 101).map(item => `
            <div class="listing-expandable-card glass hover-lift" data-id="${item.id}">
                <div class="listing-header">
                    <div>
                        <span class="badge" style="background: var(--accent-primary); margin-bottom: 5px;">${item.category}</span>
                        <h3>${item.name}</h3>
                        <p>₹${item.price} • ${item.qty} ${item.unit} left</p>
                    </div>
                    <div style="text-align: right;">
                        <span class="countdown" style="font-weight: 700; color: var(--accent-secondary);">Expiring in 2h 40m</span><br>
                        <button class="btn btn-sm btn-outline edit-btn" style="padding: 4px 8px;"><i class="fa-solid fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline delete-btn" style="padding: 4px 8px;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function renderBuyerPortal() {
        portalsRoot.innerHTML = `
            <div class="buyer-portal-layout animate-reveal">
                <div class="category-strip">
                    <button class="category-pill active">All</button>
                    <button class="category-pill">Cooked Meals</button>
                    <button class="category-pill">Packaged</button>
                    <button class="category-pill">Produce</button>
                    <button class="category-pill">Bakery</button>
                    <button class="category-pill">Expiring Soon</button>
                </div>

                <div class="vendor-row">
                    ${state.vendors.map(v => `
                        <div class="vendor-card-mini glass hover-lift">
                            <strong>${v.name}</strong>
                            <p style="font-size: 0.8rem; opacity: 0.7;">${v.cat} • ${v.dist}</p>
                            <span style="color: #f1c40f;">★ ${v.rating}</span>
                        </div>
                    `).join('')}
                </div>

                <div class="section-header" style="margin-top: 3rem;">
                    <h2>The Exchange</h2>
                    <p>Surplus food, ready to give — claim before it's gone.</p>
                </div>

                <div class="the-exchange-grid" id="exchange-grid">
                    <!-- Cards will render here -->
                </div>
            </div>
        `;
        renderExchangeGrid();
    }

    function renderExchangeGrid() {
        const grid = document.getElementById('exchange-grid');
        if (!grid) return;

        grid.innerHTML = state.listings.map(item => `
            <div class="food-card-swiggy glass-card ${item.status === 'sold' ? 'sold-out' : ''}" data-id="${item.id}">
                <div class="card-img-wrap">
                    <img src="${item.img}" alt="${item.name}">
                    <div class="sold-out-overlay">✗ Sold Out</div>
                </div>
                <div class="card-body-swiggy">
                    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom: 10px;">
                        <div>
                            <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: var(--accent-primary); font-size: 0.7rem;">${item.category}</span>
                            <h3 style="margin: 5px 0 0; font-size: 1.25rem;">${item.name}</h3>
                        </div>
                        <span class="card-price">₹${item.price}</span>
                    </div>
                    <p style="font-size: 0.85rem; opacity: 0.8; margin-bottom: 15px;">By ${item.vendorName}</p>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                        <span style="font-size: 0.8rem; color: #e67e22; font-weight:700;"><i class="fa-solid fa-clock"></i> 2h 40m left</span>
                        <div class="stepper-wrap">
                            <button class="stepper-btn minus">-</button>
                            <span>1</span>
                            <button class="stepper-btn plus">+</button>
                        </div>
                    </div>
                    <button class="add-to-basket-btn btn-glow add-btn" data-id="${item.id}">🛒 Add to Basket</button>
                </div>
            </div>
        `).join('');
        
        attachBuyerListeners();
    }

    // 5. Cart & Basket Logic
    function attachBuyerListeners() {
        document.querySelectorAll('.add-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.dataset.id;
                const item = state.listings.find(l => l.id == id);
                if (item) {
                    addToCart(item, e);
                }
            });
        });
    }

    function addToCart(item, e) {
        state.cart.push(item);
        updateCartBadge();
        
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

        showToast(`${item.name} added to your basket!`, 'success');
        renderCartItems();
    }

    function updateCartBadge() {
        const counts = document.querySelectorAll('.cart-count');
        counts.forEach(c => c.innerText = state.cart.length);
    }

    function renderCartItems() {
        const list = document.getElementById('cart-items-list');
        if (!list) return;

        if (state.cart.length === 0) {
            list.innerHTML = '<div class="empty-cart-msg">Your basket is empty. 🌱</div>';
            updateCartTotals();
            return;
        }

        list.innerHTML = state.cart.map((item, idx) => `
            <div class="cart-item-row" style="display:flex; justify-content:space-between; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-glow);">
                <div>
                    <strong>${item.name}</strong><br>
                    <small>${item.vendorName}</small>
                </div>
                <div style="text-align: right;">
                    <strong>₹${item.price}</strong><br>
                    <button class="remove-item" data-idx="${idx}" style="background:none; border:none; color:#e74c3c; cursor:pointer;">Remove</button>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.remove-item').forEach(btn => {
            btn.addEventListener('click', () => {
                state.cart.splice(btn.dataset.idx, 1);
                renderCartItems();
                updateCartBadge();
            });
        });

        updateCartTotals();
    }

    function updateCartTotals() {
        const subtotal = state.cart.reduce((sum, item) => sum + item.price, 0);
        document.getElementById('cart-subtotal').innerText = `₹${subtotal}`;
        document.getElementById('cart-total').innerText = `₹${subtotal}`;
    }

    // 6. Form Handling (Seller)
    function attachSellerListeners() {
        const form = document.getElementById('add-food-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const newItem = {
                    id: Date.now(),
                    vendorId: 101,
                    vendorName: "Mathsya Mess",
                    name: document.getElementById('p-name').value,
                    category: document.getElementById('p-cat').value,
                    price: parseInt(document.getElementById('p-price').value),
                    qty: parseInt(document.getElementById('p-qty').value),
                    unit: document.getElementById('p-unit').value,
                    expiry: new Date(document.getElementById('p-expiry').value),
                    condition: document.getElementById('p-cond').value,
                    img: "https://images.unsplash.com/photo-1493770348161-369560ae357d?w=400",
                    status: "available"
                };
                
                state.listings.unshift(newItem);
                showToast("Listing published to The Exchange! 🌱");
                renderSellerPortal();
            });
        }
    }

    // 7. Initialize Everything
    initSwitcher();
    cartToggle.addEventListener('click', () => cartDrawer.classList.add('active'));
    closeCart.addEventListener('click', () => cartDrawer.classList.remove('active'));
    document.querySelector('.cart-drawer-overlay').addEventListener('click', () => cartDrawer.classList.remove('active'));

    document.getElementById('confirm-claim').addEventListener('click', () => {
        if (state.cart.length === 0) {
            showToast("Basket is empty!", "error");
            return;
        }
        showToast("Your basket is confirmed! 🌱 Thank you for reducing waste.", "success");
        state.cart = [];
        updateCartBadge();
        renderCartItems();
        cartDrawer.classList.remove('active');
        
        // Mock: Update listings status
        state.listings.forEach(l => l.status = 'sold');
        if (state.activePortal === 'buyer') renderExchangeGrid();
    });

    // Default start
    renderPortal();

});

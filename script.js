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

    // Open Modal from Nav Buttons
    const navButtons = document.querySelectorAll('.nav-buttons a[href="#join"]');
    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            authModal.classList.add('active');

            // If they clicked "Join Now" instead of Log In, switch to Register view
            if (btn.classList.contains('btn-primary')) {
                showRegisterForm();
            } else {
                showLoginForm();
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

    // 1. Login Form Submit
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
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
                closeAuthModal();
                loginForm.reset();

                // Update Nav UI to show logged in state
                const navButtons = document.querySelector('.nav-buttons');
                navButtons.innerHTML = `<a href="#" class="btn btn-outline"><i class="fa-solid fa-user"></i> Dashboard</a>`;
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
        const organizationName = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;

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
                showToast("Account created successfully! Please log in.");
                loginForm.reset();
                registerForm.reset();
                showLoginForm(); // Switch to login view
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

});

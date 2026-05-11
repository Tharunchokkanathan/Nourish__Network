document.addEventListener('DOMContentLoaded', () => {
    // 1. Authentication Check & User Data
    let userData = null;
    try {
        userData = JSON.parse(sessionStorage.getItem('nourishUser'));
    } catch (e) {}

    // Fallback for presentation if not logged in
    if (!userData) {
        console.warn("No user found, redirecting to login.");
        window.location.href = 'index.html';
        return;
    }

    // API Configuration
    const API_BASE = 'https://nourish-network-4bit.onrender.com/api';

    // Scroll Animation Logic
    const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
    const scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
                scrollObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    function initAnimations() {
        document.querySelectorAll('.animate-on-scroll').forEach(el => scrollObserver.observe(el));
    }

    // Normalize user type
    const userType = (userData.type || userData.accountType || userData.role || '').toLowerCase();
    const isVendor = (userType === 'restaurant' || userType === 'vendor' || userType === 'seller');
    const isNgo = (userType === 'ngo' || userType === 'buyer');

    const safeSetText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    };

    safeSetText('userName', userData.name || userData.organizationName || userData.email);
    
    const typeBadge = document.getElementById('userTypeBadge');
    if (typeBadge) {
        typeBadge.innerText = isVendor ? 'Food Vendor' : 'NGO / Shelter';
        typeBadge.className = `badge ${isNgo ? 'badge-secondary' : 'badge-primary'}`;
    }

    const vendorActionBox = document.getElementById('vendorActionBox');
    const ngoActionBox = document.getElementById('ngoActionBox');
    const feedTitle = document.getElementById('feedTitle');

    if (isVendor) {
        if (vendorActionBox) vendorActionBox.style.display = 'block';
        if (feedTitle) feedTitle.innerText = "My Food Listings";
    } else {
        if (ngoActionBox) ngoActionBox.style.display = 'block';
        if (feedTitle) feedTitle.innerText = "Available Community Meals";
    }

    // Logout Logic
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('nourishUser');
            sessionStorage.removeItem('nourishToken');
            window.location.href = 'index.html';
        });
    }

    // --- REAL API LOGIC ---

    async function fetchListings() {
        try {
            const url = isVendor ? `${API_BASE}/listings?vendorId=${userData.id}` : `${API_BASE}/listings?status=available`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to fetch");
            return await response.json();
        } catch (err) {
            console.error("Fetch Error:", err);
            return [];
        }
    }

    async function renderDashboard() {
        const listingsFeed = document.getElementById('listingsFeed');
        const loader = document.getElementById('listingsLoader');
        const sweetsFeed = document.getElementById('sweetsFeed');

        if (!listingsFeed) return;
        if (loader) loader.style.display = 'block';
        
        const listings = await fetchListings();
        
        if (loader) loader.style.display = 'none';
        listingsFeed.innerHTML = '';
        if (sweetsFeed) sweetsFeed.innerHTML = '';

        // --- Gamification Logic ---
        if (isVendor) {
            const vendorTypeBadge = document.getElementById('userTypeBadge');
            if (vendorTypeBadge) {
                let totalMealsDonated = 0;
                listings.forEach(item => {
                    totalMealsDonated += parseFloat(item.quantity) || 0;
                });
                
                let badgeName = 'Member';
                let badgeClass = 'badge-member';
                if (totalMealsDonated >= 500) { badgeName = 'Platinum Elite'; badgeClass = 'badge-platinum'; }
                else if (totalMealsDonated >= 100) { badgeName = 'Gold'; badgeClass = 'badge-gold'; }
                else if (totalMealsDonated >= 50) { badgeName = 'Silver Partner'; badgeClass = 'badge-silver'; }
                
                vendorTypeBadge.innerHTML = `Food Vendor`;
            }

            // --- Analytics Dashboard Logic ---
            const analyticsDashboard = document.getElementById('analyticsDashboard');
            if (analyticsDashboard) {
                analyticsDashboard.style.display = 'block';
                
                const totalMealsStat = document.getElementById('totalMealsStat');
                const co2OffsetStat = document.getElementById('co2OffsetStat');
                
                if (totalMealsStat) totalMealsStat.innerText = totalMealsDonated;
                if (co2OffsetStat) co2OffsetStat.innerText = (totalMealsDonated * 2.5).toFixed(1);
                
                // Group data by date
                const dateData = {};
                // listings are ordered DESC by datePosted from API, so reverse for chronological chart
                const chronListings = [...listings].reverse(); 
                chronListings.forEach(item => {
                    const dateObj = new Date(item.datePosted || Date.now());
                    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const qty = parseFloat(item.quantity) || 0;
                    dateData[dateStr] = (dateData[dateStr] || 0) + qty;
                });
                
                const labels = Object.keys(dateData);
                const data = Object.values(dateData);
                
                // Initialize Chart
                const ctx = document.getElementById('impactChart');
                if (ctx && window.Chart) {
                    if (window.impactChartInstance) window.impactChartInstance.destroy();
                    window.impactChartInstance = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: labels.length ? labels : ['Today'],
                            datasets: [{
                                label: 'Meals Saved',
                                data: data.length ? data : [0],
                                borderColor: '#10b981',
                                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                borderWidth: 3,
                                fill: true,
                                tension: 0.4,
                                pointBackgroundColor: '#10b981',
                                pointRadius: 4
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    backgroundColor: '#1e293b',
                                    titleFont: { family: "'Inter', sans-serif" },
                                    bodyFont: { family: "'Inter', sans-serif" },
                                    padding: 10,
                                    cornerRadius: 8
                                }
                            },
                            scales: {
                                y: { 
                                    beginAtZero: true,
                                    grid: { color: 'rgba(226, 232, 240, 0.5)' }
                                },
                                x: {
                                    grid: { display: false }
                                }
                            }
                        }
                    });
                }
            }
        }
        // --------------------------

        if (listings.length === 0) {
            listingsFeed.innerHTML = '<div class="empty-state"><i class="fa-solid fa-box-open"></i><p>No listings found yet.</p></div>';
            return;
        }

        listings.forEach(item => {
            const card = document.createElement('div');
            card.className = 'food-card animate-on-scroll fade-up';
            
            const isClaimed = item.status === 'claimed' || item.status === 'sold';
            const statusHtml = `<span class="status-badge ${isClaimed ? 'status-claimed' : 'status-available'}">${item.status}</span>`;

            let actionBtn = '';
            if (isNgo && !isClaimed) {
                actionBtn = `<button class="btn btn-primary w-100 btn-claim" data-id="${item.id}" style="margin-top: 10px;">Claim Food <i class="fa-solid fa-hand-holding-heart"></i></button>`;
            } else if (isVendor) {
                actionBtn = `<button class="btn btn-outline w-100 btn-delete" data-id="${item.id}" style="margin-top: 10px; color: #dc2626; border-color: #dc2626;">Delete Listing <i class="fa-solid fa-trash"></i></button>`;
            }

            const avatarImg = item.vendorAvatar ? item.vendorAvatar : `assets/default-avatar.jpg`;
            const bioText = item.vendorBio ? `<div style="font-size: 0.8rem; color: #94a3b8; margin-top: 2px;">${item.vendorBio}</div>` : '';

            card.innerHTML = `
                <div class="d-flex justify-between" style="margin-bottom: 10px; align-items: flex-start;">
                    <div class="d-flex" style="align-items: center; gap: 10px;">
                        <img src="${avatarImg}" alt="Avatar" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-glow);">
                        <div>
                            <span class="vendor-name" style="margin: 0; font-size: 0.95rem; font-weight: bold;">${item.vendorName}</span>
                            ${bioText}
                        </div>
                    </div>
                    ${statusHtml}
                </div>
                <h4 class="food-desc" style="margin-bottom: 5px; font-size: 1.15rem;">${item.name}</h4>
                <p style="font-size: 0.9rem; color: #64748b; margin-bottom: 8px;">${item.description || 'No description provided.'}</p>
                <div class="food-meta" style="margin-bottom: 10px;">
                    <div><i class="fa-solid fa-weight-hanging"></i> Quantity: <strong>${item.quantity}</strong></div>
                    <div><i class="fa-solid fa-clock"></i> Pickup: <strong>${item.pickupTime || 'Anytime'}</strong></div>
                </div>
                ${actionBtn}
            `;
            
            if (item.category === 'Bakery' || item.category === 'Sweets') {
                if (sweetsFeed) sweetsFeed.appendChild(card);
                else listingsFeed.appendChild(card);
            } else {
                listingsFeed.appendChild(card);
            }
        });

        // Event Listeners for Claim
        document.querySelectorAll('.btn-claim').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                try {
                    const token = sessionStorage.getItem('nourishToken');
                    const res = await fetch(`${API_BASE}/listings/claim`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ listingId: id })
                    });
                    if (res.ok) {
                        alert("Food claimed successfully! 🤝");
                        renderDashboard();
                    } else {
                        const err = await res.json();
                        alert(err.error || "Claim failed");
                    }
                } catch (e) {
                    alert("Network error. Try again.");
                }
            });
        });

        // Event Listeners for Delete
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm("Are you sure you want to delete this listing?")) return;
                const id = btn.dataset.id;
                try {
                    const token = sessionStorage.getItem('nourishToken');
                    const res = await fetch(`${API_BASE}/listings/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        renderDashboard();
                    }
                } catch (e) {}
            });
        });

        initAnimations();
    }

    // Post Food Handler
    const postFoodForm = document.getElementById('postFoodForm');
    if (postFoodForm) {
        postFoodForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('foodDesc').value;
            const quantity = document.getElementById('foodQty').value;
            const pickupTime = document.getElementById('pickupTime').value;

            try {
                const token = sessionStorage.getItem('nourishToken');
                const res = await fetch(`${API_BASE}/listings`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ 
                        name, 
                        quantity, 
                        pickupTime,
                        category: 'Cooked',
                        condition: 'Fresh'
                    })
                });

                if (res.ok) {
                    alert("Food listing posted! 🌱");
                    postFoodForm.reset();
                    renderDashboard();
                } else {
                    alert("Failed to post listing.");
                }
            } catch (err) {
                alert("Network error.");
            }
        });
    }

    // =========================================
    // SETTINGS / PROFILE MODAL LOGIC
    // =========================================
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsModal = document.getElementById('closeSettingsModal');
    const settingsForm = document.getElementById('settingsForm');
    const bioInput = document.getElementById('bioInput');
    const locationInput = document.getElementById('locationInput');
    const avatarInput = document.getElementById('avatarInput');
    const avatarPreview = document.getElementById('avatarPreview');

    // Load full profile details from backend
    async function loadProfile() {
        try {
            const token = sessionStorage.getItem('nourishToken');
            const res = await fetch(`${API_BASE}/user/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const profile = await res.json();
                bioInput.value = profile.bio || '';
                locationInput.value = profile.address || '';
                if (profile.avatarUrl) {
                    avatarPreview.src = profile.avatarUrl;
                }
            }
        } catch (e) { console.error(e); }
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('#closeSettingsModal') && settingsModal) {
            settingsModal.style.display = 'none';
        }
    });

    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', () => {
            loadProfile();
            settingsModal.style.display = 'flex';
        });

        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) settingsModal.style.display = 'none';
        });

        // Handle Avatar Preview
        avatarInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => { avatarPreview.src = e.target.result; };
                reader.readAsDataURL(file);
                
                // Upload immediately to get URL
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
                        avatarPreview.dataset.uploadedUrl = data.imageUrl; // save for submission
                    }
                } catch(err) {
                    alert('Avatar upload failed.');
                }
            }
        });

        // Save Settings
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const saveBtn = document.getElementById('saveSettingsBtn');
            const originalText = saveBtn.innerText;
            saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';
            saveBtn.disabled = true;

            const bio = bioInput.value.trim();
            const address = locationInput.value.trim();
            let avatarUrl = avatarPreview.dataset.uploadedUrl;
            if (!avatarUrl && !avatarPreview.src.includes('default-avatar')) {
                avatarUrl = avatarPreview.src; // Keep existing if not changing
            }

            try {
                const token = sessionStorage.getItem('nourishToken');
                const res = await fetch(`${API_BASE}/user/me`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify({ bio, address, avatarUrl })
                });

                if (res.ok) {
                    alert("Profile updated successfully!");
                    settingsModal.style.display = 'none';
                } else {
                    alert("Failed to update profile.");
                }
            } catch (err) {
                alert("Network error.");
            } finally {
                saveBtn.innerText = originalText;
                saveBtn.disabled = false;
            }
        });
    }

    renderDashboard();
});

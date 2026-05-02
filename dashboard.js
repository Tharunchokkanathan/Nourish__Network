document.addEventListener('DOMContentLoaded', () => {
    // 1. Authentication Check & User Data
    const userData = JSON.parse(localStorage.getItem('nourishUser'));

    if (!userData) {
        // Not logged in, redirect to index
        window.location.href = 'index.html';
        return;
    }

    // Populate UI with User Info
    document.getElementById('userName').innerText = userData.name || userData.email;
    const typeBadge = document.getElementById('userTypeBadge');
    typeBadge.innerText = (userData.type === 'restaurant' || userData.type === 'vendor') ? 'Food Vendor' : 'NGO / Shelter';
    typeBadge.className = `badge ${userData.type === 'ngo' ? 'badge-secondary' : 'badge-primary'}`;

    // Switch Views based on User Type
    const vendorActionBox = document.getElementById('vendorActionBox');
    const ngoActionBox = document.getElementById('ngoActionBox');
    const feedTitle = document.getElementById('feedTitle');

    if (userData.type === 'restaurant' || userData.type === 'vendor') {
        vendorActionBox.style.display = 'block';
        feedTitle.innerText = "My Food Listings";
    } else {
        ngoActionBox.style.display = 'block';
        feedTitle.innerText = "Available Community Meals";
    }

    // 2. Logout Logic
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('nourishUser');
        window.location.href = 'index.html';
    });

    // 3. API Integration
    const API_BASE = '/api';
    const token = localStorage.getItem('nourishToken');
    const authHeaders = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    // Helper: Show Toasts (copy from script.js logic if needed, or implement simple alert)
    function showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type} show`;
        toast.innerHTML = `<div class="toast-message">${message}</div>`;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    // 4. Fetch & Render Listings
    // 4. Fetch & Render Listings
    async function fetchListings() {
        const listingsFeed = document.getElementById('listingsFeed');
        const loader = document.getElementById('listingsLoader');
        
        let listings = [];
        try {
            // If vendor, we want their specific listings. If NGO, we want all available.
            const queryParam = (userData.type === 'restaurant' || userData.type === 'vendor') ? `?vendorId=${userData.id}` : '';
            const response = await fetch(`${API_BASE}/listings${queryParam}`, {
                headers: authHeaders
            });
            
            if (response.ok) {
                listings = await response.json();
            } else {
                throw new Error("API fail");
            }
        } catch (error) {
            console.warn("Backend API unavailable, using demo data.");
            // Mock Data Fallback
            if (userData.type === 'restaurant' || userData.type === 'vendor') {
                listings = [
                    { id: 1001, vendorName: "Mathsya Mess (Demo)", description: "20 Plates of Vegetable Biryani", quantity: "20 Plates", pickupTime: "Before 10 PM", status: "available" },
                    { id: 1002, vendorName: "Mathsya Mess (Demo)", description: "10 KG Artisan Bread", quantity: "10 KG", pickupTime: "Anytime", status: "claimed" }
                ];
            } else {
                listings = [
                    { id: 1001, vendorName: "Mathsya Mess (Demo)", description: "20 Plates of Vegetable Biryani", quantity: "20 Plates", pickupTime: "Before 10 PM", status: "available" },
                    { id: 1003, vendorName: "Annapoorna Catering", description: "50 Servings of Lentil Soup", quantity: "50 Servings", pickupTime: "Before 9 PM", status: "available" },
                    { id: 1004, vendorName: "Green Leaf Salads", description: "15 Fresh Garden Salads", quantity: "15 Salads", pickupTime: "ASAP", status: "available" }
                ];
            }
        }

        loader.style.display = 'none';
        listingsFeed.innerHTML = '';

        if (listings.length === 0) {
            listingsFeed.innerHTML = `
                <div class="empty-state w-100" style="grid-column: 1 / -1;">
                    <i class="fa-solid fa-box-open"></i>
                    <p>No listings found yet.</p>
                </div>
            `;
        }

        const greenRouteContainer = document.getElementById('greenRouteContainer');
        const greenRouteFeed = document.getElementById('greenRouteFeed');
        
        if (greenRouteFeed) {
            greenRouteFeed.innerHTML = '';
        }
        
        let hasGreenRoute = false;

        listings.forEach(item => {
            const card = document.createElement('div');
            
            const isClaimed = item.status === 'claimed';
            const statusHtml = `<span class="status-badge ${isClaimed ? 'status-claimed' : 'status-available'}">${item.status}</span>`;
            
            // Only show Claim button for NGOs on available items
            let actionBtn = '';
            if (userData.type === 'ngo' && !isClaimed) {
                actionBtn = `<button class="btn btn-primary w-100 btn-claim" data-id="${item.id}">Claim Food <i class="fa-solid fa-hand-holding-heart"></i></button>`;
            }

            card.innerHTML = `
                <div class="d-flex justify-between" style="margin-bottom: 10px;">
                    <span class="vendor-name">${item.vendorName}</span>
                    ${statusHtml}
                </div>
                <h4 class="food-desc">${item.description || item.name}</h4>
                <div class="food-meta">
                    <div><i class="fa-solid fa-weight-hanging"></i> Quantity: ${item.quantity}</div>
                    <div><i class="fa-solid fa-clock"></i> Pickup: ${item.pickupTime}</div>
                </div>
                ${actionBtn}
            `;
            
            if (item.is_green_route && (userData.type === 'restaurant' || userData.type === 'vendor')) {
                card.className = 'food-card green-route-card animate-on-scroll fade-up';
                // Override status html for green route
                card.innerHTML = `
                    <div class="d-flex justify-between" style="margin-bottom: 10px;">
                        <span class="vendor-name">${item.vendorName}</span>
                        <span class="status-badge" style="background: rgba(16, 185, 129, 0.2); color: #047857;"><i class="fa-solid fa-leaf"></i> Routed</span>
                    </div>
                    <h4 class="food-desc" style="color: #065f46;">${item.description || item.name}</h4>
                    <div class="food-meta" style="color: #064e3b; opacity: 0.8;">
                        <div><i class="fa-solid fa-weight-hanging"></i> Quantity: ${item.quantity}</div>
                        <div><i class="fa-solid fa-clock"></i> Status: Given back to Earth</div>
                    </div>
                `;
                if (greenRouteFeed) greenRouteFeed.appendChild(card);
                hasGreenRoute = true;
            } else {
                card.className = 'food-card animate-on-scroll fade-up';
                listingsFeed.appendChild(card);
            }
        });
        
        if (greenRouteContainer) {
            greenRouteContainer.style.display = hasGreenRoute ? 'block' : 'none';
        }

        // Add Event Listeners to Claim buttons
        document.querySelectorAll('.btn-claim').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('.btn-claim').dataset.id;
                claimFood(id);
            });
        });
    }

    // 5. Post New Surplus (Vendor Only)
    const postForm = document.getElementById('postFoodForm');
    if (postForm) {
        postForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = postForm.querySelector('button');
            const originalText = submitBtn.innerHTML;
            
            const isGreenRoute = document.getElementById('isGreenRoute')?.checked || false;
            const payload = {
                vendorId: userData.id,
                vendorName: userData.name || userData.email,
                name: document.getElementById('foodDesc').value, // Used name to pass validation
                description: document.getElementById('foodDesc').value,
                quantity: document.getElementById('foodQty').value,
                pickupTime: document.getElementById('pickupTime').value,
                isGreenRoute: isGreenRoute
            };

            submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Posting...';
            submitBtn.disabled = true;

            try {
                const response = await fetch(`${API_BASE}/listings`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    if (isGreenRoute) {
                        showToast("Your listing has been routed to our Green Partner 🌱");
                    } else {
                        showToast("Food listing shared successfully!");
                    }
                    postForm.reset();
                    fetchListings(); // Refresh feed
                } else {
                    showToast("Failed to post listing.", "error");
                }
            } catch (error) {
                showToast("Network error. Try again.", "error");
            } finally {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    // 6. Claim Food (NGO Only)
    async function claimFood(listingId) {
        if (!confirm("Are you sure you want to claim this food? Please ensure you can pick it up by the specified time.")) return;

        // Demo Mode Bypass
        if (localStorage.getItem('nourishToken')?.startsWith('demo-token')) {
            showToast("Food claimed successfully! (Demo Mode)");
            setTimeout(() => {
                // Mock refresh: find the item and change its status in the DOM or re-render
                const card = document.querySelector(`[data-id="${listingId}"]`).closest('.food-card');
                if (card) {
                    const badge = card.querySelector('.status-badge');
                    badge.innerText = 'claimed';
                    badge.className = 'status-badge status-claimed';
                    card.querySelector('.btn-claim')?.remove();
                }
            }, 500);
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/listings/claim`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({ listingId, ngoId: userData.id })
            });

            if (response.ok) {
                showToast("Food claimed successfully! Check your pickup details.");
                fetchListings();
            } else {
                showToast("Error claiming food.", "error");
            }
        } catch (error) {
            showToast("Network error.", "error");
        }
    }

    // Initial Load
    fetchListings();
});

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
        feedTitle.innerText = "My Surplus Postings";
    } else {
        ngoActionBox.style.display = 'block';
        feedTitle.innerText = "Available Surplus Food";
    }

    // 2. Logout Logic
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('nourishUser');
        window.location.href = 'index.html';
    });

    // 3. API Integration
    const API_BASE = '/api';

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
    async function fetchListings() {
        const listingsFeed = document.getElementById('listingsFeed');
        const loader = document.getElementById('listingsLoader');
        
        try {
            // If vendor, we want their specific listings. If NGO, we want all available.
            const queryParam = (userData.type === 'restaurant' || userData.type === 'vendor') ? `?vendorId=${userData.id}` : '';
            const response = await fetch(`${API_BASE}/listings${queryParam}`);
            const listings = await response.json();

            loader.style.display = 'none';
            listingsFeed.innerHTML = '';

            if (listings.length === 0) {
                listingsFeed.innerHTML = `
                    <div class="empty-state w-100" style="grid-column: 1 / -1;">
                        <i class="fa-solid fa-box-open"></i>
                        <p>No listings found yet.</p>
                    </div>
                `;
                return;
            }

            listings.forEach(item => {
                const card = document.createElement('div');
                card.className = 'food-card animate-on-scroll fade-up';
                
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
                    <h4 class="food-desc">${item.description}</h4>
                    <div class="food-meta">
                        <div><i class="fa-solid fa-weight-hanging"></i> Quantity: ${item.quantity}</div>
                        <div><i class="fa-solid fa-clock"></i> Pickup: ${item.pickupTime}</div>
                    </div>
                    ${actionBtn}
                `;
                
                listingsFeed.appendChild(card);
            });

            // Add Event Listeners to Claim buttons
            document.querySelectorAll('.btn-claim').forEach(btn => {
                btn.addEventListener('click', (e) => claimFood(e.target.dataset.id));
            });

        } catch (error) {
            console.error("Error fetching listings:", error);
            loader.innerHTML = '<p style="color: red;">Failed to load listings.</p>';
        }
    }

    // 5. Post New Surplus (Vendor Only)
    const postForm = document.getElementById('postFoodForm');
    if (postForm) {
        postForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = postForm.querySelector('button');
            const originalText = submitBtn.innerHTML;
            
            const payload = {
                vendorId: userData.id,
                vendorName: userData.name || userData.email,
                description: document.getElementById('foodDesc').value,
                quantity: document.getElementById('foodQty').value,
                pickupTime: document.getElementById('pickupTime').value
            };

            submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Posting...';
            submitBtn.disabled = true;

            try {
                const response = await fetch(`${API_BASE}/listings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    showToast("Food surplus posted correctly!");
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

        try {
            const response = await fetch(`${API_BASE}/listings/claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

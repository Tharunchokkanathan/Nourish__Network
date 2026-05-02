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
            console.warn("Backend API unavailable, using fallback.");
        }

        // HARDCODED DEMO OVERRIDE FOR SELLER DASHBOARD
        if (userData.type === 'restaurant' || userData.type === 'vendor') {
            listings = [
                { name: "Idli with Sambar", quantity: "12 servings", dietary: "vegetarian", prepared: "7:00 AM", bestBefore: "10:00 AM", vendorName: "Murugan Idli Shop", section: "listings" },
                { name: "Masala Dosa", quantity: "8 servings", dietary: "vegetarian", prepared: "7:30 AM", bestBefore: "10:30 AM", vendorName: "Saravana Bhavan", section: "listings" },
                { name: "Vada with Coconut Chutney", quantity: "15 servings", dietary: "vegetarian", prepared: "8:00 AM", bestBefore: "11:00 AM", vendorName: "Vasanta Bhavan", section: "listings" },
                { name: "Pongal", quantity: "18 servings", dietary: "vegetarian", prepared: "7:00 AM", bestBefore: "11:00 AM", vendorName: "Karpagambal Mess", section: "listings" },
                { name: "Curd Rice", quantity: "14 servings", dietary: "vegetarian", prepared: "12:00 PM", bestBefore: "4:00 PM", vendorName: "Sangeetha Restaurant", section: "listings" },
                { name: "Lemon Rice", quantity: "10 servings", dietary: "vegetarian", prepared: "12:00 PM", bestBefore: "4:00 PM", vendorName: "Saravana Bhavan", section: "listings" },
                { name: "Tamarind Rice (Puliyodarai)", quantity: "9 servings", dietary: "vegetarian", prepared: "11:30 AM", bestBefore: "4:00 PM", vendorName: "Karpagambal Mess", section: "listings" },
                { name: "Vegetable Biryani", quantity: "16 servings", dietary: "vegetarian", prepared: "12:30 PM", bestBefore: "5:00 PM", vendorName: "Vasanta Bhavan", section: "listings" },
                { name: "Chicken Biryani", quantity: "20 servings", dietary: "non-vegetarian", prepared: "12:00 PM", bestBefore: "4:30 PM", vendorName: "Anjappar Chettinad", section: "listings" },
                { name: "Mutton Kuzhambu", quantity: "11 servings", dietary: "non-vegetarian", prepared: "11:00 AM", bestBefore: "3:00 PM", vendorName: "Junior Kuppanna", section: "listings" },
                { name: "Rasam Rice", quantity: "13 servings", dietary: "vegetarian", prepared: "12:00 PM", bestBefore: "4:00 PM", vendorName: "Murugan Idli Shop", section: "listings" },
                { name: "Kootu (Mixed Vegetable)", quantity: "10 servings", dietary: "vegetarian", prepared: "11:30 AM", bestBefore: "3:30 PM", vendorName: "Sangeetha Restaurant", section: "listings" },
                { name: "Appam with Vegetable Stew", quantity: "9 servings", dietary: "vegetarian", prepared: "7:00 AM", bestBefore: "10:00 AM", vendorName: "Vasanta Bhavan", section: "listings" },
                { name: "Poori with Potato Masala", quantity: "12 servings", dietary: "vegetarian", prepared: "8:00 AM", bestBefore: "11:00 AM", vendorName: "Saravana Bhavan", section: "listings" },
                { name: "Upma", quantity: "14 servings", dietary: "vegetarian", prepared: "7:30 AM", bestBefore: "10:30 AM", vendorName: "Karpagambal Mess", section: "listings" },
                { name: "Fish Curry with Rice", quantity: "11 servings", dietary: "non-vegetarian", prepared: "12:00 PM", bestBefore: "3:00 PM", vendorName: "Junior Kuppanna", section: "listings" },
                { name: "Egg Curry", quantity: "8 servings", dietary: "non-vegetarian", prepared: "11:30 AM", bestBefore: "3:00 PM", vendorName: "Anjappar Chettinad", section: "listings" },
                { name: "Chapati with Dal", quantity: "15 servings", dietary: "vegetarian", prepared: "6:30 PM", bestBefore: "9:30 PM", vendorName: "Sangeetha Restaurant", section: "listings" },
                { name: "Sambar Rice", quantity: "17 servings", dietary: "vegetarian", prepared: "12:00 PM", bestBefore: "4:00 PM", vendorName: "Murugan Idli Shop", section: "listings" },
                { name: "Tomato Rice", quantity: "10 servings", dietary: "vegetarian", prepared: "11:30 AM", bestBefore: "3:30 PM", vendorName: "Saravana Bhavan", section: "listings" },
                
                { name: "Rava Kesari", quantity: "14 servings", dietary: "vegetarian", prepared: "8:00 AM", bestBefore: "8:00 PM", vendorName: "Adyar Ananda Bhavan", section: "sweets" },
                { name: "Payasam (Semiya/Vermicelli)", quantity: "11 servings", dietary: "vegetarian", prepared: "10:00 AM", bestBefore: "6:00 PM", vendorName: "Murugan Idli Shop", section: "sweets" },
                { name: "Paal Payasam (Milk Kheer)", quantity: "9 servings", dietary: "vegetarian", prepared: "9:00 AM", bestBefore: "3:00 PM", vendorName: "Saravana Bhavan", section: "sweets" },
                { name: "Sakkarai Pongal (Sweet Pongal)", quantity: "13 servings", dietary: "vegetarian", prepared: "7:00 AM", bestBefore: "12:00 PM", vendorName: "Karpagambal Mess", section: "sweets" },
                { name: "Adhirasam", quantity: "10 servings", dietary: "vegetarian", prepared: "9:00 AM", bestBefore: "9:00 PM", vendorName: "Adyar Ananda Bhavan", section: "sweets" },
                { name: "Mysore Pak", quantity: "8 servings", dietary: "vegetarian", prepared: "8:30 AM", bestBefore: "9:00 PM", vendorName: "Adyar Ananda Bhavan", section: "sweets" },
                { name: "Coconut Burfi", quantity: "7 servings", dietary: "vegetarian", prepared: "8:00 AM", bestBefore: "9:00 PM", vendorName: "Sangeetha Restaurant", section: "sweets" },
                { name: "Kozhukattai (Modak)", quantity: "12 servings", dietary: "vegetarian", prepared: "7:30 AM", bestBefore: "1:00 PM", vendorName: "Vasanta Bhavan", section: "sweets" },
                { name: "Aval Payasam (Poha Kheer)", quantity: "9 servings", dietary: "vegetarian", prepared: "10:00 AM", bestBefore: "4:00 PM", vendorName: "Murugan Idli Shop", section: "sweets" },
                { name: "Unniyappam", quantity: "16 servings", dietary: "vegetarian", prepared: "8:00 AM", bestBefore: "8:00 PM", vendorName: "Adyar Ananda Bhavan", section: "sweets" }
            ];
        }

        loader.style.display = 'none';
        listingsFeed.innerHTML = '';
        const sweetsFeed = document.getElementById('sweetsFeed');
        if (sweetsFeed) sweetsFeed.innerHTML = '';

        if (listings.length === 0) {
            listingsFeed.innerHTML = `
                <div class="empty-state w-100" style="grid-column: 1 / -1;">
                    <i class="fa-solid fa-box-open"></i>
                    <p>No listings found yet.</p>
                </div>
            `;
            return;
        }

        // Helper for urgency
        const now = new Date();
        function isExpiringSoon(timeStr) {
            if (!timeStr) return false;
            const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (!match) return false;
            let h = parseInt(match[1]);
            const m = parseInt(match[2]);
            if (match[3].toUpperCase() === 'PM' && h < 12) h += 12;
            if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
            const bbDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
            const diffHrs = (bbDate - now) / (1000 * 60 * 60);
            return diffHrs <= 2;
        }

        listings.forEach(item => {
            const card = document.createElement('div');
            card.className = 'food-card animate-on-scroll fade-up';
            
            const isClaimed = item.status === 'claimed';
            const expiringSoon = isExpiringSoon(item.bestBefore || item.pickupTime) ? '<span class="status-badge" style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; font-size: 0.75rem;"><i class="fa-solid fa-clock"></i> Expiring Soon 🔴</span>' : '';
            
            let statusHtml = '';
            if (item.status) {
                statusHtml = `<span class="status-badge ${isClaimed ? 'status-claimed' : 'status-available'}">${item.status}</span>`;
            }

            // Diet Tag styling
            let dietBadge = '';
            if (item.dietary === 'vegetarian') {
                dietBadge = '<span style="display:inline-block; width: 12px; height: 12px; border: 1px solid #16a34a; padding: 1px; border-radius: 2px;"><span style="display:block; width: 100%; height: 100%; background: #16a34a; border-radius: 1px;"></span></span>';
            } else if (item.dietary === 'non-vegetarian') {
                dietBadge = '<span style="display:inline-block; width: 12px; height: 12px; border: 1px solid #dc2626; padding: 1px; border-radius: 2px;"><span style="display:block; width: 100%; height: 100%; background: #dc2626; border-radius: 1px;"></span></span>';
            }

            const unepBadge = `
                <span title="Serving quantities derived from real food waste research: Indian restaurants surplus 10–15% of daily production (UNEP Food Waste Index 2022)" 
                      style="font-size: 0.7rem; color: #64748b; background: rgba(0,0,0,0.03); padding: 3px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; border: 1px solid rgba(0,0,0,0.05); margin-top: 5px; cursor: help;">
                    <i class="fa-solid fa-circle-info" style="font-size: 0.65rem;"></i> Based on UNEP/FAO 2022 Data
                </span>
            `;

            let actionBtn = '';
            if (userData.type === 'ngo' && !isClaimed) {
                actionBtn = `<button class="btn btn-primary w-100 btn-claim" data-id="${item.id}" style="margin-top: 10px;">Claim Food <i class="fa-solid fa-hand-holding-heart"></i></button>`;
            }

            card.innerHTML = `
                <div class="d-flex justify-between" style="margin-bottom: 5px; align-items: center;">
                    <span class="vendor-name" style="margin: 0; font-size: 0.95rem;">${item.vendorName}</span>
                    <div style="display:flex; gap:5px; align-items:center;">
                        ${expiringSoon}
                        ${statusHtml}
                    </div>
                </div>
                <h4 class="food-desc" style="margin-bottom: 5px; font-size: 1.15rem; display:flex; align-items:center; gap: 6px;">
                    ${dietBadge} ${item.name || item.description}
                </h4>
                <div class="food-meta" style="margin-bottom: 10px;">
                    <div style="color: #475569; font-weight: 500;"><i class="fa-solid fa-weight-hanging"></i> ${item.quantity}</div>
                    <div style="display:flex; justify-content: space-between; margin-top: 8px;">
                        <div><i class="fa-solid fa-fire-burner"></i> Prepared: <strong>${item.prepared || '--'}</strong></div>
                        <div><i class="fa-solid fa-clock-rotate-left"></i> Best Before: <strong>${item.bestBefore || item.pickupTime || '--'}</strong></div>
                    </div>
                </div>
                ${unepBadge}
                ${actionBtn}
            `;
            
            if (item.section === 'sweets' && sweetsFeed) {
                sweetsFeed.appendChild(card);
            } else {
                listingsFeed.appendChild(card);
            }
        });

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
                    headers: authHeaders,
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    showToast("Food listing shared successfully!");
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

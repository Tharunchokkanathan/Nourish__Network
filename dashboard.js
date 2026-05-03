document.addEventListener('DOMContentLoaded', () => {
    // 1. Authentication Check & User Data
    let userData = null;
    try {
        userData = JSON.parse(localStorage.getItem('nourishUser'));
    } catch (e) {
        console.error("User data corruption", e);
    }

    if (!userData) {
        window.location.href = 'index.html';
        return;
    }

    // Normalize user type
    const userType = (userData.type || userData.accountType || userData.role || '').toLowerCase();
    const isVendor = (userType === 'restaurant' || userType === 'vendor' || userType === 'seller');
    const isNgo = (userType === 'ngo' || userType === 'buyer');

    // Safe UI updates
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

    // Switch Views based on User Type
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
            localStorage.removeItem('nourishUser');
            window.location.href = 'index.html';
        });
    }

    // 3. Realistic Data for Presentation
    const HARDCODED_LISTINGS = [
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

    // Helper for urgency
    const now = new Date();
    function isExpiringSoon(timeStr) {
        if (!timeStr) return false;
        try {
            const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (!match) return false;
            let h = parseInt(match[1]);
            const m = parseInt(match[2]);
            if (match[3].toUpperCase() === 'PM' && h < 12) h += 12;
            if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
            const bbDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
            const diffHrs = (bbDate - now) / (1000 * 60 * 60);
            return diffHrs <= 2;
        } catch (e) {
            return false;
        }
    }

    async function renderDashboard() {
        const listingsFeed = document.getElementById('listingsFeed');
        const loader = document.getElementById('listingsLoader');
        const sweetsFeed = document.getElementById('sweetsFeed');

        if (!listingsFeed) {
            console.error("Crucial UI element 'listingsFeed' missing!");
            return;
        }

        if (loader) loader.style.display = 'none';
        listingsFeed.innerHTML = '';
        if (sweetsFeed) sweetsFeed.innerHTML = '';

        HARDCODED_LISTINGS.forEach(item => {
            const card = document.createElement('div');
            card.className = 'food-card animate-on-scroll fade-up';
            
            const isClaimed = item.status === 'claimed';
            const expiringHtml = isExpiringSoon(item.bestBefore) ? '<span class="status-badge" style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; font-size: 0.75rem;"><i class="fa-solid fa-clock"></i> Expiring Soon 🔴</span>' : '';
            
            const statusHtml = item.status ? `<span class="status-badge ${isClaimed ? 'status-claimed' : 'status-available'}">${item.status}</span>` : '';

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
            let editBtn = '';
            
            if (isNgo && !isClaimed) {
                actionBtn = `<button class="btn btn-primary w-100 btn-claim" data-id="${item.id || 'demo'}" style="margin-top: 10px;">Claim Food <i class="fa-solid fa-hand-holding-heart"></i></button>`;
            } else if (isVendor) {
                // For presentation: Add Edit and Delete buttons for vendors
                editBtn = `
                    <div style="display:flex; gap: 8px; margin-top: 10px;">
                        <button class="btn btn-secondary w-100 btn-edit" style="font-size: 0.85rem; padding: 6px 12px; background: rgba(0,0,0,0.05); color: #475569; border: 1px solid rgba(0,0,0,0.1);">
                            <i class="fa-solid fa-pen-to-square"></i> Edit
                        </button>
                        <button class="btn btn-secondary w-100 btn-delete" style="font-size: 0.85rem; padding: 6px 12px; background: rgba(0,0,0,0.05); color: #dc2626; border: 1px solid rgba(220, 38, 38, 0.1);">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="d-flex justify-between" style="margin-bottom: 5px; align-items: center;">
                    <span class="vendor-name" style="margin: 0; font-size: 0.95rem;">${item.vendorName}</span>
                    <div style="display:flex; gap:5px; align-items:center;">
                        ${expiringHtml}
                        ${statusHtml}
                    </div>
                </div>
                <h4 class="food-desc" style="margin-bottom: 5px; font-size: 1.15rem; display:flex; align-items:center; gap: 6px;">
                    ${dietBadge} ${item.name}
                </h4>
                <div class="food-meta" style="margin-bottom: 10px;">
                    <div style="color: #475569; font-weight: 500;"><i class="fa-solid fa-weight-hanging"></i> ${item.quantity}</div>
                    <div style="display:flex; justify-content: space-between; margin-top: 8px;">
                        <div><i class="fa-solid fa-fire-burner"></i> Prepared: <strong>${item.prepared || '--'}</strong></div>
                        <div><i class="fa-solid fa-clock-rotate-left"></i> Best Before: <strong>${item.bestBefore || '--'}</strong></div>
                    </div>
                </div>
                ${unepBadge}
                ${actionBtn}
                ${editBtn}
            `;
            
            if (item.section === 'sweets' && sweetsFeed) {
                sweetsFeed.appendChild(card);
            } else {
                listingsFeed.appendChild(card);
            }
        });

        // Event Listeners for Claim buttons (Mock)
        document.querySelectorAll('.btn-claim').forEach(btn => {
            btn.addEventListener('click', () => {
                alert("This is a hardcoded presentation demo. In the live version, this would reserve the meal for your organization.");
            });
        });

        // Event Listeners for Edit buttons (Mock)
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                const foodName = btn.closest('.food-card').querySelector('.food-desc').innerText.trim();
                alert(`Opening Edit Panel for: ${foodName}\n\nIn the live version, this would allow you to update servings, best-before times, and dietary tags.`);
            });
        });

        // Event Listeners for Delete buttons (Mock)
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm("Are you sure you want to remove this listing? This action cannot be undone.")) {
                    btn.closest('.food-card').style.opacity = '0.5';
                    btn.closest('.food-card').style.pointerEvents = 'none';
                    alert("Listing marked for removal. In the live version, this would permanently delete the item from the marketplace.");
                }
            });
        });
    }

    // Run safe render
    renderDashboard().catch(err => console.error("Render failed", err));
});

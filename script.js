// ---- GPS LIVE LOCATION ENGINE ----
// Requests browser geolocation after login/signup, reverse-geocodes to readable address,
// stores in session and syncs to server profile for delivery coordination.
window.__nnGpsRequested = false;
window.requestGPSLocation = function () {
    if (window.__nnGpsRequested) return; // Only request once per page session
    if (!navigator.geolocation) {
        console.warn('Geolocation not supported by this browser.');
        return;
    }

    window.__nnGpsRequested = true;

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = Math.round(position.coords.accuracy);

            // Store raw coords in session
            const user = JSON.parse(sessionStorage.getItem('nourishUser') || '{}');
            user.gpsLat = lat;
            user.gpsLng = lng;
            user.gpsAccuracy = accuracy;

            // Reverse geocode using OpenStreetMap Nominatim (free, no API key)
            let readableAddress = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            try {
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`, {
                    headers: { 'Accept-Language': 'en' }
                });
                if (geoRes.ok) {
                    const geoData = await geoRes.json();
                    if (geoData && geoData.address) {
                        const a = geoData.address;
                        // Build a concise address: suburb/neighbourhood, city/town, state
                        const parts = [
                            a.neighbourhood || a.suburb || a.village || a.hamlet || '',
                            a.city || a.town || a.county || a.state_district || '',
                            a.state || ''
                        ].filter(Boolean);
                        if (parts.length > 0) readableAddress = parts.join(', ');
                    }
                }
            } catch (e) {
                console.warn('Reverse geocode failed, using coordinates:', e);
            }

            user.gpsAddress = readableAddress;
            // Only update user.address if they haven't manually set one
            if (!user.address) {
                user.address = readableAddress;
            }

            sessionStorage.setItem('nourishUser', JSON.stringify(user));
            localStorage.setItem('nourishUser', JSON.stringify(user));

            // Show subtle toast
            if (typeof window.showToast === 'function' || (typeof showToast === 'function')) {
                const toastFn = window.showToast || showToast;
                toastFn(`📍 Location detected: ${readableAddress}`, 'success');
            }

            // Re-render portal to show updated location
            if (window.__appState && typeof window.__renderPortalFn === 'function') {
                window.__renderPortalFn();
            }

            // Sync GPS address to server profile (background, non-blocking)
            const token = sessionStorage.getItem('nourishToken');
            if (token && !token.startsWith('demo-token')) {
                try {
                    const API = window.__nnApiBase || '/api';
                    await fetch(`${API}/user/me`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ address: user.address })
                    });
                } catch (e) {
                    console.warn('GPS address sync to server failed:', e);
                }
            }
        },
        (error) => {
            console.warn('GPS location denied or unavailable:', error.message);
            window.__nnGpsRequested = false; // Allow retry on next login
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000 // Cache for 1 minute
        }
    );
};

// ---- GLOBAL DELETE COMMENT (must be outside DOMContentLoaded so onclick can find it) ----
window.deleteComment = function (commentId, btnEl) {
    const bubble = btnEl ? btnEl.closest('.comment-bubble') : null;

    // Animate out immediately
    if (bubble) {
        bubble.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        bubble.style.opacity = '0';
        bubble.style.transform = 'translateX(20px) scale(0.97)';
    }

    setTimeout(function () {
        // Read from localStorage, remove the comment, save back
        let comments = JSON.parse(localStorage.getItem('nn_comments') || '[]');
        comments = comments.filter(function (c) { return String(c.id) !== String(commentId); });
        localStorage.setItem('nn_comments', JSON.stringify(comments));

        // If the main app state is loaded, update it too and re-render
        if (window.__appState) {
            window.__appState.communityComments = comments;
            if (window.__renderCommunityWall) window.__renderCommunityWall();
            if (window.__renderPortalCommentList) window.__renderPortalCommentList();
            if (window.__renderReviewsSlider) window.__renderReviewsSlider();
        } else {
            // Fallback: just remove the bubble from DOM if state isn't ready
            if (bubble && bubble.parentNode) bubble.parentNode.removeChild(bubble);
        }

        // Show feedback
        if (window.__showToast) {
            window.__showToast('Comment deleted.', 'info');
        }
    }, 250);
};

// ---- SAFE EXPIRY HELPERS ----
window.isValidExpiry = function (dateStr) {
    if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return false;
    const d = new Date(dateStr);
    return !isNaN(d.getTime());
};

window.isItemExpired = function (dateStr) {
    if (!window.isValidExpiry(dateStr)) return false;
    return new Date(dateStr).getTime() < Date.now();
};

window.formatExpiryDisplay = function (dateStr) {
    if (!window.isValidExpiry(dateStr)) {
        return 'Fresh / Same-Day Pickup';
    }
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
};

window.getInitialCountdownStr = function (dateStr) {
    if (!window.isValidExpiry(dateStr)) return 'Fresh';
    const distance = new Date(dateStr).getTime() - Date.now();
    if (distance <= 0) return 'EXPIRED';
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
    const dayPrefix = days > 0 ? `${days}d ` : '';
    return (
        dayPrefix +
        String(hours).padStart(2, '0') + ':' +
        String(minutes).padStart(2, '0') + ':' +
        String(seconds).padStart(2, '0')
    );
};

// ---- FSSAI VALIDATION & DECODER HELPER ----
const FSSAI_STATES = {
    '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
    '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
    '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
    '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
    '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
    '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
    '25': 'Daman & Diu', '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra', '28': 'Andhra Pradesh',
    '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
    '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar', '36': 'Telangana', '37': 'Ladakh'
};

window.validateFSSAI = function (code) {
    if (!code) return { valid: false, message: '' };
    const clean = String(code).replace(/\D/g, '');
    if (clean.length === 0) return { valid: false, message: '' };
    if (clean.length !== 14) {
        return {
            valid: false,
            message: `14 digits required (${clean.length}/14 entered)`,
            clean
        };
    }

    const typeDigit = clean[0];
    const stateCode = clean.substring(1, 3);
    const yearCode = parseInt(clean.substring(3, 5), 10);
    const officerCode = clean.substring(5, 8);
    const serialNum = clean.substring(8, 14);

    let typeStr = '';
    if (typeDigit === '1') typeStr = 'Licensed Business';
    else if (typeDigit === '2') typeStr = 'Registered Operator';
    else {
        return {
            valid: false,
            message: 'First digit must be 1 (License) or 2 (Registration)',
            clean
        };
    }

    const stateName = FSSAI_STATES[stateCode];
    if (!stateName) {
        return {
            valid: false,
            message: `Invalid state code (${stateCode}). Expected 01–37`,
            clean
        };
    }

    const currentYearShort = (new Date().getFullYear()) % 100;
    if (isNaN(yearCode) || yearCode < 10 || yearCode > (currentYearShort + 1)) {
        return {
            valid: false,
            message: `Unlikely issuance year 20${clean.substring(3, 5)}. Expected 2010–20${currentYearShort + 1}`,
            clean
        };
    }

    return {
        valid: true,
        clean,
        typeStr,
        stateName,
        year: `20${clean.substring(3, 5)}`,
        serial: serialNum,
        message: `✓ Valid FSSAI: ${stateName} · ${typeStr} · Year 20${clean.substring(3, 5)}`
    };
};

// ---- NITI AAYOG NGO DARPAN VALIDATION HELPER ----
window.validateDARPAN = function (code) {
    if (!code) return { valid: false, message: 'NITI Aayog DARPAN ID is required' };
    const clean = code.trim().toUpperCase();
    const regex = /^([A-Z]{2})\/(\d{4})\/(\d{7})$/;
    const match = clean.match(regex);
    if (!match) {
        return { valid: false, message: 'Format: State/Year/7-digits (e.g. TN/2026/0123456)' };
    }
    const stateCode = match[1];
    const year = parseInt(match[2], 10);
    const stateName = FSSAI_STATES[stateCode] || stateCode;
    if (year < 1990 || year > 2027) {
        return { valid: false, message: 'Registration year must be between 1990 and 2027' };
    }
    return {
        valid: true,
        clean,
        stateCode,
        year,
        stateName,
        message: `✓ Valid DARPAN: ${stateName} · Year ${year}`
    };
};

// ---- STATE SOCIETY / TRUST DEED VALIDATOR ----
const INDIAN_STATES_2LETTERS = {
    'AN': 'Andaman & Nicobar', 'AP': 'Andhra Pradesh', 'AR': 'Arunachal Pradesh',
    'AS': 'Assam', 'BR': 'Bihar', 'CH': 'Chandigarh', 'CG': 'Chhattisgarh',
    'DN': 'Dadra & Nagar Haveli', 'DD': 'Daman & Diu', 'DL': 'Delhi', 'GA': 'Goa',
    'GJ': 'Gujarat', 'HR': 'Haryana', 'HP': 'Himachal Pradesh', 'JK': 'Jammu & Kashmir',
    'JH': 'Jharkhand', 'KA': 'Karnataka', 'KL': 'Kerala', 'LA': 'Ladakh',
    'LD': 'Lakshadweep', 'MP': 'Madhya Pradesh', 'MH': 'Maharashtra', 'MN': 'Manipur',
    'ML': 'Meghalaya', 'MZ': 'Mizoram', 'NL': 'Nagaland', 'OD': 'Odisha',
    'PB': 'Punjab', 'PY': 'Puducherry', 'RJ': 'Rajasthan', 'SK': 'Sikkim',
    'TN': 'Tamil Nadu', 'TS': 'Telangana', 'TR': 'Tripura', 'UP': 'Uttar Pradesh',
    'UK': 'Uttarakhand', 'WB': 'West Bengal'
};

window.validateTrustDeed = function (code) {
    if (!code) return { valid: false, message: 'Registration or Deed Number is required' };
    const clean = code.trim().toUpperCase().replace(/\s+/g, '');
    
    // Must contain numeric digits (e.g. serial/year number cannot be purely alphabetical text)
    const digits = clean.replace(/\D/g, '');
    if (digits.length < 3) {
        return { valid: false, message: 'Invalid format. Must include registration digits (e.g. SOC/TN/2022/04812)' };
    }
    
    // Must not contain invalid characters
    if (!/^[A-Z0-9\/\-]+$/.test(clean)) {
        return { valid: false, message: 'Use only letters, digits, slashes (/), or hyphens (-)' };
    }

    // Pattern 1: Structured Prefix / State / Year / Serial (e.g., SOC/TN/2022/04812 or TR/MH/2021/0149)
    const p1 = clean.match(/^(SOC|TR|TRUST|REG|SOCIETY)\/([A-Z]{2})\/(\d{4})\/([A-Z0-9]+)$/);
    if (p1) {
        const stateName = INDIAN_STATES_2LETTERS[p1[2]] || p1[2];
        const year = parseInt(p1[3], 10);
        if (year >= 1950 && year <= 2027) {
            return {
                valid: true,
                clean,
                stateName,
                year,
                serial: p1[4],
                message: `✓ Valid State Society: ${stateName} · Year ${year} (Reg #${p1[4]})`
            };
        }
    }

    // Pattern 2: State / Serial / Year or State / Year / Serial (e.g., TN/1248/2021 or MH/2020/0481)
    const p2 = clean.match(/^([A-Z]{2})\/(\d{1,8})\/(\d{4})$/);
    if (p2) {
        const stateName = INDIAN_STATES_2LETTERS[p2[1]];
        const year = parseInt(p2[3], 10);
        if (stateName && year >= 1950 && year <= 2027) {
            return {
                valid: true,
                clean,
                stateName,
                year,
                serial: p2[2],
                message: `✓ Valid Registered Deed: ${stateName} · Year ${year} (#${p2[2]})`
            };
        }
    }

    // Pattern 3: Prefix / State / Serial (e.g. SOC/TN/4812)
    const p3 = clean.match(/^(SOC|TR|TRUST|REG|SOCIETY)\/([A-Z]{2})\/([A-Z0-9\-]+)$/);
    if (p3) {
        const stateName = INDIAN_STATES_2LETTERS[p3[2]] || p3[2];
        return {
            valid: true,
            clean,
            stateName,
            serial: p3[3],
            message: `✓ Valid Registered Non-Profit: ${stateName} (Deed #${p3[3]})`
        };
    }

    // Pattern 4: General official deed number containing slash or hyphen and valid digits
    if (/^[A-Z0-9]{2,8}[\/\-][A-Z0-9\/\-]{3,18}$/.test(clean) && digits.length >= 4) {
        return {
            valid: true,
            clean,
            message: `✓ Valid Registered Trust Deed Record: ${clean}`
        };
    }

    return {
        valid: false,
        message: 'Invalid Trust/Society format (e.g. SOC/TN/2022/04812 or TR/MH/2021/00142)'
    };
};

// ---- UNIFIED NGO COMPLIANCE VALIDATOR ----
window.validateNGOCompliance = function (type, code) {
    if (!code) return { valid: true, optional: true, message: 'Optional field (leaves account unaccredited until provided)' };
    switch (type) {
        case 'trust':
            return window.validateTrustDeed(code);
        case 'darpan':
        default:
            return window.validateDARPAN(code);
    }
};

// ---- DYNAMIC NGO TRUST BADGE RENDERER ----
window.renderNgoTrustBadge = function (user) {
    const code = user.darpanId || user.darpanid || '';
    const type = user.ngoRegType || (code.includes('/') ? 'darpan' : 'trust');
    if (!code) {
        return '<span style="color:#f59e0b; font-size:0.75rem;"><i class="fa-solid fa-triangle-exclamation"></i> Accreditation not set — update in Settings</span>';
    }
    if (type === 'trust') {
        return `<span class="grassroots-trust-badge" style="font-size:0.75rem; padding: 3px 10px; border-radius: 12px; background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); display: inline-flex; align-items: center; gap: 5px;" title="Registered State Society / Trust Deed"><i class="fa-solid fa-hand-holding-heart"></i> <strong style="font-family:monospace; letter-spacing:1px;">${code}</strong> <span style="font-weight:700;">TRUST/SOCIETY</span></span>`;
    }
    return `<span class="darpan-trust-badge" style="font-size:0.75rem; padding: 3px 10px; border-radius: 12px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); display: inline-flex; align-items: center; gap: 5px;" title="NITI Aayog DARPAN Verified NGO"><i class="fa-solid fa-building-ngo"></i> <strong style="font-family:monospace; letter-spacing:1px;">${code}</strong> <span style="font-weight:700;">DARPAN</span></span>`;
};

// ---- CROP SELLER (FARMER / FPO / MANDI) COMPLIANCE VALIDATOR ----
window.validateCropSellerCompliance = function (type, code) {
    if (!code) return { valid: false, message: 'Agricultural trade accreditation ID is required' };
    const clean = code.trim().toUpperCase();
    if (type === 'fssai') {
        return window.validateFSSAI(clean);
    }
    if (type === 'apmc') {
        if (clean.length < 4) return { valid: false, message: 'APMC License must be at least 4 characters' };
        if (!/^[A-Z0-9\/\-]+$/.test(clean)) return { valid: false, message: 'Use only letters, numbers, hyphens or slashes' };
        const digits = clean.replace(/\D/g, '');
        if (digits.length < 2) return { valid: false, message: 'Must contain license registration numbers' };
        return { valid: true, clean, message: `✓ Valid APMC Mandi License: ${clean} · Registered Trader` };
    }
    if (type === 'fpo') {
        if (clean.length < 4) return { valid: false, message: 'FPO Registration must be at least 4 characters' };
        if (!/^[A-Z0-9\/\-]+$/.test(clean)) return { valid: false, message: 'Use only letters, numbers, hyphens or slashes' };
        return { valid: true, clean, message: `✓ Valid FPO Accreditation: ${clean} · Producer Co.` };
    }
    if (type === 'kisan') {
        const digits = clean.replace(/\D/g, '');
        if (digits.length < 5) return { valid: false, message: 'Kisan / KCC ID requires at least 5 digits' };
        return { valid: true, clean, message: `✓ Valid Kisan ID: ${clean} · Farm-Gate Registered` };
    }
    return { valid: true, clean, message: `✓ Valid Trade Accreditation: ${clean}` };
};

// ---- CROP BUYER (AGRO MSME / PROCESSOR) COMPLIANCE VALIDATOR ----
window.validateCropBuyerCompliance = function (type, code) {
    if (!code) return { valid: false, message: 'Agro-processing or MSME ID is required' };
    const clean = code.trim().toUpperCase();
    if (type === 'fssai') {
        return window.validateFSSAI(clean);
    }
    if (type === 'udyam') {
        const regex = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;
        if (!regex.test(clean)) {
            return { valid: false, message: 'Format: UDYAM-State-2digits-7digits (e.g. UDYAM-MH-12-0012345)' };
        }
        return { valid: true, clean, message: `✓ Valid Udyam MSME: ${clean} · Registered Agro-Unit` };
    }
    if (type === 'gstin') {
        if (clean.length !== 15) return { valid: false, message: `GSTIN must be 15 characters (${clean.length}/15 entered)` };
        if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(clean)) {
            return { valid: false, message: 'Invalid GSTIN format (e.g. 27AAAAA0000A1Z5)' };
        }
        return { valid: true, clean, message: `✓ Valid GSTIN: ${clean} · Commercial Entity` };
    }
    return { valid: true, clean, message: `✓ Valid Commercial ID: ${clean}` };
};

// ---- DYNAMIC CROP PORTAL TRUST BADGE RENDERER ----
window.renderCropTrustBadge = function (user) {
    if (!user) return '';
    const role = (user.accountType || user.type || '').toLowerCase();
    const code = user.darpanId || user.fssaiCode || '';
    const type = (user.ngoRegType || '').toLowerCase();

    if (role === 'crop_seller') {
        const label = type === 'apmc' ? 'APMC Mandi' : (type === 'fpo' ? 'FPO' : (type === 'kisan' ? 'Kisan ID' : 'Agri Trade'));
        if (code) {
            return `<span class="crop-trust-badge seller-badge" title="Verified Agricultural Producer"><i class="fa-solid fa-shield-halved"></i> <strong>${code}</strong> · ${label} Verified</span>`;
        }
        return `<span class="crop-trust-badge seller-badge"><i class="fa-solid fa-wheat-awn"></i> Verified Mandi / Farmer Collective</span>`;
    }
    if (role === 'crop_buyer') {
        const label = type === 'udyam' ? 'Udyam MSME' : (type === 'fssai' ? 'FSSAI Processor' : 'Industrial');
        if (code) {
            return `<span class="crop-trust-badge buyer-badge" title="Verified Agro-Processing Entity"><i class="fa-solid fa-circle-check"></i> <strong>${code}</strong> · ${label} Verified</span>`;
        }
        return `<span class="crop-trust-badge buyer-badge"><i class="fa-solid fa-industry"></i> Verified Agro-Processing MSME</span>`;
    }
    return '';
};

window.toLocalDateTimeLocalString = function (dateInput) {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

// ---- LIQUID GLASS CALENDAR COMPONENT HELPERS ----
window.stateLiquidCal = {
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    selectedDate: new Date(),
    hour: '10',
    min: '00',
    ampm: 'PM'
};

window.formatExpiryDisplay = function(isoStr) {
    if (!isoStr) return '';
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return '';
        const yyyy = d.getFullYear();
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const mm = monthNames[d.getMonth()];
        const dd = String(d.getDate()).padStart(2, '0');
        let hours24 = d.getHours();
        const ampm = hours24 >= 12 ? 'PM' : 'AM';
        let h12 = hours24 % 12;
        if (h12 === 0) h12 = 12;
        const hh = String(h12).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${dd} ${mm} ${yyyy}, ${hh}:${min} ${ampm}`;
    } catch (e) {
        return '';
    }
};

window.toggleLiquidGlassCalendar = function(e) {
    if (e) {
        if (e.stopPropagation) e.stopPropagation();
        if (e.preventDefault) e.preventDefault();
    }
    const card = document.getElementById('liquid-calendar-card');
    if (!card) return;

    const isActive = card.classList.contains('active');
    if (isActive) {
        card.classList.remove('active');
    } else {
        const wrapper = card.closest('.manual-glass-input-wrapper') || card.parentElement;
        if (wrapper) {
            const rect = wrapper.getBoundingClientRect();
            // If space below is less than 340px or could collide with bottom dock, open upwards
            if (window.innerHeight - rect.bottom < 340) {
                card.classList.add('open-upwards');
            } else {
                card.classList.remove('open-upwards');
            }
        }

        const expiryInput = document.getElementById('p-expiry');
        if (expiryInput && expiryInput.value) {
            window.setLiquidPickerFromISO(expiryInput.value);
        } else if (!window.stateLiquidCal || !window.stateLiquidCal.selectedDate || isNaN(new Date(window.stateLiquidCal.selectedDate).getTime())) {
            const now = new Date();
            const future = new Date(now.getTime() + 4 * 3600 * 1000);
            let hours24 = future.getHours();
            let mins = Math.round(future.getMinutes() / 5) * 5;
            if (mins >= 60) mins = 55;
            let h12 = hours24 % 12;
            if (h12 === 0) h12 = 12;
            window.stateLiquidCal = {
                year: future.getFullYear(),
                month: future.getMonth(),
                selectedDate: future,
                hour: String(h12).padStart(2, '0'),
                min: String(mins).padStart(2, '0'),
                ampm: hours24 >= 12 ? 'PM' : 'AM'
            };
        }
        window.renderLiquidCalendar();
        card.classList.add('active');
    }
};

window.changeLiquidMonth = function(delta) {
    window.stateLiquidCal.month += delta;
    if (window.stateLiquidCal.month > 11) {
        window.stateLiquidCal.month = 0;
        window.stateLiquidCal.year++;
    } else if (window.stateLiquidCal.month < 0) {
        window.stateLiquidCal.month = 11;
        window.stateLiquidCal.year--;
    }
    window.renderLiquidCalendar();
};

window.selectLiquidDay = function(e, year, month, day) {
    if (e) {
        if (e.stopPropagation) e.stopPropagation();
        if (e.preventDefault) e.preventDefault();
    }
    window.stateLiquidCal.selectedDate = new Date(year, month, day);
    window.renderLiquidCalendar();
};

window.toggleLiquidAmPm = function() {
    window.stateLiquidCal.ampm = window.stateLiquidCal.ampm === 'AM' ? 'PM' : 'AM';
    const ampmBtn = document.getElementById('lg-time-ampm');
    if (ampmBtn) ampmBtn.textContent = window.stateLiquidCal.ampm;
};

window.updateLiquidTimeFromSelect = function() {
    const hourSelect = document.getElementById('lg-time-hour');
    const minSelect = document.getElementById('lg-time-min');
    if (hourSelect) window.stateLiquidCal.hour = hourSelect.value;
    if (minSelect) window.stateLiquidCal.min = minSelect.value;
};

window.clearLiquidCalendar = function() {
    const hiddenExpiry = document.getElementById('p-expiry');
    const displayExpiry = document.getElementById('p-expiry-display');
    if (hiddenExpiry) hiddenExpiry.value = '';
    if (displayExpiry) displayExpiry.value = '';
    const card = document.getElementById('liquid-calendar-card');
    if (card) card.classList.remove('active');
};

window.resetLiquidCalendar = function() {
    window.clearLiquidCalendar();
};

window.applyLiquidPreset = function(preset) {
    const now = new Date();
    let target = new Date();
    if (preset === 2) {
        target = new Date(now.getTime() + 2 * 3600 * 1000);
    } else if (preset === 4) {
        target = new Date(now.getTime() + 4 * 3600 * 1000);
    } else if (preset === 'tonight') {
        target = new Date(now);
        target.setHours(22, 0, 0, 0);
        if (target.getTime() <= now.getTime()) {
            target = new Date(now.getTime() + 24 * 3600 * 1000);
            target.setHours(22, 0, 0, 0);
        }
    } else if (preset === 'tomorrow') {
        target = new Date(now.getTime() + 24 * 3600 * 1000);
        target.setHours(12, 0, 0, 0);
    }

    let hours24 = target.getHours();
    let mins = Math.round(target.getMinutes() / 5) * 5;
    if (mins >= 60) mins = 55;
    let ampm = hours24 >= 12 ? 'PM' : 'AM';
    let h12 = hours24 % 12;
    if (h12 === 0) h12 = 12;

    window.stateLiquidCal = {
        year: target.getFullYear(),
        month: target.getMonth(),
        selectedDate: target,
        hour: String(h12).padStart(2, '0'),
        min: String(mins).padStart(2, '0'),
        ampm: ampm
    };

    window.renderLiquidCalendar();
    window.confirmLiquidCalendar();
};

window.confirmLiquidCalendar = function(e) {
    if (e) {
        if (e.stopPropagation) e.stopPropagation();
        if (e.preventDefault) e.preventDefault();
    }
    let sel = window.stateLiquidCal && window.stateLiquidCal.selectedDate;
    if (!sel || typeof sel.getFullYear !== 'function' || isNaN(sel.getTime())) {
        sel = new Date();
    }
    const yyyy = sel.getFullYear();
    const mm = String(sel.getMonth() + 1).padStart(2, '0');
    const dd = String(sel.getDate()).padStart(2, '0');

    let hour12 = parseInt(window.stateLiquidCal.hour) || 12;
    let ampm = window.stateLiquidCal.ampm || 'PM';
    let hour24 = hour12;
    if (ampm === 'PM') {
        if (hour12 < 12) hour24 = hour12 + 12;
    } else {
        if (hour12 === 12) hour24 = 0;
    }
    const hhStr = String(hour24).padStart(2, '0');
    const minStr = window.stateLiquidCal.min || '00';

    const isoStr = `${yyyy}-${mm}-${dd}T${hhStr}:${minStr}`;
    
    const hiddenExpiry = document.getElementById('p-expiry');
    if (hiddenExpiry) hiddenExpiry.value = isoStr;

    const displayExpiry = document.getElementById('p-expiry-display');
    if (displayExpiry && typeof window.formatExpiryDisplay === 'function') {
        displayExpiry.value = window.formatExpiryDisplay(isoStr);
    }

    const card = document.getElementById('liquid-calendar-card');
    if (card) card.classList.remove('active');
};

window.setLiquidPickerFromISO = function(isoStr) {
    if (!isoStr) return;
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return;
        if (!window.stateLiquidCal) window.stateLiquidCal = {};
        window.stateLiquidCal.year = d.getFullYear();
        window.stateLiquidCal.month = d.getMonth();
        window.stateLiquidCal.selectedDate = d;
        
        let hours24 = d.getHours();
        let mins = d.getMinutes();
        mins = Math.round(mins / 5) * 5;
        if (mins >= 60) mins = 55;

        window.stateLiquidCal.ampm = hours24 >= 12 ? 'PM' : 'AM';
        let h12 = hours24 % 12;
        if (h12 === 0) h12 = 12;
        window.stateLiquidCal.hour = String(h12).padStart(2, '0');
        window.stateLiquidCal.min = String(mins).padStart(2, '0');

        const displayExpiry = document.getElementById('p-expiry-display');
        if (displayExpiry && typeof window.formatExpiryDisplay === 'function') {
            displayExpiry.value = window.formatExpiryDisplay(isoStr);
        }

        if (document.getElementById('lg-month-year')) {
            window.renderLiquidCalendar();
        }
    } catch (e) { }
};

window.renderLiquidCalendar = function() {
    const monthYearEl = document.getElementById('lg-month-year');
    const daysGrid = document.getElementById('lg-days-grid');
    const hourSelect = document.getElementById('lg-time-hour');
    const minSelect = document.getElementById('lg-time-min');
    const ampmBtn = document.getElementById('lg-time-ampm');

    if (!monthYearEl || !daysGrid) return;

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    monthYearEl.innerHTML = `${monthNames[window.stateLiquidCal.month]} ${window.stateLiquidCal.year} <i class="fa-solid fa-chevron-right" style="font-size:0.75rem; color:#3b82f6;"></i>`;

    if (hourSelect && hourSelect.children.length === 0) {
        hourSelect.innerHTML = Array.from({length: 12}, (_, i) => {
            const val = String(i + 1).padStart(2, '0');
            return `<option value="${val}">${val}</option>`;
        }).join('');
    }
    if (minSelect && minSelect.children.length === 0) {
        const minsArr = ["00","05","10","15","20","25","30","35","40","45","50","55"];
        minSelect.innerHTML = minsArr.map(m => `<option value="${m}">${m}</option>`).join('');
    }

    if (hourSelect) hourSelect.value = window.stateLiquidCal.hour;
    if (minSelect) minSelect.value = window.stateLiquidCal.min;
    if (ampmBtn) ampmBtn.textContent = window.stateLiquidCal.ampm;

    const firstDay = new Date(window.stateLiquidCal.year, window.stateLiquidCal.month, 1);
    const lastDay = new Date(window.stateLiquidCal.year, window.stateLiquidCal.month + 1, 0);

    let startDayIdx = firstDay.getDay() - 1;
    if (startDayIdx < 0) startDayIdx = 6;

    const prevMonthLastDay = new Date(window.stateLiquidCal.year, window.stateLiquidCal.month, 0).getDate();
    const totalDays = lastDay.getDate();

    let daysHtml = '';

    for (let i = startDayIdx - 1; i >= 0; i--) {
        const pDay = prevMonthLastDay - i;
        daysHtml += `<div class="lg-day-cell other-month">${pDay}</div>`;
    }

    const today = new Date();
    const selDate = (window.stateLiquidCal.selectedDate && typeof window.stateLiquidCal.selectedDate.getFullYear === 'function') ? window.stateLiquidCal.selectedDate : null;

    for (let d = 1; d <= totalDays; d++) {
        const isToday = today.getFullYear() === window.stateLiquidCal.year &&
                        today.getMonth() === window.stateLiquidCal.month &&
                        today.getDate() === d;
        const isSel = selDate &&
                      selDate.getFullYear() === window.stateLiquidCal.year &&
                      selDate.getMonth() === window.stateLiquidCal.month &&
                      selDate.getDate() === d;

        let classes = 'lg-day-cell';
        if (isToday) classes += ' today';
        if (isSel) classes += ' selected';

        daysHtml += `<div class="${classes}" onclick="window.selectLiquidDay(event, ${window.stateLiquidCal.year}, ${window.stateLiquidCal.month}, ${d})">${d}</div>`;
    }

    const totalCellsSoFar = startDayIdx + totalDays;
    const remainingCells = (7 - (totalCellsSoFar % 7)) % 7;
    for (let n = 1; n <= remainingCells; n++) {
        daysHtml += `<div class="lg-day-cell other-month">${n}</div>`;
    }

    daysGrid.innerHTML = daysHtml;
};

document.addEventListener('click', (e) => {
    const card = document.getElementById('liquid-calendar-card');
    if (!card || !card.classList.contains('active')) return;

    const path = e.composedPath ? e.composedPath() : [];
    const isInsideCard = card.contains(e.target) || path.includes(card);
    const isTriggerBtn = e.target.closest('.glass-calendar-icon-btn') || 
                         e.target.closest('.manual-glass-input-wrapper') || 
                         e.target.closest('#glass-picker-trigger') ||
                         path.some(el => el && el.classList && (el.classList.contains('glass-calendar-icon-btn') || el.classList.contains('manual-glass-input-wrapper')));
    const isOption = e.target.tagName === 'OPTION' || e.target.tagName === 'SELECT';

    if (!isInsideCard && !isTriggerBtn && !isOption) {
        card.classList.remove('active');
    }
});

document.addEventListener('DOMContentLoaded', () => {

    // 1. Configuration - Dynamic API Detection (works on localhost, Render, or any domain)
    const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000/api' : '/api';
    const portalsRoot = document.getElementById('nn-portals-root');
    const homePortal = document.getElementById('home-portal');

    // Cross-tab real-time inventory synchronization engine
    const syncChannel = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('nn_realtime_sync') : null;
    if (syncChannel) {
        syncChannel.onmessage = (event) => {
            if (event.data && (event.data.type === 'INVENTORY_CHANGED' || event.data.type === 'ORDER_PLACED')) {
                if (typeof refreshState === 'function') refreshState(true);
            }
        };
    }
    window.addEventListener('storage', (e) => {
        if (e.key === 'nn_sync_ping') {
            if (typeof refreshState === 'function') refreshState(true);
        }
    });

    function broadcastInventoryChange() {
        if (syncChannel) {
            try { syncChannel.postMessage({ type: 'INVENTORY_CHANGED', at: Date.now() }); } catch (e) {}
        }
        try { localStorage.setItem('nn_sync_ping', Date.now().toString()); } catch (e) {}
    }

    function resolveCustomImageUrl(rawUrl) {
        if (!rawUrl || typeof rawUrl !== 'string') return null;
        let url = rawUrl.trim();
        if (!url) return null;

        url = url.replace(/^["']|["']$/g, '').trim();

        // 1. Google Images Search Result URL (extract real image link from imgurl param)
        if (url.includes('google.') && url.includes('imgurl=')) {
            try {
                const match = url.match(/[?&]imgurl=([^&]+)/);
                if (match && match[1]) {
                    const decoded = decodeURIComponent(match[1]);
                    if (/^https?:\/\//i.test(decoded)) return decoded;
                }
            } catch (e) { }
        }

        // 2. Google Search Redirect URL (extract url param)
        if (url.includes('google.') && (url.includes('url=http') || url.includes('url=%'))) {
            try {
                const match = url.match(/[?&]url=([^&]+)/);
                if (match && match[1]) {
                    const decoded = decodeURIComponent(match[1]);
                    if (/^https?:\/\//i.test(decoded)) return decoded;
                }
            } catch (e) { }
        }

        // 3. Google Drive view/open/share URLs
        if (url.includes('drive.google.com')) {
            const driveIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
            if (driveIdMatch && driveIdMatch[1]) {
                return `https://lh3.googleusercontent.com/d/${driveIdMatch[1]}`;
            }
        }

        // 4. Google encrypted/thumbnail caches & Google user content
        if (url.includes('encrypted-tbn0.gstatic.com') || url.includes('lh3.googleusercontent.com') || url.includes('googleusercontent.com')) {
            return url;
        }

        // 5. Unsplash photo page to direct image
        if (url.includes('unsplash.com/photos/')) {
            try {
                const parts = url.split('unsplash.com/photos/')[1].split('?')[0].split('-');
                const photoId = parts[parts.length - 1];
                if (photoId) {
                    return `https://images.unsplash.com/photo-${photoId}?w=600&q=80`;
                }
            } catch (e) { }
        }

        // 6. Local uploads
        if (url.startsWith('/uploads')) {
            return (window.location.protocol === 'file:' ? 'http://localhost:3000' : '') + url;
        }

        // 7. Add https:// if user pasted without protocol (e.g. "i.imgur.com/...")
        if (!/^https?:\/\//i.test(url) && !url.startsWith('data:image/')) {
            if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\//.test(url)) {
                url = 'https://' + url;
            }
        }

        // 8. Direct http(s) or data URL
        if (/^(https?:\/\/|data:image\/)/i.test(url)) {
            return url;
        }

        return null;
    }

    window.resolveCustomImageUrl = resolveCustomImageUrl;

    function getSmartFoodImage(name, category, customImageUrl) {
        const resolved = resolveCustomImageUrl(customImageUrl);
        if (resolved && !resolved.includes('ba9599a7e63c')) {
            return resolved;
        }

        const title = (name || '').toLowerCase();
        const cat = (category || '').toLowerCase();

        // 1. Noodles / Maggi / Maggie / Chowmein / Ramen
        if (/maggi|maggie|noodle|ramen|chowmein|chow mein/i.test(title)) {
            return 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=600&q=80';
        }

        // 2. Pasta / Spaghetti / Lasagna / Macaroni / Penne
        if (/pasta|spaghetti|lasagna|macaroni|penne/i.test(title)) {
            return 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600&q=80';
        }

        // 3. Pizza
        if (/pizza/i.test(title)) {
            return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80';
        }

        // 4. Burger / Sandwich
        if (/burger/i.test(title)) {
            return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80';
        }
        if (/sandwich|toast|sub/i.test(title)) {
            return 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&q=80';
        }

        // 5. South Indian / Idli / Dosa / Sambar / Vada / Uttapam / Upma
        if (/idli|dosa|sambar|vada|uttapam|upma|pongal|chutney|south/i.test(title)) {
            return 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&q=80';
        }

        // 6. Biryani / Rice / Pulao / Fried Rice / Thali
        if (/biryani|rice|pulao|palao|khichdi|fried rice|thali/i.test(title)) {
            return 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&q=80';
        }

        // 7. Indian Curry / Paneer / Butter Chicken / Dal / Roti / Naan / Chole
        if (/paneer|curry|butter chicken|dal|gravy|roti|naan|paratha|chole|rajma|subzi|sabzi/i.test(title)) {
            return 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=600&q=80';
        }

        // 8. Salad / Veg / Healthy / Soup / Bowl
        if (/salad|sprouts|vegetable|veg|green|soup|bowl|healthy/i.test(title) || cat.includes('produce')) {
            return 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80';
        }

        // 9. Sweets / Dessert / Cake / Pastry / Donut / Bakery / Bread / Mithai
        if (/cake|sweet|mithai|dessert|pastry|donut|bread|bakery|cookie|halwa|gulab/i.test(title) || cat.includes('bakery')) {
            return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80';
        }

        // 10. Fruits / Produce / Juice / Beverages
        if (/fruit|apple|banana|mango|orange|juice|smoothie|drink/i.test(title)) {
            return 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=600&q=80';
        }

        // 11. Packaged Goods
        if (cat.includes('packaged')) {
            return 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&q=80';
        }

        // Universal Healthy Meal Bowl Default
        return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80';
    }

    window.applyFoodPreset = function (presetName, presetCategory) {
        const idEl = document.getElementById('p-id');
        const nameEl = document.getElementById('p-name');
        const catEl = document.getElementById('p-cat');
        const imgEl = document.getElementById('p-img');
        const cancelBtn = document.getElementById('cancel-edit-btn');
        const submitBtn = document.getElementById('submit-btn');

        if (idEl) idEl.value = '';
        if (nameEl) nameEl.value = presetName;
        if (catEl) catEl.value = presetCategory;
        if (imgEl) imgEl.value = '';
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-leaf"></i> Publish Listing';

        if (window.__showToast) {
            window.__showToast(`Preset "${presetName}" applied! 🌿`, 'info');
        }
    };

    // 1. Initial State
    const state = {
        activePortal: 'home',
        cart: [],
        listings: JSON.parse(localStorage.getItem('nn_cached_listings') || localStorage.getItem('nn_demo_listings') || '[]'),
        communityComments: (() => {
            let stored = [];
            try {
                stored = JSON.parse(localStorage.getItem('nn_comments') || '[]');
                // Cleanse any old fake pravatar reviews or Chef Marco
                stored = stored.filter(c => !c.name?.includes('Chef Marco') && !(c.img && c.img.includes('pravatar')));
            } catch (e) { stored = []; }

            if (stored && stored.length > 0) return stored;

            return [
                {
                    id: 'live-seller-1',
                    name: "IM A SELLER",
                    org: "Commercial Kitchen & Donor",
                    role: "seller",
                    text: "Nourish Network has completely streamlined how our commercial kitchen redistributes surplus meals. Food that used to risk going to waste now reaches local communities within the hour.",
                    stars: 5
                },
                {
                    id: 'live-buyer-1',
                    name: "IM A BUYER",
                    org: "Community NGO & Welfare",
                    role: "buyer",
                    text: "As a community recipient partner, accessing consistent, nutritious meal batches has been transformative. The real-time claims and pickup PIN codes make distribution dignified and reliable.",
                    stars: 5
                },
                {
                    id: 'live-buyer-2',
                    name: "Rajalakshmi Social Trust",
                    org: "Verified NGO Partner",
                    role: "buyer",
                    text: "The platform's verification standards and direct donor coordination give our shelter complete confidence. Every meal claimed directly impacts families in our care.",
                    stars: 5
                },
                {
                    id: 'live-seller-2',
                    name: "Ramesh Kitchens",
                    org: "Registered Food Provider",
                    role: "seller",
                    text: "Listing surplus batches takes less than 30 seconds. Knowing that untouched catering food feeds people instead of landfills gives our entire culinary team immense pride.",
                    stars: 5
                }
            ];
        })(),
        stats: { totalMealsSaved: 0, totalKgShared: 0, totalVendors: 0, totalNGOs: 0 }
    };

    // Ensure IDs exist and persist cleansed comments
    state.communityComments.forEach(c => {
        if (!c.id) { c.id = 'comment-' + Date.now() + '-' + Math.random().toString(36).slice(2); }
    });
    localStorage.setItem('nn_comments', JSON.stringify(state.communityComments));

    // Expose to global scope for window.deleteComment and GPS engine (defined outside DOMContentLoaded)
    window.__appState = state;
    window.__nnApiBase = API_BASE;
    window.__renderPortalFn = renderPortal;



    // --- GLOBAL DEMO ORDER HANDLER (THE NUCLEAR OPTION) ---
    window.placeOrderDemo = async function () {
        console.log("placeOrderDemo Fired");
        const btn = document.getElementById('confirm-claim');

        if (!state.cart || state.cart.length === 0) {
            if (typeof showToast === 'function') showToast("Your basket is empty!", "error");
            else alert("Your basket is empty!");
            return;
        }

        const originalHtml = btn ? btn.innerHTML : 'CONFIRM ORDER';

        const token = sessionStorage.getItem('nourishToken') || localStorage.getItem('nourishToken');
        if (!token) {
            if (typeof showToast === 'function') showToast("Please sign in as a verified NGO or recipient to place orders.", "warning");
            else alert("Please sign in to place an order.");
            const authModal = document.getElementById('authModal');
            if (authModal) authModal.classList.add('active');
            return;
        }

        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
            btn.disabled = true;
        }

        try {
            const user = JSON.parse(sessionStorage.getItem('nourishUser') || localStorage.getItem('nourishUser') || '{}');
            const notes = document.getElementById('claim-notes')?.value || '';

            const orderItems = state.cart.map(c => ({
                listingId: c.item.id,
                quantity: parseInt(c.qty, 10) || 1,
                price: parseFloat(c.item.price) || 0
            }));

            // Step 1: Call backend checkout API with strict database validation
            const res = await fetch(`${API_BASE}/checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ items: orderItems, notes })
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                // Checkout rejected (out of stock, insufficient remaining portions, or concurrency conflict)
                const errMsg = data.error || "Order could not be processed. Please check available quantities.";
                showToast(errMsg, "error");

                if (btn) {
                    btn.innerHTML = originalHtml;
                    btn.disabled = false;
                }

                // Immediately re-fetch true server inventory so user sees actual remaining stock
                if (typeof refreshState === 'function') {
                    await refreshState(false);
                }
                return;
            }

            // Step 2: Create rich counterparty order objects for instant real-time history display in both portals
            const newOrders = state.cart.map(c => {
                const qty = parseInt(c.qty, 10) || 1;
                const unitPrice = parseFloat(c.item.price) || 0;
                const isCropItem = c.item.isCrop || c.item.produceType === 'crop' || c.item.cropGrade != null || state.activePortal === 'crop_buyer';
                return {
                    orderId: 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                    listingId: c.item.id,
                    foodName: c.item.name || (isCropItem ? 'Surplus Crop Produce' : 'Surplus Food Meal'),
                    category: c.item.category || (isCropItem ? 'Agricultural Produce' : 'Cooked'),
                    cropGrade: c.item.cropGrade || (isCropItem ? 'Grade B' : null),
                    isCrop: isCropItem,
                    imageUrl: c.item.img || c.item.imageUrl || (isCropItem ? 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600&q=80' : ''),
                    unit: c.item.unit || (isCropItem ? 'Quintals' : 'portions'),
                    unitPrice: unitPrice,
                    quantity: qty,
                    totalPrice: unitPrice * qty,
                    orderStatus: 'confirmed',
                    notes: notes,
                    createdAt: new Date().toISOString(),
                    pickupTime: c.item.pickupTime || c.item.pickup || 'Ready for Pickup / Mandi Dispatch',

                    // Seller information (viewed in Buyer history)
                    vendorId: c.item.vendorId || c.item.vendorid || (isCropItem ? 777 : 888),
                    sellerId: c.item.vendorId || c.item.vendorid || (isCropItem ? 777 : 888),
                    sellerName: c.item.vendorName || c.item.vendorname || (isCropItem ? 'Green Valley Farmers FPO' : 'Elite Catering Services'),
                    sellerType: isCropItem ? 'crop_seller' : 'restaurant',
                    sellerEmail: c.item.vendorEmail || (isCropItem ? 'farmerdemo@gmail.com' : 'serverdemo@gmail.com'),
                    sellerPhone: c.item.vendorPhone || (isCropItem ? '+91 98765 12340' : '+91 98400 12345'),
                    sellerContactPerson: c.item.contactPerson || (isCropItem ? 'Verified Crop Producer' : 'Verified Seller Lead'),
                    sellerFssaiCode: c.item.fssaiCode || '',
                    sellerAddress: c.item.address || (isCropItem ? 'APMC Yard / Regional Mandi Hub' : '45, Sterling Road, Nungambakkam, Chennai'),
                    sellerPickupWindow: c.item.pickupWindow || (isCropItem ? '6:00 AM - 6:00 PM' : '9:00 PM - 11:00 PM'),
                    sellerAvatar: c.item.vendorAvatar || 'assets/default-avatar.jpg',

                    // Buyer information (viewed in Seller history)
                    buyerId: user.id || (isCropItem ? 666 : 999),
                    buyerName: user.organizationName || user.name || (isCropItem ? 'Sahyadri Agro-Processing MSME' : 'Global Outreach Foundation'),
                    buyerType: user.accountType || user.type || (isCropItem ? 'crop_buyer' : 'ngo'),
                    buyerEmail: user.email || (isCropItem ? 'buyeragridemo@gmail.com' : 'ngodemo@gmail.com'),
                    buyerPhone: user.publicPhone || user.phone || '+91 98765 56780',
                    buyerContactPerson: user.contactPerson || (isCropItem ? 'Agro Procurement Lead' : 'Verified NGO Lead'),
                    buyerDarpanId: user.darpanId || '',
                    buyerNgoRegType: user.ngoRegType || '',
                    buyerAddress: user.address || (isCropItem ? 'Sector 4, Agro-Processing Industrial Zone' : '12, Besant Nagar, Chennai'),
                    buyerAvatar: user.avatarUrl || 'assets/default-avatar.jpg'
                };
            });

            // Store in nn_local_orders
            let localOrders = [];
            try {
                localOrders = JSON.parse(localStorage.getItem('nn_local_orders') || '[]');
            } catch (e) { localOrders = []; }
            localOrders.unshift(...newOrders);
            localStorage.setItem('nn_local_orders', JSON.stringify(localOrders));

            // Log purchases for platform live impact stats
            const purchases = JSON.parse(localStorage.getItem('nn_purchases') || '[]');
            const totalPortions = state.cart.reduce((sum, item) => sum + (parseInt(item.qty, 10) || 1), 0);
            purchases.push({
                id: Date.now().toString(),
                buyerOrg: user.organizationName || user.name || (state.activePortal === 'crop_buyer' ? 'Agro Buyer' : 'NGO Partner'),
                qty: totalPortions,
                ts: Date.now()
            });
            localStorage.setItem('nn_purchases', JSON.stringify(purchases));

            // Also log to nn_crop_purchases for live agricultural impact box
            const cropPurchases = JSON.parse(localStorage.getItem('nn_crop_purchases') || '[]');
            state.cart.forEach(c => {
                const isCrop = c.item.isCrop || c.item.produceType === 'crop' || c.item.cropGrade != null || state.activePortal === 'crop_buyer';
                if (isCrop) {
                    const u = (c.item.unit || '').toLowerCase();
                    const factor = (u === 'quintal' || u === 'q') ? 100 : ((u === 'ton' || u === 'tonne') ? 1000 : 1);
                    const qty = parseInt(c.qty, 10) || 1;
                    cropPurchases.push({
                        cropId: c.item.id,
                        cropName: c.item.name || 'Crop Produce',
                        qty: qty,
                        kg: qty * factor,
                        date: new Date().toISOString()
                    });
                }
            });
            localStorage.setItem('nn_crop_purchases', JSON.stringify(cropPurchases));

            if (typeof updateLiveStats === 'function') {
                updateLiveStats();
                setTimeout(() => {
                    if (typeof animateStatBump === 'function') {
                        animateStatBump('listed');
                        animateStatBump('fulfilled');
                        animateStatBump('ngos');
                    }
                }, 100);
            }

            // Step 3: Clear cart and reset UI
            state.cart = [];
            if (typeof updateCartBadge === 'function') updateCartBadge();
            if (typeof renderCartItems === 'function') renderCartItems();

            const drawer = document.getElementById('cart-drawer');
            if (drawer) drawer.classList.remove('active');

            // Step 4: Show success modal and toast
            const modal = document.getElementById('successModal');
            if (modal) {
                modal.style.setProperty('display', 'flex', 'important');
            } else {
                alert("Order Placed Successfully!");
            }

            if (typeof showToast === 'function') showToast("Order Confirmed! 🌱", "success");

            // Step 5: Broadcast inventory change to all open tabs immediately
            if (typeof broadcastInventoryChange === 'function') {
                broadcastInventoryChange();
            }

            // Step 6: Refresh backend state immediately
            if (typeof refreshState === 'function') {
                await refreshState(false);
            }

            // Silently refresh history modal if open
            if (typeof loadPortalHistory === 'function') {
                loadPortalHistory(true);
            }

        } catch (e) {
            console.error("Order processing error:", e);
            showToast("Network error placing order. Please check your connection.", "error");
        } finally {
            if (btn) {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
        }
    };


    // --- ATTACH GLOBAL DOCK LISTENERS ---
    function wireDockButtons() {
        console.log("WireDockButtons: Initializing dock listeners...");

        const loginDock = document.getElementById('login-toggle-dock');
        if (loginDock) {
            loginDock.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("Dock: Login/Logout Clicked");
                const token = sessionStorage.getItem('nourishToken');
                if (token) {
                    logout(); // No confirm() — it blocks on GitHub Pages
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

        const historyDock = document.getElementById('history-toggle-dock');
        if (historyDock) {
            historyDock.onclick = (e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                console.log("Dock: History Clicked");
                if (typeof openHistoryModal === 'function') {
                    openHistoryModal();
                } else if (typeof window.openHistoryModal === 'function') {
                    window.openHistoryModal();
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

        const addCropDock = document.getElementById('add-crop-dock');
        if (addCropDock) {
            addCropDock.onclick = (e) => {
                e.preventDefault();
                console.log("Dock: Add Crop Clicked");
                if (window.openAddCropModal) window.openAddCropModal();
            };
        }

        const cropCartDock = document.getElementById('crop-cart-dock');
        if (cropCartDock) {
            cropCartDock.onclick = (e) => {
                e.preventDefault();
                console.log("Dock: Crop Cart Clicked");
                const drawer = document.getElementById('cart-drawer');
                if (drawer) {
                    drawer.classList.add('active');
                    if (typeof renderCartItems === 'function') renderCartItems();
                }
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

    // --- BACKEND SYNC ENGINE ---
    async function refreshState(silent = false) {
        try {
            const user = JSON.parse(sessionStorage.getItem('nourishUser') || '{}');
            let url = `${API_BASE}/listings?_t=${Date.now()}`;

            const listRes = await fetch(url, { cache: 'no-store' });
            if (listRes.ok) {
                const rawListings = await listRes.json();
                const apiListings = rawListings.map(item => {
                    const numericQty = parseInt(item.quantity != null ? item.quantity : item.qty, 10) || 0;
                    return {
                        ...item,
                        qty: numericQty,
                        quantity: String(numericQty),
                        originalQty: null,
                        expiry: item.expiryTime || item.expiry || null,
                        img: getSmartFoodImage(item.name, item.category, item.imageUrl || item.img)
                    };
                });
                // Merge in any demo listings saved to localStorage
                const demoListings = JSON.parse(localStorage.getItem('nn_demo_listings') || '[]');
                const deletedIds = JSON.parse(localStorage.getItem('nn_deleted_listings') || '[]');
                const apiIds = apiListings.map(l => l.id);
                // Only include demo listings that aren't sold out or deleted
                const uniqueDemoListings = demoListings.filter(d =>
                    !apiIds.includes(d.id) &&
                    !deletedIds.includes(String(d.id)) &&
                    d.status !== 'sold' &&
                    (parseInt(d.qty) || 0) > 0
                );

                // Only apply local purchase deductions to synthetic demo-only listings (not real PostgreSQL listings which are already atomically deducted in the database)
                const demoPurchasedIds = JSON.parse(localStorage.getItem('nn_demo_purchased_ids') || '[]');
                const filteredApiListings = apiListings.map(l => {
                    if (!String(l.id).startsWith('demo-')) return l;
                    const purchase = demoPurchasedIds.find(p => String(p.id) === String(l.id));
                    if (!purchase) return l;
                    const remainingQty = Math.max(0, (parseInt(l.qty) || 0) - (purchase.qtyBought || 0));
                    return { ...l, qty: remainingQty, status: remainingQty <= 0 ? 'sold' : l.status };
                }).filter(l => !deletedIds.includes(String(l.id)) && l.status !== 'sold' && (parseInt(l.qty) || 0) > 0);

                let combinedListings = [...uniqueDemoListings, ...filteredApiListings];
                state.listings = combinedListings;
            } else {
                // API failed — still load demo listings (filter sold-out and deleted ones)
                const allDemo = JSON.parse(localStorage.getItem('nn_demo_listings') || '[]');
                const deletedIds = JSON.parse(localStorage.getItem('nn_deleted_listings') || '[]');
                state.listings = allDemo.filter(d => !deletedIds.includes(String(d.id)) && d.status !== 'sold' && (parseInt(d.qty) || 0) > 0);
            }

            const statsRes = await fetch(`${API_BASE}/stats`);
            if (statsRes.ok) {
                state.stats = await statsRes.json();
                updateLiveStats();
            }

            // Sync live registered sellers & buyers into Voices of Impact
            try {
                const voicesRes = await fetch(`${API_BASE}/community-voices`);
                if (voicesRes.ok) {
                    const vData = await voicesRes.json();
                    if (vData.success && Array.isArray(vData.voices) && vData.voices.length > 0) {
                        const registeredComments = vData.voices.map(v => {
                            const isSeller = v.accountType === 'restaurant' || v.accountType === 'vendor';
                            return {
                                id: 'live-user-' + v.id,
                                name: v.organizationName,
                                org: isSeller ? 'Registered Food Partner' : 'Registered NGO Recipient',
                                role: isSeller ? 'seller' : 'buyer',
                                text: isSeller 
                                    ? "Listing and sharing surplus food through Nourish Network ensures our kitchen operations support local communities every single day."
                                    : "Claiming verified nutritious food provides dignified, vital meal support for the communities we serve across our district.",
                                stars: 5
                            };
                        });

                        const userComments = state.communityComments.filter(c => !c.id.startsWith('live-') && !c.id.startsWith('default-'));
                        state.communityComments = [...userComments, ...registeredComments];
                        if (typeof renderReviewsSlider === 'function') renderReviewsSlider();
                        if (typeof renderCommunityWall === 'function') renderCommunityWall();
                    }
                }
            } catch (e) { }

            try {
                localStorage.setItem('nn_cached_listings', JSON.stringify(state.listings));
            } catch (e) { }

            const newSnapshot = JSON.stringify(state.listings.map(l => ({ id: l.id, qty: l.qty, status: l.status, expiry: l.expiry, price: l.price })));
            const hasChanged = state._lastListingsSnapshot !== newSnapshot;
            state._lastListingsSnapshot = newSnapshot;

            // Guard against unrendered or desynced portal DOM
            const root = portalsRoot || document.getElementById('nn-portals-root');
            const isPortalVisible = root && root.style.display !== 'none' && root.dataset.activePortal === state.activePortal;

            if (!isPortalVisible && state.activePortal !== 'home') {
                // Portal was not rendered yet (e.g. freshly logged in) — mount it immediately
                renderPortal();
                syncDock();
            } else if (hasChanged || !silent) {
                // Only re-render listings if data has actually changed or an explicit non-silent refresh was requested
                if (state.activePortal === 'seller') {
                    if (typeof renderSellerListings === 'function') renderSellerListings();
                } else if (state.activePortal === 'buyer') {
                    if (typeof renderExchangeGrid === 'function') renderExchangeGrid();
                } else if (state.activePortal === 'crop_seller') {
                    if (typeof renderCropSellerPortal === 'function') renderCropSellerPortal();
                } else if (state.activePortal === 'crop_buyer') {
                    if (typeof renderCropBuyerPortal === 'function') renderCropBuyerPortal();
                }
            }

            // Silently refresh history if history modal is currently open
            const histModal = document.getElementById('historyModal');
            if (histModal && histModal.style.display !== 'none' && typeof loadPortalHistory === 'function') {
                loadPortalHistory(true);
            }

            if (typeof renderImpactMap === 'function') {
                renderImpactMap();
            }
        } catch (err) {
            console.error("Backend Sync Failed:", err);
            // Even if network fails, use cached or demo listings
            if (!state.listings || state.listings.length === 0) {
                const deletedIds = JSON.parse(localStorage.getItem('nn_deleted_listings') || '[]');
                const baseListings = JSON.parse(localStorage.getItem('nn_cached_listings') || localStorage.getItem('nn_demo_listings') || '[]');
                state.listings = baseListings.filter(l => !deletedIds.includes(String(l.id)));
            }
            if (state.activePortal === 'seller' && typeof renderSellerListings === 'function') {
                renderSellerListings();
            } else if (state.activePortal === 'buyer' && typeof renderExchangeGrid === 'function') {
                renderExchangeGrid();
            } else if (state.activePortal === 'crop_seller' && typeof renderCropSellerPortal === 'function') {
                renderCropSellerPortal();
            } else if (state.activePortal === 'crop_buyer' && typeof renderCropBuyerPortal === 'function') {
                renderCropBuyerPortal();
            }
        }
    }

    function getPortalForUserType(t) {
        const role = (t || '').toLowerCase();
        if (role === 'crop_seller' || role === 'farmer' || role === 'fpo') return 'crop_seller';
        if (role === 'crop_buyer' || role === 'processor' || role === 'agro_processor') return 'crop_buyer';
        if (role === 'restaurant' || role === 'vendor' || role === 'seller') return 'seller';
        return 'buyer';
    }

    // --- SESSION PERSISTENCE ---
    function checkSession() {
        console.log("Checking session...");
        // Auto-purge stale localStorage if no active tab session exists
        if (!sessionStorage.getItem('nourishUser') && localStorage.getItem('nourishUser')) {
            localStorage.removeItem('nourishUser');
            localStorage.removeItem('nourishToken');
        }

        const userStr = sessionStorage.getItem('nourishUser');
        const token = sessionStorage.getItem('nourishToken');
        if (userStr && token) {
            const user = JSON.parse(userStr);
            const type = (user.type || user.accountType || user.role || '').toLowerCase();
            state.activePortal = getPortalForUserType(type);
            console.log("Session found, active portal:", state.activePortal);
            sessionStorage.setItem('nourishUser', JSON.stringify(user));
            sessionStorage.setItem('nourishToken', token);
            document.documentElement.classList.add('user-logged-in');
            document.documentElement.classList.add('portal-pre-active');

            // Render instantly on frame 1 using cached session + cached listings (zero wait, zero flash)
            renderPortal();

            // Request GPS location for delivery coordination
            window.requestGPSLocation();

            // Background sync (silent mode - no screen flicker!)
            refreshState(true);

            // Auto-fetch fresh profile from DB to ensure badges (FSSAI/DARPAN) are always up-to-date
            if (!token.startsWith('demo-token')) {
                fetch(`${API_BASE}/user/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                .then(r => r.ok ? r.json() : null)
                .then(liveUser => {
                    if (liveUser && liveUser.id) {
                        const merged = { 
                            ...user, 
                            ...liveUser,
                            fssaiCode: liveUser.fssaiCode || liveUser.fssaicode || user.fssaiCode || user.fssaicode || '',
                            darpanId: liveUser.darpanId || liveUser.darpanid || user.darpanId || user.darpanid || ''
                        };
                        sessionStorage.setItem('nourishUser', JSON.stringify(merged));
                        localStorage.setItem('nourishUser', JSON.stringify(merged));
                        syncDock();
                    }
                })
                .catch(() => {});
            }
        } else {
            console.log("No session found.");
            state.activePortal = 'home';
            renderPortal();
            refreshState(true);
        }
    }

    function computeLocalStats() {
        const purchases = JSON.parse(localStorage.getItem('nn_purchases') || '[]');
        const demoListings = JSON.parse(localStorage.getItem('nn_demo_listings') || '[]');
        const cropPurchases = JSON.parse(localStorage.getItem('nn_crop_purchases') || '[]');

        // Meals Saved = total qty across all listings + purchased qty
        const listingMeals = state.listings.reduce((sum, l) => sum + (parseInt(l.qty) || parseInt(l.quantity) || 0), 0);
        const purchasedMeals = purchases.reduce((sum, p) => sum + (p.qty || 0), 0);
        const totalMeals = listingMeals + purchasedMeals;

        // KG Shared = ~0.35kg per portion (avg Indian meal weight)
        const totalKg = Math.round(totalMeals * 0.35);

        // Partner Restaurants = unique vendor IDs in listings
        const vendorIds = new Set(state.listings.map(l => l.vendorId).filter(Boolean));
        const totalVendors = Math.max(vendorIds.size, demoListings.length > 0 ? 1 : 0, state.listings.length > 0 ? 1 : 0);

        // NGOs Helped = unique buyer orgs from purchases, min 1 if any purchase
        const buyerOrgs = new Set(purchases.map(p => p.buyerOrg).filter(Boolean));
        const totalNGOs = buyerOrgs.size + (purchases.length > 0 ? 1 : 0);

        // Crops Rescued/Sold = calculate KG for crop harvests
        const cropListingsKg = state.listings.filter(l => l.cropGrade || l.produceType === 'crop').reduce((sum, l) => {
            const q = parseFloat(l.qty || l.quantity || 0);
            const u = (l.unit || '').toLowerCase();
            const factor = (u === 'quintal' || u === 'q') ? 100 : ((u === 'ton' || u === 'tonne') ? 1000 : 1);
            return sum + (q * factor);
        }, 0);
        const cropPurchasesKg = cropPurchases.reduce((sum, p) => sum + (p.kg || 0), 0);
        const totalCropsSaved = Math.round(cropListingsKg + cropPurchasesKg + 2450);

        return { totalMeals, totalKg, totalVendors, totalNGOs, totalCropsSaved };
    }

    function updateLiveStats() {
        const localStats = computeLocalStats();

        // Merge with API stats (take whichever is higher)
        const meals = Math.max(localStats.totalMeals, state.stats.totalMealsSaved || 0);
        const kg = Math.max(localStats.totalKg, state.stats.totalKgShared || 0);
        const vendors = Math.max(localStats.totalVendors, state.stats.totalVendors || 0);
        const ngos = Math.max(localStats.totalNGOs, state.stats.totalNGOs || 0);
        const crops = Math.max(localStats.totalCropsSaved, state.stats.totalCropsSaved || 0);

        const listedEl = document.querySelector('[data-target-stat="listed"]');
        const fulfilledEl = document.querySelector('[data-target-stat="fulfilled"]');
        const vendorsEl = document.querySelector('[data-target-stat="vendors"]');
        const ngosEl = document.querySelector('[data-target-stat="ngos"]');
        const cropsEl = document.querySelector('[data-target-stat="cropsSaved"]');

        if (listedEl) listedEl.setAttribute('data-target', meals);
        if (fulfilledEl) fulfilledEl.setAttribute('data-target', kg);
        if (vendorsEl) vendorsEl.setAttribute('data-target', vendors);
        if (ngosEl) ngosEl.setAttribute('data-target', ngos);
        if (cropsEl) cropsEl.setAttribute('data-target', crops);

        startCounters();
    }

    // Pulse animation when a stat number jumps
    function animateStatBump(statAttr) {
        const el = document.querySelector(`[data-target-stat="${statAttr}"]`);
        if (!el) return;
        el.style.transition = 'transform 0.2s ease, color 0.2s ease';
        el.style.transform = 'scale(1.4)';
        el.style.color = 'var(--accent-primary)';
        setTimeout(() => { el.style.transform = 'scale(1)'; el.style.color = ''; }, 300);
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

        // Newest first so the latest comment is always slide 1
        const commentsToShow = state.communityComments.slice().reverse();

        commentsToShow.forEach((comment, idx) => {

            let starsMarkup = '';
            for (let i = 0; i < 5; i++) {
                starsMarkup += `<i class="${i < Math.floor(comment.stars) ? 'fa-solid' : 'fa-regular'} fa-star"></i>`;
            }

            const isSeller = (comment.role === 'seller') || 
                             (comment.org && (comment.org.toLowerCase().includes('seller') || 
                                              comment.org.toLowerCase().includes('kitchen') || 
                                              comment.org.toLowerCase().includes('hotel') || 
                                              comment.org.toLowerCase().includes('catering') || 
                                              comment.org.toLowerCase().includes('donor') || 
                                              comment.org.toLowerCase().includes('vendor') || 
                                              comment.org.toLowerCase().includes('restaurant')));
            const roleClass = isSeller ? 'seller-avatar' : 'buyer-avatar';
            const roleTag = isSeller 
                ? '<span class="role-badge-tag role-badge-seller"><i class="fa-solid fa-utensils"></i> Verified Seller</span>' 
                : '<span class="role-badge-tag role-badge-buyer"><i class="fa-solid fa-hand-holding-heart"></i> Verified Buyer</span>';

            const initials = (comment.name || comment.org || 'NN')
                .replace(/[^a-zA-Z0-9 ]/g, '')
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map(w => w[0].toUpperCase())
                .join('') || 'NN';

            const avatarMarkup = (comment.img && !comment.img.includes('pravatar') && !comment.img.includes('default-avatar'))
                ? `<div class="avatar ${roleClass}"><img src="${comment.img}" alt="${comment.name}"></div>`
                : `<div class="avatar badge-avatar ${roleClass}"><span>${initials}</span></div>`;

            const slide = document.createElement('div');
            slide.className = `review-slide glass-card ${idx === 0 ? 'active' : ''}`;
            slide.innerHTML = `
                <div class="stars">${starsMarkup}</div>
                <p class="review-text">"${comment.text}"</p>
                <div class="reviewer">
                    ${avatarMarkup}
                    <div class="info">
                        <strong>${comment.name}</strong>
                        <span>${comment.org} &bull; ${roleTag}</span>
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

        function resetAutoAdvance() {
            if (sliderInterval) clearInterval(sliderInterval);
            if (slides.length > 1) {
                sliderInterval = setInterval(nextSlide, 5000);
            }
        }

        function goToSlide(idx) {
            currentSlide = idx;
            updateSlides();
            resetAutoAdvance();
        }

        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        if (prevBtn) {
            prevBtn.onclick = () => {
                prevSlide();
                resetAutoAdvance();
            };
        }
        if (nextBtn) {
            nextBtn.onclick = () => {
                nextSlide();
                resetAutoAdvance();
            };
        }

        // Mobile Touch Gesture Support (Fluid Swipe left/right)
        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;
        let touchEndY = 0;

        slider.addEventListener('touchstart', (e) => {
            if (!e.touches || e.touches.length === 0) return;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchEndX = touchStartX;
            touchEndY = touchStartY;
            if (sliderInterval) clearInterval(sliderInterval);
        }, { passive: true });

        slider.addEventListener('touchmove', (e) => {
            if (!e.touches || e.touches.length === 0) return;
            touchEndX = e.touches[0].clientX;
            touchEndY = e.touches[0].clientY;
        }, { passive: true });

        slider.addEventListener('touchend', () => {
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY)) {
                if (deltaX < 0) {
                    nextSlide(); // swipe left -> next slide
                } else {
                    prevSlide(); // swipe right -> previous slide
                }
            }
            resetAutoAdvance();
        }, { passive: true });

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
    // =========================================
    // AUTH MODAL LOGIC (MINIMAL LIQUID GLASS)
    // =========================================
    const authModal = document.getElementById('authModal');
    const closeModal = document.getElementById('closeModal');
    const loginView = document.getElementById('loginViewContainer');
    const registerView = document.getElementById('registerViewContainer');
    const toRegisterLink = document.getElementById('toRegisterLink');
    const toLoginLink = document.getElementById('toLoginLink');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const btnDemoSeller = document.getElementById('btn-demo-seller');
    const btnDemoBuyer = document.getElementById('btn-demo-buyer');

    // Open Modal from ALL "Join" / "Donate" buttons
    const joinButtons = document.querySelectorAll('a[href="#join"]');
    joinButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            authModal.classList.add('active');

            const btnText = btn.innerText.toLowerCase();
            if (btnText.includes('log in') || btnText.includes('login') || btnText.includes('sign in')) {
                showLoginForm();
            } else {
                showRegisterForm();
            }
        });
    });

    // Close Modal
    function closeAuthModal() {
        authModal.classList.remove('active');
        syncDock();
    }

    if (closeModal) closeModal.addEventListener('click', closeAuthModal);

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
        const loginEmailInput = document.getElementById('loginEmail');
        const loginPasswordInput = document.getElementById('loginPassword');
        if (loginEmailInput && loginEmailInput.value && loginEmailInput.value.includes('demo')) {
            loginEmailInput.value = '';
            if (loginPasswordInput) loginPasswordInput.value = '';
        }
        sessionStorage.removeItem('nourishUser');
        sessionStorage.removeItem('nourishToken');
        localStorage.removeItem('nourishUser');
        localStorage.removeItem('nourishToken');
        document.documentElement.classList.remove('user-logged-in');
        if (loginView && registerView) {
            registerView.style.display = 'none';
            loginView.style.display = 'block';
        }
        if (registerForm) registerForm.classList.remove('active');
        if (loginForm) loginForm.classList.add('active');
    }

    function showRegisterForm() {
        authModal.classList.add('active');
        if (loginView && registerView) {
            loginView.style.display = 'none';
            registerView.style.display = 'block';
        }
        if (loginForm) loginForm.classList.remove('active');
        if (registerForm) registerForm.classList.add('active');
    }

    if (toRegisterLink) {
        toRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            showRegisterForm();
        });
    }

    if (toLoginLink) {
        toLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            showLoginForm();
        });
    }

    window.showLoginForm = showLoginForm;
    window.showRegisterForm = showRegisterForm;


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
    // Expose for global deleteComment handler
    window.__showToast = showToast;
    window.__renderCommunityWall = () => renderCommunityWall();
    window.__renderPortalCommentList = () => renderPortalCommentList();
    window.__renderReviewsSlider = () => renderReviewsSlider();

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

    // Check if coming from email verification link (?verified=true or ?authToken=...)
    const urlParams = new URLSearchParams(window.location.search);
    const incomingAuthToken = urlParams.get('authToken');
    if (incomingAuthToken) {
        fetch(`${API_BASE}/user/me`, {
            headers: { 'Authorization': `Bearer ${incomingAuthToken}` }
        })
        .then(r => r.ok ? r.json() : null)
        .then(liveUser => {
            if (liveUser && liveUser.id) {
                sessionStorage.setItem('nourishUser', JSON.stringify(liveUser));
                sessionStorage.setItem('nourishToken', incomingAuthToken);
                localStorage.setItem('nourishUser', JSON.stringify(liveUser));
                localStorage.setItem('nourishToken', incomingAuthToken);
                document.documentElement.classList.add('user-logged-in');

                const t = (liveUser.type || liveUser.accountType || '').toLowerCase();
                state.activePortal = getPortalForUserType(t);
                showToast(`✨ Account verified! Welcome, ${liveUser.organizationName || liveUser.name || 'Partner'}! 🎉`, 'success');
                window.history.replaceState({}, document.title, window.location.pathname);
                renderPortal();
                syncDock();
                refreshState();
            }
        }).catch(() => {});
    } else if (urlParams.get('verified') === 'true') {
        const storedUser = sessionStorage.getItem('nourishUser') || localStorage.getItem('nourishUser');
        const storedToken = sessionStorage.getItem('nourishToken') || localStorage.getItem('nourishToken');
        if (storedUser && storedToken) {
            sessionStorage.setItem('nourishUser', storedUser);
            sessionStorage.setItem('nourishToken', storedToken);
            document.documentElement.classList.add('user-logged-in');

            const parsedUser = JSON.parse(storedUser);
            const t = (parsedUser.type || parsedUser.accountType || '').toLowerCase();
            state.activePortal = getPortalForUserType(t);
            showToast(`Email verified successfully! Welcome, ${parsedUser.name || 'Partner'} 🎉`, 'success');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    // Check if coming from password reset link (?resetToken=...)
    const resetToken = urlParams.get('resetToken');
    if (resetToken) {
        fetch(`${API_BASE}/verify-reset-token?token=${resetToken}`)
            .then(res => res.json())
            .then(data => {
                if (data.valid) {
                    const tokenInput = document.getElementById('resetTokenInput');
                    const subtitle = document.getElementById('resetPasswordSubtitle');
                    if (tokenInput) tokenInput.value = resetToken;
                    if (subtitle) subtitle.innerHTML = `Resetting password for <strong style="color: var(--accent-primary);">${data.email}</strong>`;

                    const resetModal = document.getElementById('resetPasswordModal');
                    if (resetModal) resetModal.classList.add('active');
                } else {
                    showToast(data.error || "Invalid or expired password reset link.", "error");
                }
            })
            .catch(() => showToast("Error validating password reset link.", "error"));

        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Check if user is already logged in
    const user = JSON.parse(sessionStorage.getItem('nourishUser') || 'null');
    const token = sessionStorage.getItem('nourishToken');
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
    if (btnDemoSeller) {
        btnDemoSeller.addEventListener('click', async () => {
            btnDemoSeller.disabled = true;
            btnDemoSeller.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Logging in...';
            try {
                const res = await fetch(`${API_BASE}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: 'serverdemo@gmail.com', password: 'demo123' })
                });
                const data = await res.json();
                if (res.ok && data.token) {
                    const demoSeller = {
                        ...data.user,
                        name: data.user.name || 'Elite Catering Services',
                        type: 'restaurant',
                        accountType: 'restaurant',
                        bio: 'Premium catering service in Chennai specializing in high-quality surplus gourmet meals for community impact.',
                        address: '45, Sterling Road, Nungambakkam, Chennai - 600034',
                        contactPerson: 'Verified Partner Lead',
                        publicPhone: '+91 98400 12345',
                        website: 'www.elitecatering.in',
                        fssaiCode: '12345678901234',
                        pickupWindow: '9:00 PM - 11:00 PM',
                        isVerified: true,
                        avatarUrl: 'assets/default-avatar.jpg'
                    };
                    sessionStorage.setItem('nourishUser', JSON.stringify(demoSeller));
                    sessionStorage.setItem('nourishToken', data.token);
                    document.documentElement.classList.add('user-logged-in');
                    state.activePortal = 'seller';
                    authModal.classList.remove('active');
                    showToast("Welcome back, Elite Catering! 🍽️");
                    renderPortal();
                    syncDock();
                    refreshState();
                } else {
                    showToast(data.error || "Demo login failed", "error");
                }
            } catch (e) {
                showToast("Network error. Please try again.", "error");
            } finally {
                btnDemoSeller.disabled = false;
                btnDemoSeller.innerHTML = '🍽️ Demo: Food Vendor';
            }
        });
    }

    if (btnDemoBuyer) {
        btnDemoBuyer.addEventListener('click', async () => {
            btnDemoBuyer.disabled = true;
            btnDemoBuyer.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Logging in...';
            try {
                const res = await fetch(`${API_BASE}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: 'ngodemo@gmail.com', password: 'demo123' })
                });
                const data = await res.json();
                if (res.ok && data.token) {
                    const demoBuyer = {
                        ...data.user,
                        name: data.user.name || 'Global Outreach Foundation',
                        type: 'ngo',
                        accountType: 'ngo',
                        bio: 'Non-profit organization dedicated to distributing fresh, nutritious meals to shelters and low-income families across the city.',
                        address: '12, Besant Nagar, Chennai - 600090',
                        contactPerson: 'Verified NGO Lead',
                        publicPhone: '+91 98840 56789',
                        website: 'www.globaloutreach.org',
                        pickupWindow: 'Any time after 9 PM',
                        isVerified: true,
                        avatarUrl: 'assets/default-avatar.jpg'
                    };
                    sessionStorage.setItem('nourishUser', JSON.stringify(demoBuyer));
                    sessionStorage.setItem('nourishToken', data.token);
                    document.documentElement.classList.add('user-logged-in');
                    state.activePortal = 'buyer';
                    authModal.classList.remove('active');
                    showToast("Welcome back, Global Outreach! 🤝");
                    renderPortal();
                    syncDock();
                    refreshState();
                } else {
                    showToast(data.error || "Demo login failed", "error");
                }
            } catch (e) {
                showToast("Network error. Please try again.", "error");
            } finally {
                btnDemoBuyer.disabled = false;
                btnDemoBuyer.innerHTML = '🤝 Demo: NGO / Shelter';
            }
        });
    }

    // --- Password Visibility Toggle ---
    const togglePasswordIcons = document.querySelectorAll('.toggle-password-icon');
    togglePasswordIcons.forEach(icon => {
        icon.addEventListener('click', () => {
            const targetId = icon.dataset.target;
            const input = document.getElementById(targetId);
            if (!input) return;

            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
                icon.style.color = 'var(--accent-primary)';
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
                icon.style.color = 'var(--text-muted)';
            }
        });
    });

    // --- Forgot Password Link Click ---
    const forgotLinks = document.querySelectorAll('.forgot-link');
    forgotLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            authModal.classList.remove('active');
            const forgotModal = document.getElementById('forgotPasswordModal');
            if (forgotModal) {
                const loginEmailInput = document.getElementById('loginEmail');
                const emailVal = (loginEmailInput ? loginEmailInput.value.trim() : '') || localStorage.getItem('last_login_email') || '';

                const preFilledCard = document.getElementById('forgotEmailPreFilledCard');
                const displayEl = document.getElementById('forgotTargetEmailDisplay');
                const inputGroup = document.getElementById('forgotEmailInputGroup');
                const emailInput = document.getElementById('forgotEmail');
                const changeLink = document.getElementById('changeForgotEmailLink');

                if (emailVal) {
                    if (displayEl) displayEl.innerText = emailVal;
                    if (emailInput) emailInput.value = emailVal;
                    if (preFilledCard) preFilledCard.style.display = 'block';
                    if (inputGroup) inputGroup.style.display = 'none';
                    if (changeLink) changeLink.style.display = 'inline-block';
                } else {
                    if (preFilledCard) preFilledCard.style.display = 'none';
                    if (inputGroup) inputGroup.style.display = 'block';
                    if (changeLink) changeLink.style.display = 'none';
                    if (emailInput) {
                        emailInput.value = '';
                        setTimeout(() => emailInput.focus(), 150);
                    }
                }

                forgotModal.classList.add('active');
            }
        });
    });

    const changeForgotEmailLink = document.getElementById('changeForgotEmailLink');
    if (changeForgotEmailLink) {
        changeForgotEmailLink.addEventListener('click', (e) => {
            e.preventDefault();
            const preFilledCard = document.getElementById('forgotEmailPreFilledCard');
            const inputGroup = document.getElementById('forgotEmailInputGroup');
            const emailInput = document.getElementById('forgotEmail');
            if (preFilledCard) preFilledCard.style.display = 'none';
            if (inputGroup) inputGroup.style.display = 'block';
            changeForgotEmailLink.style.display = 'none';
            if (emailInput) emailInput.focus();
        });
    }

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

                // Save user, email and JWT token
                localStorage.setItem('last_login_email', email);
                sessionStorage.setItem('nourishUser', JSON.stringify(data.user));
                if (data.token) sessionStorage.setItem('nourishToken', data.token);
                document.documentElement.classList.add('user-logged-in');

                setTimeout(() => {
                    authModal.classList.remove('active');
                    if (data.user) {
                        const t = (data.user.type || data.user.accountType || data.user.role || '').toLowerCase();
                        state.activePortal = getPortalForUserType(t);
                    }
                    renderPortal();
                    syncDock();
                    refreshState();

                    // Request GPS location after login
                    window.requestGPSLocation();
                }, 1000);
            } else if (response.status === 403 && data.unverified) {
                showToast(data.error || "Please verify your email address first.", "warning");
                authModal.classList.remove('active');
                const sentEmailEl = document.getElementById('verifySentEmail');
                if (sentEmailEl) sentEmailEl.innerText = data.email || email;
                const emailModal = document.getElementById('emailVerifyModal');
                if (emailModal) emailModal.classList.add('active');
                const otpInput = document.getElementById('verifyOtpInput');
                if (otpInput) {
                    otpInput.value = '';
                    setTimeout(() => otpInput.focus(), 300);
                }
                startVerificationPolling(data.email || email);
            } else {
                showToast(data.error || "Login failed", "error");
            }
        } catch (error) {
            showToast("Network error. Is the server running?", "error");
        } finally {
            setLoading(submitBtn, false, originalText);
        }
    });

    // 1b. Cross-Device Account Verification Auto-Sync
    // When a user signs up on laptop and opens their email on phone to tap verify,
    // this polling loop auto-detects it and signs the laptop in immediately!
    let verificationPollInterval = null;

    function stopVerificationPolling() {
        if (verificationPollInterval) {
            clearInterval(verificationPollInterval);
            verificationPollInterval = null;
        }
    }

    function startVerificationPolling(email) {
        stopVerificationPolling();
        if (!email) return;

        const startTime = Date.now();
        const maxTimeoutMs = 15 * 60 * 1000; // 15 minutes

        verificationPollInterval = setInterval(async () => {
            if (Date.now() - startTime > maxTimeoutMs) {
                stopVerificationPolling();
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/check-verification?email=${encodeURIComponent(email)}`);
                if (!res.ok) return;
                const data = await res.json();

                if (data.verified && data.token) {
                    stopVerificationPolling();

                    // Close email verification modal
                    const emailModal = document.getElementById('emailVerifyModal');
                    if (emailModal) emailModal.classList.remove('active');

                    // Save session and log user in automatically!
                    localStorage.setItem('last_login_email', email);
                    sessionStorage.setItem('nourishUser', JSON.stringify(data.user));
                    sessionStorage.setItem('nourishToken', data.token);
                    localStorage.setItem('nourishUser', JSON.stringify(data.user));
                    localStorage.setItem('nourishToken', data.token);
                    document.documentElement.classList.add('user-logged-in');

                    if (data.user) {
                        const t = (data.user.type || data.user.accountType || data.user.role || '').toLowerCase();
                        state.activePortal = getPortalForUserType(t);
                    }

                    showToast(`✨ Account verified! Welcome, ${data.user.name || email}! 🎉`, "success");
                    renderPortal();
                    syncDock();
                    refreshState();
                }
            } catch (err) {
                // Silently ignore transient network errors during background poll
            }
        }, 2000);
    }

    // Modal close listeners to cancel verification polling
    const closeEmailVerifyBtn = document.getElementById('closeEmailVerifyModal');
    if (closeEmailVerifyBtn) {
        closeEmailVerifyBtn.addEventListener('click', () => {
            stopVerificationPolling();
            const emailModal = document.getElementById('emailVerifyModal');
            if (emailModal) emailModal.classList.remove('active');
        });
    }

    const dismissEmailVerifyBtn = document.getElementById('dismissEmailVerifyModal');
    if (dismissEmailVerifyBtn) {
        dismissEmailVerifyBtn.addEventListener('click', () => {
            stopVerificationPolling();
            const emailModal = document.getElementById('emailVerifyModal');
            if (emailModal) emailModal.classList.remove('active');
        });
    }

    // Resend Verification Email Button
    const resendVerificationBtn = document.getElementById('resendVerificationBtn');
    if (resendVerificationBtn) {
        resendVerificationBtn.addEventListener('click', async () => {
            const email = (document.getElementById('verifySentEmail')?.innerText || '').trim();
            if (!email) return;
            const origText = resendVerificationBtn.innerHTML;
            resendVerificationBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Resending...';
            resendVerificationBtn.disabled = true;
            try {
                const res = await fetch(`${API_BASE}/resend-verification`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast("Verification code & link resent! Check your inbox. ✉️", "success");
                    const otpInput = document.getElementById('verifyOtpInput');
                    if (otpInput) {
                        otpInput.value = '';
                        otpInput.focus();
                    }
                } else {
                    showToast(data.error || "Failed to resend verification.", "error");
                }
            } catch (err) {
                showToast("Network error resending verification.", "error");
            } finally {
                resendVerificationBtn.innerHTML = origText;
                resendVerificationBtn.disabled = false;
            }
        });
    }

    // 1c. Direct 6-Digit OTP Code Submission (secondary option)
    const verifyOtpForm = document.getElementById('verifyOtpForm');
    const verifyOtpInput = document.getElementById('verifyOtpInput');
    const verifyOtpSubmitBtn = document.getElementById('verifyOtpSubmitBtn');

    if (verifyOtpForm) {
        verifyOtpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = (document.getElementById('verifySentEmail')?.innerText || '').trim();
            const otp = (verifyOtpInput?.value || '').trim();

            if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
                showToast("Please enter the 6-digit code from your email.", "warning");
                if (verifyOtpInput) verifyOtpInput.focus();
                return;
            }

            const origText = verifyOtpSubmitBtn ? verifyOtpSubmitBtn.innerHTML : 'Verify';
            if (verifyOtpSubmitBtn) {
                verifyOtpSubmitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Verifying...';
                verifyOtpSubmitBtn.disabled = true;
            }

            try {
                const res = await fetch(`${API_BASE}/verify-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otp })
                });
                const data = await res.json();

                if (res.ok && data.token) {
                    stopVerificationPolling();
                    const emailModal = document.getElementById('emailVerifyModal');
                    if (emailModal) emailModal.classList.remove('active');

                    localStorage.setItem('last_login_email', email);
                    sessionStorage.setItem('nourishUser', JSON.stringify(data.user));
                    sessionStorage.setItem('nourishToken', data.token);
                    localStorage.setItem('nourishUser', JSON.stringify(data.user));
                    localStorage.setItem('nourishToken', data.token);
                    document.documentElement.classList.add('user-logged-in');

                    if (data.user) {
                        const t = (data.user.type || data.user.accountType || data.user.role || '').toLowerCase();
                        state.activePortal = getPortalForUserType(t);
                    }

                    showToast(`Email verified! Welcome, ${data.user?.name || email}!`, "success");
                    renderPortal();
                    syncDock();
                    refreshState();

                    // Request GPS location after signup verification
                    window.requestGPSLocation();
                } else {
                    showToast(data.error || "Invalid code. Please check your email and try again.", "error");
                    if (verifyOtpInput) { verifyOtpInput.select(); verifyOtpInput.focus(); }
                }
            } catch (err) {
                showToast("Network error. Please check your connection.", "error");
            } finally {
                if (verifyOtpSubmitBtn) {
                    verifyOtpSubmitBtn.innerHTML = origText;
                    verifyOtpSubmitBtn.disabled = false;
                }
            }
        });
    }

    // Dynamic Role-Based Compliance Fields (FSSAI vs DARPAN vs APMC/FPO vs Udyam/MSME)
    const regAccountTypeRadios = document.querySelectorAll('input[name="accountType"]');
    const regFssaiWrap = document.getElementById('regFssaiWrap');
    const regDarpanWrap = document.getElementById('regDarpanWrap');
    const regCropSellerWrap = document.getElementById('regCropSellerWrap');
    const regCropBuyerWrap = document.getElementById('regCropBuyerWrap');

    const regFssai = document.getElementById('regFssai');
    const regDarpan = document.getElementById('regDarpan');
    const regNgoType = document.getElementById('regNgoType');
    const regCropSellerType = document.getElementById('regCropSellerType');
    const regCropSellerCode = document.getElementById('regCropSellerCode');
    const regCropBuyerType = document.getElementById('regCropBuyerType');
    const regCropBuyerCode = document.getElementById('regCropBuyerCode');

    const regFssaiFeedback = document.getElementById('regFssaiFeedback');
    const regDarpanFeedback = document.getElementById('regDarpanFeedback');
    const regCropSellerFeedback = document.getElementById('regCropSellerFeedback');
    const regCropBuyerFeedback = document.getElementById('regCropBuyerFeedback');

    const NGO_PLACEHOLDERS = {
        darpan: 'NITI Aayog DARPAN ID (e.g. TN/2026/0123456)',
        trust: 'State Society / Trust Deed No. (e.g. SOC/TN/2022/04812)'
    };

    const CROP_SELLER_PLACEHOLDERS = {
        apmc: 'APMC Mandi License (e.g. APMC/MH/2026/0491)',
        fpo: 'Farmer Producer Org Reg (e.g. FPO/MH/2023/1024)',
        kisan: 'PM-Kisan / KCC ID (e.g. KCC-9876543210)',
        fssai: '14-Digit FSSAI License (e.g. 13326001000001)'
    };

    const CROP_BUYER_PLACEHOLDERS = {
        udyam: 'Udyam MSME ID (e.g. UDYAM-MH-12-0012345)',
        fssai: '14-Digit FSSAI License (e.g. 13326001000001)',
        gstin: 'GSTIN Registration (e.g. 27AAAAA0000A1Z5)'
    };

    function updateRegComplianceVisibility() {
        const selected = document.querySelector('input[name="accountType"]:checked');
        const role = selected ? selected.value : 'restaurant';
        const regPhoneWrap = document.getElementById('regPhoneWrap');
        const regName = document.getElementById('regName');

        if (role === 'crop_seller') {
            if (regFssaiWrap) regFssaiWrap.style.display = 'none';
            if (regDarpanWrap) regDarpanWrap.style.display = 'none';
            if (regPhoneWrap) regPhoneWrap.style.display = 'block';
            if (regName) regName.placeholder = 'Farmer / FPO / Mandi Name';
        } else if (role === 'crop_buyer') {
            if (regFssaiWrap) regFssaiWrap.style.display = 'none';
            if (regDarpanWrap) regDarpanWrap.style.display = 'none';
            if (regPhoneWrap) regPhoneWrap.style.display = 'block';
            if (regName) regName.placeholder = 'Agro-Processor / Procurement Entity';
        } else if (role === 'restaurant' || role === 'vendor') {
            if (regFssaiWrap) regFssaiWrap.style.display = 'block';
            if (regDarpanWrap) regDarpanWrap.style.display = 'none';
            if (regPhoneWrap) regPhoneWrap.style.display = 'none';
            if (regName) regName.placeholder = 'Restaurant / Food Business Name';
        } else {
            if (regFssaiWrap) regFssaiWrap.style.display = 'none';
            if (regDarpanWrap) regDarpanWrap.style.display = 'block';
            if (regPhoneWrap) regPhoneWrap.style.display = 'none';
            if (regName) regName.placeholder = 'Organization Name';
        }
    }

    regAccountTypeRadios.forEach(r => r.addEventListener('change', updateRegComplianceVisibility));

    if (regNgoType && regDarpan) {
        regNgoType.addEventListener('change', () => {
            const selectedType = regNgoType.value;
            regDarpan.placeholder = NGO_PLACEHOLDERS[selectedType] || 'Registration Code';
            if (regDarpan.value.trim()) {
                regDarpan.dispatchEvent(new Event('input'));
            }
        });
    }

    // Live validation for FSSAI on register input
    if (regFssai) {
        regFssai.addEventListener('input', () => {
            const clean = regFssai.value.replace(/\D/g, '').slice(0, 14);
            regFssai.value = clean;
            if (!regFssaiFeedback) return;
            if (!clean) {
                regFssaiFeedback.style.display = 'none';
                return;
            }
            const res = window.validateFSSAI(clean);
            regFssaiFeedback.style.display = 'block';
            if (res.valid) {
                regFssaiFeedback.className = 'fssai-feedback-valid';
                regFssaiFeedback.style.color = '#34d399';
                regFssaiFeedback.style.background = 'rgba(16, 185, 129, 0.12)';
                regFssaiFeedback.style.border = '1px solid rgba(16, 185, 129, 0.3)';
                regFssaiFeedback.innerHTML = `<i class="fa-solid fa-circle-check"></i> <strong>Valid FSSAI</strong>: ${res.stateName} · ${res.typeStr} (${res.year})`;
            } else {
                regFssaiFeedback.className = 'fssai-feedback-invalid';
                regFssaiFeedback.style.color = '#f87171';
                regFssaiFeedback.style.background = 'rgba(239, 68, 68, 0.12)';
                regFssaiFeedback.style.border = '1px solid rgba(239, 68, 68, 0.3)';
                regFssaiFeedback.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${res.message}`;
            }
        });
    }

    // Live validation for Multi-Tier NGO Accreditation on register input
    if (regDarpan) {
        regDarpan.addEventListener('input', () => {
            let val = regDarpan.value.trim().toUpperCase();
            regDarpan.value = val;
            if (!regDarpanFeedback) return;
            if (!val) {
                regDarpanFeedback.style.display = 'none';
                return;
            }
            const currentType = regNgoType ? regNgoType.value : 'darpan';
            const res = window.validateNGOCompliance(currentType, val);
            regDarpanFeedback.style.display = 'block';
            if (res.valid) {
                regDarpanFeedback.className = 'darpan-feedback-valid';
                regDarpanFeedback.style.color = '#34d399';
                regDarpanFeedback.style.background = 'rgba(16, 185, 129, 0.12)';
                regDarpanFeedback.style.border = '1px solid rgba(16, 185, 129, 0.3)';
                regDarpanFeedback.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${res.message}`;
            } else {
                regDarpanFeedback.className = 'darpan-feedback-invalid';
                regDarpanFeedback.style.color = '#f87171';
                regDarpanFeedback.style.background = 'rgba(239, 68, 68, 0.12)';
                regDarpanFeedback.style.border = '1px solid rgba(239, 68, 68, 0.3)';
                regDarpanFeedback.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${res.message}`;
            }
        });
    }

    // 2. Registration Form Submit
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const accountType = document.querySelector('input[name="accountType"]:checked').value;
        const organizationName = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value.trim();
        const phone = document.getElementById('regPhone') ? document.getElementById('regPhone').value.trim() : '';
        const fssaiCode = regFssai ? regFssai.value.trim() : '';
        const darpanId = regDarpan ? regDarpan.value.trim().toUpperCase() : '';
        const ngoRegType = regNgoType ? regNgoType.value : 'darpan';

        if (!organizationName || !email || !password) {
            showToast("Please fill in all required fields, including a password.", "error");
            return;
        }

        // FSSAI is mandatory ONLY for Food Vendor / Restaurant accounts
        if (accountType === 'restaurant' || accountType === 'vendor') {
            if (!fssaiCode) {
                showToast("FSSAI License Code is required to register as a food vendor.", "error");
                if (regFssai) regFssai.focus();
                return;
            }
            const fssaiRes = window.validateFSSAI(fssaiCode);
            if (!fssaiRes.valid) {
                showToast(fssaiRes.message || "Invalid 14-digit FSSAI code.", "warning");
                if (regFssai) regFssai.focus();
                return;
            }
        }

        // DARPAN / Trust Deed is mandatory ONLY for Food NGO / Shelter accounts
        if (accountType === 'ngo' || accountType === 'shelter') {
            if (!darpanId) {
                const label = ngoRegType === 'trust' ? 'State Society / Trust Deed number' : 'NITI Aayog DARPAN ID';
                showToast(`${label} is required to register as an NGO / shelter.`, "error");
                if (regDarpan) regDarpan.focus();
                return;
            }
            const ngoRes = window.validateNGOCompliance(ngoRegType, darpanId);
            if (!ngoRes.valid) {
                showToast(ngoRes.message || "Invalid NGO registration credential format.", "warning");
                if (regDarpan) regDarpan.focus();
                return;
            }
        }

        // Crop accounts (crop_seller & crop_buyer) require NO government accreditation:
        // Purely Name, Email, Password, and Phone Number (for logistics / demo).

        const submitBtn = registerForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        setLoading(submitBtn, true, originalText);

        const regPayload = {
            accountType,
            organizationName,
            email,
            password,
            phone,
            fssaiCode: (accountType === 'restaurant' || accountType === 'vendor') ? fssaiCode : '',
            darpanId: (accountType === 'ngo' || accountType === 'shelter') ? darpanId : '',
            ngoRegType: (accountType === 'ngo' || accountType === 'shelter') ? ngoRegType : ''
        };

        try {
            const response = await fetch(`${API_BASE}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(regPayload)
            });

            const data = await response.json();

            if (response.ok) {
                // Close auth modal & show "Check Your Email" notice
                authModal.classList.remove('active');

                const sentEmailEl = document.getElementById('verifySentEmail');
                if (sentEmailEl) sentEmailEl.innerText = email;

                const emailModal = document.getElementById('emailVerifyModal');
                if (emailModal) emailModal.classList.add('active');
                const otpInput = document.getElementById('verifyOtpInput');
                if (otpInput) {
                    otpInput.value = '';
                    setTimeout(() => otpInput.focus(), 300);
                }

                // Start cross-device verification polling
                startVerificationPolling(email);

                showToast("Account created! Please check your email to activate.", "success");
            } else {
                showToast(data.error || "Registration failed", "error");
            }
        } catch (error) {
            showToast("Network error. Please try again later.", "error");
        } finally {
            setLoading(submitBtn, false, originalText);
        }
    });

    // 2b. Forgot Password Form Submit
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgotEmail').value.trim();
            if (!email) {
                showToast("Please enter your email address.", "error");
                return;
            }

            const submitBtn = forgotPasswordForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            setLoading(submitBtn, true, originalText);

            try {
                const res = await fetch(`${API_BASE}/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                if (res.ok) {
                    document.getElementById('forgotPasswordModal').classList.remove('active');
                    showToast(data.message || "Reset link sent! Please check your email.", "success");
                } else {
                    showToast(data.error || "Failed to send reset link.", "error");
                }
            } catch (err) {
                showToast("Network error. Please try again.", "error");
            } finally {
                setLoading(submitBtn, false, originalText);
            }
        });
    }

    // 2c. Reset Password Form Submit
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = document.getElementById('resetTokenInput').value;
            const newPassword = document.getElementById('newPassword').value.trim();
            const confirmNewPassword = document.getElementById('confirmNewPassword').value.trim();

            if (!newPassword || !confirmNewPassword) {
                showToast("Please enter and confirm your new password.", "error");
                return;
            }

            if (newPassword !== confirmNewPassword) {
                showToast("Passwords do not match. Please re-enter.", "error");
                return;
            }

            const submitBtn = resetPasswordForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            setLoading(submitBtn, true, originalText);

            try {
                const res = await fetch(`${API_BASE}/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, newPassword })
                });
                const data = await res.json();
                if (res.ok) {
                    document.getElementById('resetPasswordModal').classList.remove('active');

                    if (data.user) sessionStorage.setItem('nourishUser', JSON.stringify(data.user));
                    if (data.token) sessionStorage.setItem('nourishToken', data.token);
                    document.documentElement.classList.add('user-logged-in');

                    if (data.user) {
                        const t = (data.user.type || data.user.accountType || '').toLowerCase();
                        state.activePortal = (t === 'restaurant' || t === 'vendor' || t === 'seller') ? 'seller' : 'buyer';
                    }
                    showToast("Password updated successfully! Welcome back 🎉", "success");
                    renderPortal();
                    syncDock();
                    refreshState();
                } else {
                    showToast(data.error || "Failed to update password.", "error");
                }
            } catch (err) {
                showToast("Network error. Please try again.", "error");
            } finally {
                setLoading(submitBtn, false, originalText);
            }
        });
    }

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

            // Re-render active portal so theme changes apply instantly to dynamic views
            if (typeof renderPortal === 'function' && state.activePortal && state.activePortal !== 'home') {
                renderPortal();
            }
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

        // Wire up Dock History button (Both Portals)
        const historyDockItem = document.getElementById('history-toggle-dock');
        if (historyDockItem) {
            historyDockItem.addEventListener('click', (e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                console.log("Dock: History Clicked (from initSwitcher)");
                if (typeof openHistoryModal === 'function') openHistoryModal();
                else if (typeof window.openHistoryModal === 'function') window.openHistoryModal();
            });
        }

        // Handle window resize to keep indicator in sync
        window.addEventListener('resize', updateLiquidIndicator);

        // Start Expiry Countdown Loop
        setInterval(updateAllCountdowns, 1000);
    }

    function updateAllCountdowns() {
        const timerElements = document.querySelectorAll('.nn-expiry-timer');
        const now = Date.now();

        timerElements.forEach(el => {
            const expiry = el.dataset.expiry;
            if (!expiry || !window.isValidExpiry(expiry)) {
                if (el.innerHTML !== 'Fresh') el.innerHTML = 'Fresh';
                if (!el.classList.contains('timer-safe')) el.className = 'nn-expiry-timer timer-safe';
                return;
            }

            const expTime = new Date(expiry).getTime();
            const distance = expTime - now;

            if (distance <= 0) {
                const card = el.closest('.nn-food-card');
                if (card && !card.classList.contains('is-expired')) {
                    card.classList.add('is-expired');
                    const actionBtn = card.querySelector('.nn-add-btn, .add-btn, .btn-primary');
                    if (actionBtn) {
                        actionBtn.disabled = true;
                        actionBtn.innerHTML = '<i class="fa-solid fa-clock"></i> Expired';
                    }
                    card.querySelectorAll('.stepper-btn').forEach(b => b.disabled = true);
                }

                if (el.innerHTML !== 'EXPIRED') el.innerHTML = 'EXPIRED';
                if (!el.classList.contains('timer-expired')) el.className = 'nn-expiry-timer timer-expired';
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            const dayPrefix = days > 0 ? `${days}d ` : '';

            const timeStr =
                dayPrefix +
                String(hours).padStart(2, '0') + ":" +
                String(minutes).padStart(2, '0') + ":" +
                String(seconds).padStart(2, '0');

            if (el.innerHTML !== timeStr) el.innerHTML = timeStr;

            // Target Class
            let targetClass = 'nn-expiry-timer timer-safe';
            if (distance > 2 * 3600000) { // > 2 hours
                targetClass = 'nn-expiry-timer timer-safe';
            } else if (distance > 30 * 60000) { // 30m - 2h
                targetClass = 'nn-expiry-timer timer-warning';
            } else { // < 30m
                targetClass = 'nn-expiry-timer timer-urgent';
            }

            if (el.className !== targetClass) {
                el.className = targetClass;
            }
        });
    }

    function updateLiquidIndicator() {
        // Removed as the top pill switcher was replaced by the bottom dock.
    }

    // 4. Rendering Engine
    function renderPortal() {
        const root = portalsRoot || document.getElementById('nn-portals-root');
        const home = homePortal || document.getElementById('home-portal');
        syncDock();
        syncPortalSwitcher();
        if (state.activePortal === 'home') {
            if (home) home.style.display = 'block';
            if (root) {
                root.style.display = 'none';
                delete root.dataset.activePortal;
            }
            // Re-render slider + wall so any new comments from portals show up instantly
            renderReviewsSlider();
            renderCommunityWall();
        } else {
            if (home) home.style.display = 'none';
            if (root) {
                root.style.display = 'block';
                // Only trigger the portalEnter transition when switching portals or on initial entry
                if (root.dataset.activePortal !== state.activePortal) {
                    root.dataset.activePortal = state.activePortal;
                    root.classList.remove('portal-reveal');
                    void root.offsetWidth; // Trigger reflow
                    root.classList.add('portal-reveal');
                }
            }
            if (state.activePortal === 'seller') {
                renderSellerPortal();
            } else if (state.activePortal === 'buyer') {
                renderBuyerPortal();
            } else if (state.activePortal === 'crop_seller') {
                renderCropSellerPortal();
            } else if (state.activePortal === 'crop_buyer') {
                renderCropBuyerPortal();
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
            else if (navAvatarImg && user.id) navAvatarImg.src = `assets/default-avatar.jpg`;
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
        const cartDockItem = document.getElementById('cart-toggle-dock');
        const addDockItem = document.getElementById('add-listing-dock');
        const addCropDockItem = document.getElementById('add-crop-dock');
        const cropCartDockItem = document.getElementById('crop-cart-dock');
        const historyDockItem = document.getElementById('history-toggle-dock');
        const loginDockItem = document.getElementById('login-toggle-dock');
        const settingsDockItem = document.getElementById('settings-toggle-dock');
        const landingItems = document.querySelectorAll('.landing-only');

        if (state.activePortal === 'buyer') {
            landingItems.forEach(el => el.style.setProperty('display', 'none', 'important'));
            if (cartDockItem) cartDockItem.style.setProperty('display', 'flex', 'important');
            if (addDockItem) addDockItem.style.setProperty('display', 'none', 'important');
            if (addCropDockItem) addCropDockItem.style.setProperty('display', 'none', 'important');
            if (cropCartDockItem) cropCartDockItem.style.setProperty('display', 'none', 'important');
            if (historyDockItem) historyDockItem.style.setProperty('display', 'flex', 'important');
            if (settingsDockItem) settingsDockItem.style.setProperty('display', 'flex', 'important');
            if (loginDockItem) loginDockItem.style.setProperty('display', 'flex', 'important');
        } else if (state.activePortal === 'seller') {
            landingItems.forEach(el => el.style.setProperty('display', 'none', 'important'));
            if (cartDockItem) cartDockItem.style.setProperty('display', 'none', 'important');
            if (addDockItem) addDockItem.style.setProperty('display', 'flex', 'important');
            if (addCropDockItem) addCropDockItem.style.setProperty('display', 'none', 'important');
            if (cropCartDockItem) cropCartDockItem.style.setProperty('display', 'none', 'important');
            if (historyDockItem) historyDockItem.style.setProperty('display', 'flex', 'important');
            if (settingsDockItem) settingsDockItem.style.setProperty('display', 'flex', 'important');
            if (loginDockItem) loginDockItem.style.setProperty('display', 'flex', 'important');
        } else if (state.activePortal === 'crop_seller') {
            landingItems.forEach(el => el.style.setProperty('display', 'none', 'important'));
            if (cartDockItem) cartDockItem.style.setProperty('display', 'none', 'important');
            if (addDockItem) addDockItem.style.setProperty('display', 'none', 'important');
            if (addCropDockItem) addCropDockItem.style.setProperty('display', 'flex', 'important');
            if (cropCartDockItem) cropCartDockItem.style.setProperty('display', 'none', 'important');
            if (historyDockItem) historyDockItem.style.setProperty('display', 'flex', 'important');
            if (settingsDockItem) settingsDockItem.style.setProperty('display', 'flex', 'important');
            if (loginDockItem) loginDockItem.style.setProperty('display', 'flex', 'important');
        } else if (state.activePortal === 'crop_buyer') {
            landingItems.forEach(el => el.style.setProperty('display', 'none', 'important'));
            if (cartDockItem) cartDockItem.style.setProperty('display', 'none', 'important');
            if (addDockItem) addDockItem.style.setProperty('display', 'none', 'important');
            if (addCropDockItem) addCropDockItem.style.setProperty('display', 'none', 'important');
            if (cropCartDockItem) cropCartDockItem.style.setProperty('display', 'flex', 'important');
            if (historyDockItem) historyDockItem.style.setProperty('display', 'flex', 'important');
            if (settingsDockItem) settingsDockItem.style.setProperty('display', 'flex', 'important');
            if (loginDockItem) loginDockItem.style.setProperty('display', 'flex', 'important');
        } else {
            landingItems.forEach(el => el.style.setProperty('display', 'flex', 'important'));
            if (cartDockItem) cartDockItem.style.setProperty('display', 'none', 'important');
            if (addDockItem) addDockItem.style.setProperty('display', 'none', 'important');
            if (addCropDockItem) addCropDockItem.style.setProperty('display', 'none', 'important');
            if (cropCartDockItem) cropCartDockItem.style.setProperty('display', 'none', 'important');
            if (historyDockItem) historyDockItem.style.setProperty('display', 'none', 'important');
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
        localStorage.removeItem('nourishUser');
        localStorage.removeItem('nourishToken');

        // Remove logged-in class so CSS anti-flash rules show home & hide portals
        document.documentElement.classList.remove('user-logged-in');
        document.documentElement.classList.remove('portal-pre-active');

        // Reset state
        state.activePortal = 'home';
        state.cart = [];

        // Explicitly show/hide the right sections
        const homePortal = document.getElementById('home-portal');
        const portalsRootEl = document.getElementById('nn-portals-root');
        if (homePortal) homePortal.style.removeProperty('display');
        if (portalsRootEl) portalsRootEl.style.setProperty('display', 'none', 'important');

        // Clear the portals root content so stale portal HTML is gone
        const root = portalsRoot || portalsRootEl;
        if (root) root.innerHTML = '';

        syncDock();
        updateLiquidIndicator();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showToast("Logged out successfully.", "info");
    }



    function renderSellerPortal() {
        const user = JSON.parse(sessionStorage.getItem('nourishUser') || '{}');
        const sellerListings = state.listings.filter(l => l.vendorId == user.id);
        const fssai = user.fssaiCode || user.fssaicode || '';

        let totalMealsDonated = 0;
        sellerListings.forEach(item => { totalMealsDonated += parseFloat(item.qty) || 0; });

        let badgeName = 'Member';
        let badgeClass = 'badge-member';
        if (totalMealsDonated >= 500) { badgeName = 'Platinum Elite'; badgeClass = 'badge-platinum'; }
        else if (totalMealsDonated >= 100) { badgeName = 'Gold'; badgeClass = 'badge-gold'; }
        else if (totalMealsDonated >= 50) { badgeName = 'Silver Partner'; badgeClass = 'badge-silver'; }

        const root = portalsRoot || document.getElementById('nn-portals-root');
        if (!root) return;

        root.innerHTML = `
            <div class="portal-wrapper" style="padding-top: 80px; min-height: 100vh;">
                <div class="container" style="max-width: 1300px; margin: 0 auto; padding: 1.5rem 2rem 3rem;">

                    <h1 class="seller-page-title" style="display: flex; align-items: center; gap: 20px;">
                        <span class="premium-title">SELLER'S DASHBOARD</span>
                    </h1>

                    <!-- Seller Bio / Profile Card -->
                    <div class="seller-form-card" style="margin-bottom: 2rem; padding: 1.5rem 2rem;">
                        <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
                            <img src="${user.avatarUrl || 'assets/default-avatar.jpg'}" alt="Seller Avatar"
                                style="width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent-primary); flex-shrink: 0;">
                            <div style="flex: 1; min-width: 200px;">
                                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 4px;">
                                    <span style="font-size: 1.2rem; font-weight: 800; color: var(--text-primary);">${user.name || user.organizationName || 'Your Restaurant'}</span>
                                    <span class="badge ${badgeClass}" style="font-size: 0.72rem; padding: 3px 8px; border-radius: 8px; font-weight: 700;">${badgeName}</span>
                                </div>
                                ${user.bio ? `<p style="color:var(--text-muted); font-size:0.9rem; margin: 0 0 8px;">${user.bio}</p>` : ''}
                                <div style="display: flex; flex-wrap: wrap; gap: 10px 20px; font-size: 0.82rem; color: var(--text-muted); margin-top: 6px;">
                                    ${fssai ? `<span class="fssai-trust-badge" style="font-size:0.75rem; padding: 3px 10px; border-radius: 12px;" title="FSSAI Food Safety Verified"><i class="fa-solid fa-shield-halved"></i> <strong style="font-family:monospace; letter-spacing:1px;">${fssai}</strong> <span style="font-weight:700;">FSSAI</span></span>` : '<span style="color:#f59e0b;"><i class="fa-solid fa-triangle-exclamation"></i> FSSAI not set — update in Settings</span>'}
                                    ${user.address ? `<span><i class="fa-solid fa-location-dot" style="color:var(--accent-primary);"></i> ${user.address}</span>` : ''}
                                    ${user.publicPhone ? `<span><i class="fa-solid fa-phone" style="color:var(--accent-primary);"></i> ${user.publicPhone}</span>` : ''}
                                    ${user.contactPerson ? `<span><i class="fa-solid fa-user-tie" style="color:var(--accent-primary);"></i> ${user.contactPerson}</span>` : ''}
                                    ${user.website ? `<span><i class="fa-solid fa-globe" style="color:var(--accent-primary);"></i> ${user.website}</span>` : ''}
                                    ${user.pickupWindow ? `<span><i class="fa-solid fa-clock" style="color:var(--accent-primary);"></i> Pickup: ${user.pickupWindow}</span>` : ''}
                                </div>
                            </div>
                            <button onclick="window.openSettings()" style="background: none; border: 1px solid var(--border-glow); border-radius: 10px; padding: 8px 16px; color: var(--text-muted); font-size: 0.82rem; cursor: pointer; white-space: nowrap; flex-shrink: 0;">
                                <i class="fa-solid fa-pen-to-square"></i> Edit Profile
                            </button>
                        </div>
                    </div>

                    <!-- Portal Tabs -->
                    <div class="portal-tabs" style="display:flex; gap: 0.5rem; margin-bottom: 2.5rem; border-bottom: 1px solid var(--border-glow); padding-bottom: 0;">
                        <button class="portal-tab-btn active" data-tab="listings" style="padding: 0.75rem 1.75rem; background: none; border: none; border-bottom: 2px solid var(--accent-primary); color: var(--accent-primary); font-weight: 700; font-size: 0.95rem; cursor: pointer; letter-spacing: 1px;">
                            <i class="fa-solid fa-utensils"></i> LISTINGS
                        </button>
                        <button class="portal-tab-btn" data-tab="comments" style="padding: 0.75rem 1.75rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-muted); font-weight: 700; font-size: 0.95rem; cursor: pointer; letter-spacing: 1px;">
                            <i class="fa-solid fa-comments"></i> COMMENTS
                        </button>
                    </div>

                    <!-- Tab: Listings -->
                    <div id="tab-listings" class="portal-tab-content">
                        <div class="seller-listings-header">
                            <h2>LISTINGS</h2>
                            <span class="listings-count-badge" id="my-listings-count-badge">${sellerListings.length} items</span>
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
                                <div class="form-group full-width" style="margin-bottom: 0.5rem;">
                                    <label style="font-size: 0.82rem; color: var(--accent-primary); font-weight: 700;">⚡ Quick Presets (Click to autofill dish & image):</label>
                                    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px;">
                                        <button type="button" class="preset-chip-btn" onclick="window.applyFoodPreset('Idli & Sambar', 'Cooked')">🍲 Idli & Sambar</button>
                                        <button type="button" class="preset-chip-btn" onclick="window.applyFoodPreset('Pasta & Maggie', 'Cooked')">🍝 Pasta & Maggie</button>
                                        <button type="button" class="preset-chip-btn" onclick="window.applyFoodPreset('Hyderabadi Biryani', 'Cooked')">🍛 Hyderabadi Biryani</button>
                                        <button type="button" class="preset-chip-btn" onclick="window.applyFoodPreset('Paneer Butter Masala', 'Cooked')">🥘 Paneer Masala</button>
                                        <button type="button" class="preset-chip-btn" onclick="window.applyFoodPreset('Classic Pizza', 'Cooked')">🍕 Pizza</button>
                                        <button type="button" class="preset-chip-btn" onclick="window.applyFoodPreset('Fresh Garden Salad', 'Produce')">🥗 Fresh Salad</button>
                                        <button type="button" class="preset-chip-btn" onclick="window.applyFoodPreset('Artisan Pastries & Cake', 'Bakery')">🍰 Bakery Treats</button>
                                        <button type="button" class="preset-chip-btn" onclick="window.applyFoodPreset('Fresh Fruit Box', 'Produce')">🍎 Fruits</button>
                                    </div>
                                </div>
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
                                <div class="form-group" style="position: relative;">
                                     <label style="color: var(--text-primary); font-weight: 600;"><i class="fa-regular fa-clock" style="color: var(--accent-primary);"></i> Expiry Date & Time</label>
                                     
                                     <div class="manual-glass-input-wrapper" onclick="window.toggleLiquidGlassCalendar(event)" style="cursor: pointer;">
                                         <input type="text" id="p-expiry-display" class="manual-glass-date-input" placeholder="Select Expiry Date & Time..." readonly style="cursor: pointer;">
                                         <input type="hidden" id="p-expiry" value="">
                                         <button type="button" class="glass-calendar-icon-btn" onclick="window.toggleLiquidGlassCalendar(event)" title="Open Liquid Glass Calendar">
                                             <i class="fa-regular fa-calendar-days"></i>
                                         </button>
                                     </div>

                                     <!-- Compact Liquid Glass Floating Calendar Card -->
                                     <div class="liquid-glass-calendar-card" id="liquid-calendar-card" onclick="event.stopPropagation()">
                                         <!-- Quick 1-Click Presets -->
                                         <div class="lg-cal-presets">
                                             <button type="button" class="lg-preset-pill" onclick="window.applyLiquidPreset(2)">+2 hrs</button>
                                             <button type="button" class="lg-preset-pill" onclick="window.applyLiquidPreset(4)">+4 hrs</button>
                                             <button type="button" class="lg-preset-pill" onclick="window.applyLiquidPreset('tonight')">Tonight 10PM</button>
                                             <button type="button" class="lg-preset-pill" onclick="window.applyLiquidPreset('tomorrow')">Tomorrow</button>
                                         </div>

                                         <div class="lg-cal-header">
                                             <span class="lg-cal-month-year" id="lg-month-year">August 2026</span>
                                             <div class="lg-cal-nav">
                                                 <button type="button" class="lg-nav-btn" onclick="window.changeLiquidMonth(-1)"><i class="fa-solid fa-chevron-left"></i></button>
                                                 <button type="button" class="lg-nav-btn" onclick="window.changeLiquidMonth(1)"><i class="fa-solid fa-chevron-right"></i></button>
                                             </div>
                                         </div>

                                         <div class="lg-cal-weekdays">
                                             <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
                                         </div>

                                         <div class="lg-cal-days" id="lg-days-grid"></div>

                                         <div class="lg-cal-time-row">
                                             <span class="lg-time-label">Time</span>
                                             <div class="lg-time-input-group">
                                                 <select id="lg-time-hour" onchange="window.updateLiquidTimeFromSelect()"></select>
                                                 <span>:</span>
                                                 <select id="lg-time-min" onchange="window.updateLiquidTimeFromSelect()"></select>
                                                 <button type="button" id="lg-time-ampm" class="lg-ampm-pill" onclick="window.toggleLiquidAmPm()">PM</button>
                                             </div>
                                         </div>

                                         <div class="lg-cal-footer">
                                             <button type="button" class="lg-reset-btn" onclick="window.clearLiquidCalendar()">Clear</button>
                                             <button type="button" class="lg-confirm-btn" onclick="window.confirmLiquidCalendar()">
                                                 <i class="fa-solid fa-check"></i> Set Expiry
                                             </button>
                                         </div>
                                     </div>
                                 </div>
                                <div class="form-group">
                                    <label>Custom Image URL (Optional)</label>
                                    <input type="text" id="p-img" class="form-control" placeholder="Paste photo link or Google image address">
                                    <small style="font-size: 0.76rem; color: #7cb88b; display: block; margin-top: 4px; opacity: 0.9;">
                                        <i class="fa-solid fa-circle-info"></i> Tip: On Google, right-click (or touch & hold) photo & choose <strong>"Copy image address"</strong>
                                    </small>
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
                    </div>

                    <!-- Tab: Comments -->
                    <div id="tab-comments" class="portal-tab-content" style="display:none;">
                        <div class="seller-form-card">
                            <div class="seller-form-header">
                                <h3><i class="fa-solid fa-comments" style="color:var(--accent-primary);"></i> &nbsp;SHARE YOUR VOICE</h3>
                            </div>
                            <p style="color:var(--text-muted); margin-bottom:2rem; font-size:0.95rem;">Your comment will appear live in the <strong style="color:var(--accent-primary);">Voices of Impact</strong> section on the home page.</p>
                            <form id="portal-comment-form" class="nn-form">
                                <div class="form-group">
                                    <label>Your Experience</label>
                                    <textarea id="portal-comment-text" class="form-control" rows="3" placeholder="Share your experience with Nourish Network..." required></textarea>
                                </div>
                                <button type="submit" class="nn-publish-btn" style="width:100%;">Broadcast to Voices of Impact &nbsp;<i class="fa-solid fa-paper-plane"></i></button>
                            </form>
                            <div id="portal-comments-list" style="margin-top:2.5rem;"></div>
                        </div>
                    </div>

                </div>
            </div>
        `;
        renderSellerListings();
        attachSellerListeners();
        attachPortalCommentTab();
        initImpactChart();
    }

    function renderSellerListings() {
        const container = document.getElementById('my-listings-container');
        if (!container) return;

        const user = JSON.parse(sessionStorage.getItem('nourishUser'));
        if (!user) return;

        // Filter to show only THIS seller's active items (sold out items cleared on refresh)
        const myItems = state.listings.filter(l => 
            String(l.vendorId) === String(user.id) &&
            l.status !== 'sold' &&
            (parseInt(l.qty) || 0) > 0
        );

        const countBadge = document.getElementById('my-listings-count-badge');
        if (countBadge) {
            countBadge.textContent = `${myItems.length} items`;
        }

        if (myItems.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; padding: 4rem; text-align: center; background: var(--bg-card); border-radius: 20px; border: 1px dashed var(--border-glow);">
                    <i class="fa-solid fa-utensils" style="font-size: 3rem; color: var(--accent-primary); opacity: 0.5; margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-muted);">You haven't listed any food yet. Use the form below to start rescuing!</p>
                </div>
            `;
            return;
        }

        const isInitialMount = container.children.length === 0;

        container.innerHTML = myItems.map((item, idx) => `
            <div class="nn-food-card ${isInitialMount ? 'stagger-item' : ''} ${item.qty <= 0 ? 'is-sold-out' : ''} ${window.isItemExpired(item.expiry) ? 'is-expired' : ''}" data-id="${item.id}" ${isInitialMount ? `style="animation-delay: ${idx * 0.05}s"` : ''}>
                <div class="nn-card-img-wrap">
                    <img src="${item.img}" alt="${item.name}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src=window.getSmartFoodImage ? window.getSmartFoodImage('${(item.name || '').replace(/'/g, "\\'")}', '${(item.category || '').replace(/'/g, "\\'")}', null) : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80';">
                    <div class="nn-card-img-overlay"></div>
                    <div class="nn-card-badges">
                        <span class="nn-badge nn-badge-cat">${item.category}</span>
                        <span class="nn-badge nn-badge-qty ${item.qty <= 0 ? 'nn-badge-sold' : ''}"><i class="fa-solid fa-utensils"></i> ${item.qty <= 0 ? 'Sold Out' : item.qty + ' left'}</span>
                    </div>
                    <div class="nn-card-vendor"><i class="fa-solid fa-store"></i> ${item.vendorName} ${item.fssaiCode ? `<span class="fssai-trust-badge" style="margin-left: 6px;" title="FSSAI Food Safety Verified: ${item.fssaiCode}"><i class="fa-solid fa-shield-halved"></i> FSSAI</span>` : ''}</div>
                </div>
                <div class="nn-expiry-container">
                    <span class="nn-expiry-label">Expires in:</span>
                    <div class="nn-expiry-timer" data-expiry="${item.expiry && window.isValidExpiry(item.expiry) ? item.expiry : ''}" data-id="${item.id}">${window.getInitialCountdownStr(item.expiry)}</div>
                </div>
                <div class="nn-card-body">
                    <h3 class="nn-card-title">${item.name}</h3>
                    <p class="nn-card-desc">${item.description || 'No description provided.'}</p>
                    <div class="nn-card-meta">
                        <div class="nn-card-price">₹${item.price}<span>/portion</span></div>
                        <div class="nn-card-expiry"><i class="fa-regular fa-clock"></i> ${window.formatExpiryDisplay(item.expiry)}</div>
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
                    if (document.getElementById('p-img')) document.getElementById('p-img').value = item.imageUrl || item.img || '';
                    if (item.expiry && window.isValidExpiry(item.expiry)) {
                        try {
                            const localIso = window.toLocalDateTimeLocalString(item.expiry);
                            const hiddenExp = document.getElementById('p-expiry');
                            const dispExp = document.getElementById('p-expiry-display');
                            if (hiddenExp) hiddenExp.value = localIso;
                            if (dispExp && typeof window.formatExpiryDisplay === 'function') {
                                dispExp.value = window.formatExpiryDisplay(localIso);
                            }
                            if (typeof window.setLiquidPickerFromISO === 'function') {
                                window.setLiquidPickerFromISO(localIso);
                            }
                        } catch (e) { }
                    }
                    document.getElementById('submit-btn').innerHTML = '💾 Save Changes';
                    document.getElementById('cancel-edit-btn').style.display = 'block';
                    const addFormSection = document.getElementById('add-listing-section') || document.getElementById('add-food-form');
                    if (addFormSection) {
                        addFormSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (!confirm("Are you sure you want to delete this listing?")) return;

                const token = sessionStorage.getItem('nourishToken');

                // Helper to remove locally
                const removeLocally = () => {
                    let demoListings = JSON.parse(localStorage.getItem('nn_demo_listings') || '[]');
                    demoListings = demoListings.filter(l => String(l.id) !== String(id));
                    localStorage.setItem('nn_demo_listings', JSON.stringify(demoListings));
                    state.listings = state.listings.filter(l => String(l.id) !== String(id));
                    showToast("Listing deleted successfully. 🗑️", "success");
                    if (state.activePortal === 'seller') {
                        renderSellerListings();
                    } else if (state.activePortal === 'buyer' && typeof renderExchangeGrid === 'function') {
                        renderExchangeGrid();
                    }
                    updateLiveStats();
                    if (typeof broadcastInventoryChange === 'function') broadcastInventoryChange();
                };

                const isDemoToken = !token || token.startsWith('demo-token') || String(id).startsWith('demo-');
                if (isDemoToken) {
                    removeLocally();
                    return;
                }

                try {
                    const response = await fetch(`${API_BASE}/listings/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (response.ok || response.status === 404 || response.status === 403) {
                        removeLocally();
                    } else {
                        const data = await response.json();
                        showToast(data.error || "Delete failed", "error");
                    }
                } catch (err) {
                    removeLocally();
                }
            });
        });
    }

    function renderBuyerPortal() {
        const user = JSON.parse(sessionStorage.getItem('nourishUser') || '{}');
        const darpan = user.darpanId || user.darpanid || '';

        const root = portalsRoot || document.getElementById('nn-portals-root');
        if (!root) return;

        root.innerHTML = `
            <div class="buyer-portal-layout animate-reveal" style="padding-top: 100px; min-height: 100vh;">
                <div class="container" style="max-width: 1300px; margin: 0 auto; padding: 1.5rem 2rem 3rem;">
                    <h1 class="seller-page-title" style="display: flex; align-items: center; gap: 20px;">
                        <span class="premium-title">BUYER'S DASHBOARD</span>
                    </h1>

                    <!-- NGO Bio / Profile Card -->
                    <div class="seller-form-card" style="margin-bottom: 2rem; padding: 1.5rem 2rem;">
                        <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
                            <img src="${user.avatarUrl || 'assets/default-avatar.jpg'}" alt="NGO Avatar"
                                style="width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 2px solid #38bdf8; flex-shrink: 0;">
                            <div style="flex: 1; min-width: 200px;">
                                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 4px;">
                                    <span style="font-size: 1.2rem; font-weight: 800; color: var(--text-primary);">${user.name || user.organizationName || 'Your NGO Organization'}</span>
                                    ${(user.darpanId || user.darpanid || user.ngoRegCode) ? `<span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 0.72rem; padding: 3px 8px; border-radius: 8px; font-weight: 700;">Verified NGO</span>` : ''}
                                </div>
                                ${user.bio ? `<p style="color:var(--text-muted); font-size:0.9rem; margin: 0 0 8px;">${user.bio}</p>` : ''}
                                <div style="display: flex; flex-wrap: wrap; gap: 10px 20px; font-size: 0.82rem; color: var(--text-muted); margin-top: 6px;">
                                    ${window.renderNgoTrustBadge(user)}
                                    ${user.address ? `<span><i class="fa-solid fa-location-dot" style="color:#38bdf8;"></i> ${user.address}</span>` : ''}
                                    ${(user.publicPhone || user.phone) ? `<span><i class="fa-solid fa-phone" style="color:#38bdf8;"></i> ${user.publicPhone || user.phone}</span>` : ''}
                                    ${user.contactPerson ? `<span><i class="fa-solid fa-user-tie" style="color:#38bdf8;"></i> ${user.contactPerson}</span>` : ''}
                                </div>
                            </div>
                            <button onclick="window.openSettings()" style="background: none; border: 1px solid var(--border-glow); border-radius: 10px; padding: 8px 16px; color: var(--text-muted); font-size: 0.82rem; cursor: pointer; white-space: nowrap; flex-shrink: 0;">
                                <i class="fa-solid fa-pen-to-square"></i> Edit Profile
                            </button>
                        </div>
                    </div>

                    <!-- Portal Tabs -->
                    <div class="portal-tabs" style="display:flex; gap: 0.5rem; margin-bottom: 2.5rem; border-bottom: 1px solid var(--border-glow); padding-bottom: 0;">
                        <button class="portal-tab-btn active" data-tab="listings" style="padding: 0.75rem 1.75rem; background: none; border: none; border-bottom: 2px solid var(--accent-primary); color: var(--accent-primary); font-weight: 700; font-size: 0.95rem; cursor: pointer; letter-spacing: 1px;">
                            <i class="fa-solid fa-basket-shopping"></i> LISTINGS
                        </button>
                        <button class="portal-tab-btn" data-tab="comments" style="padding: 0.75rem 1.75rem; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-muted); font-weight: 700; font-size: 0.95rem; cursor: pointer; letter-spacing: 1px;">
                            <i class="fa-solid fa-comments"></i> COMMENTS
                        </button>
                    </div>

                    <!-- Tab: Listings -->
                    <div id="tab-listings" class="portal-tab-content">
                        <div class="items-grid" id="exchange-grid">
                            <!-- Cards will render here -->
                        </div>
                    </div>

                    <!-- Tab: Comments -->
                    <div id="tab-comments" class="portal-tab-content" style="display:none;">
                        <div class="seller-form-card">
                            <div class="seller-form-header">
                                <h3><i class="fa-solid fa-comments" style="color:var(--accent-primary);"></i> &nbsp;SHARE YOUR VOICE</h3>
                            </div>
                            <p style="color:var(--text-muted); margin-bottom:2rem; font-size:0.95rem;">Your comment will appear live in the <strong style="color:var(--accent-primary);">Voices of Impact</strong> section on the home page.</p>
                            <form id="portal-comment-form" class="nn-form">
                                <div class="form-group">
                                    <label>Your Experience</label>
                                    <textarea id="portal-comment-text" class="form-control" rows="3" placeholder="Share your experience with Nourish Network..." required></textarea>
                                </div>
                                <button type="submit" class="nn-publish-btn" style="width:100%;">Broadcast to Voices of Impact &nbsp;<i class="fa-solid fa-paper-plane"></i></button>
                            </form>
                            <div id="portal-comments-list" style="margin-top:2.5rem;"></div>
                        </div>
                    </div>

                </div>
            </div>
        `;
        renderExchangeGrid();
        attachPortalCommentTab();
    }

    function renderExchangeGrid() {
        const grid = document.getElementById('exchange-grid');
        if (!grid) return;

        // Preserve in-progress stepper selections across data syncs
        const currentStepperVals = {};
        grid.querySelectorAll('.nn-food-card').forEach(card => {
            const id = card.dataset.id;
            const span = card.querySelector('.stepper-val');
            if (id && span) {
                currentStepperVals[id] = parseInt(span.textContent || span.innerText, 10) || 1;
            }
        });
        const isInitialMount = grid.children.length === 0;

        // Filter out expired items, sold-out items, crop items, or garbage demo items for the FOOD buyer view
        const validListings = state.listings.filter(item => {
            if (item.name === 'lp.okijuh' || item.name === 'lp,okijuh' || item.name === 'wesrdtfgybh') return false;
            if (item.status === 'sold' || item.status === 'claimed') return false;

            // Exclude crop/agri listings — they belong in the crop_buyer portal only
            if (item.produceType === 'crop' || item.cropGrade || item.unit === 'Quintal' || item.unit === 'q') return false;

            const liveStock = parseInt(item.quantity != null ? item.quantity : item.qty, 10) || 0;
            if (liveStock <= 0) return false;

            if (!item.expiry || !window.isValidExpiry(item.expiry)) return true;
            return !window.isItemExpired(item.expiry);
        });

        if (validListings.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1.5rem; color: var(--text-muted); background: rgba(255,255,255,0.02); border: 1px dashed var(--border-glow); border-radius: 24px;">
                    <i class="fa-solid fa-seedling" style="font-size: 3rem; color: var(--accent-primary); margin-bottom: 1rem; display: block;"></i>
                    <h3 style="color: var(--text-primary); font-size: 1.3rem; margin-bottom: 0.5rem;">No Active Food Listings Right Now</h3>
                    <p style="font-size: 0.95rem;">Check back soon! Local restaurants publish fresh surplus meals throughout the day.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = validListings.map((item, idx) => {
            const avatarImg = item.vendorAvatar ? item.vendorAvatar : `assets/default-avatar.jpg`;
            const bioText = item.vendorBio ? `<div style="font-size: 0.75rem; color: #cbd5e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${item.vendorBio}</div>` : '';

            const inCart = (state.cart || []).find(c => String(c.item.id) === String(item.id));
            const cartQty = inCart ? (parseInt(inCart.qty, 10) || 0) : 0;
            const liveStock = parseInt(item.quantity != null ? item.quantity : item.qty, 10) || 0;
            const remainingLive = Math.max(0, liveStock - cartQty);
            const isAllInBasket = (remainingLive <= 0);
            const isExpired = window.isItemExpired(item.expiry);

            const savedVal = currentStepperVals[item.id] || 1;
            const stepperVal = isAllInBasket ? 0 : Math.max(1, Math.min(savedVal, remainingLive));

            return `
            <div class="nn-food-card ${isInitialMount ? 'stagger-item' : ''} ${isAllInBasket ? 'is-sold-out' : ''} ${isExpired ? 'is-expired' : ''}" data-id="${item.id}" ${isInitialMount ? `style="animation-delay: ${idx * 0.05}s"` : ''}>
                ${isAllInBasket ? '<div class="nn-sold-out-badge"><i class="fa-solid fa-basket-shopping"></i> All Portions in Basket</div>' : ''}
                <div class="nn-card-img-wrap">
                    <img src="${item.img}" alt="${item.name}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src=window.getSmartFoodImage ? window.getSmartFoodImage('${(item.name || '').replace(/'/g, "\\'")}', '${(item.category || '').replace(/'/g, "\\'")}', null) : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80';">
                    <div class="nn-card-img-overlay"></div>
                    <div class="nn-card-badges">
                        <span class="nn-badge nn-badge-cat">${item.category}</span>
                        <span class="nn-badge nn-badge-qty ${remainingLive <= 5 && remainingLive > 0 ? 'nn-badge-low' : ''}"><i class="fa-solid fa-utensils"></i> ${remainingLive} left</span>
                    </div>
                    <div class="nn-card-vendor" style="display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.6); padding: 5px 10px; border-radius: 20px;">
                        <img src="${avatarImg}" style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--border-glow); object-fit: cover;">
                        <div style="display: flex; flex-direction: column; text-align: left;">
                            <div style="display: flex; align-items: center; gap: 5px;">
                                <strong style="font-size: 0.85rem; color: white;">${item.vendorName}</strong>
                            </div>
                            ${item.fssaiCode ? `<div class="fssai-trust-badge" title="FSSAI Food Safety Certified — License verified"><i class="fa-solid fa-shield-halved"></i> FSSAI Certified</div>` : bioText}
                        </div>
                    </div>
                </div>
                <div class="nn-expiry-container">
                    <span class="nn-expiry-label">Expires in:</span>
                    <div class="nn-expiry-timer" data-expiry="${item.expiry && window.isValidExpiry(item.expiry) ? item.expiry : ''}" data-id="${item.id}">${window.getInitialCountdownStr(item.expiry)}</div>
                </div>
                <div class="nn-card-body">
                    <h3 class="nn-card-title">${item.name}</h3>
                    <p class="nn-card-desc">${item.description || ''}</p>
                    <div class="nn-card-meta">
                        <div class="nn-card-price">₹${item.price}<span>/portion</span></div>
                        <div class="nn-card-expiry"><i class="fa-regular fa-clock"></i> ${window.formatExpiryDisplay(item.expiry)}</div>
                    </div>
                </div>
                <div class="nn-card-footer nn-card-footer-buyer">
                    <div class="nn-stepper">
                        <button class="nn-step-btn stepper-btn minus" data-id="${item.id}" ${isAllInBasket || isExpired ? 'disabled' : ''}><i class="fa-solid fa-minus"></i></button>
                        <span class="nn-step-val stepper-val" id="stepper-${item.id}">${stepperVal}</span>
                        <button class="nn-step-btn stepper-btn plus" data-id="${item.id}" ${isAllInBasket || isExpired ? 'disabled' : ''}><i class="fa-solid fa-plus"></i></button>
                    </div>
                    <button class="nn-add-btn add-btn" data-id="${item.id}" ${(isAllInBasket || isExpired) ? 'disabled' : ''}>
                        <i class="fa-solid fa-cart-plus"></i> ${isAllInBasket ? 'All in Basket' : 'Add to Basket'}
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
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const card = btn.closest('.nn-food-card');
                const id = btn.dataset.id || (card ? card.dataset.id : null);
                const span = card ? card.querySelector('.stepper-val') : document.getElementById(`stepper-${id}`);
                if (!span) return;

                let val = parseInt(span.textContent || span.innerText, 10) || 1;
                const item = state.listings.find(l => String(l.id) === String(id));
                if (!item) return;

                const inCart = (state.cart || []).find(c => String(c.item.id) === String(id));
                const inCartQty = inCart ? (parseInt(inCart.qty, 10) || 0) : 0;
                const liveStock = parseInt(item.quantity != null ? item.quantity : item.qty, 10) || 0;
                const maxAvailable = Math.max(0, liveStock - inCartQty);

                if (btn.classList.contains('plus')) {
                    if (val < maxAvailable) {
                        val++;
                    } else {
                        showToast(`Only ${maxAvailable} portion(s) available to add!`, "info");
                    }
                } else if (btn.classList.contains('minus')) {
                    if (val > 1) val--;
                }
                span.textContent = val;
                span.innerText = val;
            };
        });

        document.querySelectorAll('.add-btn, .nn-add-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const card = btn.closest('.nn-food-card');
                const id = btn.dataset.id || (card ? card.dataset.id : null);
                const item = state.listings.find(l => String(l.id) === String(id));
                const span = card ? card.querySelector('.stepper-val') : document.getElementById(`stepper-${id}`);
                const qtyToAdd = span ? (parseInt(span.textContent || span.innerText, 10) || 1) : 1;

                if (item && qtyToAdd > 0) {
                    addToCart(item, qtyToAdd, e);
                }
            };
        });
    }

    function addToCart(item, qtyToAdd, e) {
        if (window.isItemExpired(item.expiry)) {
            showToast("This item has expired and can no longer be added.", "error");
            return;
        }

        const inCart = (state.cart || []).find(c => String(c.item.id) === String(item.id));
        const currentInCart = inCart ? (parseInt(inCart.qty) || 0) : 0;
        const liveStock = parseInt(item.quantity != null ? item.quantity : item.qty, 10) || 0;
        const maxCanAdd = Math.max(0, liveStock - currentInCart);

        if (maxCanAdd <= 0) {
            showToast(`All ${liveStock} available portions are already in your basket!`, "info");
            return;
        }

        const actualQty = Math.min(qtyToAdd, maxCanAdd);

        if (inCart) {
            inCart.qty += actualQty;
        } else {
            state.cart.push({ item: { ...item }, qty: actualQty });
        }

        updateCartBadge();
        renderExchangeGrid();

        // Fly Animation
        if (e && e.target) {
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
        }

        showToast(`${actualQty} portion(s) of ${item.name} added to your basket!`, 'success');
        renderCartItems();
    }

    function updateCartBadge() {
        const counts = document.querySelectorAll('.cart-count, .crop-cart-count');
        const totalItems = state.cart.reduce((sum, c) => sum + (parseInt(c.qty, 10) || 1), 0);
        counts.forEach(c => {
            c.innerText = totalItems;
            if (c.classList.contains('crop-cart-count')) {
                c.style.display = totalItems > 0 ? 'inline-block' : 'none';
            }
        });
    }

    function renderCartItems() {
        const list = document.getElementById('cart-items-list');
        if (!list) return;

        if (state.cart.length === 0) {
            list.innerHTML = '<div class="empty-cart-msg">Your basket is empty. 🌱</div>';
            updateCartTotals();
            return;
        }

        list.innerHTML = state.cart.map((cartItem, idx) => {
            const u = (cartItem.item.unit || '').toLowerCase().trim();
            let metricSubtext = '';
            if (u === 'quintal' || u === 'quintals' || u === 'q') {
                metricSubtext = ` ≈ ${(cartItem.qty * 100).toLocaleString()} kg`;
            } else if (u === 'ton' || u === 'tonne' || u === 'tons' || u.includes('metric')) {
                metricSubtext = ` ≈ ${(cartItem.qty * 1000).toLocaleString()} kg`;
            } else if (u === 'crate' || u === 'crates') {
                metricSubtext = ` ≈ ${(cartItem.qty * 25).toLocaleString()} kg`;
            }

            return `
            <div class="cart-item-row" style="display:flex; justify-content:space-between; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-glow);">
                <div>
                    <strong>${cartItem.item.name}</strong><br>
                    <small style="color: var(--text-muted);">${cartItem.item.vendorName || cartItem.item.vendorname || 'Verified Partner'}</small><br>
                    ${cartItem.item.unit ? `<small style="color: #10b981; font-weight: 600;">Rate: ₹${cartItem.item.price}/${cartItem.item.unit}</small><br>` : ''}
                    <div class="stepper-wrap" style="display:flex; align-items:center; gap: 10px; margin-top: 5px;">
                        <button class="cart-minus btn-outline btn-sm" data-idx="${idx}" style="padding: 2px 8px; color: var(--text-color); border-color: var(--border-glow);"><i class="fa-solid fa-minus"></i></button>
                        <span style="font-weight: bold;">${cartItem.qty} ${cartItem.item.unit || ''} ${metricSubtext ? `<span style="font-size:0.75rem; color:#10b981; font-weight:600;">(${metricSubtext})</span>` : ''}</span>
                        <button class="cart-plus btn-outline btn-sm" data-idx="${idx}" style="padding: 2px 8px; color: var(--text-color); border-color: var(--border-glow);"><i class="fa-solid fa-plus"></i></button>
                    </div>
                </div>
                <div style="text-align: right; display: flex; flex-direction: column; justify-content: space-between;">
                    <strong>₹${cartItem.item.price * cartItem.qty}</strong>
                    <button class="remove-item" data-idx="${idx}" style="background:none; border:none; color:#e74c3c; cursor:pointer; margin-top: 5px;"><i class="fa-solid fa-trash"></i> Remove</button>
                </div>
            </div>
            `;
        }).join('');

        const syncPortalOnCartChange = () => {
            if (state.activePortal === 'crop_buyer' && typeof renderCropBuyerPortal === 'function') {
                renderCropBuyerPortal();
            } else if (typeof renderExchangeGrid === 'function') {
                renderExchangeGrid();
            }
        };

        document.querySelectorAll('.cart-minus').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = btn.dataset.idx;
                const cartItem = state.cart[idx];
                if (!cartItem) return;
                if (cartItem.qty > 1) {
                    cartItem.qty--;
                } else {
                    state.cart.splice(idx, 1);
                }
                renderCartItems();
                updateCartBadge();
                syncPortalOnCartChange();
            });
        });

        document.querySelectorAll('.cart-plus').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = btn.dataset.idx;
                const cartItem = state.cart[idx];
                if (!cartItem) return;
                const originalListing = state.listings.find(l => String(l.id) === String(cartItem.item.id));
                const totalStock = originalListing 
                    ? (parseInt(originalListing.quantity != null ? originalListing.quantity : originalListing.qty, 10) || 0)
                    : (parseInt(cartItem.item.quantity != null ? cartItem.item.quantity : cartItem.item.qty, 10) || cartItem.qty);

                if (cartItem.qty < totalStock) {
                    cartItem.qty++;
                    renderCartItems();
                    updateCartBadge();
                    syncPortalOnCartChange();
                } else {
                    showToast(`Maximum available portions (${totalStock}) reached!`, "error");
                }
            });
        });

        document.querySelectorAll('.remove-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = btn.dataset.idx;
                state.cart.splice(idx, 1);
                renderCartItems();
                updateCartBadge();
                syncPortalOnCartChange();
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
        const resetExpiryInput = () => {
            const hiddenExpiry = document.getElementById('p-expiry');
            const displayExpiry = document.getElementById('p-expiry-display');
            if (hiddenExpiry) hiddenExpiry.value = '';
            if (displayExpiry) displayExpiry.value = '';
        };

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                form.reset();
                document.getElementById('p-id').value = '';
                document.getElementById('submit-btn').innerHTML = '<i class="fa-solid fa-leaf"></i> Publish Listing';
                cancelBtn.style.display = 'none';
                resetExpiryInput();
            });
        }

        const pImgInput = document.getElementById('p-img');
        if (pImgInput) {
            const handleImageLinkResolve = async () => {
                const val = (pImgInput.value || '').trim();
                if (!val) return;
                if (val.includes('share.google') || val.includes('goo.gl') || val.includes('bit.ly') || val.includes('tinyurl.com')) {
                    try {
                        showToast("Resolving Google image link...", "info");
                        const res = await fetch(`${API_BASE}/resolve-image?url=${encodeURIComponent(val)}`);
                        if (res.ok) {
                            const data = await res.json();
                            if (data.resolvedUrl && data.resolvedUrl !== val) {
                                pImgInput.value = data.resolvedUrl;
                                showToast("Google image link resolved! 🖼️", "success");
                            }
                        }
                    } catch (err) { }
                }
            };
            pImgInput.addEventListener('change', handleImageLinkResolve);
            pImgInput.addEventListener('blur', handleImageLinkResolve);
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
                const rawImg = (document.getElementById('p-img') && document.getElementById('p-img').value) ? document.getElementById('p-img').value.trim() : '';
                let customImg = rawImg ? (window.resolveCustomImageUrl ? window.resolveCustomImageUrl(rawImg) : rawImg) : null;

                if (rawImg && (rawImg.includes('share.google') || rawImg.includes('goo.gl') || rawImg.includes('bit.ly') || rawImg.includes('tinyurl.com'))) {
                    try {
                        const resolveRes = await fetch(`${API_BASE}/resolve-image?url=${encodeURIComponent(rawImg)}`);
                        if (resolveRes.ok) {
                            const data = await resolveRes.json();
                            if (data.resolvedUrl) {
                                customImg = data.resolvedUrl;
                                if (document.getElementById('p-img')) document.getElementById('p-img').value = data.resolvedUrl;
                            }
                        }
                    } catch (e) { }
                }

                if (!expiry || !window.isValidExpiry(expiry)) {
                    showToast("Please select an expiry date & time.", "warning");
                    window.toggleLiquidGlassCalendar();
                    return;
                }

                if (expiry && window.isItemExpired(expiry)) {
                    showToast("Expiry date and time cannot be in the past.", "error");
                    return;
                }

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
                    imageUrl: customImg || getSmartFoodImage(name, category, null),
                    expiryTime: (expiry && window.isValidExpiry(expiry)) ? new Date(expiry).toISOString() : null
                };

                // ---- DEMO MODE: bypass API for demo tokens ----
                const isDemoToken = token.startsWith('demo-token');
                if (isDemoToken) {
                    const user = JSON.parse(sessionStorage.getItem('nourishUser') || '{}');
                    if (pId) {
                        // UPDATE existing
                        const idx = state.listings.findIndex(l => l.id == pId);
                        if (idx !== -1) {
                            state.listings[idx] = {
                                ...state.listings[idx],
                                name, category,
                                qty: parseInt(qty),
                                price: parseFloat(price),
                                description,
                                img: getSmartFoodImage(name, category, customImg),
                                expiry: expiry ? new Date(expiry).toISOString() : null
                            };
                        }
                        showToast("Listing updated! 🌱", "success");
                    } else {
                        // CREATE new
                        const newItem = {
                            id: 'demo-' + Date.now(),
                            name, category,
                            qty: parseInt(qty),
                            quantity: parseInt(qty),
                            price: parseFloat(price),
                            description,
                            expiry: expiry ? new Date(expiry).toISOString() : null,
                            expiryTime: expiry ? new Date(expiry).toISOString() : null,
                            vendorId: user.id,
                            vendorName: user.name || 'Demo Seller',
                            vendorAvatar: user.avatarUrl || 'assets/default-avatar.jpg',
                            isVerified: true,
                            fssaiCode: user.fssaiCode || '',
                            img: getSmartFoodImage(name, category, customImg)
                        };
                        state.listings.unshift(newItem);
                        // Persist demo listing to localStorage so it survives refresh
                        const saved = JSON.parse(localStorage.getItem('nn_demo_listings') || '[]');
                        saved.unshift(newItem);
                        localStorage.setItem('nn_demo_listings', JSON.stringify(saved));
                        showToast("Published successfully! 🌱", "success");
                        // Live stat update
                        updateLiveStats();
                        setTimeout(() => { animateStatBump('listed'); animateStatBump('fulfilled'); animateStatBump('vendors'); }, 100);
                    }
                    form.reset();
                    document.getElementById('p-id').value = '';
                    document.getElementById('submit-btn').innerHTML = '<i class="fa-solid fa-leaf"></i> Publish Listing';
                    if (cancelBtn) cancelBtn.style.display = 'none';
                    resetExpiryInput();
                    renderSellerListings();
                    return;

                }

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
                        // If updating a deleted or missing listing returns 404, fallback to CREATE automatically!
                        if (response.status === 404) {
                            response = await fetch(`${API_BASE}/listings`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify(payload)
                            });
                        }
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
                        if (cancelBtn) cancelBtn.style.display = 'none';
                        resetExpiryInput();
                        if (typeof broadcastInventoryChange === 'function') broadcastInventoryChange();
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

    // =========================================================================
    // CROP SELLER PORTAL (DARK THEME - SIH 2026 AGRI EXTENSION)
    // =========================================================================

    // Helper: grammatically correct harvest label
    function formatHarvestLabel(dateStr) {
        if (!dateStr) return 'Fresh Yield';
        const today = new Date();
        today.setHours(0, 0, 0, 0); // strip time — compare by calendar day
        const harvestDay = new Date(dateStr);
        harvestDay.setHours(0, 0, 0, 0);
        const formatted = harvestDay.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        return harvestDay > today
            ? `Harvests on ${formatted}`
            : `Harvested ${formatted}`;
    }

    function renderCropSellerPortal() {
        const root = portalsRoot || document.getElementById('nn-portals-root');
        if (!root) return;
        const user = JSON.parse(sessionStorage.getItem('nourishUser') || '{}');
        // Only show THIS seller's own crop listings (not other sellers')
        const cropListings = state.listings.filter(l => 
            String(l.vendorId) === String(user.id) &&
            l.status !== 'sold' &&
            (parseInt(l.qty || l.quantity) || 0) > 0
        );

        let totalCropKg = 0;
        cropListings.forEach(l => {
            const q = parseFloat(l.qty || l.quantity || 0);
            const u = (l.unit || '').toLowerCase();
            const factor = (u === 'quintal' || u === 'q') ? 100 : ((u === 'ton' || u === 'tonne') ? 1000 : 1);
            totalCropKg += (q * factor);
        });
        const totalQuintals = (totalCropKg / 100).toFixed(1);

        root.innerHTML = `
            <div class="crop-portal-dark-theme animate-reveal">
                <div class="container" style="max-width: 1300px; margin: 0 auto; padding: 1.5rem 2rem 3rem;">
                    
                    <!-- Header Banner -->
                    <div class="crop-card-dark" style="margin-bottom: 2rem; border-left: 4px solid #f59e0b !important;">
                        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1.5rem;">
                            <div style="display: flex; align-items: center; gap: 1.25rem;">
                                <div style="width: 68px; height: 68px; border-radius: 18px; background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.3)); border: 1.5px solid #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; color: #fbbf24;">
                                    <i class="fa-solid fa-wheat-awn"></i>
                                </div>
                                <div>
                                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                        <h1 class="crop-portal-title" style="font-size: 1.65rem; font-weight: 800; margin: 0; color: var(--crop-text-title);">${user.organizationName || user.name || 'Green Valley Farmers FPO'}</h1>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 18px; margin-top: 6px; font-size: 0.85rem; color: var(--crop-text-muted); flex-wrap: wrap;">
                                        ${user.phone ? `<span><i class="fa-solid fa-phone" style="color: #f59e0b;"></i> ${user.phone}</span>` : ''}
                                        ${user.email ? `<span><i class="fa-solid fa-envelope" style="color: #f59e0b;"></i> ${user.email}</span>` : ''}
                                        ${user.address ? `<span><i class="fa-solid fa-location-dot" style="color: #f59e0b;"></i> ${user.address}</span>` : ''}
                                    </div>
                                </div>
                            </div>


                        </div>

                        <!-- Stats Strip -->
                        <div class="crop-divider" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1.75rem; padding-top: 1.5rem; border-top: 1px solid var(--crop-divider);">
                            <div class="crop-stat-box" style="padding: 1rem; border-radius: 14px;">
                                <div class="crop-stat-label" style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.8px;">Active Crop Batches</div>
                                <div class="crop-stat-val" style="font-size: 1.7rem; font-weight: 800; margin-top: 4px;">${cropListings.length}</div>
                            </div>
                            <div class="crop-stat-box" style="padding: 1rem; border-radius: 14px;">
                                <div class="crop-stat-label" style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.8px;">Total Harvest Volume</div>
                                <div style="font-size: 1.7rem; font-weight: 800; color: #f59e0b; margin-top: 4px;">${totalQuintals} <span style="font-size: 0.95rem; font-weight: 600; color: var(--crop-text-muted);">Quintals</span></div>
                            </div>
                            <div class="crop-stat-box" style="padding: 1rem; border-radius: 14px;">
                                <div class="crop-stat-label" style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.8px;">Est. Weight Rescued</div>
                                <div style="font-size: 1.7rem; font-weight: 800; color: #10b981; margin-top: 4px;">${totalCropKg.toLocaleString()} <span style="font-size: 0.95rem; font-weight: 600; color: var(--crop-text-muted);">kg</span></div>
                            </div>
                        </div>
                    </div>

                    <!-- Crop Listings Section -->
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
                        <h2 style="font-size: 1.25rem; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 8px; color: var(--crop-text-title);">
                            <i class="fa-solid fa-boxes-stacked" style="color: #f59e0b;"></i> Current Crop Listings
                        </h2>
                        <span style="font-size: 0.85rem; color: var(--crop-text-muted);">Showing ${cropListings.length} produce batches</span>
                    </div>

                    <div class="crop-grid" id="crop-seller-grid">
                        ${cropListings.length === 0 ? `
                            <div class="crop-empty-state" style="grid-column: 1 / -1; text-align: center; padding: 4rem 1.5rem; border-radius: 20px;">
                                <i class="fa-solid fa-wheat-awn" style="font-size: 3rem; color: #f59e0b; margin-bottom: 1rem; display: block;"></i>
                                <h3 style="font-size: 1.3rem; margin-bottom: 0.5rem;">No Crop Harvests Listed Yet</h3>
                                <p style="font-size: 0.95rem; max-width: 450px; margin: 0 auto 1.5rem;">List surplus fruits, vegetables, grains, or tubers to connect directly with agro-processors and bulk buyers.</p>
                                <button onclick="window.openAddCropModal()" class="btn-crop-gold"><i class="fa-solid fa-circle-plus"></i> List Your First Harvest</button>
                            </div>
                        ` : cropListings.map(crop => {
                            const grade = crop.cropGrade || 'Grade B';
                            const gradeClass = grade.includes('A') ? 'grade-badge-a' : (grade.includes('C') ? 'grade-badge-c' : 'grade-badge-b');
                            const gradeLabel = grade.includes('A') ? 'Grade A · Retail Ready' : (grade.includes('C') ? 'Grade C · Animal Feed / Bio-CNG' : 'Grade B · Agro-Processing MSME');
                            const defaultImg = crop.category === 'Fruits' ? 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=600&q=80' : (crop.category === 'Grains' ? 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600&q=80' : 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&q=80');
                            const cropImg = crop.imageUrl || crop.img || defaultImg;

                            return `
                                <div class="crop-card-dark">
                                    <div style="position: relative; height: 180px; border-radius: 14px; overflow: hidden; margin-bottom: 1rem;">
                                        <img src="${cropImg}" alt="${crop.name}" style="width: 100%; height: 100%; object-fit: cover;">
                                        <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%);"></div>
                                        <div style="position: absolute; top: 12px; left: 12px; display: flex; gap: 6px; flex-wrap: wrap;">
                                            <span class="badge" style="background: rgba(0,0,0,0.7); color: #ffffff; border: 1px solid rgba(255,255,255,0.2); font-size: 0.72rem; padding: 3px 8px; border-radius: 6px;">${crop.category || 'Produce'}</span>
                                            <span class="grade-badge ${gradeClass}">${gradeLabel}</span>
                                        </div>
                                        <div style="position: absolute; bottom: 10px; left: 12px; right: 12px; display: flex; justify-content: space-between; align-items: flex-end;">
                                            <div style="font-size: 1.25rem; font-weight: 800; color: #fbbf24;">₹${crop.price || 0} <span style="font-size: 0.75rem; color: #e2e8f0; font-weight: 500;">/${crop.unit || 'Kg'}</span></div>
                                            <div style="font-size: 0.85rem; font-weight: 700; color: #34d399; background: rgba(0,0,0,0.6); padding: 2px 8px; border-radius: 6px;"><i class="fa-solid fa-scale-balanced"></i> ${crop.quantity || crop.qty || 1} ${crop.unit || 'Quintals'}</div>
                                        </div>
                                    </div>
                                    <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--crop-text-title); margin: 0 0 6px;">${crop.name}</h3>
                                    <p style="font-size: 0.85rem; color: var(--crop-text-muted); line-height: 1.4; margin: 0 0 12px; height: 38px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${crop.description || 'Harvest surplus produce available for procurement.'}</p>
                                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.78rem; color: var(--crop-text-muted); border-top: 1px solid var(--crop-divider); padding-top: 10px; gap: 8px;">
                                        <span><i class="fa-regular fa-calendar-check" style="color: #f59e0b;"></i> ${formatHarvestLabel(crop.harvestDate)}</span>
                                        <div style="display: flex; gap: 6px;">
                                            <button onclick="window.openEditCropModal('${crop.id}')" style="background: none; border: 1px solid rgba(245,158,11,0.4); color: #fbbf24; border-radius: 8px; padding: 4px 10px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                                                <i class="fa-solid fa-pen-to-square"></i> Edit
                                            </button>
                                            <button onclick="window.deleteCropListing('${crop.id}')" style="background: none; border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; border-radius: 8px; padding: 4px 10px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                                                <i class="fa-solid fa-trash-can"></i> Remove
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>

                </div>
            </div>
        `;
    }

    // =========================================================================
    // EDIT CROP LISTING MODAL
    // =========================================================================
    window.openEditCropModal = function(cropId) {
        const crop = state.listings.find(l => String(l.id) === String(cropId));
        if (!crop) { showToast("Crop listing not found.", "error"); return; }

        // Remove existing modal if any
        const existing = document.getElementById('editCropModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'editCropModal';
        modal.style.cssText = 'position: fixed; inset: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 99999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); padding: 15px;';
        modal.innerHTML = `
            <div class="crop-card-dark" style="max-width: 580px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid var(--crop-divider); padding-bottom: 1rem;">
                    <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--crop-text-title); margin: 0; display: flex; align-items: center; gap: 10px;">
                        <i class="fa-solid fa-pen-to-square" style="color: #f59e0b;"></i> Edit Crop Listing
                    </h2>
                    <button onclick="document.getElementById('editCropModal').remove()" style="background: none; border: none; font-size: 1.2rem; color: var(--crop-text-muted); cursor: pointer;">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <form id="cropEditForm" onsubmit="window.handleCropEditSubmit(event, '${cropId}')">
                    <div class="minimal-input-wrap" style="margin-bottom: 1rem;">
                        <label style="font-size: 0.8rem; color: var(--crop-text-muted); display: block; margin-bottom: 5px;">Crop / Produce Name</label>
                        <input type="text" id="editCropName" class="minimal-input" value="${crop.name || ''}" required>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div>
                            <label style="font-size: 0.8rem; color: var(--crop-text-muted); display: block; margin-bottom: 5px;">Category</label>
                            <select id="editCropCat" class="minimal-input minimal-input-select" style="cursor: pointer;">
                                <option value="Vegetables" ${crop.category === 'Vegetables' ? 'selected' : ''}>Vegetables</option>
                                <option value="Fruits" ${crop.category === 'Fruits' ? 'selected' : ''}>Fruits</option>
                                <option value="Grains" ${crop.category === 'Grains' ? 'selected' : ''}>Grains &amp; Pulses</option>
                                <option value="Tubers" ${crop.category === 'Tubers' ? 'selected' : ''}>Tubers / Potatoes</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: 0.8rem; color: var(--crop-text-muted); display: block; margin-bottom: 5px;">Quality Grade</label>
                            <select id="editCropGrade" class="minimal-input minimal-input-select" style="cursor: pointer;">
                                <option value="Grade B" ${(crop.cropGrade || '') === 'Grade B' ? 'selected' : ''}>Grade B (Agro-Processing MSME)</option>
                                <option value="Grade A" ${(crop.cropGrade || '') === 'Grade A' ? 'selected' : ''}>Grade A (Direct Retail Ready)</option>
                                <option value="Grade C" ${(crop.cropGrade || '') === 'Grade C' ? 'selected' : ''}>Grade C (Animal Feed / Bio-CNG)</option>
                            </select>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div>
                            <label style="font-size: 0.8rem; color: var(--crop-text-muted); display: block; margin-bottom: 5px;">Quantity</label>
                            <input type="number" id="editCropQty" class="minimal-input" value="${crop.quantity || crop.qty || ''}" min="1" required>
                        </div>
                        <div>
                            <label style="font-size: 0.8rem; color: var(--crop-text-muted); display: block; margin-bottom: 5px;">Unit</label>
                            <select id="editCropUnit" class="minimal-input minimal-input-select" style="cursor: pointer;">
                                <option value="Quintal" ${crop.unit === 'Quintal' ? 'selected' : ''}>Quintals (100 kg)</option>
                                <option value="Kg" ${crop.unit === 'Kg' ? 'selected' : ''}>Kilograms (kg)</option>
                                <option value="Tons" ${crop.unit === 'Tons' ? 'selected' : ''}>Metric Tons</option>
                                <option value="Crates" ${crop.unit === 'Crates' ? 'selected' : ''}>Crates</option>
                            </select>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div>
                            <label style="font-size: 0.8rem; color: var(--crop-text-muted); display: block; margin-bottom: 5px;">Price per Unit (₹)</label>
                            <input type="number" id="editCropPrice" class="minimal-input" value="${crop.price || ''}" min="0" step="0.5" required>
                        </div>
                        <div>
                            <label style="font-size: 0.8rem; color: var(--crop-text-muted); display: block; margin-bottom: 5px;">Harvest Date</label>
                            <input type="date" id="editCropHarvestDate" class="minimal-input" value="${crop.harvestDate || ''}">
                        </div>
                    </div>

                    <div class="minimal-input-wrap" style="margin-bottom: 1rem;">
                        <label style="font-size: 0.8rem; color: var(--crop-text-muted); display: block; margin-bottom: 5px;">Produce Notes / Storage Conditions</label>
                        <textarea id="editCropDesc" class="minimal-input" rows="2">${crop.description || ''}</textarea>
                    </div>

                    <div class="minimal-input-wrap" style="margin-bottom: 0.5rem;">
                        <label style="font-size: 0.8rem; color: var(--crop-text-muted); display: block; margin-bottom: 5px;">
                            <i class="fa-solid fa-image" style="color: #f59e0b;"></i> Crop Image URL <span style="font-weight:400; opacity:0.65;">(paste image link)</span>
                        </label>
                        <input type="url" id="editCropImageUrl" class="minimal-input" value="${crop.imageUrl || crop.img || ''}" placeholder="https://..." oninput="window.previewEditCropImage(this.value)">
                    </div>
                    <div id="editCropImagePreviewWrap" style="margin-bottom: 1.5rem; display: ${(crop.imageUrl || crop.img) ? 'block' : 'none'};">
                        <img id="editCropImagePreview" src="${crop.imageUrl || crop.img || ''}" alt="Preview" style="width: 100%; height: 140px; object-fit: cover; border-radius: 12px; border: 1.5px solid rgba(245,158,11,0.35);" onerror="document.getElementById('editCropImagePreviewWrap').style.display='none'">
                    </div>

                    <button type="submit" class="btn-crop-gold w-100" style="width: 100%; justify-content: center; height: 50px; font-size: 1rem;">
                        <i class="fa-solid fa-floppy-disk"></i> Save Changes
                    </button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
    };

    window.previewEditCropImage = function(url) {
        const wrap = document.getElementById('editCropImagePreviewWrap');
        const img = document.getElementById('editCropImagePreview');
        if (!url || !url.startsWith('http')) { if (wrap) wrap.style.display = 'none'; return; }
        if (img) img.src = url;
        if (wrap) wrap.style.display = 'block';
    };

    window.handleCropEditSubmit = async function(e, cropId) {
        e.preventDefault();
        const token = sessionStorage.getItem('nourishToken');

        const updates = {
            name:        document.getElementById('editCropName').value.trim(),
            category:    document.getElementById('editCropCat').value,
            cropGrade:   document.getElementById('editCropGrade').value,
            quantity:    document.getElementById('editCropQty').value,
            unit:        document.getElementById('editCropUnit').value,
            price:       parseFloat(document.getElementById('editCropPrice').value) || 0,
            harvestDate: document.getElementById('editCropHarvestDate').value,
            description: document.getElementById('editCropDesc').value.trim(),
            imageUrl:    (document.getElementById('editCropImageUrl')?.value || '').trim() || null
        };

        // Close modal immediately
        document.getElementById('editCropModal')?.remove();

        const numericQty = parseInt(updates.quantity, 10) || 1;
        const normalizedUpdates = {
            ...updates,
            qty: numericQty,
            quantity: String(numericQty)
        };

        // Update state.listings instantly → re-render without refresh
        const idx = state.listings.findIndex(l => String(l.id) === String(cropId));
        if (idx !== -1) {
            state.listings[idx] = { ...state.listings[idx], ...normalizedUpdates };
        }

        // Also update local caches
        try {
            let demo = JSON.parse(localStorage.getItem('nn_demo_listings') || '[]');
            const dIdx = demo.findIndex(l => String(l.id) === String(cropId));
            if (dIdx !== -1) {
                demo[dIdx] = { ...demo[dIdx], ...normalizedUpdates };
                localStorage.setItem('nn_demo_listings', JSON.stringify(demo));
            }

            let cached = JSON.parse(localStorage.getItem('nn_cached_listings') || '[]');
            const cIdx = cached.findIndex(l => String(l.id) === String(cropId));
            if (cIdx !== -1) {
                cached[cIdx] = { ...cached[cIdx], ...normalizedUpdates };
                localStorage.setItem('nn_cached_listings', JSON.stringify(cached));
            }
        } catch (e) { }

        renderCropSellerPortal();
        if (state.activePortal === 'crop_buyer' && typeof renderCropBuyerPortal === 'function') {
            renderCropBuyerPortal();
        }
        showToast('Crop listing updated! 🌾', 'success');

        // Sync with server in background
        try {
            await fetch(`${API_BASE}/listings/${cropId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(normalizedUpdates)
            });
        } catch (err) {
            console.warn('Edit sync error (changes kept locally):', err);
        }
    };



    // =========================================================================
    // CROP BUYER PORTAL (DARK THEME - SIH 2026 AGRI EXTENSION)
    // =========================================================================
    let currentCropFilterCat = 'All';
    let currentCropFilterGrade = 'All';

    function renderCropBuyerPortal() {
        const root = portalsRoot || document.getElementById('nn-portals-root');
        if (!root) return;
        const user = JSON.parse(sessionStorage.getItem('nourishUser') || '{}');

        // Strictly filter to ONLY crop/agri listings — never fall back to food listings
        let allCrops = state.listings.filter(l => l.produceType === 'crop' || l.cropGrade || l.unit === 'Quintal' || l.unit === 'q');

        let filteredCrops = allCrops.filter(item => {
            if (item.status === 'sold' || item.status === 'claimed') return false;
            if (currentCropFilterCat !== 'All' && item.category !== currentCropFilterCat) return false;
            if (currentCropFilterGrade !== 'All') {
                const g = item.cropGrade || 'Grade B';
                if (!g.includes(currentCropFilterGrade)) return false;
            }
            return true;
        });

        root.innerHTML = `
            <div class="crop-portal-dark-theme animate-reveal">
                <div class="container" style="max-width: 1300px; margin: 0 auto; padding: 1.5rem 2rem 3rem;">
                    
                    <!-- Header Banner -->
                    <div class="crop-card-dark" style="margin-bottom: 2rem; border-left: 4px solid #10b981 !important;">
                        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1.5rem;">
                            <div style="display: flex; align-items: center; gap: 1.25rem;">
                                <div style="width: 68px; height: 68px; border-radius: 18px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.3)); border: 1.5px solid #10b981; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; color: #34d399;">
                                    <i class="fa-solid fa-industry"></i>
                                </div>
                                <div>
                                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                        <h1 class="crop-portal-title" style="font-size: 1.65rem; font-weight: 800; margin: 0; color: var(--crop-text-title);">${user.organizationName || user.name || 'Sahyadri Agro-Processing MSME'}</h1>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 18px; margin-top: 6px; font-size: 0.85rem; color: var(--crop-text-muted); flex-wrap: wrap;">
                                        <span><i class="fa-solid fa-phone" style="color: #10b981;"></i> ${user.phone || '+91 98765 56780'}</span>
                                        <span><i class="fa-solid fa-envelope" style="color: #10b981;"></i> ${user.email || 'buyer@agroprocessing.com'}</span>
                                        <span><i class="fa-solid fa-truck-ramp-box" style="color: #10b981;"></i> Bulk Sourcing & Logistics Enabled</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Multi-Tier Procurement Guide -->
                        <div class="crop-divider" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--crop-divider);">
                            <div class="crop-guide-box-a" style="padding: 12px 16px; border-radius: 12px;">
                                <span class="grade-badge grade-badge-a" style="margin-bottom: 6px;">Grade A · Retail Ready</span>
                                <p style="font-size: 0.78rem; margin: 4px 0 0; color: var(--crop-text-muted);">Ideal for immediate wholesale distribution, retail, and community canteens.</p>
                            </div>
                            <div class="crop-guide-box-b" style="padding: 12px 16px; border-radius: 12px;">
                                <span class="grade-badge grade-badge-b" style="margin-bottom: 6px;">Grade B · Agro-Processing</span>
                                <p style="font-size: 0.78rem; margin: 4px 0 0; color: var(--crop-text-muted);">Overripe/bruised produce at huge discounts for puree, paste, juice, and dehydration.</p>
                            </div>
                            <div class="crop-guide-box-c" style="padding: 12px 16px; border-radius: 12px;">
                                <span class="grade-badge grade-badge-c" style="margin-bottom: 6px;">Grade C · Feed & Bio-CNG</span>
                                <p style="font-size: 0.78rem; margin: 4px 0 0; color: var(--crop-text-muted);">Damaged biomass for dairy cattle feed, silage, vermicompost, and Bio-CNG plants.</p>
                            </div>
                        </div>
                    </div>

                    <!-- Filter Controls -->
                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="font-size: 0.8rem; font-weight: 700; color: var(--crop-text-muted); text-transform: uppercase; margin-right: 4px;">Category:</span>
                            <button class="crop-filter-btn ${currentCropFilterCat === 'All' ? 'active' : ''}" onclick="window.filterCropBuyer('All', null)">All Produce</button>
                            <button class="crop-filter-btn ${currentCropFilterCat === 'Vegetables' ? 'active' : ''}" onclick="window.filterCropBuyer('Vegetables', null)">Vegetables</button>
                            <button class="crop-filter-btn ${currentCropFilterCat === 'Fruits' ? 'active' : ''}" onclick="window.filterCropBuyer('Fruits', null)">Fruits</button>
                            <button class="crop-filter-btn ${currentCropFilterCat === 'Grains' ? 'active' : ''}" onclick="window.filterCropBuyer('Grains', null)">Grains & Pulses</button>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="font-size: 0.8rem; font-weight: 700; color: var(--crop-text-muted); text-transform: uppercase; margin-right: 4px;">Target Grade:</span>
                            <button class="crop-filter-btn ${currentCropFilterGrade === 'All' ? 'active' : ''}" onclick="window.filterCropBuyer(null, 'All')">All Grades</button>
                            <button class="crop-filter-btn ${currentCropFilterGrade === 'A' ? 'active' : ''}" onclick="window.filterCropBuyer(null, 'A')">Grade A</button>
                            <button class="crop-filter-btn ${currentCropFilterGrade === 'B' ? 'active' : ''}" onclick="window.filterCropBuyer(null, 'B')">Grade B (MSME)</button>
                            <button class="crop-filter-btn ${currentCropFilterGrade === 'C' ? 'active' : ''}" onclick="window.filterCropBuyer(null, 'C')">Grade C (Feed)</button>
                        </div>
                    </div>

                    <!-- Marketplace Grid -->
                    <div class="crop-grid" id="crop-buyer-grid">
                        ${filteredCrops.length === 0 ? `
                            <div class="crop-empty-state" style="grid-column: 1 / -1; text-align: center; padding: 4rem 1.5rem; border-radius: 20px;">
                                <i class="fa-solid fa-basket-shopping" style="font-size: 3rem; color: #10b981; margin-bottom: 1rem; display: block;"></i>
                                <h3 style="font-size: 1.3rem; margin-bottom: 0.5rem;">No Produce Matching Filters</h3>
                                <p style="font-size: 0.95rem;">Try resetting your filters or check back as farmers list fresh harvests throughout the day.</p>
                            </div>
                        ` : filteredCrops.map(crop => {
                            const grade = crop.cropGrade || 'Grade B';
                            const gradeClass = grade.includes('A') ? 'grade-badge-a' : (grade.includes('C') ? 'grade-badge-c' : 'grade-badge-b');
                            const gradeLabel = grade.includes('A') ? 'Grade A · Retail Ready' : (grade.includes('C') ? 'Grade C · Animal Feed / Bio-CNG' : 'Grade B · Agro-Processing MSME');
                            const defaultImg = crop.category === 'Fruits' ? 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=600&q=80' : (crop.category === 'Grains' ? 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600&q=80' : 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&q=80');
                            const cropImg = crop.imageUrl || crop.img || defaultImg;

                            const inCartEntry = (state.cart || []).find(c => String(c.item.id) === String(crop.id));
                            const inCartQty = inCartEntry ? (parseInt(inCartEntry.qty, 10) || 0) : 0;
                            const maxStock = parseInt(crop.quantity || crop.qty || 1, 10);
                            const isAllInCart = inCartQty >= maxStock;
                            const stepperVal = inCartQty || 0;

                            return `
                                <div class="crop-card-dark" data-crop-id="${crop.id}">
                                    <div style="position: relative; height: 180px; border-radius: 14px; overflow: hidden; margin-bottom: 1rem;">
                                        <img src="${cropImg}" alt="${crop.name}" style="width: 100%; height: 100%; object-fit: cover;">
                                        <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%);"></div>
                                        <div style="position: absolute; top: 12px; left: 12px; display: flex; gap: 6px; flex-wrap: wrap;">
                                            <span class="badge" style="background: rgba(0,0,0,0.7); color: #ffffff; border: 1px solid rgba(255,255,255,0.2); font-size: 0.72rem; padding: 3px 8px; border-radius: 6px;">${crop.category || 'Produce'}</span>
                                            <span class="grade-badge ${gradeClass}">${gradeLabel}</span>
                                        </div>
                                        <div style="position: absolute; bottom: 10px; left: 12px; right: 12px; display: flex; justify-content: space-between; align-items: flex-end;">
                                            <div style="font-size: 1.3rem; font-weight: 800; color: #fbbf24;">₹${crop.price || 0} <span style="font-size: 0.75rem; color: #e2e8f0; font-weight: 500;">/${crop.unit || 'Kg'}</span></div>
                                            <div style="font-size: 0.85rem; font-weight: 700; color: #34d399; background: rgba(0,0,0,0.6); padding: 2px 8px; border-radius: 6px;"><i class="fa-solid fa-cubes-stacked"></i> ${maxStock} ${crop.unit || 'Quintals'}</div>
                                        </div>
                                    </div>
                                    <div style="font-size: 0.78rem; color: #10b981; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">
                                        <i class="fa-solid fa-wheat-awn"></i> ${crop.vendorName || 'Local Farmer / Mandi Collective'}
                                    </div>
                                    <h3 style="font-size: 1.15rem; font-weight: 700; margin: 0 0 6px; color: var(--crop-text-title);">${crop.name}</h3>
                                    <p style="font-size: 0.85rem; color: var(--crop-text-muted); line-height: 1.4; margin: 0 0 12px; height: 38px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${crop.description || 'Verified agricultural produce available for rapid collection and value-addition.'}</p>

                                    <div style="border-top: 1px solid var(--crop-divider); padding-top: 12px; display: flex; gap: 10px; align-items: center;">
                                        <div class="nn-stepper" style="display: flex; align-items: center; gap: 0; background: rgba(0,0,0,0.35); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; flex-shrink: 0;">
                                            <button class="crop-step-btn crop-step-minus nn-step-btn" data-crop-id="${crop.id}" ${isAllInCart ? 'disabled' : ''} style="width:36px; height:40px; display:flex; align-items:center; justify-content:center; background:none; border:none; color:#94a3b8; cursor:pointer; font-size:0.85rem;">
                                                <i class="fa-solid fa-minus"></i>
                                            </button>
                                            <span class="crop-step-val" id="crop-stepper-${crop.id}" style="min-width:28px; text-align:center; font-size:0.95rem; font-weight:700; color:#f1f5f9;">${stepperVal}</span>
                                            <button class="crop-step-btn crop-step-plus nn-step-btn" data-crop-id="${crop.id}" ${isAllInCart ? 'disabled' : ''} style="width:36px; height:40px; display:flex; align-items:center; justify-content:center; background:none; border:none; color:#10b981; cursor:pointer; font-size:0.85rem;">
                                                <i class="fa-solid fa-plus"></i>
                                            </button>
                                        </div>
                                        <button class="crop-add-btn btn-crop-emerald" data-crop-id="${crop.id}" ${isAllInCart ? 'disabled' : ''} style="flex:1; height:40px; display:flex; align-items:center; justify-content:center; gap:8px; font-size:0.9rem; ${isAllInCart ? 'opacity:0.5;' : ''}">
                                            <i class="fa-solid fa-cart-plus"></i> ${isAllInCart ? 'All in Cart' : 'Add to Cart'}
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>

                </div>
            </div>
        `;

        attachCropBuyerListeners();
    }

    // Add Crop to Cart Function
    window.addCropToCart = function(cropId, e) {
        const crop = state.listings.find(l => l.id == cropId);
        if (!crop) {
            showToast("Crop batch not found.", "error");
            return;
        }

        const maxQty = parseInt(crop.quantity || crop.qty || 1, 10);
        const inCart = (state.cart || []).find(c => String(c.item.id) === String(crop.id));
        const currentQty = inCart ? (parseInt(inCart.qty, 10) || 0) : 0;

        if (currentQty >= maxQty) {
            showToast(`All available ${maxQty} ${crop.unit || 'Quintals'} are already in your cart!`, "info");
            return;
        }

        if (inCart) {
            inCart.qty += 1;
        } else {
            state.cart.push({
                item: {
                    ...crop,
                    isCrop: true,
                    vendorName: crop.vendorName || crop.organizationName || 'Local Farmer / Mandi Collective'
                },
                qty: 1
            });
        }

        updateCartBadge();
        renderCartItems();

        // Flying animation towards cart dock
        if (e && e.target) {
            const btn = e.target.closest('button') || e.target;
            const rect = btn.getBoundingClientRect();
            const flyItem = document.createElement('div');
            flyItem.className = 'flying-item';
            flyItem.style.cssText = `position: fixed; z-index: 999999; width: 32px; height: 32px; border-radius: 50%; background: #10b981; color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.6); pointer-events: none; left: ${rect.left + rect.width / 2 - 16}px; top: ${rect.top}px;`;
            flyItem.innerHTML = '<i class="fa-solid fa-wheat-awn"></i>';
            document.body.appendChild(flyItem);

            const flyTarget = document.getElementById('crop-cart-dock') || document.getElementById('cart-toggle-dock') || document.body;
            const targetRect = flyTarget.getBoundingClientRect();

            flyItem.animate([
                { transform: 'scale(1)', left: `${rect.left + rect.width / 2 - 16}px`, top: `${rect.top}px` },
                { transform: 'scale(0.2)', left: `${targetRect.left + targetRect.width / 2 - 16}px`, top: `${targetRect.top}px` }
            ], {
                duration: 650,
                easing: 'cubic-bezier(0.165, 0.84, 0.44, 1)'
            }).onfinish = () => flyItem.remove();
        }

        showToast(`Added 1 ${crop.unit || 'Quintal'} of ${crop.name} to Cart! 🌾`, "success");
    };

    function attachCropBuyerListeners() {
        // Stepper buttons: + and -
        document.querySelectorAll('.crop-step-plus, .crop-step-minus').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const cropId = btn.dataset.cropId;
                const crop = state.listings.find(l => String(l.id) === String(cropId));
                if (!crop) return;

                const span = document.getElementById(`crop-stepper-${cropId}`);
                if (!span) return;

                const maxStock = parseInt(crop.quantity || crop.qty || 1, 10);
                const inCart = (state.cart || []).find(c => String(c.item.id) === String(cropId));
                let stepVal = parseInt(span.textContent || '0', 10) || 0;

                if (btn.classList.contains('crop-step-plus')) {
                    if (stepVal >= maxStock) {
                        showToast(`Only ${maxStock} ${crop.unit || 'Quintals'} available!`, "info");
                        return;
                    }
                    stepVal = Math.min(stepVal + 1, maxStock);
                } else {
                    stepVal = Math.max(stepVal - 1, 0);
                }

                span.textContent = stepVal;

                // Update add button state
                const card = btn.closest('[data-crop-id]');
                if (card) {
                    const addBtn = card.querySelector('.crop-add-btn');
                    const isAllInCart = stepVal >= maxStock;
                    if (addBtn) {
                        addBtn.disabled = isAllInCart;
                        addBtn.style.opacity = isAllInCart ? '0.5' : '1';
                        addBtn.innerHTML = `<i class="fa-solid fa-cart-plus"></i> ${isAllInCart ? 'All in Cart' : 'Add to Cart'}`;
                    }
                    const minusBtn = card.querySelector('.crop-step-minus');
                    const plusBtn = card.querySelector('.crop-step-plus');
                    if (plusBtn) plusBtn.disabled = isAllInCart;
                }
            };
        });

        // Add to Cart button
        document.querySelectorAll('.crop-add-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const cropId = btn.dataset.cropId;
                const crop = state.listings.find(l => String(l.id) === String(cropId));
                if (!crop) return;

                const span = document.getElementById(`crop-stepper-${cropId}`);
                const qtyToAdd = span ? (parseInt(span.textContent || '0', 10) || 1) : 1;
                const maxStock = parseInt(crop.quantity || crop.qty || 1, 10);

                const inCart = (state.cart || []).find(c => String(c.item.id) === String(cropId));
                const inCartQty = inCart ? (parseInt(inCart.qty, 10) || 0) : 0;

                const canAdd = Math.min(qtyToAdd, maxStock - inCartQty);
                if (canAdd <= 0) {
                    showToast(`All ${maxStock} ${crop.unit || 'Quintals'} are already in your cart!`, "info");
                    return;
                }

                if (inCart) {
                    inCart.qty = inCartQty + canAdd;
                } else {
                    state.cart.push({
                        item: { ...crop, isCrop: true, vendorName: crop.vendorName || 'Local Farmer / Mandi Collective' },
                        qty: canAdd
                    });
                }

                updateCartBadge();
                renderCartItems();

                // Flying animation
                const rect = btn.getBoundingClientRect();
                const flyItem = document.createElement('div');
                flyItem.style.cssText = `position:fixed;z-index:999999;width:32px;height:32px;border-radius:50%;background:#10b981;color:white;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 15px rgba(16,185,129,0.6);pointer-events:none;left:${rect.left+rect.width/2-16}px;top:${rect.top}px;`;
                flyItem.innerHTML = '<i class="fa-solid fa-wheat-awn"></i>';
                document.body.appendChild(flyItem);
                const flyTarget = document.getElementById('crop-cart-dock') || document.getElementById('cart-toggle-dock') || document.body;
                const tr = flyTarget.getBoundingClientRect();
                flyItem.animate([
                    { transform:'scale(1)', left:`${rect.left+rect.width/2-16}px`, top:`${rect.top}px` },
                    { transform:'scale(0.2)', left:`${tr.left+tr.width/2-16}px`, top:`${tr.top}px` }
                ], { duration:650, easing:'cubic-bezier(0.165,0.84,0.44,1)' }).onfinish = () => flyItem.remove();

                showToast(`Added ${canAdd} ${crop.unit || 'Quintal'} of ${crop.name} to Cart! 🌾`, "success");
            };
        });
    }

    window.filterCropBuyer = function(cat, grade) {
        if (cat !== null) currentCropFilterCat = cat;
        if (grade !== null) currentCropFilterGrade = grade;
        renderCropBuyerPortal();

    };

    // Modal for Adding Crop Harvest
    window.openAddCropModal = function() {
        let modal = document.getElementById('addCropModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'addCropModal';
            modal.className = 'modal-overlay active';
            modal.style.cssText = 'position: fixed; inset: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 99999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); padding: 15px;';
            modal.innerHTML = `
                <div class="crop-card-dark" style="max-width: 580px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid var(--crop-divider); padding-bottom: 1rem;">
                        <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--crop-text-title); margin: 0; display: flex; align-items: center; gap: 10px;">
                            <i class="fa-solid fa-wheat-awn" style="color: #f59e0b;"></i> List Produce / Harvest
                        </h2>
                        <button onclick="document.getElementById('addCropModal').remove()" style="background: none; border: none; font-size: 1.2rem; color: var(--crop-text-muted); cursor: pointer;">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <form id="cropAddForm" onsubmit="window.handleCropSubmit(event)">
                        <div class="minimal-input-wrap" style="margin-bottom: 1rem;">
                            <label style="font-size: 0.8rem; color: var(--crop-text-muted); display: block; margin-bottom: 5px;">Crop / Produce Name</label>
                            <input type="text" id="cropName" class="minimal-input" placeholder="e.g. Nashik Red Tomatoes (Bumper Harvest)" required>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                            <div>
                                <label style="font-size: 0.8rem; color: var(--crop-text-muted); display: block; margin-bottom: 5px;">Category</label>
                                <select id="cropCat" class="minimal-input minimal-input-select" style="cursor: pointer;">
                                    <option value="Vegetables">Vegetables</option>
                                    <option value="Fruits">Fruits</option>
                                    <option value="Grains">Grains & Pulses</option>
                                    <option value="Tubers">Tubers / Potatoes</option>
                                </select>
                            </div>
                            <div>
                                <label style="font-size: 0.8rem; color: var(--crop-text-muted); display: block; margin-bottom: 5px;">Quality Grade</label>
                                <select id="cropGrade" class="minimal-input minimal-input-select" style="cursor: pointer;">
                                    <option value="Grade B">Grade B (Agro-Processing MSME)</option>
                                    <option value="Grade A">Grade A (Direct Retail Ready)</option>
                                    <option value="Grade C">Grade C (Animal Feed / Bio-CNG)</option>
                                </select>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                            <div>
                                <label style="font-size: 0.8rem; color: var(--crop-text-muted); display: block; margin-bottom: 5px;">Quantity</label>
                                <input type="number" id="cropQty" class="minimal-input" placeholder="e.g. 15" min="1" required>
                            </div>
                            <div>
                                <label style="font-size: 0.8rem; color: var(--crop-text-muted); display: block; margin-bottom: 5px;">Unit</label>
                                <select id="cropUnit" class="minimal-input minimal-input-select" style="cursor: pointer;">
                                    <option value="Quintal">Quintals (100 kg)</option>
                                    <option value="Kg">Kilograms (kg)</option>
                                    <option value="Tons">Metric Tons</option>
                                    <option value="Crates">Crates</option>
                                </select>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                            <div>
                                <label style="font-size: 0.8rem; color: var(--crop-text-muted); display: block; margin-bottom: 5px;">Price per Unit (₹)</label>
                                <input type="number" id="cropPrice" class="minimal-input" placeholder="e.g. 6" min="0" step="0.5" required>
                            </div>
                            <div>
                                <label style="font-size: 0.8rem; color: var(--crop-text-muted); display: block; margin-bottom: 5px;">Harvest Date</label>
                                <input type="date" id="cropHarvestDate" class="minimal-input">
                            </div>
                        </div>

                        <div class="minimal-input-wrap" style="margin-bottom: 1rem;">
                            <label style="font-size: 0.8rem; color: var(--crop-text-muted); display: block; margin-bottom: 5px;">Produce Notes / Storage Conditions</label>
                            <textarea id="cropDesc" class="minimal-input" rows="2" placeholder="e.g. Freshly harvested surplus, high sugar content. Ready for immediate pickup at APMC Gate 4."></textarea>
                        </div>

                        <div class="minimal-input-wrap" style="margin-bottom: 0.5rem;">
                            <label style="font-size: 0.8rem; color: var(--crop-text-muted); display: block; margin-bottom: 5px;">
                                <i class="fa-solid fa-image" style="color: #f59e0b;"></i> Crop Image URL <span style="font-weight: 400; opacity: 0.65;">(paste Google image link)</span>
                            </label>
                            <input type="url" id="cropImageUrl" class="minimal-input" placeholder="https://images.unsplash.com/... or any direct image link" oninput="window.previewCropImage(this.value)">
                        </div>
                        <div id="cropImagePreviewWrap" style="margin-bottom: 1.5rem; display: none;">
                            <img id="cropImagePreview" src="" alt="Preview" style="width: 100%; height: 140px; object-fit: cover; border-radius: 12px; border: 1.5px solid rgba(245,158,11,0.35);" onerror="document.getElementById('cropImagePreviewWrap').style.display='none'">
                        </div>

                        <button type="submit" class="btn-crop-gold w-100" style="width: 100%; justify-content: center; height: 50px; font-size: 1rem;">
                            <i class="fa-solid fa-leaf"></i> Publish Harvest Listing
                        </button>
                    </form>
                </div>
            `;
            document.body.appendChild(modal);
        } else {
            modal.style.display = 'flex';
        }
    };

    window.previewCropImage = function(url) {
        const wrap = document.getElementById('cropImagePreviewWrap');
        const img = document.getElementById('cropImagePreview');
        if (!url || !url.startsWith('http')) {
            if (wrap) wrap.style.display = 'none';
            return;
        }
        if (img) img.src = url;
        if (wrap) wrap.style.display = 'block';
    };

    window.handleCropSubmit = async function(e) {
        e.preventDefault();
        const user = JSON.parse(sessionStorage.getItem('nourishUser') || '{}');
        const name = document.getElementById('cropName').value.trim();
        const category = document.getElementById('cropCat').value;
        const cropGrade = document.getElementById('cropGrade').value;
        const quantity = document.getElementById('cropQty').value;
        const unit = document.getElementById('cropUnit').value;
        const price = document.getElementById('cropPrice').value;
        const harvestDate = document.getElementById('cropHarvestDate').value;
        const description = document.getElementById('cropDesc').value.trim();
        const imageUrl = (document.getElementById('cropImageUrl')?.value || '').trim();

        const token = sessionStorage.getItem('nourishToken');
        const payload = {
            name,
            category,
            cropGrade,
            quantity,
            unit,
            price: parseFloat(price) || 0,
            harvestDate,
            description,
            imageUrl: imageUrl || null,
            produceType: 'crop',
            condition: 'Fresh Harvest'
        };

        // Close modal immediately
        const m = document.getElementById('addCropModal');
        if (m) m.remove();

        // Instantly push into state.listings so the portal re-renders right away
        const tempId = 'temp_' + Date.now();
        const tempListing = {
            ...payload,
            id: tempId,
            vendorId: user.id,
            vendorName: user.organizationName || user.name || 'My Farm',
            status: 'available',
            createdAt: new Date().toISOString()
        };
        state.listings.unshift(tempListing);
        renderCropSellerPortal();
        showToast('Crop harvest published! 🌾', 'success');

        // Sync with server in background
        try {
            const res = await fetch(`${API_BASE}/listings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                // Replace temp entry with real server entry
                const data = await res.json();
                const idx = state.listings.findIndex(l => l.id === tempId);
                if (idx !== -1 && data.listing) state.listings[idx] = { ...data.listing, isMine: true };
                renderCropSellerPortal();
            } else {
                // Server failed — keep temp in state but warn
                const d = await res.json().catch(() => ({}));
                showToast(d.error || 'Server sync failed — listing shown locally.', 'warning');
            }
        } catch (err) {
            // Network error — listing stays in local state
            console.warn('Crop publish network error (listing kept locally):', err);
        }
    };

    // Procurement Modal for Crop Buyer
    window.openProcureCropModal = function(cropId) {
        const crop = state.listings.find(l => l.id == cropId);
        if (!crop) return;

        let modal = document.getElementById('procureModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'procureModal';
            modal.className = 'modal-overlay active';
            modal.style.cssText = 'position: fixed; inset: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 99999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(8px); padding: 15px;';
            modal.innerHTML = `
                <div class="crop-card-dark" style="max-width: 500px; width: 100%; padding: 2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 1rem;">
                        <h2 style="font-size: 1.3rem; font-weight: 800; color: #ffffff; margin: 0; display: flex; align-items: center; gap: 10px;">
                            <i class="fa-solid fa-truck-ramp-box" style="color: #10b981;"></i> Confirm Procurement
                        </h2>
                        <button onclick="document.getElementById('procureModal').remove()" style="background: none; border: none; font-size: 1.2rem; color: #94a3b8; cursor: pointer;">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <div style="background: rgba(0,0,0,0.4); padding: 1rem; border-radius: 12px; margin-bottom: 1.25rem;">
                        <div style="font-size: 1.1rem; font-weight: 700; color: #ffffff; margin-bottom: 4px;">${crop.name}</div>
                        <div style="font-size: 0.85rem; color: #94a3b8;">Seller: <strong style="color: #fbbf24;">${crop.vendorName || 'Registered Producer'}</strong></div>
                        <div style="font-size: 0.85rem; color: #34d399; margin-top: 4px;">Available: <strong>${crop.quantity || crop.qty || 1} ${crop.unit || 'Quintals'}</strong> @ ₹${crop.price}/${crop.unit || 'Kg'}</div>
                    </div>

                    <form id="procureForm" onsubmit="window.handleProcureSubmit(event, ${crop.id})">
                        <div class="minimal-input-wrap" style="margin-bottom: 1rem;">
                            <label style="font-size: 0.8rem; color: #94a3b8; display: block; margin-bottom: 5px;">Procurement Quantity (${crop.unit || 'Quintals'})</label>
                            <input type="number" id="procureQty" class="minimal-input" value="${crop.quantity || crop.qty || 1}" min="1" max="${crop.quantity || crop.qty || 1}" required>
                        </div>
                        <div class="minimal-input-wrap" style="margin-bottom: 1.5rem;">
                            <label style="font-size: 0.8rem; color: #94a3b8; display: block; margin-bottom: 5px;">Pickup Vehicle / Logistics Note</label>
                            <input type="text" id="procureNote" class="minimal-input" placeholder="e.g. Tata Ace mini-truck reaching mandi yard tomorrow 9 AM">
                        </div>

                        <button type="submit" class="btn-crop-emerald w-100" style="width: 100%; justify-content: center; height: 50px; font-size: 1rem;">
                            <i class="fa-solid fa-check"></i> Complete Bulk Procurement
                        </button>
                    </form>
                </div>
            `;
            document.body.appendChild(modal);
        } else {
            modal.style.display = 'flex';
        }
    };

    window.handleProcureSubmit = async function(e, cropId) {
        e.preventDefault();
        const qty = parseInt(document.getElementById('procureQty').value) || 1;
        const note = document.getElementById('procureNote') ? document.getElementById('procureNote').value : '';
        const token = sessionStorage.getItem('nourishToken');

        // Calculate KG for impact
        const crop = state.listings.find(l => l.id == cropId);
        const u = crop ? (crop.unit || '').toLowerCase() : 'quintal';
        const factor = (u === 'quintal' || u === 'q') ? 100 : ((u === 'ton' || u === 'tonne') ? 1000 : 1);
        const procuredKg = qty * factor;

        // Save to local purchases
        const cropPurchases = JSON.parse(localStorage.getItem('nn_crop_purchases') || '[]');
        cropPurchases.push({
            cropId,
            cropName: crop ? crop.name : 'Crop Batch',
            qty,
            kg: procuredKg,
            date: new Date().toISOString()
        });
        localStorage.setItem('nn_crop_purchases', JSON.stringify(cropPurchases));

        try {
            await fetch(`${API_BASE}/listings/claim`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ listingId: cropId, quantity: qty, notes: note })
            });
            const m = document.getElementById('procureModal');
            if (m) m.remove();
            showToast(`Batch procured successfully! Rescued ${procuredKg.toLocaleString()} kg of agricultural produce. 🌾`, "success");
            refreshState();
        } catch (err) {
            const m = document.getElementById('procureModal');
            if (m) m.remove();
            showToast(`Batch procured! Rescued ${procuredKg.toLocaleString()} kg of crops. 🌾`, "success");
            refreshState();
        }
    };

    window.deleteCropListing = async function(cropId) {
        if (!confirm('Are you sure you want to remove this crop harvest listing?')) return;
        const token = sessionStorage.getItem('nourishToken');

        // Instantly remove from in-memory state
        state.listings = state.listings.filter(l => String(l.id) !== String(cropId));

        // Immediately update localStorage so it stays removed across refreshes
        try {
            let demo = JSON.parse(localStorage.getItem('nn_demo_listings') || '[]');
            demo = demo.filter(l => String(l.id) !== String(cropId));
            localStorage.setItem('nn_demo_listings', JSON.stringify(demo));

            let cached = JSON.parse(localStorage.getItem('nn_cached_listings') || '[]');
            cached = cached.filter(l => String(l.id) !== String(cropId));
            localStorage.setItem('nn_cached_listings', JSON.stringify(cached));

            let deleted = JSON.parse(localStorage.getItem('nn_deleted_listings') || '[]');
            if (!deleted.includes(String(cropId))) deleted.push(String(cropId));
            localStorage.setItem('nn_deleted_listings', JSON.stringify(deleted));
        } catch (e) { }

        // Immediately re-render the crop seller portal DOM
        renderCropSellerPortal();
        if (state.activePortal === 'crop_buyer' && typeof renderCropBuyerPortal === 'function') {
            renderCropBuyerPortal();
        }
        showToast("Crop batch removed successfully. 🌾", "info");

        // Sync with backend API in background
        try {
            await fetch(`${API_BASE}/listings/${cropId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (err) {
            console.warn('Server delete error (already removed locally):', err);
        }
    };

    // 7. Initialize Everything


    const openCart = () => {
        if (cartDrawer) {
            cartDrawer.classList.add('active');
            if (typeof renderCartItems === 'function') renderCartItems();
        }
    };

    if (cartToggle) {
        cartToggle.addEventListener('click', openCart);
    }
    // Dock Portal-Specific Listeners
    const cartToggleDock = document.getElementById('cart-toggle-dock');
    if (cartToggleDock) {
        cartToggleDock.addEventListener('click', (e) => {
            e.preventDefault();
            openCart();
        });
    }

    const cropCartDockEl = document.getElementById('crop-cart-dock');
    if (cropCartDockEl) {
        cropCartDockEl.addEventListener('click', (e) => {
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

    const historyToggleDock = document.getElementById('history-toggle-dock');
    if (historyToggleDock) {
        historyToggleDock.addEventListener('click', (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            console.log("Dock: History Clicked (from portal-specific listener)");
            if (typeof openHistoryModal === 'function') openHistoryModal();
            else if (typeof window.openHistoryModal === 'function') window.openHistoryModal();
        });
    }




    // Community Hub / Comments Logic
    function renderCommunityWall() {
        const wall = document.getElementById('comment-list');
        if (!wall) return;

        wall.innerHTML = state.communityComments.slice().reverse().map((c, idx) => `
            <div class="comment-bubble" data-comment-id="${c.id}" style="animation-delay: ${idx * 0.1}s; position: relative;">
                <button class="comment-delete-btn" onclick="window.deleteComment('${c.id}', this)" 
                    aria-label="Delete comment" title="Delete this comment"
                    style="position:absolute; top:10px; right:10px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#ef4444; border-radius:8px; width:32px; height:32px; cursor:pointer; display:flex; align-items:center; justify-content:center; opacity:0; transition:all 0.2s ease; font-size:0.85rem;">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
                <strong style="color: ${(c.org || '').includes('Seller') || (c.org || '').includes('Hotel') ? 'var(--accent-secondary)' : 'var(--accent-primary)'}; padding-right: 2rem; display:block;">
                    ${c.name} <span style="font-weight: 400; opacity: 0.6; font-size: 0.8rem;">• ${c.org}</span>
                </strong>
                <p>"${c.text}"</p>
            </div>
        `).join('');

        // Hover show/hide delete button
        wall.querySelectorAll('.comment-bubble').forEach(bubble => {
            const btn = bubble.querySelector('.comment-delete-btn');
            bubble.addEventListener('mouseenter', () => { if (btn) btn.style.opacity = '1'; });
            bubble.addEventListener('mouseleave', () => { if (btn) btn.style.opacity = '0'; });
        });
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

    // ---- PORTAL TAB SWITCHER + COMMENT SYNC ----
    function attachPortalCommentTab() {
        // Tab switching
        const tabBtns = document.querySelectorAll('.portal-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.tab;
                // Update button styles
                tabBtns.forEach(b => {
                    b.style.borderBottomColor = 'transparent';
                    b.style.color = 'var(--text-muted)';
                });
                btn.style.borderBottomColor = 'var(--accent-primary)';
                btn.style.color = 'var(--accent-primary)';
                // Show/hide tab content
                document.querySelectorAll('.portal-tab-content').forEach(t => t.style.display = 'none');
                const tab = document.getElementById(`tab-${target}`);
                if (tab) tab.style.display = 'block';
                // Render existing comments or history when switching tabs
                if (target === 'comments') renderPortalCommentList();
                if (target === 'history') loadPortalHistory();
            });
        });

        // Comment form submission
        const form = document.getElementById('portal-comment-form');
        const input = document.getElementById('portal-comment-text');
        if (!form || !input) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = input.value.trim();
            if (!text) return;

            const user = JSON.parse(sessionStorage.getItem('nourishUser') || '{}');
            const name = user.name || (state.activePortal === 'seller' ? 'Elite Vendor' : 'Community Partner');
            const org = user.orgName || user.name || (state.activePortal === 'seller' ? 'Gourmet Provider' : 'NGO Partner');

            const newComment = {
                id: Date.now().toString(),
                name,
                org,
                role: (state.activePortal === 'seller' || user.accountType === 'restaurant' || user.accountType === 'vendor') ? 'seller' : 'buyer',
                text,
                stars: 5,
                img: (user.avatarUrl && !user.avatarUrl.includes('pravatar') && !user.avatarUrl.includes('default-avatar')) ? user.avatarUrl : null
            };

            state.communityComments.push(newComment);
            // Persist so comments survive page navigation
            localStorage.setItem('nn_comments', JSON.stringify(state.communityComments));


            // Sync to home page Voices of Impact slider
            renderCommunityWall();
            renderReviewsSlider();

            // Jump to newest slide in the slider
            const slides = document.querySelectorAll('.review-slide');
            const dots = document.querySelectorAll('.dot');
            if (slides.length > 0) {
                slides.forEach(s => s.classList.remove('active'));
                dots.forEach(d => d.classList.remove('active'));
                slides[slides.length - 1].classList.add('active');
                if (dots[dots.length - 1]) dots[dots.length - 1].classList.add('active');
            }

            // Re-render the in-portal comment list
            renderPortalCommentList();

            input.value = '';
            showToast("Your voice is now live in 'Voices of Impact'! 🌱", "success");
        });

        // Initial render of existing comments
        renderPortalCommentList();
    }

    function renderPortalCommentList() {
        const wall = document.getElementById('portal-comments-list');
        if (!wall) return;
        if (state.communityComments.length === 0) {
            wall.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding: 2rem;">No comments yet. Be the first to share!</p>`;
            return;
        }
        wall.innerHTML = state.communityComments.slice().reverse().map(c => `
            <div class="comment-bubble" data-comment-id="${c.id}" 
                style="margin-bottom: 1rem; position: relative; padding: 1.25rem 1.5rem; border-radius: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); transition: border-color 0.2s;">
                <button class="comment-delete-btn" onclick="window.deleteComment('${c.id}', this)"
                    aria-label="Delete comment" title="Delete this comment"
                    style="position:absolute; top:12px; right:12px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#ef4444; border-radius:8px; width:34px; height:34px; cursor:pointer; display:flex; align-items:center; justify-content:center; opacity:0; transition:all 0.2s ease; font-size:0.85rem;">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
                <strong style="color: var(--accent-primary); display:block; padding-right: 2.5rem;">${c.name} 
                    <span style="font-weight:400; opacity:0.6; font-size:0.8rem;">• ${c.org}</span>
                </strong>
                <p style="margin-top:0.5rem; color: var(--text-secondary); font-size: 0.95rem;">"${c.text}"</p>
            </div>
        `).join('');

        // Hover show/hide delete button
        wall.querySelectorAll('.comment-bubble').forEach(bubble => {
            const btn = bubble.querySelector('.comment-delete-btn');
            bubble.addEventListener('mouseenter', () => { if (btn) btn.style.opacity = '1'; bubble.style.borderColor = 'rgba(239,68,68,0.3)'; });
            bubble.addEventListener('mouseleave', () => { if (btn) btn.style.opacity = '0'; bubble.style.borderColor = 'rgba(255,255,255,0.06)'; });
        });
    }

    // ---- REAL-TIME HISTORY MODAL (FLOATING DOCK TRIGGERED) ----
    function openHistoryModal() {
        console.log("openHistoryModal called, activePortal:", state.activePortal);
        const modal = document.getElementById('historyModal');
        if (!modal) {
            console.error("historyModal element not found!");
            return;
        }

        modal.classList.add('active');
        modal.style.setProperty('display', 'flex', 'important');
        modal.style.setProperty('opacity', '1', 'important');
        modal.style.setProperty('visibility', 'visible', 'important');
        modal.style.setProperty('pointer-events', 'auto', 'important');
        modal.style.setProperty('z-index', '999999', 'important');

        const titleEl = modal.querySelector('h2');
        if (titleEl) {
            if (state.activePortal === 'crop_seller') {
                titleEl.textContent = 'Crop Sales & Dispatch History';
            } else if (state.activePortal === 'crop_buyer') {
                titleEl.textContent = 'Crop Procurement History';
            } else if (state.activePortal === 'seller') {
                titleEl.textContent = 'Food Distribution History';
            } else {
                titleEl.textContent = 'Claim & Order History';
            }
        }

        loadPortalHistory();
    }
    window.openHistoryModal = openHistoryModal;

    function closeHistoryModal() {
        console.log("closeHistoryModal called");
        const modal = document.getElementById('historyModal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.setProperty('display', 'none', 'important');
            modal.style.setProperty('opacity', '0', 'important');
            modal.style.setProperty('visibility', 'hidden', 'important');
            modal.style.setProperty('pointer-events', 'none', 'important');
        }
    }
    window.closeHistoryModal = closeHistoryModal;

    function switchToHistoryTab() {
        openHistoryModal();
    }
    window.switchToHistoryTab = switchToHistoryTab;

    // Attach modal close listener for backdrop click and Escape key
    const histModalBackdrop = document.getElementById('historyModal');
    if (histModalBackdrop) {
        histModalBackdrop.addEventListener('click', (e) => {
            if (e.target === histModalBackdrop) closeHistoryModal();
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const hModal = document.getElementById('historyModal');
            if (hModal && (hModal.style.display !== 'none' || hModal.classList.contains('active'))) {
                closeHistoryModal();
            }
        }
    });

    async function loadPortalHistory(silent = false) {
        const token = sessionStorage.getItem('nourishToken') || localStorage.getItem('nourishToken');
        const container = document.getElementById('modal-history-container') || document.getElementById('seller-history-container') || document.getElementById('buyer-history-container');
        const dockBadge = document.getElementById('history-dock-badge');
        const refreshBtn = document.getElementById('refreshHistoryModalBtn');

        if (refreshBtn) {
            const icon = refreshBtn.querySelector('i');
            if (icon) {
                icon.classList.add('fa-spin');
                setTimeout(() => icon.classList.remove('fa-spin'), 600);
            }
        }

        if (!token) {
            if (container) {
                container.innerHTML = `
                    <div class="empty-listings-wrap" style="text-align: center; padding: 3.5rem 2rem; background: var(--card-bg, rgba(255,255,255,0.02)); border: 1px dashed var(--border-glow); border-radius: 16px;">
                        <i class="fa-solid fa-lock" style="font-size: 2.5rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                        <h3 style="color: var(--text-primary); margin-bottom: 0.5rem;">Sign In to View History</h3>
                        <p style="color: var(--text-muted); max-width: 450px; margin: 0 auto;">Live claims and order transactions require an active account session.</p>
                    </div>
                `;
            }
            return;
        }
        if (!silent && container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                    <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2rem; color: var(--accent-primary); margin-bottom: 1rem;"></i>
                    <p>Loading real-time order & claim records from database...</p>
                </div>
            `;
        }

        try {
            let apiOrders = [];
            try {
                const res = await fetch(`${API_BASE}/orders`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const rawApi = await res.json();
                    apiOrders = (Array.isArray(rawApi) ? rawApi : []).map(a => ({
                        ...a,
                        isCrop: !!(a.cropGrade || a.produceType === 'crop' || a.unit === 'Quintal' || a.unit === 'q' || state.activePortal === 'crop_seller' || state.activePortal === 'crop_buyer')
                    }));

                    if (state.activePortal === 'crop_seller' || state.activePortal === 'crop_buyer') {
                        apiOrders = apiOrders.filter(a => a.isCrop || a.cropGrade || a.produceType === 'crop' || a.unit === 'Quintal');
                    } else if (state.activePortal === 'seller' || state.activePortal === 'buyer') {
                        apiOrders = apiOrders.filter(a => !a.cropGrade && a.produceType !== 'crop' && a.unit !== 'Quintal');
                    }
                }
            } catch (netErr) {
                console.warn("Orders fetch network fallback to local:", netErr);
            }

            // Retrieve locally tracked live orders
            let localOrders = [];
            try {
                localOrders = JSON.parse(localStorage.getItem('nn_local_orders') || '[]');
            } catch (e) { localOrders = []; }

            const user = JSON.parse(sessionStorage.getItem('nourishUser') || localStorage.getItem('nourishUser') || '{}');
            const isSellerPortal = state.activePortal === 'seller' || state.activePortal === 'crop_seller';

            // Filter local orders relevant to the current user and portal
            const relevantLocalOrders = localOrders.filter(o => {
                const isCropOrder = o.isCrop || o.cropGrade || o.sellerType === 'crop_seller' || o.buyerType === 'crop_buyer' || o.unit === 'Quintal' || o.unit === 'q';
                if (state.activePortal === 'crop_seller') {
                    const matchUser = String(o.vendorId) === String(user.id) ||
                           String(o.sellerId) === String(user.id) ||
                           o.sellerName === user.organizationName ||
                           o.sellerEmail === user.email ||
                           String(user.id) === '777' ||
                           !o.vendorId;
                    return matchUser && isCropOrder;
                } else if (state.activePortal === 'seller') {
                    const matchUser = String(o.vendorId) === String(user.id) ||
                           String(o.sellerId) === String(user.id) ||
                           o.sellerName === user.organizationName ||
                           o.sellerEmail === user.email ||
                           String(user.id) === '888' ||
                           !o.vendorId;
                    return matchUser && !isCropOrder;
                } else if (state.activePortal === 'crop_buyer') {
                    const matchUser = String(o.buyerId) === String(user.id) ||
                           o.buyerName === user.organizationName ||
                           o.buyerEmail === user.email ||
                           String(user.id) === '666' ||
                           !o.buyerId;
                    return matchUser && isCropOrder;
                } else {
                    const matchUser = String(o.buyerId) === String(user.id) ||
                           o.buyerName === user.organizationName ||
                           o.buyerEmail === user.email ||
                           String(user.id) === '999' ||
                           !o.buyerId;
                    return matchUser && !isCropOrder;
                }
            });

            // Merge & deduplicate by orderId or listingId + minute timestamp
            const mergedOrders = Array.isArray(apiOrders) ? [...apiOrders] : [];
            const apiKeys = new Set(mergedOrders.map(a => `${a.listingId}-${Math.floor(new Date(a.createdAt).getTime() / 60000)}`));

            relevantLocalOrders.forEach(loc => {
                const key = `${loc.listingId}-${Math.floor(new Date(loc.createdAt).getTime() / 60000)}`;
                if (!apiKeys.has(key)) {
                    mergedOrders.push(loc);
                }
            });

            mergedOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            const orders = mergedOrders;

            // Update dock badge with count of active or total orders
            const count = Array.isArray(orders) ? orders.length : 0;
            if (dockBadge) {
                if (count > 0) {
                    dockBadge.innerText = count > 99 ? '99+' : count;
                    dockBadge.style.display = 'inline-block';
                } else {
                    dockBadge.style.display = 'none';
                }
            }

            if (!container) return;

            if (count === 0) {
                if (state.activePortal === 'crop_seller') {
                    container.innerHTML = `
                        <div class="empty-listings-wrap" style="text-align: center; padding: 4rem 2rem; background: var(--card-bg, rgba(255,255,255,0.02)); border: 1px dashed var(--border-glow); border-radius: 16px;">
                            <i class="fa-solid fa-wheat-awn" style="font-size: 3rem; color: #f59e0b; margin-bottom: 1rem; opacity: 0.7;"></i>
                            <h3 style="color: var(--text-primary); margin-bottom: 0.5rem;">No Crop Dispatch History Yet</h3>
                            <p style="color: var(--text-muted); max-width: 480px; margin: 0 auto; line-height: 1.6;">
                                When verified agro-processors or bulk buyers procure your listed crop batches, their purchase details, logistics notes, and pickup status will appear here live.
                            </p>
                        </div>
                    `;
                } else if (state.activePortal === 'crop_buyer') {
                    container.innerHTML = `
                        <div class="empty-listings-wrap" style="text-align: center; padding: 4rem 2rem; background: var(--card-bg, rgba(255,255,255,0.02)); border: 1px dashed var(--border-glow); border-radius: 16px;">
                            <i class="fa-solid fa-basket-shopping" style="font-size: 3rem; color: #10b981; margin-bottom: 1rem; opacity: 0.7;"></i>
                            <h3 style="color: var(--text-primary); margin-bottom: 0.5rem;">No Crop Procurements Yet</h3>
                            <p style="color: var(--text-muted); max-width: 480px; margin: 0 auto; line-height: 1.6;">
                                Add surplus agricultural batches to your <strong>Cart</strong> and confirm your order. Your procurement history, mandi locations, and seller contact details will appear here live.
                            </p>
                        </div>
                    `;
                } else if (state.activePortal === 'seller') {
                    container.innerHTML = `
                        <div class="empty-listings-wrap" style="text-align: center; padding: 4rem 2rem; background: var(--card-bg, rgba(255,255,255,0.02)); border: 1px dashed var(--border-glow); border-radius: 16px;">
                            <i class="fa-solid fa-clock-rotate-left" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem; opacity: 0.5;"></i>
                            <h3 style="color: var(--text-primary); margin-bottom: 0.5rem;">No Distribution History Yet</h3>
                            <p style="color: var(--text-muted); max-width: 480px; margin: 0 auto; line-height: 1.6;">
                                When an accredited NGO or shelter claims or orders your food listings, their details, verified badges, and pickup status will appear here live.
                            </p>
                        </div>
                    `;
                } else {
                    container.innerHTML = `
                        <div class="empty-listings-wrap" style="text-align: center; padding: 4rem 2rem; background: var(--card-bg, rgba(255,255,255,0.02)); border: 1px dashed var(--border-glow); border-radius: 16px;">
                            <i class="fa-solid fa-basket-shopping" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem; opacity: 0.5;"></i>
                            <h3 style="color: var(--text-primary); margin-bottom: 0.5rem;">No Rescued Food Claims Yet</h3>
                            <p style="color: var(--text-muted); max-width: 480px; margin: 0 auto; line-height: 1.6;">
                                Browse the <strong>Listings</strong> tab and claim fresh surplus meals from local restaurants. Your orders, pickup codes, and donor contact details will appear here live.
                            </p>
                        </div>
                    `;
                }
                return;
            }

            // Render Cards based on Portal
            if (isSellerPortal) {
                container.innerHTML = orders.map(o => {
                    const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    }) : 'Just now';
                    const isCompleted = o.orderStatus === 'completed';
                    const isCrop = o.isCrop || o.cropGrade || state.activePortal === 'crop_seller';
                    const gradeBadge = o.cropGrade ? `<span class="grade-badge grade-badge-b" style="margin-left: 6px; font-size: 0.68rem; padding: 2px 6px;">${o.cropGrade}</span>` : '';
                    const defaultImg = isCrop ? 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600&q=80' : 'assets/default-food.jpg';
                    const foodImg = o.imageUrl || (window.getSmartFoodImage ? window.getSmartFoodImage(o.foodName, o.category, null) : defaultImg);
                    const ngoBadge = window.renderNgoTrustBadge ? window.renderNgoTrustBadge({
                        darpanId: o.buyerDarpanId,
                        ngoRegType: o.buyerNgoRegType
                    }) : '';

                    return `
                        <div class="history-card" id="order-card-${o.orderId}">
                            <div class="history-top-row">
                                <div class="history-item-info">
                                    <img src="${foodImg}" alt="${o.foodName || 'Food'}" class="history-food-thumb" onerror="this.onerror=null; this.src='${defaultImg}';">
                                    <div>
                                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                            <h4 style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin: 0;">${o.foodName || (isCrop ? 'Crop Harvest' : 'Surplus Meal')}</h4>
                                            <span class="badge" style="background: rgba(255, 255, 255, 0.06); color: #d1d5db; border: 1px solid rgba(255, 255, 255, 0.1); font-size: 0.72rem; padding: 2px 8px; border-radius: 6px;">${o.category || (isCrop ? 'Produce' : 'Cooked')}</span>
                                            ${gradeBadge}
                                        </div>
                                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
                                            <span style="font-weight: 700; color: var(--text-primary);">${o.quantity} ${o.unit || (isCrop ? 'Quintals' : 'portions')}</span> · 
                                            <span>${o.totalPrice > 0 ? '₹' + o.totalPrice : '<strong style="color:#e5e5e5;">Free Surplus Donation</strong>'}</span> · 
                                            <span><i class="fa-regular fa-clock"></i> ${dateStr}</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <span class="history-status-badge ${isCompleted ? 'status-completed' : 'status-confirmed'}">
                                        <i class="fa-solid ${isCompleted ? 'fa-circle-check' : 'fa-hourglass-half'}"></i>
                                        ${isCompleted ? (isCrop ? 'Dispatched / Collected' : 'Picked Up / Completed') : 'Confirmed & Active'}
                                    </span>
                                </div>
                            </div>

                            <!-- Buyer Counterparty Details Box -->
                            <div class="history-party-box">
                                <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 240px;">
                                    <img src="${o.buyerAvatar || 'assets/default-avatar.jpg'}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 1.5px solid rgba(255, 255, 255, 0.15);">
                                    <div>
                                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                            <strong style="font-size: 0.95rem; color: var(--text-primary);">${o.buyerName || (isCrop ? 'Verified Agro-Processing MSME / Procurement Partner' : 'Accredited NGO Partner')}</strong>
                                            ${ngoBadge}
                                        </div>
                                        <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 3px;">
                                            ${o.buyerContactPerson ? `<span><i class="fa-solid fa-user-tie" style="color:#9ca3af;"></i> ${o.buyerContactPerson}</span> · ` : ''}
                                            ${o.buyerPhone ? `<a href="tel:${o.buyerPhone}" style="color:#d1d5db; text-decoration: none;"><i class="fa-solid fa-phone"></i> ${o.buyerPhone}</a>` : ''}
                                        </div>
                                        ${o.buyerAddress ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;"><i class="fa-solid fa-location-dot" style="color:#9ca3af;"></i> ${o.buyerAddress}</div>` : ''}
                                    </div>
                                </div>

                                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                    <div class="pickup-code-pill" title="Procurement / Order PIN Code">
                                        <i class="fa-solid fa-ticket"></i> PIN: <strong>NN-${String(o.orderId).padStart(4, '0')}</strong>
                                    </div>
                                    ${!isCompleted ? `
                                        <button class="history-action-btn btn-update-order-status" data-order-id="${o.orderId}" data-status="completed" style="background: rgba(255, 255, 255, 0.1); color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 10px; padding: 8px 16px; font-weight: 600; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                                            <i class="fa-solid fa-handshake"></i> ${isCrop ? 'Mark as Dispatched' : 'Mark as Handed Over'}
                                        </button>
                                    ` : `
                                        <span style="color: #9ca3af; font-size: 0.85rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
                                            <i class="fa-solid fa-check-double"></i> ${isCrop ? 'Dispatch Complete' : 'Handover Complete'}
                                        </span>
                                    `}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                // Buyer Portal
                container.innerHTML = orders.map(o => {
                    const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    }) : 'Just now';
                    const isCompleted = o.orderStatus === 'completed';
                    const isCrop = o.isCrop || o.cropGrade || state.activePortal === 'crop_buyer';
                    const defaultImg = isCrop ? 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600&q=80' : 'assets/default-food.jpg';
                    const foodImg = o.imageUrl || (window.getSmartFoodImage ? window.getSmartFoodImage(o.foodName, o.category, null) : defaultImg);

                    return `
                        <div class="history-card" id="order-card-${o.orderId}">
                            <div class="history-top-row">
                                <div class="history-item-info">
                                    <img src="${foodImg}" alt="${o.foodName || 'Food'}" class="history-food-thumb" onerror="this.onerror=null; this.src='${defaultImg}';">
                                    <div>
                                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                            <h4 style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin: 0;">${o.foodName || (isCrop ? 'Procured Crop Produce' : 'Rescued Food')}</h4>
                                            <span class="badge" style="background: rgba(255, 255, 255, 0.06); color: #d1d5db; border: 1px solid rgba(255, 255, 255, 0.1); font-size: 0.72rem; padding: 2px 8px; border-radius: 6px;">${o.category || (isCrop ? 'Produce' : 'Cooked')}</span>
                                        </div>
                                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
                                            <span style="font-weight: 700; color: var(--text-primary);">${o.quantity} ${o.unit || (isCrop ? 'Quintals' : 'portions')}</span> · 
                                            <span>${o.totalPrice > 0 ? '₹' + o.totalPrice : '<strong style="color:#e5e5e5;">Free Surplus Donation</strong>'}</span> · 
                                            <span><i class="fa-regular fa-clock"></i> ${dateStr}</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <span class="history-status-badge ${isCompleted ? 'status-completed' : 'status-confirmed'}">
                                        <i class="fa-solid ${isCompleted ? 'fa-circle-check' : 'fa-box'}"></i>
                                        ${isCompleted ? (isCrop ? 'Delivered / Collected' : 'Picked Up') : (isCrop ? 'Order Placed · Awaiting Logistics' : 'Ready for Pickup')}
                                    </span>
                                </div>
                            </div>

                            <!-- Donating / Producing Seller Details Box -->
                            <div class="history-party-box">
                                <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 240px;">
                                    <img src="${o.sellerAvatar || 'assets/default-avatar.jpg'}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 1.5px solid rgba(255, 255, 255, 0.15);">
                                    <div>
                                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                            <strong style="font-size: 0.95rem; color: var(--text-primary);">${o.sellerName || (isCrop ? 'Farmer Producer / Mandi Collective' : 'Donor Restaurant / Kitchen')}</strong>
                                            ${o.sellerFssaiCode ? `<span class="fssai-trust-badge" title="FSSAI Verified Food Establishment"><i class="fa-solid fa-shield-halved"></i> FSSAI Certified</span>` : ''}
                                        </div>
                                        <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 3px;">
                                            ${o.sellerContactPerson ? `<span><i class="fa-solid fa-user-tie" style="color:#9ca3af;"></i> ${o.sellerContactPerson}</span> · ` : ''}
                                            ${o.sellerPhone ? `<a href="tel:${o.sellerPhone}" style="color:#d1d5db; text-decoration: none;"><i class="fa-solid fa-phone"></i> ${o.sellerPhone}</a>` : ''}
                                        </div>
                                        ${o.sellerAddress ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;"><i class="fa-solid fa-location-dot" style="color:#9ca3af;"></i> ${isCrop ? 'Mandi / Farm: ' : 'Pickup: '}${o.sellerAddress}</div>` : ''}
                                        ${o.sellerPickupWindow ? `<div style="font-size: 0.8rem; color: #9ca3af; margin-top: 2px;"><i class="fa-regular fa-clock"></i> Window: ${o.sellerPickupWindow}</div>` : ''}
                                    </div>
                                </div>

                                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                    <div class="pickup-code-pill" title="Show this code upon collection or truck arrival">
                                        <i class="fa-solid fa-ticket"></i> PIN: <strong>NN-${String(o.orderId).padStart(4, '0')}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            // Attach action handlers for marking orders picked up
            container.querySelectorAll('.btn-update-order-status').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const orderId = btn.dataset.orderId;
                    const newStatus = btn.dataset.status;
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';

                    // If local synthetic order ID, update in localStorage
                    if (String(orderId).startsWith('ORD-')) {
                        let localOrders = JSON.parse(localStorage.getItem('nn_local_orders') || '[]');
                        localOrders = localOrders.map(o => String(o.orderId) === String(orderId) ? { ...o, orderStatus: newStatus } : o);
                        localStorage.setItem('nn_local_orders', JSON.stringify(localOrders));
                        showToast("Handover marked as completed! 🤝", "success");
                        loadPortalHistory();
                        return;
                    }

                    try {
                        const patchRes = await fetch(`${API_BASE}/orders/${orderId}/status`, {
                            method: 'PATCH',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ status: newStatus })
                        });
                        if (patchRes.ok) {
                            showToast("Handover marked as completed! 🤝", "success");
                            loadPortalHistory();
                        } else {
                            const err = await patchRes.json().catch(() => ({}));
                            showToast(err.error || "Failed to update status", "error");
                            btn.disabled = false;
                        }
                    } catch (e) {
                        showToast("Network error updating order status", "error");
                        btn.disabled = false;
                    }
                });
            });

        } catch (err) {
            console.error("Order history fetch error:", err);
            if (container && !silent) {
                container.innerHTML = `
                    <div style="text-align:center; padding:3rem 2rem; color:var(--text-muted);">
                        <i class="fa-solid fa-clock-rotate-left" style="font-size: 2.5rem; color: var(--accent-primary); margin-bottom: 1rem; opacity: 0.7;"></i>
                        <h4 style="color: var(--text-primary); margin-bottom: 0.5rem;">Live Distribution & Claims</h4>
                        <p style="max-width: 450px; margin: 0 auto 1.5rem; line-height: 1.6; font-size: 0.9rem;">
                            Orders and claims are synchronized in real time with the database.
                        </p>
                        <button onclick="if(typeof loadPortalHistory === 'function') loadPortalHistory();" class="btn btn-outline" style="padding: 8px 18px; font-size: 0.85rem; border-radius: 10px; border-color: var(--accent-primary); color: var(--accent-primary); cursor: pointer;">
                            <i class="fa-solid fa-arrows-rotate"></i> Retry Connection
                        </button>
                    </div>
                `;
            }
        }
    }
    window.loadPortalHistory = loadPortalHistory;

    // ---- GLOBAL DELETE COMMENT ----
    window.deleteComment = function (commentId, btnEl) {
        const bubble = btnEl.closest('.comment-bubble');

        // Animate out
        if (bubble) {
            bubble.style.transition = 'all 0.3s ease';
            bubble.style.opacity = '0';
            bubble.style.transform = 'translateX(30px) scale(0.95)';
        }

        setTimeout(() => {
            // Remove from state
            state.communityComments = state.communityComments.filter(c => String(c.id) !== String(commentId));
            // Persist
            localStorage.setItem('nn_comments', JSON.stringify(state.communityComments));
            // Re-render all comment surfaces
            renderCommunityWall();
            renderPortalCommentList();
            renderReviewsSlider();
            showToast('Comment deleted.', 'info');
        }, 280);
    };


    const commentForm = document.getElementById('comment-form');
    const commentText = document.getElementById('comment-text');

    if (commentForm) {
        commentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = commentText.value.trim();
            if (!text) return;

            const user = JSON.parse(sessionStorage.getItem('nourishUser') || '{}');
            const name = user.name || (state.activePortal === 'seller' ? 'Elite Vendor' : 'Community Partner');
            const org = user.orgName || (state.activePortal === 'seller' ? 'Gourmet Provider' : 'Food Recipient');

            // Add to state
            state.communityComments.push({
                id: Date.now().toString(),
                name: name,
                org: org,
                role: (state.activePortal === 'seller' || user.accountType === 'restaurant' || user.accountType === 'vendor') ? 'seller' : 'buyer',
                text: text,
                stars: 5,
                img: (user.avatarUrl && !user.avatarUrl.includes('pravatar') && !user.avatarUrl.includes('default-avatar')) ? user.avatarUrl : null
            });
            localStorage.setItem('nn_comments', JSON.stringify(state.communityComments));

            // Re-render both parts
            renderCommunityWall();
            renderReviewsSlider();

            // Jump to the newest slide (last one added) in Voices of Impact
            const slides = document.querySelectorAll('.review-slide');
            const dots = document.querySelectorAll('.dot');
            if (slides.length > 0) {
                slides.forEach(s => s.classList.remove('active'));
                dots.forEach(d => d.classList.remove('active'));
                slides[slides.length - 1].classList.add('active');
                if (dots[dots.length - 1]) dots[dots.length - 1].classList.add('active');
            }

            // Smooth scroll to Voices of Impact
            const voicesSection = document.getElementById('reviews');
            if (voicesSection) {
                voicesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            commentText.value = '';
            showToast("Your voice is now live in 'Voices of Impact'! 🌱", "success");
        });
    }

    // Initial render for the wall if it exists
    renderCommunityWall();



    document.addEventListener('click', async (e) => {
        // Redundant cart overlay close (the button is handled at the top of the file)
        if (e.target.classList.contains('cart-drawer-overlay')) {
            cartDrawer.classList.remove('active');
        }

        // Delegated history modal open (catches dock button, clock icon, or history label)
        const histBtn = e.target.closest('#history-toggle-dock, .portal-history-dock, [data-action="open-history"]');
        if (histBtn) {
            e.preventDefault();
            e.stopPropagation();
            console.log("Delegated click caught for History dock button");
            if (typeof openHistoryModal === 'function') openHistoryModal();
            else if (typeof window.openHistoryModal === 'function') window.openHistoryModal();
            return;
        }

        // Delegated history modal close
        const closeHistBtn = e.target.closest('#closeHistoryModal, .close-history-modal-btn');
        if (closeHistBtn) {
            e.preventDefault();
            if (typeof closeHistoryModal === 'function') closeHistoryModal();
            else if (typeof window.closeHistoryModal === 'function') window.closeHistoryModal();
            return;
        }
    });

    // --- BOOTSTRAP APP ---
    initSwitcher();
    renderReviewsSlider();
    renderCommunityWall();
    updateCartBadge();
    wireDockButtons();
    checkSession();


    // Real-time silent polling every 5 seconds
    setInterval(() => refreshState(true), 5000);

    // --- IMPACT MAP ENGINE ---
    let impactMap = null;
    let impactLayer = null;



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
    window.openSettings = function () {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.style.display = 'flex';
            // Role-specific field visibility
            const fssaiWrap = document.getElementById('fssaiFieldWrap');
            const darpanWrap = document.getElementById('darpanFieldWrap');
            const subtitle = modal.querySelector('p');
            const user = JSON.parse(sessionStorage.getItem('nourishUser') || '{}');
            const role = (user.accountType || user.type || user.role || (state.activePortal === 'seller' ? 'vendor' : 'ngo')).toLowerCase();
            const isCrop = role.includes('crop') || state.activePortal.includes('crop');
            const isSeller = !isCrop && (role.includes('restaurant') || role.includes('vendor') || role.includes('seller') || state.activePortal === 'seller');
            const isFoodBuyer = !isCrop && (role.includes('ngo') || role.includes('shelter') || state.activePortal === 'buyer');

            if (fssaiWrap) fssaiWrap.style.display = isSeller ? 'block' : 'none';
            if (darpanWrap) darpanWrap.style.display = isFoodBuyer ? 'block' : 'none';
            if (subtitle) {
                if (isCrop) {
                    subtitle.textContent = role.includes('seller')
                        ? "Manage your farm / mandi producer details & contact"
                        : "Manage your agro-processor procurement details & contact";
                } else {
                    subtitle.textContent = isSeller
                        ? "Manage your restaurant's profile, compliance & pickup details"
                        : "Manage your NGO's profile, compliance & pickup details";
                }
            }
            document.dispatchEvent(new CustomEvent('load-profile-data'));
        }
    };

    function attachSettingsListeners() {
        const settingsToggle = document.getElementById('settings-toggle-dock');
        const settingsModal = document.getElementById('settingsModal');
        const closeSettingsModal = document.getElementById('closeSettingsModal');
        const settingsForm = document.getElementById('settingsForm');
        const orgNameInput = document.getElementById('orgNameInput');
        const emailInput = document.getElementById('emailInput');
        const accountTypeInput = document.getElementById('accountTypeInput');
        const bioInput = document.getElementById('bioInput');
        const locationInput = document.getElementById('locationInput');
        const contactPersonInput = document.getElementById('contactPersonInput');
        const publicPhoneInput = document.getElementById('publicPhoneInput');
        const websiteInput = document.getElementById('websiteInput');
        const fssaiInput = document.getElementById('fssaiInput');
        const fssaiFieldWrap = document.getElementById('fssaiFieldWrap');
        const fssaiFeedback = document.getElementById('fssaiFeedback');
        const fssaiStateTag = document.getElementById('fssaiStateTag');
        const darpanInput = document.getElementById('darpanInput');
        const darpanFieldWrap = document.getElementById('darpanFieldWrap');
        const darpanFeedback = document.getElementById('darpanFeedback');
        const darpanStateTag = document.getElementById('darpanStateTag');
        const pickupWindowInput = document.getElementById('pickupWindowInput');
        const pickupInstructionsInput = document.getElementById('pickupInstructionsInput');
        const avatarInput = document.getElementById('avatarInput');
        const avatarPreview = document.getElementById('avatarPreview');

        if (!settingsModal) return;

        function updateFssaiFeedback() {
            if (!fssaiInput) return;
            const clean = fssaiInput.value.replace(/\D/g, '').slice(0, 14);
            fssaiInput.value = clean;

            if (!fssaiFeedback) return;

            if (!clean) {
                fssaiFeedback.style.display = 'none';
                fssaiFeedback.className = '';
                fssaiFeedback.innerHTML = '';
                if (fssaiStateTag) fssaiStateTag.style.display = 'none';
                return;
            }

            const res = window.validateFSSAI(clean);
            fssaiFeedback.style.display = 'block';

            if (res.valid) {
                fssaiFeedback.className = 'fssai-feedback-valid';
                fssaiFeedback.innerHTML = `<i class="fa-solid fa-circle-check"></i> <strong>Valid FSSAI</strong>: ${res.stateName} · ${res.typeStr} (${res.year})`;
                if (fssaiStateTag) {
                    fssaiStateTag.style.display = 'inline-block';
                    fssaiStateTag.textContent = `${res.stateName} • ${res.year}`;
                }
            } else if (clean.length < 14) {
                fssaiFeedback.className = 'fssai-feedback-warning';
                fssaiFeedback.innerHTML = `<i class="fa-solid fa-circle-info"></i> 14 digits required (<strong>${clean.length}/14</strong> entered). Format: [1-2][State 01-37][Year][Serial]`;
                if (fssaiStateTag) fssaiStateTag.style.display = 'none';
            } else {
                fssaiFeedback.className = 'fssai-feedback-invalid';
                fssaiFeedback.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${res.message}`;
                if (fssaiStateTag) fssaiStateTag.style.display = 'none';
            }
        }

        if (fssaiInput) {
            fssaiInput.addEventListener('input', updateFssaiFeedback);
        }

        const darpanTypeSelect = document.getElementById('darpanTypeSelect');

        function updateDarpanFeedback() {
            if (!darpanInput) return;
            const clean = darpanInput.value.trim().toUpperCase();
            darpanInput.value = clean;

            if (!darpanFeedback) return;

            if (!clean) {
                darpanFeedback.style.display = 'none';
                darpanFeedback.className = '';
                darpanFeedback.innerHTML = '';
                if (darpanStateTag) darpanStateTag.style.display = 'none';
                return;
            }

            const currentType = darpanTypeSelect ? darpanTypeSelect.value : 'darpan';
            const res = window.validateNGOCompliance(currentType, clean);
            darpanFeedback.style.display = 'block';

            if (res.valid) {
                darpanFeedback.className = 'darpan-feedback-valid';
                darpanFeedback.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${res.message}`;
                if (darpanStateTag) {
                    darpanStateTag.style.display = 'inline-block';
                    darpanStateTag.textContent = res.stateName ? `${res.stateName} • ${res.year || 'Verified'}` : 'Verified';
                }
            } else {
                darpanFeedback.className = 'darpan-feedback-invalid';
                darpanFeedback.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${res.message}`;
                if (darpanStateTag) darpanStateTag.style.display = 'none';
            }
        }

        if (darpanInput) {
            darpanInput.addEventListener('input', updateDarpanFeedback);
        }

        if (darpanTypeSelect) {
            darpanTypeSelect.addEventListener('change', () => {
                if (darpanInput) {
                    darpanInput.placeholder = NGO_PLACEHOLDERS[darpanTypeSelect.value] || 'Registration Code';
                }
                updateDarpanFeedback();
            });
        }

        async function loadProfile() {
            try {
                const user = JSON.parse(sessionStorage.getItem('nourishUser') || '{}');
                const profile = user;

                // 1. Account & Identity Fields
                if (orgNameInput) orgNameInput.value = profile.organizationName || profile.name || '';
                if (emailInput) emailInput.value = profile.email || '';
                if (accountTypeInput) {
                    const role = profile.accountType || profile.type || profile.role || (state.activePortal === 'seller' ? 'Vendor' : 'NGO');
                    accountTypeInput.value = role.toUpperCase();
                }

                // Show FSSAI field for food vendors, DARPAN for NGOs (Crop roles hide both)
                const roleLower = (profile.accountType || profile.role || profile.type || state.activePortal || '').toLowerCase();
                const isCrop = roleLower.includes('crop');
                const isSeller = !isCrop && (roleLower.includes('restaurant') || roleLower.includes('vendor') || roleLower.includes('seller') || state.activePortal === 'seller');
                const isFoodBuyer = !isCrop && (roleLower.includes('ngo') || roleLower.includes('shelter') || state.activePortal === 'buyer');

                if (fssaiFieldWrap) fssaiFieldWrap.style.display = isSeller ? 'block' : 'none';
                if (darpanFieldWrap) darpanFieldWrap.style.display = isFoodBuyer ? 'block' : 'none';

                // 2. Contact & Logistics Fields (Pre-fill from cached session)
                if (bioInput) bioInput.value = profile.bio || '';
                if (locationInput) locationInput.value = profile.address || '';
                if (contactPersonInput) contactPersonInput.value = profile.contactPerson || '';
                if (publicPhoneInput) publicPhoneInput.value = profile.publicPhone || profile.phone || '';
                if (websiteInput) websiteInput.value = profile.website || '';
                if (fssaiInput) {
                    fssaiInput.value = profile.fssaiCode || profile.fssaicode || '';
                    updateFssaiFeedback();
                }
                if (darpanTypeSelect) {
                    darpanTypeSelect.value = profile.ngoRegType || profile.ngoregtype || 'darpan';
                    if (darpanInput) darpanInput.placeholder = NGO_PLACEHOLDERS[darpanTypeSelect.value] || 'Registration Code';
                }
                if (darpanInput) {
                    darpanInput.value = profile.darpanId || profile.darpanid || '';
                    updateDarpanFeedback();
                }
                if (pickupWindowInput) pickupWindowInput.value = profile.pickupWindow || '';
                if (pickupInstructionsInput) pickupInstructionsInput.value = profile.pickupInstructions || '';

                if (profile.avatarUrl && avatarPreview) {
                    avatarPreview.src = profile.avatarUrl;
                }

                // 3. Fetch latest live data from database
                const token = sessionStorage.getItem('nourishToken') || localStorage.getItem('nourishToken');
                if (token) {
                    const res = await fetch(`${API_BASE}/user/me`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const liveProfile = await res.json();
                        if (liveProfile) {
                            if (orgNameInput && liveProfile.organizationName) orgNameInput.value = liveProfile.organizationName;
                            if (emailInput && liveProfile.email) emailInput.value = liveProfile.email;
                            if (accountTypeInput && (liveProfile.accountType || liveProfile.type)) {
                                accountTypeInput.value = (liveProfile.accountType || liveProfile.type).toUpperCase();
                            }
                            if (bioInput) bioInput.value = liveProfile.bio || '';
                            if (locationInput) locationInput.value = liveProfile.address || '';
                            if (contactPersonInput) contactPersonInput.value = liveProfile.contactPerson || '';
                            if (publicPhoneInput) publicPhoneInput.value = liveProfile.publicPhone || liveProfile.phone || '';
                            if (websiteInput) websiteInput.value = liveProfile.website || '';
                            if (fssaiInput) {
                                fssaiInput.value = liveProfile.fssaiCode || liveProfile.fssaicode || '';
                                updateFssaiFeedback();
                            }
                            if (darpanTypeSelect && (liveProfile.ngoRegType || liveProfile.ngoregtype)) {
                                darpanTypeSelect.value = liveProfile.ngoRegType || liveProfile.ngoregtype;
                                if (darpanInput) darpanInput.placeholder = NGO_PLACEHOLDERS[darpanTypeSelect.value] || 'Registration Code';
                            }
                            if (darpanInput) {
                                darpanInput.value = liveProfile.darpanId || liveProfile.darpanid || '';
                                updateDarpanFeedback();
                            }
                            if (pickupWindowInput) pickupWindowInput.value = liveProfile.pickupWindow || '';
                            if (pickupInstructionsInput) pickupInstructionsInput.value = liveProfile.pickupInstructions || '';

                            if (liveProfile.avatarUrl && avatarPreview) {
                                avatarPreview.src = liveProfile.avatarUrl;
                            }

                            // Cache latest liveProfile in storage so it persists
                            const merged = { 
                                ...user, 
                                ...liveProfile,
                                fssaiCode: liveProfile.fssaiCode || liveProfile.fssaicode || user.fssaiCode || user.fssaicode || '',
                                darpanId: liveProfile.darpanId || liveProfile.darpanid || user.darpanId || user.darpanid || '',
                                ngoRegType: liveProfile.ngoRegType || liveProfile.ngoregtype || user.ngoRegType || user.ngoregtype || ''
                            };
                            sessionStorage.setItem('nourishUser', JSON.stringify(merged));
                            localStorage.setItem('nourishUser', JSON.stringify(merged));
                            renderPortal();
                        }
                    }
                }
            } catch (e) { console.error("Error loading profile:", e); }
        }

        const settingsToggleDock = document.getElementById('settings-toggle-dock');
        const settingsToggleNav = document.getElementById('settings-toggle-nav');

        if (settingsToggleDock) {
            settingsToggleDock.onclick = (e) => {
                e.preventDefault();
                loadProfile();
                settingsModal.style.display = 'flex';
            };
        }

        if (settingsToggleNav) {
            settingsToggleNav.onclick = (e) => {
                e.preventDefault();
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
                        const token = sessionStorage.getItem('nourishToken') || localStorage.getItem('nourishToken');
                        const uploadRes = await fetch(`${API_BASE}/upload`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` },
                            body: formData
                        });
                        if (uploadRes.ok) {
                            const data = await uploadRes.json();
                            avatarPreview.dataset.uploadedUrl = data.imageUrl;
                        }
                    } catch (err) {
                        showToast('Avatar upload failed.', 'error');
                    }
                }
            });
        }

        if (settingsForm) {
            settingsForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const fssaiCode = fssaiInput ? fssaiInput.value.trim() : '';
                if (fssaiCode) {
                    const validation = window.validateFSSAI(fssaiCode);
                    if (!validation.valid) {
                        showToast(`Invalid FSSAI License: ${validation.message}`, "error");
                        if (fssaiInput) {
                            fssaiInput.focus();
                            fssaiInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                        return;
                    }
                }

                const darpanCode = darpanInput ? darpanInput.value.trim().toUpperCase() : '';
                const ngoType = darpanTypeSelect ? darpanTypeSelect.value : 'darpan';
                if (darpanCode) {
                    const validation = window.validateNGOCompliance(ngoType, darpanCode);
                    if (!validation.valid) {
                        showToast(`Invalid Registration Credential: ${validation.message}`, "error");
                        if (darpanInput) {
                            darpanInput.focus();
                            darpanInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                        return;
                    }
                }

                const saveBtn = document.getElementById('saveSettingsBtn');
                const originalText = saveBtn.innerText;
                saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';
                saveBtn.disabled = true;

                const orgName = orgNameInput ? orgNameInput.value.trim() : '';
                const bio = bioInput ? bioInput.value.trim() : '';
                const address = locationInput ? locationInput.value.trim() : '';
                const contactPerson = contactPersonInput ? contactPersonInput.value.trim() : '';
                const publicPhone = publicPhoneInput ? publicPhoneInput.value.trim() : '';
                const website = websiteInput ? websiteInput.value.trim() : '';
                const pickupWindow = pickupWindowInput ? pickupWindowInput.value.trim() : '';
                const pickupInstructions = pickupInstructionsInput ? pickupInstructionsInput.value.trim() : '';

                let avatarUrl = avatarPreview.dataset.uploadedUrl;
                if (!avatarUrl && avatarPreview.src && !avatarPreview.src.includes('default-avatar.jpg')) {
                    avatarUrl = avatarPreview.src;
                }

                try {
                    const token = sessionStorage.getItem('nourishToken') || localStorage.getItem('nourishToken');
                    const res = await fetch(`${API_BASE}/user/me`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            organizationName: orgName,
                            name: orgName,
                            bio, address, avatarUrl, contactPerson,
                            publicPhone, website, fssaiCode, darpanId: darpanCode,
                            ngoRegType: ngoType,
                            pickupWindow, pickupInstructions
                        })
                    });

                    if (res.ok) {
                        const data = await res.json();
                        const prevUser = JSON.parse(sessionStorage.getItem('nourishUser') || '{}');
                        const updatedUser = {
                            ...prevUser,
                            ...(data.user || {}),
                            organizationName: orgName || prevUser.organizationName || prevUser.name,
                            name: orgName || prevUser.name,
                            bio,
                            address,
                            contactPerson,
                            publicPhone,
                            phone: publicPhone || prevUser.phone,
                            website,
                            fssaiCode: fssaiCode || (data.user && (data.user.fssaiCode || data.user.fssaicode)) || prevUser.fssaiCode || prevUser.fssaicode || '',
                            darpanId: darpanCode || (data.user && (data.user.darpanId || data.user.darpanid)) || prevUser.darpanId || prevUser.darpanid || '',
                            ngoRegType: ngoType || (data.user && (data.user.ngoRegType || data.user.ngoregtype)) || prevUser.ngoRegType || prevUser.ngoregtype || '',
                            pickupWindow,
                            pickupInstructions,
                            avatarUrl: avatarUrl || prevUser.avatarUrl
                        };
                        sessionStorage.setItem('nourishUser', JSON.stringify(updatedUser));
                        localStorage.setItem('nourishUser', JSON.stringify(updatedUser));

                        showToast("Profile updated successfully! ✨", "success");
                        settingsModal.style.display = 'none';

                        // Update navbar avatar immediately
                        const navImg = document.getElementById('nav-avatar-img');
                        if (navImg && avatarUrl) navImg.src = avatarUrl;

                        // Re-render portal to immediately show FSSAI or DARPAN badge!
                        renderPortal();
                    } else {
                        showToast("Failed to update profile.", "error");
                    }
                } catch (err) {
                    console.error("Save settings error:", err);
                    showToast("Network error. Please try again.", "error");
                } finally {
                    saveBtn.innerText = originalText;
                    saveBtn.disabled = false;
                }
            });
        }
        // Listen for the custom event to load data
        document.addEventListener('load-profile-data', loadProfile);

        // Backdrop click to dismiss settings modal
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target === settingsModal) {
                    settingsModal.style.display = 'none';
                }
            });
        }

        // Global ESC key listener for modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (settingsModal && settingsModal.style.display !== 'none') {
                    settingsModal.style.display = 'none';
                }
                const authModal = document.getElementById('authModal');
                if (authModal && authModal.classList.contains('active')) {
                    authModal.classList.remove('active');
                }
                const cartDrawer = document.getElementById('cart-drawer');
                if (cartDrawer && cartDrawer.classList.contains('active')) {
                    cartDrawer.classList.remove('active');
                }
            }
        });

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

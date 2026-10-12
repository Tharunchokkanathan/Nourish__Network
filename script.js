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

// ---- GLOBAL PHYSICAL HANDOVER VERIFICATION & QR PASS HELPERS ----
window.closeHandoverVerifyModal = function () {
    const modal = document.getElementById('handoverVerifyModal');
    if (modal) modal.style.display = 'none';
};

window.closeHandoverQrModal = function () {
    const modal = document.getElementById('handoverQrModal');
    if (modal) modal.style.display = 'none';
};

window.stopCameraScanner = function () {
    const modal = document.getElementById('qrCameraScannerModal');
    if (modal) modal.style.display = 'none';
    if (window._stopCameraScannerInternal) window._stopCameraScannerInternal();
};

window.submitHandoverVerification = function () {
    if (typeof window._submitHandoverVerificationInternal === 'function') {
        return window._submitHandoverVerificationInternal();
    }
    const modal = document.getElementById('handoverVerifyModal');
    if (modal && typeof window.initHandoverVerificationModalEvents === 'function') {
        window.initHandoverVerificationModalEvents();
        if (typeof window._submitHandoverVerificationInternal === 'function') {
            return window._submitHandoverVerificationInternal();
        }
    }
};

window.detectCurrentGpsLocation = function (targetInputId) {
    if (typeof window._detectCurrentGpsLocationInternal === 'function') {
        return window._detectCurrentGpsLocationInternal(targetInputId);
    }
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
        adminInspectedUser: (() => {
            try { return JSON.parse(sessionStorage.getItem('nn_admin_inspected_user')); } catch (e) { return null; }
        })(),
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

    // Expose to global scope for window.deleteComment (defined outside DOMContentLoaded)
    window.__appState = state;



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

        const user = JSON.parse(sessionStorage.getItem('nourishUser') || localStorage.getItem('nourishUser') || '{}');
        const phoneInput = document.getElementById('cart-buyer-phone');
        const addrInput = document.getElementById('cart-buyer-address');
        const buyerPhone = (phoneInput?.value || user.publicPhone || user.phone || '').trim();
        const buyerAddress = (addrInput?.value || user.address || '').trim();

        const missingPhone = !buyerPhone || buyerPhone.replace(/[^0-9]/g, '').length < 6;
        const missingAddress = !buyerAddress || buyerAddress.length < 3;

        if (missingPhone && missingAddress) {
            showToast("⚠️ Please enter your mobile number and location before placing an order!", "error");
            if (phoneInput) { phoneInput.focus(); phoneInput.style.borderColor = '#ef4444'; }
            if (addrInput) { addrInput.style.borderColor = '#ef4444'; }
            return;
        }
        if (missingPhone) {
            showToast("⚠️ Please enter your mobile number before placing an order!", "error");
            if (phoneInput) { phoneInput.focus(); phoneInput.style.borderColor = '#ef4444'; }
            return;
        }
        if (missingAddress) {
            showToast("⚠️ Please enter your delivery/organization location before placing an order!", "error");
            if (addrInput) { addrInput.focus(); addrInput.style.borderColor = '#ef4444'; }
            return;
        }

        if (phoneInput) phoneInput.style.borderColor = '';
        if (addrInput) addrInput.style.borderColor = '';

        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
            btn.disabled = true;
        }

        try {
            const notes = document.getElementById('claim-notes')?.value || '';

            const orderItems = state.cart.map(c => ({
                listingId: c.item.id,
                quantity: parseInt(c.qty, 10) || 1,
                price: parseFloat(c.item.price) || 0
            }));

            // Auto-sync buyer profile in background if phone or address were newly entered
            if (token && (!user.phone || !user.address || user.phone !== buyerPhone || user.address !== buyerAddress)) {
                fetch(`${API_BASE}/user/me`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ phone: buyerPhone, publicPhone: buyerPhone, address: buyerAddress })
                }).then(r => r.json()).then(d => {
                    if (d && d.user) {
                        sessionStorage.setItem('nourishUser', JSON.stringify(d.user));
                        localStorage.setItem('nourishUser', JSON.stringify(d.user));
                    }
                }).catch(() => {});
            }

            // Step 1: Call backend checkout API with strict database validation
            const res = await fetch(`${API_BASE}/checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ items: orderItems, notes, phone: buyerPhone, address: buyerAddress })
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
                const targetVendorId = c.item.vendorId || c.item.vendorid || 888;

                // Dynamically resolve the true seller's published location and contact details
                let resolvedSellerAddress = c.item.vendorAddress || c.item.address || '';
                let resolvedSellerPhone = c.item.vendorPhone || '';
                let resolvedSellerName = c.item.vendorName || c.item.vendorname || '';
                let resolvedContactPerson = c.item.vendorContactPerson || c.item.contactPerson || '';
                let resolvedFssai = c.item.fssaiCode || c.item.fssaicode || '';
                let resolvedPickupWindow = c.item.pickupWindow || '';
                let resolvedAvatar = c.item.vendorAvatar || c.item.avatarUrl || 'assets/default-avatar.jpg';

                // Look up in state.listings
                if (!resolvedSellerAddress && state.listings) {
                    const matchedL = state.listings.find(l => Number(l.id) === Number(c.item.id) || Number(l.vendorId) === Number(targetVendorId));
                    if (matchedL) {
                        resolvedSellerAddress = matchedL.vendorAddress || matchedL.address || '';
                        if (!resolvedSellerPhone) resolvedSellerPhone = matchedL.vendorPhone || '';
                        if (!resolvedSellerName) resolvedSellerName = matchedL.vendorName || '';
                        if (!resolvedContactPerson) resolvedContactPerson = matchedL.vendorContactPerson || '';
                        if (!resolvedFssai) resolvedFssai = matchedL.fssaiCode || '';
                        if (!resolvedPickupWindow) resolvedPickupWindow = matchedL.pickupWindow || '';
                        if (!resolvedAvatar || resolvedAvatar.includes('default-avatar')) resolvedAvatar = matchedL.vendorAvatar || resolvedAvatar;
                    }
                }

                // Look up in adminCache.users
                if ((!resolvedSellerAddress || !resolvedSellerPhone) && adminCache && adminCache.users) {
                    const matchedVendor = adminCache.users.find(u => Number(u.id) === Number(targetVendorId));
                    if (matchedVendor) {
                        if (!resolvedSellerAddress) resolvedSellerAddress = matchedVendor.address || '';
                        if (!resolvedSellerPhone) resolvedSellerPhone = matchedVendor.publicPhone || matchedVendor.phone || '';
                        if (!resolvedSellerName) resolvedSellerName = matchedVendor.organizationName || matchedVendor.name || '';
                        if (!resolvedContactPerson) resolvedContactPerson = matchedVendor.contactPerson || '';
                        if (!resolvedFssai) resolvedFssai = matchedVendor.fssaiCode || '';
                        if (!resolvedPickupWindow) resolvedPickupWindow = matchedVendor.pickupWindow || '';
                        if (matchedVendor.avatarUrl) resolvedAvatar = matchedVendor.avatarUrl;
                    }
                }

                // Fallback if current logged-in user is the donor
                if (!resolvedSellerAddress && user && Number(user.id) === Number(targetVendorId)) {
                    resolvedSellerAddress = user.address || '';
                    if (!resolvedSellerPhone) resolvedSellerPhone = user.publicPhone || user.phone || '';
                    if (!resolvedSellerName) resolvedSellerName = user.organizationName || user.name || '';
                }

                if (!resolvedSellerAddress) {
                    resolvedSellerAddress = 'Location provided by donor kitchen';
                }

                return {
                    orderId: 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
                    listingId: c.item.id,
                    foodName: c.item.name || 'Surplus Food Meal',
                    category: c.item.category || 'Cooked',
                    imageUrl: c.item.img || c.item.imageUrl || '',
                    unit: c.item.unit || 'portions',
                    unitPrice: unitPrice,
                    quantity: qty,
                    totalPrice: unitPrice * qty,
                    orderStatus: 'confirmed',
                    notes: notes,
                    createdAt: new Date().toISOString(),
                    handoverOtp: Math.floor(1000 + Math.random() * 9000).toString(),
                    pickupTime: c.item.pickupTime || c.item.pickup || 'Ready for Pickup',

                    // Seller information (viewed in Buyer history)
                    vendorId: targetVendorId,
                    sellerId: targetVendorId,
                    sellerName: resolvedSellerName || 'Verified Donor Kitchen',
                    sellerType: 'restaurant',
                    sellerEmail: c.item.vendorEmail || 'donor@nourishnetwork.org',
                    sellerPhone: resolvedSellerPhone || '+91 98400 12345',
                    sellerContactPerson: resolvedContactPerson || 'Kitchen Coordinator',
                    sellerFssaiCode: resolvedFssai || '',
                    sellerAddress: resolvedSellerAddress,
                    sellerPickupWindow: resolvedPickupWindow || '9:00 PM - 11:00 PM',
                    sellerAvatar: resolvedAvatar,

                    // Buyer information (viewed in Seller history)
                    buyerId: user.id || 999,
                    buyerName: user.organizationName || user.name || 'Global Outreach Foundation',
                    buyerType: user.accountType || user.type || 'ngo',
                    buyerEmail: user.email || 'ngodemo@gmail.com',
                    buyerPhone: user.publicPhone || user.phone || '+91 98840 56789',
                    buyerContactPerson: user.contactPerson || 'Verified NGO Lead',
                    buyerDarpanId: user.darpanId || 'TN/2023/0345678',
                    buyerNgoRegType: user.ngoRegType || 'darpan',
                    buyerAddress: user.address || 'Besant Nagar, Chennai',
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

            // Log purchase for platform live impact stats
            const purchases = JSON.parse(localStorage.getItem('nn_purchases') || '[]');
            const totalPortions = state.cart.reduce((sum, item) => sum + (parseInt(item.qty, 10) || 1), 0);
            purchases.push({
                id: Date.now().toString(),
                buyerOrg: user.organizationName || user.name || 'NGO Partner',
                qty: totalPortions,
                ts: Date.now()
            });
            localStorage.setItem('nn_purchases', JSON.stringify(purchases));

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
                    if (state.activePortal !== 'home') {
                        state.activePortal = 'home';
                        renderPortal();
                    }
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
                const apiIds = apiListings.map(l => l.id);
                // Only include demo listings that aren't sold out
                const uniqueDemoListings = demoListings.filter(d =>
                    !apiIds.includes(d.id) &&
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
                }).filter(l => l.status !== 'sold' && (parseInt(l.qty) || 0) > 0);

                let combinedListings = [...uniqueDemoListings, ...filteredApiListings];
                state.listings = combinedListings;
            } else {
                // API failed — still load demo listings (filter sold-out ones)
                const allDemo = JSON.parse(localStorage.getItem('nn_demo_listings') || '[]');
                state.listings = allDemo.filter(d => d.status !== 'sold' && (parseInt(d.qty) || 0) > 0);
            }

            const statsRes = await fetch(`${API_BASE}/stats`);
            if (statsRes.ok) {
                state.stats = await statsRes.json();
                // If database is completely empty/erased, purge stale client-side demo orders & listings
                if (Number(state.stats.totalMealsSaved || 0) === 0 && Number(state.stats.totalVendors || 0) === 0 && Number(state.stats.totalNGOs || 0) === 0) {
                    try {
                        localStorage.removeItem('nn_purchases');
                        localStorage.removeItem('nn_demo_purchased_ids');
                        localStorage.removeItem('nn_local_orders');
                        localStorage.removeItem('nn_demo_listings');
                        localStorage.removeItem('nn_cached_listings');
                    } catch (e) {}
                }
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
                state.listings = JSON.parse(localStorage.getItem('nn_cached_listings') || localStorage.getItem('nn_demo_listings') || '[]');
            }
            if (state.activePortal === 'seller' && typeof renderSellerListings === 'function') {
                renderSellerListings();
            } else if (state.activePortal === 'buyer' && typeof renderExchangeGrid === 'function') {
                renderExchangeGrid();
            }
        }
    }

    // --- PORTAL ROUTING HELPER ---
    function getPortalForUserType(t) {
        if (!t) return 'home';
        const s = String(t).toLowerCase();
        if (s === 'admin' || s.includes('admin')) return 'admin';
        if (s.includes('restaurant') || s.includes('vendor') || s.includes('seller')) return 'seller';
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
            if (user.email === 'tharunchokkanc@gmail.com' || user.email === 'admin@nourishnetwork.org') {
                user.role = 'admin';
            }
            const userRoleOrType = user.role === 'admin' ? 'admin' : (user.type || user.accountType || user.role || '');
            state.activePortal = getPortalForUserType(userRoleOrType);
            console.log("Session found, active portal:", state.activePortal);
            sessionStorage.setItem('nourishUser', JSON.stringify(user));
            sessionStorage.setItem('nourishToken', token);
            document.documentElement.classList.add('user-logged-in');
            document.documentElement.classList.add('portal-pre-active');

            // Render instantly on frame 1 using cached session + cached listings (zero wait, zero flash)
            renderPortal();

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

        // Meals Saved = total qty across all listings + purchased qty
        const listingMeals = (state.listings || []).reduce((sum, l) => sum + (parseInt(l.qty) || parseInt(l.quantity) || 0), 0);
        const purchasedMeals = purchases.reduce((sum, p) => sum + (p.qty || 0), 0);
        const totalMeals = listingMeals + purchasedMeals;

        // KG Shared = ~0.35kg per portion (avg Indian meal weight)
        const totalKg = Math.round(totalMeals * 0.35);

        // Partner Restaurants = unique vendor IDs in listings
        const vendorIds = new Set((state.listings || []).map(l => l.vendorId).filter(Boolean));
        const totalVendors = Math.max(vendorIds.size, demoListings.length > 0 ? 1 : 0, (state.listings || []).length > 0 ? 1 : 0);

        // NGOs Helped = unique buyer orgs from purchases
        const buyerOrgs = new Set(purchases.map(p => p.buyerOrg).filter(Boolean));
        const totalNGOs = buyerOrgs.size;

        return { totalMeals, totalKg, totalVendors, totalNGOs };
    }

    function updateLiveStats() {
        const hasApiStats = state.stats && typeof state.stats.totalMealsSaved !== 'undefined';
        const localStats = computeLocalStats();

        // When backend API stats are available, reflect the true database numbers (even if 0).
        // Fallback to locally computed stats only if the API is offline/unreachable.
        const meals = hasApiStats ? Number(state.stats.totalMealsSaved || 0) : localStats.totalMeals;
        const kg = hasApiStats ? Math.round(Number(state.stats.totalKgShared || 0)) : localStats.totalKg;
        const vendors = hasApiStats ? Number(state.stats.totalVendors || 0) : localStats.totalVendors;
        const ngos = hasApiStats ? Number(state.stats.totalNGOs || 0) : localStats.totalNGOs;

        const listedEl = document.querySelector('[data-target-stat="listed"]');
        const fulfilledEl = document.querySelector('[data-target-stat="fulfilled"]');
        const vendorsEl = document.querySelector('[data-target-stat="vendors"]');
        const ngosEl = document.querySelector('[data-target-stat="ngos"]');

        if (listedEl) listedEl.setAttribute('data-target', meals);
        if (fulfilledEl) fulfilledEl.setAttribute('data-target', kg);
        if (vendorsEl) vendorsEl.setAttribute('data-target', vendors);
        if (ngosEl) ngosEl.setAttribute('data-target', ngos);

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
            const target = +counter.getAttribute('data-target') || 0;
            if (target === 0) {
                counter.innerText = '0';
                return;
            }
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
                    counter.innerText = target.toLocaleString() + (target > 1000 ? '+' : '');
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
    const btnDemoAdmin = document.getElementById('btn-demo-admin');

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
        sessionStorage.removeItem('nourishUser');
        sessionStorage.removeItem('nourishToken');
        localStorage.removeItem('nourishUser');
        localStorage.removeItem('nourishToken');
        document.documentElement.classList.remove('user-logged-in', 'portal-pre-active');
        document.body.classList.remove('user-logged-in', 'portal-pre-active');
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
    // FIGMA DYNAMIC PILL TOAST NOTIFICATIONS
    // =========================================
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    function showToast(message, type = 'success', duration = 3800) {
        if (!toastContainer) {
            toastContainer = document.getElementById('toastContainer');
            if (!toastContainer) {
                toastContainer = document.createElement('div');
                toastContainer.id = 'toastContainer';
                toastContainer.className = 'toast-container';
                document.body.appendChild(toastContainer);
            }
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.setProperty('--toast-duration', `${duration}ms`);

        // Icons matching status types
        let iconMarkup = '<i class="fa-solid fa-circle-check"></i>';
        if (type === 'error') {
            iconMarkup = '<i class="fa-solid fa-circle-xmark"></i>';
        } else if (type === 'warning') {
            iconMarkup = '<i class="fa-solid fa-triangle-exclamation"></i>';
        } else if (type === 'info') {
            iconMarkup = '<i class="fa-solid fa-circle-info"></i>';
        }

        toast.innerHTML = `
            <div class="toast-icon">${iconMarkup}</div>
            <div class="toast-message">${message}</div>
            <button class="toast-close-btn" type="button" aria-label="Dismiss notification" title="Dismiss">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;

        const closeBtn = toast.querySelector('.toast-close-btn');
        let removeTimeout = null;

        const dismiss = () => {
            if (removeTimeout) clearTimeout(removeTimeout);
            toast.classList.remove('show');
            toast.classList.add('hide');
            setTimeout(() => {
                if (toast.parentElement) toast.remove();
            }, 350);
        };

        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dismiss();
            });
        }

        toastContainer.appendChild(toast);

        // Trigger entrance animation smoothly
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto-dismiss after duration
        removeTimeout = setTimeout(dismiss, duration);
    }
    // Expose for global deleteComment handler
    window.__showToast = showToast;
    window.showToast = showToast;
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

    // Check if coming from email verification link (?verified=true)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('verified') === 'true') {
        const storedUser = sessionStorage.getItem('nourishUser') || localStorage.getItem('nourishUser');
        const storedToken = sessionStorage.getItem('nourishToken') || localStorage.getItem('nourishToken');
        if (storedUser && storedToken) {
            sessionStorage.setItem('nourishUser', storedUser);
            sessionStorage.setItem('nourishToken', storedToken);
            document.documentElement.classList.add('user-logged-in');

            const parsedUser = JSON.parse(storedUser);
            const t = (parsedUser.type || parsedUser.accountType || '').toLowerCase();
            state.activePortal = (t === 'restaurant' || t === 'vendor' || t === 'seller') ? 'seller' : 'buyer';
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

    if (btnDemoAdmin) {
        btnDemoAdmin.addEventListener('click', async () => {
            btnDemoAdmin.disabled = true;
            btnDemoAdmin.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Logging in...';
            try {
                const res = await fetch(`${API_BASE}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: 'admin@nourishnetwork.org', password: 'admin123' })
                });
                const data = await res.json();
                if (res.ok && data.token) {
                    const demoAdmin = {
                        ...data.user,
                        name: data.user.name || 'Nourish HQ Operations',
                        type: 'admin',
                        accountType: 'admin',
                        role: 'admin',
                        isVerified: true
                    };
                    sessionStorage.setItem('nourishUser', JSON.stringify(demoAdmin));
                    sessionStorage.setItem('nourishToken', data.token);
                    document.documentElement.classList.add('user-logged-in');
                    state.activePortal = 'admin';
                    if (authModal) authModal.classList.remove('active');
                    showToast("🛡️ Admin Command Center unlocked! Welcome, Operations Lead.");
                    renderPortal();
                    syncDock();
                    refreshState();
                } else {
                    showToast(data.error || "Admin demo login failed", "error");
                }
            } catch (e) {
                showToast("Network error. Please try again.", "error");
            } finally {
                btnDemoAdmin.disabled = false;
                btnDemoAdmin.innerHTML = '🛡️ Admin Command Center';
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
                        const t = (data.user.role === 'admin' ? 'admin' : (data.user.type || data.user.accountType || data.user.role || '')).toLowerCase();
                        state.activePortal = getPortalForUserType(t);
                    }
                    renderPortal();
                    syncDock();
                    refreshState();
                }, 1000);
            } else if (response.status === 403 && data.unverified) {
                showToast(data.error || "Please verify your email address first.", "warning");
                authModal.classList.remove('active');
                const sentEmailEl = document.getElementById('verifySentEmail');
                if (sentEmailEl) sentEmailEl.innerText = data.email || email;
                const emailModal = document.getElementById('emailVerifyModal');
                if (emailModal) emailModal.classList.add('active');
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
                    document.documentElement.classList.add('user-logged-in');

                    if (data.user) {
                        const t = (data.user.role === 'admin' ? 'admin' : (data.user.type || data.user.accountType || data.user.role || '')).toLowerCase();
                        state.activePortal = getPortalForUserType(t);
                    }

                    showToast(`✨ Account verified via mobile! Welcome, ${data.user.name || email}! 🎉`, "success");
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

    // Direct 6-Digit OTP Code Submission
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
                    document.documentElement.classList.add('user-logged-in');

                    if (data.user) {
                        const t = (data.user.type || data.user.accountType || data.user.role || '').toLowerCase();
                        state.activePortal = getPortalForUserType(t);
                    }
                    syncDock();
                    renderPortal();
                    showToast("Account verified successfully! Welcome to Nourish Network.", "success");
                    refreshState();
                } else {
                    showToast(data.error || "Invalid code. Please check your email and try again.", "error");
                    if (verifyOtpInput) { verifyOtpInput.select(); verifyOtpInput.focus(); }
                }
            } catch (err) {
                showToast("Network error. Please try again.", "error");
            } finally {
                if (verifyOtpSubmitBtn) {
                    verifyOtpSubmitBtn.innerHTML = origText;
                    verifyOtpSubmitBtn.disabled = false;
                }
            }
        });
    }

    const resendVerificationBtn = document.getElementById('resendVerificationBtn');
    if (resendVerificationBtn) {
        resendVerificationBtn.addEventListener('click', async () => {
            const email = (document.getElementById('verifySentEmail')?.innerText || '').trim();
            if (!email) return;

            resendVerificationBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Sending...';
            resendVerificationBtn.disabled = true;

            try {
                const res = await fetch(`${API_BASE}/resend-verification`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast("Verification code resent! Please check your inbox.", "success");
                    const otpInput = document.getElementById('verifyOtpInput');
                    if (otpInput) { otpInput.value = ''; otpInput.focus(); }
                } else {
                    showToast(data.error || "Could not resend email.", "error");
                }
            } catch (err) {
                showToast("Network error trying to resend email.", "error");
            } finally {
                resendVerificationBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Resend Email';
                resendVerificationBtn.disabled = false;
            }
        });
    }

    // Dynamic Role-Based Compliance Fields (FSSAI vs DARPAN / Multi-tier NGO)
    const regAccountTypeRadios = document.querySelectorAll('input[name="accountType"]');
    const regFssaiWrap = document.getElementById('regFssaiWrap');
    const regDarpanWrap = document.getElementById('regDarpanWrap');
    const regFssai = document.getElementById('regFssai');
    const regDarpan = document.getElementById('regDarpan');
    const regNgoType = document.getElementById('regNgoType');
    const regFssaiFeedback = document.getElementById('regFssaiFeedback');
    const regDarpanFeedback = document.getElementById('regDarpanFeedback');

    const NGO_PLACEHOLDERS = {
        darpan: 'NITI Aayog DARPAN ID (e.g. TN/2026/0123456)',
        trust: 'State Society / Trust Deed No. (e.g. SOC/TN/2022/04812)'
    };

    function updateRegComplianceVisibility() {
        const selected = document.querySelector('input[name="accountType"]:checked');
        const isVendor = selected ? (selected.value === 'restaurant' || selected.value === 'vendor') : true;
        if (regFssaiWrap) regFssaiWrap.style.display = isVendor ? 'block' : 'none';
        if (regDarpanWrap) regDarpanWrap.style.display = isVendor ? 'none' : 'block';
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
                regFssaiFeedback.style.color = '#34d399';
                regFssaiFeedback.style.background = 'rgba(16, 185, 129, 0.12)';
                regFssaiFeedback.style.border = '1px solid rgba(16, 185, 129, 0.3)';
                regFssaiFeedback.innerHTML = `<i class="fa-solid fa-circle-check"></i> <strong>Valid FSSAI</strong>: ${res.stateName} · ${res.typeStr} (${res.year})`;
            } else {
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
                regDarpanFeedback.style.color = '#34d399';
                regDarpanFeedback.style.background = 'rgba(16, 185, 129, 0.12)';
                regDarpanFeedback.style.border = '1px solid rgba(16, 185, 129, 0.3)';
                regDarpanFeedback.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${res.message}`;
            } else {
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
        const fssaiCode = regFssai ? regFssai.value.trim() : '';
        const darpanId = regDarpan ? regDarpan.value.trim().toUpperCase() : '';
        const ngoRegType = regNgoType ? regNgoType.value : 'darpan';

        if (!organizationName || !email || !password) {
            showToast("Please fill in all required fields, including a password.", "error");
            return;
        }

        // FSSAI is mandatory for Vendor / Restaurant accounts
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

        // DARPAN / Trust Deed is mandatory for NGO / Shelter accounts
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

        const submitBtn = registerForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        setLoading(submitBtn, true, originalText);

        try {
            const response = await fetch(`${API_BASE}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accountType, organizationName, email, password, fssaiCode, darpanId, ngoRegType })
            });

            const data = await response.json();

            if (response.ok) {
                // Close auth modal & show "Check Your Email" notice
                authModal.classList.remove('active');

                const sentEmailEl = document.getElementById('verifySentEmail');
                if (sentEmailEl) sentEmailEl.innerText = email;

                const emailModal = document.getElementById('emailVerifyModal');
                if (emailModal) emailModal.classList.add('active');

                // Start cross-device verification polling: when user taps verify on phone,
                // this browser will automatically log in!
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
        const root = document.getElementById('nn-portals-root');
        const home = document.getElementById('home-portal');
        syncDock();
        syncPortalSwitcher();

        if (state.activePortal === 'home') {
            if (typeof stopAdminLivePolling === 'function') stopAdminLivePolling();
            document.documentElement.classList.remove('portal-pre-active', 'user-logged-in');
            document.documentElement.classList.add('user-at-home');
            document.body.classList.remove('portal-pre-active', 'user-logged-in');
            document.body.classList.add('user-at-home');

            if (home) home.style.setProperty('display', 'block', 'important');
            if (root) {
                root.style.setProperty('display', 'none', 'important');
                root.innerHTML = '';
                delete root.dataset.activePortal;
            }
            // Re-render slider + wall so any new comments from portals show up instantly
            try {
                renderReviewsSlider();
                renderCommunityWall();
            } catch (err) {
                console.warn("Home components refresh warning:", err);
            }
        } else {
            document.documentElement.classList.remove('user-at-home');
            document.body.classList.remove('user-at-home');
            document.documentElement.classList.add('portal-pre-active');

            if (home) home.style.setProperty('display', 'none', 'important');
            if (root) {
                root.style.setProperty('display', 'block', 'important');
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
            } else if (state.activePortal === 'admin') {
                renderAdminPortal();
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
        // IDs from index.html: cart-toggle-dock (buyer), add-listing-dock (seller)
        const cartDockItem = document.getElementById('cart-toggle-dock');
        const addDockItem = document.getElementById('add-listing-dock');
        const historyDockItem = document.getElementById('history-toggle-dock');
        const loginDockItem = document.getElementById('login-toggle-dock');
        const settingsDockItem = document.getElementById('settings-toggle-dock');
        const settingsNavItem = document.getElementById('settings-toggle-nav');
        const landingItems = document.querySelectorAll('.landing-only');

        if (state.activePortal === 'buyer') {
            landingItems.forEach(el => el.style.setProperty('display', 'none', 'important'));
            if (cartDockItem) cartDockItem.style.setProperty('display', 'flex', 'important');
            if (addDockItem) addDockItem.style.setProperty('display', 'none', 'important');
            if (historyDockItem) historyDockItem.style.setProperty('display', 'flex', 'important');
            if (settingsDockItem) settingsDockItem.style.setProperty('display', 'flex', 'important');
            if (loginDockItem) loginDockItem.style.setProperty('display', 'flex', 'important');
        } else if (state.activePortal === 'seller') {
            landingItems.forEach(el => el.style.setProperty('display', 'none', 'important'));
            if (cartDockItem) cartDockItem.style.setProperty('display', 'none', 'important');
            if (addDockItem) addDockItem.style.setProperty('display', 'flex', 'important');
            if (historyDockItem) historyDockItem.style.setProperty('display', 'flex', 'important');
            if (settingsDockItem) settingsDockItem.style.setProperty('display', 'flex', 'important');
            if (loginDockItem) loginDockItem.style.setProperty('display', 'flex', 'important');
        } else if (state.activePortal === 'admin') {
            landingItems.forEach(el => el.style.setProperty('display', 'none', 'important'));
            if (cartDockItem) cartDockItem.style.setProperty('display', 'none', 'important');
            if (addDockItem) addDockItem.style.setProperty('display', 'none', 'important');
            if (historyDockItem) historyDockItem.style.setProperty('display', 'none', 'important');
            if (settingsDockItem) settingsDockItem.style.setProperty('display', 'none', 'important');
            if (loginDockItem) loginDockItem.style.setProperty('display', 'flex', 'important');
        } else {
            landingItems.forEach(el => el.style.setProperty('display', 'flex', 'important'));
            if (cartDockItem) cartDockItem.style.setProperty('display', 'none', 'important');
            if (addDockItem) addDockItem.style.setProperty('display', 'none', 'important');
            if (historyDockItem) historyDockItem.style.setProperty('display', 'none', 'important');
            if (settingsDockItem) settingsDockItem.style.setProperty('display', 'none', 'important');
            if (loginDockItem) loginDockItem.style.setProperty('display', 'flex', 'important');
        }
    }

    function syncPortalSwitcher() {
        // Removed as the top pill switcher was replaced by the bottom dock.
    }

    function logout() {
        console.log("logout: Clearing session and switching to homepage");
        if (typeof stopAdminLivePolling === 'function') stopAdminLivePolling();
        sessionStorage.removeItem('nourishUser');
        sessionStorage.removeItem('nourishToken');
        localStorage.removeItem('nourishUser');
        localStorage.removeItem('nourishToken');

        document.documentElement.classList.remove('user-logged-in', 'portal-pre-active');
        document.documentElement.classList.add('user-at-home');
        document.body.classList.remove('user-logged-in', 'portal-pre-active');
        document.body.classList.add('user-at-home');

        if (window.location.hash) {
            try {
                history.replaceState(null, document.title, window.location.pathname + window.location.search);
            } catch (e) {
                window.location.hash = '';
            }
        }

        state.activePortal = 'home';
        state.cart = [];

        const root = document.getElementById('nn-portals-root');
        const home = document.getElementById('home-portal');
        if (root) {
            root.style.setProperty('display', 'none', 'important');
            root.innerHTML = '';
            delete root.dataset.activePortal;
        }
        if (home) {
            home.style.setProperty('display', 'block', 'important');
        }

        renderPortal();
        updateLiquidIndicator();
        syncDock();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showToast("Logged out successfully.", "info");
    }
    window.logout = logout;


    function renderSellerPortal() {
        const sessionUser = JSON.parse(sessionStorage.getItem('nourishUser') || '{}');
        const isAdmin = checkIsAdminUser();
        let user = sessionUser;
        if (isAdmin && state.adminInspectedUser) {
            user = state.adminInspectedUser;
        } else if (isAdmin && sessionStorage.getItem('nn_admin_inspected_user')) {
            try {
                state.adminInspectedUser = JSON.parse(sessionStorage.getItem('nn_admin_inspected_user'));
                user = state.adminInspectedUser;
            } catch (e) {}
        }

        const sellerListings = state.listings.filter(l => Number(l.vendorId) === Number(user.id));
        const fssai = user.fssaiCode || user.fssaicode || '';

        let totalMealsDonated = 0;
        sellerListings.forEach(item => { totalMealsDonated += parseFloat(item.quantity != null ? item.quantity : item.qty) || 0; });

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

                    ${isAdmin ? `
                        <div class="admin-inspect-banner">
                            <div class="admin-inspect-banner-content">
                                <div class="admin-inspect-badge">
                                    <i class="fa-solid fa-shield-halved"></i> Admin Inspection Mode
                                </div>
                                <div class="admin-inspect-details">
                                    Inspecting: <strong>${user.organizationName || user.name || 'Vendor'}</strong>
                                    <span class="admin-inspect-meta">(ID #${user.id} &bull; ${user.email} &bull; ${user.accountType || 'Restaurant'})</span>
                                </div>
                            </div>
                            <div class="admin-inspect-actions">
                                <button onclick="window.adminOpenUserPicker && window.adminOpenUserPicker('seller')" class="admin-inspect-pill-btn">
                                    <i class="fa-solid fa-arrows-rotate"></i> Switch Vendor
                                </button>
                                <button onclick="window.adminExitToAdminHQ && window.adminExitToAdminHQ()" class="admin-inspect-pill-btn admin-inspect-exit-btn">
                                    <i class="fa-solid fa-arrow-left"></i> Return to Admin HQ
                                </button>
                            </div>
                        </div>
                    ` : ''}

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
                                    <input type="number" id="p-qty" class="form-control" value="0" min="0" placeholder="0" required>
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
                                <div class="form-group">
                                    <label style="display:flex; align-items:center; gap:6px;">
                                        <i class="fa-solid fa-phone" style="color:var(--accent-primary);"></i> Contact Mobile Number <span style="color:#ef4444; font-weight:700;">*</span>
                                    </label>
                                    <input type="tel" id="p-phone" class="form-control" placeholder="e.g. +91 98765 43210" value="${user.publicPhone || user.phone || ''}" required>
                                </div>
                                <div class="form-group">
                                    <label style="display:flex; align-items:center; gap:6px;">
                                        <i class="fa-solid fa-location-dot" style="color:var(--accent-primary);"></i> Kitchen / Pickup Location <span style="color:#ef4444; font-weight:700;">*</span>
                                    </label>
                                    <input type="text" id="p-address" class="form-control" placeholder="e.g. 12, Indiranagar, Bengaluru" value="${user.address || ''}" required>
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

        const sessionUser = JSON.parse(sessionStorage.getItem('nourishUser') || '{}');
        const isAdmin = checkIsAdminUser();
        let user = sessionUser;
        if (isAdmin && state.adminInspectedUser) {
            user = state.adminInspectedUser;
        } else if (isAdmin && sessionStorage.getItem('nn_admin_inspected_user')) {
            try {
                state.adminInspectedUser = JSON.parse(sessionStorage.getItem('nn_admin_inspected_user'));
                user = state.adminInspectedUser;
            } catch (e) {}
        }
        if (!user || !user.id) return;

        // Filter to show only THIS seller's active items (sold out items cleared on refresh)
        const myItems = state.listings.filter(l => 
            Number(l.vendorId) === Number(user.id) &&
            l.status !== 'sold' &&
            (parseInt(l.quantity != null ? l.quantity : l.qty) || 0) > 0
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
                    if (document.getElementById('p-phone')) document.getElementById('p-phone').value = item.vendorPhone || item.phone || user.publicPhone || user.phone || '';
                    if (document.getElementById('p-address')) document.getElementById('p-address').value = item.vendorAddress || item.address || user.address || '';
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
        const sessionUser = JSON.parse(sessionStorage.getItem('nourishUser') || '{}');
        const isAdmin = checkIsAdminUser();
        let user = sessionUser;
        if (isAdmin && state.adminInspectedUser) {
            user = state.adminInspectedUser;
        } else if (isAdmin && sessionStorage.getItem('nn_admin_inspected_user')) {
            try {
                state.adminInspectedUser = JSON.parse(sessionStorage.getItem('nn_admin_inspected_user'));
                user = state.adminInspectedUser;
            } catch (e) {}
        }

        const darpan = user.darpanId || user.darpanid || '';

        const root = portalsRoot || document.getElementById('nn-portals-root');
        if (!root) return;

        root.innerHTML = `
            <div class="buyer-portal-layout animate-reveal" style="padding-top: 100px; min-height: 100vh;">
                <div class="container" style="max-width: 1300px; margin: 0 auto; padding: 1.5rem 2rem 3rem;">

                    ${isAdmin ? `
                        <div class="admin-inspect-banner">
                            <div class="admin-inspect-banner-content">
                                <div class="admin-inspect-badge">
                                    <i class="fa-solid fa-shield-halved"></i> Admin Inspection Mode
                                </div>
                                <div class="admin-inspect-details">
                                    Inspecting: <strong>${user.organizationName || user.name || 'NGO Partner'}</strong>
                                    <span class="admin-inspect-meta">(ID #${user.id} &bull; ${user.email} &bull; ${user.accountType || 'NGO'})</span>
                                </div>
                            </div>
                            <div class="admin-inspect-actions">
                                <button onclick="window.adminOpenUserPicker && window.adminOpenUserPicker('buyer')" class="admin-inspect-pill-btn">
                                    <i class="fa-solid fa-arrows-rotate"></i> Switch NGO
                                </button>
                                <button onclick="window.adminExitToAdminHQ && window.adminExitToAdminHQ()" class="admin-inspect-pill-btn admin-inspect-exit-btn">
                                    <i class="fa-solid fa-arrow-left"></i> Return to Admin HQ
                                </button>
                            </div>
                        </div>
                    ` : ''}

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

    // ═════════════════════════════════════════════════════════════════════════
    // ADMIN COMMAND CENTER & OPERATIONS DASHBOARD
    // ═════════════════════════════════════════════════════════════════════════
    let adminCache = {
        stats: null,
        users: [],
        listings: [],
        handovers: []
    };

    function checkIsAdminUser() {
        const token = sessionStorage.getItem('nourishToken');
        if (!token) return false;
        const user = JSON.parse(sessionStorage.getItem('nourishUser') || '{}');
        return Boolean(user && (user.role === 'admin' || user.email === 'tharunchokkanc@gmail.com' || user.email === 'admin@nourishnetwork.org'));
    }

    window.adminExitToHome = function() {
        if (window.location.hash === '#admin' || window.location.hash.startsWith('#admin')) {
            try {
                history.replaceState(null, document.title, window.location.pathname + window.location.search);
            } catch (e) {
                window.location.hash = '';
            }
        }
        state.activePortal = 'home';
        renderPortal();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.openAdminAuthModal = function() {
        const modal = document.getElementById('adminAuthModal');
        if (modal) {
            modal.classList.add('active');
            const alert = document.getElementById('adminAuthAlert');
            if (alert) alert.style.display = 'none';
            const emailInput = document.getElementById('adminEmailInput');
            if (emailInput) setTimeout(() => emailInput.focus(), 150);
        }
    };

    window.closeAdminAuthModal = function() {
        const modal = document.getElementById('adminAuthModal');
        if (modal) modal.classList.remove('active');
    };

    window.handleAdminLogin = async function(event) {
        if (event) event.preventDefault();
        const email = (document.getElementById('adminEmailInput')?.value || '').trim();
        const password = document.getElementById('adminPasswordInput')?.value || '';
        const alert = document.getElementById('adminAuthAlert');
        const submitBtn = document.getElementById('adminLoginSubmitBtn');

        if (!email || !password) {
            if (alert) {
                alert.textContent = 'Please enter both administrator email and password.';
                alert.style.display = 'block';
            }
            return;
        }

        const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Authenticating...';
        }

        try {
            const res = await fetch(`${API_BASE}/auth/admin-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (res.ok && data.token) {
                sessionStorage.setItem('nourishToken', data.token);
                sessionStorage.setItem('nourishUser', JSON.stringify(data.user));
                localStorage.setItem('nourishToken', data.token);
                localStorage.setItem('nourishUser', JSON.stringify(data.user));
                
                document.documentElement.classList.add('user-logged-in');
                window.closeAdminAuthModal();

                state.activePortal = 'admin';
                renderPortal();
                syncDock();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                showToast("Access Granted: Welcome to Command Center.", "success");
            } else {
                if (alert) {
                    alert.textContent = data.error || 'Authentication rejected. Administrator privileges required.';
                    alert.style.display = 'block';
                }
            }
        } catch (err) {
            if (alert) {
                alert.textContent = 'Network or server error during administrator sign in.';
                alert.style.display = 'block';
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        }
    };

    window.openAdminPortal = function() {
        if (!checkIsAdminUser()) {
            window.openAdminAuthModal();
            return;
        }
        state.activePortal = 'admin';
        renderPortal();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Secret shortcut: Ctrl+Shift+A (or Cmd+Shift+A) to open Admin Gatekeeper / Command Center
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
            e.preventDefault();
            if (checkIsAdminUser()) {
                window.openAdminPortal();
            } else {
                window.openAdminAuthModal();
            }
        }
    });

    // Check URL hash (#admin)
    if (window.location.hash === '#admin') {
        setTimeout(() => {
            if (checkIsAdminUser()) {
                window.openAdminPortal();
            } else {
                window.openAdminAuthModal();
            }
        }, 300);
    }

    let currentAdminPickerType = 'seller';

    window.adminSwitchPortal = function(portal) {
        window.adminOpenUserPicker(portal);
    };

    window.adminOpenUserPicker = async function(portalType = 'seller') {
        currentAdminPickerType = portalType;
        const modal = document.getElementById('adminUserPickerModal');
        if (!modal) return;

        modal.classList.add('active');

        const isSeller = portalType === 'seller';
        const pill = document.getElementById('adminPickerPill');
        const title = document.getElementById('adminPickerTitle');
        const subtitle = document.getElementById('adminPickerSubtitle');
        const searchInput = document.getElementById('adminPickerSearchInput');
        if (searchInput) searchInput.value = '';

        if (pill) {
            pill.innerHTML = isSeller 
                ? '<i class="fa-solid fa-shop"></i> Vendor Directory' 
                : '<i class="fa-solid fa-hands-holding-child"></i> NGO / Buyer Directory';
            pill.style.background = isSeller ? 'rgba(16,185,129,0.12)' : 'rgba(56,189,248,0.12)';
            pill.style.color = isSeller ? '#34d399' : '#38bdf8';
            pill.style.borderColor = isSeller ? 'rgba(16,185,129,0.3)' : 'rgba(56,189,248,0.3)';
        }

        if (title) {
            title.textContent = isSeller 
                ? 'Select Vendor / Restaurant to Inspect' 
                : 'Select NGO / Community Partner to Inspect';
        }

        if (subtitle) {
            subtitle.textContent = isSeller 
                ? 'Choose which registered restaurant or food donor dashboard you want to inspect and audit.' 
                : 'Choose which registered NGO partner or recipient dashboard you want to inspect and audit.';
        }

        const container = document.getElementById('adminPickerListContainer');
        if ((!adminCache.users || adminCache.users.length === 0) && container) {
            container.innerHTML = `<div style="text-align:center; padding: 2.5rem; color: rgba(255,255,255,0.4);"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading registered accounts...</div>`;
            try {
                const token = sessionStorage.getItem('nourishToken') || '';
                const res = await fetch(`${API_BASE}/admin/users?_t=${Date.now()}`, { headers: { 'Authorization': `Bearer ${token}` } });
                const data = await res.json();
                if (data && data.users) {
                    adminCache.users = data.users;
                }
            } catch (e) {}
        }

        window.adminRenderPickerList('');
    };

    window.closeAdminPickerModal = function() {
        const modal = document.getElementById('adminUserPickerModal');
        if (modal) modal.classList.remove('active');
    };

    window.adminFilterPickerUsers = function(query) {
        window.adminRenderPickerList(query);
    };

    window.adminRenderPickerList = function(query = '') {
        const container = document.getElementById('adminPickerListContainer');
        const countBadge = document.getElementById('adminPickerCountBadge');
        if (!container) return;

        const isSeller = currentAdminPickerType === 'seller';
        const allUsers = adminCache.users || [];

        const filteredByRole = allUsers.filter(u => {
            const type = (u.accountType || u.type || '').toLowerCase();
            if (isSeller) {
                return type.includes('restaurant') || type.includes('vendor') || type.includes('seller');
            } else {
                return type.includes('ngo') || type.includes('shelter') || type.includes('buyer');
            }
        });

        const q = (query || '').toLowerCase().trim();
        const matches = filteredByRole.filter(u => {
            if (!q) return true;
            const name = (u.organizationName || u.name || '').toLowerCase();
            const email = (u.email || '').toLowerCase();
            const phone = (u.phone || '').toLowerCase();
            const code = (u.fssaiCode || u.darpanId || '').toLowerCase();
            return name.includes(q) || email.includes(q) || phone.includes(q) || code.includes(q) || String(u.id).includes(q);
        });

        if (countBadge) {
            countBadge.textContent = `${matches.length} of ${filteredByRole.length} registered ${isSeller ? 'Vendors' : 'NGOs'}`;
        }

        if (matches.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem 1.5rem; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 18px; color: rgba(255,255,255,0.5);">
                    <i class="fa-solid fa-magnifying-glass" style="font-size: 2rem; margin-bottom: 0.75rem; opacity: 0.4; display: block;"></i>
                    <div style="font-weight: 700; color: #fff; margin-bottom: 4px;">No matching accounts found</div>
                    <div style="font-size: 0.85rem;">Try adjusting your search terms or verify that accounts have registered.</div>
                </div>
            `;
            return;
        }

        const currentInspectedId = state.adminInspectedUser ? state.adminInspectedUser.id : null;

        let html = '';
        matches.forEach(u => {
            const isCurrent = currentInspectedId && Number(currentInspectedId) === Number(u.id);
            const name = u.organizationName || u.name || (isSeller ? 'Unnamed Vendor' : 'Unnamed NGO');
            const initials = name.replace(/[^a-zA-Z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || (isSeller ? 'VN' : 'NG');

            let extraInfo = '';
            if (isSeller) {
                const listings = (adminCache.listings || state.listings || []).filter(l => Number(l.vendorId) === Number(u.id));
                const activeCount = listings.filter(l => l.status !== 'sold' && l.status !== 'claimed').length;
                extraInfo = `<span style="color:#10b981;"><i class="fa-solid fa-bowl-food"></i> ${listings.length} listings (${activeCount} active)</span>`;
            } else {
                const handovers = (adminCache.handovers || []).filter(h => Number(h.buyerId) === Number(u.id));
                extraInfo = `<span style="color:#38bdf8;"><i class="fa-solid fa-hands-holding-child"></i> ${handovers.length} pickups/claims</span>`;
            }

            const accreditation = u.fssaiCode 
                ? `<span class="admin-picker-meta-tag"><i class="fa-solid fa-shield-halved"></i> FSSAI: ${u.fssaiCode}</span>` 
                : (u.darpanId ? `<span class="admin-picker-meta-tag"><i class="fa-solid fa-certificate"></i> DARPAN: ${u.darpanId}</span>` : '');

            html += `
                <div class="admin-picker-user-card ${isCurrent ? 'is-current-active' : ''}" onclick="window.adminInspectUserPortal(${u.id})">
                    <div class="admin-picker-avatar-wrap" style="${isCurrent ? 'border-color: #10b981;' : ''}">
                        ${u.avatarUrl ? `<img src="${u.avatarUrl}" alt="${name}">` : `<span>${initials}</span>`}
                    </div>
                    <div class="admin-picker-details">
                        <div class="admin-picker-title-row">
                            <span class="admin-picker-name">${name}</span>
                            <span class="admin-picker-id-tag">ID #${u.id}</span>
                            ${isCurrent ? '<span style="font-size:0.7rem; color:#10b981; font-weight:800; background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.3); padding:2px 8px; border-radius:100px;">● Currently Viewing</span>' : ''}
                            ${u.isVerified 
                                ? '<span class="admin-picker-verified-pill"><i class="fa-solid fa-circle-check"></i> Verified</span>' 
                                : '<span class="admin-picker-unverified-pill"><i class="fa-solid fa-clock"></i> Unverified</span>'}
                        </div>
                        <div class="admin-picker-sub-row">
                            <span><i class="fa-solid fa-envelope"></i> ${u.email}</span>
                            ${u.phone ? `<span><i class="fa-solid fa-phone"></i> ${u.phone}</span>` : ''}
                            ${accreditation}
                            ${extraInfo}
                        </div>
                    </div>
                    <button class="admin-picker-open-btn" onclick="event.stopPropagation(); window.adminInspectUserPortal(${u.id})">
                        <span>${isCurrent ? 'Open' : 'Inspect'}</span> <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    </button>
                </div>
            `;
        });

        container.innerHTML = html;
    };

    window.adminInspectUserPortal = async function(userId) {
        window.closeAdminPickerModal();

        let target = (adminCache.users || []).find(u => Number(u.id) === Number(userId));
        if (!target) {
            try {
                const token = sessionStorage.getItem('nourishToken') || '';
                const res = await fetch(`${API_BASE}/admin/users?_t=${Date.now()}`, { headers: { 'Authorization': `Bearer ${token}` } });
                const data = await res.json();
                if (data && data.users) {
                    adminCache.users = data.users;
                    target = data.users.find(u => Number(u.id) === Number(userId));
                }
            } catch (e) {}
        }

        if (!target) {
            showToast("User account not found.", "error");
            return;
        }

        state.adminInspectedUser = target;
        sessionStorage.setItem('nn_admin_inspected_user', JSON.stringify(target));

        const role = (target.accountType || target.type || '').toLowerCase();
        const isSeller = role.includes('restaurant') || role.includes('vendor') || role.includes('seller');
        state.activePortal = isSeller ? 'seller' : 'buyer';

        showToast(`Viewing ${target.organizationName || target.name || target.email} (${isSeller ? 'Vendor' : 'NGO'}) 🛡️`, "success");

        renderPortal();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.adminExitToAdminHQ = function() {
        state.activePortal = 'admin';
        renderPortal();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.adminSwitchTab = function(tabName) {
        document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.admin-tab-view').forEach(view => view.style.display = 'none');

        const activeBtn = document.getElementById(`adm-tab-btn-${tabName}`);
        if (activeBtn) activeBtn.classList.add('active');

        const activeView = document.getElementById(`admin-view-${tabName}`);
        if (activeView) activeView.style.display = 'block';
    };

    window.adminRefreshData = async function() {
        showToast("Fetching real-time platform telemetry...", "info");
        await fetchAndRenderAdminData(true);
        showToast("Data refreshed successfully!", "success");
    };

    window.adminToggleVerify = async function(userId, newStatus) {
        try {
            const token = sessionStorage.getItem('nourishToken') || '';
            const res = await fetch(`${API_BASE}/admin/users/${userId}/verify`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ isVerified: newStatus })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                const user = adminCache.users.find(u => u.id == userId);
                if (user) user.isVerified = newStatus ? 1 : 0;
                renderAdminComplianceTable();
                renderAdminUsersTable();
                updateAdminBadgeCounts();
                updateAdminKpiMetrics(true);
                showToast(newStatus ? "Partner accreditation verified! Live impact updated (+1)." : "Partner accreditation revoked. Impact updated.", "success");
            } else {
                showToast(data.error || "Failed to update status", "error");
            }
        } catch (err) {
            showToast("Network error updating verification status.", "error");
        }
    };

    window.adminDeleteListing = async function(listingId) {
        if (!confirm("Are you sure you want to remove this surplus listing from the public network?")) return;
        try {
            const token = sessionStorage.getItem('nourishToken') || '';
            const res = await fetch(`${API_BASE}/admin/listings/${listingId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast("Listing moderated and removed.", "info");
                adminCache.listings = adminCache.listings.filter(l => l.id != listingId);
                state.listings = state.listings.filter(l => l.id != listingId);
                renderAdminListingsTable();
                updateAdminBadgeCounts();
                updateAdminKpiMetrics(true);
            } else {
                showToast(data.error || "Failed to delete listing", "error");
            }
        } catch (err) {
            showToast("Network error deleting listing.", "error");
        }
    };

    window.adminDeleteUser = async function(userId) {
        if (!confirm("Permanently remove this organization account and its records?")) return;
        try {
            const token = sessionStorage.getItem('nourishToken') || '';
            const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast("User account permanently removed.", "info");
                adminCache.users = adminCache.users.filter(u => u.id != userId);
                renderAdminComplianceTable();
                renderAdminUsersTable();
                updateAdminBadgeCounts();
                updateAdminKpiMetrics(true);
            } else {
                showToast(data.error || "Failed to delete user", "error");
            }
        } catch (err) {
            showToast("Network error removing user.", "error");
        }
    };

    window.adminToggleRole = async function(userId, newRole) {
        const actionText = newRole === 'admin' ? 'promote this user to Administrator' : 'revoke Administrator privileges for this user';
        if (!confirm(`Are you sure you want to ${actionText}?`)) return;

        try {
            const token = sessionStorage.getItem('nourishToken') || '';
            const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ role: newRole })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast(data.message || `User role updated to ${newRole.toUpperCase()}.`, "success");
                const user = adminCache.users.find(u => u.id == userId);
                if (user) user.role = newRole;
                renderAdminUsersTable();
                updateAdminBadgeCounts();
                updateAdminKpiMetrics(true);
            } else {
                showToast(data.error || "Failed to update role.", "error");
            }
        } catch (err) {
            showToast("Network error updating role.", "error");
        }
    };

    window.handleCreateAdminSubmit = async function(event) {
        if (event) event.preventDefault();
        const organizationName = (document.getElementById('newAdminOrgInput')?.value || '').trim();
        const email = (document.getElementById('newAdminEmailInput')?.value || '').trim();
        const password = document.getElementById('newAdminPasswordInput')?.value || '';
        const submitBtn = document.getElementById('createAdminSubmitBtn');

        if (!email || !password) {
            showToast("Please provide both email and password.", "error");
            return;
        }

        const origText = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Creating...';
        }

        try {
            const token = sessionStorage.getItem('nourishToken') || '';
            const res = await fetch(`${API_BASE}/admin/users/create-admin`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ organizationName, email, password })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast(data.message || "New administrator created successfully!", "success");
                document.getElementById('adminAddModal')?.classList.remove('active');
                document.getElementById('createAdminForm')?.reset();
                await fetchAndRenderAdminData(true);
            } else {
                showToast(data.error || "Failed to create administrator.", "error");
            }
        } catch (err) {
            showToast("Network error creating administrator.", "error");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = origText;
            }
        }
    };

    function updateAdminBadgeCounts() {
        const pendingCount = adminCache.users.filter(u => !u.isVerified && u.role !== 'admin').length;
        const compBadge = document.getElementById('adm-badge-compliance');
        if (compBadge) compBadge.textContent = pendingCount;

        const listBadge = document.getElementById('adm-badge-listings');
        if (listBadge) listBadge.textContent = adminCache.listings.length;

        const handBadge = document.getElementById('adm-badge-handovers');
        if (handBadge) handBadge.textContent = adminCache.handovers.length;

        const userBadge = document.getElementById('adm-badge-users');
        if (userBadge) userBadge.textContent = adminCache.users.length;
    }

    function renderAdminComplianceTable() {
        const container = document.getElementById('admin-view-compliance');
        if (!container) return;

        const orgs = adminCache.users.filter(u => u.role !== 'admin');
        if (!orgs.length) {
            container.innerHTML = `<div style="text-align:center; padding: 3rem; color: rgba(255,255,255,0.4);"><i class="fa-solid fa-clipboard-check" style="font-size:2rem; margin-bottom:1rem; display:block;"></i>No partner organizations registered yet.</div>`;
            return;
        }

        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:10px;">
                <p style="color:rgba(255,255,255,0.7); font-size:0.88rem; margin:0;">
                    Review statutory accreditations (14-digit FSSAI licenses for Food Vendors, NITI Aayog DARPAN / Society Deeds for NGOs).
                </p>
                <div style="font-size:0.82rem; color: #10b981; font-weight:700;">
                    ${orgs.filter(o => o.isVerified).length} Verified / ${orgs.length} Total Partners
                </div>
            </div>
            <div class="admin-table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Organization</th>
                            <th>Entity Type</th>
                            <th>Statutory Accreditation</th>
                            <th>Contact / Location</th>
                            <th>Status</th>
                            <th style="text-align:right;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        orgs.forEach(o => {
            const isSeller = ['restaurant', 'vendor', 'seller'].includes((o.accountType || '').toLowerCase());
            const typeBadge = isSeller 
                ? `<span style="background:rgba(16,185,129,0.15); color:#34d399; padding:3px 8px; border-radius:6px; font-weight:700; font-size:0.75rem;"><i class="fa-solid fa-shop"></i> Food Vendor</span>`
                : `<span style="background:rgba(56,189,248,0.15); color:#38bdf8; padding:3px 8px; border-radius:6px; font-weight:700; font-size:0.75rem;"><i class="fa-solid fa-hands-holding-child"></i> NGO / Shelter</span>`;

            let licenseInfo = '';
            if (isSeller) {
                if (o.fssaiCode) {
                    licenseInfo = `<div style="font-family:monospace; color:#34d399; font-weight:700; letter-spacing:0.5px;"><i class="fa-solid fa-shield-halved"></i> FSSAI: ${o.fssaiCode}</div><div style="font-size:0.72rem; color:rgba(255,255,255,0.5);">14-Digit Food Safety Code</div>`;
                } else {
                    licenseInfo = `<div style="color:#f59e0b; font-size:0.78rem;"><i class="fa-solid fa-triangle-exclamation"></i> FSSAI Not Provided</div>`;
                }
            } else {
                if (o.darpanId) {
                    licenseInfo = `<div style="font-family:monospace; color:#38bdf8; font-weight:700; letter-spacing:0.5px;"><i class="fa-solid fa-building-columns"></i> ${o.darpanId}</div><div style="font-size:0.72rem; color:rgba(255,255,255,0.5);">${o.ngoRegType === 'trust' ? 'State Society / Trust' : 'NITI Aayog DARPAN ID'}</div>`;
                } else {
                    licenseInfo = `<div style="color:#f59e0b; font-size:0.78rem;"><i class="fa-solid fa-triangle-exclamation"></i> DARPAN Not Provided</div>`;
                }
            }

            const statusBadge = o.isVerified
                ? `<span style="background:rgba(16,185,129,0.15); color:#34d399; border:1px solid rgba(16,185,129,0.3); padding:3px 10px; border-radius:100px; font-weight:700; font-size:0.75rem; display:inline-flex; align-items:center; gap:5px;"><i class="fa-solid fa-circle-check"></i> Verified</span>`
                : `<span style="background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.3); padding:3px 10px; border-radius:100px; font-weight:700; font-size:0.75rem; display:inline-flex; align-items:center; gap:5px;"><i class="fa-solid fa-clock"></i> Pending Review</span>`;

            const actionBtn = o.isVerified
                ? `<button onclick="window.adminToggleVerify(${o.id}, false)" class="admin-action-btn delete" title="Suspend partner compliance status"><i class="fa-solid fa-ban"></i> Revoke</button>`
                : `<button onclick="window.adminToggleVerify(${o.id}, true)" class="admin-action-btn verify" title="Approve and activate verified badge"><i class="fa-solid fa-circle-check"></i> 1-Click Approve</button>`;

            html += `
                <tr>
                    <td>
                        <div style="font-weight:700; color:#fff;">${o.organizationName || 'Unnamed Org'}</div>
                        <div style="font-size:0.78rem; color:rgba(255,255,255,0.5);">${o.email}</div>
                    </td>
                    <td>${typeBadge}</td>
                    <td>${licenseInfo}</td>
                    <td style="font-size:0.8rem; color:rgba(255,255,255,0.7);">
                        ${o.contactPerson ? `<div><i class="fa-solid fa-user" style="font-size:0.7rem; color:var(--text-muted);"></i> ${o.contactPerson}</div>` : ''}
                        ${o.phone ? `<div><i class="fa-solid fa-phone" style="font-size:0.7rem; color:var(--text-muted);"></i> ${o.phone}</div>` : ''}
                        ${o.address ? `<div style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><i class="fa-solid fa-location-dot" style="font-size:0.7rem; color:var(--text-muted);"></i> ${o.address}</div>` : ''}
                    </td>
                    <td>${statusBadge}</td>
                    <td style="text-align:right;">${actionBtn}</td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;
        container.innerHTML = html;
    }

    function renderAdminListingsTable() {
        const container = document.getElementById('admin-view-listings');
        if (!container) return;

        if (!adminCache.listings.length) {
            container.innerHTML = `<div style="text-align:center; padding: 3rem; color: rgba(255,255,255,0.4);"><i class="fa-solid fa-utensils" style="font-size:2rem; margin-bottom:1rem; display:block;"></i>No food listings currently in database.</div>`;
            return;
        }

        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:10px;">
                <p style="color:rgba(255,255,255,0.7); font-size:0.88rem; margin:0;">
                    Live surplus inventory across all vendors. 1-click removal for quality or safety moderation.
                </p>
                <div style="font-size:0.82rem; color: #10b981; font-weight:700;">
                    ${adminCache.listings.length} Active Platform Listings
                </div>
            </div>
            <div class="admin-table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Item Name</th>
                            <th>Donor / Vendor</th>
                            <th>Quantity</th>
                            <th>Dietary / Freshness</th>
                            <th>Status</th>
                            <th style="text-align:right;">Moderation</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        adminCache.listings.forEach(l => {
            const statusColor = (l.status === 'claimed') ? '#38bdf8' : '#10b981';
            const statusLabel = (l.status === 'claimed') ? 'Claimed' : 'Available';

            html += `
                <tr>
                    <td>
                        <div style="font-weight:700; color:#fff;">${l.name}</div>
                        <div style="font-size:0.75rem; color:rgba(255,255,255,0.5);">ID: #${l.id} • Added: ${l.createdAt ? new Date(l.createdAt).toLocaleDateString() : 'Recent'}</div>
                    </td>
                    <td>
                        <div style="font-weight:600; color:#e5e5e5;">${l.vendorOrg || ('Vendor #' + l.vendorId)}</div>
                        ${l.vendorFssai ? `<div style="font-size:0.72rem; color:#34d399; font-family:monospace;">FSSAI: ${l.vendorFssai}</div>` : ''}
                    </td>
                    <td>
                        <span style="font-weight:700; color:#fff;">${l.quantity || l.qty} ${l.unit || 'portions'}</span>
                    </td>
                    <td style="font-size:0.8rem; color:rgba(255,255,255,0.7);">
                        <div><i class="fa-solid fa-leaf" style="color:#10b981;"></i> ${l.dietary || 'Standard'}</div>
                        ${l.expiry ? `<div style="font-size:0.72rem; color:#f59e0b;"><i class="fa-solid fa-clock"></i> Exp: ${l.expiry}</div>` : ''}
                    </td>
                    <td>
                        <span style="color:${statusColor}; font-weight:700; font-size:0.78rem; background:rgba(255,255,255,0.06); padding:3px 8px; border-radius:6px;">
                            ● ${statusLabel}
                        </span>
                    </td>
                    <td style="text-align:right;">
                        <button onclick="window.adminDeleteListing(${l.id})" class="admin-action-btn delete" title="Remove listing from network">
                            <i class="fa-solid fa-trash-can"></i> Remove
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;
        container.innerHTML = html;
    }

    function renderAdminHandoversTable() {
        const container = document.getElementById('admin-view-handovers');
        if (!container) return;

        if (!adminCache.handovers.length) {
            container.innerHTML = `<div style="text-align:center; padding: 3rem; color: rgba(255,255,255,0.4);"><i class="fa-solid fa-handshake-angle" style="font-size:2rem; margin-bottom:1rem; display:block;"></i>No orders or handovers recorded yet.</div>`;
            return;
        }

        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:10px;">
                <p style="color:rgba(255,255,255,0.7); font-size:0.88rem; margin:0;">
                    Complete custody audit log: OTP PIN verification, timestamps, donor vendor and recipient NGO.
                </p>
                <div style="font-size:0.82rem; color: #38bdf8; font-weight:700;">
                    ${adminCache.handovers.length} Total Chain-of-Custody Records
                </div>
            </div>
            <div class="admin-table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Food Item</th>
                            <th>Donor (Vendor)</th>
                            <th>Recipient (NGO)</th>
                            <th>Handover OTP</th>
                            <th>Custody Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        adminCache.handovers.forEach(h => {
            const isCompleted = (h.status === 'completed');
            const statusHtml = isCompleted
                ? `<span style="color:#10b981; font-weight:700; font-size:0.8rem; background:rgba(16,185,129,0.12); padding:4px 10px; border-radius:100px; display:inline-flex; align-items:center; gap:5px;"><i class="fa-solid fa-circle-check"></i> Verified Pickup</span>`
                : `<span style="color:#f59e0b; font-weight:700; font-size:0.8rem; background:rgba(245,158,11,0.12); padding:4px 10px; border-radius:100px; display:inline-flex; align-items:center; gap:5px;"><i class="fa-solid fa-clock"></i> In Transit (Awaiting PIN)</span>`;

            html += `
                <tr>
                    <td>
                        <div style="font-weight:700; color:#fff; font-family:monospace;">#ORD-${h.id}</div>
                        <div style="font-size:0.72rem; color:rgba(255,255,255,0.4);">${h.createdAt ? new Date(h.createdAt).toLocaleDateString() : ''}</div>
                    </td>
                    <td>
                        <div style="font-weight:600; color:#fff;">${h.foodName || 'Surplus Meal Package'}</div>
                        <div style="font-size:0.75rem; color:#10b981;">Qty: ${h.quantity || 1} portions</div>
                    </td>
                    <td>
                        <div style="font-weight:600; color:#e5e5e5;">${h.sellerName || 'Vendor Partner'}</div>
                        ${h.sellerFssai ? `<div style="font-size:0.72rem; color:rgba(255,255,255,0.4); font-family:monospace;">FSSAI: ${h.sellerFssai}</div>` : ''}
                    </td>
                    <td>
                        <div style="font-weight:600; color:#38bdf8;">${h.buyerName || 'Community Partner'}</div>
                        ${h.buyerDarpan ? `<div style="font-size:0.72rem; color:rgba(255,255,255,0.4); font-family:monospace;">DARPAN: ${h.buyerDarpan}</div>` : ''}
                    </td>
                    <td>
                        <span style="font-family:monospace; font-weight:800; font-size:0.9rem; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); padding:3px 8px; border-radius:6px; color:#fbbf24; letter-spacing:1px;">
                            ${h.handoverOtp || '----'}
                        </span>
                    </td>
                    <td>${statusHtml}</td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;
        container.innerHTML = html;
    }

    function renderAdminUsersTable() {
        const container = document.getElementById('admin-view-users');
        if (!container) return;

        if (!adminCache.users.length) {
            container.innerHTML = `<div style="text-align:center; padding: 3rem; color: rgba(255,255,255,0.4);"><i class="fa-solid fa-users" style="font-size:2rem; margin-bottom:1rem; display:block;"></i>No users registered yet.</div>`;
            return;
        }

        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:12px;">
                <div>
                    <p style="color:rgba(255,255,255,0.7); font-size:0.88rem; margin:0;">
                        Master directory of registered organization leads, account credentials, and platform roles.
                    </p>
                    <div style="font-size:0.82rem; color: #10b981; font-weight:700; margin-top:3px;">
                        ${adminCache.users.length} Total Users (${adminCache.users.filter(u => u.role === 'admin').length} Administrators)
                    </div>
                </div>
                <button onclick="document.getElementById('adminAddModal')?.classList.add('active')" class="admin-action-btn" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1.5px solid rgba(16, 185, 129, 0.35); font-weight: 700; display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px;">
                    <i class="fa-solid fa-user-plus"></i> Add New Admin
                </button>
            </div>
            <div class="admin-table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>User / Org</th>
                            <th>Role / Permission</th>
                            <th>Email Address</th>
                            <th>Contact Phone</th>
                            <th>Accreditation</th>
                            <th>Verification</th>
                            <th style="text-align:right;">Admin Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        adminCache.users.forEach(u => {
            const isAdmin = u.role === 'admin';
            const isSeller = ['restaurant', 'vendor', 'seller'].includes((u.accountType || '').toLowerCase());
            
            let roleBadge = '';
            if (isAdmin) {
                roleBadge = `<span style="background:rgba(245,158,11,0.15); color:#fbbf24; padding:3px 8px; border-radius:6px; font-weight:800; font-size:0.75rem;"><i class="fa-solid fa-shield-halved"></i> Admin</span>`;
            } else if (isSeller) {
                roleBadge = `<span style="background:rgba(16,185,129,0.15); color:#34d399; padding:3px 8px; border-radius:6px; font-weight:700; font-size:0.75rem;"><i class="fa-solid fa-shop"></i> Vendor</span>`;
            } else {
                roleBadge = `<span style="background:rgba(56,189,248,0.15); color:#38bdf8; padding:3px 8px; border-radius:6px; font-weight:700; font-size:0.75rem;"><i class="fa-solid fa-hands-holding-child"></i> NGO</span>`;
            }

            const accreditation = u.fssaiCode 
                ? `<span style="font-family:monospace; font-size:0.78rem; color:#34d399;">FSSAI: ${u.fssaiCode}</span>` 
                : (u.darpanId ? `<span style="font-family:monospace; font-size:0.78rem; color:#38bdf8;">DARPAN: ${u.darpanId}</span>` : `<span style="color:rgba(255,255,255,0.3); font-size:0.75rem;">None</span>`);

            html += `
                <tr>
                    <td>
                        <div style="font-weight:700; color:#fff;">${u.organizationName || 'Unnamed User'}</div>
                        <div style="font-size:0.72rem; color:rgba(255,255,255,0.4);">User ID: #${u.id}</div>
                    </td>
                    <td>${roleBadge}</td>
                    <td style="color:rgba(255,255,255,0.8);">${u.email}</td>
                    <td style="color:rgba(255,255,255,0.7);">${u.phone || '—'}</td>
                    <td>${accreditation}</td>
                    <td>
                        ${u.isVerified 
                            ? `<span style="color:#10b981; font-weight:700; font-size:0.78rem;"><i class="fa-solid fa-circle-check"></i> Verified</span>` 
                            : `<span style="color:#f59e0b; font-weight:700; font-size:0.78rem;"><i class="fa-solid fa-clock"></i> Unverified</span>`}
                    </td>
                    <td style="text-align:right; white-space:nowrap;">
                        <button onclick="window.adminInspectUserPortal(${u.id})" class="admin-action-btn" style="background:rgba(56,189,248,0.12); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); margin-right:6px; font-size:0.75rem; padding:5px 10px;" title="Inspect User Dashboard">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> Open Portal
                        </button>
                        ${u.email === 'tharunchokkanc@gmail.com' ? `
                            <span style="font-size:0.75rem; color:#10b981; font-weight:800; background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.3); padding:4px 10px; border-radius:8px;">
                                <i class="fa-solid fa-crown"></i> Super Admin
                            </span>
                        ` : `
                            ${isAdmin ? `
                                <button onclick="window.adminToggleRole(${u.id}, 'user')" class="admin-action-btn" style="background:rgba(245,158,11,0.12); color:#fbbf24; border:1px solid rgba(245,158,11,0.3); margin-right:6px; font-size:0.75rem; padding:5px 10px;" title="Revoke Admin Privileges">
                                    <i class="fa-solid fa-user-minus"></i> Revoke Admin
                                </button>
                            ` : `
                                <button onclick="window.adminToggleRole(${u.id}, 'admin')" class="admin-action-btn" style="background:rgba(16,185,129,0.12); color:#34d399; border:1px solid rgba(16,185,129,0.3); margin-right:6px; font-size:0.75rem; padding:5px 10px;" title="Promote to Administrator">
                                    <i class="fa-solid fa-user-shield"></i> Make Admin
                                </button>
                                <button onclick="window.adminToggleVerify(${u.id}, ${!u.isVerified})" class="admin-action-btn ${u.isVerified ? 'delete' : 'verify'}" style="margin-right:6px;" title="${u.isVerified ? 'Revoke verification' : 'Approve verification'}">
                                    ${u.isVerified ? '<i class="fa-solid fa-ban"></i>' : '<i class="fa-solid fa-check"></i>'}
                                </button>
                            `}
                            <button onclick="window.adminDeleteUser(${u.id})" class="admin-action-btn delete" title="Delete user">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        `}
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;
        container.innerHTML = html;
    }

    function animateKpiValue(elementId, newValue, animate = true) {
        const el = document.getElementById(elementId);
        if (!el) return;
        const currentVal = el.textContent.trim();
        if (currentVal === String(newValue).trim()) return;

        if (animate && currentVal !== '--') {
            const card = el.closest('.admin-kpi-card');
            if (card) {
                card.classList.remove('kpi-card-live-pulse');
                void card.offsetWidth;
                card.classList.add('kpi-card-live-pulse');
                setTimeout(() => card.classList.remove('kpi-card-live-pulse'), 700);
            }
            el.style.transition = 'transform 0.18s ease, color 0.18s ease';
            el.style.transform = 'scale(1.18)';
            el.style.color = '#34d399';
            setTimeout(() => {
                el.textContent = newValue;
                el.style.transform = 'scale(1)';
                el.style.color = '#ffffff';
            }, 180);
        } else {
            el.textContent = newValue;
        }
    }

    function updateAdminKpiMetrics(animate = true) {
        const users = adminCache.users || [];
        const dbListings = adminCache.listings || [];
        const stateListings = state.listings || [];
        const handovers = adminCache.handovers || [];

        // 1. Verified Partners (NGOs and Food Vendors with isVerified = 1)
        const verifiedPartnersCount = users.filter(u => u.isVerified && u.role !== 'admin').length;
        const completedHandoversCount = handovers.filter(h => h.status === 'completed').length;
        const pendingHandoversCount = handovers.filter(h => h.status !== 'completed').length;

        // 2. Active Surplus Listings
        const allListings = dbListings.length > 0 ? dbListings : stateListings;
        const activeListingsCount = Math.max(
            allListings.filter(l => l.status !== 'claimed' && l.status !== 'sold').length,
            (adminCache.stats && adminCache.stats.activeListings) || 0
        );
        const totalListingsCount = Math.max(
            allListings.length,
            (adminCache.stats && adminCache.stats.totalListings) || 0
        );

        // 3. Meals Rescued: sum portions from listings + handovers + accreditation verified impact factor
        let portionsFromListings = 0;
        allListings.forEach(l => { portionsFromListings += (parseFloat(l.quantity != null ? l.quantity : l.qty) || 0); });
        let portionsFromOrders = 0;
        handovers.forEach(h => { if (h.status === 'completed') portionsFromOrders += (parseFloat(h.quantity || h.qty) || 0); });

        const totalMealsRescued = Math.max(120, Math.round(portionsFromListings + portionsFromOrders + (verifiedPartnersCount * 20)));
        const co2SavedKg = Math.round(totalMealsRescued * 2.5);

        // Box 1: Meals Rescued
        animateKpiValue('kpi-meals', totalMealsRescued.toLocaleString(), animate);
        const elMealsSub = document.getElementById('kpi-meals-sub');
        if (elMealsSub) elMealsSub.textContent = `${completedHandoversCount} handovers fulfilled • ${totalMealsRescued} portions allocated`;

        // Box 2: Surplus Listings
        animateKpiValue('kpi-listings', `${activeListingsCount} / ${totalListingsCount}`, animate);
        const elListingsSub = document.getElementById('kpi-listings-sub');
        if (elListingsSub) elListingsSub.textContent = `${activeListingsCount} live surplus listings across network`;

        // Box 3: Verified Pickups & Partners
        const totalVerifiedTrust = verifiedPartnersCount + completedHandoversCount;
        animateKpiValue('kpi-handovers', totalVerifiedTrust.toLocaleString(), animate);
        const elHandoversSub = document.getElementById('kpi-handovers-sub');
        if (elHandoversSub) elHandoversSub.textContent = `${verifiedPartnersCount} accredited partners • ${completedHandoversCount} pickups`;

        // Box 4: CO2 Offset
        animateKpiValue('kpi-co2', `${co2SavedKg.toLocaleString()} kg`, animate);
    }

    let adminLivePollInterval = null;
    function startAdminLivePolling() {
        stopAdminLivePolling();
        adminLivePollInterval = setInterval(async () => {
            if (state.activePortal === 'admin') {
                await fetchAndRenderAdminData(false);
            } else {
                stopAdminLivePolling();
            }
        }, 8000);
    }

    function stopAdminLivePolling() {
        if (adminLivePollInterval) {
            clearInterval(adminLivePollInterval);
            adminLivePollInterval = null;
        }
    }

    async function fetchAndRenderAdminData(forceRefresh = false) {
        try {
            const token = sessionStorage.getItem('nourishToken') || '';
            const authHeaders = {
                'Authorization': `Bearer ${token}`
            };

            const [statsData, usersData, listingsData, handoversData] = await Promise.all([
                fetch(`${API_BASE}/admin/stats?_t=${Date.now()}`, { headers: authHeaders }).then(r => r.json()).catch(() => ({ stats: {} })),
                fetch(`${API_BASE}/admin/users?_t=${Date.now()}`, { headers: authHeaders }).then(r => r.json()).catch(() => ({ users: [] })),
                fetch(`${API_BASE}/admin/listings?_t=${Date.now()}`, { headers: authHeaders }).then(r => r.json()).catch(() => ({ listings: [] })),
                fetch(`${API_BASE}/admin/handovers?_t=${Date.now()}`, { headers: authHeaders }).then(r => r.json()).catch(() => ({ handovers: [] }))
            ]);

            adminCache.stats = (statsData && statsData.stats) || {};
            adminCache.users = (usersData && usersData.users) || [];
            adminCache.listings = (listingsData && listingsData.listings) || [];
            adminCache.handovers = (handoversData && handoversData.handovers) || [];

            // Populate Master KPI metric cards with live animated impact
            updateAdminKpiMetrics(forceRefresh);

            // Update badge counts and render subtab tables
            updateAdminBadgeCounts();
            renderAdminComplianceTable();
            renderAdminListingsTable();
            renderAdminHandoversTable();
            renderAdminUsersTable();
        } catch (err) {
            console.error("Failed to load admin data:", err);
            showToast("Failed to load platform data.", "error");
        }
    }

    async function renderAdminPortal() {
        if (!checkIsAdminUser()) {
            showToast("Access Denied: Administrator authentication required.", "error");
            state.activePortal = 'home';
            renderPortal();
            if (authModal) authModal.classList.add('active');
            return;
        }

        const root = portalsRoot || document.getElementById('nn-portals-root');
        if (!root) return;

        root.innerHTML = `
            <div class="portal-wrapper admin-portal-wrapper animate-reveal" style="padding-top: 90px; min-height: 100vh; background: #0a0a0a;">
                <div class="container" style="max-width: 1300px; margin: 0 auto; padding: 1.5rem 2rem 4rem;">
                    <!-- Top Header -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1.25rem; margin-bottom: 2rem;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                                <span class="admin-badge-pill"><i class="fa-solid fa-shield-halved"></i> Nourish HQ Operations</span>
                                <span style="font-size: 0.72rem; color: #10b981; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); padding: 3px 8px; border-radius: 100px; font-weight: 700;">● Active Command Cluster</span>
                            </div>
                            <h1 style="font-size: 2rem; font-weight: 800; letter-spacing: -0.02em; margin: 0; color: #ffffff;">
                                Operations & Compliance Command Center
                            </h1>
                            <p style="color: rgba(255, 255, 255, 0.6); font-size: 0.95rem; margin: 6px 0 0;">
                                Unified platform governance, FSSAI / DARPAN credential verification, real-time donation moderation, and physical handover audit logs.
                            </p>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <button onclick="window.adminRefreshData && window.adminRefreshData()" class="admin-action-btn" style="background: rgba(255,255,255,0.06); color: #fff; border: 1px solid rgba(255,255,255,0.15);">
                                <i class="fa-solid fa-rotate"></i> Refresh
                            </button>
                            <button onclick="window.adminSwitchPortal && window.adminSwitchPortal('seller')" class="admin-action-btn" style="background: rgba(16,185,129,0.12); color: #34d399; border: 1px solid rgba(16,185,129,0.3);">
                                <i class="fa-solid fa-shop"></i> Vendor Portal
                            </button>
                            <button onclick="window.adminSwitchPortal && window.adminSwitchPortal('buyer')" class="admin-action-btn" style="background: rgba(56,189,248,0.12); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3);">
                                <i class="fa-solid fa-hands-holding-child"></i> NGO Portal
                            </button>
                        </div>
                    </div>

                    <!-- Master KPI Analytics Cards -->
                    <div id="admin-kpi-container" class="admin-kpi-grid">
                        <div class="admin-kpi-card">
                            <div class="admin-kpi-icon" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">
                                <i class="fa-solid fa-bowl-food"></i>
                            </div>
                            <div>
                                <div style="font-size: 1.75rem; font-weight: 800; color: #ffffff;" id="kpi-meals">--</div>
                                <div style="font-size: 0.8rem; font-weight: 700; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.5px;">Meals Rescued</div>
                                <div style="font-size: 0.75rem; color: #10b981; margin-top: 2px;" id="kpi-meals-sub">Portions allocated</div>
                            </div>
                        </div>

                        <div class="admin-kpi-card">
                            <div class="admin-kpi-icon" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24;">
                                <i class="fa-solid fa-box-open"></i>
                            </div>
                            <div>
                                <div style="font-size: 1.75rem; font-weight: 800; color: #ffffff;" id="kpi-listings">--</div>
                                <div style="font-size: 0.8rem; font-weight: 700; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.5px;">Surplus Listings</div>
                                <div style="font-size: 0.75rem; color: #fbbf24; margin-top: 2px;" id="kpi-listings-sub">Live across network</div>
                            </div>
                        </div>

                        <div class="admin-kpi-card">
                            <div class="admin-kpi-icon" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8;">
                                <i class="fa-solid fa-shield-halved"></i>
                            </div>
                            <div>
                                <div style="font-size: 1.75rem; font-weight: 800; color: #ffffff;" id="kpi-handovers">--</div>
                                <div style="font-size: 0.8rem; font-weight: 700; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.5px;">Verified Pickups & Partners</div>
                                <div style="font-size: 0.75rem; color: #38bdf8; margin-top: 2px;" id="kpi-handovers-sub">Accredited partners • pickups</div>
                            </div>
                        </div>

                        <div class="admin-kpi-card">
                            <div class="admin-kpi-icon" style="background: rgba(168, 85, 247, 0.15); color: #c084fc;">
                                <i class="fa-solid fa-earth-americas"></i>
                            </div>
                            <div>
                                <div style="font-size: 1.75rem; font-weight: 800; color: #ffffff;" id="kpi-co2">--</div>
                                <div style="font-size: 0.8rem; font-weight: 700; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.5px;">CO₂ Offset</div>
                                <div style="font-size: 0.75rem; color: #c084fc; margin-top: 2px;">Greenhouse emissions saved</div>
                            </div>
                        </div>
                    </div>

                    <!-- Subtabs Navigation -->
                    <div class="admin-tabs-nav">
                        <button class="admin-tab-btn active" id="adm-tab-btn-compliance" onclick="window.adminSwitchTab && window.adminSwitchTab('compliance')">
                            <i class="fa-solid fa-id-card"></i> Compliance & Accreditation Queue
                            <span class="admin-count-pill" id="adm-badge-compliance">0</span>
                        </button>
                        <button class="admin-tab-btn" id="adm-tab-btn-listings" onclick="window.adminSwitchTab && window.adminSwitchTab('listings')">
                            <i class="fa-solid fa-utensils"></i> Food Donation Moderation
                            <span class="admin-count-pill" id="adm-badge-listings">0</span>
                        </button>
                        <button class="admin-tab-btn" id="adm-tab-btn-handovers" onclick="window.adminSwitchTab && window.adminSwitchTab('handovers')">
                            <i class="fa-solid fa-handshake-angle"></i> Handover Audit Trail
                            <span class="admin-count-pill" id="adm-badge-handovers">0</span>
                        </button>
                        <button class="admin-tab-btn" id="adm-tab-btn-users" onclick="window.adminSwitchTab && window.adminSwitchTab('users')">
                            <i class="fa-solid fa-users-gear"></i> Master User Directory
                            <span class="admin-count-pill" id="adm-badge-users">0</span>
                        </button>
                    </div>

                    <!-- Views Container -->
                    <div id="admin-view-compliance" class="admin-tab-view" style="display: block;">
                        <div style="text-align:center; padding: 2.5rem; color: rgba(255,255,255,0.4);"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading compliance data...</div>
                    </div>
                    <div id="admin-view-listings" class="admin-tab-view" style="display: none;">
                        <div style="text-align:center; padding: 2.5rem; color: rgba(255,255,255,0.4);"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading listings...</div>
                    </div>
                    <div id="admin-view-handovers" class="admin-tab-view" style="display: none;">
                        <div style="text-align:center; padding: 2.5rem; color: rgba(255,255,255,0.4);"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading handovers...</div>
                    </div>
                    <div id="admin-view-users" class="admin-tab-view" style="display: none;">
                        <div style="text-align:center; padding: 2.5rem; color: rgba(255,255,255,0.4);"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading user directory...</div>
                    </div>
                </div>
            </div>
        `;

        await fetchAndRenderAdminData(true);
        startAdminLivePolling();
    }

    function renderExchangeGrid() {
        const grid = document.getElementById('exchange-grid');
        if (!grid) return;

        // Check if currently logged in user is a seller account
        const user = JSON.parse(sessionStorage.getItem('nourishUser') || localStorage.getItem('nourishUser') || '{}');
        const role = (user.accountType || user.type || user.role || '').toLowerCase();
        const isSellerAcc = role.includes('restaurant') || role.includes('vendor') || role.includes('seller') || state.activePortal === 'seller';

        // Preserve in-progress stepper selections across data syncs
        const currentStepperVals = {};
        grid.querySelectorAll('.nn-food-card').forEach(card => {
            const id = card.dataset.id;
            const span = card.querySelector('.stepper-val');
            if (id && span) {
                const parsed = parseInt(span.textContent || span.innerText, 10);
                if (!isNaN(parsed)) {
                    currentStepperVals[id] = parsed;
                }
            }
        });
        const isInitialMount = grid.children.length === 0;

        // Filter out expired items, sold-out items, or garbage demo items for the buyer view
        const validListings = state.listings.filter(item => {
            if (item.name === 'lp.okijuh' || item.name === 'lp,okijuh' || item.name === 'wesrdtfgybh') return false;
            if (item.status === 'sold' || item.status === 'claimed') return false;

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

            // In seller account, initial quantity starts at 0! For buyers/guests, default is 1.
            const defaultInitialQty = isSellerAcc ? 0 : 1;
            const savedVal = (currentStepperVals[item.id] !== undefined && !isNaN(currentStepperVals[item.id]))
                ? currentStepperVals[item.id]
                : defaultInitialQty;
            const minQty = isSellerAcc ? 0 : 1;
            const stepperVal = isAllInBasket ? 0 : Math.max(minQty, Math.min(savedVal, remainingLive));

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
        const user = JSON.parse(sessionStorage.getItem('nourishUser') || localStorage.getItem('nourishUser') || '{}');
        const role = (user.accountType || user.type || user.role || '').toLowerCase();
        const isSellerAcc = role.includes('restaurant') || role.includes('vendor') || role.includes('seller') || state.activePortal === 'seller';
        const minAllowed = isSellerAcc ? 0 : 1;

        document.querySelectorAll('.stepper-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const card = btn.closest('.nn-food-card');
                const id = btn.dataset.id || (card ? card.dataset.id : null);
                const span = card ? card.querySelector('.stepper-val') : document.getElementById(`stepper-${id}`);
                if (!span) return;

                const parsed = parseInt(span.textContent || span.innerText, 10);
                let val = isNaN(parsed) ? (isSellerAcc ? 0 : 1) : parsed;
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
                    if (val > minAllowed) {
                        val--;
                    }
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
                const qtyToAdd = span ? parseInt(span.textContent || span.innerText, 10) : 0;

                if (qtyToAdd <= 0) {
                    showToast("Please increase quantity to at least 1 portion.", "warning");
                    return;
                }

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
                if (!cartItem) return;
                if (cartItem.qty > 1) {
                    cartItem.qty--;
                } else {
                    state.cart.splice(idx, 1);
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
                if (!cartItem) return;
                const originalListing = state.listings.find(l => String(l.id) === String(cartItem.item.id));
                const totalStock = originalListing 
                    ? (parseInt(originalListing.quantity != null ? originalListing.quantity : originalListing.qty, 10) || 0)
                    : (parseInt(cartItem.item.quantity != null ? cartItem.item.quantity : cartItem.item.qty, 10) || cartItem.qty);

                if (cartItem.qty < totalStock) {
                    cartItem.qty++;
                    renderCartItems();
                    updateCartBadge();
                    renderExchangeGrid();
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
                const u = (checkIsAdminUser() && state.adminInspectedUser) ? state.adminInspectedUser : JSON.parse(sessionStorage.getItem('nourishUser') || '{}');
                if (document.getElementById('p-phone')) document.getElementById('p-phone').value = u.publicPhone || u.phone || '';
                if (document.getElementById('p-address')) document.getElementById('p-address').value = u.address || '';
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

                const sessionUser = JSON.parse(sessionStorage.getItem('nourishUser') || '{}');
                const isAdmin = checkIsAdminUser();
                let targetUser = sessionUser;
                if (isAdmin && state.adminInspectedUser) {
                    targetUser = state.adminInspectedUser;
                }

                const pPhoneInput = document.getElementById('p-phone');
                const pAddressInput = document.getElementById('p-address');
                const phoneVal = (pPhoneInput?.value || targetUser.publicPhone || targetUser.phone || '').trim();
                const addressVal = (pAddressInput?.value || targetUser.address || '').trim();

                const missingPhone = !phoneVal || phoneVal.replace(/[^0-9]/g, '').length < 6;
                const missingAddress = !addressVal || addressVal.length < 3;

                if (missingPhone && missingAddress) {
                    showToast("⚠️ Please enter your mobile number and pickup location to publish listing!", "error");
                    if (pPhoneInput) { pPhoneInput.focus(); pPhoneInput.style.borderColor = '#ef4444'; }
                    if (pAddressInput) { pAddressInput.style.borderColor = '#ef4444'; }
                    return;
                }
                if (missingPhone) {
                    showToast("⚠️ Please enter your mobile number to publish listing!", "error");
                    if (pPhoneInput) { pPhoneInput.focus(); pPhoneInput.style.borderColor = '#ef4444'; }
                    return;
                }
                if (missingAddress) {
                    showToast("⚠️ Please enter your pickup location to publish listing!", "error");
                    if (pAddressInput) { pAddressInput.focus(); pAddressInput.style.borderColor = '#ef4444'; }
                    return;
                }

                if (pPhoneInput) pPhoneInput.style.borderColor = '';
                if (pAddressInput) pAddressInput.style.borderColor = '';

                // Background sync seller phone and address if newly entered or changed
                if (token && (!targetUser.phone || !targetUser.address || targetUser.phone !== phoneVal || targetUser.address !== addressVal)) {
                    const updateEndpoint = (isAdmin && state.adminInspectedUser) ? `${API_BASE}/admin/users/${targetUser.id}` : `${API_BASE}/user/me`;
                    fetch(updateEndpoint, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ phone: phoneVal, publicPhone: phoneVal, address: addressVal })
                    }).then(r => r.json()).then(d => {
                        if (d && d.user) {
                            if (isAdmin && state.adminInspectedUser) {
                                state.adminInspectedUser = d.user;
                                sessionStorage.setItem('nn_admin_inspected_user', JSON.stringify(d.user));
                            } else {
                                sessionStorage.setItem('nourishUser', JSON.stringify(d.user));
                                localStorage.setItem('nourishUser', JSON.stringify(d.user));
                            }
                        }
                    }).catch(() => {});
                }

                const payload = {
                    name, category, quantity: parseInt(qty),
                    price: parseFloat(price), description,
                    phone: phoneVal,
                    address: addressVal,
                    imageUrl: customImg || getSmartFoodImage(name, category, null),
                    expiryTime: (expiry && window.isValidExpiry(expiry)) ? new Date(expiry).toISOString() : null,
                    vendorId: targetUser.id,
                    vendorName: targetUser.organizationName || targetUser.name,
                    vendorPhone: phoneVal,
                    vendorAddress: addressVal
                };

                // ---- DEMO MODE: bypass API for demo tokens ----
                const isDemoToken = token.startsWith('demo-token');
                if (isDemoToken) {
                    const user = targetUser;
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
                                vendorPhone: phoneVal,
                                vendorAddress: addressVal,
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
                            vendorPhone: phoneVal,
                            vendorAddress: addressVal,
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
                    if (pPhoneInput) pPhoneInput.value = phoneVal || targetUser.publicPhone || targetUser.phone || '';
                    if (pAddressInput) pAddressInput.value = addressVal || targetUser.address || '';
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
                        if (pPhoneInput) pPhoneInput.value = phoneVal || targetUser.publicPhone || targetUser.phone || '';
                        if (pAddressInput) pAddressInput.value = addressVal || targetUser.address || '';
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




    // 7. Initialize Everything


    const openCart = () => {
        if (cartDrawer) cartDrawer.classList.add('active');
        const buyerUser = JSON.parse(sessionStorage.getItem('nourishUser') || localStorage.getItem('nourishUser') || '{}');
        const phoneInput = document.getElementById('cart-buyer-phone');
        const addrInput = document.getElementById('cart-buyer-address');
        if (phoneInput && !phoneInput.value.trim()) {
            phoneInput.value = buyerUser.publicPhone || buyerUser.phone || '';
        }
        if (addrInput && !addrInput.value.trim()) {
            addrInput.value = buyerUser.address || '';
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
                    apiOrders = await res.json();
                }
            } catch (netErr) {
                console.warn("Orders fetch network fallback to local:", netErr);
            }

            // Retrieve locally tracked live orders and sanitize stale placeholder addresses
            let localOrders = [];
            try {
                localOrders = JSON.parse(localStorage.getItem('nn_local_orders') || '[]');
                let ordersModified = false;
                localOrders.forEach(o => {
                    if (o.sellerAddress && (o.sellerAddress.includes('Sterling Road') || o.sellerAddress.includes('donor kitchen'))) {
                        const matchedL = (state.listings || []).find(l => Number(l.id) === Number(o.listingId));
                        if (matchedL && (matchedL.vendorAddress || matchedL.address)) {
                            o.sellerAddress = matchedL.vendorAddress || matchedL.address;
                            ordersModified = true;
                        } else if (adminCache && adminCache.users) {
                            const v = adminCache.users.find(u => Number(u.id) === Number(o.vendorId || o.sellerId));
                            if (v && v.address) {
                                o.sellerAddress = v.address;
                                ordersModified = true;
                            }
                        }
                    }
                });
                if (ordersModified) {
                    localStorage.setItem('nn_local_orders', JSON.stringify(localOrders));
                }
            } catch (e) { localOrders = []; }

            const user = JSON.parse(sessionStorage.getItem('nourishUser') || localStorage.getItem('nourishUser') || '{}');
            const isSellerPortal = state.activePortal === 'seller';

            // Filter local orders relevant to the current user and portal
            const relevantLocalOrders = localOrders.filter(o => {
                if (isSellerPortal) {
                    return String(o.vendorId) === String(user.id) ||
                           String(o.sellerId) === String(user.id) ||
                           o.sellerName === user.organizationName ||
                           o.sellerEmail === user.email ||
                           String(user.id) === '888' ||
                           !o.vendorId;
                } else {
                    return String(o.buyerId) === String(user.id) ||
                           o.buyerName === user.organizationName ||
                           o.buyerEmail === user.email ||
                           String(user.id) === '999' ||
                           !o.buyerId;
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
                if (state.activePortal === 'seller') {
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
            if (state.activePortal === 'seller') {
                container.innerHTML = orders.map(o => {
                    const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    }) : 'Just now';
                    const isCompleted = o.orderStatus === 'completed';
                    const ngoBadge = window.renderNgoTrustBadge ? window.renderNgoTrustBadge({
                        darpanId: o.buyerDarpanId,
                        ngoRegType: o.buyerNgoRegType
                    }) : '';
                    const foodImg = o.imageUrl || (window.getSmartFoodImage ? window.getSmartFoodImage(o.foodName, o.category, null) : 'assets/default-food.jpg');

                    return `
                        <div class="history-card" id="order-card-${o.orderId}">
                            <div class="history-top-row">
                                <div class="history-item-info">
                                    <img src="${foodImg}" alt="${o.foodName || 'Food'}" class="history-food-thumb" onerror="this.onerror=null; this.src='assets/default-food.jpg';">
                                    <div>
                                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                            <h4 style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin: 0;">${o.foodName || 'Surplus Meal'}</h4>
                                            <span class="badge" style="background: rgba(255, 255, 255, 0.06); color: #d1d5db; border: 1px solid rgba(255, 255, 255, 0.1); font-size: 0.72rem; padding: 2px 8px; border-radius: 6px;">${o.category || 'Cooked'}</span>
                                        </div>
                                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
                                            <span style="font-weight: 700; color: var(--text-primary);">${o.quantity} ${o.unit || 'portions'}</span> · 
                                            <span>${o.totalPrice > 0 ? '₹' + o.totalPrice : '<strong style="color:#e5e5e5;">Free Surplus Donation</strong>'}</span> · 
                                            <span><i class="fa-regular fa-clock"></i> ${dateStr}</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <span class="history-status-badge ${isCompleted ? 'status-completed' : 'status-confirmed'}">
                                        <i class="fa-solid ${isCompleted ? 'fa-circle-check' : 'fa-hourglass-half'}"></i>
                                        ${isCompleted ? 'Picked Up / Completed' : 'Confirmed & Active'}
                                    </span>
                                </div>
                            </div>

                            <!-- Buyer NGO Details Box -->
                            <div class="history-party-box">
                                <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 240px;">
                                    <img src="${o.buyerAvatar || 'assets/default-avatar.jpg'}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 1.5px solid rgba(255, 255, 255, 0.15);">
                                    <div>
                                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                            <strong style="font-size: 0.95rem; color: var(--text-primary);">${o.buyerName || 'Accredited NGO Partner'}</strong>
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
                                    ${!isCompleted ? `
                                        <button class="btn-verify-handover-trigger" data-order-id="${o.orderId}" data-food-name="${encodeURIComponent(o.foodName || 'Surplus Meal')}" data-buyer-name="${encodeURIComponent(o.buyerName || 'NGO Partner')}" data-qty="${o.quantity} ${o.unit || 'portions'}">
                                            <i class="fa-solid fa-shield-halved"></i> Verify & Hand Over
                                        </button>
                                    ` : `
                                        <div class="handover-verified-badge" title="Physically verified at collection">
                                            <i class="fa-solid fa-circle-check"></i> Handover Verified
                                            ${o.handoverAt ? `<span style="font-size:0.75rem; opacity:0.8; font-weight:500;">(${new Date(o.handoverAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })})</span>` : ''}
                                        </div>
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
                    const foodImg = o.imageUrl || (window.getSmartFoodImage ? window.getSmartFoodImage(o.foodName, o.category, null) : 'assets/default-food.jpg');
                    const pin = o.handoverOtp || String(o.orderId).padStart(4, '0').slice(-4);

                    // Dynamically resolve true seller's address and info
                    const targetListing = (state.listings || []).find(l => Number(l.id) === Number(o.listingId));
                    let resolvedSellerAddr = o.sellerAddress || o.address || '';
                    if (!resolvedSellerAddr || resolvedSellerAddr.includes('Sterling Road') || resolvedSellerAddr.includes('donor kitchen')) {
                        if (targetListing && (targetListing.vendorAddress || targetListing.address)) {
                            resolvedSellerAddr = targetListing.vendorAddress || targetListing.address;
                        } else if (adminCache && adminCache.users) {
                            const vendorObj = adminCache.users.find(u => Number(u.id) === Number(o.vendorId || o.sellerId || (targetListing && targetListing.vendorId)));
                            if (vendorObj && vendorObj.address) resolvedSellerAddr = vendorObj.address;
                        }
                    }
                    if (!resolvedSellerAddr) resolvedSellerAddr = 'Location provided by donor kitchen';

                    let resolvedSellerName = o.sellerName;
                    if ((!resolvedSellerName || resolvedSellerName === 'Elite Catering Services') && targetListing && targetListing.vendorName) {
                        resolvedSellerName = targetListing.vendorName;
                    }
                    let resolvedSellerPhone = o.sellerPhone || (targetListing && targetListing.vendorPhone) || '';

                    return `
                        <div class="history-card" id="order-card-${o.orderId}">
                            <div class="history-top-row">
                                <div class="history-item-info">
                                    <img src="${foodImg}" alt="${o.foodName || 'Food'}" class="history-food-thumb" onerror="this.onerror=null; this.src='assets/default-food.jpg';">
                                    <div>
                                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                            <h4 style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin: 0;">${o.foodName || 'Rescued Food'}</h4>
                                            <span class="badge" style="background: rgba(255, 255, 255, 0.06); color: #d1d5db; border: 1px solid rgba(255, 255, 255, 0.1); font-size: 0.72rem; padding: 2px 8px; border-radius: 6px;">${o.category || 'Cooked'}</span>
                                        </div>
                                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
                                            <span style="font-weight: 700; color: var(--text-primary);">${o.quantity} portions</span> · 
                                            <span>${o.totalPrice > 0 ? '₹' + o.totalPrice : '<strong style="color:#e5e5e5;">Free Surplus Donation</strong>'}</span> · 
                                            <span><i class="fa-regular fa-clock"></i> ${dateStr}</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <span class="history-status-badge ${isCompleted ? 'status-completed' : 'status-confirmed'}">
                                        <i class="fa-solid ${isCompleted ? 'fa-circle-check' : 'fa-box'}"></i>
                                        ${isCompleted ? 'Picked Up & Verified' : 'Ready for Pickup'}
                                    </span>
                                </div>
                            </div>

                            <!-- Donating Restaurant Details Box -->
                            <div class="history-party-box">
                                <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 240px;">
                                    <img src="${o.sellerAvatar || 'assets/default-avatar.jpg'}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 1.5px solid rgba(255, 255, 255, 0.15);">
                                    <div>
                                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                            <strong style="font-size: 0.95rem; color: var(--text-primary);">${resolvedSellerName || 'Donor Restaurant / Kitchen'}</strong>
                                            ${o.sellerFssaiCode ? `<span class="fssai-trust-badge" title="FSSAI Verified Food Establishment"><i class="fa-solid fa-shield-halved"></i> FSSAI Certified</span>` : ''}
                                        </div>
                                        <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 3px;">
                                            ${o.sellerContactPerson ? `<span><i class="fa-solid fa-user-tie" style="color:#9ca3af;"></i> ${o.sellerContactPerson}</span> · ` : ''}
                                            ${resolvedSellerPhone ? `<a href="tel:${resolvedSellerPhone}" style="color:#d1d5db; text-decoration: none;"><i class="fa-solid fa-phone"></i> ${resolvedSellerPhone}</a>` : ''}
                                        </div>
                                        ${resolvedSellerAddr ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;"><i class="fa-solid fa-location-dot" style="color:#9ca3af;"></i> Pickup: ${resolvedSellerAddr}</div>` : ''}
                                        ${o.sellerPickupWindow ? `<div style="font-size: 0.8rem; color: #9ca3af; margin-top: 2px;"><i class="fa-regular fa-clock"></i> Pickup Window: ${o.sellerPickupWindow}</div>` : ''}
                                    </div>
                                </div>

                                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                    ${!isCompleted ? `
                                        <div class="handover-pass-box">
                                            <div>
                                                <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px; color: rgba(255, 255, 255, 0.6); margin-bottom: 2px;">
                                                    Pickup Security PIN
                                                </div>
                                                <div class="handover-pass-digits">
                                                    <i class="fa-solid fa-key" style="font-size: 0.85rem; color: #10b981;"></i>
                                                    <span>${pin}</span>
                                                </div>
                                            </div>
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <button class="btn-open-qr-pass" data-pin="${pin}" data-order-id="${o.orderId}" data-listing-id="${o.listingId || ''}" data-vendor-id="${o.vendorId || o.sellerId || ''}" data-food-name="${encodeURIComponent(o.foodName || 'Surplus Meal')}" data-qty="${o.quantity} portions" data-seller-name="${encodeURIComponent(resolvedSellerName || 'Donor Kitchen')}" data-seller-address="${encodeURIComponent(resolvedSellerAddr || '')}" data-seller-phone="${encodeURIComponent(resolvedSellerPhone || '')}">
                                                    <i class="fa-solid fa-qrcode"></i> Show QR
                                                </button>
                                                <button class="btn-whatsapp-dispatch" data-pin="${pin}" data-order-id="${o.orderId}" data-listing-id="${o.listingId || ''}" data-vendor-id="${o.vendorId || o.sellerId || ''}" data-food-name="${encodeURIComponent(o.foodName || 'Surplus Meal')}" data-qty="${o.quantity} portions" data-seller-name="${encodeURIComponent(resolvedSellerName || 'Donor Kitchen')}" data-seller-address="${encodeURIComponent(resolvedSellerAddr || '')}" data-seller-phone="${encodeURIComponent(resolvedSellerPhone || '')}" title="Dispatch Pickup Pass to Driver via WhatsApp">
                                                    <i class="fa-brands fa-whatsapp"></i> Share
                                                </button>
                                            </div>
                                        </div>
                                    ` : `
                                        <div class="handover-verified-badge" title="Successfully received and verified">
                                            <i class="fa-solid fa-circle-check"></i> Food Received & Verified
                                        </div>
                                    `}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            // Attach action handlers for Physical Handover Verification (Seller)
            container.querySelectorAll('.btn-verify-handover-trigger').forEach(btn => {
                btn.addEventListener('click', () => {
                    const orderId = btn.dataset.orderId;
                    const foodName = decodeURIComponent(btn.dataset.foodName || 'Surplus Meal');
                    const buyerName = decodeURIComponent(btn.dataset.buyerName || 'NGO Partner');
                    const qty = btn.dataset.qty || '';
                    openHandoverVerifyModal(orderId, foodName, buyerName, qty);
                });
            });

            // Attach action handlers for Pickup QR Pass (Buyer)
            container.querySelectorAll('.btn-open-qr-pass').forEach(btn => {
                btn.addEventListener('click', () => {
                    const orderId = btn.dataset.orderId;
                    const pin = btn.dataset.pin;
                    const foodName = decodeURIComponent(btn.dataset.foodName || 'Surplus Meal');
                    const meta = {
                        orderId: btn.dataset.orderId,
                        listingId: btn.dataset.listingId,
                        vendorId: btn.dataset.vendorId,
                        sellerId: btn.dataset.vendorId,
                        qty: btn.dataset.qty || '',
                        sellerName: decodeURIComponent(btn.dataset.sellerName || 'Donor Kitchen'),
                        sellerAddress: decodeURIComponent(btn.dataset.sellerAddress || ''),
                        sellerPhone: decodeURIComponent(btn.dataset.sellerPhone || '')
                    };
                    openHandoverQrModal(orderId, foodName, pin, meta);
                });
            });

            // Attach action handlers for Direct WhatsApp Driver Dispatch (Buyer)
            container.querySelectorAll('.btn-whatsapp-dispatch').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const orderInfo = {
                        orderId: btn.dataset.orderId,
                        listingId: btn.dataset.listingId,
                        vendorId: btn.dataset.vendorId,
                        sellerId: btn.dataset.vendorId,
                        foodName: decodeURIComponent(btn.dataset.foodName || 'Surplus Meal'),
                        pin: btn.dataset.pin,
                        qty: btn.dataset.qty || '',
                        sellerName: decodeURIComponent(btn.dataset.sellerName || 'Donor Kitchen'),
                        sellerAddress: decodeURIComponent(btn.dataset.sellerAddress || ''),
                        sellerPhone: decodeURIComponent(btn.dataset.sellerPhone || '')
                    };
                    dispatchWhatsAppPass(orderInfo);
                });
            });

            // Initialize global modal event bindings once
            initHandoverVerificationModalEvents();

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

    // ─── PHYSICAL HANDOVER VERIFICATION & QR PASS CONTROLLERS ────────────────
    function closeHandoverVerifyModal() {
        const modal = document.getElementById('handoverVerifyModal');
        if (modal) modal.style.display = 'none';
    }
    window.closeHandoverVerifyModal = closeHandoverVerifyModal;

    function closeHandoverQrModal() {
        const modal = document.getElementById('handoverQrModal');
        if (modal) modal.style.display = 'none';
    }
    window.closeHandoverQrModal = closeHandoverQrModal;

    function openHandoverVerifyModal(orderId, foodName, buyerName, qty, prefilledPin = '') {
        const modal = document.getElementById('handoverVerifyModal');
        if (!modal) return;
        modal.dataset.orderId = orderId;

        if (typeof initHandoverVerificationModalEvents === 'function') {
            initHandoverVerificationModalEvents();
        }

        const foodEl = document.getElementById('verifyModalFoodName');
        const buyerEl = document.getElementById('verifyModalBuyerName');
        const qtyEl = document.getElementById('verifyModalQty');
        const errorEl = document.getElementById('verifyModalError');

        if (foodEl) foodEl.textContent = foodName || 'Surplus Meal';
        if (buyerEl) buyerEl.textContent = buyerName || 'NGO Partner';
        if (qtyEl) qtyEl.textContent = qty || '';
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }

        const digitInputs = modal.querySelectorAll('.handover-digit-box');
        if (prefilledPin && prefilledPin.length === 4) {
            prefilledPin.split('').forEach((d, i) => {
                if (digitInputs[i]) digitInputs[i].value = d;
            });
        } else {
            digitInputs.forEach(input => {
                input.value = '';
                input.disabled = false;
            });
        }

        const confirmBtn = document.getElementById('btnConfirmHandover');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="fa-solid fa-check-double"></i>&nbsp; Verify & Complete Handover';
        }

        modal.style.display = 'flex';
        if (digitInputs.length > 0 && !prefilledPin) {
            setTimeout(() => digitInputs[0].focus(), 60);
        }
    }
    window.openHandoverVerifyModal = openHandoverVerifyModal;

    function openHandoverQrModal(orderId, foodName, pin, meta = {}) {
        const modal = document.getElementById('handoverQrModal');
        if (!modal) return;
        modal._currentPassOrder = { orderId, foodName, pin, ...meta };

        const titleEl = document.getElementById('qrModalFoodTitle');
        const digitsEl = document.getElementById('qrModalDigits');
        const imgEl = document.getElementById('handoverQrImg');

        if (titleEl) titleEl.textContent = `${foodName} · Order #${orderId}`;
        if (digitsEl) digitsEl.textContent = pin || '----';
        if (imgEl) {
            // Encode direct 1-tap verification action URL into the QR code
            const baseUrl = window.location.origin;
            const verifyLink = `${baseUrl}/?action=verify-handover&orderId=${encodeURIComponent(orderId)}&pin=${encodeURIComponent(pin)}`;
            const qrPayload = encodeURIComponent(verifyLink);
            imgEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=6&data=${qrPayload}`;
        }

        modal.style.display = 'flex';
    }
    window.openHandoverQrModal = openHandoverQrModal;

    // ─── IN-APP CAMERA QR SCANNER (HTML5-QRCODE) ────────────────────────────
    let html5QrScannerInstance = null;

    function startCameraScanner() {
        const modal = document.getElementById('qrCameraScannerModal');
        if (!modal) return;
        modal.style.display = 'flex';

        if (typeof Html5Qrcode === 'undefined') {
            showToast("Scanner library is initializing... please wait a moment.", "info");
            return;
        }

        try {
            if (html5QrScannerInstance) {
                html5QrScannerInstance.stop().catch(() => {}).finally(() => {
                    html5QrScannerInstance = null;
                });
            }

            html5QrScannerInstance = new Html5Qrcode("qrReaderContainer");
            const config = { fps: 15, qrbox: { width: 240, height: 240 } };

            html5QrScannerInstance.start(
                { facingMode: "environment" },
                config,
                (decodedText) => {
                    handleScannedQrData(decodedText);
                },
                () => {}
            ).catch(err => {
                console.warn("Camera start warning:", err);
                showToast("Camera access was not granted. Please enter the 4-digit PIN manually.", "error");
            });
        } catch (e) {
            console.error("Camera init error:", e);
        }
    }
    window.startCameraScanner = startCameraScanner;

    function stopCameraScanner() {
        const modal = document.getElementById('qrCameraScannerModal');
        if (modal) modal.style.display = 'none';

        if (html5QrScannerInstance) {
            html5QrScannerInstance.stop().then(() => {
                html5QrScannerInstance.clear();
                html5QrScannerInstance = null;
            }).catch(() => {
                html5QrScannerInstance = null;
            });
        }
    }
    window.stopCameraScanner = stopCameraScanner;

    function handleScannedQrData(decodedText) {
        if (!decodedText) return;
        let orderId = null;
        let pin = null;

        if (decodedText.includes('action=verify-handover')) {
            try {
                const parsed = new URL(decodedText, window.location.origin);
                orderId = parsed.searchParams.get('orderId');
                pin = parsed.searchParams.get('pin');
            } catch (e) {}
        } else if (decodedText.includes('ORDER:') && decodedText.includes('PIN:')) {
            const mOrder = decodedText.match(/ORDER:([A-Za-z0-9_-]+)/);
            const mPin = decodedText.match(/PIN:(\d{4})/);
            if (mOrder) orderId = mOrder[1];
            if (mPin) pin = mPin[1];
        }

        if (orderId && pin) {
            stopCameraScanner();
            openHandoverVerifyModal(orderId, `Order #${orderId}`, 'NGO Partner', '');
            const verifyModal = document.getElementById('handoverVerifyModal');
            if (verifyModal) {
                const digitBoxes = Array.from(verifyModal.querySelectorAll('.handover-digit-box'));
                pin.split('').forEach((d, i) => { if (digitBoxes[i]) digitBoxes[i].value = d; });
                showToast(`QR Code Scanned! Verifying Order #${orderId}...`, "success");
                const confirmBtn = document.getElementById('btnConfirmHandover');
                if (confirmBtn) setTimeout(() => confirmBtn.click(), 300);
            }
        } else {
            showToast("Unrecognized QR Code. Please scan a Nourish Network pass.", "error");
        }
    }
    window.handleScannedQrData = handleScannedQrData;

    function dispatchWhatsAppPass(orderInfo) {
        if (!orderInfo) return;
        let { orderId, foodName, pin, qty, sellerName, sellerAddress, sellerPhone, listingId, vendorId, sellerId } = orderInfo;

        // Dynamically resolve seller details if missing or containing legacy placeholder
        const targetListing = (state.listings || []).find(l => Number(l.id) === Number(listingId));
        const effectiveVendorId = vendorId || sellerId || (targetListing && targetListing.vendorId);

        if (!sellerAddress || sellerAddress.includes('Sterling Road') || sellerAddress.toLowerCase().includes('donor kitchen') || sellerAddress.trim() === '') {
            if (targetListing && (targetListing.vendorAddress || targetListing.address)) {
                sellerAddress = targetListing.vendorAddress || targetListing.address;
            } else if (adminCache && adminCache.users) {
                const vendorObj = adminCache.users.find(u => Number(u.id) === Number(effectiveVendorId));
                if (vendorObj && vendorObj.address) sellerAddress = vendorObj.address;
            }
        }

        if ((!sellerName || sellerName === 'Elite Catering Services' || sellerName === 'Donor Kitchen') && targetListing && targetListing.vendorName) {
            sellerName = targetListing.vendorName;
        } else if ((!sellerName || sellerName === 'Elite Catering Services' || sellerName === 'Donor Kitchen') && adminCache && adminCache.users) {
            const vendorObj = adminCache.users.find(u => Number(u.id) === Number(effectiveVendorId));
            if (vendorObj && vendorObj.name) sellerName = vendorObj.name;
        }

        if (!sellerPhone) {
            if (targetListing && (targetListing.vendorPhone || targetListing.publicPhone)) {
                sellerPhone = targetListing.vendorPhone || targetListing.publicPhone;
            } else if (adminCache && adminCache.users) {
                const vendorObj = adminCache.users.find(u => Number(u.id) === Number(effectiveVendorId));
                if (vendorObj) sellerPhone = vendorObj.publicPhone || vendorObj.phone || '';
            }
        }

        const isRealAddress = sellerAddress && 
            !sellerAddress.includes('Sterling Road') && 
            !sellerAddress.toLowerCase().includes('donor kitchen') &&
            sellerAddress.trim().length > 3;

        const mapsQuery = isRealAddress ? encodeURIComponent(sellerAddress) : '';
        const mapsLink = mapsQuery ? `https://www.google.com/maps/search/?api=1&query=${mapsQuery}` : '';

        const lines = [
            `🌱 *NOURISH NETWORK - FOOD RESCUE PASS*`,
            `━━━━━━━━━━━━━━━━━━━━`,
            `📦 *Order:* #NN-${String(orderId).padStart(4, '0')}`,
            `🍲 *Food:* ${foodName || 'Surplus Meal'}${qty ? ` · ${qty}` : ''}`,
            `🏢 *Donor Kitchen:* ${sellerName || 'Verified Partner'}`,
            isRealAddress ? `📍 *Pickup Location:* ${sellerAddress}` : null,
            sellerPhone ? `📞 *Kitchen Contact:* ${sellerPhone}` : null,
            `🔑 *HANDOVER PIN:* *${pin || '----'}*`,
            mapsLink ? `🗺️ *Directions:* ${mapsLink}` : null,
            `━━━━━━━━━━━━━━━━━━━━`,
            `⚡ _Show this 4-digit PIN to restaurant staff upon arrival to collect food._`
        ].filter(Boolean);

        const messageText = lines.join('\n');
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;

        try {
            const opened = window.open(waUrl, '_blank');
            if (!opened) {
                navigator.clipboard?.writeText(messageText).then(() => {
                    showToast("Pickup pass copied! Paste into WhatsApp chat.", "info");
                }).catch(() => {
                    window.location.href = waUrl;
                });
            } else {
                showToast("Opening WhatsApp Dispatch... 📲", "success");
            }
        } catch (e) {
            window.location.href = waUrl;
        }
    }
    window.dispatchWhatsAppPass = dispatchWhatsAppPass;

    function initHandoverVerificationModalEvents() {
        if (window._handoverEventsInitialized) return;
        window._handoverEventsInitialized = true;

        const verifyModal = document.getElementById('handoverVerifyModal');
        const qrModal = document.getElementById('handoverQrModal');

        // Close Triggers
        const closeVerifyBtn = document.getElementById('closeHandoverVerifyModal');
        if (closeVerifyBtn && verifyModal) {
            closeVerifyBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                verifyModal.style.display = 'none';
            };
        }
        if (verifyModal) {
            verifyModal.addEventListener('click', (e) => {
                if (e.target === verifyModal) verifyModal.style.display = 'none';
            });
        }

        const closeQrBtn = document.getElementById('closeHandoverQrModal');
        if (closeQrBtn && qrModal) {
            closeQrBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                qrModal.style.display = 'none';
            };
        }
        if (qrModal) {
            qrModal.addEventListener('click', (e) => {
                if (e.target === qrModal) qrModal.style.display = 'none';
            });
        }

        // WhatsApp Share button inside QR Modal
        const shareWaBtn = document.getElementById('btnShareQrOnWhatsApp');
        if (shareWaBtn && qrModal) {
            shareWaBtn.onclick = (e) => {
                e.preventDefault();
                if (qrModal._currentPassOrder) {
                    dispatchWhatsAppPass(qrModal._currentPassOrder);
                }
            };
        }

        // In-App Camera Scanner Triggers
        const launchCamBtn = document.getElementById('btnLaunchCameraScanner');
        if (launchCamBtn) {
            launchCamBtn.onclick = (e) => {
                e.preventDefault();
                startCameraScanner();
            };
        }

        const closeCamBtn = document.getElementById('closeQrCameraScannerModal');
        const camModal = document.getElementById('qrCameraScannerModal');
        if (closeCamBtn) {
            closeCamBtn.onclick = (e) => {
                e.preventDefault();
                stopCameraScanner();
            };
        }
        if (camModal) {
            camModal.addEventListener('click', (e) => {
                if (e.target === camModal) stopCameraScanner();
            });
        }

        // 4-Digit Box Interactive Mechanics (auto-advance, backspace, paste, enter)
        if (verifyModal) {
            const digitBoxes = Array.from(verifyModal.querySelectorAll('.handover-digit-box'));
            digitBoxes.forEach((input, idx) => {
                input.addEventListener('input', (e) => {
                    const cleaned = e.target.value.replace(/\D/g, '');
                    e.target.value = cleaned ? cleaned[0] : '';
                    const errBox = document.getElementById('verifyModalError');
                    if (errBox) errBox.style.display = 'none';

                    if (e.target.value && idx < digitBoxes.length - 1) {
                        digitBoxes[idx + 1].focus();
                        digitBoxes[idx + 1].select();
                    }
                });

                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' && !e.target.value && idx > 0) {
                        digitBoxes[idx - 1].focus();
                        digitBoxes[idx - 1].select();
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        submitHandoverVerification();
                    }
                });

                input.addEventListener('paste', (e) => {
                    e.preventDefault();
                    const clipboard = (e.clipboardData || window.clipboardData);
                    const pasted = clipboard ? clipboard.getData('text') : '';
                    const digits = pasted.replace(/\D/g, '').slice(0, 4);
                    if (digits) {
                        for (let i = 0; i < digitBoxes.length; i++) {
                            digitBoxes[i].value = digits[i] || '';
                        }
                        const nextIdx = Math.min(digits.length, digitBoxes.length - 1);
                        digitBoxes[nextIdx].focus();
                    }
                });
            });

            // Confirm Button Handler
            const confirmBtn = document.getElementById('btnConfirmHandover');
            if (confirmBtn) {
                confirmBtn.onclick = (e) => {
                    e.preventDefault();
                    submitHandoverVerification();
                };
            }
        }
    }
    window.initHandoverVerificationModalEvents = initHandoverVerificationModalEvents;

    let isVerifyingHandover = false;
    async function submitHandoverVerification() {
        if (isVerifyingHandover) return;
        const verifyModal = document.getElementById('handoverVerifyModal');
        if (!verifyModal) return;
        const orderId = verifyModal.dataset.orderId;
        const errorBox = document.getElementById('verifyModalError');
        const confirmBtn = document.getElementById('btnConfirmHandover');
        if (errorBox) {
            errorBox.textContent = '';
            errorBox.style.display = 'none';
        }

        if (!orderId) {
            if (errorBox) {
                errorBox.textContent = 'No active order selected for verification.';
                errorBox.style.display = 'block';
            }
            return;
        }

        const digitBoxes = Array.from(verifyModal.querySelectorAll('.handover-digit-box'));
        const otp = digitBoxes.map(b => b.value.trim()).join('');
        if (otp.length !== 4 || !/^\d{4}$/.test(otp)) {
            if (errorBox) {
                errorBox.textContent = 'Please enter all 4 digits of the recipient PIN.';
                errorBox.style.display = 'block';
            }
            const emptyBox = digitBoxes.find(b => !b.value);
            if (emptyBox) emptyBox.focus();
            return;
        }

        isVerifyingHandover = true;
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying PIN...';
        }

        // Fallback for local client orders (e.g. synthetic ORD-xxx)
        if (String(orderId).startsWith('ORD-')) {
            try {
                let localOrders = JSON.parse(localStorage.getItem('nn_local_orders') || '[]');
                const locOrder = localOrders.find(o => String(o.orderId) === String(orderId));
                const expectedPin = (locOrder && locOrder.handoverOtp) || String(orderId).padStart(4, '0').slice(-4);

                if (locOrder && otp !== expectedPin) {
                    if (errorBox) {
                        errorBox.textContent = 'Invalid Handover PIN! Please ask the NGO driver to show their pass.';
                        errorBox.style.display = 'block';
                    }
                    if (confirmBtn) {
                        confirmBtn.disabled = false;
                        confirmBtn.innerHTML = '<i class="fa-solid fa-check-double"></i>&nbsp; Verify & Complete Handover';
                    }
                    digitBoxes.forEach(b => b.value = '');
                    digitBoxes[0]?.focus();
                    return;
                }

                const now = new Date().toISOString();
                localOrders = localOrders.map(o => String(o.orderId) === String(orderId) ? { ...o, orderStatus: 'completed', handoverAt: now } : o);
                localStorage.setItem('nn_local_orders', JSON.stringify(localOrders));

                verifyModal.style.display = 'none';
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.innerHTML = '<i class="fa-solid fa-check-double"></i>&nbsp; Verify & Complete Handover';
                }
                showToast("Physical handover verified successfully! 🤝", "success");
                if (typeof loadPortalHistory === 'function') loadPortalHistory();
            } finally {
                isVerifyingHandover = false;
            }
            return;
        }

        try {
            const token = sessionStorage.getItem('nourishToken') || localStorage.getItem('nourishToken');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_BASE}/orders/${orderId}/verify-handover`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ otp })
            });
            const data = await res.json().catch(() => ({}));

            if (res.ok && data.success) {
                verifyModal.style.display = 'none';
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.innerHTML = '<i class="fa-solid fa-check-double"></i>&nbsp; Verify & Complete Handover';
                }
                showToast(data.message || "Physical handover verified successfully! 🤝", "success");
                if (typeof loadPortalHistory === 'function') loadPortalHistory();
            } else {
                if (errorBox) {
                    errorBox.textContent = data.error || 'Invalid PIN. Please ask the recipient for the 4 digits.';
                    errorBox.style.display = 'block';
                }
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.innerHTML = '<i class="fa-solid fa-check-double"></i>&nbsp; Verify & Complete Handover';
                }
                digitBoxes.forEach(b => b.value = '');
                digitBoxes[0]?.focus();
            }
        } catch (err) {
            console.error("Verification error:", err);
            if (errorBox) {
                errorBox.textContent = 'Network error during verification. Please try again.';
                errorBox.style.display = 'block';
            }
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="fa-solid fa-check-double"></i>&nbsp; Verify & Complete Handover';
            }
        } finally {
            isVerifyingHandover = false;
        }
    }
    window.submitHandoverVerification = submitHandoverVerification;
    window._submitHandoverVerificationInternal = submitHandoverVerification;

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
            const isSeller = role.includes('restaurant') || role.includes('vendor') || role.includes('seller') || state.activePortal === 'seller';
            if (fssaiWrap) fssaiWrap.style.display = isSeller ? 'block' : 'none';
            if (darpanWrap) darpanWrap.style.display = isSeller ? 'none' : 'block';
            if (subtitle) subtitle.textContent = isSeller
                ? "Manage your restaurant's profile, compliance & pickup details"
                : "Manage your NGO's profile, compliance & pickup details";

            // Private Super Admin access row inside profile settings
            const adminRow = document.getElementById('settingsAdminRow');
            if (adminRow) {
                adminRow.style.display = (typeof checkIsAdminUser === 'function' && checkIsAdminUser()) ? 'flex' : 'none';
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
                const isAdmin = typeof checkIsAdminUser === 'function' && checkIsAdminUser();
                const isInspecting = isAdmin && state.adminInspectedUser;
                const sessionUser = JSON.parse(sessionStorage.getItem('nourishUser') || localStorage.getItem('nourishUser') || '{}');
                const profile = isInspecting ? state.adminInspectedUser : sessionUser;

                // Update settings modal header subtitle to clarify inspected account vs logged-in account
                const subtitle = settingsModal ? settingsModal.querySelector('p') : null;
                const isSeller = (profile.accountType || profile.role || profile.type || '').toLowerCase().includes('restaurant') ||
                                 (profile.accountType || profile.role || profile.type || '').toLowerCase().includes('vendor') ||
                                 (profile.accountType || profile.role || profile.type || '').toLowerCase().includes('seller') ||
                                 state.activePortal === 'seller';

                if (subtitle) {
                    if (isInspecting) {
                        subtitle.innerHTML = `<span style="color:#10b981; font-weight:700;"><i class="fa-solid fa-shield-halved"></i> Admin Inspection Mode:</span> Editing Profile for <strong>${profile.organizationName || profile.name || profile.email}</strong> (ID #${profile.id})`;
                    } else {
                        subtitle.textContent = isSeller
                            ? "Manage your restaurant's profile, compliance & pickup details"
                            : "Manage your NGO's profile, compliance & pickup details";
                    }
                }

                // 1. Account & Identity Fields
                if (orgNameInput) orgNameInput.value = profile.organizationName || profile.name || '';
                if (emailInput) emailInput.value = profile.email || '';
                if (accountTypeInput) {
                    const role = profile.accountType || profile.type || profile.role || (isSeller ? 'Vendor' : 'NGO');
                    accountTypeInput.value = role.toUpperCase();
                }

                // Show FSSAI field for food vendors, DARPAN for NGOs
                if (fssaiFieldWrap) fssaiFieldWrap.style.display = isSeller ? 'block' : 'none';
                if (darpanFieldWrap) darpanFieldWrap.style.display = isSeller ? 'none' : 'block';

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
                    if (isInspecting) {
                        try {
                            const res = await fetch(`${API_BASE}/admin/users?_t=${Date.now()}`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            if (res.ok) {
                                const data = await res.json();
                                if (data && data.users) {
                                    adminCache.users = data.users;
                                    const freshUser = data.users.find(u => Number(u.id) === Number(profile.id));
                                    if (freshUser) {
                                        state.adminInspectedUser = freshUser;
                                        sessionStorage.setItem('nn_admin_inspected_user', JSON.stringify(freshUser));
                                        if (orgNameInput && freshUser.organizationName) orgNameInput.value = freshUser.organizationName;
                                        if (emailInput && freshUser.email) emailInput.value = freshUser.email;
                                        if (bioInput && freshUser.bio) bioInput.value = freshUser.bio;
                                        if (locationInput && freshUser.address) locationInput.value = freshUser.address;
                                        if (contactPersonInput && freshUser.contactPerson) contactPersonInput.value = freshUser.contactPerson;
                                        if (publicPhoneInput && (freshUser.publicPhone || freshUser.phone)) publicPhoneInput.value = freshUser.publicPhone || freshUser.phone;
                                        if (websiteInput && freshUser.website) websiteInput.value = freshUser.website;
                                        if (fssaiInput && freshUser.fssaiCode) { fssaiInput.value = freshUser.fssaiCode; updateFssaiFeedback(); }
                                        if (darpanInput && freshUser.darpanId) { darpanInput.value = freshUser.darpanId; updateDarpanFeedback(); }
                                        if (pickupWindowInput && freshUser.pickupWindow) pickupWindowInput.value = freshUser.pickupWindow;
                                        if (pickupInstructionsInput && freshUser.pickupInstructions) pickupInstructionsInput.value = freshUser.pickupInstructions;
                                        if (freshUser.avatarUrl && avatarPreview) avatarPreview.src = freshUser.avatarUrl;
                                    }
                                }
                            }
                        } catch (e) {}
                    } else {
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
                                if (bioInput && liveProfile.bio) bioInput.value = liveProfile.bio;
                                if (locationInput && liveProfile.address) locationInput.value = liveProfile.address;
                                if (contactPersonInput && liveProfile.contactPerson) contactPersonInput.value = liveProfile.contactPerson;
                                if (publicPhoneInput && (liveProfile.publicPhone || liveProfile.phone)) publicPhoneInput.value = liveProfile.publicPhone || liveProfile.phone;
                                if (websiteInput && liveProfile.website) websiteInput.value = liveProfile.website;
                                if (fssaiInput && (liveProfile.fssaiCode || liveProfile.fssaicode)) {
                                    fssaiInput.value = liveProfile.fssaiCode || liveProfile.fssaicode;
                                    updateFssaiFeedback();
                                }
                                if (darpanTypeSelect && (liveProfile.ngoRegType || liveProfile.ngoregtype)) {
                                    darpanTypeSelect.value = liveProfile.ngoRegType || liveProfile.ngoregtype;
                                    if (darpanInput) darpanInput.placeholder = NGO_PLACEHOLDERS[darpanTypeSelect.value] || 'Registration Code';
                                }
                                if (darpanInput && (liveProfile.darpanId || liveProfile.darpanid)) {
                                    darpanInput.value = liveProfile.darpanId || liveProfile.darpanid;
                                    updateDarpanFeedback();
                                }
                                if (pickupWindowInput && liveProfile.pickupWindow) pickupWindowInput.value = liveProfile.pickupWindow;
                                if (pickupInstructionsInput && liveProfile.pickupInstructions) pickupInstructionsInput.value = liveProfile.pickupInstructions;

                                if (liveProfile.avatarUrl && avatarPreview) {
                                    avatarPreview.src = liveProfile.avatarUrl;
                                }

                                // Cache latest liveProfile in storage so it persists across reloads
                                const merged = { 
                                    ...sessionUser, 
                                    ...liveProfile,
                                    address: liveProfile.address || sessionUser.address || '',
                                    fssaiCode: liveProfile.fssaiCode || liveProfile.fssaicode || sessionUser.fssaiCode || sessionUser.fssaicode || '',
                                    darpanId: liveProfile.darpanId || liveProfile.darpanid || sessionUser.darpanId || sessionUser.darpanid || '',
                                    ngoRegType: liveProfile.ngoRegType || liveProfile.ngoregtype || sessionUser.ngoRegType || sessionUser.ngoregtype || ''
                                };
                                sessionStorage.setItem('nourishUser', JSON.stringify(merged));
                                localStorage.setItem('nourishUser', JSON.stringify(merged));
                                renderPortal();
                            }
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
                    const isAdmin = typeof checkIsAdminUser === 'function' && checkIsAdminUser();
                    const isInspecting = isAdmin && state.adminInspectedUser;

                    const endpoint = isInspecting
                        ? `${API_BASE}/admin/users/${state.adminInspectedUser.id}`
                        : `${API_BASE}/user/me`;

                    const res = await fetch(endpoint, {
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
                        if (isInspecting) {
                            const updatedUser = {
                                ...state.adminInspectedUser,
                                ...(data.user || {}),
                                organizationName: orgName || state.adminInspectedUser.organizationName,
                                name: orgName || state.adminInspectedUser.name,
                                bio,
                                address,
                                contactPerson,
                                publicPhone,
                                phone: publicPhone || state.adminInspectedUser.phone,
                                website,
                                fssaiCode,
                                darpanId: darpanCode,
                                ngoRegType: ngoType,
                                pickupWindow,
                                pickupInstructions,
                                avatarUrl: avatarUrl || state.adminInspectedUser.avatarUrl
                            };
                            state.adminInspectedUser = updatedUser;
                            sessionStorage.setItem('nn_admin_inspected_user', JSON.stringify(updatedUser));

                            if (adminCache && adminCache.users) {
                                const idx = adminCache.users.findIndex(u => Number(u.id) === Number(updatedUser.id));
                                if (idx !== -1) adminCache.users[idx] = updatedUser;
                            }

                            showToast(`Profile updated for ${updatedUser.organizationName || 'User'}! 🛡️`, "success");
                        } else {
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
                        }

                        settingsModal.style.display = 'none';

                        // Update navbar avatar immediately
                        const navImg = document.getElementById('nav-avatar-img');
                        if (navImg && avatarUrl) navImg.src = avatarUrl;

                        // Re-render portal to immediately show updated location, details, and trust badges!
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

        // ─── GPS AUTO-LOCATION DETECTOR ───────────────────────────────────────
        async function detectCurrentGpsLocation(targetInputId = 'locationInput') {
            const inputEl = document.getElementById(targetInputId) || document.getElementById('locationInput');
            const badgeBtn = document.getElementById('btnDetectGpsLocationBadge');
            const inputBtn = document.getElementById('btnDetectGpsLocationInput');
            const badgeIcon = document.getElementById('gpsBadgeIcon');
            const inputIcon = document.getElementById('gpsInputIcon');
            const feedbackEl = document.getElementById('gpsStatusFeedback');

            if (!navigator.geolocation) {
                showToast("Geolocation is not supported by your browser.", "error");
                if (feedbackEl) {
                    feedbackEl.style.display = 'block';
                    feedbackEl.style.background = 'rgba(239, 68, 68, 0.12)';
                    feedbackEl.style.color = '#f87171';
                    feedbackEl.style.border = '1px solid rgba(239, 68, 68, 0.25)';
                    feedbackEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> GPS is not supported on this browser.';
                }
                return;
            }

            // Set UI loading state
            if (badgeBtn) badgeBtn.disabled = true;
            if (inputBtn) {
                inputBtn.disabled = true;
                inputBtn.classList.add('locating');
            }
            if (badgeIcon) badgeIcon.className = 'fa-solid fa-spinner fa-spin';
            if (inputIcon) inputIcon.className = 'fa-solid fa-spinner fa-spin';

            if (feedbackEl) {
                feedbackEl.style.display = 'block';
                feedbackEl.style.background = 'rgba(16, 185, 129, 0.12)';
                feedbackEl.style.color = '#10b981';
                feedbackEl.style.border = '1px solid rgba(16, 185, 129, 0.3)';
                feedbackEl.innerHTML = '<i class="fa-solid fa-satellite-dish fa-spin"></i> Contacting GPS satellites & acquiring coordinates...';
            }

            showToast("Acquiring GPS coordinates... 🛰️", "info");

            const resetUi = () => {
                if (badgeBtn) badgeBtn.disabled = false;
                if (inputBtn) {
                    inputBtn.disabled = false;
                    inputBtn.classList.remove('locating');
                }
                if (badgeIcon) badgeIcon.className = 'fa-solid fa-location-crosshairs';
                if (inputIcon) inputIcon.className = 'fa-solid fa-location-crosshairs';
            };

            const geoOptions = {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 10000
            };

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude, accuracy } = position.coords;
                    if (feedbackEl) {
                        feedbackEl.innerHTML = `<i class="fa-solid fa-compass fa-spin"></i> Acquired GPS (±${Math.round(accuracy)}m). Resolving address...`;
                    }

                    let resolvedAddress = null;

                    // 1. Try server geocode proxy first
                    try {
                        const proxyRes = await fetch(`${API_BASE}/geocode/reverse?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`);
                        if (proxyRes.ok) {
                            const proxyData = await proxyRes.json();
                            if (proxyData && proxyData.success && proxyData.address) {
                                resolvedAddress = proxyData.address;
                            }
                        }
                    } catch (pErr) {
                        console.warn("Proxy geocode fallback:", pErr);
                    }

                    // 2. Direct client fallback via OpenStreetMap Nominatim
                    if (!resolvedAddress) {
                        try {
                            const osmRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
                            if (osmRes.ok) {
                                const osmData = await osmRes.json();
                                if (osmData && osmData.address) {
                                    const a = osmData.address;
                                    const parts = [
                                        a.amenity || a.building || a.house_number || null,
                                        a.road || a.street || a.pedestrian || null,
                                        a.suburb || a.neighbourhood || a.residential || null,
                                        a.city || a.town || a.village || a.city_district || null,
                                        a.state || null,
                                        a.postcode || null,
                                        a.country || null
                                    ].filter(Boolean);
                                    resolvedAddress = parts.length > 0 ? parts.join(', ') : osmData.display_name;
                                }
                            }
                        } catch (osmErr) {
                            console.warn("Client OSM geocode fallback:", osmErr);
                        }
                    }

                    // 2b. Secondary client fallback via BigDataCloud
                    if (!resolvedAddress) {
                        try {
                            const bdcRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
                            if (bdcRes.ok) {
                                const bdc = await bdcRes.json();
                                const parts = [
                                    bdc.locality || bdc.city || null,
                                    bdc.principalSubdivision || null,
                                    bdc.postcode || null,
                                    bdc.countryName || null
                                ].filter(Boolean);
                                if (parts.length > 0) resolvedAddress = parts.join(', ');
                            }
                        } catch (bdcErr) {
                            console.warn("Client BDC geocode fallback:", bdcErr);
                        }
                    }

                    // 3. Fallback to coordinate string
                    if (!resolvedAddress) {
                        resolvedAddress = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
                    }

                    // Apply to input
                    if (inputEl) {
                        inputEl.value = resolvedAddress;
                        inputEl.dataset.lat = latitude;
                        inputEl.dataset.lng = longitude;

                        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                        inputEl.dispatchEvent(new Event('change', { bubbles: true }));

                        inputEl.style.transition = 'all 0.3s ease';
                        inputEl.style.borderColor = '#10b981';
                        inputEl.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.3)';
                        setTimeout(() => {
                            inputEl.style.borderColor = '';
                            inputEl.style.boxShadow = '';
                        }, 3000);
                    }

                    if (feedbackEl) {
                        feedbackEl.style.background = 'rgba(16, 185, 129, 0.12)';
                        feedbackEl.style.color = '#10b981';
                        feedbackEl.style.border = '1px solid rgba(16, 185, 129, 0.3)';
                        feedbackEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Location set: <strong>${resolvedAddress}</strong> (Accuracy: ±${Math.round(accuracy)}m)`;
                    }

                    const shortSummary = resolvedAddress.split(',')[0] || resolvedAddress;
                    showToast(`📍 Location auto-set: ${shortSummary}`, "success");
                    resetUi();
                },
                (error) => {
                    resetUi();
                    let errorMsg = 'Failed to acquire GPS location. Please try again or type manually.';
                    if (error.code === 1) {
                        errorMsg = 'Location permission was denied. Please allow location access in your browser / phone settings.';
                    } else if (error.code === 2) {
                        errorMsg = 'Location position is unavailable. Please check your device GPS.';
                    } else if (error.code === 3) {
                        errorMsg = 'GPS location request timed out. Please try again.';
                    }

                    if (feedbackEl) {
                        feedbackEl.style.display = 'block';
                        feedbackEl.style.background = 'rgba(239, 68, 68, 0.12)';
                        feedbackEl.style.color = '#f87171';
                        feedbackEl.style.border = '1px solid rgba(239, 68, 68, 0.25)';
                        feedbackEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${errorMsg}`;
                    }

                    showToast(errorMsg, "error");
                },
                geoOptions
            );
        }
        window.detectCurrentGpsLocation = detectCurrentGpsLocation;
        window._detectCurrentGpsLocationInternal = detectCurrentGpsLocation;

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
                const handoverVerifyModal = document.getElementById('handoverVerifyModal');
                if (handoverVerifyModal && handoverVerifyModal.style.display !== 'none') {
                    handoverVerifyModal.style.display = 'none';
                }
                const handoverQrModal = document.getElementById('handoverQrModal');
                if (handoverQrModal && handoverQrModal.style.display !== 'none') {
                    handoverQrModal.style.display = 'none';
                }
                const qrCameraScannerModal = document.getElementById('qrCameraScannerModal');
                if (qrCameraScannerModal && qrCameraScannerModal.style.display !== 'none') {
                    if (typeof stopCameraScanner === 'function') stopCameraScanner();
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

    // ─── 1-TAP URL QR SCAN VERIFICATION CONTROLLER ───────────────────────────
    function checkUrlVerificationParams() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const action = urlParams.get('action');
            const orderId = urlParams.get('orderId');
            const pin = urlParams.get('pin');

            if (action === 'verify-handover' && orderId) {
                // Remove search params cleanly from address bar
                window.history.replaceState({}, document.title, window.location.pathname);

                initHandoverVerificationModalEvents();

                // Open verification modal with pre-filled details & PIN
                if (typeof openHandoverVerifyModal === 'function') {
                    openHandoverVerifyModal(orderId, `Order #${orderId}`, 'NGO Partner', '', pin || '');
                }

                if (pin && pin.length === 4) {
                    showToast(`Scanned Pass for Order #${orderId} with PIN ${pin}!`, "info");
                    setTimeout(() => {
                        if (typeof submitHandoverVerification === 'function') {
                            submitHandoverVerification();
                        }
                    }, 400);
                }
            }
        } catch (e) {
            console.error("URL QR check error:", e);
        }
    }

    initHandoverVerificationModalEvents();
    checkUrlVerificationParams();

});


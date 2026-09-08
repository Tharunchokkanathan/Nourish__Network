require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');

const db = require('./database');
const { authenticateToken, JWT_SECRET } = require('./middleware/auth');
const { 
    sendVerificationEmail, 
    sendPasswordResetEmail, 
    sendLoginNotificationEmail, 
    sendPasswordChangedEmail,
    sendFoodPublishedBroadcastEmail,
    sendSellerOrderNotificationEmail,
    sendLoginApprovalEmail
} = require('./mailer');

// ─── APP SETUP ───────────────────────────────────────────────────────────────
const app = express();
app.enable('trust proxy');
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// ─── MULTER CONFIG (food image uploads) ──────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ext = path.extname(file.originalname).toLowerCase();
        allowed.test(ext) ? cb(null, true) : cb(new Error('Only image files are allowed.'));
    }
});

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded food images
app.use('/uploads', express.static(uploadsDir));

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

// ─── HELPER ───────────────────────────────────────────────────────────────────
const SALT_ROUNDS = 10;

function makeToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            type: user.accountType || user.type,
            name: user.organizationName || user.name,
            isVerified: Boolean(user.isVerified)
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// 1. REGISTER
// POST /api/register
// Body: { accountType, organizationName, email, password, phone?, address? }
app.post('/api/register', async (req, res) => {
    const { accountType, organizationName, email, password, phone, address, fssaiCode, darpanId, ngoRegType } = req.body;

    if (!accountType || !organizationName || !email || !password) {
        return res.status(400).json({ error: 'Please provide all required fields.' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    try {
        const hashed = await bcrypt.hash(password, SALT_ROUNDS);

        // Generate verification token and 6-digit OTP
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 Hours

        const sql = `INSERT INTO users (accountType, organizationName, email, password, phone, address, fssaiCode, darpanId, ngoRegType, isVerified, verificationToken, verificationTokenExpires, verificationOtp)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`;

        db.run(sql, [
            accountType,
            organizationName,
            email,
            hashed,
            phone || null,
            address || null,
            fssaiCode || null,
            darpanId || null,
            ngoRegType || (darpanId ? 'darpan' : null),
            verificationToken,
            verificationTokenExpires,
            verificationOtp
        ], async function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed') || err.message.includes('unique constraint') || err.message.includes('duplicate key')) {
                    return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
                }
                return res.status(500).json({ error: err.message });
            }

            const userId = this.lastID;
            const user = {
                id: userId,
                accountType,
                organizationName,
                email,
                fssaiCode: fssaiCode || '',
                darpanId: darpanId || '',
                ngoRegType: ngoRegType || (darpanId ? 'darpan' : ''),
                isVerified: 0
            };

            // Send registration verification email in background on immediate microtick
            const hostUrl = req.headers.origin || (req.headers.host ? `${req.headers['x-forwarded-proto'] || req.protocol || 'http'}://${req.headers.host}` : 'https://nourish-network-4bit.onrender.com');
            setImmediate(() => {
                sendVerificationEmail({
                    toEmail: email,
                    name: organizationName,
                    token: verificationToken,
                    accountType,
                    hostUrl
                }).catch(e => console.error("Async Email Error:", e));
            });

            res.status(201).json({
                message: 'Account created! Please check your email to activate your account.',
                requiresVerification: true,
                email
            });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

function parseDeviceName(userAgent) {
    if (!userAgent || typeof userAgent !== 'string') return 'Desktop / Laptop Browser';
    const ua = userAgent;

    let os = 'Computer';
    if (/windows nt/i.test(ua)) os = 'Windows PC';
    else if (/macintosh|mac os x/i.test(ua)) os = 'MacBook / Mac';
    else if (/iphone/i.test(ua)) os = 'iPhone';
    else if (/ipad/i.test(ua)) os = 'iPad';
    else if (/android/i.test(ua)) os = 'Android Phone';
    else if (/linux/i.test(ua)) os = 'Linux Computer';

    let browser = 'Browser';
    if (/edg\//i.test(ua)) browser = 'Edge';
    else if (/chrome|crios/i.test(ua) && !/opr|opera/i.test(ua)) browser = 'Chrome';
    else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
    else if (/opera|opr/i.test(ua)) browser = 'Opera';

    return `${os} (${browser})`;
}

// 2. LOGIN
// POST /api/login
// Body: { email, password }
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Please provide email and password.' });
    }

    const deviceName = parseDeviceName(req.headers['user-agent']);

    // --- HACKATHON DEMO LOGIN BYPASS ---
    // Professional demo accounts for judges and testers
    if (email === 'serverdemo@gmail.com' && password === 'demo123') {
        const user = { id: 888, email: 'serverdemo@gmail.com', accountType: 'restaurant', organizationName: 'Elite Catering (Demo)', isVerified: 1 };
        sendLoginNotificationEmail({
            toEmail: user.email,
            name: user.organizationName,
            accountType: user.accountType,
            loginTime: new Date().toISOString(),
            deviceName
        }).catch(e => console.error("Async Login Email Error:", e));
        return res.status(200).json({
            message: 'Hackathon Demo Login Successful!',
            token: makeToken(user),
            user: { id: user.id, email: user.email, name: user.organizationName, organizationName: user.organizationName, type: user.accountType, accountType: user.accountType, isVerified: 1 }
        });
    }
    if (email === 'ngodemo@gmail.com' && password === 'demo123') {
        const user = { id: 999, email: 'ngodemo@gmail.com', accountType: 'ngo', organizationName: 'Global Outreach (Demo)', isVerified: 1 };
        sendLoginNotificationEmail({
            toEmail: user.email,
            name: user.organizationName,
            accountType: user.accountType,
            loginTime: new Date().toISOString(),
            deviceName
        }).catch(e => console.error("Async Login Email Error:", e));
        return res.status(200).json({
            message: 'Hackathon Demo Login Successful!',
            token: makeToken(user),
            user: { id: user.id, email: user.email, name: user.organizationName, organizationName: user.organizationName, type: user.accountType, accountType: user.accountType, isVerified: 1 }
        });
    }
    // Legacy demo accounts
    if (email === 'seller@demo.com' && password === 'demo123') {
        const user = { id: 998, email: 'seller@demo.com', accountType: 'restaurant', organizationName: 'Demo Restaurant', isVerified: 1 };
        return res.status(200).json({
            message: 'Demo login successful!',
            token: makeToken(user),
            user: { id: user.id, email: user.email, name: user.organizationName, organizationName: user.organizationName, type: user.accountType, accountType: user.accountType, isVerified: 1 }
        });
    }
    if (email === 'buyer@demo.com' && password === 'demo123') {
        const user = { id: 999, email: 'buyer@demo.com', accountType: 'ngo', organizationName: 'Demo NGO', isVerified: 1 };
        return res.status(200).json({
            message: 'Demo login successful!',
            token: makeToken(user),
            user: { id: user.id, email: user.email, name: user.organizationName, organizationName: user.organizationName, type: user.accountType, accountType: user.accountType, isVerified: 1 }
        });
    }
    // -------------------------

    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

        try {
            const match = await bcrypt.compare(password, user.password);
            if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

            if (!user.isVerified) {
                return res.status(403).json({
                    error: 'Please verify your email address before signing in. Check your inbox for the activation link.',
                    unverified: true,
                    email: user.email
                });
            }

            const token = makeToken(user);

            // Send purely informational Login Success Notification Email asynchronously on immediate microtick
            setImmediate(() => {
                sendLoginNotificationEmail({
                    toEmail: user.email,
                    name: user.organizationName,
                    accountType: user.accountType,
                    loginTime: new Date().toISOString(),
                    deviceName
                }).catch(e => console.error("Async Login Email Error:", e));
            });

            res.status(200).json({
                message: 'Login successful!',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.organizationName,
                    organizationName: user.organizationName,
                    type: user.accountType,
                    accountType: user.accountType,
                    phone: user.phone || '',
                    bio: user.bio || '',
                    address: user.address || '',
                    contactPerson: user.contactPerson || '',
                    publicPhone: user.publicPhone || user.phone || '',
                    website: user.website || '',
                    fssaiCode: user.fssaiCode || '',
                    darpanId: user.darpanId || '',
                    ngoRegType: user.ngoRegType || '',
                    pickupInstructions: user.pickupInstructions || '',
                    avatarUrl: user.avatarUrl || '',
                    isVerified: user.isVerified || 1
                }
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
});

// ─── CROSS-DEVICE LOGIN APPROVAL STATE & HELPERS ────────────────────────────
const pendingLoginSessions = new Map();

// Purge expired sessions every 2 minutes
setInterval(() => {
    const now = Date.now();
    for (const [sId, sess] of pendingLoginSessions.entries()) {
        if (sess.expiresAt < now) {
            pendingLoginSessions.delete(sId);
        }
    }
}, 2 * 60 * 1000);


// 2a. REQUEST CROSS-DEVICE LOGIN APPROVAL
// POST /api/auth/request-approval-login
// Body: { email, password? }
app.post('/api/auth/request-approval-login', (req, res) => {
    const { email, password } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }

    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'No account registered with this email.' });

        // If password provided, verify it before dispatching approval
        if (password) {
            try {
                const match = await bcrypt.compare(password, user.password);
                if (!match) return res.status(401).json({ error: 'Invalid password.' });
            } catch (pErr) {
                return res.status(500).json({ error: 'Password verification failed.' });
            }
        }

        const sessionId = 'sess_' + crypto.randomBytes(16).toString('hex');
        const magicToken = crypto.randomBytes(24).toString('hex');
        const deviceName = parseDeviceName(req.headers['user-agent']);

        const hostUrl = req.headers.origin || (req.headers.host ? `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}` : 'https://nourish-network-4bit.onrender.com');
        const approveUrl = `${hostUrl}/api/auth/approve-login?sessionId=${sessionId}&token=${magicToken}`;
        const denyUrl = `${hostUrl}/api/auth/deny-login?sessionId=${sessionId}&token=${magicToken}`;

        pendingLoginSessions.set(sessionId, {
            sessionId,
            token: magicToken,
            email: user.email,
            user,
            initiatorDevice: deviceName,
            status: 'pending',
            authToken: null,
            authUser: null,
            createdAt: Date.now(),
            expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
        });

        // Send approval request email asynchronously
        sendLoginApprovalEmail({
            toEmail: user.email,
            name: user.organizationName || 'User',
            deviceName,
            approveUrl,
            denyUrl,
            expiresMinutes: 10
        }).catch(e => console.error("Async Approval Email Error:", e));

        return res.status(200).json({
            message: 'Sign-in approval email dispatched! Tap Approve in your Gmail.',
            sessionId,
            deviceName,
            email: user.email,
            expiresAt: Date.now() + 10 * 60 * 1000
        });
    });
});

// 2b. POLL LOGIN SESSION STATUS (Laptop checks this every 2 seconds)
// GET /api/auth/login-session-status?sessionId=...
app.get('/api/auth/login-session-status', (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

    const session = pendingLoginSessions.get(sessionId);
    if (!session || session.expiresAt < Date.now()) {
        if (session) pendingLoginSessions.delete(sessionId);
        return res.json({ status: 'expired' });
    }

    if (session.status === 'pending') {
        return res.json({ status: 'pending', device: session.initiatorDevice });
    }

    if (session.status === 'rejected') {
        pendingLoginSessions.delete(sessionId);
        return res.json({ status: 'rejected' });
    }

    if (session.status === 'approved') {
        // Return token and user data to the waiting device
        const responseData = {
            status: 'approved',
            token: session.authToken,
            user: session.authUser
        };
        // Keep in memory briefly (30s) so multiple concurrent checks succeed then purge
        setTimeout(() => pendingLoginSessions.delete(sessionId), 30000);
        return res.json(responseData);
    }

    return res.json({ status: 'unknown' });
});

// 2c. APPROVE LOGIN (Opened when user taps "Approve" in Gmail on mobile or laptop)
// GET /api/auth/approve-login?sessionId=...&token=...
app.get('/api/auth/approve-login', (req, res) => {
    const { sessionId, token } = req.query;
    if (!sessionId || !token) {
        return res.redirect('/approve-login.html?status=invalid');
    }

    const session = pendingLoginSessions.get(sessionId);
    if (!session || session.expiresAt < Date.now()) {
        if (session) pendingLoginSessions.delete(sessionId);
        return res.redirect('/approve-login.html?status=expired');
    }

    if (session.token !== token) {
        return res.redirect('/approve-login.html?status=invalid');
    }

    // Authorize session and generate JWT token
    const user = session.user;
    const jwtToken = makeToken(user);

    session.status = 'approved';
    session.authToken = jwtToken;
    session.authUser = {
        id: user.id,
        email: user.email,
        name: user.organizationName,
        organizationName: user.organizationName,
        type: user.accountType,
        accountType: user.accountType,
        phone: user.phone || '',
        bio: user.bio || '',
        address: user.address || '',
        contactPerson: user.contactPerson || '',
        publicPhone: user.publicPhone || user.phone || '',
        website: user.website || '',
        fssaiCode: user.fssaiCode || '',
        pickupInstructions: user.pickupInstructions || '',
        avatarUrl: user.avatarUrl || '',
        isVerified: user.isVerified || 1
    };

    return res.redirect(`/approve-login.html?status=approved&device=${encodeURIComponent(session.initiatorDevice)}`);
});

// 2d. DENY LOGIN (Opened when user taps "Deny & Block" in Gmail)
// GET /api/auth/deny-login?sessionId=...&token=...
app.get('/api/auth/deny-login', (req, res) => {
    const { sessionId, token } = req.query;
    const session = pendingLoginSessions.get(sessionId);
    if (session && session.token === token) {
        session.status = 'rejected';
    }
    const dev = session ? session.initiatorDevice : 'Device';
    return res.redirect(`/approve-login.html?status=denied&device=${encodeURIComponent(dev)}`);
});

// 2b. EMAIL VERIFICATION VIA LINK (GET /api/verify-email?token=... or /api/verify?token=...)
app.get(['/api/verify-email', '/api/verify'], (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    const { token } = req.query;

    if (!token) {
        return res.status(400).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Invalid Request - Nourish Network</title>
                <style>
                    * { box-sizing: border-box; }
                    body {
                        background: radial-gradient(circle at 50% 30%, #0d261d 0%, #050d09 70%, #020604 100%);
                        color: #ffffff;
                        font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        padding: 1.5rem;
                    }
                    .card {
                        width: 100%;
                        max-width: 410px;
                        background: #091913;
                        border: 1.5px solid rgba(239, 68, 68, 0.45);
                        border-radius: 32px;
                        padding: 3rem 2.25rem 2.5rem;
                        text-align: center;
                        box-shadow: 0 35px 90px rgba(0, 0, 0, 0.95), 0 0 45px rgba(239, 68, 68, 0.2);
                        animation: cardAppear 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    }
                    @keyframes cardAppear {
                        from { opacity: 0; transform: translateY(20px) scale(0.96); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                    .icon-badge {
                        width: 76px;
                        height: 76px;
                        margin: 0 auto 1.5rem;
                        border-radius: 50%;
                        background: rgba(239, 68, 68, 0.15);
                        border: 1.5px solid rgba(239, 68, 68, 0.4);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 2rem;
                        color: #ef4444;
                        box-shadow: 0 0 25px rgba(239, 68, 68, 0.3);
                    }
                    h2 { font-size: 1.85rem; font-weight: 700; margin: 0 0 0.75rem 0; color: #ffffff; letter-spacing: -0.01em; }
                    p { color: rgba(255, 255, 255, 0.75); font-size: 0.98rem; line-height: 1.55; margin: 0 0 1.75rem 0; }
                    .btn {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        min-width: 180px;
                        padding: 0.9rem 2.75rem;
                        border-radius: 100px;
                        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                        color: #ffffff;
                        font-size: 1.15rem;
                        font-weight: 700;
                        letter-spacing: 0.5px;
                        border: 1px solid rgba(255, 255, 255, 0.3);
                        box-shadow: 0 10px 30px rgba(16, 185, 129, 0.4), inset 0 1px 1px 0 rgba(255, 255, 255, 0.35);
                        text-decoration: none;
                        cursor: pointer;
                        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                    }
                    .btn:hover {
                        background: linear-gradient(135deg, #059669 0%, #047857 100%);
                        border-color: rgba(255, 255, 255, 0.5);
                        box-shadow: 0 14px 35px rgba(16, 185, 129, 0.5), inset 0 1px 1px 0 rgba(255, 255, 255, 0.45);
                        transform: translateY(-2px) scale(1.03);
                    }
                    .btn:active { transform: scale(0.97); }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="icon-badge">⚠️</div>
                    <h2>Invalid Request</h2>
                    <p>No verification token was provided.</p>
                    <a href="/" class="btn">Return to Nourish Network</a>
                </div>
            </body>
            </html>
        `);
    }

    db.get(`SELECT * FROM users WHERE verificationToken = ?`, [token], (err, user) => {
        if (err || !user) {
            return res.status(400).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Verification Failed - Nourish Network</title>
                    <style>
                        * { box-sizing: border-box; }
                        body {
                            background: radial-gradient(circle at 50% 30%, #0d261d 0%, #050d09 70%, #020604 100%);
                            color: #ffffff;
                            font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            min-height: 100vh;
                            margin: 0;
                            padding: 1.5rem;
                        }
                        .card {
                            width: 100%;
                            max-width: 410px;
                            background: #091913;
                            border: 1.5px solid rgba(239, 68, 68, 0.45);
                            border-radius: 32px;
                            padding: 3rem 2.25rem 2.5rem;
                            text-align: center;
                            box-shadow: 0 35px 90px rgba(0, 0, 0, 0.95), 0 0 45px rgba(239, 68, 68, 0.2);
                            animation: cardAppear 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                        }
                        @keyframes cardAppear {
                            from { opacity: 0; transform: translateY(20px) scale(0.96); }
                            to { opacity: 1; transform: translateY(0) scale(1); }
                        }
                        .icon-badge {
                            width: 76px;
                            height: 76px;
                            margin: 0 auto 1.5rem;
                            border-radius: 50%;
                            background: rgba(239, 68, 68, 0.15);
                            border: 1.5px solid rgba(239, 68, 68, 0.4);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 2rem;
                            color: #ef4444;
                            box-shadow: 0 0 25px rgba(239, 68, 68, 0.3);
                        }
                        h2 { font-size: 1.85rem; font-weight: 700; margin: 0 0 0.75rem 0; color: #ffffff; letter-spacing: -0.01em; }
                        p { color: rgba(255, 255, 255, 0.75); font-size: 0.98rem; line-height: 1.55; margin: 0 0 1.75rem 0; }
                        .btn {
                            display: inline-flex;
                            align-items: center;
                            justify-content: center;
                            min-width: 180px;
                            padding: 0.9rem 2.75rem;
                            border-radius: 100px;
                            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                            color: #ffffff;
                            font-size: 1.15rem;
                            font-weight: 700;
                            letter-spacing: 0.5px;
                            border: 1px solid rgba(255, 255, 255, 0.3);
                            box-shadow: 0 10px 30px rgba(16, 185, 129, 0.4), inset 0 1px 1px 0 rgba(255, 255, 255, 0.35);
                            text-decoration: none;
                            cursor: pointer;
                            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                        }
                        .btn:hover {
                            background: linear-gradient(135deg, #059669 0%, #047857 100%);
                            border-color: rgba(255, 255, 255, 0.5);
                            box-shadow: 0 14px 35px rgba(16, 185, 129, 0.5), inset 0 1px 1px 0 rgba(255, 255, 255, 0.45);
                            transform: translateY(-2px) scale(1.03);
                        }
                        .btn:active { transform: scale(0.97); }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div class="icon-badge">❌</div>
                        <h2>Verification Failed</h2>
                        <p>Invalid or expired verification token.</p>
                        <a href="/" class="btn">Return to Nourish Network</a>
                    </div>
                </body>
                </html>
            `);
        }

        // Update user status
        db.run(
            `UPDATE users SET isVerified = 1, verificationToken = NULL, verificationTokenExpires = NULL, verificationOtp = NULL WHERE id = ?`,
            [user.id],
            (err) => {
                if (err) {
                    return res.status(500).send("Database error updating verification status.");
                }

                const updatedUser = { ...user, isVerified: 1 };
                const userToken = makeToken(updatedUser);

                res.send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Email Verified - Nourish Network</title>
                        <style>
                            * { box-sizing: border-box; }
                            body {
                                background: radial-gradient(circle at 50% 30%, #0d261d 0%, #050d09 70%, #020604 100%);
                                color: #ffffff;
                                font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                min-height: 100vh;
                                margin: 0;
                                padding: 1.5rem;
                            }
                            .card {
                                width: 100%;
                                max-width: 410px;
                                background: #091913;
                                border: 1.5px solid rgba(16, 185, 129, 0.45);
                                border-radius: 32px;
                                padding: 3rem 2.25rem 2.5rem;
                                text-align: center;
                                box-shadow: 0 35px 90px rgba(0, 0, 0, 0.95), 0 0 45px rgba(16, 185, 129, 0.25);
                                animation: cardAppear 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                            }
                            @keyframes cardAppear {
                                from { opacity: 0; transform: translateY(20px) scale(0.96); }
                                to { opacity: 1; transform: translateY(0) scale(1); }
                            }
                            .icon-badge {
                                width: 80px;
                                height: 80px;
                                margin: 0 auto 1.5rem;
                                border-radius: 50%;
                                background: rgba(16, 185, 129, 0.15);
                                border: 1.5px solid rgba(16, 185, 129, 0.4);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-size: 2.2rem;
                                color: #34d399;
                                box-shadow: 0 0 30px rgba(16, 185, 129, 0.35);
                            }
                            h2 {
                                font-size: 1.85rem;
                                font-weight: 700;
                                margin: 0 0 0.85rem 0;
                                color: #ffffff;
                                letter-spacing: -0.01em;
                            }
                            p {
                                color: rgba(255, 255, 255, 0.85);
                                font-size: 1rem;
                                line-height: 1.55;
                                margin: 0 0 0.5rem 0;
                            }
                            .org-name {
                                color: #34d399;
                                font-weight: 700;
                            }
                            .sub-text {
                                font-size: 0.92rem;
                                color: rgba(255, 255, 255, 0.65);
                                margin-bottom: 1.75rem;
                            }
                            .btn {
                                display: inline-flex;
                                align-items: center;
                                justify-content: center;
                                min-width: 180px;
                                padding: 0.8rem 2rem;
                                border-radius: 100px;
                                background: rgba(16, 185, 129, 0.15);
                                color: #34d399;
                                font-size: 0.95rem;
                                font-weight: 600;
                                letter-spacing: 0.3px;
                                border: 1px solid rgba(16, 185, 129, 0.4);
                                text-decoration: none;
                                cursor: pointer;
                                transition: all 0.25s ease;
                                margin-top: 10px;
                            }
                            .btn:hover {
                                background: rgba(16, 185, 129, 0.3);
                                border-color: rgba(16, 185, 129, 0.6);
                                color: #ffffff;
                                transform: translateY(-2px);
                            }
                        </style>
                    </head>
                    <body>
                        <div class="card">
                            <div class="icon-badge">✨</div>
                            <h2>Account Verified!</h2>
                            <p>Welcome, <span class="org-name">${user.organizationName}</span>!</p>
                            
                            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 16px; padding: 18px 16px; margin: 20px 0; text-align: left;">
                                <p style="font-size: 0.95rem; color: #6ee7b7; margin: 0 0 6px 0; font-weight: 600;">
                                    💻 Laptop / Computer Signed In!
                                </p>
                                <p style="font-size: 0.86rem; color: rgba(255, 255, 255, 0.75); margin: 0; line-height: 1.55;">
                                    Your computer detected this verification and has already signed in to your portal. You can safely close this page on your phone.
                                </p>
                            </div>

                            <a href="/?verified=true" class="btn">Open Portal on this device instead</a>
                        </div>
                        <script>
                            // Store tokens in case user taps "Open Portal on this device instead"
                            const userObj = ${JSON.stringify({
                                id: user.id,
                                email: user.email,
                                name: user.organizationName,
                                organizationName: user.organizationName,
                                type: user.accountType,
                                accountType: user.accountType,
                                fssaiCode: user.fssaiCode || '',
                                darpanId: user.darpanId || '',
                                bio: user.bio || '',
                                address: user.address || '',
                                contactPerson: user.contactPerson || '',
                                publicPhone: user.publicPhone || user.phone || '',
                                website: user.website || '',
                                pickupWindow: user.pickupWindow || '',
                                pickupInstructions: user.pickupInstructions || '',
                                avatarUrl: user.avatarUrl || '',
                                isVerified: 1
                            })};
                            sessionStorage.setItem('nourishUser', JSON.stringify(userObj));
                            sessionStorage.setItem('nourishToken', "${userToken}");
                            localStorage.setItem('nourishUser', JSON.stringify(userObj));
                            localStorage.setItem('nourishToken', "${userToken}");
                            // No auto-redirect: stays on confirmation card
                        </script>
                    </body>
                    </html>
                `);
            }
        );
    });
});

// 2c. FORGOT PASSWORD - REQUEST RESET LINK (POST /api/forgot-password)
app.post('/api/forgot-password', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email address is required.' });

    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) {
            return res.status(404).json({ error: 'No account found with this email address.' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        db.run(
            `UPDATE users SET resetToken = ?, resetTokenExpires = ? WHERE id = ?`,
            [resetToken, resetTokenExpires, user.id],
            (err) => {
                if (err) return res.status(500).json({ error: 'Database error storing reset token.' });

                const hostUrl = `${req.protocol}://${req.get('host')}`;
                sendPasswordResetEmail({
                    toEmail: user.email,
                    name: user.organizationName,
                    token: resetToken,
                    hostUrl
                }).catch(e => console.error("Async Reset Email Error:", e));

                res.status(200).json({
                    message: 'Password reset link sent to your email address! Please check your inbox.',
                    email: user.email
                });
            }
        );
    });
});

// 2d. VERIFY RESET TOKEN (GET /api/verify-reset-token)
app.get('/api/verify-reset-token', (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ valid: false, error: 'Reset token is required.' });

    db.get(`SELECT id, email, organizationName, resetTokenExpires FROM users WHERE resetToken = ?`, [token], (err, user) => {
        if (err || !user) return res.status(400).json({ valid: false, error: 'Invalid or expired password reset link.' });

        if (user.resetTokenExpires && new Date(user.resetTokenExpires) < new Date()) {
            return res.status(400).json({ valid: false, error: 'Password reset link has expired. Please request a new one.' });
        }

        res.status(200).json({ valid: true, email: user.email, name: user.organizationName });
    });
});

// 2e. RESET PASSWORD SUBMISSION (POST /api/reset-password)
app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required.' });
    if (newPassword.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters.' });

    db.get(`SELECT * FROM users WHERE resetToken = ?`, [token], async (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Invalid or expired reset token.' });

        if (user.resetTokenExpires && new Date(user.resetTokenExpires) < new Date()) {
            return res.status(400).json({ error: 'Reset link has expired. Please request a new password reset.' });
        }

        try {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            db.run(
                `UPDATE users SET password = ?, resetToken = NULL, resetTokenExpires = NULL, isVerified = 1 WHERE id = ?`,
                [hashedPassword, user.id],
                (err) => {
                    if (err) return res.status(500).json({ error: 'Failed to update password.' });

                    const updatedUser = { ...user, isVerified: 1 };
                    const userToken = makeToken(updatedUser);

                    // Send custom Password Changed Confirmation Email asynchronously on immediate microtick
                    setImmediate(() => {
                        sendPasswordChangedEmail({
                            toEmail: user.email,
                            name: user.organizationName,
                            changedTime: new Date().toISOString()
                        }).catch(e => console.error("Async Password Changed Email Error:", e));
                    });

                    res.status(200).json({
                        message: 'Password updated successfully! 🎉',
                        token: userToken,
                        user: { id: user.id, email: user.email, name: user.organizationName, type: user.accountType, isVerified: 1 }
                    });
                }
            );
        } catch (e) {
            res.status(500).json({ error: 'Encryption error.' });
        }
    });
});

// 2c. EMAIL VERIFICATION VIA OTP CODE (POST /api/verify-otp)
// Body: { email, otp }
app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ error: 'Please provide both email and 6-digit OTP code.' });
    }

    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: 'User account not found.' });
        }

        if (user.isVerified) {
            const token = makeToken(user);
            return res.status(200).json({
                message: 'Account is already verified!',
                user: { id: user.id, email: user.email, name: user.organizationName, type: user.accountType, isVerified: 1 },
                token
            });
        }

        if (user.verificationOtp !== otp.toString().trim()) {
            return res.status(400).json({ error: 'Invalid 6-digit verification code. Please check your email.' });
        }

        if (user.verificationTokenExpires && new Date(user.verificationTokenExpires) < new Date()) {
            return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
        }

        // Verify user
        db.run(
            `UPDATE users SET isVerified = 1, verificationToken = NULL, verificationTokenExpires = NULL, verificationOtp = NULL WHERE id = ?`,
            [user.id],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });

                const updatedUser = { ...user, isVerified: 1 };
                const token = makeToken(updatedUser);

                res.status(200).json({
                    message: 'Email verified successfully! 🎉',
                    user: {
                        id: user.id,
                        email: user.email,
                        name: user.organizationName,
                        organizationName: user.organizationName,
                        type: user.accountType,
                        accountType: user.accountType,
                        phone: user.phone || '',
                        bio: user.bio || '',
                        address: user.address || '',
                        avatarUrl: user.avatarUrl || '',
                        contactPerson: user.contactPerson || '',
                        publicPhone: user.publicPhone || user.phone || '',
                        website: user.website || '',
                        fssaiCode: user.fssaiCode || '',
                        darpanId: user.darpanId || '',
                        pickupWindow: user.pickupWindow || '',
                        pickupInstructions: user.pickupInstructions || '',
                        isVerified: 1
                    },
                    token
                });
            }
        );
    });
});

// 2c-bis. CHECK ACCOUNT VERIFICATION STATUS (GET /api/check-verification)
// Query: ?email=...
// Used by laptop/desktop to auto-detect when mobile verification link is tapped!
app.get('/api/check-verification', (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Email address is required.' });

    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (err || !user) return res.status(404).json({ verified: false });

        if (user.isVerified) {
            const token = makeToken(user);
            return res.status(200).json({
                verified: true,
                message: 'Account verified! 🎉',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.organizationName,
                    organizationName: user.organizationName,
                    type: user.accountType,
                    accountType: user.accountType,
                    phone: user.phone || '',
                    bio: user.bio || '',
                    address: user.address || '',
                    avatarUrl: user.avatarUrl || '',
                    contactPerson: user.contactPerson || '',
                    publicPhone: user.publicPhone || user.phone || '',
                    website: user.website || '',
                    fssaiCode: user.fssaiCode || '',
                    darpanId: user.darpanId || '',
                    pickupWindow: user.pickupWindow || '',
                    pickupInstructions: user.pickupInstructions || '',
                    isVerified: 1
                }
            });
        }

        return res.status(200).json({ verified: false });
    });
});

// 2d. RESEND VERIFICATION EMAIL (POST /api/resend-verification)
// Body: { email }
app.post('/api/resend-verification', (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Please provide email address.' });
    }

    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: 'User account not found.' });
        }

        if (user.isVerified) {
            return res.status(200).json({ message: 'This account is already verified!' });
        }

        // Generate new token and 6-digit OTP
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        db.run(
            `UPDATE users SET verificationToken = ?, verificationTokenExpires = ?, verificationOtp = ? WHERE id = ?`,
            [verificationToken, verificationTokenExpires, verificationOtp, user.id],
            async (err) => {
                if (err) return res.status(500).json({ error: err.message });

                const hostUrl = `${req.protocol}://${req.get('host')}`;
                sendVerificationEmail({
                    toEmail: email,
                    name: user.organizationName,
                    token: verificationToken,
                    otpCode: verificationOtp,
                    hostUrl
                }).catch(e => console.error("Async Resend Email Error:", e));

                res.status(200).json({
                    message: `Verification code sent to ${email}! Please check your inbox.`,
                    email
                });
            }
        );
    });
});

// 3. CONTACT FORM
// POST /api/contact
// Body: { name, email, subject?, message }
app.post('/api/contact', (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Please provide name, email, and message.' });
    }

    const date = new Date().toISOString();
    db.run(
        `INSERT INTO contacts (name, email, subject, message, date) VALUES (?, ?, ?, ?, ?)`,
        [name, email, subject || '', message, date],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ message: 'Your message has been received. We\'ll be in touch!' });
        }
    );
});

// 3b. USER PROFILE ENDPOINTS
// GET /api/user/me
app.get('/api/user/me', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) return res.status(401).json({ error: 'Access token required' });

    if (token.startsWith('demo-token') || token.includes('demo')) {
        return res.status(200).json({
            id: 888,
            organizationName: 'Elite Catering Services',
            email: 'serverdemo@gmail.com',
            accountType: 'restaurant',
            type: 'restaurant',
            contactPerson: 'Chef Marco Rossi',
            publicPhone: '+91 98765 43210',
            phone: '+91 98765 43210',
            address: '45, MG Road, Indiranagar, Bengaluru - 560038',
            bio: 'Award-winning catering company specializing in surplus gourmet meals, fresh salads, and artisanal breads.',
            website: 'www.elitecatering.com',
            fssaiCode: '12345678901234',
            pickupInstructions: 'Enter through rear kitchen door. Contact shift manager.',
            isVerified: 1,
            avatarUrl: 'assets/default-avatar.jpg'
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        db.get(`SELECT id, email, organizationName, accountType, phone, bio, address, avatarUrl, contactPerson, publicPhone, website, fssaiCode, darpanId, ngoRegType, pickupWindow, pickupInstructions, isVerified FROM users WHERE id = ?`, [decoded.id], (err, user) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!user) {
                return res.status(200).json({
                    id: decoded.id,
                    email: decoded.email,
                    organizationName: decoded.name || decoded.organizationName,
                    accountType: decoded.type || decoded.accountType,
                    isVerified: decoded.isVerified ? 1 : 0
                });
            }
            res.status(200).json(user);
        });
    } catch (e) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
});

// PUT /api/user/me
app.put('/api/user/me', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) return res.status(401).json({ error: 'Access token required' });

    const { organizationName, name, phone, bio, address, avatarUrl, contactPerson, publicPhone, website, fssaiCode, darpanId, ngoRegType, pickupInstructions, pickupWindow } = req.body;
    const org = organizationName || name || null;
    const pubPhone = publicPhone || phone || null;

    if (token.startsWith('demo-token') || token.includes('demo')) {
        return res.status(200).json({
            message: 'Profile updated successfully!',
            user: {
                id: 888,
                organizationName: org || 'Elite Catering Services',
                name: org || 'Elite Catering Services',
                email: req.body.email || 'user@nourishnetwork.com',
                accountType: 'restaurant',
                phone: pubPhone || '',
                bio: bio || '',
                address: address || '',
                contactPerson: contactPerson || '',
                publicPhone: pubPhone || '',
                website: website || '',
                fssaiCode: fssaiCode || '',
                darpanId: darpanId || '',
                pickupInstructions: pickupInstructions || '',
                pickupWindow: pickupWindow || '',
                avatarUrl: avatarUrl || 'assets/default-avatar.jpg',
                isVerified: 0
            }
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        db.run(
            `UPDATE users SET 
                organizationName = COALESCE(?, organizationName),
                phone = COALESCE(?, phone),
                bio = COALESCE(?, bio),
                address = COALESCE(?, address),
                avatarUrl = COALESCE(?, avatarUrl),
                contactPerson = COALESCE(?, contactPerson),
                publicPhone = COALESCE(?, publicPhone),
                website = COALESCE(?, website),
                fssaiCode = COALESCE(?, fssaiCode),
                darpanId = COALESCE(?, darpanId),
                ngoRegType = COALESCE(?, ngoRegType),
                pickupInstructions = COALESCE(?, pickupInstructions),
                pickupWindow = COALESCE(?, pickupWindow)
            WHERE id = ?`,
            [org, pubPhone, bio || null, address || null, avatarUrl || null, contactPerson || null, pubPhone, website || null, fssaiCode || null, darpanId || null, ngoRegType || null, pickupInstructions || null, pickupWindow || null, decoded.id],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                db.get(`SELECT id, email, organizationName, accountType, phone, bio, address, avatarUrl, contactPerson, publicPhone, website, fssaiCode, darpanId, ngoRegType, pickupWindow, pickupInstructions, isVerified FROM users WHERE id = ?`, [decoded.id], (err, updatedUser) => {
                    res.status(200).json({
                        message: 'Profile updated successfully!',
                        user: updatedUser
                    });
                });
            }
        );
    } catch (e) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
});

// 4. GET ALL LISTINGS (public feed)
// GET /api/listings?vendorId=&category=&status=
app.get('/api/listings', (req, res) => {
    const { vendorId, category, status } = req.query;

    let sql = `
        SELECT f.*, 
               u.bio as vendorBio, 
               u.avatarUrl as vendorAvatar,
               u.fssaiCode,
               u.isVerified,
               u.pickupWindow,
               u.pickupInstructions
        FROM food_listings f
        LEFT JOIN users u ON f.vendorId = u.id
        WHERE 1=1
    `;
    let params = [];

    if (vendorId) {
        sql += ` AND f.vendorId = ?`;
        params.push(vendorId);
    } else {
        // Public feed: only available items by default
        const targetStatus = status || 'available';
        sql += ` AND f.status = ?`;
        params.push(targetStatus);
    }

    if (category && category !== 'All') {
        sql += ` AND f.category = ?`;
        params.push(category);
    }

    sql += ` ORDER BY f.datePosted DESC`;

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error("Database Error (/api/listings):", err);
            return res.status(500).json({ error: "Database error. Please refresh and try again." });
        }
        res.status(200).json(rows || []);
    });
});

// 5. PLATFORM STATS (public)
// GET /api/stats
app.get('/api/stats', (req, res) => {
    const queries = {
        totalMealsSaved: `SELECT SUM(CAST(quantity AS REAL)) as count FROM food_listings WHERE status IN ('claimed','sold')`,
        totalKgShared: `SELECT SUM(CASE WHEN LOWER(unit) = 'kg' THEN CAST(quantity AS REAL) ELSE CAST(quantity AS REAL) * 0.4 END) as count FROM food_listings WHERE status IN ('claimed','sold')`,
        totalVendors: `SELECT COUNT(*) as count FROM users WHERE accountType IN ('restaurant','vendor')`,
        totalNGOs: `SELECT COUNT(*) as count FROM users WHERE accountType IN ('ngo','shelter')`
    };

    const results = {};
    const keys = Object.keys(queries);
    let done = 0;

    keys.forEach(key => {
        db.get(queries[key], [], (err, row) => {
            if (err) {
                console.error(`Stats Error (${key}):`, err);
                results[key] = 0;
            } else {
                results[key] = (row && row.count !== null) ? row.count : 0;
            }

            if (++done === keys.length) {
                res.status(200).json(results);
            }
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED ENDPOINTS  (require Authorization: Bearer <token>)
// ─────────────────────────────────────────────────────────────────────────────

// 6. GET MY PROFILE
// GET /api/user/me
app.get('/api/user/me', authenticateToken, (req, res) => {
    db.get(`SELECT id, accountType, organizationName, email, phone, address, bio, avatarUrl, isVerified, contactPerson, publicPhone, website, fssaiCode, darpanId, ngoRegType, pickupWindow, pickupInstructions, createdAt
            FROM users WHERE id = ?`, [req.user.id], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'User not found.' });
        res.status(200).json(user);
    });
});

// 6b. UPDATE MY PROFILE
// PUT /api/user/me
app.put('/api/user/me', authenticateToken, (req, res) => {
    const {
        organizationName, phone, address, bio, avatarUrl,
        contactPerson, publicPhone, website, fssaiCode, darpanId, ngoRegType,
        pickupWindow, pickupInstructions
    } = req.body;

    const sql = `
        UPDATE users SET
            organizationName   = COALESCE(?, organizationName),
            phone              = COALESCE(?, phone),
            address            = COALESCE(?, address),
            bio                = COALESCE(?, bio),
            avatarUrl          = COALESCE(?, avatarUrl),
            contactPerson      = COALESCE(?, contactPerson),
            publicPhone        = COALESCE(?, publicPhone),
            website            = COALESCE(?, website),
            fssaiCode          = COALESCE(?, fssaiCode),
            darpanId           = COALESCE(?, darpanId),
            ngoRegType         = COALESCE(?, ngoRegType),
            pickupWindow       = COALESCE(?, pickupWindow),
            pickupInstructions = COALESCE(?, pickupInstructions)
        WHERE id = ?
    `;

    db.run(sql, [
        organizationName || null,
        phone || null,
        address || null,
        bio || null,
        avatarUrl || null,
        contactPerson || null,
        publicPhone || null,
        website || null,
        fssaiCode || null,
        darpanId || null,
        ngoRegType || null,
        pickupWindow || null,
        pickupInstructions || null,
        req.user.id
    ], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json({ message: 'Profile updated successfully!' });
    });
});

// 7. UPLOAD FOOD IMAGE
// POST /api/upload  (multipart form: field name = "image")
app.post('/api/upload', authenticateToken, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image file provided.' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.status(200).json({ message: 'Image uploaded successfully!', imageUrl });
});

// Helper: Resolve external image links, Google share shortlinks, drive links, and search redirects
async function resolveExternalImageUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
    let url = rawUrl.trim();

    // 1. Direct Google imgurl or redirect query parameters
    if (url.includes('google.') && (url.includes('imgurl=') || url.includes('/imgres'))) {
        try {
            const match = url.match(/[?&]imgurl=([^&]+)/);
            if (match && match[1]) return decodeURIComponent(match[1]);
        } catch (e) { }
    }

    // 2. Google Drive links
    if (url.includes('drive.google.com')) {
        const driveIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (driveIdMatch && driveIdMatch[1]) {
            return `https://lh3.googleusercontent.com/d/${driveIdMatch[1]}`;
        }
    }

    // 3. Google share links (e.g. share.google/...) and redirector/shortened links
    if (url.includes('share.google') || url.includes('goo.gl') || url.includes('bit.ly') || url.includes('tinyurl.com')) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 6000);
            const res = await fetch(url, {
                redirect: 'follow',
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            clearTimeout(timeout);

            const finalUrl = res.url || '';
            if (finalUrl) {
                try {
                    const u = new URL(finalUrl);
                    if (u.searchParams.get('imgurl')) {
                        return decodeURIComponent(u.searchParams.get('imgurl'));
                    }
                    if (u.searchParams.get('url')) {
                        const direct = decodeURIComponent(u.searchParams.get('url'));
                        if (/^https?:\/\//i.test(direct)) return direct;
                    }
                } catch (e) { }
            }

            const html = await res.text();
            const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
                         || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
            if (ogMatch && ogMatch[1]) {
                return ogMatch[1];
            }
        } catch (e) {
            console.error('Failed to resolve short URL:', e.message);
        }
    }

    return url;
}

// GET /api/resolve-image?url=...
app.get('/api/resolve-image', async (req, res) => {
    const rawUrl = req.query.url;
    if (!rawUrl) return res.status(400).json({ error: 'URL is required' });
    try {
        const resolvedUrl = await resolveExternalImageUrl(rawUrl);
        res.json({ resolvedUrl });
    } catch (err) {
        res.status(500).json({ error: 'Failed to resolve image URL' });
    }
});

// 8. CREATE FOOD LISTING
// POST /api/listings
// Body: { name, description?, category, price, quantity, unit, expiryTime?, pickupTime?, condition, allergens?, imageUrl? }
app.post('/api/listings', authenticateToken, async (req, res) => {
    const {
        name, description, category, price,
        quantity, unit, expiryTime, pickupTime,
        condition, allergens, imageUrl
    } = req.body;

    if (!name || !quantity) {
        return res.status(400).json({ error: 'Food name and quantity are required.' });
    }

    let finalImageUrl = imageUrl || null;
    if (finalImageUrl) {
        try {
            finalImageUrl = await resolveExternalImageUrl(finalImageUrl);
        } catch (e) { }
    }

    const sql = `
        INSERT INTO food_listings
            (vendorId, vendorName, name, description, category, price, quantity, unit,
             expiryTime, pickupTime, condition, allergens, imageUrl, datePosted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    const params = [
        req.user.id,
        req.user.name,
        name,
        description || '',
        category || 'Cooked',
        parseFloat(price) || 0,
        quantity,
        unit || 'Plate',
        expiryTime || null,
        pickupTime || null,
        condition || 'Fresh',
        allergens || null,
        finalImageUrl || null
    ];

    db.run(sql, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        const listingId = this.lastID;

        // Broadcast notification email to all registered buyers/NGOs in background
        const hostUrl = `${req.protocol}://${req.get('host')}`;
        setImmediate(() => {
            db.all(
                `SELECT email, organizationName FROM users WHERE accountType IN ('ngo', 'shelter', 'buyer') AND isVerified = 1`,
                [],
                (qErr, buyers) => {
                    if (!qErr && buyers && buyers.length > 0) {
                        sendFoodPublishedBroadcastEmail({
                            buyers,
                            sellerName: req.user.name || 'Local Food Partner',
                            foodItem: {
                                name,
                                description,
                                category,
                                price,
                                quantity,
                                unit,
                                expiryTime
                            },
                            hostUrl
                        }).catch(e => console.error("Async Broadcast Email Error:", e));
                    }
                }
            );
        });

        res.status(201).json({
            message: 'Food listing published successfully! 🌱',
            id: listingId
        });
    });
});

// 9. UPDATE A LISTING (vendor who owns it)
// PUT /api/listings/:id
app.put('/api/listings/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const {
        name, description, category, price,
        quantity, unit, expiryTime, pickupTime,
        condition, allergens, imageUrl, status
    } = req.body;

    // First verify ownership
    db.get(`SELECT vendorId FROM food_listings WHERE id = ?`, [id], async (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Listing not found.' });
        if (Number(row.vendorId) !== Number(req.user.id)) {
            return res.status(403).json({ error: 'You can only edit your own listings.' });
        }

        let finalImageUrl = imageUrl !== undefined ? imageUrl : null;
        if (finalImageUrl) {
            try {
                finalImageUrl = await resolveExternalImageUrl(finalImageUrl);
            } catch (e) { }
        }

        const sql = `
            UPDATE food_listings SET
                name        = COALESCE(?, name),
                description = COALESCE(?, description),
                category    = COALESCE(?, category),
                price       = COALESCE(?, price),
                quantity    = COALESCE(?, quantity),
                unit        = COALESCE(?, unit),
                expiryTime  = COALESCE(?, expiryTime),
                pickupTime  = COALESCE(?, pickupTime),
                condition   = COALESCE(?, condition),
                allergens   = COALESCE(?, allergens),
                imageUrl    = COALESCE(?, imageUrl),
                status      = COALESCE(?, status)
            WHERE id = ?
        `;
        const params = [
            name || null, description || null, category || null,
            price !== undefined ? parseFloat(price) : null,
            quantity || null, unit || null, expiryTime || null,
            pickupTime || null, condition || null,
            allergens || null, finalImageUrl || null, status || null,
            id
        ];

        db.run(sql, params, function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(200).json({ message: 'Listing updated successfully!' });
        });
    });
});

// 10. DELETE A LISTING (vendor who owns it)
// DELETE /api/listings/:id
app.delete('/api/listings/:id', authenticateToken, (req, res) => {
    const { id } = req.params;

    db.get(`SELECT vendorId FROM food_listings WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Listing not found.' });
        if (Number(row.vendorId) !== Number(req.user.id)) {
            return res.status(403).json({ error: 'You can only delete your own listings.' });
        }

        db.run(`DELETE FROM food_listings WHERE id = ?`, [id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(200).json({ message: 'Listing deleted successfully.' });
        });
    });
});

// 11. CLAIM A LISTING (NGO only)
// POST /api/listings/claim
// Body: { listingId }
app.post('/api/listings/claim', authenticateToken, (req, res) => {
    const { listingId } = req.body;
    const ngoId = req.user.id;

    if (!listingId) {
        return res.status(400).json({ error: 'listingId is required.' });
    }

    const sql = `
        UPDATE food_listings
        SET status    = 'claimed',
            claimedBy = ?
        WHERE id = ? AND status = 'available'
    `;

    db.run(sql, [ngoId, listingId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(400).json({ error: 'Listing not found or already claimed.' });

        // Notify seller about claimed food in background
        const hostUrl = `${req.protocol}://${req.get('host')}`;
        setImmediate(() => {
            db.get(
                `SELECT f.name as foodName, f.price, f.quantity, u.email as sellerEmail, u.organizationName as sellerName 
                 FROM food_listings f 
                 JOIN users u ON f.vendorId = u.id 
                 WHERE f.id = ?`,
                [listingId],
                (sErr, row) => {
                    if (!sErr && row && row.sellerEmail) {
                        sendSellerOrderNotificationEmail({
                            sellerEmail: row.sellerEmail,
                            sellerName: row.sellerName,
                            buyerName: req.user.name || 'Community Partner',
                            buyerEmail: req.user.email,
                            foodName: row.foodName,
                            quantity: row.quantity || 1,
                            totalPrice: 0,
                            notes: 'Claimed by NGO Partner',
                            hostUrl
                        }).catch(e => console.error("Async Claim Seller Email Error:", e));
                    }
                }
            );
        });

        res.status(200).json({ message: 'Food successfully claimed! 🤝' });
    });
});

// 12. CHECKOUT / PLACE ORDER
// POST /api/checkout
// Body: { items: [{ listingId, quantity }], notes? }
app.post('/api/checkout', authenticateToken, (req, res) => {
    const { items, notes } = req.body;
    const buyerId = req.user.id;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'No items in basket.' });
    }

    let processed = 0;
    const errors = [];

    items.forEach(({ listingId, quantity, price }) => {
        const qty = parseInt(quantity) || 1;
        const totalPrice = parseFloat(price) * qty || 0;

        // Step 1: Atomically deduct quantity and mark sold if depleted
        db.run(
            `UPDATE food_listings
             SET quantity = CASE 
                 WHEN CAST(quantity AS INTEGER) - ? <= 0 THEN '0' 
                 ELSE CAST(CAST(quantity AS INTEGER) - ? AS TEXT) 
             END,
             status = CASE 
                 WHEN CAST(quantity AS INTEGER) - ? <= 0 THEN 'sold' 
                 ELSE status 
             END
             WHERE id = ? AND status = 'available'`,
            [qty, qty, qty, listingId],
            function (updateErr) {
                if (updateErr) {
                    console.error("Checkout UPDATE error for listing", listingId, updateErr);
                    errors.push(updateErr.message);
                }

                // Step 2: Insert order record
                db.run(
                    `INSERT INTO orders (buyerId, listingId, quantity, totalPrice, notes)
                     VALUES (?, ?, ?, ?, ?)`,
                    [buyerId, listingId, qty, totalPrice, notes || null],
                    (insertErr) => {
                        if (insertErr) errors.push(insertErr.message);

                        processed++;
                        if (processed === items.length) {
                            if (errors.length > 0) {
                                return res.status(500).json({ error: errors.join(', ') });
                            }

                            // Notify sellers asynchronously (non-blocking)
                            const hostUrl = `${req.protocol}://${req.get('host')}`;
                            setImmediate(() => {
                                items.forEach(({ listingId, quantity, price }) => {
                                    db.get(
                                        `SELECT f.name as foodName, f.price, u.email as sellerEmail, u.organizationName as sellerName
                                         FROM food_listings f
                                         JOIN users u ON f.vendorId = u.id
                                         WHERE f.id = ?`,
                                        [listingId],
                                        (sErr, row) => {
                                            if (!sErr && row && row.sellerEmail) {
                                                sendSellerOrderNotificationEmail({
                                                    sellerEmail: row.sellerEmail,
                                                    sellerName: row.sellerName,
                                                    buyerName: req.user.name || 'Community Partner',
                                                    buyerEmail: req.user.email,
                                                    foodName: row.foodName,
                                                    quantity: quantity || 1,
                                                    totalPrice: (parseFloat(price || row.price) * (parseInt(quantity) || 1)) || 0,
                                                    notes,
                                                    hostUrl
                                                }).catch(e => console.error("Async Seller Order Email Error:", e));
                                            }
                                        }
                                    );
                                });
                            });

                            // ✅ Response sent INSIDE the final UPDATE callback —
                            // guarantees DB is committed before client calls refreshState
                            res.status(201).json({
                                message: 'Order placed successfully! Thank you for reducing food waste. 🌱',
                                count: processed
                            });
                        }
                    }
                );
            }
        );
    });
});



// 13. GET ORDER HISTORY
// GET /api/orders
app.get('/api/orders', authenticateToken, (req, res) => {
    const buyerId = req.user.id;
    const sql = `
        SELECT o.*, f.name as foodName, f.vendorName, f.category, f.imageUrl
        FROM orders o
        JOIN food_listings f ON o.listingId = f.id
        WHERE o.buyerId = ?
        ORDER BY o.createdAt DESC
    `;
    db.all(sql, [buyerId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json(rows);
    });
});

// ─── FALLBACK: Serve index.html for any non-API route ────────────────────────
app.get('/{*path}', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

// ─── TEMPORARY CLEANUP ENDPOINT ───────────────────────────────────────────────
app.get('/api/cleanup-listings', (req, res) => {
    const sql = `DELETE FROM food_listings WHERE name IN ('lp.okijuh', 'lp,okijuh', 'wesrdtfgybh') OR name LIKE '%okijuh%' OR name LIKE '%wesrdtfgybh%'`;
    db.run(sql, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json({ message: `Cleanup successful! Deleted ${this.changes} garbage listings.` });
    });
});

// ─── BACKGROUND AUTO-PURGE (EXPIRATION & GARBAGE CLEANUP) ───────────────────────
setInterval(() => {
    db.all(`SELECT id, name, expiryTime, status FROM food_listings`, [], (err, rows) => {
        if (err || !rows || rows.length === 0) return;
        const now = Date.now();
        const garbageNames = ['lp.okijuh', 'lp,okijuh', 'wesrdtfgybh'];

        const expiredOrGarbageIds = rows.filter(r => {
            if (garbageNames.includes(r.name) || (r.name && r.name.toLowerCase().includes('okijuh'))) return true;
            if (!r.expiryTime) return false;
            const exp = new Date(r.expiryTime).getTime();
            if (isNaN(exp)) return true; // Purge unparseable date strings
            return now >= exp; // Expired
        }).map(r => r.id);

        if (expiredOrGarbageIds.length > 0) {
            const placeholders = expiredOrGarbageIds.map(() => '?').join(',');
            db.run(`DELETE FROM food_listings WHERE id IN (${placeholders})`, expiredOrGarbageIds, function (err) {
                if (err) {
                    console.error("Auto-purge DB error:", err.message);
                } else if (this.changes > 0) {
                    console.log(`🌿 Auto-purged ${this.changes} expired/garbage food listing(s) from database.`);
                }
            });
        }
    });
}, 15000); // Check every 15 seconds

// ─── START SERVER ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log('');
    console.log('🌿 ─────────────────────────────────────────');
    console.log(`🌿  Nourish Network Server is LIVE`);
    console.log(`🌿  http://localhost:${PORT}`);
    console.log('🌿 ─────────────────────────────────────────');
    console.log('');
});

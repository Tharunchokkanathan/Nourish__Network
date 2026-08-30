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
    sendSellerOrderNotificationEmail
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
    const { accountType, organizationName, email, password, phone, address } = req.body;

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

        const sql = `INSERT INTO users (accountType, organizationName, email, password, phone, address, isVerified, verificationToken, verificationTokenExpires, verificationOtp)
                    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`;

        db.run(sql, [
            accountType,
            organizationName,
            email,
            hashed,
            phone || null,
            address || null,
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
                isVerified: 1
            };
            const token = makeToken(user);

            // Send registration welcome email in background on immediate microtick
            const hostUrl = `${req.protocol}://${req.get('host')}`;
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
                message: 'Account created successfully! Welcome to Nourish Network 🎉',
                token,
                user: { id: userId, email, name: organizationName, type: accountType, isVerified: 1 }
            });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. LOGIN
// POST /api/login
// Body: { email, password }
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Please provide email and password.' });
    }

    // --- HACKATHON DEMO LOGIN BYPASS ---
    // Professional demo accounts for judges and testers
    if (email === 'serverdemo@gmail.com' && password === 'demo123') {
        const user = { id: 888, email: 'serverdemo@gmail.com', accountType: 'restaurant', organizationName: 'Elite Catering (Demo)', isVerified: 1 };
        sendLoginNotificationEmail({
            toEmail: user.email,
            name: user.organizationName,
            accountType: user.accountType,
            loginTime: new Date().toISOString()
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
            loginTime: new Date().toISOString()
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

            const token = makeToken(user);

            // Send purely informational Login Success Notification Email asynchronously on immediate microtick
            setImmediate(() => {
                sendLoginNotificationEmail({
                    toEmail: user.email,
                    name: user.organizationName,
                    accountType: user.accountType,
                    loginTime: new Date().toISOString()
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

// 2b. EMAIL VERIFICATION VIA LINK (GET /api/verify-email?token=...)
app.get('/api/verify-email', (req, res) => {
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
                            .btn:active {
                                transform: scale(0.97);
                            }
                        </style>
                    </head>
                    <body>
                        <div class="card">
                            <div class="icon-badge">🌿</div>
                            <h2>Email Verified Successfully!</h2>
                            <p>Welcome, <span class="org-name">${user.organizationName}</span>! Your account is now activated.</p>
                            <p class="sub-text">Redirecting to your <strong>${user.accountType === 'ngo' || user.accountType === 'shelter' ? 'Buyer' : 'Seller'} Portal</strong>...</p>
                            <a href="/?verified=true" class="btn">Launch Dashboard Now</a>
                        </div>
                        <script>
                            const userObj = ${JSON.stringify({
                                id: user.id,
                                email: user.email,
                                name: user.organizationName,
                                type: user.accountType,
                                accountType: user.accountType,
                                isVerified: 1
                            })};
                            sessionStorage.setItem('nourishUser', JSON.stringify(userObj));
                            sessionStorage.setItem('nourishToken', "${userToken}");
                            localStorage.setItem('nourishUser', JSON.stringify(userObj));
                            localStorage.setItem('nourishToken', "${userToken}");
                            setTimeout(() => {
                                window.location.href = '/?verified=true';
                            }, 1200);
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
                    user: { id: user.id, email: user.email, name: user.organizationName, type: user.accountType, isVerified: 1 },
                    token
                });
            }
        );
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
        db.get(`SELECT id, email, organizationName, accountType, phone, bio, address, avatarUrl, contactPerson, publicPhone, website, fssaiCode, pickupInstructions, isVerified FROM users WHERE id = ?`, [decoded.id], (err, user) => {
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

    const { organizationName, phone, bio, address, avatarUrl, contactPerson, publicPhone, website, fssaiCode, pickupInstructions } = req.body;

    if (token.startsWith('demo-token') || token.includes('demo')) {
        return res.status(200).json({
            message: 'Profile updated successfully!',
            user: {
                id: 888,
                organizationName: organizationName || 'Elite Catering Services',
                email: 'serverdemo@gmail.com',
                accountType: 'restaurant',
                phone: publicPhone || phone || '+91 98765 43210',
                bio: bio || '',
                address: address || '',
                contactPerson: contactPerson || 'Chef Marco Rossi',
                publicPhone: publicPhone || '+91 98765 43210',
                website: website || 'www.elitecatering.com',
                fssaiCode: fssaiCode || '12345678901234',
                pickupInstructions: pickupInstructions || '',
                avatarUrl: avatarUrl || 'assets/default-avatar.jpg',
                isVerified: 1
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
                pickupInstructions = COALESCE(?, pickupInstructions)
            WHERE id = ?`,
            [organizationName, phone, bio, address, avatarUrl, contactPerson, publicPhone, website, fssaiCode, pickupInstructions, decoded.id],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                db.get(`SELECT id, email, organizationName, accountType, phone, bio, address, avatarUrl, contactPerson, publicPhone, website, fssaiCode, pickupInstructions, isVerified FROM users WHERE id = ?`, [decoded.id], (err, updatedUser) => {
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
// 6. GET MY PROFILE
// GET /api/user/me
app.get('/api/user/me', authenticateToken, (req, res) => {
    db.get(`SELECT id, accountType, organizationName, email, phone, address, bio, avatarUrl, isVerified, contactPerson, publicPhone, website, fssaiCode, pickupWindow, pickupInstructions, createdAt
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
        contactPerson, publicPhone, website, fssaiCode,
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

// 8. CREATE FOOD LISTING
// POST /api/listings
// Body: { name, description?, category, price, quantity, unit, expiryTime?, pickupTime?, condition, allergens?, imageUrl? }
app.post('/api/listings', authenticateToken, (req, res) => {
    const {
        name, description, category, price,
        quantity, unit, expiryTime, pickupTime,
        condition, allergens, imageUrl
    } = req.body;

    if (!name || !quantity) {
        return res.status(400).json({ error: 'Food name and quantity are required.' });
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
        imageUrl || null
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
app.put('/api/listings/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const {
        name, description, category, price,
        quantity, unit, expiryTime, pickupTime,
        condition, allergens, imageUrl, status
    } = req.body;

    // First verify ownership
    db.get(`SELECT vendorId FROM food_listings WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Listing not found.' });
        if (Number(row.vendorId) !== Number(req.user.id)) {
            return res.status(403).json({ error: 'You can only edit your own listings.' });
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
            allergens || null, imageUrl || null, status || null,
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

// 🔄 Automatic Cleanup Task: Purge Expired Food Listings from DB every 60 seconds
setInterval(() => {
    db.run(`DELETE FROM food_listings WHERE expiryTime IS NOT NULL AND expiryTime < CURRENT_TIMESTAMP`, [], function (err) {
        if (!err && this.changes > 0) {
            console.log(`🧹 Auto-cleaned ${this.changes} expired food listing(s) from database.`);
        }
    });
}, 60000);

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

    // Insert each order item
    const insertStmt = db.prepare(
        `INSERT INTO orders (buyerId, listingId, quantity, totalPrice, notes)
         VALUES (?, ?, ?, ?, ?)`
    );

    let insertedCount = 0;
    let errors = [];

    items.forEach(({ listingId, quantity, price }) => {
        const qty = parseInt(quantity) || 1;
        const totalPrice = parseFloat(price) * qty || 0;

        insertStmt.run([buyerId, listingId, qty, totalPrice, notes || null], (err) => {
            if (err) errors.push(err.message);
            insertedCount++;

            if (insertedCount === items.length) {
                insertStmt.finalize();
                if (errors.length > 0) {
                    return res.status(500).json({ error: errors.join(', ') });
                }

                // Mark all claimed listings as 'sold'
                const ids = items.map(i => i.listingId).join(',');
                db.run(`UPDATE food_listings SET status = 'sold' WHERE id IN (${ids})`, (err) => {
                    if (err) console.error('Status update error:', err.message);
                });

                // Notify each seller via email asynchronously
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

                res.status(201).json({
                    message: 'Order placed successfully! Thank you for reducing food waste. 🌱',
                    count: insertedCount
                });
            }
        });
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
    const sql = `DELETE FROM food_listings WHERE name IN ('lp,okijuh', 'wesrdtfgybh')`;
    db.run(sql, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json({ message: `Cleanup successful! Deleted ${this.changes} garbage listings.` });
    });
});

// ─── BACKGROUND AUTO-PURGE (2 MINUTES POST-EXPIRATION) ───────────────────────
setInterval(() => {
    db.all(`SELECT id, expiryTime FROM food_listings WHERE expiryTime IS NOT NULL`, [], (err, rows) => {
        if (err || !rows || rows.length === 0) return;
        const now = Date.now();
        const twoMinsMs = 2 * 60 * 1000;

        const expiredIds = rows.filter(r => {
            if (!r.expiryTime) return false;
            const exp = new Date(r.expiryTime).getTime();
            return !isNaN(exp) && (now - exp >= twoMinsMs);
        }).map(r => r.id);

        if (expiredIds.length > 0) {
            const placeholders = expiredIds.map(() => '?').join(',');
            db.run(`DELETE FROM food_listings WHERE id IN (${placeholders})`, expiredIds, function (err) {
                if (err) {
                    console.error("Auto-purge DB error:", err.message);
                } else if (this.changes > 0) {
                    console.log(`🌿 Auto-purged ${this.changes} expired food listing(s) older than 2 minutes.`);
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

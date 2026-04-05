const express = require('express');
const cors    = require('cors');
const path    = require('path');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const multer  = require('multer');
const fs      = require('fs');

const db = require('./database');
const { authenticateToken, JWT_SECRET } = require('./middleware/auth');

// ─── APP SETUP ───────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// ─── MULTER CONFIG (food image uploads) ──────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename:    (req, file, cb) => {
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
        { id: user.id, email: user.email, type: user.accountType, name: user.organizationName },
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
        const sql    = `INSERT INTO users (accountType, organizationName, email, password, phone, address)
                        VALUES (?, ?, ?, ?, ?, ?)`;

        db.run(sql, [accountType, organizationName, email, hashed, phone || null, address || null],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(409).json({ error: 'An account with this email already exists.' });
                    }
                    return res.status(500).json({ error: err.message });
                }

                // Auto-login: return token
                const user  = { id: this.lastID, accountType, organizationName, email };
                const token = makeToken(user);

                res.status(201).json({
                    message: 'Account created successfully!',
                    token,
                    user: { id: this.lastID, email, name: organizationName, type: accountType }
                });
            }
        );
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

    // --- DEMO LOGIN BYPASS ---
    if (email === 'seller@demo.com' && password === 'demo123') {
        const user = { id: 998, email: 'seller@demo.com', accountType: 'restaurant', organizationName: 'Demo Restaurant' };
        return res.status(200).json({
            message: 'Demo login successful!',
            token: makeToken(user),
            user: { id: user.id, email: user.email, name: user.organizationName, type: user.accountType }
        });
    }
    if (email === 'buyer@demo.com' && password === 'demo123') {
        const user = { id: 999, email: 'buyer@demo.com', accountType: 'ngo', organizationName: 'Demo NGO' };
        return res.status(200).json({
            message: 'Demo login successful!',
            token: makeToken(user),
            user: { id: user.id, email: user.email, name: user.organizationName, type: user.accountType }
        });
    }
    // -------------------------

    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err)   return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

        try {
            const match = await bcrypt.compare(password, user.password);
            if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

            const token = makeToken(user);
            res.status(200).json({
                message: 'Login successful!',
                token,
                user: { id: user.id, email: user.email, name: user.organizationName, type: user.accountType }
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
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

// 4. GET ALL LISTINGS (public feed)
// GET /api/listings?vendorId=&category=&status=
app.get('/api/listings', (req, res) => {
    const { vendorId, category, status } = req.query;

    let sql    = `SELECT * FROM food_listings WHERE 1=1`;
    let params = [];

    if (vendorId) {
        sql += ` AND vendorId = ?`;
        params.push(vendorId);
    } else {
        // Public feed: only available items by default
        const targetStatus = status || 'available';
        sql += ` AND status = ?`;
        params.push(targetStatus);
    }

    if (category && category !== 'All') {
        sql += ` AND category = ?`;
        params.push(category);
    }

    sql += ` ORDER BY datePosted DESC`;

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(200).json(rows);
    });
});

// 5. PLATFORM STATS (public)
// GET /api/stats
app.get('/api/stats', (req, res) => {
    const queries = {
        totalListings  : `SELECT COUNT(*) as count FROM food_listings`,
        totalClaimed   : `SELECT COUNT(*) as count FROM food_listings WHERE status IN ('claimed','sold')`,
        totalVendors   : `SELECT COUNT(*) as count FROM users WHERE accountType IN ('restaurant','vendor')`,
        totalNGOs      : `SELECT COUNT(*) as count FROM users WHERE accountType IN ('ngo','shelter')`,
        totalOrders    : `SELECT COUNT(*) as count FROM orders`
    };

    const results = {};
    const keys    = Object.keys(queries);
    let   done    = 0;

    keys.forEach(key => {
        db.get(queries[key], [], (err, row) => {
            results[key] = err ? 0 : row.count;
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
    db.get(`SELECT id, accountType, organizationName, email, phone, address, createdAt
            FROM users WHERE id = ?`, [req.user.id], (err, user) => {
        if (err)   return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'User not found.' });
        res.status(200).json(user);
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `;
    const params = [
        req.user.id,
        req.user.name,
        name,
        description     || '',
        category        || 'Cooked',
        parseFloat(price) || 0,
        quantity,
        unit            || 'Plate',
        expiryTime      || null,
        pickupTime      || null,
        condition       || 'Fresh',
        allergens       || null,
        imageUrl        || null
    ];

    db.run(sql, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({
            message : 'Food listing published successfully! 🌱',
            id      : this.lastID
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
        if (err)   return res.status(500).json({ error: err.message });
        if (!row)  return res.status(404).json({ error: 'Listing not found.' });
        if (row.vendorId !== req.user.id) {
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
        if (err)   return res.status(500).json({ error: err.message });
        if (!row)  return res.status(404).json({ error: 'Listing not found.' });
        if (row.vendorId !== req.user.id) {
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
        if (err)              return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(400).json({ error: 'Listing not found or already claimed.' });
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
    let errors        = [];

    items.forEach(({ listingId, quantity, price }) => {
        const qty        = parseInt(quantity) || 1;
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

                res.status(201).json({
                    message : 'Order placed successfully! Thank you for reducing food waste. 🌱',
                    count   : insertedCount
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

// ─── START SERVER ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log('');
    console.log('🌿 ─────────────────────────────────────────');
    console.log(`🌿  Nourish Network Server is LIVE`);
    console.log(`🌿  http://localhost:${PORT}`);
    console.log('🌿 ─────────────────────────────────────────');
    console.log('');
});

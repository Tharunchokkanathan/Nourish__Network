const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err.message);
        process.exit(1);
    }

    console.log('✅ Connected to SQLite database.');

    // Enable WAL mode for better concurrent read performance
    db.run('PRAGMA journal_mode=WAL;');

    // ─── USERS TABLE ────────────────────────────────────────────────────────────
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id              INTEGER  PRIMARY KEY AUTOINCREMENT,
            accountType     TEXT     NOT NULL CHECK(accountType IN ('restaurant','vendor','ngo','shelter')),
            organizationName TEXT    NOT NULL,
            email           TEXT     NOT NULL UNIQUE,
            password        TEXT     NOT NULL,
            phone           TEXT,
            address         TEXT,
            createdAt       TEXT     NOT NULL DEFAULT (datetime('now'))
        )
    `, logErr('users'));

    // ─── CONTACTS TABLE ──────────────────────────────────────────────────────────
    db.run(`
        CREATE TABLE IF NOT EXISTS contacts (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            name    TEXT    NOT NULL,
            email   TEXT    NOT NULL,
            subject TEXT,
            message TEXT    NOT NULL,
            date    TEXT    NOT NULL
        )
    `, logErr('contacts'));

    // ─── FOOD LISTINGS TABLE ─────────────────────────────────────────────────────
    // Fully expanded to match the frontend's "Post Surplus Food" form
    db.run(`
        CREATE TABLE IF NOT EXISTS food_listings (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            vendorId     INTEGER NOT NULL,
            vendorName   TEXT    NOT NULL,
            name         TEXT    NOT NULL,
            description  TEXT,
            category     TEXT    NOT NULL DEFAULT 'Cooked',
            price        REAL    NOT NULL DEFAULT 0,
            quantity     TEXT    NOT NULL,
            unit         TEXT    NOT NULL DEFAULT 'Plate',
            expiryTime   TEXT,
            pickupTime   TEXT,
            condition    TEXT    NOT NULL DEFAULT 'Fresh',
            allergens    TEXT,
            imageUrl     TEXT,
            status       TEXT    NOT NULL DEFAULT 'available'
                            CHECK(status IN ('available','claimed','sold','expired')),
            claimedBy    INTEGER,
            is_green_route BOOLEAN NOT NULL DEFAULT 0,
            datePosted   TEXT    NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (vendorId)  REFERENCES users(id),
            FOREIGN KEY (claimedBy) REFERENCES users(id)
        )
    `, logErr('food_listings'));

    // ─── ORDERS TABLE ────────────────────────────────────────────────────────────
    // Tracks basket checkouts placed by NGOs / buyers
    db.run(`
        CREATE TABLE IF NOT EXISTS orders (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            buyerId    INTEGER NOT NULL,
            listingId  INTEGER NOT NULL,
            quantity   INTEGER NOT NULL DEFAULT 1,
            totalPrice REAL    NOT NULL DEFAULT 0,
            status     TEXT    NOT NULL DEFAULT 'pending'
                                CHECK(status IN ('pending','confirmed','completed','cancelled')),
            notes      TEXT,
            createdAt  TEXT    NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (buyerId)   REFERENCES users(id),
            FOREIGN KEY (listingId) REFERENCES food_listings(id)
        )
    `, logErr('orders'));
    // ─── SEED INITIAL DATA ──────────────────────────────────────────────────────
    db.serialize(() => {
        db.get("SELECT COUNT(*) as count FROM food_listings", (err, row) => {
            if (!err && row.count === 0) {
                console.log('🌱 Seeding initial food listings...');
                const seedData = [
                    [888, 'Elite Catering (Demo)', 'Vegetable Biryani',      'Fragrant basmati rice cooked with garden vegetables and aromatic spices.', 'Cooked',   80,  '15', 'Plates',   '2026-05-01T21:00:00', 'Today 8-9 PM',   'Fresh',   'None',           'https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?w=800'],
                    [888, 'Elite Catering (Demo)', 'Paneer Butter Masala',   'Creamy cottage cheese cubes in a rich tomato-based gravy.',               'Cooked',  120,  '10', 'Servings', '2026-05-01T21:00:00', 'Today 8-9 PM',   'Fresh',   'Dairy',          'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800'],
                    [888, 'Elite Catering (Demo)', 'Assorted Sandwiches',    'Mix of vegetable, cheese, and coleslaw sandwiches on whole wheat bread.',  'Snacks',   50,  '25', 'Units',    '2026-05-01T18:00:00', 'Immediate',      'Fresh',   'Gluten, Dairy',  'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800'],
                    [888, 'Elite Catering (Demo)', 'Steamed Idli',           'Soft and fluffy rice cakes served with coconut chutney.',                  'Cooked',   30,  '40', 'Units',    '2026-05-01T12:00:00', 'Before 2 PM',    'Fresh',   'None',           'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800'],
                    [888, 'Elite Catering (Demo)', 'Garden Fresh Salad',     'Crispy lettuce, cherry tomatoes, cucumbers, and bell peppers.',            'Raw',      60,  '12', 'Servings', '2026-05-01T22:00:00', 'Immediate',      'Chilled', 'None',           'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800'],
                    [888, 'Elite Catering (Demo)', 'Mixed Fruit Bowl',       'Seasonally selected cut fruits including melon, grapes, and pineapple.',   'Raw',      70,  '15', 'Bowls',    '2026-05-01T15:00:00', 'Immediate',      'Chilled', 'None',           'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800'],
                    [888, 'Elite Catering (Demo)', 'Multigrain Bread Rolls', 'Freshly baked dinner rolls with oats and flax seeds.',                     'Bakery',   25,  '30', 'Units',    '2026-05-03T10:00:00', 'Anytime',        'Fresh',   'Gluten',         'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800'],
                    [888, 'Elite Catering (Demo)', 'Vegetable Pulao',        'Mildly spiced rice with peas, carrots, and beans.',                        'Cooked',   70,  '20', 'Plates',   '2026-05-01T21:00:00', 'Today 8-9 PM',   'Fresh',   'None',           'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800'],
                    [888, 'Elite Catering (Demo)', 'Pasta Primavera',        'Penne pasta with roasted vegetables in a light garlic olive oil sauce.',   'Cooked',   90,  '15', 'Servings', '2026-05-01T20:00:00', 'After 7 PM',     'Fresh',   'Gluten',         'https://images.unsplash.com/photo-1473093226795-af9932fe5856?w=800'],
                    [888, 'Elite Catering (Demo)', 'Mini Samosas',           'Crispy pastry triangles stuffed with spiced potatoes and peas.',           'Snacks',   20,  '50', 'Units',    '2026-05-01T19:00:00', 'Immediate',      'Warm',    'Gluten',         'https://images.unsplash.com/photo-1601050638917-3d943d64073c?w=800'],
                    [888, 'Elite Catering (Demo)', 'Homestyle Chicken Curry','Tender chicken pieces in a traditional spiced onion-tomato gravy.',        'Cooked',  150,  '12', 'Servings', '2026-05-01T22:00:00', 'Before 10 PM',   'Fresh',   'Non-Veg',        'https://images.unsplash.com/photo-1603894584134-f139f131a9d1?w=800'],
                    [888, 'Elite Catering (Demo)', 'Organic Boiled Eggs',    'Perfectly hard-boiled eggs, great for quick nutrition.',                   'Cooked',   15,  '40', 'Units',    '2026-05-02T10:00:00', 'Anytime',        'Fresh',   'Eggs',           'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800'],
                    [888, 'Elite Catering (Demo)', 'Dal Tadka',              'Yellow lentils tempered with ghee, cumin, and garlic.',                   'Cooked',   60,  '25', 'Servings', '2026-05-01T21:30:00', 'Evening',        'Fresh',   'Dairy',          'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800'],
                    [888, 'Elite Catering (Demo)', 'Whole Wheat Chapati',    'Traditional handmade flatbreads.',                                         'Cooked',   10, '100', 'Units',    '2026-05-01T21:00:00', 'Evening',        'Fresh',   'Gluten',         'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800'],
                    [888, 'Elite Catering (Demo)', 'Chocolate Brownies',     'Rich and fudgy dark chocolate brownies.',                                  'Bakery',   45,  '20', 'Units',    '2026-05-04T18:00:00', 'Anytime',        'Fresh',   'Gluten, Dairy',  'https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=800']
                ];

                const stmt = db.prepare(`
                    INSERT INTO food_listings 
                    (vendorId, vendorName, name, description, category, price, quantity, unit, expiryTime, pickupTime, condition, allergens, imageUrl)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                seedData.forEach(item => stmt.run(item));
                stmt.finalize();
                console.log('✅ Successfully seeded 15 food items.');
            } else if (!err && row.count > 0) {
                // ─── MIGRATION: Fix existing zero-price records ──────────────────
                const prices = {
                    'Vegetable Biryani': 80, 'Paneer Butter Masala': 120, 'Assorted Sandwiches': 50,
                    'Steamed Idli': 30, 'Garden Fresh Salad': 60, 'Mixed Fruit Bowl': 70,
                    'Multigrain Bread Rolls': 25, 'Vegetable Pulao': 70, 'Pasta Primavera': 90,
                    'Mini Samosas': 20, 'Homestyle Chicken Curry': 150, 'Organic Boiled Eggs': 15,
                    'Dal Tadka': 60, 'Whole Wheat Chapati': 10, 'Chocolate Brownies': 45
                };
                Object.entries(prices).forEach(([name, price]) => {
                    db.run(`UPDATE food_listings SET price = ?, vendorId = 888, vendorName = 'Elite Catering (Demo)' WHERE name = ? AND price = 0`, [price, name]);
                });
                console.log('✅ Migration: fixed prices on existing seed data.');
            }
        });
    });
});

function logErr(table) {
    return (err) => {
        if (err) console.error(`❌ Error creating table '${table}':`, err.message);
        else      console.log(`  ✓ Table '${table}' ready.`);
    };
}

module.exports = db;

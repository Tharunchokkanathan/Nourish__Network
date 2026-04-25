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
    // ─── SEED INITIAL DATA ──────────────────────────────────────────────────────
    db.serialize(() => {
        db.get("SELECT COUNT(*) as count FROM food_listings", (err, row) => {
            if (!err && row.count === 0) {
                console.log('🌱 Seeding initial food listings...');
                const seedData = [
                    [888, 'Elite Catering (Demo)', 'Vegetable Biryani', 'Fragrant basmati rice cooked with garden vegetables and aromatic spices.', 'Cooked', 0, '15', 'Plates', '2026-05-01T21:00:00', 'Today 8-9 PM', 'Fresh', 'None', 'https://images.unsplash.com/photo-1563379091339-03b21bc4a4f8?w=800'],
                    [888, 'Elite Catering (Demo)', 'Paneer Butter Masala', 'Creamy cottage cheese cubes in a rich tomato-based gravy.', 'Cooked', 0, '10', 'Servings', '2026-05-01T21:00:00', 'Today 8-9 PM', 'Fresh', 'Dairy', 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800'],
                    [889, 'Fresh Bites', 'Assorted Sandwiches', 'Mix of vegetable, cheese, and coleslaw sandwiches on whole wheat bread.', 'Snacks', 0, '25', 'Units', '2026-05-01T18:00:00', 'Immediate', 'Fresh', 'Gluten, Dairy', 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800'],
                    [890, 'South Delights', 'Steamed Idli', 'Soft and fluffy rice cakes served with coconut chutney.', 'Cooked', 0, '40', 'Units', '2026-05-01T12:00:00', 'Before 2 PM', 'Fresh', 'None', 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800'],
                    [891, 'Healthy Greens', 'Garden Fresh Salad', 'Crispy lettuce, cherry tomatoes, cucumbers, and bell peppers with lemon dressing.', 'Raw', 0, '12', 'Servings', '2026-05-01T22:00:00', 'Immediate', 'Chilled', 'None', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800'],
                    [889, 'Fresh Bites', 'Mixed Fruit Bowl', 'Seasonally selected cut fruits including melon, grapes, and pineapple.', 'Raw', 0, '15', 'Bowls', '2026-05-01T15:00:00', 'Immediate', 'Chilled', 'None', 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800'],
                    [892, 'Baker Street', 'Multigrain Bread Rolls', 'Freshly baked dinner rolls with oats and flax seeds.', 'Bakery', 0, '30', 'Units', '2026-05-03T10:00:00', 'Anytime', 'Fresh', 'Gluten', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800'],
                    [888, 'Elite Catering (Demo)', 'Vegetable Pulao', 'Mildly spiced rice with peas, carrots, and beans.', 'Cooked', 0, '20', 'Plates', '2026-05-01T21:00:00', 'Today 8-9 PM', 'Fresh', 'None', 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800'],
                    [893, 'Italian Hub', 'Pasta Primavera', 'Penne pasta with roasted vegetables in a light garlic olive oil sauce.', 'Cooked', 0, '15', 'Servings', '2026-05-01T20:00:00', 'After 7 PM', 'Fresh', 'Gluten', 'https://images.unsplash.com/photo-1473093226795-af9932fe5856?w=800'],
                    [894, 'Tea Time Snacks', 'Mini Samosas', 'Crispy pastry triangles stuffed with spiced potatoes and peas.', 'Snacks', 0, '50', 'Units', '2026-05-01T19:00:00', 'Immediate', 'Warm', 'Gluten', 'https://images.unsplash.com/photo-1601050638917-3d943d64073c?w=800'],
                    [895, 'Grand Spice', 'Homestyle Chicken Curry', 'Tender chicken pieces in a traditional spiced onion-tomato gravy.', 'Cooked', 0, '12', 'Servings', '2026-05-01T22:00:00', 'Before 10 PM', 'Fresh', 'Non-Veg', 'https://images.unsplash.com/photo-1603894584134-f139f131a9d1?w=800'],
                    [896, 'Protein Bar', 'Organic Boiled Eggs', 'Perfectly hard-boiled eggs, great for quick nutrition.', 'Cooked', 0, '40', 'Units', '2026-05-02T10:00:00', 'Anytime', 'Fresh', 'Eggs', 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800'],
                    [897, 'Comfort Food', 'Dal Tadka', 'Yellow lentils tempered with ghee, cumin, and garlic.', 'Cooked', 0, '25', 'Servings', '2026-05-01T21:30:00', 'Evening', 'Fresh', 'Dairy', 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=800'],
                    [898, 'Grain Mill', 'Whole Wheat Chapati', 'Traditional handmade flatbreads.', 'Cooked', 0, '100', 'Units', '2026-05-01T21:00:00', 'Evening', 'Fresh', 'Gluten', 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=800'],
                    [899, 'Sweet Endings', 'Chocolate Brownies', 'Rich and fudgy dark chocolate brownies.', 'Bakery', 0, '20', 'Units', '2026-05-04T18:00:00', 'Anytime', 'Fresh', 'Gluten, Dairy', 'https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=800']
                ];

                const stmt = db.prepare(`
                    INSERT INTO food_listings 
                    (vendorId, vendorName, name, description, category, price, quantity, unit, expiryTime, pickupTime, condition, allergens, imageUrl)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

                seedData.forEach(item => stmt.run(item));
                stmt.finalize();
                console.log('✅ Successfully seeded 15 food items.');
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

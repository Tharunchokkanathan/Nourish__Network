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
    `, logErr('orders'));
});

function logErr(table) {
    return (err) => {
        if (err) console.error(`❌ Error creating table '${table}':`, err.message);
        else      console.log(`  ✓ Table '${table}' ready.`);
    };
}

module.exports = db;

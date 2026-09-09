require('dotenv').config();
const path = require('path');

async function resetDatabase() {
    console.log('🔄 Starting Database Reset...');

    const dbUrl = process.env.DATABASE_URL;

    // 1. Reset Postgres (Supabase) if DATABASE_URL exists
    if (dbUrl) {
        console.log('⚡ Resetting Supabase PostgreSQL Cloud Database...');
        let targetUrl = dbUrl;
        if (targetUrl.includes('db.usxyaxkoyakhxwgcpdej.supabase.co')) {
            targetUrl = targetUrl.replace('db.usxyaxkoyakhxwgcpdej.supabase.co:5432', 'aws-0-ap-south-1.pooler.supabase.com:6543')
                         .replace('postgres:', 'postgres.usxyaxkoyakhxwgcpdej:');
        }

        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: targetUrl,
            ssl: { rejectUnauthorized: false }
        });

        try {
            // Drop existing tables
            await pool.query(`
                DROP TABLE IF EXISTS orders CASCADE;
                DROP TABLE IF EXISTS food_listings CASCADE;
                DROP TABLE IF EXISTS contacts CASCADE;
                DROP TABLE IF EXISTS users CASCADE;
            `);
            console.log('  ✓ PostgreSQL tables dropped.');

            // Recreate tables
            await pool.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    accounttype TEXT NOT NULL CHECK(accounttype IN ('restaurant','vendor','ngo','shelter')),
                    organizationname TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    password TEXT NOT NULL,
                    phone TEXT,
                    address TEXT,
                    bio TEXT,
                    avatarurl TEXT,
                    contactperson TEXT,
                    publicphone TEXT,
                    website TEXT,
                    fssaicode TEXT,
                    darpanid TEXT,
                    ngoregtype TEXT,
                    pickupwindow TEXT,
                    pickupinstructions TEXT,
                    isverified INTEGER DEFAULT 0,
                    verificationtoken TEXT,
                    verificationtokenexpires TEXT,
                    verificationotp TEXT,
                    resettoken TEXT,
                    resettokenexpires TEXT,
                    createdat TIMESTAMP NOT NULL DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS contacts (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL,
                    subject TEXT,
                    message TEXT NOT NULL,
                    date TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS food_listings (
                    id SERIAL PRIMARY KEY,
                    vendorid INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    vendorname TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    category TEXT NOT NULL DEFAULT 'Cooked',
                    price REAL NOT NULL DEFAULT 0,
                    quantity TEXT NOT NULL,
                    unit TEXT NOT NULL DEFAULT 'Plate',
                    expirytime TEXT,
                    pickuptime TEXT,
                    condition TEXT NOT NULL DEFAULT 'Fresh',
                    allergens TEXT,
                    imageurl TEXT,
                    status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','claimed','sold','expired')),
                    claimedby INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    dateposted TIMESTAMP NOT NULL DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS orders (
                    id SERIAL PRIMARY KEY,
                    buyerid INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    listingid INTEGER NOT NULL REFERENCES food_listings(id) ON DELETE CASCADE,
                    quantity INTEGER NOT NULL DEFAULT 1,
                    totalprice REAL NOT NULL DEFAULT 0,
                    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','completed','cancelled')),
                    notes TEXT,
                    createdat TIMESTAMP NOT NULL DEFAULT NOW()
                );

                -- Re-seed demo users so instant demo logins and foreign keys work cleanly
                INSERT INTO users (id, accounttype, organizationname, email, password, isverified, darpanid, ngoregtype, fssaicode)
                VALUES 
                (888, 'restaurant', 'Elite Catering Services', 'serverdemo@gmail.com', '$2a$10$demoHashedPasswordPlaceHolder888', 1, '', '', '12345678901234'),
                (999, 'ngo', 'Global Outreach Foundation', 'ngodemo@gmail.com', '$2a$10$demoHashedPasswordPlaceHolder999', 1, 'TN/2023/0345678', 'darpan', '')
                ON CONFLICT (id) DO UPDATE SET 
                    organizationname = EXCLUDED.organizationname,
                    accounttype = EXCLUDED.accounttype,
                    email = EXCLUDED.email;
            `);
            console.log('  ✓ PostgreSQL tables recreated & demo accounts seeded successfully!');
            await pool.end();
        } catch (err) {
            console.error('❌ Error resetting PostgreSQL database:', err.message);
        }
    }

    // 2. Reset SQLite local database file
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.resolve(__dirname, 'database.sqlite');
    
    console.log('⚡ Resetting Local SQLite Database...');
    const sqliteDb = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('❌ Error opening SQLite database:', err.message);
            return;
        }

        sqliteDb.serialize(() => {
            sqliteDb.run("DROP TABLE IF EXISTS orders;");
            sqliteDb.run("DROP TABLE IF EXISTS food_listings;");
            sqliteDb.run("DROP TABLE IF EXISTS contacts;");
            sqliteDb.run("DROP TABLE IF EXISTS users;");

            sqliteDb.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id                      INTEGER  PRIMARY KEY AUTOINCREMENT,
                    accountType             TEXT     NOT NULL CHECK(accountType IN ('restaurant','vendor','ngo','shelter')),
                    organizationName        TEXT    NOT NULL,
                    email                   TEXT     NOT NULL UNIQUE,
                    password                TEXT     NOT NULL,
                    phone                   TEXT,
                    address                 TEXT,
                    bio                     TEXT,
                    avatarUrl               TEXT,
                    contactPerson           TEXT,
                    publicPhone             TEXT,
                    website                 TEXT,
                    fssaiCode               TEXT,
                    darpanId                TEXT,
                    ngoRegType              TEXT,
                    pickupWindow            TEXT,
                    pickupInstructions     TEXT,
                    isVerified              INTEGER  DEFAULT 0,
                    verificationToken       TEXT,
                    verificationTokenExpires TEXT,
                    verificationOtp         TEXT,
                    resetToken              TEXT,
                    resetTokenExpires       TEXT,
                    createdAt               TEXT     NOT NULL DEFAULT (datetime('now'))
                );
            `);

            sqliteDb.run(`
                CREATE TABLE IF NOT EXISTS contacts (
                    id      INTEGER PRIMARY KEY AUTOINCREMENT,
                    name    TEXT    NOT NULL,
                    email   TEXT    NOT NULL,
                    subject TEXT,
                    message TEXT    NOT NULL,
                    date    TEXT    NOT NULL
                );
            `);

            sqliteDb.run(`
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
                );
            `);

            sqliteDb.run(`
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
                );
            `);

            sqliteDb.run(`
                INSERT OR REPLACE INTO users (id, accountType, organizationName, email, password, isVerified, darpanId, ngoRegType, fssaiCode)
                VALUES 
                (888, 'restaurant', 'Elite Catering Services', 'serverdemo@gmail.com', '$2a$10$demoHashedPasswordPlaceHolder888', 1, '', '', '12345678901234'),
                (999, 'ngo', 'Global Outreach Foundation', 'ngodemo@gmail.com', '$2a$10$demoHashedPasswordPlaceHolder999', 1, 'TN/2023/0345678', 'darpan', '');
            `, (err) => {
                if (err) {
                    console.error('❌ Error resetting SQLite tables:', err.message);
                } else {
                    console.log('  ✓ SQLite tables recreated & demo accounts seeded successfully!');
                }
                sqliteDb.close();
                console.log('🎉 Database reset complete!');
                process.exit(0);
            });
        });
    });
}

resetDatabase();

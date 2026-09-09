require('dotenv').config();
const path = require('path');

let db;

// ─── HELPER: MAP LOWERCASE POSTGRES COLUMNS TO CAMELCASE ────────────────────
function normalizeRow(row) {
    if (!row || typeof row !== 'object') return row;
    const normalized = { ...row };
    const keyMap = {
        organizationname: 'organizationName',
        accounttype: 'accountType',
        avatarurl: 'avatarUrl',
        contactperson: 'contactPerson',
        publicphone: 'publicPhone',
        fssaicode: 'fssaiCode',
        darpanid: 'darpanId',
        ngoregtype: 'ngoRegType',
        pickupwindow: 'pickupWindow',
        pickupinstructions: 'pickupInstructions',
        isverified: 'isVerified',
        verificationtoken: 'verificationToken',
        verificationtokenexpires: 'verificationTokenExpires',
        verificationotp: 'verificationOtp',
        resettoken: 'resetToken',
        resettokenexpires: 'resetTokenExpires',
        createdat: 'createdAt',
        vendorid: 'vendorId',
        vendorname: 'vendorName',
        expirytime: 'expiryTime',
        pickuptime: 'pickupTime',
        imageurl: 'imageUrl',
        claimedby: 'claimedBy',
        dateposted: 'datePosted',
        buyerid: 'buyerId',
        listingid: 'listingId',
        totalprice: 'totalPrice',
        orderid: 'orderId',
        orderstatus: 'orderStatus',
        foodname: 'foodName',
        unitprice: 'unitPrice',
        buyername: 'buyerName',
        buyertype: 'buyerType',
        buyeremail: 'buyerEmail',
        buyerphone: 'buyerPhone',
        buyercontactperson: 'buyerContactPerson',
        buyerdarpanid: 'buyerDarpanId',
        buyerngoregtype: 'buyerNgoRegType',
        buyeraddress: 'buyerAddress',
        buyeravatar: 'buyerAvatar',
        sellername: 'sellerName',
        sellertype: 'sellerType',
        selleremail: 'sellerEmail',
        sellerphone: 'sellerPhone',
        sellercontactperson: 'sellerContactPerson',
        sellerfssaicode: 'sellerFssaiCode',
        selleraddress: 'sellerAddress',
        sellerpickupwindow: 'sellerPickupWindow',
        selleravatar: 'sellerAvatar',
        cropgrade: 'cropGrade',
        producetype: 'produceType',
        harvestdate: 'harvestDate'
    };
    for (const [lower, camel] of Object.entries(keyMap)) {
        if (lower in normalized && !(camel in normalized)) {
            normalized[camel] = normalized[lower];
        }
    }
    return normalized;
}

// ─── POSTGRESQL (SUPABASE) ENGINE ───────────────────────────────────────────
let dbUrl = process.env.DATABASE_URL || "postgresql://postgres.usxyaxkoyakhxwgcpdej:YOUDONTWANNAKNOWTHEPASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres";

if (dbUrl) {
    // Automatically convert direct IPv6 Supabase host to IPv4 Pooler host to fix Render network ENETUNREACH
    if (dbUrl.includes('db.usxyaxkoyakhxwgcpdej.supabase.co')) {
        dbUrl = dbUrl.replace('db.usxyaxkoyakhxwgcpdej.supabase.co:5432', 'aws-0-ap-south-1.pooler.supabase.com:6543')
                     .replace('postgres:', 'postgres.usxyaxkoyakhxwgcpdej:');
    }

    const { Pool } = require('pg');

    const pool = new Pool({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
    });

    pool.on('error', (err) => {
        console.error('⚠️ Unexpected error on idle Supabase client:', err.message);
    });

    console.log('⚡ Connecting to Supabase PostgreSQL Cloud Database...');

    function convertSql(sql) {
        let index = 1;
        let converted = sql.replace(/\?/g, () => `$${index++}`)
                           .replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP');
        // If it's an INSERT without RETURNING id, append RETURNING id
        if (/^\s*INSERT\s+INTO/i.test(converted) && !/RETURNING/i.test(converted)) {
            converted += ' RETURNING id';
        }
        return converted;
    }

    db = {
        isPostgres: true,
        pool,
        run(sql, params, callback) {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            params = params || [];
            const pgSql = convertSql(sql);

            pool.query(pgSql, params)
                .then((result) => {
                    const ctx = {
                        lastID: result.rows && result.rows[0] ? result.rows[0].id : null,
                        changes: result.rowCount || 0
                    };
                    if (callback) callback.call(ctx, null);
                })
                .catch((err) => {
                    if (callback) callback.call({ lastID: null, changes: 0 }, err);
                });
        },
        get(sql, params, callback) {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            params = params || [];
            const pgSql = convertSql(sql);

            pool.query(pgSql, params)
                .then((result) => {
                    const row = result.rows && result.rows[0] ? normalizeRow(result.rows[0]) : null;
                    if (callback) callback(null, row);
                })
                .catch((err) => {
                    if (callback) callback(err, null);
                });
        },
        all(sql, params, callback) {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            params = params || [];
            const pgSql = convertSql(sql);

            pool.query(pgSql, params)
                .then((result) => {
                    const rows = (result.rows || []).map(normalizeRow);
                    if (callback) callback(null, rows);
                })
                .catch((err) => {
                    if (callback) callback(err, []);
                });
        },
        serialize(fn) {
            if (fn) fn();
        }
    };

    // ─── INITIALIZE SUPABASE TABLES ──────────────────────────────────────────
    const initTables = async () => {
        try {
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

                -- Safe migration: ensure darpanid and ngoregtype exist
                ALTER TABLE users ADD COLUMN IF NOT EXISTS darpanid TEXT;
                ALTER TABLE users ADD COLUMN IF NOT EXISTS ngoregtype TEXT;
                ALTER TABLE users DROP CONSTRAINT IF EXISTS users_accounttype_check;

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

                -- Safe migrations for crop listings
                ALTER TABLE food_listings ADD COLUMN IF NOT EXISTS cropgrade TEXT;
                ALTER TABLE food_listings ADD COLUMN IF NOT EXISTS producetype TEXT DEFAULT 'food';
                ALTER TABLE food_listings ADD COLUMN IF NOT EXISTS harvestdate TEXT;

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
            `);

            // Ensure demo users exist so foreign keys in orders table succeed for demo workflows
            await pool.query(`
                INSERT INTO users (id, accounttype, organizationname, email, password, isverified, darpanid, ngoregtype, fssaicode, phone)
                VALUES 
                (888, 'restaurant', 'Elite Catering Services', 'serverdemo@gmail.com', '$2a$10$demoHashedPasswordPlaceHolder888', 1, '', '', '12345678901234', '+91 98765 43210'),
                (999, 'ngo', 'Global Outreach Foundation', 'ngodemo@gmail.com', '$2a$10$demoHashedPasswordPlaceHolder999', 1, 'TN/2023/0345678', 'darpan', '', '+91 98765 87654'),
                (777, 'crop_seller', 'Green Valley Farmers FPO', 'farmerdemo@gmail.com', '$2a$10$demoHashedPasswordPlaceHolder888', 1, '', '', '', '+91 98765 12340'),
                (666, 'crop_buyer', 'Sahyadri Agro-Processing MSME', 'buyeragridemo@gmail.com', '$2a$10$demoHashedPasswordPlaceHolder999', 1, '', '', '', '+91 98765 56780')
                ON CONFLICT (id) DO UPDATE SET 
                    organizationname = EXCLUDED.organizationname,
                    accounttype = EXCLUDED.accounttype,
                    email = EXCLUDED.email;

                -- Seed sample demo crop listings if not present
                INSERT INTO food_listings (id, vendorid, vendorname, name, description, category, price, quantity, unit, condition, status, cropgrade, producetype)
                VALUES 
                (901, 777, 'Green Valley Farmers FPO', 'Nashik Farm Fresh Tomatoes (Puree Grade)', 'Harvested surplus ripe tomatoes. Highly suitable for bulk ketchup, sauce, or puree processing units.', 'Vegetables', 6, '15', 'Quintal', 'Fresh Harvest', 'available', 'Grade B', 'crop'),
                (902, 777, 'Green Valley Farmers FPO', 'Nagpur Organic Oranges (Pulp Grade)', 'Slightly bruised, high-sugar content oranges ideal for juice or pulp extraction.', 'Fruits', 12, '8', 'Quintal', 'Fresh Harvest', 'available', 'Grade B', 'crop')
                ON CONFLICT (id) DO NOTHING;
            `);
            console.log('✅ Supabase PostgreSQL: All cloud tables initialized and ready (including Crop Portals)!');
        } catch (err) {
            console.error('❌ Supabase table initialization error:', err.message);
        }
    };

    initTables();

} else {
    // ─── SQLITE OFFLINE FALLBACK ─────────────────────────────────────────────
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.resolve(__dirname, 'database.sqlite');

    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('❌ Error opening SQLite database:', err.message);
            process.exit(1);
        }

        console.log('✅ Connected to local SQLite database.');
        db.run('PRAGMA journal_mode=WAL;');

        db.run(`
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
            )
        `, (err) => {
            logErr('users')(err);
            // Safe migration for SQLite to add darpanId and ngoRegType columns if they don't exist
            db.run('ALTER TABLE users ADD COLUMN darpanId TEXT;', () => {});
            db.run('ALTER TABLE users ADD COLUMN ngoRegType TEXT;', () => {});
        });

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
        `, (err) => {
            logErr('food_listings')(err);
            db.run('ALTER TABLE food_listings ADD COLUMN cropGrade TEXT;', () => {});
            db.run('ALTER TABLE food_listings ADD COLUMN produceType TEXT DEFAULT \'food\';', () => {});
            db.run('ALTER TABLE food_listings ADD COLUMN harvestDate TEXT;', () => {});
        });

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
            else console.log(`  ✓ Table '${table}' ready.`);
        };
    }
}

module.exports = db;

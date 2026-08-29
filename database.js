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
        totalprice: 'totalPrice'
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
        let converted = sql.replace(/\?/g, () => `$${index++}`);
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
            `);
            console.log('✅ Supabase PostgreSQL: All 4 cloud tables initialized and ready!');
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
        `, logErr('users'));

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
        `, logErr('food_listings'));

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

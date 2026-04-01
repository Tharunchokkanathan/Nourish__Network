const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');

        // Create Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            accountType TEXT,
            organizationName TEXT,
            email TEXT UNIQUE,
            password TEXT
        )`);

        // Create Contacts/Messages Table
        db.run(`CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT,
            subject TEXT,
            message TEXT,
            date TEXT
        )`);

        // Create Food Surplus Tables
        db.run(`CREATE TABLE IF NOT EXISTS food_listings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vendorId INTEGER,
            vendorName TEXT,
            description TEXT,
            quantity TEXT,
            pickupTime TEXT,
            status TEXT DEFAULT 'available',
            claimedBy INTEGER NULL,
            datePosted TEXT,
            FOREIGN KEY (vendorId) REFERENCES users (id),
            FOREIGN KEY (claimedBy) REFERENCES users (id)
        )`);
    }
});

module.exports = db;

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files (HTML, CSS, JS) from the current directory
app.use(express.static(path.join(__dirname, '')));

// ==========================================
// API ENDPOINTS
// ==========================================

// 1. Register User Endpoint
app.post('/api/register', (req, res) => {
    const { accountType, organizationName, email, password } = req.body;

    if (!email || !password || !organizationName) {
        return res.status(400).json({ error: "Please provide all required fields." });
    }

    const sql = `INSERT INTO users (accountType, organizationName, email, password) VALUES (?, ?, ?, ?)`;
    const params = [accountType, organizationName, email, password]; // In a real app, hash the password!

    db.run(sql, params, function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: "Email already exists." });
            }
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({
            message: "User registered successfully!",
            userId: this.lastID
        });
    });
});

// 2. Login User Endpoint
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Please provide email and password." });
    }

    const sql = `SELECT * FROM users WHERE email = ? AND password = ?`;

    db.get(sql, [email, password], (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (user) {
            res.status(200).json({
                message: "Login successful!",
                user: { id: user.id, email: user.email, name: user.organizationName, type: user.accountType }
            });
        } else {
            res.status(401).json({ error: "Invalid email or password." });
        }
    });
});

// 3. Contact Form Endpoint
app.post('/api/contact', (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: "Please provide name, email, and message." });
    }

    const date = new Date().toISOString();
    const sql = `INSERT INTO contacts (name, email, subject, message, date) VALUES (?, ?, ?, ?, ?)`;
    const params = [name, email, subject, message, date];

    db.run(sql, params, function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: "Your message has been received successfully!" });
    });
});

// Start the Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Press Ctrl+C to stop.`);
});

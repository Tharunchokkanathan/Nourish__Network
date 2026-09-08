const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'nourish_network_secret_key_2024';

/**
 * Middleware: Verify JWT from Authorization header.
 * Attaches decoded user payload to req.user on success.
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    // Demo token fallbacks for seamless hackathon testing & offline demonstrations
    if (token === 'demo-token-seller') {
        req.user = { id: 888, email: 'serverdemo@gmail.com', accountType: 'restaurant', organizationName: 'Elite Catering (Demo)' };
        return next();
    }
    if (token === 'demo-token-buyer') {
        req.user = { id: 999, email: 'ngodemo@gmail.com', accountType: 'ngo', organizationName: 'Global Outreach (Demo)' };
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token.' });
    }
}

module.exports = { authenticateToken, JWT_SECRET };

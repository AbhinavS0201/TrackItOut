// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'expense_tracker_secret_2024';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required. No token provided.' });
  }

  try {
    const token = header.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'expense_tracker_secret_2024';
    const payload = jwt.verify(token, secret);
    req.userId = payload.id;
    next();
  } catch (err) {
    console.error('Auth middleware verification failure:', err.message);
    return res.status(401).json({ message: 'Invalid or expired session token.' });
  }
}

module.exports = authMiddleware;

const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'directrent_secret_2024';

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await db.query('SELECT * FROM users WHERE id = $1 AND status = $2', [decoded.id, 'active']);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found or suspended' });
    }
    req.user = result.rows[0];
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: insufficient role' });
    }
    next();
  };
};

const generateToken = (user) => {
  return jwt.sign({ id: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
};

module.exports = { authenticateToken, requireRole, generateToken, JWT_SECRET };

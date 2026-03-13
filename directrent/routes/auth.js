const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { generateToken, authenticateToken } = require('../middleware/auth');

function generateReferralCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, role, referral_code } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password and role are required' });
    }

    const validRoles = ['tenant', 'landlord', 'agent', 'lawyer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    let referrerId = null;
    if (referral_code) {
      const refUser = await db.query('SELECT id FROM users WHERE referral_code = $1', [referral_code]);
      if (refUser.rows.length > 0) {
        referrerId = refUser.rows[0].id;
      }
    }

    const hash = await bcrypt.hash(password, 10);
    const myCode = generateReferralCode();

    const result = await db.query(
      `INSERT INTO users (name, email, phone, password_hash, role, referral_code, referred_by_id, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING id, name, email, role`,
      [name, email, phone || null, hash, role, myCode, referrerId]
    );

    const user = result.rows[0];

    if (role === 'agent') {
      await db.query('INSERT INTO agents (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);
    }
    if (role === 'lawyer') {
      await db.query('INSERT INTO lawyers (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);
    }

    if (referrerId) {
      await db.query('UPDATE users SET referral_count = referral_count + 1 WHERE id = $1', [referrerId]);
      const agentCheck = await db.query('SELECT id FROM agents WHERE user_id = $1', [referrerId]);
      if (agentCheck.rows.length > 0) {
        await db.query('UPDATE agents SET total_referrals = total_referrals + 1 WHERE user_id = $1', [referrerId]);
      }
    }

    const token = generateToken(user);
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended. Contact support.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateToken(user);
    res.json({
      token,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        wallet_balance: user.wallet_balance, verified_badge: user.verified_badge,
        kyc_status: user.kyc_status, referral_code: user.referral_code
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  const u = req.user;
  res.json({
    id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role,
    status: u.status, wallet_balance: u.wallet_balance, verified_badge: u.verified_badge,
    verified_limit: u.verified_limit, deposit_amount: u.deposit_amount,
    referral_count: u.referral_count, kyc_status: u.kyc_status,
    referral_code: u.referral_code, profile_photo: u.profile_photo,
    email_verified: u.email_verified, created_at: u.created_at
  });
});

router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, phone } = req.body;
    await db.query('UPDATE users SET name=$1, phone=$2, updated_at=NOW() WHERE id=$3', [name, phone, req.user.id]);
    res.json({ message: 'Profile updated' });
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const user = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(current_password, user.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' });
    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Password change failed' });
  }
});

module.exports = router;

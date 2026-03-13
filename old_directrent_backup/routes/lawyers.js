const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { recordTransaction } = require('./wallet');

router.get('/', async (req, res) => {
  try {
    const { location } = req.query;
    let q = `SELECT l.*, u.name, u.email, u.phone FROM lawyers l JOIN users u ON l.user_id = u.id WHERE l.verification_status='approved'`;
    let params = [];
    if (location) {
      q += ` AND l.location ILIKE $1`;
      params.push(`%${location}%`);
    }
    q += ' ORDER BY l.id DESC';
    const r = await db.query(q, params);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch lawyers' });
  }
});

router.get('/profile', authenticateToken, requireRole('lawyer', 'admin'), async (req, res) => {
  try {
    const r = await db.query(
      `SELECT l.*, u.name, u.email, u.phone, u.wallet_balance, u.kyc_status FROM lawyers l JOIN users u ON l.user_id=u.id WHERE l.user_id=$1`,
      [req.user.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Lawyer profile not found' });

    const transactions = await db.query(
      `SELECT * FROM transactions WHERE user_id=$1 AND type='lawyer_fee' ORDER BY created_at DESC LIMIT 10`,
      [req.user.id]
    );
    res.json({ profile: r.rows[0], transactions: transactions.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.put('/profile', authenticateToken, requireRole('lawyer'), async (req, res) => {
  try {
    const { fee_percentage, location, specialization, bio, license_number, years_experience } = req.body;
    await db.query(
      `UPDATE lawyers SET fee_percentage=$1, location=$2, specialization=$3, bio=$4, license_number=$5, years_experience=$6 WHERE user_id=$7`,
      [fee_percentage, location, specialization, bio, license_number, years_experience, req.user.id]
    );
    res.json({ message: 'Lawyer profile updated' });
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

router.post('/hire/:lawyer_id', authenticateToken, async (req, res) => {
  try {
    const { amount, description } = req.body;
    const fee = parseFloat(amount);
    if (!fee || fee <= 0) return res.status(400).json({ error: 'Invalid fee amount' });

    const lawyerR = await db.query(
      `SELECT l.*, u.name, u.referred_by_id FROM lawyers l JOIN users u ON l.user_id=u.id WHERE l.user_id=$1 AND l.verification_status='approved'`,
      [req.params.lawyer_id]
    );
    if (lawyerR.rows.length === 0) return res.status(404).json({ error: 'Lawyer not found or not verified' });

    const lawyer = lawyerR.rows[0];
    const userR = await db.query('SELECT wallet_balance FROM users WHERE id=$1', [req.user.id]);

    if (parseFloat(userR.rows[0].wallet_balance) < fee) {
      return res.status(400).json({ error: `Insufficient balance. Fee is ₦${fee.toLocaleString()}` });
    }

    const platformCut = (fee * 5) / 100;
    const agentCut = (fee * 1) / 100;
    const lawyerReceives = fee - platformCut;

    await db.query('UPDATE users SET wallet_balance=wallet_balance-$1 WHERE id=$2', [fee, req.user.id]);
    await db.query('UPDATE users SET wallet_balance=wallet_balance+$1 WHERE id=$2', [lawyerReceives, lawyer.user_id]);

    await recordTransaction(req.user.id, 'lawyer_fee', -fee, description || `Lawyer fee payment to ${lawyer.name}`, lawyer.user_id);
    await recordTransaction(lawyer.user_id, 'lawyer_fee', lawyerReceives, `Legal fee received from client`, req.user.id);

    if (lawyer.referred_by_id) {
      const agentR = await db.query('SELECT id FROM agents WHERE user_id=$1', [lawyer.referred_by_id]);
      if (agentR.rows.length > 0) {
        await db.query('UPDATE users SET wallet_balance=wallet_balance+$1 WHERE id=$2', [agentCut, lawyer.referred_by_id]);
        await db.query('UPDATE agents SET lifetime_commissions=lifetime_commissions+$1 WHERE user_id=$2', [agentCut, lawyer.referred_by_id]);
        await recordTransaction(lawyer.referred_by_id, 'agent_commission', agentCut, 'Agent commission from lawyer hire', req.user.id);
      }
    }

    res.json({ message: 'Lawyer hired successfully', fee_paid: fee, lawyer_receives: lawyerReceives });
  } catch (err) {
    console.error('Hire lawyer error:', err.message);
    res.status(500).json({ error: 'Lawyer hire failed' });
  }
});

module.exports = router;

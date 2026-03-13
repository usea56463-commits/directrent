const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

async function getSetting(key) {
  const r = await db.query('SELECT value FROM platform_settings WHERE key=$1', [key]);
  return r.rows.length > 0 ? parseFloat(r.rows[0].value) : null;
}

async function recordTransaction(userId, type, amount, description, relatedUserId = null, relatedPropertyId = null) {
  const ref = 'TXN' + Date.now() + Math.random().toString(36).substring(2, 6).toUpperCase();
  await db.query(
    `INSERT INTO transactions (user_id, type, amount, description, reference, related_user_id, related_property_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [userId, type, amount, description, ref, relatedUserId, relatedPropertyId]
  );
}

router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const r = await db.query('SELECT wallet_balance, deposit_amount, verified_badge, verified_limit FROM users WHERE id=$1', [req.user.id]);
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

router.post('/deposit', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const kycThreshold = await getSetting('kyc_threshold') || 500000;
    const userR = await db.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const user = userR.rows[0];

    if (amt >= kycThreshold && user.kyc_status !== 'approved') {
      return res.status(403).json({ error: 'KYC verification required for deposits above ₦' + kycThreshold.toLocaleString() });
    }

    const newBalance = parseFloat(user.wallet_balance) + amt;
    const newDeposit = parseFloat(user.deposit_amount) + amt;
    const badgeActive = newDeposit > 0;

    await db.query(
      `UPDATE users SET wallet_balance=$1, deposit_amount=$2, verified_badge=$3, verified_limit=$2, updated_at=NOW() WHERE id=$4`,
      [newBalance, newDeposit, badgeActive, req.user.id]
    );

    await recordTransaction(req.user.id, 'deposit', amt, `Wallet deposit of ₦${amt.toLocaleString()}`);

    res.json({ message: 'Deposit successful', new_balance: newBalance, deposit_amount: newDeposit, verified_badge: badgeActive });
  } catch (err) {
    console.error('Deposit error:', err.message);
    res.status(500).json({ error: 'Deposit failed' });
  }
});

router.post('/withdraw', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const userR = await db.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const user = userR.rows[0];

    const withdrawalFeePct = await getSetting('withdrawal_fee_pct') || 2;
    const fee = (amt * withdrawalFeePct) / 100;
    const total = amt + fee;

    if (parseFloat(user.wallet_balance) < total) {
      return res.status(400).json({ error: `Insufficient balance. Need ₦${total.toLocaleString()} (includes ${withdrawalFeePct}% fee)` });
    }

    const newBalance = parseFloat(user.wallet_balance) - total;
    await db.query(
      `UPDATE users SET wallet_balance=$1, deposit_amount=0, verified_badge=false, verified_limit=0, updated_at=NOW() WHERE id=$2`,
      [newBalance, req.user.id]
    );

    await recordTransaction(req.user.id, 'withdrawal', -amt, `Withdrawal of ₦${amt.toLocaleString()} (${withdrawalFeePct}% fee: ₦${fee.toLocaleString()})`);

    res.json({ message: 'Withdrawal successful', amount_withdrawn: amt, fee: fee, new_balance: newBalance });
  } catch (err) {
    console.error('Withdraw error:', err.message);
    res.status(500).json({ error: 'Withdrawal failed' });
  }
});

router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    const r = await db.query(
      `SELECT t.*, u.name as related_user_name, p.title as property_title
       FROM transactions t
       LEFT JOIN users u ON t.related_user_id = u.id
       LEFT JOIN properties p ON t.related_property_id = p.id
       WHERE t.user_id=$1 ORDER BY t.created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    const count = await db.query('SELECT COUNT(*) FROM transactions WHERE user_id=$1', [req.user.id]);
    res.json({ transactions: r.rows, total: parseInt(count.rows[0].count), page, limit });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

module.exports = { router, recordTransaction, getSetting };

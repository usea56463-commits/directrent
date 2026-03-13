const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

async function logAdminAction(adminId, actionType, targetUserId = null, targetPropertyId = null, notes = '') {
  await db.query(
    'INSERT INTO admin_actions (action_type, performed_by_admin_id, target_user_id, target_property_id, notes) VALUES ($1,$2,$3,$4,$5)',
    [actionType, adminId, targetUserId, targetPropertyId, notes]
  );
}

router.get('/stats', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const [users, properties, transactions, tickets, kyc] = await Promise.all([
      db.query('SELECT COUNT(*) as total, role, status FROM users GROUP BY role, status'),
      db.query("SELECT COUNT(*) as total, status FROM properties GROUP BY status"),
      db.query("SELECT SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_in, SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_out FROM transactions"),
      db.query("SELECT COUNT(*) as total, status FROM support_tickets GROUP BY status"),
      db.query("SELECT COUNT(*) as total FROM kyc_documents WHERE status='pending'")
    ]);

    res.json({
      users: users.rows,
      properties: properties.rows,
      financials: transactions.rows[0],
      tickets: tickets.rows,
      pending_kyc: parseInt(kyc.rows[0].total)
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/users', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { role, status, search, page = 1 } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;
    let conditions = [];
    let params = [];
    let i = 1;

    if (role) { conditions.push(`role=$${i++}`); params.push(role); }
    if (status) { conditions.push(`status=$${i++}`); params.push(status); }
    if (search) { conditions.push(`(name ILIKE $${i} OR email ILIKE $${i})`); params.push(`%${search}%`); i++; }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const r = await db.query(`SELECT id, name, email, phone, role, status, wallet_balance, verified_badge, kyc_status, referral_code, created_at FROM users ${where} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i+1}`, [...params, limit, offset]);
    const count = await db.query(`SELECT COUNT(*) FROM users ${where}`, params);
    res.json({ users: r.rows, total: parseInt(count.rows[0].count), page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/users/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const u = await db.query('SELECT * FROM users WHERE id=$1', [req.params.id]);
    if (u.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const txns = await db.query('SELECT * FROM transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20', [req.params.id]);
    res.json({ user: u.rows[0], transactions: txns.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.post('/users/:id/suspend', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    await db.query("UPDATE users SET status='suspended' WHERE id=$1", [req.params.id]);
    await logAdminAction(req.user.id, 'suspend_user', req.params.id, null, req.body.reason || '');
    res.json({ message: 'User suspended' });
  } catch (err) {
    res.status(500).json({ error: 'Action failed' });
  }
});

router.post('/users/:id/activate', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    await db.query("UPDATE users SET status='active' WHERE id=$1", [req.params.id]);
    await logAdminAction(req.user.id, 'activate_user', req.params.id, null, '');
    res.json({ message: 'User activated' });
  } catch (err) {
    res.status(500).json({ error: 'Action failed' });
  }
});

router.post('/users/:id/adjust-wallet', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { amount, reason } = req.body;
    const amt = parseFloat(amount);
    await db.query('UPDATE users SET wallet_balance=wallet_balance+$1 WHERE id=$2', [amt, req.params.id]);
    const { recordTransaction } = require('./wallet');
    await recordTransaction(req.params.id, 'deposit', amt, `Admin wallet adjustment: ${reason}`);
    await logAdminAction(req.user.id, 'wallet_adjustment', req.params.id, null, `${amt} - ${reason}`);
    res.json({ message: 'Wallet adjusted' });
  } catch (err) {
    res.status(500).json({ error: 'Adjustment failed' });
  }
});

router.get('/properties', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { status, page = 1 } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;
    let where = '';
    let params = [limit, offset];
    if (status) { where = 'WHERE p.status=$3'; params.push(status); }
    const r = await db.query(
      `SELECT p.*, u.name as landlord_name, u.email as landlord_email FROM properties p JOIN users u ON p.landlord_id=u.id ${where} ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`,
      params
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

router.post('/properties/:id/verify', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    await db.query("UPDATE properties SET status='verified', updated_at=NOW() WHERE id=$1", [req.params.id]);
    await logAdminAction(req.user.id, 'verify_property', null, req.params.id, '');
    res.json({ message: 'Property verified' });
  } catch (err) {
    res.status(500).json({ error: 'Action failed' });
  }
});

router.post('/properties/:id/flag', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    await db.query("UPDATE properties SET status='flagged', updated_at=NOW() WHERE id=$1", [req.params.id]);
    await logAdminAction(req.user.id, 'flag_property', null, req.params.id, req.body.reason || '');
    res.json({ message: 'Property flagged' });
  } catch (err) {
    res.status(500).json({ error: 'Action failed' });
  }
});

router.post('/properties/:id/remove', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    await db.query("UPDATE properties SET status='removed', updated_at=NOW() WHERE id=$1", [req.params.id]);
    await logAdminAction(req.user.id, 'remove_property', null, req.params.id, req.body.reason || '');
    res.json({ message: 'Property removed' });
  } catch (err) {
    res.status(500).json({ error: 'Action failed' });
  }
});

router.post('/lawyers/:id/approve', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    await db.query("UPDATE lawyers SET verification_status='approved' WHERE user_id=$1", [req.params.id]);
    await logAdminAction(req.user.id, 'approve_lawyer', req.params.id, null, '');
    res.json({ message: 'Lawyer approved' });
  } catch (err) {
    res.status(500).json({ error: 'Action failed' });
  }
});

router.post('/lawyers/:id/reject', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    await db.query("UPDATE lawyers SET verification_status='rejected' WHERE user_id=$1", [req.params.id]);
    await logAdminAction(req.user.id, 'reject_lawyer', req.params.id, null, req.body.reason || '');
    res.json({ message: 'Lawyer rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Action failed' });
  }
});

router.get('/transactions', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { page = 1, type } = req.query;
    const limit = 30;
    const offset = (page - 1) * limit;
    let where = '';
    let params = [limit, offset];
    if (type) { where = 'WHERE t.type=$3'; params.push(type); }
    const r = await db.query(
      `SELECT t.*, u.name, u.email FROM transactions t JOIN users u ON t.user_id=u.id ${where} ORDER BY t.created_at DESC LIMIT $1 OFFSET $2`,
      params
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

router.get('/actions', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const r = await db.query(
      `SELECT a.*, u.name as admin_name FROM admin_actions a JOIN users u ON a.performed_by_admin_id=u.id ORDER BY a.timestamp DESC LIMIT 50`
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch admin actions' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/dashboard', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  try {
    const agentR = await db.query('SELECT * FROM agents WHERE user_id=$1', [req.user.id]);
    if (agentR.rows.length === 0) return res.status(404).json({ error: 'Agent profile not found' });

    const agent = agentR.rows[0];
    const userR = await db.query('SELECT wallet_balance, referral_count FROM users WHERE id=$1', [req.user.id]);

    const referredUsers = await db.query(
      `SELECT id, name, email, role, created_at FROM users WHERE referred_by_id=$1 ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    );

    const commissions = await db.query(
      `SELECT * FROM transactions WHERE user_id=$1 AND type='agent_commission' ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    );

    res.json({
      agent,
      wallet_balance: userR.rows[0].wallet_balance,
      referral_count: userR.rows[0].referral_count,
      referred_users: referredUsers.rows,
      recent_commissions: commissions.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch agent dashboard' });
  }
});

router.get('/my-referral-link', authenticateToken, requireRole('agent'), async (req, res) => {
  try {
    const user = await db.query('SELECT referral_code FROM users WHERE id=$1', [req.user.id]);
    res.json({ referral_code: user.rows[0].referral_code, referral_link: `${process.env.SITE_URL || ''}/register?ref=${user.rows[0].referral_code}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate referral link' });
  }
});

router.post('/upgrade', authenticateToken, requireRole('agent'), async (req, res) => {
  try {
    const agentR = await db.query('SELECT * FROM agents WHERE user_id=$1', [req.user.id]);
    if (agentR.rows.length === 0) return res.status(404).json({ error: 'Agent not found' });

    const agent = agentR.rows[0];
    if (agent.upgraded_status) return res.status(409).json({ error: 'Already upgraded' });
    if (agent.total_referrals < agent.upgrade_threshold) {
      return res.status(400).json({ error: `Need ${agent.upgrade_threshold - agent.total_referrals} more referrals to upgrade` });
    }

    await db.query('UPDATE agents SET upgraded_status=true WHERE user_id=$1', [req.user.id]);
    res.json({ message: 'Agent upgraded successfully!' });
  } catch (err) {
    res.status(500).json({ error: 'Upgrade failed' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const r = await db.query('SELECT key, value, description FROM platform_settings ORDER BY key');
    const settings = {};
    r.rows.forEach(s => { settings[s.key] = { value: s.value, description: s.description }; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const updates = req.body;
    const keys = Object.keys(updates);

    for (const key of keys) {
      await db.query(
        'UPDATE platform_settings SET value=$1, updated_at=NOW() WHERE key=$2',
        [updates[key], key]
      );
    }

    res.json({ message: `Updated ${keys.length} setting(s)` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

router.get('/public', async (req, res) => {
  try {
    const publicKeys = ['site_name', 'contact_email', 'inspection_fee', 'landlord_onboarding_fee', 'platform_commission_pct', 'withdrawal_fee_pct', 'google_maps_key'];
    const r = await db.query('SELECT key, value FROM platform_settings WHERE key = ANY($1)', [publicKeys]);
    const settings = {};
    r.rows.forEach(s => { settings[s.key] = s.value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

module.exports = router;

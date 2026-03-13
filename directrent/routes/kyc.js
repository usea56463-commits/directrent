const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.post('/submit', authenticateToken, async (req, res) => {
  try {
    const { id_type, id_document, address_proof, selfie } = req.body;

    await db.query(
      `INSERT INTO kyc_documents (user_id, id_type, id_document, address_proof, selfie, status, submitted_at)
       VALUES ($1,$2,$3,$4,$5,'pending',NOW())
       ON CONFLICT (user_id) DO UPDATE SET id_type=$2, id_document=$3, address_proof=$4, selfie=$5, status='pending', submitted_at=NOW()`,
      [req.user.id, id_type, id_document, address_proof, selfie]
    );

    await db.query("UPDATE users SET kyc_status='pending' WHERE id=$1", [req.user.id]);

    res.json({ message: 'KYC documents submitted for review' });
  } catch (err) {
    console.error('KYC submit error:', err.message);
    res.status(500).json({ error: 'KYC submission failed' });
  }
});

router.get('/status', authenticateToken, async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM kyc_documents WHERE user_id=$1', [req.user.id]);
    const user = await db.query('SELECT kyc_status FROM users WHERE id=$1', [req.user.id]);
    res.json({ kyc_status: user.rows[0].kyc_status, documents: r.rows[0] || null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch KYC status' });
  }
});

router.get('/pending', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const r = await db.query(
      `SELECT k.*, u.name, u.email, u.role FROM kyc_documents k JOIN users u ON k.user_id = u.id WHERE k.status='pending' ORDER BY k.submitted_at ASC`
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending KYC' });
  }
});

router.post('/:user_id/review', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { status, review_notes } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    await db.query(
      'UPDATE kyc_documents SET status=$1, reviewed_by=$2, review_notes=$3, reviewed_at=NOW() WHERE user_id=$4',
      [status, req.user.id, review_notes, req.params.user_id]
    );
    await db.query('UPDATE users SET kyc_status=$1 WHERE id=$2', [status, req.params.user_id]);

    await db.query(
      'INSERT INTO admin_actions (action_type, performed_by_admin_id, target_user_id, notes) VALUES ($1,$2,$3,$4)',
      [`kyc_${status}`, req.user.id, req.params.user_id, review_notes]
    );

    res.json({ message: `KYC ${status} successfully` });
  } catch (err) {
    res.status(500).json({ error: 'KYC review failed' });
  }
});

module.exports = router;

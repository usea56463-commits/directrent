const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { category, subject, description, priority } = req.body;
    if (!description) return res.status(400).json({ error: 'Description required' });
    const r = await db.query(
      `INSERT INTO support_tickets (user_id, category, subject, description, priority) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.id, category || 'general', subject || 'Support Request', description, priority || 'normal']
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

router.get('/my', authenticateToken, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT t.*, u.name as assigned_admin_name FROM support_tickets t LEFT JOIN users u ON t.assigned_admin_id=u.id WHERE t.user_id=$1 ORDER BY t.created_at DESC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const ticket = await db.query('SELECT * FROM support_tickets WHERE id=$1', [req.params.id]);
    if (ticket.rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });

    const t = ticket.rows[0];
    if (t.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const replies = await db.query(
      `SELECT r.*, u.name, u.role FROM ticket_replies r JOIN users u ON r.user_id=u.id WHERE r.ticket_id=$1 ORDER BY r.created_at ASC`,
      [req.params.id]
    );
    res.json({ ticket: t, replies: replies.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

router.post('/:id/reply', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const ticket = await db.query('SELECT * FROM support_tickets WHERE id=$1', [req.params.id]);
    if (ticket.rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });

    const t = ticket.rows[0];
    if (t.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.query('INSERT INTO ticket_replies (ticket_id, user_id, message) VALUES ($1,$2,$3)', [req.params.id, req.user.id, message]);

    if (req.user.role === 'admin') {
      await db.query("UPDATE support_tickets SET status='in_progress', assigned_admin_id=$1, updated_at=NOW() WHERE id=$2", [req.user.id, req.params.id]);
    }

    res.json({ message: 'Reply sent' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

router.get('/admin/all', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { status, priority, page = 1 } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;
    let conditions = [];
    let params = [limit, offset];
    let i = 3;

    if (status) { conditions.push(`t.status=$${i++}`); params.push(status); }
    if (priority) { conditions.push(`t.priority=$${i++}`); params.push(priority); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const r = await db.query(
      `SELECT t.*, u.name as user_name, u.email as user_email FROM support_tickets t JOIN users u ON t.user_id=u.id ${where} ORDER BY t.created_at DESC LIMIT $1 OFFSET $2`,
      params
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

router.post('/admin/:id/resolve', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    await db.query("UPDATE support_tickets SET status='resolved', updated_at=NOW() WHERE id=$1", [req.params.id]);
    res.json({ message: 'Ticket resolved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve ticket' });
  }
});

module.exports = router;

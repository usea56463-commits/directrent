const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { category, search, page = 1 } = req.query;
    const limit = 10;
    const offset = (page - 1) * limit;
    let conditions = ["status='published'"];
    let params = [];
    let i = 1;

    if (category) { conditions.push(`category=$${i++}`); params.push(category); }
    if (search) { conditions.push(`(title ILIKE $${i} OR content ILIKE $${i})`); params.push(`%${search}%`); i++; }

    const where = 'WHERE ' + conditions.join(' AND ');
    const r = await db.query(
      `SELECT b.id, b.title, b.excerpt, b.category, b.cover_image, b.tags, b.views, b.created_at, u.name as author_name
       FROM blogs b JOIN users u ON b.author_id=u.id ${where} ORDER BY b.created_at DESC LIMIT $${i} OFFSET $${i+1}`,
      [...params, limit, offset]
    );
    const count = await db.query(`SELECT COUNT(*) FROM blogs ${where}`, params);
    res.json({ posts: r.rows, total: parseInt(count.rows[0].count), page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch blogs' });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const r = await db.query("SELECT DISTINCT category FROM blogs WHERE status='published' AND category IS NOT NULL");
    res.json(r.rows.map(r => r.category));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const r = await db.query(
      `SELECT b.*, u.name as author_name FROM blogs b JOIN users u ON b.author_id=u.id WHERE b.id=$1`,
      [req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    await db.query('UPDATE blogs SET views=views+1 WHERE id=$1', [req.params.id]);
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { title, content, excerpt, category, status, cover_image, tags } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
    const r = await db.query(
      `INSERT INTO blogs (title, content, excerpt, category, status, author_id, cover_image, tags) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [title, content, excerpt, category, status || 'draft', req.user.id, cover_image, tags]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create post' });
  }
});

router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { title, content, excerpt, category, status, cover_image, tags } = req.body;
    const r = await db.query(
      `UPDATE blogs SET title=$1, content=$2, excerpt=$3, category=$4, status=$5, cover_image=$6, tags=$7, updated_at=NOW() WHERE id=$8 RETURNING *`,
      [title, content, excerpt, category, status, cover_image, tags, req.params.id]
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update post' });
  }
});

router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM blogs WHERE id=$1', [req.params.id]);
    res.json({ message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

router.get('/admin/all', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const r = await db.query(`SELECT b.*, u.name as author_name FROM blogs b JOIN users u ON b.author_id=u.id ORDER BY b.created_at DESC`);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

module.exports = router;

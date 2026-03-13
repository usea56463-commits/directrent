const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary
async function getCloudinaryConfig() {
  const config = await db.query('SELECT value FROM platform_settings WHERE key IN ($1, $2, $3)', ['cloudinary_cloud_name', 'cloudinary_api_key', 'cloudinary_api_secret']);
  const cfg = {};
  config.rows.forEach(r => {
    if (r.key === 'cloudinary_cloud_name') cfg.cloud_name = r.value;
    if (r.key === 'cloudinary_api_key') cfg.api_key = r.value;
    if (r.key === 'cloudinary_api_secret') cfg.api_secret = r.value;
  });
  return cfg;
}

function createUpload() {
  return multer({
    storage: new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: 'directrent/properties',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
        transformation: [{ width: 800, height: 600, crop: 'limit' }]
      }
    })
  });
}

router.get('/', async (req, res) => {
  try {
    const { city, type, min_price, max_price, search, page = 1, limit = 12 } = req.query;
    const offset = (page - 1) * limit;
    let conditions = ["p.status = 'verified'"];
    let params = [];
    let i = 1;

    if (city) { conditions.push(`p.city ILIKE $${i++}`); params.push(`%${city}%`); }
    if (type) { conditions.push(`p.type = $${i++}`); params.push(type); }
    if (min_price) { conditions.push(`p.price >= $${i++}`); params.push(min_price); }
    if (max_price) { conditions.push(`p.price <= $${i++}`); params.push(max_price); }
    if (search) { conditions.push(`(p.title ILIKE $${i} OR p.description ILIKE $${i} OR p.address ILIKE $${i})`); params.push(`%${search}%`); i++; }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const q = `SELECT p.*, u.name as landlord_name FROM properties p JOIN users u ON p.landlord_id = u.id ${where} ORDER BY p.ad_placement DESC, p.created_at DESC LIMIT $${i} OFFSET $${i+1}`;
    params.push(limit, offset);

    const result = await db.query(q, params);
    const countQ = `SELECT COUNT(*) FROM properties p ${where}`;
    const count = await db.query(countQ, params.slice(0, -2));
    res.json({ properties: result.rows, total: parseInt(count.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('Properties fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const r = await db.query(
      `SELECT p.*, u.name as landlord_name, u.phone as landlord_phone, u.email as landlord_email
       FROM properties p JOIN users u ON p.landlord_id = u.id WHERE p.id=$1`,
      [req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Property not found' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch property' });
  }
});

router.post('/', authenticateToken, requireRole('landlord', 'admin'), async (req, res) => {
  try {
    // Configure Cloudinary
    const cfg = await getCloudinaryConfig();
    if (cfg.cloud_name) cloudinary.config(cfg);

    const upload = createUpload();
    upload.array('images', 10)(req, res, async (err) => {
      if (err) return res.status(500).json({ error: 'Upload failed' });

      const { title, description, address, city, state, price, type, bedrooms, bathrooms, amenities } = req.body;
      if (!title || !address || !price) return res.status(400).json({ error: 'Title, address and price are required' });

      const images = req.files ? req.files.map(f => f.path) : [];

      const r = await db.query(
        `INSERT INTO properties (landlord_id, title, description, address, city, state, price, type, bedrooms, bathrooms, amenities, images, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending') RETURNING *`,
        [req.user.id, title, description, address, city, state, price, type || 'long-term', bedrooms, bathrooms, amenities, images]
      );
      res.status(201).json(r.rows[0]);
    });
  } catch (err) {
    console.error('Create property error:', err.message);
    res.status(500).json({ error: 'Failed to create property' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const prop = await db.query('SELECT * FROM properties WHERE id=$1', [req.params.id]);
    if (prop.rows.length === 0) return res.status(404).json({ error: 'Property not found' });

    if (prop.rows[0].landlord_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { title, description, address, city, state, price, type, bedrooms, bathrooms, amenities } = req.body;
    const r = await db.query(
      `UPDATE properties SET title=$1,description=$2,address=$3,city=$4,state=$5,price=$6,type=$7,bedrooms=$8,bathrooms=$9,amenities=$10,updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [title, description, address, city, state, price, type, bedrooms, bathrooms, amenities, req.params.id]
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update property' });
  }
});

router.get('/my/listings', authenticateToken, requireRole('landlord', 'admin'), async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM properties WHERE landlord_id=$1 ORDER BY created_at DESC', [req.user.id]);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

router.post('/:id/promote', authenticateToken, requireRole('landlord', 'admin'), async (req, res) => {
  try {
    const prop = await db.query('SELECT * FROM properties WHERE id=$1 AND landlord_id=$2', [req.params.id, req.user.id]);
    if (prop.rows.length === 0) return res.status(404).json({ error: 'Property not found' });

    const adFee = 10000;
    const user = await db.query('SELECT wallet_balance FROM users WHERE id=$1', [req.user.id]);
    if (parseFloat(user.rows[0].wallet_balance) < adFee) {
      return res.status(400).json({ error: `Insufficient balance. Ad placement costs ₦${adFee.toLocaleString()}` });
    }

    await db.query('UPDATE users SET wallet_balance=wallet_balance-$1 WHERE id=$2', [adFee, req.user.id]);
    await db.query('UPDATE properties SET ad_placement=true WHERE id=$1', [req.params.id]);

    const { recordTransaction } = require('./wallet');
    await recordTransaction(req.user.id, 'ad_payment', -adFee, `Homepage ad placement for property #${req.params.id}`, null, parseInt(req.params.id));

    res.json({ message: 'Property promoted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Promotion failed' });
  }
});

module.exports = router;

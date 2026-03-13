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
        folder: 'directrent/logo',
        allowed_formats: ['jpg', 'png', 'jpeg', 'svg', 'webp'],
        transformation: [{ width: 200, height: 200, crop: 'limit' }]
      }
    })
  });
}

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

router.post('/upload-logo', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const cfg = await getCloudinaryConfig();
    if (!cfg.cloud_name) return res.status(400).json({ error: 'Cloudinary not configured' });

    cloudinary.config(cfg);
    const upload = createUpload();
    upload.single('logo')(req, res, async (err) => {
      if (err) return res.status(500).json({ error: 'Upload failed' });

      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      await db.query(
        'UPDATE platform_settings SET value=$1, updated_at=NOW() WHERE key=$2',
        [req.file.path, 'logo_url']
      );

      res.json({ message: 'Logo uploaded', url: req.file.path });
    });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.get('/public', async (req, res) => {
  try {
    const publicKeys = ['site_name', 'contact_email', 'inspection_fee', 'landlord_onboarding_fee', 'platform_commission_pct', 'withdrawal_fee_pct', 'google_maps_key', 'logo_url'];
    const r = await db.query('SELECT key, value FROM platform_settings WHERE key = ANY($1)', [publicKeys]);
    const settings = {};
    r.rows.forEach(s => { settings[s.key] = s.value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

module.exports = router;

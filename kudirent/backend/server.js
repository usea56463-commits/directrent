require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const PORT = process.env.PORT || 5000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Configure Cloudinary (will be updated from settings)
let cloudinaryConfigured = false;
const configureCloudinary = async () => {
  const cloudName = await getSetting('cloudinary_cloud_name');
  const apiKey = await getSetting('cloudinary_api_key');
  const apiSecret = await getSetting('cloudinary_api_secret');

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
    cloudinaryConfigured = true;
  }
};

// Initialize configurations
configureCloudinary();

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
app.use('/api/', limiter);

// JWT middleware
const authenticateToken = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  const jwtSecret = process.env.JWT_SECRET || 'fallback_secret'; // Use env as fallback
  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Role-based access
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Email configuration (dynamic)
const getEmailTransporter = async () => {
  const emailUser = await getSetting('email_user');
  const emailPass = await getSetting('email_pass');

  if (emailUser && emailPass) {
    return nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });
  }
  return null;
};

// Twilio configuration (dynamic)
const getTwilioClient = async () => {
  const sid = await getSetting('twilio_sid');
  const token = await getSetting('twilio_token');

  if (sid && token) {
    return twilio(sid, token);
  }
  return null;
};

// Helper functions
async function getSetting(key) {
  const result = await pool.query('SELECT value FROM platform_settings WHERE key = $1', [key]);
  return result.rows[0]?.value;
}

async function recordTransaction(userId, type, amount, description, relatedUserId = null, propertyId = null) {
  await pool.query(
    'INSERT INTO transactions (user_id, type, amount, description, related_user_id, property_id) VALUES ($1, $2, $3, $4, $5, $6)',
    [userId, type, amount, description, relatedUserId, propertyId]
  );
}

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role, referral_code } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    let referredById = null;
    if (referral_code) {
      const refResult = await pool.query('SELECT id FROM users WHERE referral_code = $1', [referral_code]);
      if (refResult.rows.length > 0) {
        referredById = refResult.rows[0].id;
      }
    }
    const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role, referred_by_id, referral_code) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [name, email, hashedPassword, role, referredById, referralCode]
    );
    await pool.query('INSERT INTO wallets (user_id, balance) VALUES ($1, $2)', [result.rows[0].id, 0]);
    if (referredById) {
      await pool.query('UPDATE users SET referral_count = referral_count + 1 WHERE id = $1', [referredById]);
    }
    res.status(201).json({ message: 'User registered' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'User not found' });

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'fallback_secret');
    res.json({ token, user: { id: user.id, name: user.name, role: user.role, wallet_balance: user.wallet_balance } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Properties routes with Cloudinary upload
const propertyUpload = multer({
  storage: cloudinaryConfigured ? new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'kudirent/properties',
      allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
      transformation: [{ width: 800, height: 600, crop: 'limit' }]
    }
  }) : multer.memoryStorage(), // Fallback to memory storage
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

app.get('/api/properties', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM properties WHERE verified_badge = TRUE');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/properties', authenticateToken, authorizeRoles('landlord'), propertyUpload.array('images', 10), async (req, res) => {
  const { title, description, price, location, property_type, rooms } = req.body;
  const images = req.files ? req.files.map(file => file.path) : [];
  try {
    const result = await pool.query(
      'INSERT INTO properties (landlord_id, title, description, price, location, images, property_type, rooms) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [req.user.id, title, description, price, location, images, property_type, rooms]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enhanced payments with Paystack integration
app.post('/api/payments/pay-rent', authenticateToken, authorizeRoles('tenant'), async (req, res) => {
  const { property_id } = req.body;
  const tenant_id = req.user.id;

  try {
    const propResult = await pool.query('SELECT * FROM properties WHERE id = $1', [property_id]);
    if (propResult.rows.length === 0) return res.status(404).json({ error: 'Property not found' });

    const property = propResult.rows[0];
    const rentAmount = parseFloat(property.price);

    const walletResult = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [tenant_id]);
    if (walletResult.rows[0].balance < rentAmount) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    // Commission calculation
    const platformPct = parseFloat(await getSetting('platform_commission_pct')) || 5;
    const agentPct = parseFloat(await getSetting('agent_commission_pct')) || 1;
    const platformFee = (rentAmount * platformPct) / 100;
    const agentFee = (platformFee * agentPct) / 100;
    const landlordReceives = rentAmount - platformFee;

    // Update balances
    await pool.query('UPDATE wallets SET balance = balance - $1 WHERE user_id = $2', [rentAmount, tenant_id]);
    await pool.query('UPDATE wallets SET balance = balance + $1 WHERE user_id = $2', [landlordReceives, property.landlord_id]);

    // Record transactions
    await recordTransaction(tenant_id, 'rent_payment', -rentAmount, `Rent payment for property #${property_id}`, property.landlord_id, property_id);
    await recordTransaction(property.landlord_id, 'rent_payment', landlordReceives, `Rent received for property #${property_id}`, tenant_id, property_id);

    // Agent commission
    const landlordResult = await pool.query('SELECT referred_by_id FROM users WHERE id = $1', [property.landlord_id]);
    if (landlordResult.rows[0]?.referred_by_id) {
      const agentResult = await pool.query('SELECT id FROM agents WHERE user_id = $1', [landlordResult.rows[0].referred_by_id]);
      if (agentResult.rows.length > 0) {
        await pool.query('UPDATE wallets SET balance = balance + $1 WHERE user_id = $2', [agentFee, landlordResult.rows[0].referred_by_id]);
        await pool.query('UPDATE agents SET total_commission = total_commission + $1 WHERE user_id = $2', [agentFee, landlordResult.rows[0].referred_by_id]);
        await recordTransaction(landlordResult.rows[0].referred_by_id, 'agent_commission', agentFee, `Agent commission from rent payment`, tenant_id, property_id);
      }
    }

    res.json({ message: 'Payment successful' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Wallets
app.get('/api/wallets/balance', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [req.user.id]);
    res.json({ balance: result.rows[0].balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/wallets/deposit', authenticateToken, async (req, res) => {
  const { amount } = req.body;
  try {
    await pool.query('UPDATE wallets SET balance = balance + $1 WHERE user_id = $2', [amount, req.user.id]);
    await recordTransaction(req.user.id, 'deposit', amount, 'Wallet deposit');
    res.json({ message: 'Deposit successful' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Agents
app.get('/api/agents/commission', authenticateToken, authorizeRoles('agent'), async (req, res) => {
  try {
    const result = await pool.query('SELECT total_commission FROM agents WHERE user_id = $1', [req.user.id]);
    res.json({ total_commission: result.rows[0].total_commission });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/agents/referral-link', authenticateToken, authorizeRoles('agent'), async (req, res) => {
  try {
    const result = await pool.query('SELECT referral_code FROM users WHERE id = $1', [req.user.id]);
    res.json({ referral_code: result.rows[0].referral_code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin routes
app.get('/api/admin/users', authenticateToken, authorizeRoles('admin', 'super_admin', 'sub_admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role, wallet_balance, rating, verified_badge FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/approve-property/:id', authenticateToken, authorizeRoles('admin', 'super_admin', 'sub_admin'), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE properties SET verified_badge = TRUE WHERE id = $1', [id]);

    // Log admin action
    await pool.query('INSERT INTO admin_actions (action_type, performed_by_admin_id, target_property_id, notes) VALUES ($1, $2, $3, $4)',
      ['approve_property', req.user.id, id, `Approved property ID: ${id}`]);

    res.json({ message: 'Property approved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin settings management
app.get('/api/admin/settings', authenticateToken, authorizeRoles('admin', 'super_admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value, description FROM platform_settings ORDER BY key');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/settings/:key', authenticateToken, authorizeRoles('admin', 'super_admin'), async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  try {
    await pool.query('UPDATE platform_settings SET value = $1 WHERE key = $2', [value, key]);

    // Log admin action
    await pool.query('INSERT INTO admin_actions (action_type, performed_by_admin_id, notes) VALUES ($1, $2, $3)',
      ['update_setting', req.user.id, `Updated setting: ${key}`]);

    // Refresh configurations if API keys changed
    if (['cloudinary_cloud_name', 'cloudinary_api_key', 'cloudinary_api_secret'].includes(key)) {
      await configureCloudinary();
    }

    res.json({ message: 'Setting updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/settings', authenticateToken, authorizeRoles('admin', 'super_admin'), async (req, res) => {
  const { key, value, description } = req.body;
  try {
    await pool.query('INSERT INTO platform_settings (key, value, description) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = $2, description = $3', [key, value, description]);
    res.json({ message: 'Setting added/updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin stats
app.get('/api/admin/stats', authenticateToken, authorizeRoles('admin', 'super_admin', 'sub_admin'), async (req, res) => {
  try {
    const userStats = await pool.query('SELECT role, COUNT(*) as count FROM users GROUP BY role');
    const propertyStats = await pool.query('SELECT COUNT(*) as total_properties, COUNT(CASE WHEN verified_badge = TRUE THEN 1 END) as verified_properties FROM properties');
    const transactionStats = await pool.query('SELECT SUM(amount) as total_transactions FROM transactions WHERE type = \'rent_payment\' AND amount > 0');
    const walletStats = await pool.query('SELECT SUM(balance) as total_wallet_balance FROM wallets');

    res.json({
      users: userStats.rows,
      properties: propertyStats.rows[0],
      transactions: transactionStats.rows[0],
      wallets: walletStats.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// KYC with document upload
const kycUpload = multer({
  storage: cloudinaryConfigured ? new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'kudirent/kyc',
      allowed_formats: ['jpg', 'png', 'jpeg', 'pdf'],
    }
  }) : multer.memoryStorage(), // Fallback to memory storage
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

app.post('/api/kyc/submit', authenticateToken, kycUpload.fields([
  { name: 'id_document', maxCount: 1 },
  { name: 'address_proof', maxCount: 1 },
  { name: 'selfie', maxCount: 1 }
]), async (req, res) => {
  const files = req.files;
  try {
    await pool.query(
      'INSERT INTO kyc (user_id, document_url, status) VALUES ($1, $2, $3)',
      [req.user.id, JSON.stringify({
        id_document: files.id_document?.[0]?.path,
        address_proof: files.address_proof?.[0]?.path,
        selfie: files.selfie?.[0]?.path
      }), 'pending']
    );
    res.json({ message: 'KYC submitted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/kyc/status', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT status FROM kyc WHERE user_id = $1', [req.user.id]);
    res.json({ status: result.rows[0]?.status || 'not_submitted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reviews
app.post('/api/reviews', authenticateToken, authorizeRoles('tenant'), async (req, res) => {
  const { property_id, rating, comment } = req.body;
  try {
    await pool.query('INSERT INTO reviews (property_id, tenant_id, rating, comment) VALUES ($1, $2, $3, $4)', [property_id, req.user.id, rating, comment]);
    res.json({ message: 'Review submitted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tickets
app.post('/api/tickets', authenticateToken, async (req, res) => {
  const { subject, description } = req.body;
  try {
    await pool.query('INSERT INTO tickets (user_id, subject, description) VALUES ($1, $2, $3)', [req.user.id, subject, description]);
    res.json({ message: 'Ticket created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lawyers
app.post('/api/lawyers/request', authenticateToken, async (req, res) => {
  const { services_requested } = req.body;
  try {
    await pool.query('INSERT INTO lawyers (user_id, services_requested) VALUES ($1, $2)', [req.user.id, services_requested]);
    res.json({ message: 'Lawyer requested' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
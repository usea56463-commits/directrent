require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 5000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// JWT middleware
const authenticateToken = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
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

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, email, hashedPassword, role]
    );
    await pool.query('INSERT INTO wallets (user_id, balance) VALUES ($1, $2)', [result.rows[0].id, 0]);
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

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET);
    res.json({ token, user: { id: user.id, name: user.name, role: user.role, wallet_balance: user.wallet_balance } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Properties routes
app.get('/api/properties', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM properties');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/properties', authenticateToken, authorizeRoles('landlord'), async (req, res) => {
  const { title, description, price, location, images, property_type, rooms } = req.body;
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

// Payments and escrow
app.post('/api/payments/pay-rent', authenticateToken, authorizeRoles('tenant'), async (req, res) => {
  const { property_id, rent_amount } = req.body;
  const tenant_id = req.user.id;

  try {
    // Calculate commission
    let commission = 0;
    if (rent_amount >= 500000 && rent_amount <= 2000000) {
      commission = rent_amount * 0.05;
    } else if (rent_amount > 2000000) {
      commission = rent_amount * 0.10;
    }
    const agent_commission = commission * 0.4;
    const platform_revenue = commission - agent_commission;

    // Check wallet balance
    const walletResult = await pool.query('SELECT balance FROM wallets WHERE user_id = $1', [tenant_id]);
    if (walletResult.rows[0].balance < rent_amount) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    // Deduct from wallet
    await pool.query('UPDATE wallets SET balance = balance - $1 WHERE user_id = $2', [rent_amount, tenant_id]);

    // Create transaction
    const transactionResult = await pool.query(
      'INSERT INTO transactions (tenant_id, property_id, rent_amount, commission, agent_commission, platform_revenue, escrow_status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [tenant_id, property_id, rent_amount, commission, agent_commission, platform_revenue, 'held']
    );

    // Update agent commission if applicable
    const propertyResult = await pool.query('SELECT landlord_id FROM properties WHERE id = $1', [property_id]);
    const agentResult = await pool.query('SELECT id FROM agents WHERE user_id = $1', [propertyResult.rows[0].landlord_id]);
    if (agentResult.rows.length > 0) {
      await pool.query('UPDATE agents SET total_commission = total_commission + $1 WHERE id = $2', [agent_commission, agentResult.rows[0].id]);
    }

    res.json({ message: 'Payment successful', transaction: transactionResult.rows[0] });
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
    res.json({ message: 'Property approved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// KYC
app.post('/api/kyc/submit', authenticateToken, upload.single('document'), async (req, res) => {
  const { document_url } = req.body;
  try {
    await pool.query('INSERT INTO kyc (user_id, document_url) VALUES ($1, $2)', [req.user.id, document_url]);
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
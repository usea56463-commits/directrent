require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
app.use('/api/', limiter);

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/wallet', require('./routes/wallet').router);
app.use('/api/properties', require('./routes/properties'));
app.use('/api/inspections', require('./routes/inspections'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/kyc', require('./routes/kyc'));
app.use('/api/agents', require('./routes/agents'));
app.use('/api/lawyers', require('./routes/lawyers'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/blog', require('./routes/blog'));
app.use('/api/support', require('./routes/support'));
app.use('/api/settings', require('./routes/settings'));

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const initDB = require('./db/init');

initDB()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`DirectRent server running on http://0.0.0.0:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize DB:', err.message);
    process.exit(1);
  });

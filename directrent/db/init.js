const db = require('./index');

const initDB = async () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(50),
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'tenant' CHECK (role IN ('tenant','landlord','agent','lawyer','admin')),
      status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active','suspended','pending')),
      wallet_balance DECIMAL(15,2) DEFAULT 0,
      verified_badge BOOLEAN DEFAULT false,
      verified_limit DECIMAL(15,2) DEFAULT 0,
      deposit_amount DECIMAL(15,2) DEFAULT 0,
      referral_count INTEGER DEFAULT 0,
      kyc_status VARCHAR(50) DEFAULT 'none' CHECK (kyc_status IN ('none','pending','approved','rejected')),
      referral_code VARCHAR(20) UNIQUE,
      referred_by_id INTEGER REFERENCES users(id),
      email_verified BOOLEAN DEFAULT false,
      profile_photo VARCHAR(500),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS properties (
      id SERIAL PRIMARY KEY,
      landlord_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      address TEXT NOT NULL,
      city VARCHAR(100),
      state VARCHAR(100),
      country VARCHAR(100) DEFAULT 'Nigeria',
      price DECIMAL(15,2) NOT NULL,
      type VARCHAR(50) DEFAULT 'long-term' CHECK (type IN ('long-term','shortlet')),
      status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending','verified','flagged','removed')),
      ad_placement BOOLEAN DEFAULT false,
      bedrooms INTEGER,
      bathrooms INTEGER,
      amenities TEXT,
      images TEXT[],
      documents TEXT[],
      latitude DECIMAL(10,8),
      longitude DECIMAL(11,8),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS inspection_credits (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES users(id),
      property_id INTEGER REFERENCES properties(id),
      fee_status VARCHAR(50) DEFAULT 'pending' CHECK (fee_status IN ('used','pending','free')),
      amount_paid DECIMAL(15,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS agents (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id),
      total_referrals INTEGER DEFAULT 0,
      lifetime_commissions DECIMAL(15,2) DEFAULT 0,
      upgraded_status BOOLEAN DEFAULT false,
      upgrade_threshold INTEGER DEFAULT 5,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS lawyers (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id),
      verification_status VARCHAR(50) DEFAULT 'pending' CHECK (verification_status IN ('pending','approved','rejected')),
      fee_percentage DECIMAL(5,2) DEFAULT 5.00,
      location VARCHAR(255),
      specialization VARCHAR(255),
      license_number VARCHAR(100),
      years_experience INTEGER,
      bio TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      type VARCHAR(100) NOT NULL CHECK (type IN ('deposit','withdrawal','rent_payment','inspection_fee','onboarding_fee','agent_commission','lawyer_fee','ad_payment','platform_fee')),
      amount DECIMAL(15,2) NOT NULL,
      description TEXT,
      reference VARCHAR(100) UNIQUE,
      status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('pending','completed','failed','reversed')),
      related_user_id INTEGER REFERENCES users(id),
      related_property_id INTEGER REFERENCES properties(id),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS admin_actions (
      id SERIAL PRIMARY KEY,
      action_type VARCHAR(100) NOT NULL,
      performed_by_admin_id INTEGER REFERENCES users(id),
      target_user_id INTEGER REFERENCES users(id),
      target_property_id INTEGER REFERENCES properties(id),
      notes TEXT,
      timestamp TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS blogs (
      id SERIAL PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      content TEXT NOT NULL,
      excerpt TEXT,
      category VARCHAR(100),
      status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('published','draft')),
      author_id INTEGER REFERENCES users(id),
      cover_image VARCHAR(500),
      tags TEXT[],
      views INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      category VARCHAR(100),
      subject VARCHAR(255),
      description TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
      assigned_admin_id INTEGER REFERENCES users(id),
      priority VARCHAR(50) DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ticket_replies (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER REFERENCES support_tickets(id),
      user_id INTEGER REFERENCES users(id),
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS kyc_documents (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE REFERENCES users(id),
      id_type VARCHAR(100),
      id_document VARCHAR(500),
      address_proof VARCHAR(500),
      selfie VARCHAR(500),
      status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
      reviewed_by INTEGER REFERENCES users(id),
      review_notes TEXT,
      submitted_at TIMESTAMP DEFAULT NOW(),
      reviewed_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS platform_settings (
      id SERIAL PRIMARY KEY,
      key VARCHAR(100) UNIQUE NOT NULL,
      value TEXT,
      description TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    INSERT INTO platform_settings (key, value, description) VALUES
      ('inspection_fee', '5000', 'Inspection fee in NGN'),
      ('landlord_onboarding_fee', '5000', 'Landlord onboarding fee in NGN'),
      ('platform_commission_pct', '5', 'Platform commission percentage on rent'),
      ('agent_commission_pct', '1', 'Agent commission percentage on platform fee'),
      ('withdrawal_fee_pct', '2', 'Withdrawal fee percentage'),
      ('kyc_threshold', '500000', 'KYC required above this deposit amount in NGN'),
      ('cloudinary_cloud_name', '', 'Cloudinary cloud name'),
      ('cloudinary_api_key', '', 'Cloudinary API key'),
      ('cloudinary_api_secret', '', 'Cloudinary API secret'),
      ('sendgrid_api_key', '', 'SendGrid API key'),
      ('smtp_host', '', 'SMTP host'),
      ('smtp_user', '', 'SMTP user'),
      ('smtp_pass', '', 'SMTP password'),
      ('twilio_sid', '', 'Twilio account SID'),
      ('twilio_token', '', 'Twilio auth token'),
      ('twilio_phone', '', 'Twilio phone number'),
      ('google_maps_key', '', 'Google Maps API key'),
      ('site_name', 'DirectRent', 'Platform name'),
      ('contact_email', 'admin@directrent.ng', 'Platform contact email')
    ON CONFLICT (key) DO NOTHING;
  `;

  try {
    await db.query(sql);
    console.log('Database schema initialized successfully');

    const adminCheck = await db.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (adminCheck.rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('Admin@1234', 10);
      const code = 'ADMIN001';
      await db.query(
        `INSERT INTO users (name, email, phone, password_hash, role, status, email_verified, referral_code)
         VALUES ($1, $2, $3, $4, 'admin', 'active', true, $5)`,
        ['Platform Admin', 'admin@directrent.ng', '+2340000000000', hash, code]
      );
      console.log('Default admin created: admin@directrent.ng / Admin@1234');
    }
  } catch (err) {
    console.error('DB init error:', err.message);
    throw err;
  }
};

module.exports = initDB;

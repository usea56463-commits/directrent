-- Database schema for KudiRent

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'sub_admin', 'tenant', 'landlord', 'agent', 'lawyer', 'admin')),
    wallet_balance DECIMAL(10,2) DEFAULT 0.00,
    rating DECIMAL(3,2) DEFAULT 0.00,
    verified_badge BOOLEAN DEFAULT FALSE,
    referred_by_id INTEGER REFERENCES users(id),
    referral_code VARCHAR(10) UNIQUE,
    referral_count INTEGER DEFAULT 0,
    kyc_status VARCHAR(20) DEFAULT 'not_submitted',
    status VARCHAR(20) DEFAULT 'active',
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS properties (
    id SERIAL PRIMARY KEY,
    landlord_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    location VARCHAR(255) NOT NULL,
    images TEXT[], -- Array of image URLs
    property_type VARCHAR(50),
    rooms INTEGER,
    verified_badge BOOLEAN DEFAULT FALSE,
    rating DECIMAL(3,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'pending',
    ad_placement INTEGER DEFAULT 0,
    city VARCHAR(100),
    address VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    related_user_id INTEGER REFERENCES users(id),
    property_id INTEGER REFERENCES properties(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    total_commission DECIMAL(10,2) DEFAULT 0.00,
    referral_code VARCHAR(100) UNIQUE,
    lifetime_commissions DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
    tenant_id INTEGER REFERENCES users(id),
    rating DECIMAL(3,2) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    subject VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kyc (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    document_url JSONB,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lawyers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    services_requested TEXT,
    payments_made DECIMAL(10,2) DEFAULT 0.00,
    verification_status VARCHAR(20) DEFAULT 'pending',
    fee_percentage DECIMAL(5,2),
    location VARCHAR(255),
    specialization TEXT,
    bio TEXT,
    license_number VARCHAR(100),
    years_experience INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_actions (
    id SERIAL PRIMARY KEY,
    action_type VARCHAR(100) NOT NULL,
    performed_by_admin_id INTEGER REFERENCES users(id),
    target_user_id INTEGER REFERENCES users(id),
    target_property_id INTEGER REFERENCES properties(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default platform settings
INSERT INTO platform_settings (key, value, description) VALUES
('platform_commission_pct', '5', 'Platform commission percentage for rents 500k-2M'),
('platform_commission_10_pct', '10', 'Platform commission percentage for rents above 2M'),
('agent_commission_pct', '40', 'Agent commission percentage from platform fee'),
('site_url', 'https://kudirent.onrender.com', 'Site URL for referral links'),
('cloudinary_cloud_name', '', 'Cloudinary cloud name for image uploads'),
('cloudinary_api_key', '', 'Cloudinary API key'),
('cloudinary_api_secret', '', 'Cloudinary API secret'),
('twilio_sid', '', 'Twilio SID for SMS'),
('twilio_token', '', 'Twilio auth token'),
('email_user', '', 'Email service username'),
('email_pass', '', 'Email service password'),
('paystack_secret_key', '', 'Paystack secret key'),
('paystack_public_key', '', 'Paystack public key'),
('jwt_secret', '', 'JWT secret for authentication')
ON CONFLICT (key) DO NOTHING;

-- Seed data
INSERT INTO users (name, email, password, role, wallet_balance, rating, verified_badge, referral_code) VALUES
('Super Admin', 'superadmin@kudirent.com', '$2b$10$hashedpassword', 'super_admin', 0.00, 0.00, TRUE, 'ADMIN001'),
('Sub Admin IHA', 'subadmin@kudirent.com', '$2b$10$hashedpassword', 'sub_admin', 0.00, 0.00, TRUE, 'ADMIN002'),
('Tenant User', 'tenant@kudirent.com', '$2b$10$hashedpassword', 'tenant', 100000.00, 4.5, FALSE, 'TENANT01'),
('Landlord User', 'landlord@kudirent.com', '$2b$10$hashedpassword', 'landlord', 0.00, 4.2, TRUE, 'LAND001'),
('Agent User', 'agent@kudirent.com', '$2b$10$hashedpassword', 'agent', 0.00, 4.0, FALSE, 'AGENT001')
ON CONFLICT (email) DO NOTHING;

INSERT INTO properties (landlord_id, title, description, price, location, images, property_type, rooms, verified_badge, rating, city) VALUES
(4, 'Luxury 3BR Apartment', 'Spacious apartment in Lekki', 1500000.00, 'Lekki Phase 1', ARRAY['image1.jpg', 'image2.jpg'], 'apartment', 3, TRUE, 4.5, 'Lagos'),
(4, '2BR Flat in Ikeja', 'Affordable flat for families', 800000.00, 'Ikeja GRA', ARRAY['image3.jpg'], 'flat', 2, FALSE, 3.8, 'Lagos')
ON CONFLICT DO NOTHING;

INSERT INTO agents (user_id, total_commission, referral_code) VALUES
(5, 50000.00, 'AGENT123')
ON CONFLICT DO NOTHING;

INSERT INTO wallets (user_id, balance) VALUES
(3, 100000.00),
(4, 50000.00),
(5, 25000.00)
ON CONFLICT DO NOTHING;
-- Database schema for KudiRent

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'sub_admin', 'tenant', 'landlord', 'agent', 'lawyer', 'admin')),
    wallet_balance DECIMAL(10,2) DEFAULT 0.00,
    rating DECIMAL(3,2) DEFAULT 0.00,
    verified_badge BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE properties (
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES users(id),
    property_id INTEGER REFERENCES properties(id),
    rent_amount DECIMAL(10,2) NOT NULL,
    commission DECIMAL(10,2) DEFAULT 0.00,
    agent_commission DECIMAL(10,2) DEFAULT 0.00,
    platform_revenue DECIMAL(10,2) DEFAULT 0.00,
    escrow_status VARCHAR(50) DEFAULT 'pending' CHECK (escrow_status IN ('pending', 'held', 'released')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE agents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    total_commission DECIMAL(10,2) DEFAULT 0.00,
    referral_code VARCHAR(100) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
    tenant_id INTEGER REFERENCES users(id),
    rating DECIMAL(3,2) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    subject VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE kyc (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    document_url VARCHAR(500),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lawyers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    services_requested TEXT,
    payments_made DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed data
INSERT INTO users (name, email, password, role, wallet_balance, rating, verified_badge) VALUES
('Super Admin', 'superadmin@kudirent.com', '$2b$10$hashedpassword', 'super_admin', 0.00, 0.00, TRUE),
('Sub Admin IHA', 'subadmin@kudirent.com', '$2b$10$hashedpassword', 'sub_admin', 0.00, 0.00, TRUE),
('Tenant User', 'tenant@kudirent.com', '$2b$10$hashedpassword', 'tenant', 100000.00, 4.5, FALSE),
('Landlord User', 'landlord@kudirent.com', '$2b$10$hashedpassword', 'landlord', 0.00, 4.2, TRUE),
('Agent User', 'agent@kudirent.com', '$2b$10$hashedpassword', 'agent', 0.00, 4.0, FALSE);

INSERT INTO properties (landlord_id, title, description, price, location, images, property_type, rooms, verified_badge, rating) VALUES
(4, 'Luxury 3BR Apartment', 'Spacious apartment in Lekki', 1500000.00, 'Lekki, Lagos', ARRAY['image1.jpg', 'image2.jpg'], 'apartment', 3, TRUE, 4.5),
(4, '2BR Flat in Ikeja', 'Affordable flat for families', 800000.00, 'Ikeja, Lagos', ARRAY['image3.jpg'], 'flat', 2, FALSE, 3.8);

INSERT INTO agents (user_id, total_commission, referral_code) VALUES
(5, 50000.00, 'AGENT123');

INSERT INTO wallets (user_id, balance) VALUES
(3, 100000.00),
(4, 50000.00),
(5, 25000.00);
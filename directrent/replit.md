# DirectRent - Property Rental Platform

## Overview
DirectRent is Nigeria's full-stack property rental platform built with Node.js + Express v5, PostgreSQL, and a Vanilla JS/TailwindCSS frontend.

## Tech Stack
- **Backend**: Node.js + Express v5, PostgreSQL (pg library), JWT Auth, bcrypt
- **Frontend**: Vanilla JS, TailwindCSS CDN, Font Awesome 6.5.0, Google Fonts Inter
- **Architecture**: REST API (port 5000) + Static file serving from /public

## Key Files
- `server.js` - Main Express app with all routes registered
- `db/init.js` - PostgreSQL schema + seed (auto-runs on startup)
- `middleware/auth.js` - JWT verification + role-based access control
- `public/js/api.js` - Shared frontend utilities (auth, fetch, toast, currency)

## Pages
### Public Pages (no auth required)
- `/` - Homepage (hero + search + featured properties + how it works)
- `/pages/properties.html` - Property browser with filter sidebar + modal
- `/pages/lawyers.html` - Lawyer directory + hire modal
- `/pages/agents.html` - Agent info + commission structure
- `/pages/blog.html` - Blog post grid + newsletter
- `/pages/support.html` - FAQ accordion + support ticket form
- `/pages/login.html` - Split-panel login form
- `/pages/register.html` - Role-selector + registration form

### Role Dashboards (auth required)
- `/pages/dashboard-tenant.html` - Green theme, wallet/badge/inspections/KYC
- `/pages/dashboard-landlord.html` - Blue theme, property listing + inspections
- `/pages/dashboard-agent.html` - Orange theme, referrals + earnings + wallet
- `/pages/dashboard-lawyer.html` - Purple theme, cases + profile + wallet
- `/pages/dashboard-admin.html` - Gray/red theme, full platform management

## API Routes
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - Login → JWT
- `GET/POST /api/wallet` - Balance, deposit, withdraw, transactions
- `GET/POST /api/properties` - List, create, filter, approve
- `POST /api/inspections/:id/request` - Request property inspection
- `PUT /api/inspections/:id/status` - Approve/reject inspection
- `GET /api/lawyers` - List verified lawyers
- `POST /api/lawyers/hire/:id` - Hire lawyer (wallet debit)
- `GET/POST /api/kyc` - KYC submission + admin review
- `GET/POST /api/blog` - Blog posts
- `POST /api/support` - Submit support ticket
- `GET /api/settings` - Platform settings (admin)
- `GET /api/admin/*` - Admin management endpoints

## Business Rules
- **Verified Badge**: tenant deposits ≥ property price → free inspection
- **Inspection fee**: ₦5,000 split: ₦2k landlord, ₦2k platform, ₦1k agent
- **Rent commission**: 5% platform, 1% goes to referring agent
- **Agent earnings**: ₦2k/landlord onboarding, ₦1k/inspection, 1% rent, 1% lawyer fees
- **Withdrawal fee**: 2% (resets Verified Badge)
- **KYC required**: for deposits ≥ ₦500,000
- **Landlord onboarding fee**: ₦5,000 to list properties

## Default Admin
- Email: `admin@directrent.ng`
- Password: `Admin@1234`

## UI Design System
- Navbar: Dark green (#052e16) — consistent across all pages
- Tenant dashboard: Green color scheme
- Landlord dashboard: Blue color scheme  
- Agent dashboard: Orange color scheme
- Lawyer dashboard: Purple color scheme
- Admin dashboard: Gray/red color scheme
- Real Unsplash property images throughout
- Card hover animations + glassmorphism effects

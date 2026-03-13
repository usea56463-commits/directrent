const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { recordTransaction, getSetting } = require('./wallet');

router.post('/request', authenticateToken, requireRole('tenant'), async (req, res) => {
  try {
    const { property_id } = req.body;
    if (!property_id) return res.status(400).json({ error: 'Property ID required' });

    const propR = await db.query("SELECT * FROM properties WHERE id=$1 AND status='verified'", [property_id]);
    if (propR.rows.length === 0) return res.status(404).json({ error: 'Property not found or not verified' });

    const property = propR.rows[0];
    const userR = await db.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const user = userR.rows[0];

    const existing = await db.query(
      "SELECT id FROM inspection_credits WHERE tenant_id=$1 AND property_id=$2 AND fee_status IN ('pending','used','free')",
      [req.user.id, property_id]
    );
    if (existing.rows.length > 0) return res.status(409).json({ error: 'You have already requested an inspection for this property' });

    const inspectionFee = await getSetting('inspection_fee') || 5000;
    const userDeposit = parseFloat(user.deposit_amount);
    const propertyPrice = parseFloat(property.price);

    let feeStatus = 'pending';
    let amountPaid = 0;
    let message = '';

    if (user.verified_badge && userDeposit >= propertyPrice) {
      feeStatus = 'free';
      message = 'Free inspection granted (deposit covers property price)';
    } else {
      if (parseFloat(user.wallet_balance) < inspectionFee) {
        return res.status(400).json({ error: `Insufficient balance. Inspection fee is ₦${inspectionFee.toLocaleString()}` });
      }

      const landlordShare = 2000;
      const platformShare = 2000;
      const agentShare = 1000;

      await db.query('UPDATE users SET wallet_balance=wallet_balance-$1 WHERE id=$2', [inspectionFee, req.user.id]);
      await db.query('UPDATE users SET wallet_balance=wallet_balance+$1 WHERE id=$2', [landlordShare, property.landlord_id]);

      await recordTransaction(req.user.id, 'inspection_fee', -inspectionFee, `Inspection fee for property #${property_id}`, null, parseInt(property_id));
      await recordTransaction(property.landlord_id, 'inspection_fee', landlordShare, `Inspection fee share from tenant`, req.user.id, parseInt(property_id));

      const landlordR = await db.query('SELECT referred_by_id FROM users WHERE id=$1', [property.landlord_id]);
      if (landlordR.rows[0]?.referred_by_id) {
        const agentR = await db.query('SELECT id FROM agents WHERE user_id=$1', [landlordR.rows[0].referred_by_id]);
        if (agentR.rows.length > 0) {
          await db.query('UPDATE users SET wallet_balance=wallet_balance+$1 WHERE id=$2', [agentShare, landlordR.rows[0].referred_by_id]);
          await db.query('UPDATE agents SET lifetime_commissions=lifetime_commissions+$1 WHERE user_id=$2', [agentShare, landlordR.rows[0].referred_by_id]);
          await recordTransaction(landlordR.rows[0].referred_by_id, 'agent_commission', agentShare, `Agent commission from inspection fee`, req.user.id, parseInt(property_id));
        }
      }

      amountPaid = inspectionFee;
      feeStatus = 'pending';
      message = `Inspection booked. Fee of ₦${inspectionFee.toLocaleString()} paid.`;
    }

    await db.query(
      'INSERT INTO inspection_credits (tenant_id, property_id, fee_status, amount_paid) VALUES ($1,$2,$3,$4)',
      [req.user.id, property_id, feeStatus, amountPaid]
    );

    res.json({ message, fee_status: feeStatus, amount_paid: amountPaid });
  } catch (err) {
    console.error('Inspection error:', err.message);
    res.status(500).json({ error: 'Inspection request failed' });
  }
});

router.get('/my', authenticateToken, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT ic.*, p.title, p.address, p.city, p.price, p.type, u.name as landlord_name
       FROM inspection_credits ic
       JOIN properties p ON ic.property_id = p.id
       JOIN users u ON p.landlord_id = u.id
       WHERE ic.tenant_id=$1 ORDER BY ic.created_at DESC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inspections' });
  }
});

router.get('/property/:property_id', authenticateToken, requireRole('landlord', 'admin'), async (req, res) => {
  try {
    const r = await db.query(
      `SELECT ic.*, u.name as tenant_name, u.email as tenant_email, u.phone as tenant_phone, u.kyc_status
       FROM inspection_credits ic JOIN users u ON ic.tenant_id = u.id
       WHERE ic.property_id=$1 ORDER BY ic.created_at DESC`,
      [req.params.property_id]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inspection requests' });
  }
});

module.exports = router;

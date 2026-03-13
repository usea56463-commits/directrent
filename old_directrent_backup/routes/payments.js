const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { recordTransaction, getSetting } = require('./wallet');

router.post('/rent', authenticateToken, requireRole('tenant'), async (req, res) => {
  try {
    const { property_id } = req.body;
    if (!property_id) return res.status(400).json({ error: 'Property ID required' });

    const propR = await db.query('SELECT * FROM properties WHERE id=$1', [property_id]);
    if (propR.rows.length === 0) return res.status(404).json({ error: 'Property not found' });

    const property = propR.rows[0];
    const rentAmount = parseFloat(property.price);

    const userR = await db.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const user = userR.rows[0];

    if (parseFloat(user.wallet_balance) < rentAmount) {
      return res.status(400).json({ error: `Insufficient balance. Rent is ₦${rentAmount.toLocaleString()}` });
    }

    const platformPct = await getSetting('platform_commission_pct') || 5;
    const agentPct = await getSetting('agent_commission_pct') || 1;

    const platformFee = (rentAmount * platformPct) / 100;
    const agentFee = (platformFee * agentPct) / 100;
    const landlordReceives = rentAmount - platformFee;

    await db.query('UPDATE users SET wallet_balance=wallet_balance-$1, deposit_amount=0, verified_badge=false, verified_limit=0 WHERE id=$2', [rentAmount, req.user.id]);
    await db.query('UPDATE users SET wallet_balance=wallet_balance+$1 WHERE id=$2', [landlordReceives, property.landlord_id]);

    await recordTransaction(req.user.id, 'rent_payment', -rentAmount, `Rent payment for property #${property_id}`, property.landlord_id, parseInt(property_id));
    await recordTransaction(property.landlord_id, 'rent_payment', landlordReceives, `Rent received for property #${property_id}`, req.user.id, parseInt(property_id));

    const landlordR = await db.query('SELECT referred_by_id FROM users WHERE id=$1', [property.landlord_id]);
    if (landlordR.rows[0]?.referred_by_id) {
      const agentR = await db.query('SELECT id FROM agents WHERE user_id=$1', [landlordR.rows[0].referred_by_id]);
      if (agentR.rows.length > 0) {
        await db.query('UPDATE users SET wallet_balance=wallet_balance+$1 WHERE id=$2', [agentFee, landlordR.rows[0].referred_by_id]);
        await db.query('UPDATE agents SET lifetime_commissions=lifetime_commissions+$1 WHERE user_id=$2', [agentFee, landlordR.rows[0].referred_by_id]);
        await recordTransaction(landlordR.rows[0].referred_by_id, 'agent_commission', agentFee, `Agent commission from rent payment`, req.user.id, parseInt(property_id));
      }
    }

    await db.query('UPDATE inspection_credits SET fee_status=$1 WHERE tenant_id=$2 AND property_id=$3 AND fee_status=$4', ['used', req.user.id, property_id, 'pending']);

    res.json({
      message: 'Rent payment successful',
      rent_amount: rentAmount,
      landlord_receives: landlordReceives,
      platform_fee: platformFee
    });
  } catch (err) {
    console.error('Rent payment error:', err.message);
    res.status(500).json({ error: 'Rent payment failed' });
  }
});

router.post('/landlord-onboard', authenticateToken, requireRole('landlord'), async (req, res) => {
  try {
    const userR = await db.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
    const user = userR.rows[0];

    const onboardingFee = await getSetting('landlord_onboarding_fee') || 5000;

    const existingTxn = await db.query("SELECT id FROM transactions WHERE user_id=$1 AND type='onboarding_fee'", [req.user.id]);
    if (existingTxn.rows.length > 0) return res.status(409).json({ error: 'Already paid onboarding fee' });

    if (parseFloat(user.wallet_balance) < onboardingFee) {
      return res.status(400).json({ error: `Insufficient balance. Onboarding fee is ₦${onboardingFee.toLocaleString()}` });
    }

    const agentShare = 2000;
    const platformShare = onboardingFee - agentShare;

    await db.query('UPDATE users SET wallet_balance=wallet_balance-$1 WHERE id=$2', [onboardingFee, req.user.id]);
    await recordTransaction(req.user.id, 'onboarding_fee', -onboardingFee, 'Landlord onboarding fee');

    if (user.referred_by_id) {
      const agentR = await db.query('SELECT id FROM agents WHERE user_id=$1', [user.referred_by_id]);
      if (agentR.rows.length > 0) {
        await db.query('UPDATE users SET wallet_balance=wallet_balance+$1 WHERE id=$2', [agentShare, user.referred_by_id]);
        await db.query('UPDATE agents SET lifetime_commissions=lifetime_commissions+$1 WHERE user_id=$2', [agentShare, user.referred_by_id]);
        await recordTransaction(user.referred_by_id, 'agent_commission', agentShare, 'Agent commission from landlord onboarding', req.user.id);
      }
    }

    res.json({ message: 'Onboarding fee paid successfully', amount: onboardingFee });
  } catch (err) {
    console.error('Onboard error:', err.message);
    res.status(500).json({ error: 'Onboarding payment failed' });
  }
});

module.exports = router;

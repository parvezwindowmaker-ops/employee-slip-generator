const express = require('express');
const router = express.Router();
const { Admin } = require('../models');
const requireAdmin = require('../middleware/requireAdmin');
const { createAdminToken } = require('../utils/token');
const { verifyPassword } = require('../utils/password');

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const admin = await Admin.unscoped().findOne({ where: { username } });

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!admin.isActive) {
      return res.status(403).json({ error: 'Admin account is inactive' });
    }

    const passwordValid = await verifyPassword(password, admin.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await admin.update({ lastLoginAt: new Date() });

    res.json({
      token: createAdminToken(admin),
      admin: {
        id: admin.id,
        username: admin.username,
        fullName: admin.fullName,
        lastLoginAt: admin.lastLoginAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAdmin, async (req, res, next) => {
  try {
    res.json({
      admin: {
        id: req.admin.id,
        username: req.admin.username,
        fullName: req.admin.fullName,
        lastLoginAt: req.admin.lastLoginAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

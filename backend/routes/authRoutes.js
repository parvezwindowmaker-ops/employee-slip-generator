const express = require('express');
const router = express.Router();
const { Admin } = require('../models');
const requireAdmin = require('../middleware/requireAdmin');
const { createAdminToken } = require('../utils/token');
const { verifyPassword } = require('../utils/password');

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const admin = await Admin.unscoped().findOne({ where: { username } });

    if (!admin || !admin.isActive || !(await verifyPassword(password, admin.passwordHash))) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
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
    res.status(500).json({ error: error.message });
  }
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({
    admin: {
      id: req.admin.id,
      username: req.admin.username,
      fullName: req.admin.fullName,
      lastLoginAt: req.admin.lastLoginAt,
    },
  });
});

module.exports = router;

const { Admin } = require('../models');
const { verifyAdminToken } = require('../utils/token');

async function requireAdmin(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const payload = verifyAdminToken(token);

    if (!payload) {
      return res.status(401).json({ error: 'Admin login required' });
    }

    const admin = await Admin.findByPk(payload.sub);

    if (!admin || !admin.isActive) {
      return res.status(401).json({ error: 'Admin login required' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Admin login required' });
  }
}

module.exports = requireAdmin;

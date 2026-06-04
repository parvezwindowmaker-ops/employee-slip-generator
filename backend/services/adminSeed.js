const { Admin } = require('../models');

async function seedDefaultAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'Admin@123';
  const fullName = process.env.ADMIN_FULL_NAME || 'Administrator';

  const [admin, created] = await Admin.unscoped().findOrCreate({
    where: { username },
    defaults: {
      username,
      fullName,
      passwordHash: password,
      isActive: true,
    },
  });

  if (created) {
    console.log(`Default admin created. Username: ${admin.username}`);
  }
}

module.exports = seedDefaultAdmin;

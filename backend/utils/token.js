const crypto = require('crypto');

function getSecret() {
  return process.env.ADMIN_TOKEN_SECRET || 'change-this-admin-token-secret';
}

function base64Url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(data) {
  return crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
}

function createAdminToken(admin) {
  const payload = {
    sub: admin.id,
    username: admin.username,
    role: 'admin',
  };
  const encodedPayload = base64Url(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function verifyAdminToken(token) {
  const [encodedPayload, signature] = String(token || '').split('.');

  if (!encodedPayload || !signature || sign(encodedPayload) !== signature) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

  if (payload.role !== 'admin') {
    return null;
  }

  return payload;
}

module.exports = {
  createAdminToken,
  verifyAdminToken,
};

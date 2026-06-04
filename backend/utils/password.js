const crypto = require('crypto');

const ITERATIONS = 120000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');

    crypto.pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(`${salt}:${ITERATIONS}:${derivedKey.toString('hex')}`);
    });
  });
}

function verifyPassword(password, storedHash) {
  return new Promise((resolve, reject) => {
    const [salt, iterations, hash] = String(storedHash).split(':');

    if (!salt || !iterations || !hash) {
      resolve(false);
      return;
    }

    crypto.pbkdf2(password, salt, Number(iterations), KEY_LENGTH, DIGEST, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      const expected = Buffer.from(hash, 'hex');
      const actual = derivedKey;
      resolve(expected.length === actual.length && crypto.timingSafeEqual(expected, actual));
    });
  });
}

module.exports = {
  hashPassword,
  verifyPassword,
};

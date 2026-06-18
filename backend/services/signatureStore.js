const { Setting } = require('../models');

const SIGNATURE_KEY = 'authorizedSignature';

/**
 * Returns the stored authorized-signature image as a base64 data URL, or null
 * if none has been uploaded.
 */
async function getSignatureDataUrl() {
  const setting = await Setting.findOne({ where: { key: SIGNATURE_KEY } });
  return setting?.value || null;
}

/**
 * Stores (or replaces) the authorized-signature image. `dataUrl` is expected to
 * be a base64 data URL (e.g. "data:image/png;base64,....").
 */
async function setSignatureDataUrl(dataUrl) {
  const [setting] = await Setting.findOrCreate({
    where: { key: SIGNATURE_KEY },
    defaults: { value: dataUrl },
  });

  if (setting.value !== dataUrl) {
    await setting.update({ value: dataUrl });
  }

  return setting.value;
}

/**
 * Removes the stored signature, if any.
 */
async function clearSignature() {
  return Setting.destroy({ where: { key: SIGNATURE_KEY } });
}

module.exports = {
  SIGNATURE_KEY,
  getSignatureDataUrl,
  setSignatureDataUrl,
  clearSignature,
};

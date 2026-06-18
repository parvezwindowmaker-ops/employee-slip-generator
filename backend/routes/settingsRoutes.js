const express = require('express');
const multer = require('multer');
const requireAdmin = require('../middleware/requireAdmin');
const {
  getSignatureDataUrl,
  setSignatureDataUrl,
  clearSignature,
} = require('../services/signatureStore');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB is plenty for a signature image
  },
});

router.use(requireAdmin);

const ALLOWED_MIME = /^image\/(png|jpe?g)$/i;

// Return the currently stored authorized signature (or null)
router.get('/signature', async (req, res, next) => {
  try {
    const signature = await getSignatureDataUrl();
    res.json({ signature });
  } catch (error) {
    next(error);
  }
});

// Upload / replace the authorized signature
router.post('/signature', upload.single('signature'), async (req, res, next) => {
  try {
    if (!req.file) {
      const error = new Error('A signature image is required');
      error.status = 400;
      return next(error);
    }

    if (!ALLOWED_MIME.test(req.file.mimetype)) {
      const error = new Error('Only PNG or JPEG images are supported');
      error.status = 400;
      return next(error);
    }

    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const signature = await setSignatureDataUrl(dataUrl);

    res.status(201).json({ signature });
  } catch (error) {
    next(error);
  }
});

// Remove the stored signature
router.delete('/signature', async (req, res, next) => {
  try {
    await clearSignature();
    res.json({ signature: null });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const shareController = require('../controllers/shareController');

// Mobile view loaded upon scanning QR code
router.get('/:jobId', shareController.renderSharePage);

module.exports = router;

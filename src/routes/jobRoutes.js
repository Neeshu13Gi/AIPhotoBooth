const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const upload = require('../middlewares/upload');

// Step 3 -> 4: Upload photo + details and trigger AI video generation
router.post('/generate', upload.single('photo'), jobController.createJob);

// Step 4: Check generation progress & status
router.get('/status/:jobId', jobController.getJobStatus);

// Step 5: Get final video, photo, and QR code result
router.get('/result/:jobId', jobController.getJobResult);

// Direct download streaming for video or image
router.get('/download/:jobId/:type', jobController.downloadFile);

// List recent jobs (for booth history or admin dashboard)
router.get('/list', jobController.listJobs);

// Current provider configuration status
router.get('/provider-info', jobController.getProviderInfo);

module.exports = router;

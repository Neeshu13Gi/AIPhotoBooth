const express = require('express');
const router = express.Router();
const frameController = require('../controllers/frameController');
const upload = require('../middlewares/upload');

// Public route to list all active frames (Step 1)
router.get('/', frameController.getFrames);
router.get('/:frameId', frameController.getFrameById);

// Admin routes to upload custom frame overlays
router.post(
  '/',
  upload.fields([
    { name: 'frameOverlay', maxCount: 1 },
    { name: 'framePreview', maxCount: 1 },
  ]),
  frameController.createFrame
);

router.delete('/:frameId', frameController.deleteFrame);

module.exports = router;

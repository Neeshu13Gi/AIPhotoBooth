const Frame = require('../models/Frame');
const config = require('../config/env');
const path = require('path');

// The built-in role previews are deployed with the application.  MongoDB may
// still contain an old localhost URL from development, so never send that URL
// to a browser in production.
function getPublicFrameUrl(frameId, kind) {
  const suffix = kind === 'preview' ? '_preview.png' : '.png';
  return `/uploads/frames/${frameId}${suffix}`;
}

/**
 * Get all active frames (Step 1 of PhotoBooth Flow)
 */
exports.getFrames = async (req, res, next) => {
  try {
    const frames = await Frame.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
    const publicFrames = frames.map((frame) => {
      const item = typeof frame.toObject === 'function' ? frame.toObject() : { ...frame };
      if (String(item.frameId || '').startsWith('role-')) {
        item.previewUrl = getPublicFrameUrl(item.frameId, 'preview');
        item.overlayUrl = getPublicFrameUrl(item.frameId, 'overlay');
      }
      return item;
    });

    res.status(200).json({
      success: true,
      count: publicFrames.length,
      data: publicFrames,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single frame details
 */
exports.getFrameById = async (req, res, next) => {
  try {
    const frame = await Frame.findOne({ frameId: req.params.frameId });
    if (!frame) {
      return res.status(404).json({
        success: false,
        error: { message: `Frame with ID ${req.params.frameId} not found` },
      });
    }
    res.status(200).json({
      success: true,
      data: frame,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Create new decorative frame
 */
exports.createFrame = async (req, res, next) => {
  try {
    const { frameId, name, category, description, promptModifier, themeColor, aspectRatio, order } = req.body;

    if (!frameId || !name) {
      return res.status(400).json({
        success: false,
        error: { message: 'frameId and name are required' },
      });
    }

    const overlayFile = req.files?.frameOverlay?.[0];
    const previewFile = req.files?.framePreview?.[0];

    const overlayUrl = overlayFile
      ? `${config.appBaseUrl}/uploads/frames/${overlayFile.filename}`
      : req.body.overlayUrl;

    const previewUrl = previewFile
      ? `${config.appBaseUrl}/uploads/frames/${previewFile.filename}`
      : req.body.previewUrl || overlayUrl;

    if (!overlayUrl) {
      return res.status(400).json({
        success: false,
        error: { message: 'frameOverlay file or overlayUrl is required' },
      });
    }

    const newFrame = await Frame.create({
      frameId,
      name,
      category: category || 'General',
      description: description || '',
      previewUrl,
      overlayUrl,
      promptModifier: promptModifier || '',
      themeColor: themeColor || '#2563EB',
      aspectRatio: aspectRatio || '9:16',
      order: order ? parseInt(order, 10) : 0,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      data: newFrame,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Delete frame
 */
exports.deleteFrame = async (req, res, next) => {
  try {
    const frame = await Frame.findOneAndDelete({ frameId: req.params.frameId });
    if (!frame) {
      return res.status(404).json({
        success: false,
        error: { message: 'Frame not found' },
      });
    }
    res.status(200).json({
      success: true,
      message: 'Frame deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

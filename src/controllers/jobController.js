const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const GenerationJob = require('../models/GenerationJob');
const Frame = require('../models/Frame');
const QueueService = require('../services/queueService');
const VideoProviderFactory = require('../services/video');
const config = require('../config/env');

/**
 * Step 3 -> 4: Submit photo, user details, frame choice and initiate generation
 */
exports.createJob = async (req, res, next) => {
  try {
    const { fullName, email, phone, occasion, message, frameId } = req.body;

    if (!frameId) {
      return res.status(400).json({
        success: false,
        error: { message: 'frameId is required (Step 1 Selection)' },
      });
    }

    let inputImagePath = req.file?.path;
    let inputImageUrl = req.file
      ? `${config.appBaseUrl}/uploads/inputs/${req.file.filename}`
      : req.body.imageUrl;

    if (!inputImagePath && !inputImageUrl) {
      return res.status(400).json({
        success: false,
        error: { message: 'A photo must be captured or uploaded (Step 2)' },
      });
    }

    // Look up Frame
    const frame = await Frame.findOne({ frameId });
    const frameSnapshot = frame
      ? {
          name: frame.name,
          overlayUrl: frame.overlayUrl,
          previewUrl: frame.previewUrl,
          promptModifier: frame.promptModifier,
        }
      : null;

    const jobId = `job_${Date.now()}_${uuidv4().substring(0, 8)}`;

    // Create DB Document (user details can be provided now or updated later)
    const job = await GenerationJob.create({
      jobId,
      userDetails: {
        fullName: fullName || 'Kiosk Guest',
        email: email || '',
        phone: phone || '',
        occasion: occasion || '',
        message: message || '',
      },
      frameId,
      frameSnapshot,
      inputImageUrl,
      inputImagePath,
      status: 'queued',
      progress: 5,
      statusMessage: 'Job queued for processing...',
      provider: config.videoProvider,
      model: config.videoModel,
    });

    // Fire background execution (non-blocking - starts AI video generation immediately!)
    setImmediate(() => {
      QueueService.processJob(jobId).catch((err) => {
        console.error(`[JobController] Background job ${jobId} failed:`, err);
      });
    });

    res.status(202).json({
      success: true,
      message: 'Video generation started successfully',
      data: {
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        statusMessage: job.statusMessage,
        checkStatusUrl: `/api/jobs/status/${job.jobId}`,
        resultUrl: `/api/jobs/result/${job.jobId}`,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Step 3: Update user details on active background job
 */
exports.updateUserDetails = async (req, res, next) => {
  try {
    const { jobId, fullName, email, phone, occasion, message } = req.body;
    if (!jobId) {
      return res.status(400).json({ success: false, error: { message: 'jobId is required' } });
    }

    const job = await GenerationJob.findOne({ jobId });
    if (!job) {
      return res.status(404).json({ success: false, error: { message: 'Job not found' } });
    }

    job.userDetails = {
      fullName: fullName || job.userDetails?.fullName || 'Kiosk Guest',
      email: email || job.userDetails?.email || '',
      phone: phone || job.userDetails?.phone || '',
      occasion: occasion || job.userDetails?.occasion || '',
      message: message || job.userDetails?.message || '',
    };
    await job.save();

    res.status(200).json({
      success: true,
      message: 'User details updated successfully',
      data: { jobId: job.jobId, status: job.status, progress: job.progress },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Step 4: Poll generation status & progress
 */
exports.getJobStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await GenerationJob.findOne({ jobId }).select(
      'jobId status progress statusMessage error createdAt updatedAt'
    );

    if (!job) {
      return res.status(404).json({
        success: false,
        error: { message: `Job ${jobId} not found` },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        statusMessage: job.statusMessage,
        isCompleted: job.status === 'completed',
        isFailed: job.status === 'failed',
        error: job.error?.message || null,
        resultUrl: job.status === 'completed' ? `/api/jobs/result/${job.jobId}` : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Step 5: Get completed video, framed photo, and QR code
 */
exports.getJobResult = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await GenerationJob.findOne({ jobId });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: { message: `Job ${jobId} not found` },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        userDetails: job.userDetails,
        frame: job.frameSnapshot,
        inputImageUrl: job.inputImageUrl,
        rawVideoUrl: job.rawVideoUrl,
        framedVideoUrl: job.framedVideoUrl,
        framedImageUrl: job.framedImageUrl,
        qrCodeUrl: job.qrCodeUrl,
        shareUrl: job.shareUrl,
        providerUsed: job.provider,
        modelUsed: job.model,
        downloadVideoUrl: `/api/jobs/download/${job.jobId}/video`,
        downloadImageUrl: `/api/jobs/download/${job.jobId}/image`,
        createdAt: job.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Direct file download streaming
 */
exports.downloadFile = async (req, res, next) => {
  try {
    const { jobId, type } = req.params;
    const job = await GenerationJob.findOne({ jobId });

    if (!job) {
      return res.status(404).json({ success: false, error: { message: 'Job not found' } });
    }

    let filePath = null;
    let fileName = null;

    if (type === 'video') {
      filePath = job.framedVideoPath || (job.framedVideoUrl ? path.join(config.outputsDir, path.basename(job.framedVideoUrl)) : null);
      fileName = `FrameAI_${job.userDetails?.fullName ? job.userDetails.fullName.replace(/\s+/g, '_') : 'Memory'}.mp4`;
    } else if (type === 'image') {
      filePath = job.framedImagePath || (job.framedImageUrl ? path.join(config.outputsDir, path.basename(job.framedImageUrl)) : null);
      fileName = `FrameAI_${job.userDetails?.fullName ? job.userDetails.fullName.replace(/\s+/g, '_') : 'Memory'}.jpg`;
    } else {
      return res.status(400).json({ success: false, error: { message: 'Invalid download type (use video or image)' } });
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: { message: `File for download not found` } });
    }

    res.download(filePath, fileName);
  } catch (error) {
    next(error);
  }
};

/**
 * List all jobs (for booth dashboard / history)
 */
exports.listJobs = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const page = parseInt(req.query.page, 10) || 1;
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      GenerationJob.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      GenerationJob.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: jobs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Provider Info endpoint (checks currently loaded provider & config from .env)
 */
exports.getProviderInfo = async (req, res, next) => {
  try {
    const info = VideoProviderFactory.getActiveProviderInfo();
    res.status(200).json({
      success: true,
      data: info,
    });
  } catch (error) {
    next(error);
  }
};

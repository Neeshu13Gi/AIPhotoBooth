const GenerationJob = require('../models/GenerationJob');
const Frame = require('../models/Frame');
const AIPhotoBoothUser = require('../models/AIPhotoBoothUser');
const VideoProviderFactory = require('./video');
const FrameCompositor = require('./frameCompositor');
const QRService = require('./qrService');
const config = require('../config/env');
const path = require('path');
const fs = require('fs');

class QueueService {
  /**
   * Process a generation job asynchronously in the background.
   * @param {string} jobId
   */
  static async processJob(jobId) {
    const startTime = Date.now();
    console.log(`[QueueService] Starting background processing for job: ${jobId}`);

    const job = await GenerationJob.findOne({ jobId });
    if (!job) {
      console.error(`[QueueService] Job ${jobId} not found in database`);
      return;
    }

    try {
      // 1. Fetch frame data if not embedded
      let frameOverlayPath = null;
      const frame = await Frame.findOne({ frameId: job.frameId });
      if (frame) {
        // Derive local frame path
        const overlayFileName = path.basename(frame.overlayUrl);
        frameOverlayPath = path.join(config.framesDir, overlayFileName);
      }

      // 2. Generate QR Code
      const qrResult = await QRService.generateQRCode(jobId);
      job.qrCodeUrl = qrResult.qrCodeUrl;
      job.shareUrl = qrResult.shareUrl;

      // 3. Initiate Video Generation
      job.status = 'generating_video';
      job.progress = 10;
      job.statusMessage = 'Starting AI video generation engine...';
      await job.save();

      const provider = VideoProviderFactory.getProvider();
      job.provider = provider.name;
      job.model = config.videoModel;

      // Compose final prompt using frame modifier + occasion + user prompt
      const promptParts = [config.defaultMotionPrompt];
      if (job.frameSnapshot?.promptModifier) {
        promptParts.push(job.frameSnapshot.promptModifier);
      }
      if (job.userDetails?.occasion) {
        promptParts.push(`celebrating ${job.userDetails.occasion}`);
      }
      if (job.userDetails?.message) {
        promptParts.push(`theme: ${job.userDetails.message}`);
      }
      const finalPrompt = promptParts.join(', ');
      job.promptUsed = finalPrompt;
      await job.save();

      // Progress callback helper
      const onProgress = async (percent, message) => {
        try {
          await GenerationJob.updateOne(
            { jobId },
            {
              $set: {
                progress: percent,
                statusMessage: message,
              },
            }
          );
        } catch (e) {
          console.warn('[QueueService] Failed to update progress in db:', e.message);
        }
      };

      // Call AI Video Provider
      const videoResult = await provider.generateVideo({
        imageUrl: job.inputImageUrl,
        imagePath: job.inputImagePath,
        prompt: finalPrompt,
        model: config.videoModel,
        onProgress,
      });

      job.rawVideoUrl = videoResult.videoUrl;
      job.rawVideoPath = videoResult.videoPath;
      job.status = 'compositing_frame';
      job.progress = 85;
      job.statusMessage = 'Framing your video with selected theme...';
      await job.save();

      // 4. Overlay Decorative Frame on Video and Photo
      const [framedVideoRes, framedImageRes] = await Promise.all([
        FrameCompositor.compositeVideoWithFrame({
          videoPath: videoResult.videoPath,
          frameOverlayPath,
          onProgress,
        }),
        FrameCompositor.compositeImageWithFrame({
          imagePath: job.inputImagePath,
          frameOverlayPath,
        }),
      ]);

      job.framedVideoUrl = framedVideoRes.framedVideoUrl;
      job.framedVideoPath = framedVideoRes.framedVideoPath;
      job.framedImageUrl = framedImageRes.framedImageUrl;
      job.framedImagePath = framedImageRes.framedImagePath;

      // 5. Mark Completed
      const processingTimeMs = Date.now() - startTime;
      job.status = 'completed';
      job.progress = 100;
      job.statusMessage = 'Your Video is Ready! 🎉';
      job.metadata = {
        processingTimeMs,
        durationSeconds: config.videoDuration || 5,
        width: 720,
        height: 1280,
      };

      await job.save();
      console.log(`[QueueService] Job ${jobId} successfully completed in ${processingTimeMs}ms`);

      // 6. Record Guest Profile in AIPhotoBoothUsers Collection
      try {
        if (job.userDetails?.email) {
          await AIPhotoBoothUser.findOneAndUpdate(
            { email: job.userDetails.email.toLowerCase() },
            {
              $set: {
                fullName: job.userDetails.fullName,
                phone: job.userDetails.phone,
                occasion: job.userDetails.occasion || '',
                message: job.userDetails.message || '',
                lastActiveAt: new Date(),
              },
              $inc: { totalGenerations: 1 },
              $push: {
                jobs: {
                  jobId: job.jobId,
                  frameId: job.frameId,
                  framedVideoUrl: job.framedVideoUrl,
                  framedImageUrl: job.framedImageUrl,
                  qrCodeUrl: job.qrCodeUrl,
                  shareUrl: job.shareUrl,
                  createdAt: new Date(),
                },
              },
            },
            { upsert: true, new: true }
          );
          console.log(`[QueueService] Updated guest record in AIPhotoBoothUsers for ${job.userDetails.email}`);
        }
      } catch (userSaveErr) {
        console.warn('[QueueService] Failed to update AIPhotoBoothUser collection:', userSaveErr.message);
      }
    } catch (err) {
      console.error(`[QueueService] Error processing job ${jobId}:`, err);
      job.status = 'failed';
      job.statusMessage = 'Video generation failed. Please try again.';
      job.error = {
        message: err.message,
        details: err.stack,
        timestamp: new Date(),
      };
      await job.save();
    }
  }
}

module.exports = QueueService;

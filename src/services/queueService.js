const GenerationJob = require('../models/GenerationJob');
const Frame = require('../models/Frame');
const AIPhotoBoothUser = require('../models/AIPhotoBoothUser');
const VideoProviderFactory = require('./video');
const FrameCompositor = require('./frameCompositor');
const QRService = require('./qrService');
const config = require('../config/env');

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
      // 1. Generate QR Code
      const qrResult = await QRService.generateQRCode(jobId);
      job.qrCodeUrl = qrResult.qrCodeUrl;
      job.shareUrl = qrResult.shareUrl;

      // 2. Initiate Video Generation
      job.status = 'generating_video';
      job.progress = 10;
      job.statusMessage = 'Starting AI video generation engine...';
      await job.save();

      const provider = VideoProviderFactory.getProvider();
      job.provider = provider.name;
      job.model = config.videoModel;

      // The camera or uploaded image is always the identity reference. The
      // selected frame supplies the requested character, never a replacement face.
      const selectedCharacter = job.frameSnapshot?.name || 'professional character';
      const promptParts = [
        'Create a full-screen, vertical 9:16 realistic professional avatar video from the provided user photo.',
        `The user is the ${selectedCharacter}; use their exact recognizable face and identity as the only face in the video.`,
        'Transform their clothing, props, and environment for the selected role while preserving natural facial features, face shape, skin tone, and hairstyle.',
        'Use a medium portrait shot with natural studio-quality lighting, realistic proportions, and a clean cinematic background.',
        'The person looks into the camera and speaks naturally with subtle, believable lip movement, blinking, gentle facial expressions, and slight head movement.',
        'Do not use any other person, face swap template, collage, border, text, watermark, or decorative frame.',
      ];
      if (job.frameSnapshot?.promptModifier) {
        promptParts.push(`Character styling: ${job.frameSnapshot.promptModifier}.`);
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
      job.statusMessage = 'Preparing your full-screen avatar video...';
      await job.save();

      // The model output is the final full-screen avatar. Do not cover it
      // with the selected-card artwork; the card is only a role prompt.
      const [framedVideoRes, framedImageRes] = await Promise.all([
        FrameCompositor.compositeVideoWithFrame({
          videoPath: videoResult.videoPath,
          frameOverlayPath: null,
          onProgress,
        }),
        FrameCompositor.extractVideoPoster({ videoPath: videoResult.videoPath }),
      ]);

      job.framedVideoUrl = framedVideoRes.framedVideoUrl;
      job.framedVideoPath = framedVideoRes.framedVideoPath;
      job.framedImageUrl = framedImageRes.framedImageUrl;
      job.framedImagePath = framedImageRes.framedImagePath;

      // 3. Mark Completed
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

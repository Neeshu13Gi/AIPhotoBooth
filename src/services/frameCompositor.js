const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/env');

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

class FrameCompositor {
  /**
   * Overlays a decorative PNG frame on top of an MP4 video using FFmpeg.
   * @param {Object} params
   * @param {string} params.videoPath - Path to raw generated video
   * @param {string} params.frameOverlayPath - Path to transparent frame PNG
   * @param {Function} [params.onProgress] - Optional progress callback
   * @returns {Promise<{ framedVideoPath: string, framedVideoUrl: string }>}
   */
  static async compositeVideoWithFrame({ videoPath, frameOverlayPath, onProgress }) {
    console.log(`[FrameCompositor] Compositing video with frame overlay: ${frameOverlayPath}`);

    const outputFileName = `framed_video_${Date.now()}_${uuidv4().substring(0, 8)}.mp4`;
    const outputPath = path.join(config.outputsDir, outputFileName);

    if (!fs.existsSync(config.outputsDir)) {
      fs.mkdirSync(config.outputsDir, { recursive: true });
    }

    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found for compositing: ${videoPath}`);
    }

    // Target dimensions for 9:16 vertical photobooth format
    const targetWidth = 720;
    const targetHeight = 1280;

    await new Promise((resolve, reject) => {
      // If no frame overlay path or file missing, return raw video
      if (!frameOverlayPath || !fs.existsSync(frameOverlayPath)) {
        console.warn('[FrameCompositor] Frame overlay not found, copying raw video as output');
        fs.copyFileSync(videoPath, outputPath);
        return resolve();
      }

      ffmpeg()
        .input(videoPath)
        .input(frameOverlayPath)
        .complexFilter([
          // Scale raw video to fit 720x1280
          `[0:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight}[scaled_vid]`,
          // Scale frame overlay PNG to exact 720x1280
          `[1:v]scale=${targetWidth}:${targetHeight}[scaled_frame]`,
          // Overlay frame on top of video
          `[scaled_vid][scaled_frame]overlay=0:0:format=auto[outv]`
        ])
        .outputOptions([
          '-map [outv]',
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-preset medium',
          '-crf 20',
          '-movflags +faststart' // Web streaming optimization
        ])
        .output(outputPath)
        .on('progress', (prog) => {
          if (onProgress && prog.percent) {
            const calculatedProgress = Math.min(98, Math.floor(88 + (prog.percent * 0.1)));
            onProgress(calculatedProgress, 'Applying decorative photo frame to video...');
          }
        })
        .on('end', () => {
          console.log(`[FrameCompositor] Framed video created successfully at ${outputPath}`);
          resolve();
        })
        .on('error', (err) => {
          console.error('[FrameCompositor] Video compositing error:', err);
          // Graceful fallback: if overlay filter fails, copy original video
          try {
            fs.copyFileSync(videoPath, outputPath);
            resolve();
          } catch (e) {
            reject(err);
          }
        })
        .run();
    });

    return {
      framedVideoPath: outputPath,
      framedVideoUrl: `${config.appBaseUrl}/uploads/outputs/${outputFileName}`,
    };
  }

  /**
   * Blends user face photo into the chosen role swap template preview
   * @param {Object} params
   * @param {string} params.userImagePath - User photo path from camera or upload
   * @param {string} params.rolePreviewPath - Selected role template photo path
   * @returns {Promise<string>} Output face-swapped image path
   */
  static async createRoleSwappedImage({ userImagePath, rolePreviewPath }) {
    console.log(`[FrameCompositor] Blending user face from ${userImagePath} into role preview ${rolePreviewPath}...`);

    const outputFileName = `role_swap_${Date.now()}_${uuidv4().substring(0, 8)}.jpg`;
    const outputPath = path.join(config.outputsDir, outputFileName);

    if (!fs.existsSync(config.outputsDir)) {
      fs.mkdirSync(config.outputsDir, { recursive: true });
    }

    try {
      if (!rolePreviewPath || !fs.existsSync(rolePreviewPath)) {
        await sharp(userImagePath).resize(720, 1280, { fit: 'cover' }).jpeg({ quality: 90 }).toFile(outputPath);
        return outputPath;
      }

      // 1. Process base role background image (720x1280)
      const roleBase = await sharp(rolePreviewPath)
        .resize(720, 1280, { fit: 'cover' })
        .toBuffer();

      // 2. Crop & mask user face photo with smooth oval vignette
      const maskSvg = Buffer.from(
        `<svg width="340" height="420">
          <ellipse cx="170" cy="210" rx="155" ry="195" fill="#FFFFFF"/>
        </svg>`
      );

      const userFaceMasked = await sharp(userImagePath)
        .resize(340, 420, { fit: 'cover', position: 'attention' })
        .composite([{ input: maskSvg, blend: 'dest-in' }])
        .png()
        .toBuffer();

      // 3. Overlay user face onto the role template head position
      await sharp(roleBase)
        .composite([{ input: userFaceMasked, top: 120, left: 190 }])
        .jpeg({ quality: 95 })
        .toFile(outputPath);

      console.log(`[FrameCompositor] Role swapped image created at ${outputPath}`);
      return outputPath;
    } catch (err) {
      console.error('[FrameCompositor] Role swap blending fallback:', err);
      return userImagePath;
    }
  }

  /**
   * Overlays a decorative PNG frame on top of the original user photo using Sharp.
   * @param {Object} params
   * @param {string} params.imagePath - Path to user input photo
   * @param {string} params.frameOverlayPath - Path to transparent frame PNG
   * @returns {Promise<{ framedImagePath: string, framedImageUrl: string }>}
   */
  static async compositeImageWithFrame({ imagePath, frameOverlayPath }) {
    console.log(`[FrameCompositor] Compositing photo with frame overlay...`);

    const outputFileName = `framed_photo_${Date.now()}_${uuidv4().substring(0, 8)}.jpg`;
    const outputPath = path.join(config.outputsDir, outputFileName);

    if (!fs.existsSync(config.outputsDir)) {
      fs.mkdirSync(config.outputsDir, { recursive: true });
    }

    const targetWidth = 1080;
    const targetHeight = 1920;

    try {
      if (!frameOverlayPath || !fs.existsSync(frameOverlayPath)) {
        // Fallback resize user photo
        await sharp(imagePath)
          .resize(targetWidth, targetHeight, { fit: 'cover' })
          .jpeg({ quality: 90 })
          .toFile(outputPath);
      } else {
        // 1. Process base photo
        const resizedUserPhoto = await sharp(imagePath)
          .resize(targetWidth, targetHeight, { fit: 'cover', position: 'center' })
          .toBuffer();

        // 2. Resize frame overlay
        const resizedFrame = await sharp(frameOverlayPath)
          .resize(targetWidth, targetHeight, { fit: 'fill' })
          .png()
          .toBuffer();

        // 3. Composite frame on top of user photo
        await sharp(resizedUserPhoto)
          .composite([{ input: resizedFrame, top: 0, left: 0 }])
          .jpeg({ quality: 92 })
          .toFile(outputPath);
      }

      console.log(`[FrameCompositor] Framed photo created successfully at ${outputPath}`);
    } catch (err) {
      console.error('[FrameCompositor] Image compositing error:', err);
      // Fallback copy
      fs.copyFileSync(imagePath, outputPath);
    }

    return {
      framedImagePath: outputPath,
      framedImageUrl: `${config.appBaseUrl}/uploads/outputs/${outputFileName}`,
    };
  }

  /**
   * Extract a poster from the generated avatar video. This makes the image
   * download match the transformed role rather than returning the raw selfie.
   */
  static async extractVideoPoster({ videoPath }) {
    const outputFileName = `avatar_poster_${Date.now()}_${uuidv4().substring(0, 8)}.jpg`;
    const outputPath = path.join(config.outputsDir, outputFileName);
    fs.mkdirSync(config.outputsDir, { recursive: true });

    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(0.5)
        .frames(1)
        .outputOptions(['-q:v 2'])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    return {
      framedImagePath: outputPath,
      framedImageUrl: `${config.appBaseUrl}/uploads/outputs/${outputFileName}`,
    };
  }
}

module.exports = FrameCompositor;

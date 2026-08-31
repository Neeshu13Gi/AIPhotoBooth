const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const BaseVideoProvider = require('./baseProvider');
const { v4: uuidv4 } = require('uuid');

// Set ffmpeg binary path
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

class MockVideoProvider extends BaseVideoProvider {
  constructor(config) {
    super('mock', config);
  }

  validateConfig() {
    return { valid: true };
  }

  /**
   * Generates a realistic mock AI video by applying subtle cinematic zoom & pan (Ken Burns effect)
   * to the user's uploaded portrait using FFmpeg.
   */
  async generateVideo({ imagePath, prompt, onProgress }) {
    console.log(`[MockProvider] Generating video using mock engine for ${imagePath}...`);
    
    if (onProgress) onProgress(15, 'Analyzing facial features and framing...');
    await new Promise((r) => setTimeout(r, 600));

    if (onProgress) onProgress(35, 'Synthesizing AI portrait motion & lighting...');
    await new Promise((r) => setTimeout(r, 800));

    if (onProgress) onProgress(60, 'Rendering 60fps high-definition video frames...');

    const outputFileName = `mock_raw_${Date.now()}_${uuidv4().substring(0, 8)}.mp4`;
    const outputPath = path.join(this.config.outputsDir, outputFileName);

    // Ensure output directory exists
    if (!fs.existsSync(this.config.outputsDir)) {
      fs.mkdirSync(this.config.outputsDir, { recursive: true });
    }

    const duration = this.config.videoDuration || 5;

    await new Promise((resolve, reject) => {
      // Zoompan effect creates a dynamic video from the static photo
      // Target 720x1280 (9:16 portrait)
      const targetWidth = 720;
      const targetHeight = 1280;
      const totalFrames = duration * 25;

      ffmpeg(imagePath)
        .loop(duration)
        .outputOptions([
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-r 25',
          '-t ' + duration,
          `-vf scale=800:1422:force_original_aspect_ratio=increase,crop=800:1422,zoompan=z='min(zoom+0.0015,1.2)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${targetWidth}x${targetHeight}:fps=25`
        ])
        .output(outputPath)
        .on('progress', (progress) => {
          if (onProgress && progress.percent) {
            const calculatedProgress = Math.min(85, Math.floor(60 + (progress.percent * 0.25)));
            onProgress(calculatedProgress, 'Rendering video sequence...');
          }
        })
        .on('end', () => {
          console.log(`[MockProvider] Mock video created successfully at ${outputPath}`);
          if (onProgress) onProgress(90, 'Finalizing AI video...');
          resolve();
        })
        .on('error', (err) => {
          console.error('[MockProvider] FFmpeg error in mock generator:', err);
          // Fallback: simple copy loop without complex filter if filter fails
          this._fallbackSimpleVideo(imagePath, outputPath, duration)
            .then(resolve)
            .catch(reject);
        })
        .run();
    });

    const videoUrl = `${this.config.appBaseUrl}/uploads/outputs/${outputFileName}`;
    return {
      videoUrl,
      videoPath: outputPath,
      duration,
      provider: 'mock',
      model: 'mock-engine-v1',
    };
  }

  async _fallbackSimpleVideo(imagePath, outputPath, duration) {
    return new Promise((resolve, reject) => {
      ffmpeg(imagePath)
        .loop(duration)
        .size('720x1280')
        .outputOptions(['-c:v libx264', '-pix_fmt yuv420p', '-r 25', '-t ' + duration])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  }
}

module.exports = MockVideoProvider;

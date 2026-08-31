const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const BaseVideoProvider = require('./baseProvider');

class FalVideoProvider extends BaseVideoProvider {
  constructor(config) {
    super('fal', config);
    this.apiKey = config.falKey;
    this.defaultModel = config.videoModel || 'fal-ai/kling-video/v1.5/pro/image-to-video';
  }

  validateConfig() {
    if (!this.apiKey) {
      return {
        valid: false,
        error: 'FAL_KEY is missing in .env. Get your key from https://fal.ai/dashboard/keys',
      };
    }
    return { valid: true };
  }

  /**
   * Helper to convert a local file to base64 Data URI
   */
  _fileToDataUri(filePath) {
    const fileData = fs.readFileSync(filePath);
    const ext = path.extname(filePath).replace('.', '').toLowerCase();
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${fileData.toString('base64')}`;
  }

  /**
   * Generates video via Fal.ai queue API
   */
  async generateVideo({ imageUrl, imagePath, prompt, model, onProgress }) {
    const check = this.validateConfig();
    if (!check.valid) {
      throw new Error(check.error);
    }

    const selectedModel = model || this.defaultModel;
    console.log(`[FalProvider] Submitting job to model: ${selectedModel}`);

    // If no public URL is provided, convert local image to Data URI
    let imageInput = imageUrl;
    if (!imageInput || imageInput.startsWith('http://localhost') || imageInput.startsWith('http://127.0.0.1')) {
      if (imagePath && fs.existsSync(imagePath)) {
        imageInput = this._fileToDataUri(imagePath);
      }
    }

    if (onProgress) onProgress(15, `Submitting request to Fal.ai (${selectedModel})...`);

    // 1. Submit to Fal Queue
    const queueUrl = `https://queue.fal.run/${selectedModel}`;
    const submitPayload = {
      prompt: prompt || this.config.defaultMotionPrompt,
      image_url: imageInput,
      duration: `${this.config.videoDuration || 5}`,
      aspect_ratio: this.config.videoAspectRatio || '9:16',
    };

    const submitRes = await axios.post(queueUrl, submitPayload, {
      headers: {
        Authorization: `Key ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    const { request_id } = submitRes.data;
    if (!request_id && submitRes.data.video?.url) {
      // Synchronous return
      return this._downloadAndSaveVideo(submitRes.data.video.url, selectedModel);
    }

    if (!request_id) {
      throw new Error(`Fal.ai did not return a request_id: ${JSON.stringify(submitRes.data)}`);
    }

    console.log(`[FalProvider] Request queued with ID: ${request_id}. Polling status...`);

    // 2. Poll for completion
    const statusUrl = `https://queue.fal.run/${selectedModel}/requests/${request_id}/status`;
    const resultUrl = `https://queue.fal.run/${selectedModel}/requests/${request_id}`;

    let isCompleted = false;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes max
    let remoteVideoUrl = null;

    while (!isCompleted && attempts < maxAttempts) {
      attempts++;
      await new Promise((r) => setTimeout(r, 2000));

      const statusRes = await axios.get(statusUrl, {
        headers: { Authorization: `Key ${this.apiKey}` },
      });

      const { status, logs } = statusRes.data;
      console.log(`[FalProvider] Status (${attempts}/${maxAttempts}): ${status}`);

      if (status === 'IN_PROGRESS' || status === 'IN_QUEUE') {
        const percent = Math.min(85, 20 + Math.floor((attempts / maxAttempts) * 65));
        if (onProgress) onProgress(percent, `AI Video rendering in progress (${status})...`);
      } else if (status === 'COMPLETED') {
        isCompleted = true;
        if (onProgress) onProgress(90, 'Fetching generated video...');

        const resultRes = await axios.get(resultUrl, {
          headers: { Authorization: `Key ${this.apiKey}` },
        });

        remoteVideoUrl = resultRes.data.video?.url || resultRes.data.video_url || resultRes.data.output?.url;
        if (!remoteVideoUrl) {
          throw new Error(`No video URL in completed Fal.ai response: ${JSON.stringify(resultRes.data)}`);
        }
      } else if (status === 'FAILED') {
        throw new Error(`Fal.ai video generation failed: ${JSON.stringify(statusRes.data.error || statusRes.data)}`);
      }
    }

    if (!remoteVideoUrl) {
      throw new Error('Fal.ai generation timed out after 2 minutes');
    }

    return this._downloadAndSaveVideo(remoteVideoUrl, selectedModel);
  }

  async _downloadAndSaveVideo(remoteUrl, modelName) {
    const outputFileName = `fal_${Date.now()}_${uuidv4().substring(0, 8)}.mp4`;
    const outputPath = path.join(this.config.outputsDir, outputFileName);

    if (!fs.existsSync(this.config.outputsDir)) {
      fs.mkdirSync(this.config.outputsDir, { recursive: true });
    }

    console.log(`[FalProvider] Downloading video from ${remoteUrl} to ${outputPath}...`);
    const writer = fs.createWriteStream(outputPath);
    const response = await axios({
      url: remoteUrl,
      method: 'GET',
      responseType: 'stream',
    });

    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    return {
      videoUrl: `${this.config.appBaseUrl}/uploads/outputs/${outputFileName}`,
      videoPath: outputPath,
      remoteVideoUrl: remoteUrl,
      provider: 'fal',
      model: modelName,
      duration: this.config.videoDuration || 5,
    };
  }
}

module.exports = FalVideoProvider;

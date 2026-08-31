const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const BaseVideoProvider = require('./baseProvider');

class KlingVideoProvider extends BaseVideoProvider {
  constructor(config) {
    super('kling', config);
    this.accessKey = config.klingAccessKey;
    this.secretKey = config.klingSecretKey;
    this.defaultModel = config.videoModel || 'kling-v1-5';
  }

  validateConfig() {
    if (!this.accessKey && !this.config.falKey) {
      return {
        valid: false,
        error: 'KLING_ACCESS_KEY or FAL_KEY is required to use Kling AI. (Tip: You can use Kling via Fal.ai with VIDEO_PROVIDER=fal and VIDEO_MODEL=fal-ai/kling-video/v1.5/pro/image-to-video)',
      };
    }
    return { valid: true };
  }

  _fileToDataUri(filePath) {
    const fileData = fs.readFileSync(filePath);
    const ext = path.extname(filePath).replace('.', '').toLowerCase();
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${fileData.toString('base64')}`;
  }

  async generateVideo({ imageUrl, imagePath, prompt, model, onProgress }) {
    const check = this.validateConfig();
    if (!check.valid) {
      throw new Error(check.error);
    }

    // If direct Kling keys are provided:
    const selectedModel = model || this.defaultModel;
    console.log(`[KlingProvider] Initializing generation with model: ${selectedModel}`);

    let imageInput = imageUrl;
    if (!imageInput || imageInput.startsWith('http://localhost') || imageInput.startsWith('http://127.0.0.1')) {
      if (imagePath && fs.existsSync(imagePath)) {
        imageInput = this._fileToDataUri(imagePath);
      }
    }

    if (onProgress) onProgress(15, `Submitting task to Kling AI (${selectedModel})...`);

    // Standard Kling AI API endpoint
    const endpoint = 'https://api.klingai.com/v1/videos/image2video';
    const submitPayload = {
      model_name: selectedModel,
      image: imageInput,
      prompt: prompt || this.config.defaultMotionPrompt,
      duration: `${this.config.videoDuration || 5}`,
      aspect_ratio: this.config.videoAspectRatio || '9:16',
      mode: 'pro',
    };

    const res = await axios.post(endpoint, submitPayload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessKey}`,
      },
    });

    const taskId = res.data.data?.task_id || res.data.task_id;
    if (!taskId) {
      throw new Error(`Failed to obtain Kling task_id: ${JSON.stringify(res.data)}`);
    }

    let isCompleted = false;
    let attempts = 0;
    const maxAttempts = 120;
    let remoteVideoUrl = null;

    while (!isCompleted && attempts < maxAttempts) {
      attempts++;
      await new Promise((r) => setTimeout(r, 2500));

      const pollRes = await axios.get(`https://api.klingai.com/v1/videos/image2video/${taskId}`, {
        headers: {
          Authorization: `Bearer ${this.accessKey}`,
        },
      });

      const taskData = pollRes.data.data || pollRes.data;
      const status = taskData.task_status || taskData.status;

      console.log(`[KlingProvider] Task status (${attempts}/${maxAttempts}): ${status}`);

      if (status === 'processing' || status === 'submitted') {
        const percent = Math.min(85, 20 + Math.floor((attempts / maxAttempts) * 65));
        if (onProgress) onProgress(percent, `Kling AI rendering portrait motions (${status})...`);
      } else if (status === 'succeed' || status === 'completed') {
        isCompleted = true;
        if (onProgress) onProgress(90, 'Downloading generated Kling video...');
        remoteVideoUrl = taskData.task_result?.videos?.[0]?.url || taskData.video_url;
      } else if (status === 'failed') {
        throw new Error(`Kling AI generation failed: ${taskData.task_status_msg || 'Unknown error'}`);
      }
    }

    if (!remoteVideoUrl) {
      throw new Error('Kling generation timed out after 3 minutes');
    }

    return this._downloadAndSaveVideo(remoteVideoUrl, selectedModel);
  }

  async _downloadAndSaveVideo(remoteUrl, modelName) {
    const outputFileName = `kling_${Date.now()}_${uuidv4().substring(0, 8)}.mp4`;
    const outputPath = path.join(this.config.outputsDir, outputFileName);

    if (!fs.existsSync(this.config.outputsDir)) {
      fs.mkdirSync(this.config.outputsDir, { recursive: true });
    }

    console.log(`[KlingProvider] Downloading video from ${remoteUrl} to ${outputPath}...`);
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
      provider: 'kling',
      model: modelName,
      duration: this.config.videoDuration || 5,
    };
  }
}

module.exports = KlingVideoProvider;

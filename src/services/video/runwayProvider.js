const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const BaseVideoProvider = require('./baseProvider');

class RunwayVideoProvider extends BaseVideoProvider {
  constructor(config) {
    super('runway', config);
    this.apiSecret = config.runwayApiSecret;
    this.defaultModel = config.videoModel || 'gen3a_turbo';
  }

  validateConfig() {
    if (!this.apiSecret) {
      return {
        valid: false,
        error: 'RUNWAY_API_SECRET is missing in .env. Get your key from https://dev.runwayml.com',
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

    const selectedModel = model || this.defaultModel;
    console.log(`[RunwayProvider] Submitting to Runway Gen-3 with model: ${selectedModel}`);

    let imageInput = imageUrl;
    if (!imageInput || imageInput.startsWith('http://localhost') || imageInput.startsWith('http://127.0.0.1')) {
      if (imagePath && fs.existsSync(imagePath)) {
        imageInput = this._fileToDataUri(imagePath);
      }
    }

    if (onProgress) onProgress(15, `Initiating Runway Gen-3 task (${selectedModel})...`);

    const submitRes = await axios.post(
      'https://api.dev.runwayml.com/v1/image_to_video',
      {
        promptImage: imageInput,
        promptText: prompt || this.config.defaultMotionPrompt,
        model: selectedModel,
        duration: this.config.videoDuration || 5,
        ratio: this.config.videoAspectRatio === '9:16' ? '768:1280' : '1280:768',
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiSecret}`,
          'X-Runway-Version': '2024-09-13',
          'Content-Type': 'application/json',
        },
      }
    );

    const taskId = submitRes.data.id;
    console.log(`[RunwayProvider] Task created ID: ${taskId}. Polling status...`);

    let isCompleted = false;
    let attempts = 0;
    const maxAttempts = 120;
    let remoteVideoUrl = null;

    while (!isCompleted && attempts < maxAttempts) {
      attempts++;
      await new Promise((r) => setTimeout(r, 2500));

      const pollRes = await axios.get(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
        headers: {
          Authorization: `Bearer ${this.apiSecret}`,
          'X-Runway-Version': '2024-09-13',
        },
      });

      const task = pollRes.data;
      console.log(`[RunwayProvider] Status (${attempts}/${maxAttempts}): ${task.status}`);

      if (task.status === 'RUNNING' || task.status === 'PENDING') {
        const percent = Math.min(85, 20 + Math.floor((attempts / maxAttempts) * 65));
        if (onProgress) onProgress(percent, `Rendering Runway Gen-3 frames (${task.status})...`);
      } else if (task.status === 'SUCCEEDED') {
        isCompleted = true;
        if (onProgress) onProgress(90, 'Downloading Runway video...');
        remoteVideoUrl = Array.isArray(task.output) ? task.output[0] : task.output;
      } else if (task.status === 'FAILED' || task.status === 'CANCELLED') {
        throw new Error(`Runway task failed: ${task.failure || 'Unknown error'}`);
      }
    }

    if (!remoteVideoUrl) {
      throw new Error('Runway generation timed out after 3 minutes');
    }

    return this._downloadAndSaveVideo(remoteVideoUrl, selectedModel);
  }

  async _downloadAndSaveVideo(remoteUrl, modelName) {
    const outputFileName = `runway_${Date.now()}_${uuidv4().substring(0, 8)}.mp4`;
    const outputPath = path.join(this.config.outputsDir, outputFileName);

    if (!fs.existsSync(this.config.outputsDir)) {
      fs.mkdirSync(this.config.outputsDir, { recursive: true });
    }

    console.log(`[RunwayProvider] Downloading video from ${remoteUrl} to ${outputPath}...`);
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
      provider: 'runway',
      model: modelName,
      duration: this.config.videoDuration || 5,
    };
  }
}

module.exports = RunwayVideoProvider;

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const BaseVideoProvider = require('./baseProvider');

class LumaVideoProvider extends BaseVideoProvider {
  constructor(config) {
    super('luma', config);
    this.apiKey = config.lumaApiKey;
    this.defaultModel = config.videoModel || 'ray-2';
  }

  validateConfig() {
    if (!this.apiKey) {
      return {
        valid: false,
        error: 'LUMA_API_KEY is missing in .env. Get your key from https://lumalabs.ai/dream-machine/api/keys',
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
    console.log(`[LumaProvider] Requesting Luma Dream Machine with model: ${selectedModel}`);

    let imageInput = imageUrl;
    if (!imageInput || imageInput.startsWith('http://localhost') || imageInput.startsWith('http://127.0.0.1')) {
      if (imagePath && fs.existsSync(imagePath)) {
        imageInput = this._fileToDataUri(imagePath);
      }
    }

    if (onProgress) onProgress(15, `Submitting request to Luma Dream Machine (${selectedModel})...`);

    const submitRes = await axios.post(
      'https://api.lumalabs.ai/dream-machine/v1/generations/image-to-video',
      {
        prompt: prompt || this.config.defaultMotionPrompt,
        aspect_ratio: this.config.videoAspectRatio || '9:16',
        model: selectedModel,
        keyframes: {
          frame0: {
            type: 'image',
            url: imageInput,
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const generationId = submitRes.data.id;
    console.log(`[LumaProvider] Generation created ID: ${generationId}. Polling...`);

    let isCompleted = false;
    let attempts = 0;
    const maxAttempts = 120;
    let remoteVideoUrl = null;

    while (!isCompleted && attempts < maxAttempts) {
      attempts++;
      await new Promise((r) => setTimeout(r, 2500));

      const pollRes = await axios.get(`https://api.lumalabs.ai/dream-machine/v1/generations/${generationId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      const genData = pollRes.data;
      console.log(`[LumaProvider] Status (${attempts}/${maxAttempts}): ${genData.state}`);

      if (genData.state === 'dreaming' || genData.state === 'queued') {
        const percent = Math.min(85, 20 + Math.floor((attempts / maxAttempts) * 65));
        if (onProgress) onProgress(percent, `Luma Dream Machine generating video (${genData.state})...`);
      } else if (genData.state === 'completed') {
        isCompleted = true;
        if (onProgress) onProgress(90, 'Downloading Luma video...');
        remoteVideoUrl = genData.assets?.video;
      } else if (genData.state === 'failed') {
        throw new Error(`Luma generation failed: ${genData.failure_reason || 'Unknown error'}`);
      }
    }

    if (!remoteVideoUrl) {
      throw new Error('Luma generation timed out after 3 minutes');
    }

    return this._downloadAndSaveVideo(remoteVideoUrl, selectedModel);
  }

  async _downloadAndSaveVideo(remoteUrl, modelName) {
    const outputFileName = `luma_${Date.now()}_${uuidv4().substring(0, 8)}.mp4`;
    const outputPath = path.join(this.config.outputsDir, outputFileName);

    if (!fs.existsSync(this.config.outputsDir)) {
      fs.mkdirSync(this.config.outputsDir, { recursive: true });
    }

    console.log(`[LumaProvider] Downloading video from ${remoteUrl} to ${outputPath}...`);
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
      provider: 'luma',
      model: modelName,
      duration: this.config.videoDuration || 5,
    };
  }
}

module.exports = LumaVideoProvider;

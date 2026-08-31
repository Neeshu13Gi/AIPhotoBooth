const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const BaseVideoProvider = require('./baseProvider');

class ReplicateVideoProvider extends BaseVideoProvider {
  constructor(config) {
    super('replicate', config);
    this.apiToken = config.replicateApiToken;
    this.defaultModel = config.videoModel || 'kwaivgi/kling-v1.6-standard';
  }

  validateConfig() {
    if (!this.apiToken) {
      return {
        valid: false,
        error: 'REPLICATE_API_TOKEN is missing in .env. Get your key from https://replicate.com/account/api-tokens',
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
    console.log(`[ReplicateProvider] Initiating prediction with model: ${selectedModel}`);

    let imageInput = imageUrl;
    if (!imageInput || imageInput.startsWith('http://localhost') || imageInput.startsWith('http://127.0.0.1')) {
      if (imagePath && fs.existsSync(imagePath)) {
        imageInput = this._fileToDataUri(imagePath);
      }
    }

    if (onProgress) onProgress(15, `Submitting job to Replicate (${selectedModel})...`);

    // Model URL or standard endpoint
    let url = 'https://api.replicate.com/v1/predictions';
    let payload = {};

    if (selectedModel.includes('/')) {
      // Model format: "owner/model-name" or "owner/model-name:version"
      if (selectedModel.includes(':')) {
        const [modelName, version] = selectedModel.split(':');
        payload = {
          version: version,
          input: {
            input_image: imageInput,
            image: imageInput,
            prompt: prompt || this.config.defaultMotionPrompt,
            duration: this.config.videoDuration || 5,
          },
        };
      } else {
        url = `https://api.replicate.com/v1/models/${selectedModel}/predictions`;
        payload = {
          input: {
            input_image: imageInput,
            image: imageInput,
            prompt: prompt || this.config.defaultMotionPrompt,
            duration: this.config.videoDuration || 5,
          },
        };
      }
    }

    const startRes = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        Prefer: 'wait=false',
      },
    });

    const prediction = startRes.data;
    const predictionId = prediction.id;
    console.log(`[ReplicateProvider] Prediction created ID: ${predictionId}. Polling...`);

    let isCompleted = false;
    let attempts = 0;
    const maxAttempts = 120;
    let remoteVideoUrl = null;

    while (!isCompleted && attempts < maxAttempts) {
      attempts++;
      await new Promise((r) => setTimeout(r, 2000));

      const pollRes = await axios.get(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
      });

      const data = pollRes.data;
      console.log(`[ReplicateProvider] Status (${attempts}/${maxAttempts}): ${data.status}`);

      if (data.status === 'starting' || data.status === 'processing') {
        const percent = Math.min(85, 20 + Math.floor((attempts / maxAttempts) * 65));
        if (onProgress) onProgress(percent, `Processing AI video frames (${data.status})...`);
      } else if (data.status === 'succeeded') {
        isCompleted = true;
        if (onProgress) onProgress(90, 'Downloading generated video...');
        
        // Output can be a string URL or array of URLs
        if (Array.isArray(data.output) && data.output.length > 0) {
          remoteVideoUrl = data.output[0];
        } else if (typeof data.output === 'string') {
          remoteVideoUrl = data.output;
        } else if (data.output?.video_url) {
          remoteVideoUrl = data.output.video_url;
        }
      } else if (data.status === 'failed' || data.status === 'canceled') {
        throw new Error(`Replicate prediction failed: ${data.error || 'Unknown error'}`);
      }
    }

    if (!remoteVideoUrl) {
      throw new Error('Replicate video generation timed out after 2 minutes');
    }

    return this._downloadAndSaveVideo(remoteVideoUrl, selectedModel);
  }

  async _downloadAndSaveVideo(remoteUrl, modelName) {
    const outputFileName = `replicate_${Date.now()}_${uuidv4().substring(0, 8)}.mp4`;
    const outputPath = path.join(this.config.outputsDir, outputFileName);

    if (!fs.existsSync(this.config.outputsDir)) {
      fs.mkdirSync(this.config.outputsDir, { recursive: true });
    }

    console.log(`[ReplicateProvider] Downloading video from ${remoteUrl} to ${outputPath}...`);
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
      provider: 'replicate',
      model: modelName,
      duration: this.config.videoDuration || 5,
    };
  }
}

module.exports = ReplicateVideoProvider;

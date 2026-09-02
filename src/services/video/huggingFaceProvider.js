const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { InferenceClient } = require('@huggingface/inference');
const BaseVideoProvider = require('./baseProvider');

// Node's built-in fetch is blocked in some Windows kiosk environments while
// Axios follows the local proxy/network configuration correctly. The Hugging
// Face SDK accepts a fetch-compatible transport, so keep its model routing but
// send every request through Axios.
async function axiosFetch(url, init = {}) {
  const headers = Object.fromEntries(new Headers(init.headers || {}).entries());
  let data = init.body;
  if (data instanceof Blob) data = Buffer.from(await data.arrayBuffer());
  const response = await axios({
    url: typeof url === 'string' ? url : url.toString(),
    method: init.method || 'GET',
    headers,
    data,
    responseType: 'arraybuffer',
    validateStatus: () => true,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  return new Response(response.data, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

class HuggingFaceVideoProvider extends BaseVideoProvider {
  constructor(config) {
    super('huggingface', config);
    this.apiKey = config.hfToken;
    this.defaultModel = config.videoModel || 'Wan-AI/Wan2.2-I2V-A14B';
  }

  validateConfig() {
    if (!this.apiKey) {
      return {
        valid: false,
        error: 'HF_TOKEN is missing in .env. Create a Hugging Face token with Inference Providers permission.',
      };
    }
    return { valid: true };
  }

  async generateVideo({ imagePath, prompt, model, onProgress }) {
    const check = this.validateConfig();
    if (!check.valid) throw new Error(check.error);
    if (!imagePath || !fs.existsSync(imagePath)) {
      throw new Error('The captured or uploaded reference photo is unavailable. Please upload it again.');
    }

    const selectedModel = model || this.defaultModel;
    const imageBuffer = fs.readFileSync(imagePath);
    const mimeType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
    const sourceImage = new Blob([imageBuffer], { type: mimeType });
    const client = new InferenceClient(this.apiKey);

    if (onProgress) onProgress(15, 'Submitting your reference photo to Wan 2.2...');

    // Hugging Face routes the official WAN 2.2 I2V model to an available
    // inference provider. The HF token remains on this server.
    const videoBlob = await client.imageToVideo({
      provider: 'auto',
      model: selectedModel,
      inputs: sourceImage,
      parameters: {
        prompt: prompt || this.config.defaultMotionPrompt,
        num_frames: Math.min(161, Math.max(17, ((this.config.videoDuration || 5) * 16) + 1)),
        num_inference_steps: 30,
        guidance_scale: 4,
        target_size: { width: 720, height: 1280 },
      },
    }, { fetch: axiosFetch });

    if (onProgress) onProgress(90, 'Saving your Wan 2.2 video...');
    const outputFileName = `hf_wan_${Date.now()}_${uuidv4().substring(0, 8)}.mp4`;
    const outputPath = path.join(this.config.outputsDir, outputFileName);
    fs.mkdirSync(this.config.outputsDir, { recursive: true });
    fs.writeFileSync(outputPath, Buffer.from(await videoBlob.arrayBuffer()));

    return {
      videoUrl: `${this.config.appBaseUrl}/uploads/outputs/${outputFileName}`,
      videoPath: outputPath,
      provider: this.name,
      model: selectedModel,
      duration: this.config.videoDuration || 5,
    };
  }
}

module.exports = HuggingFaceVideoProvider;

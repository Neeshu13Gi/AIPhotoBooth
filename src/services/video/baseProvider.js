/**
 * Abstract Base Class for Video Generation Providers
 * All providers (Fal, Replicate, Runway, Kling, Luma, Mock) implement this interface.
 */
class BaseVideoProvider {
  constructor(name, config) {
    this.name = name;
    this.config = config;
  }

  /**
   * Generate video from image + prompt
   * @param {Object} params
   * @param {string} params.imageUrl - Public URL or data URI of input image
   * @param {string} params.imagePath - Local file path of input image
   * @param {string} params.prompt - Motion and styling prompt
   * @param {string} [params.model] - Specific model override (defaults to config.videoModel)
   * @param {Function} [params.onProgress] - Optional progress callback (percent 0-100, message)
   * @returns {Promise<{ videoUrl: string, videoBuffer?: Buffer, duration?: number }>}
   */
  async generateVideo(params) {
    throw new Error(`generateVideo() not implemented in ${this.name} provider`);
  }

  /**
   * Validate if provider is properly configured (e.g. API keys present)
   * @returns {{ valid: boolean, error?: string }}
   */
  validateConfig() {
    return { valid: true };
  }
}

module.exports = BaseVideoProvider;

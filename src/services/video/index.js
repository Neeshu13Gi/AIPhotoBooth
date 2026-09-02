const config = require('../../config/env');
const MockVideoProvider = require('./mockProvider');
const FalVideoProvider = require('./falProvider');
const ReplicateVideoProvider = require('./replicateProvider');
const RunwayVideoProvider = require('./runwayProvider');
const KlingVideoProvider = require('./klingProvider');
const LumaVideoProvider = require('./lumaProvider');
const HuggingFaceVideoProvider = require('./huggingFaceProvider');

class VideoProviderFactory {
  static getProvider(customProviderName = null) {
    const providerName = (customProviderName || config.videoProvider || 'mock').toLowerCase().trim();

    switch (providerName) {
      case 'fal':
        return new FalVideoProvider(config);
      case 'huggingface':
      case 'hf':
        return new HuggingFaceVideoProvider(config);
      case 'replicate':
        return new ReplicateVideoProvider(config);
      case 'runway':
        return new RunwayVideoProvider(config);
      case 'kling':
        return new KlingVideoProvider(config);
      case 'luma':
        return new LumaVideoProvider(config);
      case 'mock':
      default:
        return new MockVideoProvider(config);
    }
  }

  static getActiveProviderInfo() {
    const provider = this.getProvider();
    const validation = provider.validateConfig();
    return {
      providerName: provider.name,
      configuredModel: config.videoModel,
      isValid: validation.valid,
      validationError: validation.error || null,
      supportedProviders: ['mock', 'huggingface', 'fal', 'replicate', 'runway', 'kling', 'luma'],
    };
  }
}

module.exports = VideoProviderFactory;

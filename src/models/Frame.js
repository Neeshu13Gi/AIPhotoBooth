const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const config = require('../config/env');

const frameSchema = new mongoose.Schema(
  {
    frameId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: 'General',
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    previewUrl: {
      type: String,
      required: true,
    },
    overlayUrl: {
      type: String,
      required: true,
    },
    promptModifier: {
      type: String,
      default: '',
    },
    themeColor: {
      type: String,
      default: '#2563EB',
    },
    aspectRatio: {
      type: String,
      default: '9:16',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const MongooseFrameModel = mongoose.model('Frame', frameSchema);

// In-Memory / File Fallback Store (Used when MongoDB is offline during initial local dev)
const memoryStore = new Map();

function loadFallbackFrames() {
  const seedPath = path.join(config.uploadDir, 'frames_seed.json');
  if (fs.existsSync(seedPath) && memoryStore.size === 0) {
    try {
      const data = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      data.forEach((f) => memoryStore.set(f.frameId, { ...f, createdAt: new Date(), updatedAt: new Date() }));
    } catch (e) {}
  }
}

class FrameModelProxy {
  static isMongoConnected() {
    return mongoose.connection.readyState === 1;
  }

  static find(filter = {}) {
    if (this.isMongoConnected()) {
      return MongooseFrameModel.find(filter);
    }
    loadFallbackFrames();
    let results = Array.from(memoryStore.values());
    if (filter.isActive !== undefined) {
      results = results.filter((f) => f.isActive === filter.isActive);
    }
    results.sort((a, b) => (a.order || 0) - (b.order || 0));

    return {
      sort: () => Promise.resolve(results),
      then: (resolve, reject) => Promise.resolve(results).then(resolve, reject),
      catch: (reject) => Promise.resolve(results).catch(reject),
    };
  }

  static async findOne(filter = {}) {
    if (this.isMongoConnected()) {
      return MongooseFrameModel.findOne(filter);
    }
    loadFallbackFrames();
    if (filter.frameId) {
      return memoryStore.get(filter.frameId) || null;
    }
    return Array.from(memoryStore.values())[0] || null;
  }

  static async findOneAndUpdate(filter, update, options = {}) {
    if (this.isMongoConnected()) {
      return MongooseFrameModel.findOneAndUpdate(filter, update, options);
    }
    loadFallbackFrames();
    const frameId = filter.frameId;
    const docData = update.$set || update;
    const existing = memoryStore.get(frameId) || {};
    const updated = { ...existing, ...docData, frameId, updatedAt: new Date() };
    if (!existing.createdAt) updated.createdAt = new Date();
    memoryStore.set(frameId, updated);
    return updated;
  }

  static async create(doc) {
    if (this.isMongoConnected()) {
      return MongooseFrameModel.create(doc);
    }
    loadFallbackFrames();
    const item = { ...doc, createdAt: new Date(), updatedAt: new Date() };
    memoryStore.set(doc.frameId, item);
    return item;
  }

  static async findOneAndDelete(filter) {
    if (this.isMongoConnected()) {
      return MongooseFrameModel.findOneAndDelete(filter);
    }
    loadFallbackFrames();
    const frameId = filter.frameId;
    const item = memoryStore.get(frameId);
    if (item) {
      memoryStore.delete(frameId);
      return item;
    }
    return null;
  }
}

module.exports = FrameModelProxy;

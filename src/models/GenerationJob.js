const mongoose = require('mongoose');

const generationJobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userDetails: {
      fullName: {
        type: String,
        required: true,
        trim: true,
      },
      email: {
        type: String,
        // A generation starts as soon as the user captures or uploads a
        // photo. Email is collected on the following details screen.
        required: false,
        default: '',
        trim: true,
        lowercase: true,
      },
      phone: {
        type: String,
        // See email above: this is intentionally completed later.
        required: false,
        default: '',
        trim: true,
      },
      occasion: {
        type: String,
        default: '',
        trim: true,
      },
      message: {
        type: String,
        default: '',
        trim: true,
      },
    },
    frameId: {
      type: String,
      required: true,
      ref: 'Frame',
    },
    frameSnapshot: {
      name: String,
      overlayUrl: String,
      previewUrl: String,
      promptModifier: String,
    },
    inputImageUrl: {
      type: String,
      required: true,
    },
    inputImagePath: {
      type: String,
    },
    rawVideoUrl: {
      type: String,
      default: '',
    },
    rawVideoPath: {
      type: String,
      default: '',
    },
    framedVideoUrl: {
      type: String,
      default: '',
    },
    framedVideoPath: {
      type: String,
      default: '',
    },
    framedImageUrl: {
      type: String,
      default: '',
    },
    framedImagePath: {
      type: String,
      default: '',
    },
    qrCodeUrl: {
      type: String,
      default: '',
    },
    shareUrl: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['queued', 'generating_video', 'compositing_frame', 'completed', 'failed'],
      default: 'queued',
      index: true,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    statusMessage: {
      type: String,
      default: 'Job queued...',
    },
    provider: {
      type: String,
      required: true,
    },
    model: {
      type: String,
      required: true,
    },
    promptUsed: {
      type: String,
      default: '',
    },
    error: {
      message: String,
      details: mongoose.Schema.Types.Mixed,
      timestamp: Date,
    },
    metadata: {
      durationSeconds: Number,
      width: Number,
      height: Number,
      fileSizeBytes: Number,
      processingTimeMs: Number,
    },
  },
  {
    timestamps: true,
  }
);

const MongooseJobModel = mongoose.model('GenerationJob', generationJobSchema);

// In-Memory Fallback Map
const jobMemoryStore = new Map();

class JobInstance {
  constructor(data) {
    Object.assign(this, data);
  }

  async save() {
    this.updatedAt = new Date();
    jobMemoryStore.set(this.jobId, { ...this });
    return this;
  }
}

class GenerationJobProxy {
  static isMongoConnected() {
    return mongoose.connection.readyState === 1;
  }

  static async create(doc) {
    if (this.isMongoConnected()) {
      return MongooseJobModel.create(doc);
    }
    const item = new JobInstance({
      ...doc,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    jobMemoryStore.set(doc.jobId, item);
    return item;
  }

  static findOne(filter = {}) {
    if (this.isMongoConnected()) {
      return MongooseJobModel.findOne(filter);
    }
    const execute = () => {
      if (filter.jobId) {
        const data = jobMemoryStore.get(filter.jobId);
        return data ? new JobInstance(data) : null;
      }
      return null;
    };

    const res = execute();
    // Return thenable object with .select chain
    return {
      select: () => Promise.resolve(res),
      then: (resolve, reject) => Promise.resolve(res).then(resolve, reject),
      catch: (reject) => Promise.resolve(res).catch(reject),
    };
  }

  static async updateOne(filter, update) {
    if (this.isMongoConnected()) {
      return MongooseJobModel.updateOne(filter, update);
    }
    if (filter.jobId && jobMemoryStore.has(filter.jobId)) {
      const current = jobMemoryStore.get(filter.jobId);
      const changes = update.$set || update;
      const updated = { ...current, ...changes, updatedAt: new Date() };
      jobMemoryStore.set(filter.jobId, updated);
      return { acknowledged: true, modifiedCount: 1 };
    }
    return { acknowledged: true, modifiedCount: 0 };
  }

  static find(filter = {}) {
    if (this.isMongoConnected()) {
      return MongooseJobModel.find(filter);
    }
    const list = Array.from(jobMemoryStore.values()).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    return {
      sort: () => ({
        skip: (s) => ({
          limit: (l) => list.slice(s, s + l),
        }),
      }),
    };
  }

  static async countDocuments() {
    if (this.isMongoConnected()) {
      return MongooseJobModel.countDocuments();
    }
    return jobMemoryStore.size;
  }
}

module.exports = GenerationJobProxy;

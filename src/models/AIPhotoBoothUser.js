const mongoose = require('mongoose');

const aiPhotoBoothUserSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
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
    totalGenerations: {
      type: Number,
      default: 1,
    },
    jobs: [
      {
        jobId: String,
        frameId: String,
        framedVideoUrl: String,
        framedImageUrl: String,
        qrCodeUrl: String,
        shareUrl: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'AIPhotoBoothUsers',
  }
);

const MongooseUserModel = mongoose.model('AIPhotoBoothUser', aiPhotoBoothUserSchema);

// In-Memory fallback store
const userMemoryStore = new Map();

class UserProxy {
  static isMongoConnected() {
    return mongoose.connection.readyState === 1;
  }

  static async findOne(filter = {}) {
    if (this.isMongoConnected()) {
      return MongooseUserModel.findOne(filter);
    }
    if (filter.email) {
      return userMemoryStore.get(filter.email.toLowerCase()) || null;
    }
    if (filter.phone) {
      return Array.from(userMemoryStore.values()).find((u) => u.phone === filter.phone) || null;
    }
    return null;
  }

  static async findOneAndUpdate(filter, update, options = {}) {
    if (this.isMongoConnected()) {
      return MongooseUserModel.findOneAndUpdate(filter, update, options);
    }
    const emailKey = filter.email ? filter.email.toLowerCase() : null;
    const existing = (emailKey ? userMemoryStore.get(emailKey) : null) || {};
    const changes = update.$set || update;
    const updated = {
      ...existing,
      ...changes,
      updatedAt: new Date(),
      createdAt: existing.createdAt || new Date(),
    };
    if (update.$inc?.totalGenerations) {
      updated.totalGenerations = (existing.totalGenerations || 0) + update.$inc.totalGenerations;
    }
    if (update.$push?.jobs) {
      updated.jobs = [...(existing.jobs || []), update.$push.jobs];
    }
    if (emailKey) userMemoryStore.set(emailKey, updated);
    return updated;
  }

  static async find(filter = {}) {
    if (this.isMongoConnected()) {
      return MongooseUserModel.find(filter);
    }
    const users = Array.from(userMemoryStore.values()).sort(
      (a, b) => new Date(b.lastActiveAt) - new Date(a.lastActiveAt)
    );
    return {
      sort: () => Promise.resolve(users),
      then: (res, rej) => Promise.resolve(users).then(res, rej),
    };
  }
}

module.exports = UserProxy;

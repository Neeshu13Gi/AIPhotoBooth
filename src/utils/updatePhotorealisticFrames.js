const mongoose = require('mongoose');
const Frame = require('../models/Frame');
const config = require('../config/env');
const connectDB = require('../config/database');

const roles = [
  { frameId: 'role-engineer-male', name: 'Engineer', category: 'Men', promptModifier: 'portrait of a male engineer in blue shirt with glasses in modern office', order: 1 },
  { frameId: 'role-doctor-male', name: 'Doctor', category: 'Men', promptModifier: 'portrait of a male doctor in white coat with stethoscope in clinic', order: 2 },
  { frameId: 'role-professor-male', name: 'Professor', category: 'Men', promptModifier: 'portrait of a male university professor with notebook in library', order: 3 },
  { frameId: 'role-business-male', name: 'Business Professional', category: 'Men', promptModifier: 'portrait of a male corporate executive in black suit and tie', order: 4 },
  { frameId: 'role-engineer-female', name: 'Engineer', category: 'Women', promptModifier: 'portrait of a female engineer in blue shirt with glasses in office', order: 5 },
  { frameId: 'role-doctor-female', name: 'Doctor', category: 'Women', promptModifier: 'portrait of a female doctor in white lab coat with stethoscope in clinic', order: 6 },
  { frameId: 'role-professor-female', name: 'Professor', category: 'Women', promptModifier: 'portrait of a female university professor with journal in library', order: 7 },
  { frameId: 'role-business-female', name: 'Business Professional', category: 'Women', promptModifier: 'portrait of a female corporate executive in dark blazer', order: 8 }
];

async function updateDb() {
  await connectDB();
  const keepIds = roles.map(r => r.frameId);
  await Frame.deleteMany({ frameId: { $nin: keepIds } });
  console.log('✓ Removed all cartoon & old sprite frames from DB!');

  for (const r of roles) {
    const previewUrl = `${config.appBaseUrl}/uploads/frames/${r.frameId}_preview.png`;
    const overlayUrl = `${config.appBaseUrl}/uploads/frames/${r.frameId}.png`;

    await Frame.findOneAndUpdate(
      { frameId: r.frameId },
      {
        $set: {
          frameId: r.frameId,
          name: r.name,
          category: r.category,
          description: 'Photorealistic AI Role Swap',
          previewUrl,
          overlayUrl,
          promptModifier: r.promptModifier,
          themeColor: '#2563EB',
          aspectRatio: '9:16',
          order: r.order,
          isActive: true
        }
      },
      { upsert: true, new: true }
    );
    console.log('✓ Seeded photorealistic role:', r.name, '(', r.category, ')');
  }

  console.log('🎉 DB updated successfully with ONLY 8 photorealistic role swap frames!');
  await mongoose.connection.close();
}

updateDb();

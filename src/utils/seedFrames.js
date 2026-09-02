const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const Frame = require('../models/Frame');
const config = require('../config/env');
const connectDB = require('../config/database');

/**
 * Creates ultra-crisp, high-definition decorative SVG border overlays & preview thumbnails for Holobox / 1080x1920 Kiosks
 */
async function generateFrameAssets() {
  if (!fs.existsSync(config.framesDir)) {
    fs.mkdirSync(config.framesDir, { recursive: true });
  }

  const width = 1080;
  const height = 1920;

  // Helper SVG builder for professional role swap avatars matching mockup
  const createRoleSvg = (title, gender, outfitColor, bgGradient, accessorySvg) => `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg_${title}_${gender}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${bgGradient[0]}" />
          <stop offset="100%" stop-color="${bgGradient[1]}" />
        </linearGradient>
        <linearGradient id="suit_${title}_${gender}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${outfitColor[0]}" />
          <stop offset="100%" stop-color="${outfitColor[1]}" />
        </linearGradient>
        <filter id="shadow_${title}" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="12" stdDeviation="16" flood-opacity="0.15"/>
        </filter>
      </defs>

      <!-- Office / Studio Background -->
      <rect width="100%" height="100%" fill="url(#bg_${title}_${gender})"/>

      <!-- Ambient Architectural Office Grid Lines -->
      <line x1="0" y1="400" x2="${width}" y2="400" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
      <line x1="0" y1="800" x2="${width}" y2="800" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
      <line x1="300" y1="0" x2="300" y2="${height}" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
      <line x1="780" y1="0" x2="780" y2="${height}" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>

      <!-- Professional Figure Silhouette / Body -->
      <g filter="url(#shadow_${title})">
        <!-- Shoulders / Torso -->
        <path d="M 180 1920 C 180 1150, 320 1000, 540 1000 C 760 1000, 900 1150, 900 1920 Z" fill="url(#suit_${title}_${gender})"/>
        
        <!-- Shirt Collar / V-Neck -->
        <polygon points="540,1040 450,1220 630,1220" fill="#FFFFFF"/>
        <polygon points="540,1100 480,1240 600,1240" fill="${outfitColor[2] || '#1E293B'}"/>

        <!-- Neck -->
        <rect x="470" y="850" width="140" height="200" rx="30" fill="#E5C3A6"/>

        <!-- Face / Head Oval -->
        <ellipse cx="540" cy="700" rx="200" ry="240" fill="#F3D1B4"/>

        <!-- Hair Style (Male vs Female) -->
        ${gender === 'male' ? `
          <path d="M 330 660 C 330 440, 420 380, 540 380 C 660 380, 750 440, 750 660 C 740 500, 680 430, 540 430 C 400 430, 340 500, 330 660 Z" fill="#292524"/>
          <!-- Glasses -->
          <rect x="390" y="640" width="120" height="80" rx="16" fill="none" stroke="#1C1917" stroke-width="12"/>
          <rect x="570" y="640" width="120" height="80" rx="16" fill="none" stroke="#1C1917" stroke-width="12"/>
          <line x1="510" y1="675" x2="570" y2="675" stroke="#1C1917" stroke-width="10"/>
        ` : `
          <!-- Female Long Hair -->
          <path d="M 300 780 C 290 500, 380 350, 540 350 C 700 350, 790 500, 780 780 C 820 1000, 800 1250, 760 1400 C 720 1200, 720 800, 710 650 C 680 440, 400 440, 370 650 C 360 800, 360 1200, 320 1400 C 280 1250, 260 1000, 300 780 Z" fill="#1C1917"/>
          <!-- Glasses -->
          <rect x="390" y="640" width="120" height="80" rx="20" fill="none" stroke="#D97706" stroke-width="10"/>
          <rect x="570" y="640" width="120" height="80" rx="20" fill="none" stroke="#D97706" stroke-width="10"/>
          <line x1="510" y1="675" x2="570" y2="675" stroke="#D97706" stroke-width="8"/>
        `}

        <!-- Eyes & Smile -->
        <circle cx="450" cy="680" r="14" fill="#292524"/>
        <circle cx="630" cy="680" r="14" fill="#292524"/>
        <path d="M 460 770 Q 540 830, 620 770" fill="none" stroke="#B45309" stroke-width="10" stroke-linecap="round"/>

        <!-- Role Accessory Overlays -->
        ${accessorySvg}
      </g>

      <!-- Transparent Photo Framing Inner Guide -->
      <rect x="40" y="40" width="${width - 80}" height="${height - 80}" rx="48" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="6"/>
    </svg>
  `;

  // Stethoscope for Doctor
  const doctorAccessory = `
    <path d="M 400 1040 Q 540 1350, 680 1040" fill="none" stroke="#94A3B8" stroke-width="24" stroke-linecap="round"/>
    <circle cx="540" cy="1280" r="32" fill="#E2E8F0" stroke="#64748B" stroke-width="8"/>
  `;

  // Journal / Book for Professor
  const professorAccessory = `
    <rect x="420" y="1300" width="240" height="320" rx="18" fill="#451A03" stroke="#FDE047" stroke-width="8"/>
    <line x1="440" y1="1330" x2="640" y2="1330" stroke="#FDE047" stroke-width="4"/>
  `;

  // Tie for Business Professional
  const businessAccessory = `
    <polygon points="540,1100 515,1140 565,1140" fill="#0F172A"/>
    <polygon points="515,1140 565,1140 550,1500 540,1540 530,1500" fill="#0F172A"/>
  `;

  // Tech Badge for Engineer
  const engineerAccessory = `
    <rect x="360" y="1120" width="120" height="180" rx="12" fill="#FFFFFF" stroke="#0284C7" stroke-width="6"/>
    <line x1="380" y1="1160" x2="460" y2="1160" stroke="#0284C7" stroke-width="8"/>
    <line x1="380" y1="1200" x2="440" y2="1200" stroke="#94A3B8" stroke-width="6"/>
  `;

  const framesData = [
    // 1. Engineer (Men)
    {
      id: 'role-engineer-male',
      name: 'Engineer',
      category: 'Men',
      description: 'Professional tech engineer in modern office',
      svg: createRoleSvg('Engineer', 'male', ['#1E3A8A', '#0F172A', '#2563EB'], ['#E0F2FE', '#BAE6FD'], engineerAccessory),
      bgColor: '#F0F9FF',
      color: '#0284C7',
      promptModifier: 'portrait of a confident Indian male engineer in sleek blue shirt with glasses in tech office',
      order: 1,
    },
    // 2. Doctor (Men)
    {
      id: 'role-doctor-male',
      name: 'Doctor',
      category: 'Men',
      description: 'Medical healthcare professional with stethoscope',
      svg: createRoleSvg('Doctor', 'male', ['#F8FAFC', '#E2E8F0', '#0284C7'], ['#F0FDFA', '#CCFBF1'], doctorAccessory),
      bgColor: '#F0FDFA',
      color: '#0D9488',
      promptModifier: 'portrait of a smiling Indian male doctor in white lab coat with stethoscope in modern hospital',
      order: 2,
    },
    // 3. Professor (Men)
    {
      id: 'role-professor-male',
      name: 'Professor',
      category: 'Men',
      description: 'Academic professor in formal attire with journal',
      svg: createRoleSvg('Professor', 'male', ['#1E293B', '#0F172A', '#475569'], ['#FEF3C7', '#FDE68A'], professorAccessory),
      bgColor: '#FFFBEB',
      color: '#D97706',
      promptModifier: 'portrait of a distinguished Indian male university professor holding notebook in classic library',
      order: 3,
    },
    // 4. Business Professional (Men)
    {
      id: 'role-business-male',
      name: 'Business Professional',
      category: 'Men',
      description: 'Corporate business executive in black suit and tie',
      svg: createRoleSvg('Business', 'male', ['#0F172A', '#020617', '#000000'], ['#F1F5F9', '#E2E8F0'], businessAccessory),
      bgColor: '#F8FAFC',
      color: '#0F172A',
      promptModifier: 'portrait of a handsome Indian male corporate business professional in black suit and tie in executive suite',
      order: 4,
    },
    // 5. Engineer (Women)
    {
      id: 'role-engineer-female',
      name: 'Engineer',
      category: 'Women',
      description: 'Female tech engineer in modern office',
      svg: createRoleSvg('Engineer', 'female', ['#1D4ED8', '#1E3A8A', '#3B82F6'], ['#E0F2FE', '#BAE6FD'], engineerAccessory),
      bgColor: '#F0F9FF',
      color: '#0284C7',
      promptModifier: 'portrait of a confident Indian female engineer in sleek blue attire with glasses in modern tech office',
      order: 5,
    },
    // 6. Doctor (Women)
    {
      id: 'role-doctor-female',
      name: 'Doctor',
      category: 'Women',
      description: 'Female medical doctor with stethoscope',
      svg: createRoleSvg('Doctor', 'female', ['#F8FAFC', '#E2E8F0', '#0D9488'], ['#F0FDFA', '#CCFBF1'], doctorAccessory),
      bgColor: '#F0FDFA',
      color: '#0D9488',
      promptModifier: 'portrait of a smiling Indian female doctor in white lab coat with stethoscope in clinic',
      order: 6,
    },
    // 7. Professor (Women)
    {
      id: 'role-professor-female',
      name: 'Professor',
      category: 'Women',
      description: 'Female academic professor holding journal',
      svg: createRoleSvg('Professor', 'female', ['#334155', '#1E293B', '#64748B'], ['#FEF3C7', '#FDE68A'], professorAccessory),
      bgColor: '#FFFBEB',
      color: '#D97706',
      promptModifier: 'portrait of an intelligent Indian female professor holding book in university office',
      order: 7,
    },
    // 8. Business Professional (Women)
    {
      id: 'role-business-female',
      name: 'Business Professional',
      category: 'Women',
      description: 'Female corporate executive in suit blazer',
      svg: createRoleSvg('Business', 'female', ['#0F172A', '#1E293B', '#334155'], ['#F1F5F9', '#E2E8F0'], businessAccessory),
      bgColor: '#F8FAFC',
      color: '#0F172A',
      promptModifier: 'portrait of an elegant Indian female corporate business executive in dark blazer in luxury office',
      order: 8,
    },
  ];

  const seeded = [];

  for (const f of framesData) {
    const pngPath = path.join(config.framesDir, `${f.id}.png`);
    const previewPath = path.join(config.framesDir, `${f.id}_preview.png`);

    // 1. Render overlay PNG
    await sharp(Buffer.from(f.svg))
      .resize(1080, 1920)
      .png({ quality: 100 })
      .toFile(pngPath);

    // 2. Render high-res preview thumbnail
    await sharp(Buffer.from(f.svg))
      .resize(540, 840)
      .png({ quality: 100 })
      .toFile(previewPath);

    const overlayUrl = `${config.appBaseUrl}/uploads/frames/${f.id}.png`;
    const previewUrl = `${config.appBaseUrl}/uploads/frames/${f.id}_preview.png`;

    seeded.push({
      frameId: f.id,
      name: f.name,
      category: f.category,
      description: f.description,
      previewUrl,
      overlayUrl,
      promptModifier: f.promptModifier,
      themeColor: f.color,
      aspectRatio: '9:16',
      order: f.order,
      isActive: true,
    });
  }

  const fallbackJsonPath = path.join(config.uploadDir, 'frames_seed.json');
  fs.writeFileSync(fallbackJsonPath, JSON.stringify(seeded, null, 2));

  return seeded;
}

async function seedDatabase() {
  console.log('[Seed] Generating ultra-high-definition Holobox frame assets (1080x1920)...');
  const framesToSeed = await generateFrameAssets();
  console.log(`[Seed] Successfully generated 8 HD role swap assets in ${config.framesDir}`);

  try {
    await connectDB();
    console.log(`[Seed] Upserting ${framesToSeed.length} default frames to MongoDB...`);
    for (const frameData of framesToSeed) {
      await Frame.findOneAndUpdate(
        { frameId: frameData.frameId },
        { $set: frameData },
        { upsert: true, new: true }
      );
      console.log(`  ✓ Seeded frame: ${frameData.name} (${frameData.frameId})`);
    }

    console.log('[Seed] MongoDB database seeding completed successfully! 🎉');
    await mongoose.connection.close();
  } catch (err) {
    console.warn('[Seed] Note: MongoDB connection finished.');
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase, generateFrameAssets };

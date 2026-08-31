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

  // Frame 1: Vintage Floral Romance (Emerald Leaf Garland & Ivory Rose Blossoms)
  const floralSvg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="goldFiligree" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#E2BA6E" />
          <stop offset="30%" stop-color="#FBF3D5" />
          <stop offset="70%" stop-color="#C59B42" />
          <stop offset="100%" stop-color="#8C6721" />
        </linearGradient>
        <linearGradient id="roseGarland" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#F472B6" />
          <stop offset="50%" stop-color="#E11D48" />
          <stop offset="100%" stop-color="#9F1239" />
        </linearGradient>
      </defs>
      
      <!-- Outer Double Border with Gold Trim -->
      <rect x="28" y="28" width="${width - 56}" height="${height - 56}" rx="48" fill="none" stroke="url(#goldFiligree)" stroke-width="14"/>
      <rect x="52" y="52" width="${width - 104}" height="${height - 104}" rx="36" fill="none" stroke="#2D5A27" stroke-width="4" stroke-dasharray="14,10"/>
      <rect x="68" y="68" width="${width - 136}" height="${height - 136}" rx="28" fill="none" stroke="url(#goldFiligree)" stroke-width="3"/>

      <!-- Top & Bottom Botanical Garlands -->
      <path d="M 90 60 Q ${width / 2} 18, ${width - 90} 60" fill="none" stroke="#2D5A27" stroke-width="16" stroke-linecap="round"/>
      <path d="M 90 ${height - 60} Q ${width / 2} ${height - 18}, ${width - 90} ${height - 60}" fill="none" stroke="#2D5A27" stroke-width="16" stroke-linecap="round"/>

      <!-- Corner Floral Bouquets (Top-Left) -->
      <circle cx="95" cy="95" r="48" fill="#FFF1F2" stroke="#E11D48" stroke-width="4"/>
      <circle cx="95" cy="95" r="30" fill="url(#roseGarland)"/>
      <circle cx="95" cy="95" r="15" fill="#FFE4E6"/>
      <circle cx="140" cy="75" r="24" fill="#F472B6"/>
      <circle cx="75" cy="140" r="24" fill="#FDA4AF"/>

      <!-- Corner Floral Bouquets (Top-Right) -->
      <circle cx="${width - 95}" cy="95" r="48" fill="#FFF1F2" stroke="#E11D48" stroke-width="4"/>
      <circle cx="${width - 95}" cy="95" r="30" fill="url(#roseGarland)"/>
      <circle cx="${width - 95}" cy="95" r="15" fill="#FFE4E6"/>
      <circle cx="${width - 140}" cy="75" r="24" fill="#F472B6"/>
      <circle cx="${width - 75}" cy="140" r="24" fill="#FDA4AF"/>

      <!-- Corner Floral Bouquets (Bottom-Left) -->
      <circle cx="95" cy="${height - 95}" r="48" fill="#FFF1F2" stroke="#E11D48" stroke-width="4"/>
      <circle cx="95" cy="${height - 95}" r="30" fill="url(#roseGarland)"/>
      <circle cx="95" cy="${height - 95}" r="15" fill="#FFE4E6"/>
      <circle cx="140" cy="${height - 75}" r="24" fill="#F472B6"/>
      <circle cx="75" cy="${height - 140}" r="24" fill="#FDA4AF"/>

      <!-- Corner Floral Bouquets (Bottom-Right) -->
      <circle cx="${width - 95}" cy="${height - 95}" r="48" fill="#FFF1F2" stroke="#E11D48" stroke-width="4"/>
      <circle cx="${width - 95}" cy="${height - 95}" r="30" fill="url(#roseGarland)"/>
      <circle cx="${width - 95}" cy="${height - 95}" r="15" fill="#FFE4E6"/>
      <circle cx="${width - 140}" cy="${height - 75}" r="24" fill="#F472B6"/>
      <circle cx="${width - 75}" cy="${height - 140}" r="24" fill="#FDA4AF"/>
    </svg>
  `;

  // Frame 2: Royal Golden Elegance (Baroque Ornate Filigree)
  const royalGoldSvg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="baroqueGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFF3B0" />
          <stop offset="25%" stop-color="#FFD700" />
          <stop offset="60%" stop-color="#D4AF37" />
          <stop offset="100%" stop-color="#8B6508" />
        </linearGradient>
      </defs>
      
      <!-- Multi-Layered Royal Gold Frames -->
      <rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="54" fill="none" stroke="url(#baroqueGold)" stroke-width="18"/>
      <rect x="52" y="52" width="${width - 104}" height="${height - 104}" rx="38" fill="none" stroke="#FFE57F" stroke-width="4"/>
      <rect x="68" y="68" width="${width - 136}" height="${height - 136}" rx="28" fill="none" stroke="url(#baroqueGold)" stroke-width="6"/>

      <!-- Baroque Filigree Corner 1 (Top-Left) -->
      <path d="M 24 220 C 110 220, 220 110, 220 24 L 24 24 Z" fill="url(#baroqueGold)" opacity="0.95"/>
      <circle cx="120" cy="120" r="20" fill="#FFFFFF"/>
      <circle cx="120" cy="120" r="10" fill="#8B6508"/>

      <!-- Baroque Filigree Corner 2 (Top-Right) -->
      <path d="M ${width - 24} 220 C ${width - 110} 220, ${width - 220} 110, ${width - 220} 24 L ${width - 24} 24 Z" fill="url(#baroqueGold)" opacity="0.95"/>
      <circle cx="${width - 120}" cy="120" r="20" fill="#FFFFFF"/>
      <circle cx="${width - 120}" cy="120" r="10" fill="#8B6508"/>

      <!-- Baroque Filigree Corner 3 (Bottom-Left) -->
      <path d="M 24 ${height - 220} C 110 ${height - 220}, 220 ${height - 110}, 220 ${height - 24} L 24 ${height - 24} Z" fill="url(#baroqueGold)" opacity="0.95"/>
      <circle cx="120" cy="${height - 120}" r="20" fill="#FFFFFF"/>
      <circle cx="120" cy="${height - 120}" r="10" fill="#8B6508"/>

      <!-- Baroque Filigree Corner 4 (Bottom-Right) -->
      <path d="M ${width - 24} ${height - 220} C ${width - 110} ${height - 220}, ${width - 220} ${height - 110}, ${width - 220} ${height - 24} L ${width - 24} ${height - 24} Z" fill="url(#baroqueGold)" opacity="0.95"/>
      <circle cx="${width - 120}" cy="${height - 120}" r="20" fill="#FFFFFF"/>
      <circle cx="${width - 120}" cy="${height - 120}" r="10" fill="#8B6508"/>
    </svg>
  `;

  // Frame 3: Pink Blossom Charm (Lush Spring Sakura & Rose)
  const pinkRoseSvg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sakuraGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#F472B6" />
          <stop offset="50%" stop-color="#EC4899" />
          <stop offset="100%" stop-color="#BE185D" />
        </linearGradient>
      </defs>
      
      <rect x="28" y="28" width="${width - 56}" height="${height - 56}" rx="50" fill="none" stroke="url(#sakuraGrad)" stroke-width="16"/>
      <rect x="54" y="54" width="${width - 108}" height="${height - 108}" rx="34" fill="none" stroke="#FCE7F3" stroke-width="5"/>

      <!-- Rose Clusters Top-Left -->
      <circle cx="100" cy="100" r="50" fill="#F472B6"/>
      <circle cx="130" cy="70" r="32" fill="#FB7185"/>
      <circle cx="70" cy="130" r="32" fill="#FDA4AF"/>
      <circle cx="100" cy="100" r="22" fill="#BE185D"/>

      <!-- Rose Clusters Top-Right -->
      <circle cx="${width - 100}" cy="100" r="50" fill="#F472B6"/>
      <circle cx="${width - 130}" cy="70" r="32" fill="#FB7185"/>
      <circle cx="${width - 70}" cy="130" r="32" fill="#FDA4AF"/>
      <circle cx="${width - 100}" cy="100" r="22" fill="#BE185D"/>

      <!-- Rose Clusters Bottom-Left -->
      <circle cx="100" cy="${height - 100}" r="50" fill="#F472B6"/>
      <circle cx="130" cy="${height - 70}" r="32" fill="#FB7185"/>
      <circle cx="70" cy="${height - 130}" r="32" fill="#FDA4AF"/>
      <circle cx="100" cy="${height - 100}" r="22" fill="#BE185D"/>

      <!-- Rose Clusters Bottom-Right -->
      <circle cx="${width - 100}" cy="${height - 100}" r="50" fill="#F472B6"/>
      <circle cx="${width - 130}" cy="${height - 70}" r="32" fill="#FB7185"/>
      <circle cx="${width - 70}" cy="${height - 130}" r="32" fill="#FDA4AF"/>
      <circle cx="${width - 100}" cy="${height - 100}" r="22" fill="#BE185D"/>
    </svg>
  `;

  // Frame 4: Midnight Navy & Gold Stars
  const midnightNavySvg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="celestialGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FEF08A" />
          <stop offset="40%" stop-color="#EAB308" />
          <stop offset="100%" stop-color="#854D0E" />
        </linearGradient>
      </defs>
      
      <rect x="26" y="26" width="${width - 52}" height="${height - 52}" rx="52" fill="none" stroke="#0F172A" stroke-width="20"/>
      <rect x="56" y="56" width="${width - 112}" height="${height - 112}" rx="36" fill="none" stroke="url(#celestialGold)" stroke-width="8"/>

      <!-- 8-Pointed Celestial Gold Stars (Top-Left) -->
      <polygon points="100,60 112,88 140,88 118,104 126,132 100,114 74,132 82,104 60,88 88,88" fill="url(#celestialGold)"/>
      <!-- Top-Right -->
      <polygon points="${width - 100},60 ${width - 88},88 ${width - 60},88 ${width - 82},104 ${width - 74},132 ${width - 100},114 ${width - 126},132 ${width - 118},104 ${width - 140},88 ${width - 112},88" fill="url(#celestialGold)"/>
      <!-- Bottom-Left -->
      <polygon points="100,${height - 132} 112,${height - 104} 140,${height - 104} 118,${height - 88} 126,${height - 60} 100,${height - 78} 74,${height - 60} 82,${height - 88} 60,${height - 104} 88,${height - 104}" fill="url(#celestialGold)"/>
      <!-- Bottom-Right -->
      <polygon points="${width - 100},${height - 132} ${width - 88},${height - 104} ${width - 60},${height - 104} ${width - 82},${height - 88} ${width - 74},${height - 60} ${width - 100},${height - 78} ${width - 126},${height - 60} ${width - 118},${height - 88} ${width - 140},${height - 104} ${width - 112},${height - 104}" fill="url(#celestialGold)"/>
    </svg>
  `;

  const framesData = [
    {
      id: 'frame-vintage-floral',
      name: 'Vintage Floral Romance',
      category: 'Romantic & Floral',
      description: 'Elegant ivory floral vines and green leaf garland border',
      svg: floralSvg,
      bgColor: '#FAF8F5',
      color: '#2E7D32',
      promptModifier: 'framed in delicate vintage floral blossoms, warm romantic lighting, soft background glow',
      order: 1,
    },
    {
      id: 'frame-royal-gold',
      name: 'Royal Golden Elegance',
      category: 'Luxury & Royal',
      description: 'Shimmering baroque gold filigree border with ornate royal motifs',
      svg: royalGoldSvg,
      bgColor: '#FFFDF0',
      color: '#D4AF37',
      promptModifier: 'framed in luxurious royal gold filigree, warm golden hour ambient lighting, high celebration majesty',
      order: 2,
    },
    {
      id: 'frame-pink-rose',
      name: 'Pink Blossom Charm',
      category: 'Anniversary & Birthday',
      description: 'Sweet pink rose garland and fresh blooming blossoms',
      svg: pinkRoseSvg,
      bgColor: '#FFF5F8',
      color: '#EC4899',
      promptModifier: 'framed in vibrant blooming pink roses, joyful celebratory festive aura, fairy sparkle lights',
      order: 3,
    },
    {
      id: 'frame-midnight-gold',
      name: 'Midnight Navy Starry',
      category: 'Evening Gala & Luxury',
      description: 'Deep midnight navy blue with brilliant celestial gold star corners',
      svg: midnightNavySvg,
      bgColor: '#F8FAFC',
      color: '#1E3A8A',
      promptModifier: 'framed in deep midnight luxury with sparkling starry golden lights, evening gala aesthetics',
      order: 4,
    },
  ];

  const seeded = [];

  for (const f of framesData) {
    const pngPath = path.join(config.framesDir, `${f.id}.png`);
    const previewPath = path.join(config.framesDir, `${f.id}_preview.png`);

    // 1. Render ultra-crisp transparent overlay PNG
    await sharp(Buffer.from(f.svg))
      .resize(1080, 1920)
      .png({ quality: 100 })
      .toFile(pngPath);

    // 2. Render high-res thumbnail with ivory canvas background
    const previewSvgWithBg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${f.bgColor}"/>
        ${f.svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}
      </svg>
    `;

    await sharp(Buffer.from(previewSvgWithBg))
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
  console.log(`[Seed] Successfully generated 4 HD frame overlays in ${config.framesDir}`);

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

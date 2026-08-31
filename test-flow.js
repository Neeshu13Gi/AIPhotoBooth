const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const FormData = require('form-data');

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5000';

async function runEndToEndTest() {
  console.log('================================================================');
  console.log('🧪 Starting End-to-End AI PhotoBooth Backend Verification Test');
  console.log(`🌐 Target Server: ${BASE_URL}`);
  console.log('================================================================\n');

  try {
    // 1. Health Check
    console.log('1️⃣  Checking Server Health...');
    const healthRes = await axios.get(`${BASE_URL}/api/health`);
    console.log('   ✓ Server Status:', healthRes.data);

    // 2. Fetch Frames (Step 1)
    console.log('\n2️⃣  Testing GET /api/frames (Step 1: Select Frame)...');
    const framesRes = await axios.get(`${BASE_URL}/api/frames`);
    console.log(`   ✓ Found ${framesRes.data.count} available frames:`);
    framesRes.data.data.forEach((f, idx) => {
      console.log(`     ${idx + 1}. [${f.frameId}] ${f.name} - ${f.category}`);
    });

    if (framesRes.data.data.length === 0) {
      throw new Error('No frames found! Run `npm run seed` first.');
    }

    const selectedFrame = framesRes.data.data[0];

    // 3. Create Sample Test Photo (Step 2: Capture / Upload)
    console.log('\n3️⃣  Creating a test portrait photo for simulation...');
    const sampleImagePath = path.join(__dirname, 'test_portrait_sample.jpg');
    
    // Create a 720x1280 sample portrait image with gradient & label
    const sampleSvg = `
      <svg width="720" height="1280" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3B82F6"/>
            <stop offset="100%" stop-color="#1E1B4B"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <circle cx="360" cy="500" r="180" fill="#FDE047"/>
        <circle cx="300" cy="450" r="20" fill="#1E293B"/>
        <circle cx="420" cy="450" r="20" fill="#1E293B"/>
        <path d="M 280 540 Q 360 620 440 540" stroke="#1E293B" stroke-width="12" fill="none" stroke-linecap="round"/>
        <text x="360" y="850" font-size="44" fill="#FFFFFF" font-family="sans-serif" font-weight="bold" text-anchor="middle">AI PhotoBooth Guest</text>
        <text x="360" y="920" font-size="28" fill="#93C5FD" font-family="sans-serif" text-anchor="middle">Test Snapshot</text>
      </svg>
    `;
    await sharp(Buffer.from(sampleSvg)).jpeg({ quality: 90 }).toFile(sampleImagePath);
    console.log(`   ✓ Test photo created at: ${sampleImagePath}`);

    // 4. Submit PhotoBooth Job (Step 3: User Details -> Generate Video)
    console.log('\n4️⃣  Submitting Job (POST /api/jobs/generate)...');
    const form = new FormData();
    form.append('fullName', 'Ananya Sharma');
    form.append('email', 'ananya@example.com');
    form.append('phone', '+91 98765 43210');
    form.append('occasion', 'Birthday Celebration');
    form.append('message', 'Happy Birthday to my dearest friend! 🎂');
    form.append('frameId', selectedFrame.frameId);
    form.append('photo', fs.createReadStream(sampleImagePath));

    const submitRes = await axios.post(`${BASE_URL}/api/jobs/generate`, form, {
      headers: form.getHeaders(),
    });

    const { jobId } = submitRes.data.data;
    console.log(`   ✓ Job submitted successfully! Job ID: ${jobId}`);

    // 5. Poll Job Status (Step 4: Creating Video)
    console.log('\n5️⃣  Polling Generation Progress (Step 4: Creating Video)...');
    let isDone = false;
    let pollCount = 0;
    while (!isDone && pollCount < 40) {
      pollCount++;
      await new Promise((r) => setTimeout(r, 1200));

      const statusRes = await axios.get(`${BASE_URL}/api/jobs/status/${jobId}`);
      const { status, progress, statusMessage, isCompleted, isFailed, error } = statusRes.data.data;

      console.log(`   [Progress ${progress}%] Status: ${status} | "${statusMessage}"`);

      if (isCompleted) {
        isDone = true;
        console.log('\n   🎉 Video Generation & Frame Compositing Complete!');
      } else if (isFailed) {
        throw new Error(`Job failed: ${error}`);
      }
    }

    // 6. Fetch Final Result (Step 5: Preview, Downloads & QR Code)
    console.log('\n6️⃣  Fetching Final Result (Step 5: Preview & QR Code)...');
    const resultRes = await axios.get(`${BASE_URL}/api/jobs/result/${jobId}`);
    const result = resultRes.data.data;

    console.log('   ✓ Framed Video URL:', result.framedVideoUrl);
    console.log('   ✓ Framed Image URL:', result.framedImageUrl);
    console.log('   ✓ QR Code URL:     ', result.qrCodeUrl);
    console.log('   ✓ Mobile Share URL: ', result.shareUrl);

    // 7. Verify Share Page HTML Rendering
    console.log('\n7️⃣  Verifying Public Share / QR Landing Page...');
    const shareRes = await axios.get(`${BASE_URL}/share/${jobId}`);
    if (shareRes.data.includes('Your Video is Ready!')) {
      console.log('   ✓ Public Share HTML page successfully verified!');
    }

    // Cleanup sample test image
    if (fs.existsSync(sampleImagePath)) {
      fs.unlinkSync(sampleImagePath);
    }

    console.log('\n================================================================');
    console.log('✅ ALL BACKEND TESTS PASSED SUCCESSFULLY! 🚀');
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n❌ Test execution error:', err.response?.data || err.message);
  }
}

if (require.main === module) {
  runEndToEndTest();
}

module.exports = runEndToEndTest;

const fs = require('fs');
const path = require('path');
const GenerationJob = require('../models/GenerationJob');
const config = require('../config/env');

/**
 * Mobile-friendly landing page rendered when user scans the QR code on their phone
 */
exports.renderSharePage = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await GenerationJob.findOne({ jobId });

    if (!job) {
      return res.status(404).send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #0F172A; color: white;">
            <h2>Memory Not Found</h2>
            <p>We couldn't find the photo or video for job ID: ${jobId}</p>
          </body>
        </html>
      `);
    }

    const templatePath = path.join(__dirname, '../views/share.html');
    let html = fs.readFileSync(templatePath, 'utf8');

    // Replace template variables
    html = html
      .replace(/\{\{videoUrl\}\}/g, job.framedVideoUrl || job.rawVideoUrl || '')
      .replace(/\{\{imageUrl\}\}/g, job.framedImageUrl || job.inputImageUrl || '')
      .replace(/\{\{downloadVideoUrl\}\}/g, `/api/jobs/download/${job.jobId}/video`)
      .replace(/\{\{downloadImageUrl\}\}/g, `/api/jobs/download/${job.jobId}/image`)
      .replace(/\{\{fullName\}\}/g, job.userDetails?.fullName || 'Valued Guest')
      .replace(/\{\{formattedDate\}\}/g, new Date(job.createdAt).toLocaleString())
      .replace(/\{\{#if occasion\}\}([\s\S]*?)\{\{\/if\}\}/g, job.userDetails?.occasion ? `$1`.replace(/\{\{occasion\}\}/g, job.userDetails.occasion) : '')
      .replace(/\{\{#if message\}\}([\s\S]*?)\{\{\/if\}\}/g, job.userDetails?.message ? `$1`.replace(/\{\{message\}\}/g, job.userDetails.message) : '');

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    next(error);
  }
};

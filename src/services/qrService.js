const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const config = require('../config/env');

class QRService {
  /**
   * Generates a branded QR Code pointing to the user's download/share page.
   * @param {string} jobId
   * @returns {Promise<{ qrCodeUrl: string, qrCodePath: string, shareUrl: string }>}
   */
  static async generateQRCode(jobId) {
    if (!fs.existsSync(config.qrCodesDir)) {
      fs.mkdirSync(config.qrCodesDir, { recursive: true });
    }

    const shareUrl = `${config.appBaseUrl}/share/${jobId}`;
    const fileName = `qr_${jobId}.png`;
    const filePath = path.join(config.qrCodesDir, fileName);

    await QRCode.toFile(filePath, shareUrl, {
      type: 'png',
      width: 400,
      margin: 2,
      color: {
        dark: '#1E3A8A', // Deep royal navy blue matching the theme
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    });

    const qrCodeUrl = `${config.appBaseUrl}/uploads/qrcodes/${fileName}`;
    return {
      qrCodeUrl,
      qrCodePath: filePath,
      shareUrl,
    };
  }
}

module.exports = QRService;

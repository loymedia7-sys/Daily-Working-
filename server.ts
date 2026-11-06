import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // Health & Cloudinary Configuration Status endpoint
  app.get('/api/cloudinary/status', (_req, res) => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'xivrejrq';
    const apiKey = process.env.CLOUDINARY_API_KEY || '656836995747733';
    const apiSecret = process.env.CLOUDINARY_API_SECRET || 'xX4yFuMAYC3I-YPalINAR-Bi5A4';
    const configured = Boolean(cloudName && apiKey && apiSecret);
    res.json({
      configured,
      cloudName: configured ? cloudName : null,
    });
  });

  // Backend-Signed Cloudinary Upload Signature Generator
  // Never exposes CLOUDINARY_API_SECRET to the frontend
  app.post('/api/cloudinary/sign', (req, res) => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'xivrejrq';
    const apiKey = process.env.CLOUDINARY_API_KEY || '656836995747733';
    const apiSecret = process.env.CLOUDINARY_API_SECRET || 'xX4yFuMAYC3I-YPalINAR-Bi5A4';

    if (!cloudName || !apiKey || !apiSecret) {
      res.status(200).json({
        configured: false,
        message: 'Cloudinary environment variables not configured; using direct compressed storage.',
      });
      return;
    }

    const { userId, workDate } = req.body as { userId?: string; workDate?: string };
    const safeUser = (userId || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '');
    const safeDate = (workDate || new Date().toISOString().slice(0, 10)).replace(/[^0-9-]/g, '');
    const folder = `dailywork/employees/${safeUser}/${safeDate}`;
    const timestamp = Math.round(new Date().getTime() / 1000);

    // Cloudinary signature string: sorted parameters joined with & + apiSecret
    const stringToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

    res.json({
      configured: true,
      cloudName,
      apiKey,
      timestamp,
      folder,
      signature,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DailyWork server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

import { BLUEPRINT_LIMITS } from './firebase';

export interface UploadedPhotoResult {
  url: string;
  source: 'cloudinary' | 'inline_compressed';
}

/**
 * Compresses an image File or Blob via HTML5 Canvas so that:
 * 1. Mobile camera photos (which can be 5MB–12MB) are resized to max 960px and JPEG quality 0.72.
 * 2. Resulting data URI is compact (~40KB–95KB), well under Firestore and network limits.
 */
export async function compressImageFile(file: File | Blob, maxDimension = 960, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl.length > BLUEPRINT_LIMITS.MAX_PHOTO_DATA_LEN) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.5);
        }
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads an activity photo using backend-generated Cloudinary signatures (/api/cloudinary/sign).
 * If Cloudinary credentials are not configured in the environment or the device is offline,
 * gracefully returns the compressed JPEG data URL so the user never loses work evidence.
 */
export async function uploadActivityPhoto(
  fileOrDataUrl: File | string,
  userId: string,
  workDate: string
): Promise<UploadedPhotoResult> {
  const compressedDataUrl =
    typeof fileOrDataUrl === 'string'
      ? fileOrDataUrl
      : await compressImageFile(fileOrDataUrl);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { url: compressedDataUrl, source: 'inline_compressed' };
  }

  try {
    const signRes = await fetch('/api/cloudinary/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, workDate }),
    });

    if (!signRes.ok) {
      return { url: compressedDataUrl, source: 'inline_compressed' };
    }

    const signData = await signRes.json();
    if (!signData.configured) {
      return { url: compressedDataUrl, source: 'inline_compressed' };
    }

    const formData = new FormData();
    formData.append('file', compressedDataUrl);
    formData.append('api_key', signData.apiKey);
    formData.append('timestamp', String(signData.timestamp));
    formData.append('signature', signData.signature);
    formData.append('folder', signData.folder);

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (uploadRes.ok) {
      const uploadJson = await uploadRes.json();
      if (uploadJson.secure_url) {
        return { url: uploadJson.secure_url, source: 'cloudinary' };
      }
    }
  } catch {
    // Fallback to inline compressed photo when offline or Cloudinary unreachable
  }

  return { url: compressedDataUrl, source: 'inline_compressed' };
}

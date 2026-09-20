const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/env');

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

// Memory storage: we always receive the buffer here, then hand off to saveUploadedFile() below.
// This keeps the local-disk-vs-cloud swap to one file.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }, // 10MB - phone camera photos
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(Object.assign(new Error('Only JPEG, PNG, WebP or HEIC photos are allowed'), { status: 400 }));
    }
    cb(null, true);
  },
});

let cloudinary;
function getCloudinary() {
  if (cloudinary) return cloudinary;
  if (!config.storage.cloudinaryUrl) {
    throw new Error('STORAGE_DRIVER=cloudinary but CLOUDINARY_URL is not set');
  }
  cloudinary = require('cloudinary').v2;
  cloudinary.config({ secure: true }); // reads CLOUDINARY_URL from the environment
  return cloudinary;
}

async function saveToCloudinary(file) {
  const cld = getCloudinary();
  return new Promise((resolve, reject) => {
    const stream = cld.uploader.upload_stream(
      {
        folder: config.storage.cloudinaryFolder,
        public_id: uuidv4(),
        resource_type: 'image',
        // Cap stored size so a 12MP camera photo becomes a manageable receipt image.
        transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
      },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    );
    stream.end(file.buffer);
  });
}

async function saveToLocalDisk(file) {
  const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
  const filename = `${uuidv4()}${ext}`;
  const uploadDir = path.resolve(__dirname, '..', '..', config.storage.uploadDir);
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), file.buffer);
  return `${config.apiBaseUrl}/uploads/${filename}`;
}

/**
 * Saves the uploaded buffer using whichever STORAGE_DRIVER is configured and returns a public
 * URL. The rest of the app (and the mobile app) only ever deals with the returned URL.
 *  - local:      backend/uploads on disk (dev only; wiped on every Render redeploy)
 *  - cloudinary: persistent CDN-hosted image (production)
 */
async function saveUploadedFile(file) {
  if (config.storage.driver === 'cloudinary') return saveToCloudinary(file);
  return saveToLocalDisk(file);
}

module.exports = { upload, saveUploadedFile };

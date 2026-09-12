const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Memory storage: we always receive the buffer here, then hand off to
// storageDriver.save() below. This keeps local-disk-vs-S3 swap to one file.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB - phone camera photos
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  },
});

/**
 * Saves the uploaded buffer using whichever STORAGE_DRIVER is configured and
 * returns a public URL. Swap the 's3' branch for your bucket logic when you
 * go to production - the rest of the app only ever deals with the returned URL,
 * so both the website and the future mobile app work unchanged.
 */
async function saveUploadedFile(file) {
  const driver = process.env.STORAGE_DRIVER || 'local';
  const ext = path.extname(file.originalname) || '.jpg';
  const filename = `${uuidv4()}${ext}`;

  if (driver === 's3') {
    // Example (uncomment once @aws-sdk/client-s3 is installed and configured):
    //
    // const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    // const s3 = new S3Client({ region: process.env.AWS_REGION });
    // await s3.send(new PutObjectCommand({
    //   Bucket: process.env.AWS_S3_BUCKET,
    //   Key: `trip-photos/${filename}`,
    //   Body: file.buffer,
    //   ContentType: file.mimetype,
    // }));
    // return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/trip-photos/${filename}`;
    throw new Error('S3 storage driver not yet configured - see saveUploadedFile() comment.');
  }

  // local disk
  const fs = require('fs');
  const uploadDir = path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(path.join(uploadDir, filename), file.buffer);

  const base = process.env.API_BASE_URL || 'http://localhost:5001';
  return `${base}/uploads/${filename}`;
}

module.exports = { upload, saveUploadedFile };

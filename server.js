const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const archiver = require('archiver');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/tiff',
  'image/avif'
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 20 },
  fileFilter: (req, file, callback) => {
    callback(null, ALLOWED_TYPES.has(file.mimetype));
  }
});

app.use(express.static(path.join(__dirname, 'public')));

function outputFormat(format, inputFormat) {
  if (format === 'original') return inputFormat === 'jpeg' ? 'jpeg' : inputFormat;
  return ['jpeg', 'png', 'webp', 'avif'].includes(format) ? format : 'webp';
}

function extensionFor(format) {
  return format === 'jpeg' ? 'jpg' : format;
}

function compressImage(file, quality, format) {
  const image = sharp(file.buffer, { animated: false }).rotate();
  const originalFormat = file.mimetype === 'image/jpeg' ? 'jpeg' : file.mimetype.replace('image/', '');
  const target = outputFormat(format, originalFormat);
  const options = { quality, effort: 4 };
  if (target === 'png') options.compressionLevel = Math.max(2, Math.min(9, Math.round((100 - quality) / 12) + 2));

  return image
    .toFormat(target, options)
    .toBuffer({ resolveWithObject: true })
    .then(({ data, info }) => ({ data, info, format: target }));
}

app.post('/api/compress', upload.array('images', 20), async (req, res, next) => {
  try {
    if (!req.files?.length) return res.status(400).json({ message: '请选择至少一张支持的图片。' });

    const quality = Math.max(1, Math.min(100, Number.parseInt(req.body.quality, 10) || 75));
    const format = req.body.format || 'webp';
    const results = await Promise.all(req.files.map(async (file) => {
      const original = await sharp(file.buffer, { animated: false }).metadata();
      const compressed = await compressImage(file, quality, format);
      const filename = `${path.parse(file.originalname).name}-compressed.${extensionFor(compressed.format)}`;

      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.originalname,
        outputName: filename,
        original: {
          size: file.size,
          width: original.width,
          height: original.height,
          type: file.mimetype
        },
        compressed: {
          size: compressed.data.length,
          width: compressed.info.width,
          height: compressed.info.height,
          type: `image/${compressed.format}`,
          dataUrl: `data:image/${compressed.format};base64,${compressed.data.toString('base64')}`
        }
      };
    }));

    res.json({ results });
  } catch (error) {
    next(error);
  }
});

app.post('/api/download-zip', express.json({ limit: '90mb' }), async (req, res, next) => {
  try {
    const files = req.body.files;
    if (!Array.isArray(files) || !files.length) return res.status(400).json({ message: '没有可下载的文件。' });

    res.attachment('compressed-images.zip');
    const archive = archiver('zip', { zlib: { level: 8 } });
    archive.on('error', next);
    archive.pipe(res);
    for (const file of files) {
      const match = /^data:image\/[a-zA-Z0-9+.-]+;base64,(.+)$/.exec(file.dataUrl || '');
      if (match && typeof file.name === 'string') archive.append(Buffer.from(match[1], 'base64'), { name: path.basename(file.name) });
    }
    await archive.finalize();
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: '单张图片不能超过 25MB。' });
  }
  console.error(error);
  res.status(500).json({ message: '图片处理失败，请尝试换一张图片。' });
});

app.listen(PORT, () => {
  console.log(`Image Compress Studio running at http://localhost:${PORT}`);
});

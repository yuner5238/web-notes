const express = require('express');
const router = express.Router();
const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
  tls: true,
});

const bucket = process.env.S3_BUCKET;
const prefix = process.env.S3_PREFIX || '';

// GET /api/notes - List all .md files
router.get('/', async (req, res) => {
  try {
    const command = new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix });
    const data = await s3.send(command);
    const notes = (data.Contents || [])
      .filter(item => item.Key && item.Key.endsWith('.md'))
      .map(item => ({
        key: item.Key,
        name: item.Key.replace(prefix, '').replace(/\.md$/, ''),
        lastModified: item.LastModified,
        size: item.Size,
      }))
      .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
    res.json({ notes });
  } catch (err) {
    console.error('[S3 List]', err);
    res.status(500).json({ error: 'Failed to list notes' });
  }
});

// GET /api/notes/:key - Get note content
router.get('/:key(*)', async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const data = await s3.send(command);
    let body = '';
    if (data.Body) {
      const stream = data.Body;
      body = await new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        stream.on('error', reject);
      });
    }
    res.json({ content: body });
  } catch (err) {
    console.error('[S3 Get]', err);
    res.status(404).json({ error: 'Note not found' });
  }
});

// PUT /api/notes/:key - Save note
router.put('/:key(*)', async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const { content } = req.body;
    if (content === undefined) return res.status(400).json({ error: 'content required' });
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: content,
      ContentType: 'text/markdown; charset=utf-8',
    });
    await s3.send(command);
    res.json({ success: true, key });
  } catch (err) {
    console.error('[S3 Put]', err);
    res.status(500).json({ error: 'Failed to save note' });
  }
});

// DELETE /api/notes/:key - Delete note
router.delete('/:key(*)', async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
    await s3.send(command);
    res.json({ success: true });
  } catch (err) {
    console.error('[S3 Delete]', err);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// POST /api/notes - Create new note
router.post('/', async (req, res) => {
  try {
    const { name, content = '' } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const key = prefix + name + '.md';
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: content,
      ContentType: 'text/markdown; charset=utf-8',
    });
    await s3.send(command);
    res.json({ key, name });
  } catch (err) {
    console.error('[S3 Create]', err);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

module.exports = router;

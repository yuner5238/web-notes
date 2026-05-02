import express from 'express';
import cors from 'cors';
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// S3 配置
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY
  },
  forcePathStyle: true
});

const BUCKET = process.env.S3_BUCKET;
const PORT = process.env.PORT || 3001;

// 静态文件服务（前端）
app.use(express.static('frontend'));

// 调试：查看 S3 所有文件
app.get('/api/debug', async (req, res) => {
  try {
    const command = new ListObjectsV2Command({ Bucket: BUCKET });
    const data = await s3.send(command);
    res.json(data.Contents || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 获取笔记列表
app.get('/api/notes', async (req, res) => {
  try {
    const command = new ListObjectsV2Command({ Bucket: BUCKET, Prefix: 'notes/' });
    const data = await s3.send(command);
    const files = (data.Contents || [])
      .filter(obj => obj.Key.endsWith('.md'))
      .map(obj => ({
        name: obj.Key.replace('notes/', ''),
        lastModified: obj.LastModified
      }))
      .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    res.json(files);
  } catch (e) {
    console.error('List error:', e);
    res.status(500).json({ error: e.message });
  }
});

// 获取单个笔记
app.get('/api/notes/:filename', async (req, res) => {
  try {
    const key = `notes/${req.params.filename}`;
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const data = await s3.send(command);
    const content = await streamToString(data.Body);
    res.json({ name: req.params.filename, content });
  } catch (e) {
    if (e.name === 'NoSuchKey') {
      res.status(404).json({ error: 'Not found' });
    } else {
      console.error('Get error:', e);
      res.status(500).json({ error: e.message });
    }
  }
});

// 创建笔记
app.post('/api/notes/:filename', async (req, res) => {
  try {
    const key = `notes/${req.params.filename}`;
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: req.body.content || '',
      ContentType: 'text/markdown'
    });
    await s3.send(command);
    res.json({ success: true, name: req.params.filename });
  } catch (e) {
    console.error('Create error:', e);
    res.status(500).json({ error: e.message });
  }
});

// 更新笔记
app.put('/api/notes/:filename', async (req, res) => {
  try {
    const key = `notes/${req.params.filename}`;
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: req.body.content || '',
      ContentType: 'text/markdown'
    });
    await s3.send(command);
    res.json({ success: true });
  } catch (e) {
    console.error('Update error:', e);
    res.status(500).json({ error: e.message });
  }
});

// 删除笔记
app.delete('/api/notes/:filename', async (req, res) => {
  try {
    const key = `notes/${req.params.filename}`;
    const command = new DeleteObjectCommand({ Bucket: BUCKET, Key: key });
    await s3.send(command);
    res.json({ success: true });
  } catch (e) {
    console.error('Delete error:', e);
    res.status(500).json({ error: e.message });
  }
});

function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stream.on('error', reject);
  });
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

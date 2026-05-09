const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
// 固定笔记目录：web-notes/markdown-editor/notes
const NOTES_DIR = path.join(__dirname, 'notes');
// 确保notes目录存在
if (!fs.existsSync(NOTES_DIR)) {
  fs.mkdirSync(NOTES_DIR, { recursive: true });
}

const server = http.createServer((req, res) => {
  // 允许跨域（本地使用）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 1. 静态文件：index.html、css、js
  if (req.url === '/' || req.url === '/index.html') {
    fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
  } else if (req.url.startsWith('/css/') || req.url.startsWith('/js/')) {
    const filePath = path.join(__dirname, req.url);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      const ext = path.extname(req.url);
      const mime = ext === '.css' ? 'text/css' : 'application/javascript';
      res.writeHead(200, { 'Content-Type': `${mime}; charset=utf-8` });
      res.end(data);
    });
  }

  // 2. API：获取所有笔记列表
  else if (req.method === 'GET' && req.url === '/api/notes') {
    fs.readdir(NOTES_DIR, (err, files) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '读取目录失败' }));
        return;
      }
      const mdFiles = files.filter(f => f.endsWith('.md'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mdFiles));
    });
  }

  // 3. API：读取单个笔记内容
  else if (req.method === 'GET' && req.url.startsWith('/api/notes/')) {
    const filename = decodeURIComponent(req.url.replace('/api/notes/', ''));
    const filePath = path.join(NOTES_DIR, filename);
    fs.readFile(filePath, 'utf-8', (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('文件不存在');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' });
      res.end(data);
    });
  }

  // 4. API：保存/新建笔记
  else if (req.method === 'POST' && req.url.startsWith('/api/notes/')) {
    const filename = decodeURIComponent(req.url.replace('/api/notes/', ''));
    const filePath = path.join(NOTES_DIR, filename);
    
    // 读取请求体
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      fs.writeFile(filePath, body, 'utf-8', (err) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('保存失败');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
      });
    });
  }

  // 404
  else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log('========================================');
  console.log('✅ Markdown编辑器已启动，无需授权');
  console.log(`🌐 访问地址: http://localhost:${PORT}`);
  console.log(`📂 笔记目录: ${NOTES_DIR}`);
  console.log('========================================');
});
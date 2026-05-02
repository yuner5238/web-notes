# Web-Notes

一个基于 Web 的 Markdown 笔记编辑器，支持实时预览和云端存储（S3）。

## 功能特性

- **多模式编辑**：源码模式、双栏模式、实时渲染模式
- **实时预览**：所见即所得的编辑体验
- **云端同步**：使用 S3 存储笔记，永不丢失
- **快捷键支持**：Ctrl+S 保存、Ctrl+B 加粗、Ctrl+I 斜体、Ctrl+E 切换模式

## 技术栈

- 前端：原生 JavaScript + CodeMirror 6
- 后端：Express.js
- 存储：AWS S3 (兼容 MinIO)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```env
S3_ENDPOINT=your-s3-endpoint
S3_REGION=us-east-1
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET=your-bucket-name
PORT=3001
```

### 3. 启动服务

```bash
node server.js
```

访问 http://localhost:3001

## 项目结构

```
├── frontend/          # 前端文件
│   └── index.html
├── server.js         # Express 服务器
├── package.json
└── .env              # 环境配置（需自行创建）
```

## API 接口

| 方法   | 路径                    | 说明       |
|--------|-------------------------|------------|
| GET    | /api/notes              | 获取笔记列表 |
| GET    | /api/notes/:filename    | 获取笔记内容 |
| POST   | /api/notes/:filename    | 创建笔记   |
| PUT    | /api/notes/:filename    | 更新笔记   |
| DELETE | /api/notes/:filename    | 删除笔记   |

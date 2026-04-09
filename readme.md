# WebNotes

## 项目简介

Markdown 笔记 + Microsoft To Do 待办清单应用，支持三种编辑模式。

---

## 常用网址

| 平台 | 网址 |
| --- | --- |
| Cloudflare Dashboard | https://dash.cloudflare.com/ |
| GitHub 仓库 | https://github.com/YUNER-CHAN/web-notes |

---

## 项目结构

```
web-notes/
├── frontend/              # Vue 3 前端
│   ├── src/
│   │   ├── App.vue        # 主应用
│   │   ├── components/
│   │   │   ├── NotesPanel.vue  # 笔记面板
│   │   │   └── TodoPanel.vue   # 待办面板
│   │   └── api/           # API 调用
│   ├── dist/              # 构建产物 (部署用)
│   └── package.json
├── server/                # 本地 Node.js 后端
│   ├── index.js
│   └── routes/
│       ├── s3.js          # S3 笔记存储
│       ├── todos.js       # Microsoft To Do
│       └── auth.js        # Azure AD 认证
├── worker/                # 云端后端 (Cloudflare Workers)
│   ├── index.js
│   └── wrangler.toml
├── wrangler.toml          # Pages 配置
└── .github/workflows/     # GitHub Actions
```

---

## 环境要求

| 模式 | 要求 |
| --- | --- |
| 本地 | Node.js 18+、S3 存储服务 |
| 云端 | Cloudflare 账号、Wrangler CLI |

---

## 本地开发

### 架构

| 组件 | 说明 |
| --- | --- |
| 前端 | Vue 3 + Vite，访问 http://localhost:5173 |
| 后端 | Express.js，监听 localhost:3001 |
| 存储 | S3 兼容存储 (Cloudflare R2 / AWS S3 / 兼容服务) |

### 配置

创建 `server/.env` 文件：

```bash
# S3 配置
S3_ENDPOINT=https://your-r2-account.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET=your-bucket
S3_PREFIX=

# Microsoft Graph (待办)
MS_CLIENT_ID=your-azure-app-id
MS_CLIENT_SECRET=your-azure-secret
MS_TENANT_ID=your-tenant-id
```

### 启动

```bash
# 1. 启动后端
cd server
npm install
npm start

# 2. 启动前端 (另一个终端)
cd frontend
npm install
npm run dev

# 3. 访问 http://localhost:5173
```

---

## 云端部署 (Cloudflare Pages + Workers)

### 架构

| 组件 | 说明 |
| --- | --- |
| 前端 | Cloudflare Pages (`https://web-notes.pages.dev`) |
| 后端 | Cloudflare Workers |
| 存储 | Cloudflare R2 (S3 兼容) |

### 部署步骤

#### 1. GitHub 关联 Cloudflare Pages

1. 推送代码到 GitHub
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
3. 进入 **Workers & Pages → 创建应用程序 → Pages → 连接到 Git**
4. 选择 GitHub 仓库和分支 (master)
5. 配置构建设置：
   - **Framework preset**: Vue
   - **Build command**: `npm run build`
   - **Build output directory**: `frontend/dist`
6. 点击 **保存并部署**

#### 2. 配置环境变量

在 Cloudflare Dashboard → Pages → 你的项目 → **设置 → 环境变量** 中添加：

| 变量名 | 说明 |
| --- | --- |
| `S3_ENDPOINT` | R2 端点 URL |
| `S3_REGION` | `auto` |
| `S3_ACCESS_KEY` | R2 API 密钥 |
| `S3_SECRET_KEY` | R2 API 密钥密码 |
| `S3_BUCKET` | R2 存储桶名 |
| `MS_CLIENT_ID` | Azure AD 应用 ID |
| `MS_CLIENT_SECRET` | Azure AD 应用密钥 |
| `MS_TENANT_ID` | Azure AD 租户 ID |

#### 3. 配置 GitHub Secrets

在 GitHub 仓库 **Settings → Secrets** 中添加：

| Secret 名 | 说明 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |

获取方式：
- API Token: Dashboard → 我的个人资料 → API 令牌 → 创建令牌
- Account ID: Dashboard URL 中获取 (dash.cloudflare.com/**account-id**/...)

---

## 环境自动切换

前端根据访问域名自动判断使用哪个后端：

| 访问地址 | API 目标 |
| --- | --- |
| `http://localhost:5173` | 本地后端 (localhost:3001) |
| `https://web-notes.pages.dev` | Cloudflare Worker |

---

## 功能

- [x] Markdown 笔记 CRUD
- [x] 三种编辑模式：源码 / 分栏 / 预览
- [x] 富文本 WYSIWYG 编辑
- [x] Microsoft To Do 集成
- [x] Azure AD 认证
- [x] 暗色主题 (Catppuccin)
- [x] 响应式布局

---

## API 接口

### 笔记

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/notes` | 获取笔记列表 |
| GET | `/api/notes/:key` | 获取笔记内容 |
| POST | `/api/notes` | 创建笔记 |
| PUT | `/api/notes/:key` | 保存笔记 |
| DELETE | `/api/notes/:key` | 删除笔记 |

### 待办

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/todos/lists` | 获取待办清单列表 |
| GET | `/api/todos/:listId/tasks` | 获取任务列表 |
| POST | `/api/todos/:listId/tasks` | 创建任务 |
| PATCH | `/api/todos/:listId/tasks/:taskId` | 更新任务状态 |
| DELETE | `/api/todos/:listId/tasks/:taskId` | 删除任务 |

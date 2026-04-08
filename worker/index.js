/**
 * WebNotes Cloudflare Worker 后端
 * 处理笔记 API (S3) 和待办 API (Microsoft Graph)
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // 路由分发
    if (url.pathname.startsWith('/api/notes')) {
      return handleNotes(request, env);
    }
    if (url.pathname.startsWith('/api/todos')) {
      return handleTodos(request, env);
    }
    if (url.pathname.startsWith('/api/auth')) {
      return handleAuth(request, env);
    }

    // 首页重定向到前端
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response('Frontend deployed at Cloudflare Pages', {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};

// ── 笔记 API (S3) ─────────────────────────────────────────────────────────────

async function handleNotes(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/notes', '');
  const method = request.method;

  // S3 配置（从环境变量读取）
  const s3Config = {
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION || 'auto',
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
  };
  const bucket = env.S3_BUCKET;
  const prefix = env.S3_PREFIX || '';

  // 使用 Cloudflare Workers 的 fetch（需要 S3 兼容 API 支持）
  const s3Url = `${s3Config.endpoint}/${bucket}${path}${url.search}`;

  try {
    const s3Request = new Request(s3Url, {
      method,
      headers: {
        ...Object.fromEntries(request.headers),
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        // 注意：需要实现 AWS 签名才能访问 S3
      },
      body: method !== 'GET' && method !== 'HEAD' ? await request.text() : undefined,
    });

    // 由于 S3 签名复杂，建议使用 R2 或配置预签名 URL
    // 这里返回提示信息
    return jsonResponse({
      error: 'S3 API requires implementation',
      hint: 'Use Cloudflare R2 with compatible API or configure presigned URLs',
    }, 501);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

// ── 待办 API (Microsoft Graph) ───────────────────────────────────────────────

async function handleTodos(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/todos', '');
  const method = request.method;

  const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

  // 获取 Microsoft 访问令牌（简化版，实际需要 OAuth 流程）
  let accessToken = null;
  if (env.MS_CLIENT_ID && env.MS_CLIENT_SECRET && env.MS_TENANT_ID) {
    // 这里需要实现 OAuth 2.0 客户端凭据流程
    accessToken = 'TODO: Implement MSAL token acquisition';
  }

  if (!accessToken) {
    // 返回演示数据
    return jsonResponse({
      value: [
        { id: 'demo-1', displayName: '待办清单', isOwner: true },
      ]
    });
  }

  try {
    const graphUrl = GRAPH_BASE + '/me/todo' + path + url.search;
    const response = await fetch(graphUrl, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: method !== 'GET' && method !== 'HEAD' ? await request.text() : undefined,
    });

    const data = await response.json();
    return jsonResponse(data, response.status);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

// ── 认证 API ──────────────────────────────────────────────────────────────────

async function handleAuth(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/auth', '');

  if (path === '/status') {
    // 返回认证状态
    return jsonResponse({ authenticated: false, demo: true });
  }

  if (path === '/login') {
    // 引导到 Microsoft 登录
    const loginUrl = `https://login.microsoftonline.com/${env.MS_TENANT_ID}/oauth2/v2.0/authorize?client_id=${env.MS_CLIENT_ID}&response_type=code&redirect_uri=${url.origin}/api/auth/callback&scope=openid profile email`;
    return Response.redirect(loginUrl, 302);
  }

  if (path === '/logout') {
    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: 'Unknown auth endpoint' }, 404);
}

// ── 工具函数 ─────────────────────────────────────────────────────────────────

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

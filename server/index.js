require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const s3Router = require('./routes/s3');
const todoRouter = require('./routes/todos');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cookieParser());
app.use(cors({ origin: 'http://localhost:' + PORT, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/notes', s3Router);
app.use('/api/todos', todoRouter);
app.use('/api/auth', authRouter);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Serve frontend static files
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log('[Server] running on http://localhost:' + PORT);
});

/**
 * Simple Express server that proxies API requests to the FastAPI backend
 * This is a minimal version to ensure basic functionality
 */
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const next = require('next');

// Environment setup
const dev = process.env.NODE_ENV !== 'production';
const port = process.env.PORT || 3001;

// Get API URL from environment or use a safe default
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001';
console.log(`Using API URL: ${API_URL}`);

// Initialize Next.js
const app = next({ dev });
const handle = app.getRequestHandler();

// Prepare and start the server
app.prepare().then(() => {
  const server = express();
  
  // Basic request logging
  server.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
  
  // Health check endpoint
  server.get('/health-check', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  
  // API proxy middleware
  server.use('/api', createProxyMiddleware({
    target: API_URL,
    changeOrigin: true,
    pathRewrite: { '^/api': '/api' },
    onError: (err, req, res) => {
      console.error(`Proxy error: ${err.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API Proxy Error', message: err.message }));
    }
  }));
  
  // All other requests go to Next.js
  server.all('*', (req, res) => {
    return handle(req, res);
  });
  
  // Start server
  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
    console.log(`> API proxy configured to: ${API_URL}`);
  });
}).catch(err => {
  console.error('Error starting server:', err);
  process.exit(1);
});

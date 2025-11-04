/**
 * Minimal server for Next.js built application
 * Linux-compatible version
 */
// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { parse } = require('url');
const next = require('next');

// Environment variables
const port = process.env.PORT || 3001;
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001';
console.log(`Starting server with API URL: ${API_URL}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

// Create Next app instance
const app = next({ 
  dev: false,
  dir: __dirname 
});
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();
  
  // Add basic request logging
  server.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (req.url.startsWith('/api')) {
      console.log('🔍 API request detected, should be proxied...');
    }
    next();
  });
  
  // API proxy for /api/* routes - MUST come before Next.js handler
  console.log(`📡 Setting up proxy: /api -> ${API_URL}`);
  server.use('/api', createProxyMiddleware({
    target: API_URL,
    changeOrigin: true,
    pathRewrite: function(path) {
      // Express strips /api, so we need to add it back
      return '/api' + path;
    },
    logLevel: 'debug',
    onProxyReq: (proxyReq, req, res) => {
      console.log(`[PROXY] ${req.method} ${req.url} -> ${API_URL}${req.url}`);
    },
    onError: (err, req, res) => {
      console.error(`[PROXY ERROR] ${req.url}:`, err.message);
      res.status(500).json({ error: 'Proxy Error', message: err.message });
    }
  }));
  
  // Next.js handles all other routes (non-API)
  server.use((req, res) => {
    try {
      return handle(req, res);
    } catch (err) {
      console.error('Error handling request:', err);
      res.status(500).send('Internal Server Error');
    }
  });
  
  // Start the server
  server.listen(port, err => {
    if (err) throw err;
    // Extract hostname from API_URL for display
    const hostname = API_URL.includes('://') ? new URL(API_URL).hostname : 'localhost';
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Proxying API requests to: ${API_URL}`);
  });
}).catch(err => {
  console.error('Error preparing Next.js app:', err);
  process.exit(1);
});

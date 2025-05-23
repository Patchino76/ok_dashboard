/**
 * Minimal server for Next.js built application
 * Linux-compatible version
 */
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { parse } = require('url');
const next = require('next');

// Environment variables
const port = process.env.PORT || 3001;
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
console.log(`Starting server with API URL: ${API_URL}`);

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
    next();
  });
  
  // API proxy for /api/* routes
  server.use('/api', createProxyMiddleware({
    target: API_URL,
    changeOrigin: true,
    pathRewrite: function(path) {
      return path; // Keep path as is
    },
    logLevel: 'debug'
  }));
  
  // Next.js handles all other routes
  server.get('/*', (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.status(500).send('Internal Server Error');
    }
  });
  
  // Start the server
  server.listen(port, err => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
}).catch(err => {
  console.error('Error preparing Next.js app:', err);
  process.exit(1);
});

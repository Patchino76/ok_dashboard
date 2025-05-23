/**
 * Linux-compatible server with hardcoded environment settings
 */
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { parse } = require('url');
const next = require('next');

// Hardcoded environment variables - UPDATE THESE VALUES
const port = 3001;
const API_URL = 'http://em-m-db4.ellatzite-med.com:8001';

console.log(`Starting server with API URL: ${API_URL}`);
console.log(`Server will run on port: ${port}`);

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
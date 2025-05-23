/**
 * Simple Express server for OK Dashboard
 * Cross-platform compatible version
 */
const express = require('express');
const next = require('next');
const http = require('http');

// Environment setup
const dev = process.env.NODE_ENV !== 'production';
const port = process.env.PORT || 3001;

// Get API URL from environment or use a safe default
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
console.log(`Using API URL: ${API_URL}`);

// Initialize Next.js
const app = next({ dev });
const nextHandler = app.getRequestHandler();

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
  
  // Simple API proxy without using http-proxy-middleware
  server.use('/api', (req, res) => {
    const apiPath = req.url;
    const apiUrl = new URL(apiPath, API_URL);
    
    console.log(`Proxying to: ${apiUrl.toString()}`);
    
    // Forward the request to the API server
    const proxyReq = http.request(
      apiUrl.toString(),
      {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      },
      (proxyRes) => {
        res.statusCode = proxyRes.statusCode;
        
        // Copy headers from the API response
        Object.keys(proxyRes.headers).forEach(key => {
          res.setHeader(key, proxyRes.headers[key]);
        });
        
        // Stream the API response to the client
        proxyRes.pipe(res);
      }
    );
    
    // Handle proxy errors
    proxyReq.on('error', (err) => {
      console.error(`Proxy error: ${err.message}`);
      res.status(500).json({ error: 'API Proxy Error', message: err.message });
    });
    
    // If the original request has a body, forward it
    if (req.body) {
      proxyReq.write(JSON.stringify(req.body));
    }
    
    proxyReq.end();
  });
  
  // All other requests go to Next.js
  server.all('*', (req, res) => {
    return nextHandler(req, res);
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

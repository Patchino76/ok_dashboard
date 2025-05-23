/**
 * Simple static file server for Next.js build on Linux
 */
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const fs = require('fs');

// Hardcoded environment variables
const port = 3001;
const API_URL = 'http://em-m-db4.ellatzite-med.com:8001';

console.log(`Starting server with API URL: ${API_URL}`);
console.log(`Server will run on port: ${port}`);

// Check if build exists
const nextDir = path.join(__dirname, '.next');
if (!fs.existsSync(nextDir)) {
  console.error('Next.js build directory (.next) not found!');
  console.error('Please run: npm run build');
  process.exit(1);
}

// Create Express server
const server = express();

// Add basic request logging
server.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Serve static assets from .next/static
server.use('/_next', express.static(path.join(__dirname, '.next')));
server.use('/static', express.static(path.join(__dirname, 'public/static')));

// API proxy for /api/* routes
server.use('/api', createProxyMiddleware({
  target: API_URL,
  changeOrigin: true,
  pathRewrite: function(path) {
    return path;
  },
  logLevel: 'debug'
}));

// Function to serve HTML files or redirect
const servePageOrRedirect = (req, res) => {
  try {
    // Maps route to HTML file
    let route = req.path;
    if (route === '/') route = '/index';
    
    // Try to find the HTML file
    const htmlFile = path.join(__dirname, '.next/server/pages', `${route}.html`);
    const appHtmlFile = path.join(__dirname, '.next/server/app', `${route}/page.html`);
    
    if (fs.existsSync(htmlFile)) {
      return res.sendFile(htmlFile);
    } else if (fs.existsSync(appHtmlFile)) {
      return res.sendFile(appHtmlFile);
    } else if (route !== '/index') {
      // If not found and not index, try with /page.html
      const pageHtmlFile = path.join(__dirname, '.next/server/app', `${route}/page.html`);
      if (fs.existsSync(pageHtmlFile)) {
        return res.sendFile(pageHtmlFile);
      }
    }
    
    // Fallback to index
    const indexFile = path.join(__dirname, '.next/server/pages/index.html');
    const appIndexFile = path.join(__dirname, '.next/server/app/page.html');
    
    if (fs.existsSync(appIndexFile)) {
      return res.sendFile(appIndexFile);
    } else if (fs.existsSync(indexFile)) {
      return res.sendFile(indexFile);
    } else {
      res.status(404).send('Page not found');
    }
  } catch (err) {
    console.error('Error serving page:', err);
    res.status(500).send('Internal Server Error');
  }
};

// Handle all routes
server.get('*', servePageOrRedirect);

// Start the server
server.listen(port, err => {
  if (err) throw err;
  console.log(`> Ready on http://localhost:${port}`);
});
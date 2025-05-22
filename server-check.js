// Simple Node.js script to test API connectivity
const http = require('http');

// Define API URL - this should point to your FastAPI backend
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001';

// Test endpoint
const testEndpoint = '/api/tag-value/1250';

console.log(`Testing API connection to: ${apiUrl}${testEndpoint}`);

// Parse the URL to get hostname and port
const url = new URL(apiUrl);
const options = {
  hostname: url.hostname,
  port: url.port || (url.protocol === 'https:' ? 443 : 80),
  path: `${testEndpoint}`,
  method: 'GET',
  timeout: 10000, // 10 second timeout
};

console.log(`Request details: ${JSON.stringify(options)}`);

// Make the request
const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response body:');
    try {
      const jsonData = JSON.parse(data);
      console.log(JSON.stringify(jsonData, null, 2));
    } catch (e) {
      console.log(data);
      console.log('Error parsing JSON:', e.message);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
  if (e.code === 'ECONNREFUSED') {
    console.error('Connection refused. The API server might not be running or is not accessible.');
  } else if (e.code === 'EHOSTUNREACH') {
    console.error('Host unreachable. Check network connectivity to the API server.');
  } else if (e.code === 'ETIMEDOUT') {
    console.error('Connection timed out. The API server might be behind a firewall or very slow.');
  }
});

req.on('timeout', () => {
  console.error('Request timed out');
  req.destroy();
});

// End the request
req.end();

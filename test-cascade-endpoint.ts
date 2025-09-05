import axios from 'axios';

async function testCascadeEndpoint() {
  const baseURL = 'http://localhost:8000';
  const url = `${baseURL}/api/v1/cascade/train`;
  
  console.log('Testing cascade training endpoint...');
  console.log(`Base URL: ${baseURL}`);
  console.log(`Full URL: ${url}`);
  
  // First, try to connect to the API root to check if server is running
  try {
    console.log('\n🔍 Checking if API server is running...');
    const healthCheck = await axios.get(`${baseURL}/health`);
    console.log('✅ API server is running!');
    console.log('Health check response:', healthCheck.status, healthCheck.statusText);
  } catch (error: any) {
    console.error('\n❌ Could not connect to API server. Please make sure the server is running.');
    console.error('Run the API server with: python python/api.py');
    console.error('Error details:', error.message);
    return;
  }
  
  const requestData = {
    mill_number: 1,
    start_date: '2023-01-01',
    end_date: '2023-01-31',
    test_size: 0.2,
    resample_freq: '1H'
  };

  console.log(`Testing cascade training endpoint: ${url}`);
  console.log('Request data:', JSON.stringify(requestData, null, 2));

  try {
    const response = await axios.post(url, requestData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('\n✅ Success! Response:');
    console.log('Status:', response.status);
    console.log('Data:', response.data);
  } catch (error: any) {
    console.error('\n❌ Error testing cascade endpoint:');
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
      console.error('Headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received. Is the server running?');
      console.error('Request:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error:', error.message);
    }
    
    console.error('Error config:', error.config);
  }
}

testCascadeEndpoint();

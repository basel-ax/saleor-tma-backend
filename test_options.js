const { handleRequest } = require('./worker/dist/bundled.js');

// Mock request for OPTIONS
const optionsRequest = new Request('http://localhost:8787/graphql', {
  method: 'OPTIONS',
  headers: {}
});

// Mock request for POST with valid init data (using current timestamp)
const futureAuthDate = Math.floor(Date.now() / 1000) - 1000; // 1000 seconds ago
const validInitData = [
  `auth_date=${futureAuthDate}`,
  'hash=test_hash',
  'user={\"id\":\"123456789\",\"first_name\":\"Test\",\"last_name\":\"User\",\"language_code\":\"en\"}',
].join('&');

const postRequest = new Request('http://localhost:8787/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Telegram-Init-Data': validInitData
  },
  body: JSON.stringify({ query: '{ restaurants { id name } }' })
});

console.log('Testing OPTIONS request...');
handleRequest(optionsRequest).then(response => {
  console.log('OPTIONS status:', response.status);
  console.log('OPTIONS headers:', Object.fromEntries(response.headers));
}).catch(err => {
  console.error('OPTIONS error:', err);
});

console.log('Testing POST request...');
handleRequest(postRequest).then(response => {
  console.log('POST status:', response.status);
  console.log('POST headers:', Object.fromEntries(response.headers));
  return response.json();
}).then(data => {
  console.log('POST data:', data);
}).catch(err => {
  console.error('POST error:', err);
});
const http = require('http');
const crypto = require('crypto');

const uniqueEmail = `test_${crypto.randomBytes(4).toString('hex')}@example.com`;

const data = JSON.stringify({
  email: uniqueEmail,
  password: 'Test123456!@#',
  firstName: 'John',
  lastName: 'Doe'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/signup',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    console.log('Email:', uniqueEmail);
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
  });
});

req.on('error', (e) => {
  console.error('Error:', e);
});

req.write(data);
req.end();

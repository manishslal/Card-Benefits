const http = require('http');
const crypto = require('crypto');

let testEmail = `test_${crypto.randomBytes(4).toString('hex')}@example.com`;
let testPassword = 'Test123456!@#';
let sessionCookie = null;
let userId = null;

function makeRequest(method, path, body, cookies = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (cookies) {
      options.headers['Cookie'] = cookies;
    }

    if (body) {
      const data = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        resolve({
          status: res.statusCode,
          body: responseBody,
          setCookie: setCookie
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing Full Auth Flow\n');

  try {
    // 1. Signup
    console.log('1️⃣  Testing Signup...');
    let res = await makeRequest('POST', '/api/auth/signup', {
      email: testEmail,
      password: testPassword,
      firstName: 'Test',
      lastName: 'User'
    });
    console.log('  Status:', res.status, res.status === 201 ? '✅' : '❌');
    if (res.status !== 201) {
      console.log('  Response:', res.body);
      return;
    }
    const signupData = JSON.parse(res.body);
    userId = signupData.userId;
    console.log('  User ID:', userId);
    sessionCookie = res.setCookie ? res.setCookie[0].split(';')[0] : null;
    console.log('  Session Cookie:', sessionCookie ? '✅ Set' : '❌ Missing');

    // 2. Login
    console.log('\n2️⃣  Testing Login...');
    res = await makeRequest('POST', '/api/auth/login', {
      email: testEmail,
      password: testPassword
    });
    console.log('  Status:', res.status, res.status === 200 ? '✅' : '❌');
    if (res.status !== 200) {
      console.log('  Response:', res.body);
      return;
    }
    sessionCookie = res.setCookie ? res.setCookie[0].split(';')[0] : sessionCookie;
    console.log('  Session Cookie:', sessionCookie ? '✅ Set' : '❌ Missing');

    // 3. Get user profile
    console.log('\n3️⃣  Testing Get User Profile...');
    res = await makeRequest('POST', '/api/user/profile', null, sessionCookie);
    console.log('  Status:', res.status, res.status === 200 ? '✅' : '❌');
    if (res.status === 200) {
      const profile = JSON.parse(res.body);
      console.log('  Name:', profile.firstName, profile.lastName);
      console.log('  Email:', profile.email);
    } else {
      console.log('  Response:', res.body);
    }

    // 4. Get available cards
    console.log('\n4️⃣  Testing Get Available Cards...');
    res = await makeRequest('GET', '/api/cards/available', null, sessionCookie);
    console.log('  Status:', res.status, res.status === 200 ? '✅' : '❌');
    if (res.status === 200) {
      const cards = JSON.parse(res.body);
      console.log('  Cards available:', Array.isArray(cards) ? cards.length : 0);
    } else {
      console.log('  Response:', res.body);
    }

    // 5. Logout
    console.log('\n5️⃣  Testing Logout...');
    res = await makeRequest('POST', '/api/auth/logout', {}, sessionCookie);
    console.log('  Status:', res.status, res.status === 200 ? '✅' : '❌');

    console.log('\n✅ Full auth flow test complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

runTests();

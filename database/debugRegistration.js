const http = require('http');

function sendPost(path, payload, token = null) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'POST',
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => resolve({ error: err.message }));
    req.write(postData);
    req.end();
  });
}

async function debug() {
  console.log('--- 1. Testing Auth Login as Super Admin ---');
  const loginRes = await sendPost('/api/v1/auth/login', {
    email: 'superadmin@auracare.com',
    password: 'Clinic2026!'
  });
  console.log('Login Result:', loginRes.status, loginRes.data?.success ? 'Token acquired' : loginRes.data);
  const token = loginRes.data?.data?.token;

  console.log('\n--- 2. Testing POST /api/v1/auth/register with user inputs ---');
  // Exact user payload
  const userPayloads = [
    {
      name: 'Test 2.1: As sent from register.html with simple password',
      payload: {
        full_name: 'Zarnab',
        email: 'shahzarnab796@gmail.com',
        phone: '03212345676',
        gender: 'male',
        date_of_birth: '2005-09-11',
        blood_group: 'A+',
        password: 'password', // Simple password without upper/digit/special
        address: 'Area gate, Gujrat, Punjab, Pakistan'
      }
    },
    {
      name: 'Test 2.2: As sent from register.html with Clinic2026! password',
      payload: {
        full_name: 'Zarnab',
        email: 'shahzarnab796@gmail.com',
        phone: '03212345676',
        gender: 'male',
        date_of_birth: '2005-09-11',
        blood_group: 'A+',
        password: 'Clinic2026!',
        address: 'Area gate, Gujrat, Punjab, Pakistan'
      }
    },
    {
      name: 'Test 2.3: With gender Male (capital M)',
      payload: {
        full_name: 'Zarnab',
        email: 'shahzarnab796@gmail.com',
        phone: '03212345676',
        gender: 'Male',
        date_of_birth: '2005-09-11',
        blood_group: 'A+',
        password: 'Clinic2026!',
        address: 'Area gate, Gujrat, Punjab, Pakistan'
      }
    }
  ];

  for (const t of userPayloads) {
    console.log(`\nTesting ${t.name}:`);
    const res = await sendPost('/api/v1/auth/register', t.payload);
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(res.data, null, 2));
  }

  console.log('\n--- 3. Testing POST /api/v1/patients as Admin ---');
  const adminPatientPayloads = [
    {
      name: 'Test 3.1: Admin sending full_name instead of first_name/last_name',
      payload: {
        full_name: 'Zarnab',
        email: 'shahzarnab796@gmail.com',
        phone: '03212345676',
        gender: 'Male',
        date_of_birth: '2005-09-11',
        blood_group: 'A+',
        address: 'Area gate, Gujrat, Punjab, Pakistan'
      }
    },
    {
      name: 'Test 3.2: Admin sending first_name/last_name with gender Male',
      payload: {
        first_name: 'Zarnab',
        last_name: 'Shah',
        email: 'shahzarnab796@gmail.com',
        phone: '03212345676',
        gender: 'Male',
        date_of_birth: '2005-09-11',
        blood_group: 'A+',
        address: 'Area gate, Gujrat, Punjab, Pakistan'
      }
    }
  ];

  for (const t of adminPatientPayloads) {
    console.log(`\nTesting ${t.name}:`);
    const res = await sendPost('/api/v1/patients', t.payload, token);
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(res.data, null, 2));
  }

  process.exit(0);
}

debug().catch(e => { console.error(e); process.exit(1); });

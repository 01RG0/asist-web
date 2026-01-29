const https = require('https');
const fs = require('fs');

// First login to get token
const loginOptions = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  rejectUnauthorized: false
};

const loginReq = https.request(loginOptions, (res) => {
  console.log('Login Status:', res.statusCode);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('Login Response:', response);

      if (response.success && response.data.token) {
        // Now test the admin users endpoint
        const adminOptions = {
          hostname: 'localhost',
          port: 5000,
          path: '/api/admin/users',
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${response.data.token}`,
            'Content-Type': 'application/json',
          },
          rejectUnauthorized: false
        };

        const adminReq = https.request(adminOptions, (adminRes) => {
          console.log('Admin Users Status:', adminRes.statusCode);

          let adminData = '';
          adminRes.on('data', (chunk) => {
            adminData += chunk;
          });

          adminRes.on('end', () => {
            console.log('Admin Users Response:', adminData);
          });
        });

        adminReq.on('error', (e) => {
          console.error('Admin request error:', e.message);
        });

        adminReq.end();
      }
    } catch (e) {
      console.error('Parse error:', e);
    }
  });
});

loginReq.on('error', (e) => {
  console.error('Login error:', e.message);
});

const loginData = JSON.stringify({
  email: 'admin@example.com',
  password: 'admin123'
});

loginReq.write(loginData);
loginReq.end();

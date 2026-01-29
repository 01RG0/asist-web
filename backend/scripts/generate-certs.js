const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');

console.log('Generating self-signed certificates...');

const attrs = [{ name: 'commonName', value: 'localhost' }];
const pems = selfsigned.generate(attrs, { days: 365 });

fs.writeFileSync(path.join(__dirname, 'key.pem'), pems.private);
fs.writeFileSync(path.join(__dirname, 'cert.pem'), pems.cert);

console.log('✅ Certificates generated successfully:');
console.log('   - key.pem');
console.log('   - cert.pem');

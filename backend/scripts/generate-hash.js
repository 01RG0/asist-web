const bcrypt = require('bcryptjs');

/**
 * Generate bcrypt hashes for test passwords
 * Run: node generate-hash.js
 */

async function generateHashes() {
    console.log('Generating bcrypt hashes...\n');

    // Admin password: Admin@2024
    const adminHash = await bcrypt.hash('Admin@2024', 10);

    // Assistant password: Assistant@2024  
    const assistantHash = await bcrypt.hash('Assistant@2024', 10);

    console.log('====================================');
    console.log('ADMIN CREDENTIALS');
    console.log('====================================');
    console.log('Email: admin@attendance.com');
    console.log('Password: Admin@2024');
    console.log('Hash:');
    console.log(adminHash);

    console.log('\n====================================');
    console.log('ASSISTANT CREDENTIALS');
    console.log('====================================');
    console.log('Email: assistant1@attendance.com');
    console.log('Password: Assistant@2024');
    console.log('Hash:');
    console.log(assistantHash);

    console.log('\n====================================');
    console.log('INSTRUCTIONS');
    console.log('====================================');
    console.log('1. Copy the hashes above');
    console.log('2. Open: database/seed.sql');
    console.log('3. Replace placeholder hashes');
    console.log('4. Run: mysql -u root -p attendance_system < database/seed.sql');
    console.log('====================================\n');
}

generateHashes().catch(console.error);

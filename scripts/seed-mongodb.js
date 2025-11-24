#!/usr/bin/env node

/**
 * Database Seeding Script for MongoDB
 * Creates initial admin account and sample data
 * 
 * Usage: node scripts/seed-mongodb.js
 */

require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import models
const User = require('../backend/models/User');
const Center = require('../backend/models/Center');
const Session = require('../backend/models/Session');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance_system';

async function seedDatabase() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Create default admin account
        console.log('\n📝 Creating default admin account...');
        const adminEmail = 'admin@example.com';
        const adminPassword = 'admin123'; // CHANGE THIS IN PRODUCTION!

        const existingAdmin = await User.findOne({ email: adminEmail });

        if (existingAdmin) {
            console.log('⚠️  Admin account already exists');
        } else {
            const passwordHash = await bcrypt.hash(adminPassword, 10);

            const admin = new User({
                name: 'System Admin',
                email: adminEmail,
                password_hash: passwordHash,
                role: 'admin'
            });

            await admin.save();
            console.log('✅ Admin account created');
            console.log(`   Email: ${adminEmail}`);
            console.log(`   Password: ${adminPassword}`);
            console.log('   ⚠️  IMPORTANT: Change this password in production!');
        }

        // Optionally create sample data
        console.log('\n📍 Checking for sample centers...');
        const centerCount = await Center.countDocuments();

        if (centerCount === 0) {
            console.log('Creating sample centers...');

            const sampleCenters = [
                {
                    name: 'Main Campus Center',
                    latitude: 30.0444,
                    longitude: 31.2357,
                    radius_m: 30,
                    address: 'Cairo, Egypt'
                },
                {
                    name: 'Downtown Branch',
                    latitude: 30.0626,
                    longitude: 31.2497,
                    radius_m: 30,
                    address: 'Downtown Cairo, Egypt'
                }
            ];

            await Center.insertMany(sampleCenters);
            console.log(`✅ Created ${sampleCenters.length} sample centers`);
        } else {
            console.log(`✅ Found ${centerCount} existing centers`);
        }

        console.log('\n✅ Database seeding completed successfully!');
        console.log('\n📊 Summary:');
        console.log(`   - Users: ${await User.countDocuments()}`);
        console.log(`   - Centers: ${await Center.countDocuments()}`);
        console.log(`   - Sessions: ${await Session.countDocuments()}`);

    } catch (error) {
        console.error('\n❌ Error seeding database:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('\n👋 Database connection closed');
        process.exit(0);
    }
}

// Run the seeding
seedDatabase();

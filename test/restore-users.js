const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const User = require('../backend/models/User');

async function restoreUsers() {
    try {
        const uri = process.env.MONGODB_URI;
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');

        const backupPath = path.join(__dirname, '../backend/database/backups/backup_full_20251207_011816.json');
        const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        const backupUsers = backupData.data.users.records;

        console.log(`Found ${backupUsers.length} users in backup.`);

        const currentUsers = await User.find({});
        const currentEmails = new Set(currentUsers.map(u => u.email.toLowerCase()));

        const usersToRestore = backupUsers.filter(bu => !currentEmails.has(bu.email.toLowerCase()));

        console.log(`Preparing to restore ${usersToRestore.length} missing users...`);

        if (usersToRestore.length === 0) {
            console.log('All users from backup are already in the database.');
            process.exit(0);
        }

        // Format dates correctly and handle _id as ObjectId if it's a string, 
        // but Mongoose might handle string ID insertion if we are careful. 
        // Actually, it's safer to just let Mongoose cast them.
        const formattedUsers = usersToRestore.map(u => {
            const doc = { ...u };
            // If the backup has $oid format, we need to convert it, 
            // but the view_file tool showed them as strings in the records array (not $oid sub-objects).
            // Wait, let me double check the JSON structure for IDs.
            return doc;
        });

        const result = await User.insertMany(formattedUsers);
        console.log(`Successfully restored ${result.length} users!`);

        process.exit(0);
    } catch (error) {
        console.error('Restoration error:', error);
        process.exit(1);
    }
}

restoreUsers();

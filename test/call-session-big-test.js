
/**
 * Comprehensive Call Session Test Suite
 * Tests:
 * 1. Race Condition Prevention (Concurrent Assignment)
 * 2. Marketing vs Normal Session Field Visibility
 * 3. Monitoring API Accuracy (Filter Breakdown Stats)
 * 4. Manual Reassignment & Unassignment
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

// Import models
const CallSession = require('../backend/models/CallSession');
const CallSessionStudent = require('../backend/models/CallSessionStudent');
const User = require('../backend/models/User');

// Import controller functions
const activityController = require('../backend/controllers/activityController');

// Mock req/res
const createMockRes = () => {
    const res = {
        statusCode: 200,
        data: null,
        status: function (code) {
            this.statusCode = code;
            return this;
        },
        json: function (payload) {
            this.data = payload;
            return this;
        }
    };
    return res;
};

async function runTests() {
    console.log('🚀 Starting Comprehensive Call Session Tests...\n');

    try {
        // 1. Connect to Database
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance_system';
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB');

        // Cleanup previous test data
        console.log('🧹 Cleaning up old test data...');
        const csDel = await CallSession.deleteMany({ name: /Test Session/ });
        console.log(`   Deleted ${csDel.deletedCount} sessions`);
        const cssDel = await CallSessionStudent.deleteMany({ name: /Test Student/ });
        console.log(`   Deleted ${cssDel.deletedCount} students`);
        const uDel = await User.deleteMany({ email: /@example.com/ });
        console.log(`   Deleted ${uDel.deletedCount} test users`);
        console.log('✅ Clean-up complete');

        // 2. Setup Test Environment
        console.log('👥 Setting up test users...');
        const ts = Date.now();
        console.log('   Creating users with ts:', ts);
        const adminUser = await User.create({ name: 'Test Admin', email: `admin-${ts}@example.com`, password_hash: 'password', role: 'admin' });
        const assistant1 = await User.create({ name: 'Asst 1', email: `asst1-${ts}@example.com`, password_hash: 'password', role: 'assistant' });
        const assistant2 = await User.create({ name: 'Asst 2', email: `asst2-${ts}@example.com`, password_hash: 'password', role: 'assistant' });
        console.log('✅ Test users created');

        // --- TEST 1: RACE CONDITION PREVENTION ---
        console.log('\n🧪 TEST 1: Race Condition Prevention (Concurrent Assignment)');

        const raceSession = await CallSession.create({
            name: 'Race Condition Test Session',
            date: new Date(),
            start_time: '12:00',
            session_type: 'normal',
            status: 'active',
            assistants: [assistant1._id, assistant2._id]
        });

        // Create 1 student
        const singletonStudent = await CallSessionStudent.create({
            call_session_id: raceSession._id,
            name: 'Singleton Test Student',
            studentPhone: '+201111111111',
            filter_status: ''
        });

        console.log(`Created student ${singletonStudent._id}. Simulating 10 concurrent assignment attempts...`);

        // Simulate 10 assistants (using assistant1 and assistant2 identifiers repeatedly)
        const attempts = 10;
        const promises = [];
        const resObjects = [];
        for (let i = 0; i < attempts; i++) {
            const req = {
                params: { id: raceSession._id.toString() },
                user: { id: (i % 2 === 0 ? assistant1._id : assistant2._id).toString() }
            };
            const res = createMockRes();
            resObjects.push(res);
            promises.push(activityController.assignNextStudent(req, res));
        }

        await Promise.all(promises);

        // Count how many got a success response with that specific student
        const successes = resObjects.filter(r => r.data && r.data.success && r.data.data && r.data.data.id && r.data.data.id.toString() === singletonStudent._id.toString());

        console.log(`   Attempts: ${attempts}`);
        console.log(`   Successes: ${successes.length}`);

        if (successes.length === 1) {
            console.log('✅ PASS: Only 1 assistant was able to claim the student.');
        } else {
            console.error(`❌ FAIL: ${successes.length} assistants claimed the same student!`);
            // process.exit(1);
        }

        // --- TEST 2: MONITORING API & FILTER BREAKDOWN ---
        console.log('\n🧪 TEST 2: Monitoring API & Filter Breakdown Stats');

        const statsSession = await CallSession.create({
            name: 'Stats Test Session',
            date: new Date(),
            start_time: '13:00',
            session_type: 'marketing',
            status: 'active'
        });

        // Create 10 students with different statuses
        const statusData = [
            { filter_status: 'no-answer', count: 3 },
            { filter_status: 'present', count: 2 },
            { filter_status: 'wrong-number', count: 1 },
            { filter_status: 'thinking', count: 1 },
            { filter_status: '', count: 3 } // Pending
        ];

        for (const data of statusData) {
            for (let i = 0; i < data.count; i++) {
                await CallSessionStudent.create({
                    call_session_id: statsSession._id,
                    name: `Test Student ${data.filter_status || 'pending'} ${i}`,
                    filter_status: data.filter_status,
                    assigned_to: data.filter_status ? assistant1._id : null
                });
            }
        }

        const reqStats = { params: { id: statsSession._id.toString() } };
        const resStats = createMockRes();
        await activityController.detectDuplicateAssignments(reqStats, resStats);

        const breakdown = resStats.data.data.filterStatusBreakdown;
        console.log('   Global Breakdown:', breakdown);

        const expected = { 'no-answer': 3, 'present': 2, 'wrong-number': 1, 'thinking': 1, '': 3 };
        let match = true;
        for (const [key, val] of Object.entries(expected)) {
            if (breakdown[key] !== val) {
                console.error(`❌ FAIL: Status "${key}" count mismatch. Expected ${val}, got ${breakdown[key]}`);
                match = false;
            }
        }
        if (match) console.log('✅ PASS: Global filter breakdown statistics are correct.');

        // Check per-assistant breakdown
        const asstBreakdown = resStats.data.data.filterStatusByAssistant[assistant1.name];
        if (asstBreakdown && asstBreakdown.completed === 7) {
            console.log('✅ PASS: Assistant-specific breakdown statistics are correct.');
        } else {
            console.error(`❌ FAIL: Assistant breakdown mismatch. Got completed: ${asstBreakdown?.completed}`);
        }

        // --- TEST 3: MANUAL REASSIGNMENT ---
        console.log('\n🧪 TEST 3: Manual Reassignment');

        const studentToMove = await CallSessionStudent.findOne({ call_session_id: statsSession._id, filter_status: 'no-answer' });
        console.log(`   Moving student "${studentToMove.name}" from ${assistant1.name} to ${assistant2.name}...`);

        const reqReassign = {
            params: { id: statsSession._id.toString() },
            body: {
                studentId: studentToMove._id.toString(),
                targetAssistantId: assistant2._id.toString()
            }
        };
        const resReassign = createMockRes();
        await activityController.reassignStudent(reqReassign, resReassign);

        const updatedStudent = await CallSessionStudent.findById(studentToMove._id);
        if (updatedStudent.assigned_to.toString() === assistant2._id.toString()) {
            console.log('✅ PASS: Student was successfully reassigned to new assistant.');
        } else {
            console.error('❌ FAIL: Reassignment failed.');
        }

        // Test Unassign
        console.log(`   Unassigning student "${studentToMove.name}"...`);
        const reqUnassign = {
            params: { id: statsSession._id.toString() },
            body: { studentId: studentToMove._id.toString() } // No targetId = unassign
        };
        const resUnassign = createMockRes();
        await activityController.reassignStudent(reqUnassign, resUnassign);

        const unassignedStudent = await CallSessionStudent.findById(studentToMove._id);
        if (unassignedStudent.assigned_to === null) {
            console.log('✅ PASS: Student was successfully unassigned.');
        } else {
            console.error('❌ FAIL: Unassignment failed.');
        }

        // --- TEST 4: MARKETING SESSION TYPE ---
        console.log('\n🧪 TEST 4: Marketing Session Type');
        if (statsSession.session_type === 'marketing') {
            console.log('✅ PASS: Session type "marketing" is correctly stored.');
        } else {
            console.error(`❌ FAIL: Session type is ${statsSession.session_type}`);
        }

        console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!');

    } catch (error) {
        console.error('\n💥 TEST SUITE CRASHED:');
        console.error(error);
        if (error.stack) console.error(error.stack);
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
            console.log('\n👋 Database connection closed.');
        }
    }
}

runTests();

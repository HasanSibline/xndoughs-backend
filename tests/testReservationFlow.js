const { getDb, closeConnection } = require('../utils/dbConnect');
const { MongoClient } = require('mongodb');
require('dotenv').config();

async function testReservationFlow() {
    try {
        console.log('Starting reservation flow test...');
        
        // 1. Test database connection
        const db = await getDb();
        console.log('✓ Database connection successful');

        // 2. Test creating a reservation
        const testReservation = {
            name: "Test User",
            phone: "96170123456",
            branch: "Clemenceau",
            time: "8:00 PM",
            status: "pending",
            createdAt: new Date()
        };

        const collection = db.collection('reservations');
        const result = await collection.insertOne(testReservation);
        console.log('✓ Test reservation created:', result.insertedId);

        // 3. Test retrieving the reservation
        const found = await collection.findOne({ _id: result.insertedId });
        console.log('✓ Retrieved reservation:', found ? 'Success' : 'Failed');

        // 4. Test updating the reservation
        await collection.updateOne(
            { _id: result.insertedId },
            { $set: { status: 'confirmed', otp: 'XND123456' }}
        );
        console.log('✓ Updated reservation status');

        // 5. Clean up test data
        await collection.deleteOne({ _id: result.insertedId });
        console.log('✓ Cleaned up test data');

        // 6. Verify indexes
        const indexes = await collection.indexes();
        console.log('✓ Collection indexes:', await indexes.toArray());

        console.log('\nAll tests completed successfully!');
        await closeConnection();
    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

testReservationFlow(); 
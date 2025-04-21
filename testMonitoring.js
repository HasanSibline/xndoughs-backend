require('dotenv').config();
const mongoose = require('mongoose');
const DatabaseManager = require('./utils/databaseManager');

async function testMonitoring() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Test monitoring
        const stats = await DatabaseManager.monitorHealth();
        console.log('Monitoring Results:', stats);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

testMonitoring(); 
const { getDb, closeConnection } = require('../utils/dbConnect');

async function testConnection() {
    try {
        const db = await getDb();
        console.log('Connected successfully to database');
        
        // List all collections
        const collections = await db.listCollections().toArray();
        console.log('\nAvailable collections:');
        collections.forEach(collection => {
            console.log(`- ${collection.name}`);
        });

        await closeConnection();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

testConnection(); 
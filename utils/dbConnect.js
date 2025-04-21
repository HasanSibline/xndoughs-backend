const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

let clientInstance = null;

async function connectToDatabase() {
    try {
        if (clientInstance) {
            return clientInstance;
        }

        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("Successfully connected to MongoDB!");
        
        clientInstance = client;
        return client;
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        throw error;
    }
}

async function getDb(dbName = 'xndoughs') {
    const client = await connectToDatabase();
    return client.db(dbName);
}

async function closeConnection() {
    try {
        if (clientInstance) {
            await clientInstance.close();
            clientInstance = null;
            console.log("MongoDB connection closed.");
        }
    } catch (error) {
        console.error("Error closing MongoDB connection:", error);
        throw error;
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    await closeConnection();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await closeConnection();
    process.exit(0);
});

module.exports = {
    connectToDatabase,
    getDb,
    closeConnection
}; 
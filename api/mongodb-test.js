const mongoose = require('mongoose');
const { connectToDatabase } = require('../utils/db');

module.exports = async (req, res) => {
  try {
    await connectToDatabase();
    const connection = mongoose.connection;
    
    // Get connection stats
    const stats = await connection.db.stats();
    
    res.json({
      status: 'ok',
      message: 'MongoDB connection test',
      connection: {
        host: connection.host,
        port: connection.port,
        name: connection.name,
        readyState: connection.readyState,
        models: Object.keys(connection.models)
      },
      stats: {
        collections: stats.collections,
        views: stats.views,
        objects: stats.objects,
        avgObjSize: stats.avgObjSize,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
        indexes: stats.indexes,
        indexSize: stats.indexSize
      }
    });
  } catch (error) {
    console.error('MongoDB test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'MongoDB connection test failed',
      error: {
        name: error.name,
        message: error.message
      }
    });
  }
}; 
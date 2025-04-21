const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const DatabaseManager = require('./utils/databaseManager');

// Load environment variables
dotenv.config();

const app = express();

// Enable CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: false
}));

// Parse JSON bodies
app.use(express.json());

// Cached connection
let cachedConnection = null;

const connectToDatabase = async () => {
  if (cachedConnection) {
    return cachedConnection;
  }

  try {
    console.log('Connecting to MongoDB...');
    const connection = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Connected to MongoDB');
    cachedConnection = connection;
    
    // Only initialize monitoring if explicitly enabled
    if (process.env.ENABLE_DB_MONITORING === 'true') {
      console.log('Initializing database monitoring...');
      DatabaseManager.scheduleMaintenanceTasks().catch(err => {
        console.error('Failed to initialize monitoring:', err);
      });
    }
    
    return connection;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

// Reservation Schema
const reservationSchema = new mongoose.Schema({
  name: String,
  phone: String,
  branch: String,
  time: String,
  status: {
    type: String,
    default: 'pending'
  },
  otp: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  cancellationReason: String
});

const Reservation = mongoose.models.Reservation || mongoose.model('Reservation', reservationSchema);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await connectToDatabase();
    res.json({
      status: 'ok',
      message: 'XnDoughs API is running',
      mongodb: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'XnDoughs API is running but database connection failed',
      mongodb: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Root endpoint redirect to health
app.get('/', (req, res) => {
  res.redirect('/api/health');
});

// API root endpoint
app.get('/api', (req, res) => {
  res.json({
    status: 'ok',
    message: 'XnDoughs API root endpoint',
    endpoints: [
      '/api/health',
      '/api/reservations',
      '/api/reservations/:id',
      '/api/mongodb-test'
    ]
  });
});

// MongoDB test endpoint
app.get('/api/mongodb-test', async (req, res) => {
  try {
    await connectToDatabase();
    const connection = mongoose.connection;
    
    // Get connection stats
    const stats = await connection.db.stats();
    
    // Test a simple query
    const testQuery = await Reservation.find().limit(1);
    
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
      },
      testQuery: {
        success: true,
        count: testQuery.length
      }
    });
  } catch (error) {
    console.error('MongoDB test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'MongoDB connection test failed',
      error: {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
});

// Routes
app.get('/api/reservations', async (req, res) => {
  try {
    await connectToDatabase();
    const reservations = await Reservation.find().sort({ createdAt: -1 });
    res.json(reservations);
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/reservations', async (req, res) => {
  try {
    console.log('Received reservation request:', {
      body: req.body,
      headers: req.headers,
      method: req.method,
      url: req.url
    });
    
    await connectToDatabase();
    const reservation = new Reservation(req.body);
    
    console.log('Created reservation object:', reservation);
    
    const savedReservation = await reservation.save();
    console.log('Saved reservation:', savedReservation);
    
    res.status(201).json(savedReservation);
  } catch (error) {
    console.error('Error creating reservation:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    res.status(400).json({ 
      message: error.message,
      type: error.name,
      code: error.code 
    });
  }
});

app.put('/api/reservations/:id', async (req, res) => {
  try {
    await connectToDatabase();
    const updatedReservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedReservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    res.json(updatedReservation);
  } catch (error) {
    console.error('Error updating reservation:', error);
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/reservations/:id', async (req, res) => {
  try {
    await connectToDatabase();
    const deletedReservation = await Reservation.findByIdAndDelete(req.params.id);
    if (!deletedReservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    res.json({ message: 'Reservation deleted successfully' });
  } catch (error) {
    console.error('Error deleting reservation:', error);
    res.status(500).json({ message: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Handle OPTIONS requests
app.options('*', cors());

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export the Express API
module.exports = app; 
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Enable CORS
app.use(cors());
app.use(express.json());

// Cached connection
let cachedConnection = null;

const connectToDatabase = async () => {
  if (cachedConnection) {
    console.log('Using cached database connection');
    return cachedConnection;
  }

  try {
    console.log('Connecting to MongoDB...');
    const connection = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      bufferCommands: false,
    });

    console.log('Connected to MongoDB');
    cachedConnection = connection;
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
  pickupTime: String,
  status: {
    type: String,
    default: 'pending'
  },
  otp: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Reservation = mongoose.models.Reservation || mongoose.model('Reservation', reservationSchema);

// Health check endpoint
app.get('/', async (req, res) => {
  try {
    await connectToDatabase();
    res.json({
      status: 'ok',
      message: 'XnDoughs API is running',
      mongodb: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({
      status: 'error',
      message: 'XnDoughs API is running but database connection failed',
      mongodb: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
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
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/reservations', async (req, res) => {
  try {
    await connectToDatabase();
    const reservation = new Reservation(req.body);
    const savedReservation = await reservation.save();
    res.status(201).json(savedReservation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.put('/api/reservations/:id', async (req, res) => {
  try {
    await connectToDatabase();
    const { id } = req.params;
    const updatedReservation = await Reservation.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );
    res.json(updatedReservation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get reservations by status
app.get('/api/reservations/status/:status', async (req, res) => {
  try {
    await connectToDatabase();
    const { status } = req.params;
    const reservations = await Reservation.find({ status }).sort({ createdAt: -1 });
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get reservations by branch
app.get('/api/reservations/branch/:branch', async (req, res) => {
  try {
    await connectToDatabase();
    const { branch } = req.params;
    const reservations = await Reservation.find({ branch }).sort({ createdAt: -1 });
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete old reservations
app.delete('/api/reservations/old', async (req, res) => {
  try {
    await connectToDatabase();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    await Reservation.deleteMany({
      createdAt: { $lt: thirtyDaysAgo },
      status: { $in: ['confirmed', 'cancelled'] }
    });
    
    res.json({ message: 'Old reservations deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
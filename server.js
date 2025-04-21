const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Enable CORS with specific options
app.use(cors({
  origin: ['https://xndoughs.quantumbytech.com', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Origin'],
  credentials: true
}));

// Handle preflight requests
app.options('*', cors());

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use(express.json());

// Add error handling for JSON parsing
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ message: 'Invalid JSON payload' });
  }
  next();
});

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
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    validate: {
      validator: function(v) {
        return /^961\d{7,8}$/.test(v);
      },
      message: props => `${props.value} is not a valid Lebanese phone number!`
    }
  },
  branch: {
    type: String,
    required: [true, 'Branch is required'],
    enum: ['Clemenceau', 'Jal El Dib', 'Kfarehbeb', 'Bliss']
  },
  time: {
    type: String,
    required: [true, 'Pickup time is required']
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'pending'
  },
  otp: String,
  cancellationReason: {
    type: String,
    enum: ['customer_changed_mind', 'no_show', 'duplicate_order', 'store_capacity', 'technical_issue', 'other']
  },
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
    
    console.log('Received reservation request:', req.body);
    
    // Validate required fields
    const { name, phone, branch, time } = req.body;
    if (!name || !phone || !branch || !time) {
      console.error('Missing required fields:', { name, phone, branch, time });
      return res.status(400).json({ 
        message: 'Missing required fields',
        details: {
          name: !name ? 'Name is required' : null,
          phone: !phone ? 'Phone is required' : null,
          branch: !branch ? 'Branch is required' : null,
          time: !time ? 'Time is required' : null
        }
      });
    }

    // Create and save the reservation
    const reservation = new Reservation(req.body);
    const savedReservation = await reservation.save();
    
    console.log('Reservation created successfully:', savedReservation);
    
    res.status(201).json(savedReservation);
  } catch (error) {
    console.error('Error creating reservation:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Validation error',
        details: Object.values(error.errors).map(err => err.message)
      });
    }
    
    // Handle other errors
    res.status(500).json({ 
      message: 'Error creating reservation',
      error: error.message
    });
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
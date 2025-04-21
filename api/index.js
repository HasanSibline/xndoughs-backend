const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { connectToDatabase } = require('../utils/db');
const { Reservation } = require('../models/reservation');

const app = express();

// Enable CORS
app.use(cors({
  origin: ['https://xndoughs.quantumbytech.com', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Origin'],
  credentials: true
}));

app.use(express.json());

// Health check
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
    res.json({
      status: 'error',
      message: 'XnDoughs API is running but database connection failed',
      mongodb: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get all reservations
app.get('/api/reservations', async (req, res) => {
  try {
    await connectToDatabase();
    const reservations = await Reservation.find().sort({ createdAt: -1 });
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get reservation by ID
app.get('/api/reservations/:id', async (req, res) => {
  try {
    await connectToDatabase();
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    res.json(reservation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Create reservation
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

// Update reservation
app.put('/api/reservations/:id', async (req, res) => {
  try {
    await connectToDatabase();
    const reservation = await Reservation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    res.json(reservation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get reservations by status
app.get('/api/reservations/status/:status', async (req, res) => {
  try {
    await connectToDatabase();
    const reservations = await Reservation.find({ status: req.params.status }).sort({ createdAt: -1 });
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get reservations by branch
app.get('/api/reservations/branch/:branch', async (req, res) => {
  try {
    await connectToDatabase();
    const reservations = await Reservation.find({ branch: req.params.branch }).sort({ createdAt: -1 });
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
    
    const result = await Reservation.deleteMany({
      createdAt: { $lt: thirtyDaysAgo },
      status: { $in: ['confirmed', 'cancelled'] }
    });
    
    res.json({ message: 'Old reservations deleted successfully', count: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = app; 
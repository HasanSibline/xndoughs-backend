const mongoose = require('mongoose');

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

module.exports = { Reservation }; 
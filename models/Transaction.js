const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: [true, 'Book ID is required']
  },
  issueDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: true,
    default: function() {
      const date = new Date();
      date.setDate(date.getDate() + 14); // 14 days loan period
      return date;
    }
  },
  returnDate: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['issued', 'returned', 'overdue'],
    default: 'issued'
  },
  fine: {
    type: Number,
    default: 0,
    min: [0, 'Fine cannot be negative']
  },
  finePaid: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  issuedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Calculate fine per day (₹5 per day overdue)
const FINE_PER_DAY = 5;

// Virtual for days overdue
transactionSchema.virtual('daysOverdue').get(function() {
  if (this.status === 'returned') return 0;
  const today = new Date();
  const due = new Date(this.dueDate);
  if (today <= due) return 0;
  return Math.floor((today - due) / (1000 * 60 * 60 * 24));
});

// Pre-save hook to update status and fine
transactionSchema.pre('save', function(next) {
  const today = new Date();
  if (this.status !== 'returned') {
    if (today > this.dueDate) {
      this.status = 'overdue';
      const daysLate = Math.floor((today - this.dueDate) / (1000 * 60 * 60 * 24));
      this.fine = daysLate * FINE_PER_DAY;
    }
  }
  next();
});

module.exports = mongoose.model('Transaction', transactionSchema);

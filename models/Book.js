const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Book title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  author: {
    type: String,
    required: [true, 'Author name is required'],
    trim: true,
    maxlength: [100, 'Author name cannot exceed 100 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['Fiction', 'Non-Fiction', 'Science', 'Technology', 'History', 'Biography',
           'Self-Help', 'Romance', 'Mystery', 'Fantasy', 'Horror', 'Children', 'Other'],
    default: 'Other'
  },
  isbn: {
    type: String,
    required: [true, 'ISBN is required'],
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  publisher: {
    type: String,
    trim: true
  },
  publishedYear: {
    type: Number,
    min: [1000, 'Invalid year'],
    max: [new Date().getFullYear(), 'Year cannot be in the future']
  },
  totalQuantity: {
    type: Number,
    required: [true, 'Total quantity is required'],
    min: [0, 'Quantity cannot be negative'],
    default: 1
  },
  availableQuantity: {
    type: Number,
    min: [0, 'Available quantity cannot be negative'],
    default: function() { return this.totalQuantity; }
  },
  coverImage: {
    type: String,
    default: null
  },
  language: {
    type: String,
    default: 'English'
  },
  pages: {
    type: Number,
    min: [1, 'Pages must be at least 1']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Text index for search
bookSchema.index({ title: 'text', author: 'text', category: 'text', isbn: 'text' });

module.exports = mongoose.model('Book', bookSchema);

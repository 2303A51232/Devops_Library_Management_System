const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Book = require('../models/Book');
const { protect, adminOnly } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

// Multer config for book cover images
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/covers/'),
  filename: (req, file, cb) => {
    const uniqueName = `book-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// @GET /api/books - Get all books (public)
router.get('/', asyncHandler(async (req, res) => {
  const { search, category, page = 1, limit = 12, sort = '-createdAt' } = req.query;

  const query = { isActive: true };

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { author: { $regex: search, $options: 'i' } },
      { isbn: { $regex: search, $options: 'i' } }
    ];
  }

  if (category && category !== 'all') {
    query.category = category;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const total = await Book.countDocuments(query);
  const books = await Book.find(query)
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit))
    .populate('addedBy', 'name');

  res.json({
    success: true,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    books
  });
}));

// @GET /api/books/:id - Get single book
router.get('/:id', asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id).populate('addedBy', 'name');
  if (!book) {
    return res.status(404).json({ success: false, message: 'Book not found' });
  }
  res.json({ success: true, book });
}));

// @POST /api/books - Add new book (Admin only)
router.post('/', protect, adminOnly, upload.single('coverImage'), asyncHandler(async (req, res) => {
  const bookData = { ...req.body, addedBy: req.user._id };

  if (req.file) {
    bookData.coverImage = `/uploads/covers/${req.file.filename}`;
  }

  // Set availableQuantity equal to totalQuantity on creation
  bookData.availableQuantity = bookData.totalQuantity;

  const book = await Book.create(bookData);
  res.status(201).json({ success: true, message: 'Book added successfully', book });
}));

// @PUT /api/books/:id - Update book (Admin only)
router.put('/:id', protect, adminOnly, upload.single('coverImage'), asyncHandler(async (req, res) => {
  let book = await Book.findById(req.params.id);
  if (!book) {
    return res.status(404).json({ success: false, message: 'Book not found' });
  }

  const updateData = { ...req.body };
  if (req.file) {
    updateData.coverImage = `/uploads/covers/${req.file.filename}`;
  }

  // Adjust availableQuantity if totalQuantity changes
  if (updateData.totalQuantity) {
    const diff = parseInt(updateData.totalQuantity) - book.totalQuantity;
    updateData.availableQuantity = Math.max(0, book.availableQuantity + diff);
  }

  book = await Book.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
  res.json({ success: true, message: 'Book updated successfully', book });
}));

// @DELETE /api/books/:id - Delete book (Admin only)
router.delete('/:id', protect, adminOnly, asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) {
    return res.status(404).json({ success: false, message: 'Book not found' });
  }

  // Soft delete
  await Book.findByIdAndUpdate(req.params.id, { isActive: false });
  res.json({ success: true, message: 'Book deleted successfully' });
}));

// @GET /api/books/categories/list - Get all categories
router.get('/meta/categories', asyncHandler(async (req, res) => {
  const categories = await Book.distinct('category', { isActive: true });
  res.json({ success: true, categories });
}));

module.exports = router;

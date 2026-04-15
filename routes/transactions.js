const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Book = require('../models/Book');
const { protect, adminOnly } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

// @POST /api/transactions/borrow - Borrow a book
router.post('/borrow', protect, asyncHandler(async (req, res) => {
  const { bookId } = req.body;

  const book = await Book.findById(bookId);
  if (!book) {
    return res.status(404).json({ success: false, message: 'Book not found' });
  }

  if (book.availableQuantity <= 0) {
    return res.status(400).json({ success: false, message: 'Book is not available for borrowing' });
  }

  // Check if user already has this book
  const existingTx = await Transaction.findOne({
    userId: req.user._id,
    bookId,
    status: { $in: ['issued', 'overdue'] }
  });

  if (existingTx) {
    return res.status(400).json({ success: false, message: 'You already have this book borrowed' });
  }

  // Check user borrowing limit (max 3 books)
  const activeBorrows = await Transaction.countDocuments({
    userId: req.user._id,
    status: { $in: ['issued', 'overdue'] }
  });

  if (activeBorrows >= 3) {
    return res.status(400).json({ success: false, message: 'Borrowing limit reached (max 3 books)' });
  }

  // Create due date (14 days from now)
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  const transaction = await Transaction.create({
    userId: req.user._id,
    bookId,
    dueDate,
    issuedBy: req.user._id
  });

  // Reduce available quantity
  await Book.findByIdAndUpdate(bookId, { $inc: { availableQuantity: -1 } });

  await transaction.populate([
    { path: 'bookId', select: 'title author coverImage' },
    { path: 'userId', select: 'name email' }
  ]);

  res.status(201).json({
    success: true,
    message: `"${book.title}" borrowed successfully! Due on ${dueDate.toLocaleDateString()}`,
    transaction
  });
}));

// @PUT /api/transactions/return/:id - Return a book
router.put('/return/:id', protect, asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.id).populate('bookId', 'title');

  if (!transaction) {
    return res.status(404).json({ success: false, message: 'Transaction not found' });
  }

  // Verify ownership (user can only return their own, admin can return any)
  if (req.user.role !== 'admin' && transaction.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  if (transaction.status === 'returned') {
    return res.status(400).json({ success: false, message: 'Book already returned' });
  }

  const returnDate = new Date();
  const dueDate = new Date(transaction.dueDate);
  let fine = 0;

  if (returnDate > dueDate) {
    const daysLate = Math.ceil((returnDate - dueDate) / (1000 * 60 * 60 * 24));
    fine = daysLate * 5; // ₹5 per day
  }

  transaction.returnDate = returnDate;
  transaction.status = 'returned';
  transaction.fine = fine;
  await transaction.save();

  // Increase available quantity
  await Book.findByIdAndUpdate(transaction.bookId, { $inc: { availableQuantity: 1 } });

  res.json({
    success: true,
    message: `Book returned successfully${fine > 0 ? `. Fine: ₹${fine}` : ''}`,
    transaction,
    fine
  });
}));

// @GET /api/transactions/my - Get current user's transactions
router.get('/my', protect, asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const query = { userId: req.user._id };
  if (status) query.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const total = await Transaction.countDocuments(query);
  const transactions = await Transaction.find(query)
    .sort('-createdAt')
    .skip(skip)
    .limit(parseInt(limit))
    .populate('bookId', 'title author coverImage category');

  res.json({ success: true, total, transactions });
}));

// @GET /api/transactions - Get all transactions (Admin only)
router.get('/', protect, adminOnly, asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 15, userId } = req.query;
  const query = {};
  if (status) query.status = status;
  if (userId) query.userId = userId;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const total = await Transaction.countDocuments(query);
  const transactions = await Transaction.find(query)
    .sort('-createdAt')
    .skip(skip)
    .limit(parseInt(limit))
    .populate('userId', 'name email')
    .populate('bookId', 'title author isbn coverImage');

  res.json({ success: true, total, transactions });
}));

// @GET /api/transactions/stats - Admin stats
router.get('/admin/stats', protect, adminOnly, asyncHandler(async (req, res) => {
  const [totalIssued, totalOverdue, totalReturned, totalFines] = await Promise.all([
    Transaction.countDocuments({ status: 'issued' }),
    Transaction.countDocuments({ status: 'overdue' }),
    Transaction.countDocuments({ status: 'returned' }),
    Transaction.aggregate([
      { $group: { _id: null, total: { $sum: '$fine' } } }
    ])
  ]);

  res.json({
    success: true,
    stats: {
      totalIssued,
      totalOverdue,
      totalReturned,
      totalFines: totalFines[0]?.total || 0
    }
  });
}));

// @PUT /api/transactions/overdue/update - Update overdue statuses (cron-like)
router.put('/overdue/update', protect, adminOnly, asyncHandler(async (req, res) => {
  const today = new Date();
  const result = await Transaction.updateMany(
    { status: 'issued', dueDate: { $lt: today } },
    { $set: { status: 'overdue' } }
  );
  res.json({ success: true, message: `Updated ${result.modifiedCount} overdue transactions` });
}));

module.exports = router;

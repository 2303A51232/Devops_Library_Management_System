const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Book = require('../models/Book');
const { protect, adminOnly } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');

// @GET /api/users - Get all users (Admin)
router.get('/', protect, adminOnly, asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search } = req.query;
  const query = { role: 'user' };

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const total = await User.countDocuments(query);
  const users = await User.find(query).sort('-createdAt').skip(skip).limit(parseInt(limit));

  // Add active borrow count for each user
  const usersWithBorrows = await Promise.all(users.map(async (user) => {
    const activeBorrows = await Transaction.countDocuments({
      userId: user._id,
      status: { $in: ['issued', 'overdue'] }
    });
    return { ...user.toJSON(), activeBorrows };
  }));

  res.json({ success: true, total, users: usersWithBorrows });
}));

// @GET /api/users/dashboard-stats - Get dashboard stats (Admin)
router.get('/dashboard-stats', protect, adminOnly, asyncHandler(async (req, res) => {
  const [
    totalUsers,
    totalBooks,
    activeTransactions,
    overdueTransactions,
    recentTransactions,
    popularBooks
  ] = await Promise.all([
    User.countDocuments({ role: 'user', isActive: true }),
    Book.countDocuments({ isActive: true }),
    Transaction.countDocuments({ status: 'issued' }),
    Transaction.countDocuments({ status: 'overdue' }),
    Transaction.find({ status: { $in: ['issued', 'overdue'] } })
      .sort('-createdAt')
      .limit(5)
      .populate('userId', 'name email')
      .populate('bookId', 'title author coverImage'),
    Transaction.aggregate([
      { $group: { _id: '$bookId', borrowCount: { $sum: 1 } } },
      { $sort: { borrowCount: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'books', localField: '_id', foreignField: '_id', as: 'book' } },
      { $unwind: '$book' },
      { $project: { title: '$book.title', author: '$book.author', borrowCount: 1, coverImage: '$book.coverImage' } }
    ])
  ]);

  res.json({
    success: true,
    stats: {
      totalUsers,
      totalBooks,
      activeTransactions,
      overdueTransactions,
      recentTransactions,
      popularBooks
    }
  });
}));

// @GET /api/users/:id - Get single user (Admin)
router.get('/:id', protect, adminOnly, asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  const transactions = await Transaction.find({ userId: req.params.id })
    .sort('-createdAt')
    .limit(10)
    .populate('bookId', 'title author isbn');

  res.json({ success: true, user, transactions });
}));

// @PUT /api/users/:id - Update user (Admin)
router.put('/:id', protect, adminOnly, asyncHandler(async (req, res) => {
  const { name, email, role, isActive, phone, address } = req.body;

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { name, email, role, isActive, phone, address },
    { new: true, runValidators: true }
  );

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  res.json({ success: true, message: 'User updated successfully', user });
}));

// @DELETE /api/users/:id - Deactivate user (Admin)
router.delete('/:id', protect, adminOnly, asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  // Check for active borrows
  const activeBorrows = await Transaction.countDocuments({
    userId: req.params.id,
    status: { $in: ['issued', 'overdue'] }
  });

  if (activeBorrows > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot deactivate user with ${activeBorrows} active borrow(s)`
    });
  }

  await User.findByIdAndUpdate(req.params.id, { isActive: false });
  res.json({ success: true, message: 'User deactivated successfully' });
}));

module.exports = router;

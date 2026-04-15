const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');

const User = require('./models/User');
const Book = require('./models/Book');
const Transaction = require('./models/Transaction');

const SAMPLE_BOOKS = [
  { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', category: 'Fiction', isbn: '978-0-7432-7356-5', totalQuantity: 5, description: 'A story of the fabulously wealthy Jay Gatsby and his love for the beautiful Daisy Buchanan.', publishedYear: 1925, pages: 180, publisher: 'Scribner', language: 'English' },
  { title: 'To Kill a Mockingbird', author: 'Harper Lee', category: 'Fiction', isbn: '978-0-06-112008-4', totalQuantity: 4, description: 'The unforgettable novel of a childhood in a sleepy Southern town and the crisis of conscience that rocked it.', publishedYear: 1960, pages: 281, publisher: 'J. B. Lippincott', language: 'English' },
  { title: 'A Brief History of Time', author: 'Stephen Hawking', category: 'Science', isbn: '978-0-553-38016-3', totalQuantity: 3, description: 'From the Big Bang to black holes, from dark matter to a possible Big Crunch.', publishedYear: 1988, pages: 212, publisher: 'Bantam Books', language: 'English' },
  { title: 'Clean Code', author: 'Robert C. Martin', category: 'Technology', isbn: '978-0-13-235088-4', totalQuantity: 6, description: 'A handbook of agile software craftsmanship.', publishedYear: 2008, pages: 431, publisher: 'Prentice Hall', language: 'English' },
  { title: 'Sapiens: A Brief History of Humankind', author: 'Yuval Noah Harari', category: 'History', isbn: '978-0-06-231609-7', totalQuantity: 4, description: 'Explores the ways in which biology and history have defined us and enhanced our understanding of what it means to be human.', publishedYear: 2011, pages: 443, publisher: 'Harper', language: 'English' },
  { title: 'The Alchemist', author: 'Paulo Coelho', category: 'Fiction', isbn: '978-0-06-112241-5', totalQuantity: 7, description: 'A fable about following your dream.', publishedYear: 1988, pages: 163, publisher: 'HarperOne', language: 'English' },
  { title: 'Steve Jobs', author: 'Walter Isaacson', category: 'Biography', isbn: '978-1-4516-4853-9', totalQuantity: 3, description: 'The exclusive biography of Steve Jobs.', publishedYear: 2011, pages: 656, publisher: 'Simon & Schuster', language: 'English' },
  { title: 'Atomic Habits', author: 'James Clear', category: 'Self-Help', isbn: '978-0-7352-1129-2', totalQuantity: 5, description: 'An easy and proven way to build good habits and break bad ones.', publishedYear: 2018, pages: 320, publisher: 'Avery', language: 'English' },
  { title: 'Harry Potter and the Sorcerer\'s Stone', author: 'J.K. Rowling', category: 'Fantasy', isbn: '978-0-439-70818-8', totalQuantity: 8, description: 'A young wizard discovers his magical heritage on his 11th birthday.', publishedYear: 1997, pages: 309, publisher: 'Scholastic', language: 'English' },
  { title: 'The Da Vinci Code', author: 'Dan Brown', category: 'Mystery', isbn: '978-0-385-50420-5', totalQuantity: 4, description: 'A murder in the Louvre Museum and clues in Da Vinci paintings lead to a discovery of a religious mystery.', publishedYear: 2003, pages: 454, publisher: 'Doubleday', language: 'English' },
  { title: 'Dune', author: 'Frank Herbert', category: 'Science', isbn: '978-0-441-17271-9', totalQuantity: 3, description: 'Set in the distant future amidst a feudal interstellar society, Dune tells the story of young Paul Atreides.', publishedYear: 1965, pages: 412, publisher: 'Chilton Books', language: 'English' },
  { title: 'The Lean Startup', author: 'Eric Ries', category: 'Technology', isbn: '978-0-307-88789-4', totalQuantity: 4, description: 'How constant innovation creates radically successful businesses.', publishedYear: 2011, pages: 336, publisher: 'Crown Business', language: 'English' },
];

async function seed() {
  try {
    await connectDB();
    console.log(' Starting database seed...');

    // Clear existing data
    await Promise.all([User.deleteMany({}), Book.deleteMany({}), Transaction.deleteMany({})]);
    console.log(' Cleared existing data');

    // Create admin user
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@library.com',
      password: 'admin123',
      role: 'admin',
      phone: '+91 98765 00001',
      address: 'Library HQ, Mumbai'
    });
    console.log(' Created admin: admin@library.com / admin123');

    // Create sample users
    const users = await User.create([
      { name: 'Alice Johnson', email: 'user@library.com', password: 'user1234', role: 'user', phone: '+91 98765 00002', address: 'Chennai, Tamil Nadu' },
      { name: 'Bob Smith', email: 'bob@library.com', password: 'bob12345', role: 'user', phone: '+91 98765 00003', address: 'Bangalore, Karnataka' },
      { name: 'Carol White', email: 'carol@library.com', password: 'carol123', role: 'user', phone: '+91 98765 00004', address: 'Hyderabad, Telangana' },
    ]);
    console.log(`👥 Created ${users.length} sample users`);

    // Create books
    const booksData = SAMPLE_BOOKS.map(b => ({ ...b, availableQuantity: b.totalQuantity, addedBy: admin._id }));
    const books = await Book.insertMany(booksData);
    console.log(` Created ${books.length} books`);

    // Create sample transactions
    const now = new Date();
    const pastDue = new Date(now); pastDue.setDate(now.getDate() - 5);
    const futureDue = new Date(now); futureDue.setDate(now.getDate() + 10);

    await Transaction.create([
      { userId: users[0]._id, bookId: books[0]._id, dueDate: futureDue, status: 'issued', issuedBy: admin._id },
      { userId: users[0]._id, bookId: books[1]._id, dueDate: pastDue, status: 'overdue', fine: 25, issuedBy: admin._id },
      { userId: users[1]._id, bookId: books[2]._id, dueDate: futureDue, status: 'issued', issuedBy: admin._id },
      { userId: users[2]._id, bookId: books[3]._id, dueDate: new Date(now.getTime() - 20*24*60*60*1000), returnDate: new Date(now.getTime() - 18*24*60*60*1000), status: 'returned', issuedBy: admin._id },
    ]);

    // Adjust available quantities for issued books
    await Book.findByIdAndUpdate(books[0]._id, { $inc: { availableQuantity: -1 } });
    await Book.findByIdAndUpdate(books[1]._id, { $inc: { availableQuantity: -1 } });
    await Book.findByIdAndUpdate(books[2]._id, { $inc: { availableQuantity: -1 } });

    console.log(' Created sample transactions');
    console.log('\n Seed complete!');
    console.log('\n Login credentials:');
    console.log('   Admin:  admin@library.com  / admin123');
    console.log('   User 1: user@library.com   / user1234');
    console.log('   User 2: bob@library.com    / bob12345');
    console.log('   User 3: carol@library.com  / carol123');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  }
}

seed();

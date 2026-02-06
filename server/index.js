require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const adminRoutes = require('./routes/admin'); // NEW
const archiveRoutes = require('./routes/archive');
const entryRoutes = require('./routes/entry');
const searchRoutes = require('./routes/search'); // NEW
const userRoutes = require('./routes/user'); // NEW

// Passport Config
require('./config/passport')(passport);

const app = express();

// 1. Database Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.log('❌ MongoDB Connection Error:', err));

// 2. Basic Middleware
const PORT = process.env.PORT || 3000;
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../client/views'));
app.use(express.static(path.join(__dirname, '../client/public')));
// --- NEW: DISABLE BROWSER CACHING ---
// This prevents the "Back Button" from showing a logged-in page after logout
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});
// 3. Session Setup
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));

// 4. Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// 5. Flash Messages
app.use(flash());

// 6. Global Variables
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.user = req.user || null;
    next();
});

// 7. Routes
const authRoutes = require('./routes/auth');
app.use('/', authRoutes);
app.use('/admin', adminRoutes); // NEW: Access these at /admin/add
app.use('/archive', archiveRoutes);
app.use('/entry', entryRoutes); // NEW: Access these at /entry/add
app.use('/search', searchRoutes);
app.use('/', userRoutes); // NEW: User profile routes

app.get('/', (req, res) => {
    res.render('home');
});

// 8. Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
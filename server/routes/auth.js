const express = require('express');
const router = express.Router(); 
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User'); 
const passport = require('passport');

// --- EMAIL CONFIGURATION ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// --- ROUTES ---

// GET: Login Page
router.get('/login', (req, res) => {
    res.render('login', { user: null });
});

// POST: Handle Login
router.post('/login', (req, res, next) => {
    passport.authenticate('local', {
        successRedirect: '/',       // Where to go if login works
        failureRedirect: '/login',  // Where to go if login fails
        failureFlash: true      
    })(req, res, next);
});

// GET: Register Page
router.get('/register', (req, res) => {
    res.render('register', { user: null });
});

// POST: Handle Registration
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            req.flash('error_msg', 'Email or Username is already registered. Please Login.');
            return res.redirect('/register');
        }

        // Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Generate Token
        const token = crypto.randomBytes(32).toString('hex');

        // Create User
        const newUser = new User({
            username,
            email,
            password: hashedPassword,
            isVerified: false,
            verificationToken: token
        });

        await newUser.save();

        // Send Email
        const verificationLink = `${process.env.BASE_URL}/verify/${token}`;
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Verify your Chilahati Archive Account',
            html: `
                <h3>Welcome to Chilahati Archive!</h3>
                <p>Please click the link below to verify your account:</p>
                <a href="${verificationLink}">Verify My Account</a>
            `
        };

        await transporter.sendMail(mailOptions);

        // Success Message
        res.send(`
            <center style="margin-top:100px; font-family:sans-serif;">
                <h1>Registration Successful!</h1>
                <p>We have sent a verification email to <strong>${email}</strong>.</p>
                <p>Please check your inbox to activate your account.</p>
            </center>
        `);

    } catch (err) {
        console.error(err);
        res.redirect('/register');
    }
});

// GET: Verify Account
router.get('/verify/:token', async (req, res) => {
    try {
        const token = req.params.token;
        const user = await User.findOne({ verificationToken: token });

        if (!user) {
            return res.send('<h1>Invalid or Expired Token</h1>');
        }

        user.isVerified = true;
        user.verificationToken = undefined;
        await user.save();

        req.flash('success_msg', 'Email verified! You can now login.');
        res.redirect('/login');

    } catch (err) {
        console.error(err);
        res.send('<h1>Error verifying account</h1>');
    }
});

// GET: Logout
router.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) { return next(err); }
        req.flash('success_msg', 'You are logged out');
        res.redirect('/login');
    });
});

module.exports = router;
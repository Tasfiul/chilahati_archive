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
        const baseUrl = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');
        const verificationLink = `${baseUrl}/verify/${token}`;

        console.log(`DEBUG: Registration successful for ${email}`);
        console.log(`DEBUG: Generated Token: ${token}`);
        console.log(`DEBUG: Verification Link: ${verificationLink}`);

        const mailOptions = {
            from: `"Chilahati Archive Admin" <${process.env.EMAIL_USER}>`,
            to: email,
            replyTo: process.env.EMAIL_USER,
            priority: 'high',
            subject: 'Confirm your Chilahati Archive account',
            text: `Hi,\n\nWelcome to Chilahati Archive! Please verify your account by clicking the link below:\n\nVerification link: ${verificationLink}\n\nBest regards,\nThe Chilahati Archive Team`,
            html: `
                <p>Hi,</p>
                <p>Welcome to Chilahati Archive! Please verify your account by <strong><a href="${verificationLink}">clicking here</a></strong>.</p>
                <p>Best regards,<br>The Chilahati Archive Team</p>
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
        console.log(`DEBUG: Verification attempt with token: ${token}`);

        const user = await User.findOne({ verificationToken: token });

        if (!user) {
            console.log(`DEBUG: No user found for token: ${token}`);
            return res.send('<h1>Invalid or Expired Token</h1><p>We could not find a user associated with this verification link. It may have expired or already been used.</p>');
        }

        console.log(`DEBUG: User found: ${user.email}. Mark as verified.`);

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
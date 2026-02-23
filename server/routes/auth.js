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
    passport.authenticate('local', async (err, user, info) => {
        if (err) return next(err);

        if (!user) {
            if (info.message === 'NOT_VERIFIED') {
                // Handle unverified user re-verification
                try {
                    const email = req.body.email;
                    const foundUser = await User.findOne({ email });

                    if (foundUser) {
                        const token = crypto.randomBytes(32).toString('hex');
                        foundUser.verificationToken = token;
                        foundUser.createdAt = Date.now(); // Reset expiration
                        await foundUser.save();

                        const baseUrl = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');
                        const verificationLink = `${baseUrl}/verify/${token}`;

                        const mailOptions = {
                            from: `"Chilahati Archive Admin" <${process.env.EMAIL_USER}>`,
                            to: email,
                            subject: 'Verify your Chilahati Archive account',
                            html: `<p>Please verify your account by <strong><a href="${verificationLink}">clicking here</a></strong>. This link expires in 1 hour.</p>`
                        };

                        await transporter.sendMail(mailOptions);
                        req.flash('error_msg', 'Your account is not verified. A new verification link has been sent to your email.');
                    }
                } catch (mailErr) {
                    console.error('Re-verification email failed:', mailErr);
                    req.flash('error_msg', 'Account not verified. Also failed to send a new link. Please contact support.');
                }
                return res.redirect('/login');
            }
            req.flash('error', info.message);
            return res.redirect('/login');
        }

        req.logIn(user, (err) => {
            if (err) return next(err);
            return res.redirect('/');
        });
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
            if (!existingUser.isVerified) {
                // If unverified, re-send verification email and notify
                const token = crypto.randomBytes(32).toString('hex');
                existingUser.verificationToken = token;
                existingUser.createdAt = Date.now();
                await existingUser.save();

                const baseUrl = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');
                const verificationLink = `${baseUrl}/verify/${token}`;

                try {
                    await transporter.sendMail({
                        from: `"Chilahati Archive Admin" <${process.env.EMAIL_USER}>`,
                        to: email,
                        subject: 'Confirm your Chilahati Archive account',
                        html: `<p>An unverified account already exists. Please <strong><a href="${verificationLink}">click here</a></strong> to verify. Expires in 1 hour.</p>`
                    });
                    req.flash('success_msg', 'An unverified account with this email/username already exists. A new verification link has been sent to your inbox.');
                    return res.redirect('/register');
                } catch (err) {
                    req.flash('error_msg', 'Account exists but is unverified, and we failed to send a new link. Please try again later.');
                    return res.redirect('/register');
                }
            }
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
                <p><strong>Note:</strong> This link will expire in 1 hour.</p>
                <p>Best regards,<br>The Chilahati Archive Team</p>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            // Success Message
            res.send(`
                <center style="margin-top:100px; font-family:sans-serif;">
                    <h1>Registration Successful!</h1>
                    <p>We have sent a verification email to <strong>${email}</strong>.</p>
                    <p>Please check your inbox to activate your account. Link expires in 1 hour.</p>
                </center>
            `);
        } catch (mailErr) {
            console.error('Mail send error:', mailErr);
            // Delete user if email fails
            await User.findByIdAndDelete(newUser._id);
            req.flash('error_msg', 'Failed to send verification email. Please check if your email address is correct and try again.');
            res.redirect('/register');
        }

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
            return res.send('<h1>Invalid Link</h1><p>This verification link is invalid or has already been used.</p>');
        }

        // Check for 1-hour expiration
        const oneHour = 60 * 60 * 1000;
        if (Date.now() - user.createdAt > oneHour) {
            return res.send('<h1>Link Expired</h1><p>Your verification link has expired (1 hour limit). Please try to login or register again to receive a new link.</p>');
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
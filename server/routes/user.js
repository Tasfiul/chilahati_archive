const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Middleware to check if user is authenticated
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash('error_msg', 'Please log in to view this page');
    res.redirect('/login');
};

// GET: User Profile Page
router.get('/profile', ensureAuthenticated, (req, res) => {
    res.render('user/profile', {
        user: req.user
    });
});

// POST: Update Username
router.post('/profile/update-username', ensureAuthenticated, async (req, res) => {
    try {
        const { newUsername, password } = req.body;
        const userId = req.user._id;

        // Validation: Check if fields are provided
        if (!newUsername || !password) {
            req.flash('error_msg', 'Please provide both username and password');
            return res.redirect('/profile');
        }

        // Validation: Check minimum length
        if (newUsername.length < 3) {
            req.flash('error_msg', 'Username must be at least 3 characters long');
            return res.redirect('/profile');
        }

        // Validation: Check maximum length
        if (newUsername.length > 30) {
            req.flash('error_msg', 'Username must be less than 30 characters');
            return res.redirect('/profile');
        }

        // Get current user from database
        const currentUser = await User.findById(userId);

        if (!currentUser) {
            req.flash('error_msg', 'User not found');
            return res.redirect('/profile');
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, currentUser.password);
        if (!isMatch) {
            req.flash('error_msg', 'Incorrect password');
            return res.redirect('/profile');
        }

        // Check if new username is the same as current
        if (newUsername === currentUser.username) {
            req.flash('error_msg', 'New username is the same as your current username');
            return res.redirect('/profile');
        }

        // Check if username already exists (case-insensitive)
        const existingUser = await User.findOne({
            username: { $regex: new RegExp(`^${newUsername}$`, 'i') },
            _id: { $ne: userId } // Exclude current user
        });

        if (existingUser) {
            req.flash('error_msg', 'Username is already taken');
            return res.redirect('/profile');
        }

        // Update username
        currentUser.username = newUsername;
        await currentUser.save();

        req.flash('success_msg', 'Username updated successfully!');
        res.redirect('/profile');

    } catch (err) {
        console.error('Error updating username:', err);
        req.flash('error_msg', 'An error occurred while updating username');
        res.redirect('/profile');
    }
});

// POST: Change Password
router.post('/profile/change-password', ensureAuthenticated, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmNewPassword } = req.body;
        const userId = req.user._id;

        // Validation: Check if all fields are provided
        if (!currentPassword || !newPassword || !confirmNewPassword) {
            req.flash('error_msg', 'Please fill in all password fields');
            return res.redirect('/profile');
        }

        // Validation: Check if new passwords match
        if (newPassword !== confirmNewPassword) {
            req.flash('error_msg', 'New passwords do not match');
            return res.redirect('/profile');
        }

        // Validation: Check minimum length
        if (newPassword.length < 8) {
            req.flash('error_msg', 'Password must be at least 8 characters long');
            return res.redirect('/profile');
        }

        // Get current user from database
        const currentUser = await User.findById(userId);

        if (!currentUser) {
            req.flash('error_msg', 'User not found');
            return res.redirect('/profile');
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, currentUser.password);
        if (!isMatch) {
            req.flash('error_msg', 'Current password is incorrect');
            return res.redirect('/profile');
        }

        // Check if new password is same as current
        const isSamePassword = await bcrypt.compare(newPassword, currentUser.password);
        if (isSamePassword) {
            req.flash('error_msg', 'New password must be different from current password');
            return res.redirect('/profile');
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password
        currentUser.password = hashedPassword;
        await currentUser.save();

        req.flash('success_msg', 'Password changed successfully!');
        res.redirect('/profile');

    } catch (err) {
        console.error('Error changing password:', err);
        req.flash('error_msg', 'An error occurred while changing password');
        res.redirect('/profile');
    }
});

// GET: Forgot Password Page
router.get('/forgot-password', (req, res) => {
    res.render('user/forgot-password', {
        user: req.user || null
    });
});

// POST: Forgot Password (Send Reset Email)
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        // Find user by email
        const user = await User.findOne({ email });

        if (!user) {
            // For security, don't reveal if email exists
            req.flash('success_msg', 'If that email exists, a password reset link has been sent.');
            return res.redirect('/profile');
        }

        // Generate reset token
        const crypto = require('crypto');
        const resetToken = crypto.randomBytes(32).toString('hex');

        // Save token and expiry (1 hour)
        user.passwordResetToken = resetToken;
        user.passwordResetExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        // Send email
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const resetLink = `${process.env.BASE_URL}/reset-password/${resetToken}`;
        const mailOptions = {
            from: `"Chilahati Archive Admin" <${process.env.EMAIL_USER}>`,
            to: email,
            replyTo: process.env.EMAIL_USER,
            priority: 'high',
            subject: 'Reset your Chilahati Archive password',
            text: `Hi,\n\nYou requested a password reset for your Chilahati Archive account.\n\nPlease reset your password here: ${resetLink}\n\nThis link is valid for 1 hour.\n\nIf you didn't request this, you can safely ignore this email.\n\nBest regards,\nThe Chilahati Archive Team`,
            html: `
                <p>Hi,</p>
                <p>You requested a password reset for your Chilahati Archive account.</p>
                <p>Please <strong><a href="${resetLink}">click here to reset your password</a></strong>.</p>
                <p>This link is valid for 1 hour.</p>
                <p>If you didn't request this, you can safely ignore this email.</p>
                <p>Best regards,<br>The Chilahati Archive Team</p>
            `
        };

        await transporter.sendMail(mailOptions);

        req.flash('success_msg', 'Password reset email sent! Please check your inbox.');

        // Redirect based on authentication status
        if (req.isAuthenticated()) {
            res.redirect('/profile');
        } else {
            res.redirect('/forgot-password');
        }

    } catch (err) {
        console.error('Error sending reset email:', err);
        req.flash('error_msg', 'An error occurred while sending reset email');

        if (req.isAuthenticated()) {
            res.redirect('/profile');
        } else {
            res.redirect('/forgot-password');
        }
    }
});

// GET: Contribute Page
router.get('/contribute', ensureAuthenticated, (req, res) => {
    res.render('user/contribute', {
        user: req.user
    });
});

// POST: Handle Contribution Message
router.post('/contribute', ensureAuthenticated, async (req, res) => {
    try {
        const { message } = req.body;
        const userEmail = req.user.email;
        const username = req.user.username;

        if (!message || message.trim().length === 0) {
            req.flash('error_msg', 'Please enter a message before sending.');
            return res.redirect('/contribute');
        }

        // Email Configuration
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: `"Archive Contributor" <${process.env.EMAIL_USER}>`,
            to: process.env.CONTRIBUTE_RECEIVER_EMAIL,
            replyTo: userEmail,
            priority: 'high',
            subject: `Message from ${username} (${userEmail})`,
            text: `Account: ${username}\nEmail: ${userEmail}\n\nMessage:\n${message}\n\n--- end of message ---`,
            html: `
                <p><strong>Contributor:</strong> ${username} (${userEmail})</p>
                <p><strong>Message:</strong></p>
                <p>${message.replace(/\n/g, '<br>')}</p>
                <hr>
                <p><small>This message was sent via the Chilahati Archive contribution form.</small></p>
            `
        };

        await transporter.sendMail(mailOptions);

        req.flash('success_msg', 'Thank you! Your message has been sent to our team.');
        res.redirect('/contribute');

    } catch (err) {
        console.error('Error sending contribution email:', err);
        req.flash('error_msg', 'An error occurred while sending your message. Please try again later.');
        res.redirect('/contribute');
    }
});

// GET: Reset Password Page
router.get('/reset-password/:token', async (req, res) => {
    try {
        const { token } = req.params;

        // Find user with valid token
        const user = await User.findOne({
            passwordResetToken: token,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            req.flash('error_msg', 'Password reset token is invalid or has expired');
            return res.redirect('/login');
        }

        // Render reset password page
        res.render('user/reset-password', {
            token,
            user: null // Not logged in during password reset
        });

    } catch (err) {
        console.error('Error accessing reset page:', err);
        req.flash('error_msg', 'An error occurred');
        res.redirect('/login');
    }
});

// POST: Reset Password
router.post('/reset-password/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { password, confirmPassword } = req.body;

        // Validation
        if (!password || !confirmPassword) {
            req.flash('error_msg', 'Please fill in all fields');
            return res.redirect(`/reset-password/${token}`);
        }

        if (password !== confirmPassword) {
            req.flash('error_msg', 'Passwords do not match');
            return res.redirect(`/reset-password/${token}`);
        }

        if (password.length < 8) {
            req.flash('error_msg', 'Password must be at least 8 characters long');
            return res.redirect(`/reset-password/${token}`);
        }

        // Find user with valid token
        const user = await User.findOne({
            passwordResetToken: token,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            req.flash('error_msg', 'Password reset token is invalid or has expired');
            return res.redirect('/login');
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Update password and clear reset token
        user.password = hashedPassword;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        req.flash('success_msg', 'Password reset successful! You can now login.');
        res.redirect('/login');

    } catch (err) {
        console.error('Error resetting password:', err);
        req.flash('error_msg', 'An error occurred while resetting password');
        res.redirect('/login');
    }
});

// POST: Delete Account
router.post('/profile/delete-account', ensureAuthenticated, async (req, res) => {
    try {
        const { password } = req.body;
        const userId = req.user._id;

        // Validation: Check if password is provided
        if (!password) {
            req.flash('error_msg', 'Please enter your password to delete your account');
            return res.redirect('/profile');
        }

        // Get current user from database
        const currentUser = await User.findById(userId);

        if (!currentUser) {
            req.flash('error_msg', 'User not found');
            return res.redirect('/profile');
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, currentUser.password);
        if (!isMatch) {
            req.flash('error_msg', 'Incorrect password. Account deletion cancelled.');
            return res.redirect('/profile');
        }

        // Delete the user account
        await User.findByIdAndDelete(userId);

        // Logout the user
        req.logout((err) => {
            if (err) {
                console.error('Error during logout after account deletion:', err);
            }
            req.flash('success_msg', 'Your account has been permanently deleted.');
            res.redirect('/login');
        });

    } catch (err) {
        console.error('Error deleting account:', err);
        req.flash('error_msg', 'An error occurred while deleting your account');
        res.redirect('/profile');
    }
});

module.exports = router;

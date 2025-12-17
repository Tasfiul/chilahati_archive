const LocalStrategy = require('passport-local').Strategy;
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

module.exports = function (passport) {
    passport.use(
        new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
            try {
                // 1. Match User by Email
                const user = await User.findOne({ email: email });

                if (!user) {
                    return done(null, false, { message: 'That email is not registered' });
                }

                // 2. Check if Email is Verified
                if (!user.isVerified) {
                    return done(null, false, { message: 'Please verify your email first. Check your inbox.' });
                }

                // 3. Match Password
                const isMatch = await bcrypt.compare(password, user.password);
                if (isMatch) {
                    return done(null, user); // Success! Return the user
                } else {
                    return done(null, false, { message: 'Password incorrect' });
                }

            } catch (err) {
                console.error(err);
                return done(err);
            }
        })
    );

    // 4. Serialize User
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // 5. Deserialize User
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    });
};
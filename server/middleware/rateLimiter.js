const rateLimit = require('express-rate-limit');

// Simple rate limiter to prevent brute force on sensitive routes
const createLimiter = (windowMs, max, message) => {
    return rateLimit({
        windowMs,
        max,
        message: { message },
        standardHeaders: true,
        legacyHeaders: false,
    });
};

const authLimiter = createLimiter(
    15 * 60 * 1000, // 15 minutes
    20, // Limit each IP to 20 requests per window
    "Too many attempts from this IP, please try again after 15 minutes"
);

module.exports = { authLimiter };

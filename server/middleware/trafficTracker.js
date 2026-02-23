const Traffic = require('../models/Traffic');

const trafficTracker = async (req, res, next) => {
    // 1. Skip assets, API calls, or specific paths to avoid bloating data
    const skipList = ['.css', '.js', '.png', '.jpg', '.jpeg', '.svg', '.woff', '/favicon.ico'];
    if (skipList.some(ext => req.url.includes(ext))) return next();

    // 2. Format today's date
    const today = new Date().toISOString().split('T')[0];
    const userIP = req.ip || req.connection.remoteAddress;

    try {
        // Atomic update: increment views and add IP to set
        const update = { $inc: { views: 1 } };

        // Safety limit: Don't let the IP array grow indefinitely (max 5000 IPs per day)
        // This prevents the 16MB document limit issue in production.
        const currentRecord = await Traffic.findOne({ date: today });
        if (!currentRecord || (currentRecord.ips && currentRecord.ips.length < 5000)) {
            update.$addToSet = { ips: userIP };
        }

        const result = await Traffic.findOneAndUpdate(
            { date: today },
            update,
            { upsert: true, new: true }
        );

        // Update uniqueVisits based on the actual count of IPs stored
        if (result && result.ips) {
            await Traffic.updateOne(
                { date: today },
                { $set: { uniqueVisits: result.ips.length } }
            );
        }
    } catch (err) {
        console.error("Traffic Tracker Error:", err);
    }

    next();
};

module.exports = trafficTracker;

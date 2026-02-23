const Traffic = require('../models/Traffic');

const trafficTracker = async (req, res, next) => {
    // 1. Skip assets, API calls, or specific paths to avoid bloating data
    const skipList = ['.css', '.js', '.png', '.jpg', '.jpeg', '.svg', '.woff', '/favicon.ico'];
    if (skipList.some(ext => req.url.includes(ext))) return next();

    // 2. Format today's date
    const today = new Date().toISOString().split('T')[0];
    const userIP = req.ip || req.connection.remoteAddress;

    try {
        // 3. Update or Create traffic record for today
        let dayTraffic = await Traffic.findOne({ date: today });

        if (!dayTraffic) {
            dayTraffic = new Traffic({
                date: today,
                views: 1,
                uniqueVisits: 1,
                ips: [userIP]
            });
        } else {
            dayTraffic.views += 1;

            // Check if IP is unique for today
            if (!dayTraffic.ips.includes(userIP)) {
                dayTraffic.uniqueVisits += 1;
                dayTraffic.ips.push(userIP);
            }
        }

        await dayTraffic.save();
    } catch (err) {
        console.error("Traffic Tracker Error:", err);
    }

    next();
};

module.exports = trafficTracker;

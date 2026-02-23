const mongoose = require('mongoose');

const TrafficSchema = new mongoose.Schema({
    date: {
        type: String, // Format: YYYY-MM-DD
        required: true,
        unique: true
    },
    views: {
        type: Number,
        default: 0
    },
    uniqueVisits: {
        type: Number,
        default: 0
    },
    ips: [String] // Store hashed or plain IPs temporarily to count uniques today
}, { timestamps: true });

module.exports = mongoose.model('Traffic', TrafficSchema);

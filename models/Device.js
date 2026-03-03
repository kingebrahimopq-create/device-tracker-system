const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    deviceId: { type: String, unique: true, required: true },
    model: String,
    os: String,
    manufacturer: String,
    firstSeen: { type: Date, default: Date.now },
    lastCheckin: Date,
    battery: Number,
    network: String,
    location: {
        lat: Number,
        lng: Number
    },
    commands: [{
        command: String,
        parameters: Object,
        timestamp: Date,
        status: { type: String, enum: ['pending', 'sent', 'completed', 'failed'], default: 'pending' },
        result: Object,
        executedAt: Date
    }]
});

module.exports = mongoose.model('Device', deviceSchema);
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Configure dotenv
dotenv.config({ path: path.join(__dirname, '../.env') });

const Ride = require('../models/Ride');

async function clearRides() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ride-sharing');
        console.log('Connected to MongoDB');

        const rides = await Ride.find({});
        console.log(`Total rides in database: ${rides.length}`);
        rides.forEach(r => console.log(`ID: ${r._id}, Status: ${r.status}, Passenger: ${r.passengerName}`));

        const activeStatuses = ['searching', 'accepted', 'arrived', 'ongoing'];
        const result = await Ride.updateMany(
            { status: { $in: activeStatuses } },
            { $set: { status: 'cancelled' } }
        );

        console.log(`Successfully cleared ${result.modifiedCount} active rides.`);
        process.exit(0);
    } catch (error) {
        console.error('Error clearing rides:', error);
        process.exit(1);
    }
}

clearRides();

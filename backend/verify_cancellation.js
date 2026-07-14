const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Ride = require('./models/Ride');

dotenv.config();

async function verifyCancellation() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        // Find the most recent ride
        const lastRide = await Ride.findOne().sort({ createdAt: -1 });
        if (!lastRide) {
            console.log("No rides found in DB.");
        } else {
            console.log("LAST RIDE INFO:");
            console.log("ID:", lastRide._id);
            console.log("Status:", lastRide.status);
            console.log("Passenger:", lastRide.passengerName);
            console.log("Driver:", lastRide.driverName || 'N/A');
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

verifyCancellation();

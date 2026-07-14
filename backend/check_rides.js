const mongoose = require('mongoose');
const Ride = require('./models/Ride');
const dotenv = require('dotenv');
dotenv.config();

async function checkRides() {
    try {
        if (!process.env.MONGO_URI) {
            console.error("MONGO_URI not found in .env");
            process.exit(1);
        }
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        const ridesWithMissingPassengerId = await Ride.find({ passenger: { $exists: false } });
        console.log("Rides with missing passenger ID:", ridesWithMissingPassengerId.length);

        const ridesWithMissingDriverId = await Ride.find({ driver: { $exists: false } });
        console.log("Rides with missing driver ID:", ridesWithMissingDriverId.length);

        const ridesWithDriverNameButNoDriverId = await Ride.find({ driver: { $exists: false }, driverName: { $exists: true, $ne: null } });
        console.log("Rides with driver name but no driver ID:", ridesWithDriverNameButNoDriverId.length);

        const totalRides = await Ride.countDocuments();
        console.log("Total rides:", totalRides);

        const ridesWithCommonNames = await Ride.find({
            $or: [
                { passengerName: "Passenger" },
                { driverName: "Driver" }
            ]
        });
        console.log("Rides with generic names (Passenger/Driver):", ridesWithCommonNames.length);

        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

checkRides();

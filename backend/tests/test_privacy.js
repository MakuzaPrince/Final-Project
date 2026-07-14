const mongoose = require('mongoose');
const Ride = require('../models/Ride');
const User = require('../models/User');
const dotenv = require('dotenv');
dotenv.config();

async function verifyFix() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        // 1. Create two users with the SAME name
        const commonName = "John Doe " + Date.now();
        const userA = await User.create({
            fullName: commonName,
            email: `usera_${Date.now()}@test.com`,
            password: 'password123',
            role: 'passenger'
        });
        const userB = await User.create({
            fullName: commonName,
            email: `userb_${Date.now()}@test.com`,
            password: 'password123',
            role: 'passenger'
        });

        console.log(`Created two users with name: ${commonName}`);
        console.log(`User A ID: ${userA._id}`);
        console.log(`User B ID: ${userB._id}`);

        // 2. Create a ride for User A
        const rideA = await Ride.create({
            passenger: userA._id,
            passengerName: userA.fullName,
            pickupLocation: { type: 'Point', coordinates: [30.06, -1.94], address: "Kigali" },
            destinationLocation: { type: 'Point', coordinates: [30.10, -1.97], address: "Airport" },
            distanceKm: 5,
            baseFare: 2000,
            taxAmount: 200,
            totalFare: 2200,
            status: 'completed'
        });
        console.log(`Created ride for User A (ID: ${rideA._id})`);

        // 3. Mock the query logic from rideRoutes.js for User B
        const queryB = {
            $or: [
                { passenger: userB._id },
                { driver: userB._id }
            ]
        };

        const ridesForB = await Ride.find(queryB);
        console.log(`Found ${ridesForB.length} rides for User B`);

        if (ridesForB.length === 0) {
            console.log("SUCCESS: User B cannot see User A's ride despite having the same name.");
        } else {
            console.error("FAILURE: User B can see rides that don't belong to them!");
            process.exit(1);
        }

        // 4. Verify User A can still see their own ride
        const queryA = {
            $or: [
                { passenger: userA._id },
                { driver: userA._id }
            ]
        };
        const ridesForA = await Ride.find(queryA);
        console.log(`Found ${ridesForA.length} rides for User A`);
        if (ridesForA.length === 1 && ridesForA[0]._id.toString() === rideA._id.toString()) {
            console.log("SUCCESS: User A can still see their own ride.");
        } else {
            console.error("FAILURE: User A cannot see their own ride!");
            process.exit(1);
        }

        // Cleanup
        await Ride.deleteOne({ _id: rideA._id });
        await User.deleteOne({ _id: userA._id });
        await User.deleteOne({ _id: userB._id });
        console.log("Cleanup complete");

        process.exit(0);
    } catch (error) {
        console.error("Error during verification:", error);
        process.exit(1);
    }
}

verifyFix();

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Payment = require('../models/Payment');
const Ride = require('../models/Ride');
const User = require('../models/User');
const paypackService = require('../services/paypackService');

// @desc    Initiate a Paypack MoMo payment (cash-in) for a ride
// @route   POST /api/payments/charge
// @access  Private
router.post('/charge', protect, async (req, res) => {
    const { phone, rideId } = req.body;

    if (!phone) {
        return res.status(400).json({ message: 'Phone number is required.' });
    }

    try {
        let ride;
        if (rideId) {
            // Find specific ride
            ride = await Ride.findById(rideId);
            if (!ride) {
                return res.status(404).json({ message: 'Ride not found.' });
            }
            if (ride.passenger.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: 'Not authorized to pay for this ride.' });
            }
        } else {
            // Find latest completed/ongoing unpaid ride for this user
            ride = await Ride.findOne({
                passenger: req.user._id,
                status: { $in: ['completed', 'ongoing', 'accepted'] },
                paymentStatus: { $in: ['unpaid', 'failed'] }
            }).sort({ createdAt: -1 });

            if (!ride) {
                return res.status(404).json({ message: 'No active or completed unpaid ride found for your account.' });
            }
        }

        const amount = Math.round(Number(ride.totalFare || 0));
        const formattedPhone = paypackService.formatPhoneNumber(phone);

        console.log(`Initiating cash-in of ${amount} RWF for Ride ${ride._id} using phone ${formattedPhone}`);

        // Trigger Paypack MoMo Cash-in API
        const paypackRes = await paypackService.initiateCashin(amount, formattedPhone);

        // Record the payment details in db
        const payment = await Payment.create({
            passenger: req.user._id,
            ride: ride._id,
            amount: amount,
            phone: formattedPhone,
            status: 'pending',
            paypackRef: paypackRes.ref
        });

        // Update ride's payment status and ref
        ride.paymentStatus = 'pending';
        ride.paymentRef = paypackRes.ref;
        await ride.save();

        // Create or update the payment record with the pending status
        let paymentRecord = await Payment.findOne({ ride: ride._id, passenger: req.user._id });
        if (!paymentRecord) {
            paymentRecord = await Payment.create({
                passenger: req.user._id,
                ride: ride._id,
                amount,
                phone: formattedPhone,
                status: 'pending',
                paypackRef: paypackRes.ref
            });
        }

        res.status(200).json({
            success: true,
            message: 'Payment initiated. A push prompt has been sent to your mobile phone.',
            payment
        });

    } catch (error) {
        console.error('Charge API Error:', error);
        res.status(500).json({ message: error.message || 'Server Error initiating payment.' });
    }
});

// @desc    Get the payment transaction status from Paypack & update local schemas
// @route   GET /api/payments/status/:ref
// @access  Private
router.get('/status/:ref', protect, async (req, res) => {
    const { ref } = req.params;

    try {
        const payment = await Payment.findOne({ paypackRef: ref });
        if (!payment) {
            return res.status(404).json({ message: 'Payment record not found.' });
        }

        let paypackStatus = 'pending';

        try {
            // Fetch official status from Paypack API
            const paypackRes = await paypackService.getTransactionStatus(ref);
            paypackStatus = paypackRes.status?.toLowerCase() || paypackRes.data?.status?.toLowerCase();

            // Fallback: If Paypack found the transaction but status field is omitted,
            // the transaction has been successfully processed/completed in Paypack's terminal state.
            if (!paypackStatus && paypackRes.ref) {
                paypackStatus = 'successful';
            }
        } catch (paypackErr) {
            // If Paypack throws an error (e.g., 404/transaction not found), it is still in the pending/processing phase.
            console.log(`Paypack check returned error (treating as pending): ${paypackErr.message}`);
            paypackStatus = 'pending';
        }

        console.log(`Polling status for ${ref}. Resolved status: ${paypackStatus}`);

        // Check terminal states: successful / failed / success
        if (paypackStatus === 'successful' || paypackStatus === 'success') {
            if (payment.status !== 'successful') {
                // Update payment status
                payment.status = 'successful';
                await payment.save();

                // Update Ride payment status
                const ride = await Ride.findById(payment.ride);
                if (ride) {
                    ride.paymentStatus = 'paid';
                    await ride.save();

                    // Credit driver's wallet if a driver is assigned to this ride
                    if (ride.driver) {
                        const driver = await User.findById(ride.driver);
                        if (driver) {
                            driver.walletBalance = (driver.walletBalance || 0) + ride.totalFare;
                            await driver.save();
                            console.log(`Credited ${ride.totalFare} RWF to Driver ${driver.fullName}'s wallet. New Balance: ${driver.walletBalance}`);
                        }
                    }

                    // Send Notifications to Passenger and Driver
                    try {
                        const io = req.app.get('socketio');
                        const { createNotification } = require('../services/notificationService');

                        // 1. Notify Passenger
                        await createNotification(io, {
                            recipient: ride.passenger,
                            title: 'Payment Successful',
                            message: `Your payment of ${ride.totalFare.toLocaleString()} RWF has been received. Thank you!`,
                            type: 'success',
                            category: 'ride',
                            metadata: {
                                rideId: ride._id,
                                link: '/passenger/payment'
                            }
                        });

                        // 2. Notify Driver
                        if (ride.driver) {
                            await createNotification(io, {
                                recipient: ride.driver,
                                title: 'Fare Received',
                                message: `The passenger has successfully paid the fare of ${ride.totalFare.toLocaleString()} RWF. Your wallet has been credited.`,
                                type: 'success',
                                category: 'ride',
                                metadata: {
                                    rideId: ride._id,
                                    link: '/wallet'
                                }
                            });
                        }
                    } catch (notifErr) {
                        console.error('Error dispatching payment notifications:', notifErr.message);
                    }
                }
            }
        } else if (paypackStatus === 'failed' || paypackStatus === 'cancelled') {
            if (payment.status !== 'failed') {
                payment.status = 'failed';
                await payment.save();

                const ride = await Ride.findById(payment.ride);
                if (ride) {
                    ride.paymentStatus = 'failed';
                    await ride.save();

                    // Send failure Notifications to Passenger and Driver
                    try {
                        const io = req.app.get('socketio');
                        const { createNotification } = require('../services/notificationService');

                        // 1. Notify Passenger
                        await createNotification(io, {
                            recipient: ride.passenger,
                            title: 'Payment Failed',
                            message: `Your payment of ${ride.totalFare.toLocaleString()} RWF has failed. Please try again.`,
                            type: 'error',
                            category: 'ride',
                            metadata: {
                                rideId: ride._id,
                                link: '/passenger/payment'
                            }
                        });

                        // 2. Notify Driver
                        if (ride.driver) {
                            await createNotification(io, {
                                recipient: ride.driver,
                                title: 'Fare Payment Failed',
                                message: `The passenger's payment of ${ride.totalFare.toLocaleString()} RWF has failed. Awaiting settlement.`,
                                type: 'error',
                                category: 'ride',
                                metadata: {
                                    rideId: ride._id,
                                    link: '/wallet'
                                }
                            });
                        }
                    } catch (notifErr) {
                        console.error('Error dispatching payment failure notifications:', notifErr.message);
                    }
                }
            }
        }

        res.status(200).json({
            success: true,
            status: payment.status, // Return local status ('pending', 'successful', 'failed')
            payment
        });

    } catch (error) {
        console.error('Status API Error:', error);
        res.status(500).json({ message: error.message || 'Server Error fetching transaction status.' });
    }
});

// @desc    Get passenger's payment history
// @route   GET /api/payments/history
// @access  Private
router.get('/history', protect, async (req, res) => {
    try {
        const payments = await Payment.find({ passenger: req.user._id })
            .populate('ride', 'pickupLocation destinationLocation distanceKm baseFare taxAmount totalFare driverName')
            .sort({ createdAt: -1 });

        res.status(200).json(payments);
    } catch (error) {
        console.error('History API Error:', error);
        res.status(500).json({ message: 'Server Error fetching payment history.' });
    }
});
// @desc    Settle ride via Cash / Direct Mobile Money
// @route   POST /api/payments/cash-settle
// @access  Private
router.post('/cash-settle', protect, async (req, res) => {
    const { rideId } = req.body;
    try {
        const ride = await Ride.findById(rideId);
        if (!ride) {
            return res.status(404).json({ message: 'Ride not found' });
        }

        ride.paymentStatus = 'paid';
        ride.status = 'completed';
        ride.completedAt = Date.now();
        await ride.save();

        const payment = await Payment.findOne({ ride: ride._id, passenger: ride.passenger });
        if (payment && payment.status !== 'successful') {
            payment.status = 'successful';
            await payment.save();
        }

        const io = req.app.get('socketio');

        // Broadcast real-time payment success event to driver and passenger socket rooms
        if (io) {
            if (ride.passenger) io.to(ride.passenger.toString()).emit('paymentSucceeded', { rideId: ride._id, fare: ride.totalFare });
            if (ride.driver) io.to(ride.driver.toString()).emit('paymentSucceeded', { rideId: ride._id, fare: ride.totalFare });
        }

        // Create notification for driver and passenger
        try {
            const { createNotification } = require('../services/notificationService');

            // 1. Notify Passenger
            await createNotification(io, {
                recipient: ride.passenger,
                title: 'Ride Successful',
                message: `Your ride of ${ride.totalFare.toLocaleString()} RWF has been successfully completed and settled via Cash/Direct MoMo. Thank you!`,
                type: 'success',
                category: 'ride',
                metadata: {
                    rideId: ride._id
                }
            });

            // 2. Notify Driver
            if (ride.driver) {
                await createNotification(io, {
                    recipient: ride.driver,
                    title: 'Ride Successful',
                    message: `The passenger has settled the ride fare of ${ride.totalFare.toLocaleString()} RWF via Cash/Direct MoMo. The ride was completed successfully!`,
                    type: 'success',
                    category: 'ride',
                    metadata: {
                        rideId: ride._id
                    }
                });
            }
        } catch (notifErr) {
            console.error('Error dispatching cash settlement notifications:', notifErr.message);
        }

        res.status(200).json({ success: true, message: 'Settled successfully via cash/direct payment.' });
    } catch (error) {
        console.error('Cash Settlement Error:', error);
        res.status(500).json({ message: error.message || 'Server Error settling payment.' });
    }
});

module.exports = router;

const { createNotification } = require('../services/notificationService');
const Ride = require('../models/Ride');

const socketHandler = (io) => {
    // Keep track of active drivers and passengers
    const activeDrivers = new Map();
    const activePassengers = new Map();

    // Helpers — broadcast the full list to the right audience
    const broadcastDriverListToPassengers = () => {
        // Only broadcast drivers that have a valid location so the client-side
        // parseDriverLocation doesn't filter them all out and block state updates.
        const drivers = Array.from(activeDrivers.values()).filter(
            d => d.location && (
                (d.location.coordinates && Array.isArray(d.location.coordinates)) ||
                (d.location.lat !== undefined)
            )
        );
        io.emit('nearbyDrivers', drivers);
    };

    const broadcastPassengerListToDrivers = () => {
        const passengers = Array.from(activePassengers.values());
        io.emit('nearbyPassengers', passengers);
    };

    io.on('connection', (socket) => {

        // ── JOIN ─────────────────────────────────────────────────────────────
        socket.on('join', ({ userId, role, fullName, location }) => {
            socket.join(userId);

            if (role === 'passenger') {
                activePassengers.set(userId, { userId, fullName, socketId: socket.id, location });
                broadcastPassengerListToDrivers();

            } else if (role === 'driver') {
                const existing = activeDrivers.get(userId) || {};
                activeDrivers.set(userId, {
                    ...existing,
                    driverId: userId,
                    fullName: fullName || existing.fullName,
                    location: location || existing.location || null,
                    socketId: socket.id,
                    hasActiveRide: existing.hasActiveRide || false,
                });
                broadcastDriverListToPassengers();
            }

            console.log(`User ${fullName || userId} (${role}) joined`);
        });

        // ── DRIVER ONLINE / OFFLINE ───────────────────────────────────────────
        socket.on('driverOnline', ({ driverId, fullName, location }) => {
            const existing = activeDrivers.get(driverId) || {};
            const driverData = {
                ...existing,
                driverId,
                fullName: fullName || existing.fullName,
                location: location || existing.location,
                socketId: socket.id,
            };
            activeDrivers.set(driverId, driverData);
            // Broadcast single driver update + full updated list
            socket.broadcast.emit('driverAvailable', driverData);
            broadcastDriverListToPassengers();
        });

        socket.on('driverOffline', ({ driverId }) => {
            // Remove driver from active list entirely — they are offline
            activeDrivers.delete(driverId);
            socket.broadcast.emit('driverUnavailable', { driverId });
            broadcastDriverListToPassengers();
        });

        // ── QUERY HANDLERS ────────────────────────────────────────────────────
        socket.on('getPassengers', () => {
            socket.emit('nearbyPassengers', Array.from(activePassengers.values()));
        });

        socket.on('getNearbyPassengers', () => {
            socket.emit('nearbyPassengers', Array.from(activePassengers.values()));
        });

        socket.on('getDrivers', () => {
            const driversWithLocation = Array.from(activeDrivers.values()).filter(
                d => d.location && (
                    (d.location.coordinates && Array.isArray(d.location.coordinates) && d.location.coordinates.length === 2) ||
                    (d.location.lat !== undefined && d.location.lng !== undefined)
                )
            );
            socket.emit('nearbyDrivers', driversWithLocation);
        });

        socket.on('getNearbyDrivers', () => {
            // Only send drivers that have a valid location — avoids cluttering
            // the passenger's map with drivers who haven't gotten a GPS fix yet.
            // Drivers without location will appear as soon as driverOnline/updateLocation fires.
            const driversWithLocation = Array.from(activeDrivers.values()).filter(
                d => d.location && (
                    (d.location.coordinates && d.location.coordinates.length === 2) ||
                    (d.location.lat !== undefined && d.location.lng !== undefined)
                )
            );
            socket.emit('nearbyDrivers', driversWithLocation);
        });

        // ── LOCATION UPDATES ─────────────────────────────────────────────────
        socket.on('updateLocation', ({ userId, role, location, fullName, toUserId }) => {
            if (role === 'driver') {
                const existing = activeDrivers.get(userId) || {};
                const driverData = {
                    ...existing,
                    driverId: userId,
                    fullName: fullName || existing.fullName,
                    location,
                    socketId: socket.id,
                };
                activeDrivers.set(userId, driverData);
                // Broadcast single driver update to passengers
                socket.broadcast.emit('driverAvailable', driverData);

            } else if (role === 'passenger') {
                activePassengers.set(userId, { userId, fullName, location, socketId: socket.id });
                // Broadcast updated passenger list to drivers
                socket.broadcast.emit('nearbyPassengers', Array.from(activePassengers.values()));
            }

            if (toUserId) {
                io.to(toUserId).emit('locationUpdated', { userId, location });
            }
        });

        // ── RIDE REQUEST ──────────────────────────────────────────────────────
        socket.on('requestRide', (rideData) => {
            if (rideData.targetDriverId) {
                // Don't send to a driver who already has an active ride
                const targetDriver = activeDrivers.get(rideData.targetDriverId);
                if (targetDriver?.hasActiveRide) {
                    socket.emit('rideDeclined', {
                        rideId: rideData._id,
                        driverId: rideData.targetDriverId,
                        reason: 'Driver is currently busy with another ride.'
                    });
                    return;
                }
                io.to(rideData.targetDriverId).emit('newRideRequest', rideData);
                createNotification(io, {
                    recipient: rideData.targetDriverId,
                    title: 'New Ride Request',
                    message: `You have a new ride request from ${rideData.passengerName}.`,
                    type: 'info',
                    category: 'ride',
                    metadata: { rideId: rideData._id, link: '/driver/live-map' }
                });
            } else {
                socket.broadcast.emit('newRideRequest', rideData);
            }
            createNotification(io, {
                recipient: rideData.passengerId || rideData.passenger,
                title: 'Request Sent',
                message: rideData.targetDriverId
                    ? `Your ride request has been sent to the driver.`
                    : `Your ride request has been broadcasted to nearby drivers.`,
                type: 'success',
                category: 'ride',
                metadata: { rideId: rideData._id, link: '/passenger/book' }
            });
        });

        // ── CANCELLATION ──────────────────────────────────────────────────────
        socket.on('cancelRideRequest', ({ rideId, targetDriverId }) => {
            if (targetDriverId) {
                io.to(targetDriverId).emit('rideCancelled', { rideId });
            } else {
                socket.broadcast.emit('rideCancelled', { rideId });
            }
        });

        socket.on('cancelActiveRide', ({ rideId, toUserId, cancelledBy, reason }) => {
            // Free the driver to accept new rides
            const driver = Array.from(activeDrivers.values()).find(d => d.socketId === socket.id);
            if (driver) {
                activeDrivers.set(driver.driverId, { ...driver, hasActiveRide: false });
            }

            if (toUserId) {
                io.to(toUserId).emit('activeRideCancelled', { rideId, cancelledBy, reason });
                createNotification(io, {
                    recipient: toUserId,
                    title: 'Ride Cancelled',
                    message: `Your ride has been cancelled by the ${cancelledBy}. Reason: ${reason}`,
                    type: 'warning',
                    category: 'ride',
                    metadata: { rideId, link: '/dashboard' }
                });
            }
        });

        // ── RIDE LIFECYCLE ────────────────────────────────────────────────────
        socket.on('acceptRide', ({ rideId, driverId, driverName, passengerId }) => {
            // Mark driver as having an active ride — prevents new requests being routed to them
            const existing = activeDrivers.get(driverId) || {};
            activeDrivers.set(driverId, { ...existing, hasActiveRide: true });

            io.to(passengerId).emit('rideAccepted', { rideId, driverId, driverName, status: 'accepted' });
            createNotification(io, {
                recipient: passengerId,
                title: 'Ride Accepted',
                message: `Your ride request has been accepted by ${driverName}.`,
                type: 'success',
                category: 'ride',
                metadata: { rideId, link: '/passenger/book' }
            });
        });

        socket.on('declineRide', ({ rideId, driverId, passengerId }) => {
            // Cancel the ride in DB immediately so re-requests don't hit 409
            if (rideId) {
                Ride.findByIdAndUpdate(rideId, { status: 'cancelled' }).catch(() => {});
            }
            if (passengerId) {
                io.to(passengerId).emit('rideDeclined', { rideId, driverId });
            } else {
                socket.broadcast.emit('rideDeclined', { rideId, driverId });
            }
        });

        socket.on('arrivedAtPickup', ({ rideId, passengerId, driverName }) => {
            if (passengerId) {
                io.to(passengerId).emit('driverArrivedAtPickup', { rideId, driverName });
                createNotification(io, {
                    recipient: passengerId,
                    title: 'Driver Arrived',
                    message: `${driverName} has arrived at your pickup location.`,
                    type: 'success',
                    category: 'ride',
                    metadata: { rideId, link: '/passenger/book' }
                });
            }
        });

        socket.on('startRide', ({ rideId, passengerId, driverName, pickup, destination, fare }) => {
            if (passengerId) {
                io.to(passengerId).emit('rideStarted', { rideId, driverName, pickup, destination, fare });
                createNotification(io, {
                    recipient: passengerId,
                    title: 'Ride Started',
                    message: `Your ride to ${destination?.address || 'destination'} has started.`,
                    type: 'info',
                    category: 'ride',
                    metadata: { rideId, link: '/passenger/book' }
                });
            }
        });

        socket.on('completeRide', ({ rideId, passengerId, driverId, driverName, fare, pickup, destination }) => {
            // Mark driver as free — use explicit driverId from payload (not socket.id lookup)
            const driverIdToFree = driverId || Array.from(activeDrivers.values()).find(d => d.socketId === socket.id)?.driverId;
            if (driverIdToFree) {
                const existingDriver = activeDrivers.get(driverIdToFree);
                if (existingDriver) activeDrivers.set(driverIdToFree, { ...existingDriver, hasActiveRide: false });
            }

            if (passengerId) {
                io.to(passengerId).emit('rideCompleted', { rideId, driverName, fare, pickup, destination });
                const finalFare = fare?.totalFare || fare || 0;
                const msg = `Ride completed! Total Fare: ${finalFare.toLocaleString()} RWF.`;
                createNotification(io, {
                    recipient: passengerId,
                    title: 'Ride Completed',
                    message: msg,
                    type: 'success',
                    category: 'ride',
                    metadata: { rideId, link: '/passenger/history' }
                });
                if (driverIdToFree) {
                    createNotification(io, {
                        recipient: driverIdToFree,
                        title: 'Ride Completed',
                        message: msg,
                        type: 'success',
                        category: 'ride',
                        metadata: { rideId, link: '/driver/rides' }
                    });
                }
            }
        });

        // ── SIMULATION RELAY ──────────────────────────────────────────────────
        socket.on('simCarUpdate', ({ toUserId, location, phase, endpoints }) => {
            if (toUserId) io.to(toUserId).emit('simCarUpdate', { location, phase, endpoints });
        });

        socket.on('simPickupReached', ({ toUserId, rideId, driverName }) => {
            if (toUserId) io.to(toUserId).emit('simPickupReached', { rideId, driverName });
        });

        socket.on('simPassengerConfirmed', ({ driverUserId }) => {
            if (driverUserId) io.to(driverUserId).emit('simPassengerConfirmed', {});
        });

        socket.on('simDestinationReached', ({ toUserId, rideId }) => {
            if (toUserId) io.to(toUserId).emit('simDestinationReached', { rideId });
        });

        // ── DISCONNECT ────────────────────────────────────────────────────────
        socket.on('disconnect', () => {
            let changed = false;

            // Remove from activeDrivers and notify passengers
            for (const [id, data] of activeDrivers.entries()) {
                if (data.socketId === socket.id) {
                    activeDrivers.delete(id);
                    socket.broadcast.emit('driverUnavailable', { driverId: id });
                    changed = true;
                    break;
                }
            }
            if (changed) broadcastDriverListToPassengers();

            // Remove from activePassengers and notify drivers
            for (const [id, data] of activePassengers.entries()) {
                if (data.socketId === socket.id) {
                    activePassengers.delete(id);
                    broadcastPassengerListToDrivers();
                    break;
                }
            }
        });
    });
};

module.exports = socketHandler;

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../../../context/SocketContext';
import { useAuth } from '../../../context/AuthContext';
import { useDialog } from '../../../context/DialogContext';
import LeafletMap from '../../../components/Map/LeafletMap';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import {
    Zap,
    Navigation,
    User,
    RotateCw,
    XCircle,
    CheckCircle,
    MapIcon,
    ArrowRight
} from 'lucide-react';

const LiveMap = () => {
    const { user } = useAuth();
    const socket = useSocket();
    const navigate = useNavigate();
    const { showToast, showConfirm, showPrompt } = useDialog();

    // State from Dashboard
    const [isAvailable, setIsAvailable] = useState(() => {
        // Default to true — driver opens LiveMap to work, so start online.
        // They can toggle offline manually. Session value overrides default.
        const stored = sessionStorage.getItem('isDriverAvailable');
        return stored === null ? true : stored === 'true';
    });
    const [rideRequests, setRideRequests] = useState(() => JSON.parse(sessionStorage.getItem('driver_requests')) || []);
    const [activeRide, setActiveRide] = useState(() => JSON.parse(sessionStorage.getItem('driver_activeRide')) || null);
    const [focusedLocation, setFocusedLocation] = useState(null);
    const [currentLocation, setCurrentLocation] = useState(null);
    const [arrivedAtPickup, setArrivedAtPickup] = useState(false);
    const [viewingRide, setViewingRide] = useState(null);
    const [routeLoadedRideId, setRouteLoadedRideId] = useState(null);
    const [isSimulating, setIsSimulating] = useState(false);
    const [nearbyPassengers, setNearbyPassengers] = useState([]);
    const [showPassengersOnMap, setShowPassengersOnMap] = useState(true);
    const [activeTab, setActiveTab] = useState('requests'); // 'requests' or 'passengers'
    const [showCompletionModal, setShowCompletionModal] = useState(false);

    // Simulation states — simCarPosRef bypasses React state for zero re-renders per tick
    const simCarPosRef = useRef(null);
    const [isSimActive, setIsSimActive] = useState(false);
    const [simPhase, setSimPhase] = useState('idle');
    const [simRouteEndpoints, setSimRouteEndpoints] = useState(null);

    const watchIdRef = useRef(null);
    const simulationIntervalRef = useRef(null);
    const isTrackingRef = useRef(false);
    const pendingFocusRef = useRef(false);
    const simWasTrackingRef = useRef(false);
    const activeRideRef = useRef(null);
    const simPhaseRef = useRef('idle');
    const startSimPhase2Ref = useRef(null);
    const isResettingRef = useRef(false);
    // Ref for isAvailable to avoid stale closures in GPS callback
    const isAvailableRef = useRef(isAvailable);
    const socketRef = useRef(socket);
    const userRef = useRef(user);

    // Keep refs in sync with latest state/props
    useEffect(() => { activeRideRef.current = activeRide; }, [activeRide]);
    useEffect(() => { simPhaseRef.current = simPhase; }, [simPhase]);
    useEffect(() => { isAvailableRef.current = isAvailable; }, [isAvailable]);
    useEffect(() => { socketRef.current = socket; }, [socket]);
    useEffect(() => { userRef.current = user; }, [user]);

    // Persistence
    useEffect(() => { sessionStorage.setItem('driver_requests', JSON.stringify(rideRequests)); }, [rideRequests]);
    useEffect(() => { sessionStorage.setItem('driver_activeRide', JSON.stringify(activeRide)); }, [activeRide]);
    useEffect(() => { sessionStorage.setItem('isDriverAvailable', isAvailable); }, [isAvailable]);

    // Socket Listeners
    useEffect(() => {
        if (!socket || !user) return;

        socket.emit('join', { userId: user._id, role: 'driver', fullName: user.fullName });

        if (isAvailable) {
            const loc = currentLocation || (user?.location?.coordinates ? { lat: user.location.coordinates[1], lng: user.location.coordinates[0] } : null);
            if (loc) {
                const geoLoc = { type: 'Point', coordinates: [loc.lng, loc.lat] };
                socket.emit('driverOnline', { driverId: user._id, fullName: user.fullName, location: geoLoc });
            }
            // Even without location yet, register as online so passenger can at least see driver exists
            else {
                socket.emit('driverOnline', { driverId: user._id, fullName: user.fullName, location: null });
            }
        }
        socket.emit('getPassengers');

        const handleNewRequest = (ride) => {
            // Use ref (not closure) so we always read the current availability,
            // even if the effect hasn't re-run yet after a state change.
            if (!isAvailableRef.current) return;

            setRideRequests((prev) => {
                const exists = prev.find(r => r._id === ride._id);
                if (exists) return prev;
                return [...prev, ride];
            });

            setNearbyPassengers(prev => {
                const exists = prev.find(p => p._id === ride.passengerId);
                if (exists) return prev;
                const loc = ride.pickup?.lat
                    ? { lat: ride.pickup.lat, lng: ride.pickup.lng }
                    : ride.pickup?.coordinates
                        ? { lat: ride.pickup.coordinates[1], lng: ride.pickup.coordinates[0] }
                        : null;
                if (!loc) return prev;
                return [...prev, {
                    _id: ride.passengerId,
                    userId: ride.passengerId,
                    fullName: ride.passengerName || 'Passenger',
                    location: loc
                }];
            });
        };

        const handleCancelEvent = ({ rideId }) => {
            setRideRequests(prev => prev.filter(r => r._id !== rideId));
            setViewingRide(prev => prev?._id === rideId ? null : prev);
        };

        const handleActiveRideCancelled = (data) => {
            showToast(`Passenger cancelled the ride.${data.reason ? ` Reason: ${data.reason}` : ''}`, 'warning');
            handleSystemReset(true); // passenger already set to cancelled in DB
        };

        const handleNearbyPassengers = (passengers) => {
            if (!Array.isArray(passengers)) return;
            const processed = passengers.map(p => {
                const loc = p.location?.coordinates
                    ? { lat: p.location.coordinates[1], lng: p.location.coordinates[0] }
                    : p.location;
                return { ...p, _id: p.userId || p._id, location: loc };
            }).filter(p => p.location && p.location.lat);
            setNearbyPassengers(processed);
        };

        const handlePaymentSucceeded = (data) => {
            console.log('DRIVER: Payment succeeded', data);
            setShowCompletionModal(true);
            isResettingRef.current = false;
        };

        socket.on('newRideRequest', handleNewRequest);
        socket.on('rideCancelled', handleCancelEvent);
        socket.on('activeRideCancelled', handleActiveRideCancelled);
        socket.on('nearbyPassengers', handleNearbyPassengers);
        socket.on('paymentSucceeded', handlePaymentSucceeded);

        return () => {
            socket.off('newRideRequest', handleNewRequest);
            socket.off('rideCancelled', handleCancelEvent);
            socket.off('activeRideCancelled', handleActiveRideCancelled);
            socket.off('nearbyPassengers', handleNearbyPassengers);
            socket.off('paymentSucceeded', handlePaymentSucceeded);
        };
    }, [socket, user, isAvailable]);

    // Helpers
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const toLatLng = (l) => {
        if (!l) return null;
        if (typeof l.lat === 'number' && typeof l.lng === 'number') return { lat: l.lat, lng: l.lng };
        if (Array.isArray(l.coordinates)) return { lat: l.coordinates[1], lng: l.coordinates[0] };
        if (l.type === 'Point' && Array.isArray(l.coordinates)) return { lat: l.coordinates[1], lng: l.coordinates[0] };
        return null;
    };

    const getETA = (dist) => Math.ceil(dist * 2.5 + 1);

    const handleRouteFound = useCallback((routeData) => {
        if (routeData && viewingRide) setRouteLoadedRideId(viewingRide._id);
        else if (!routeData) setRouteLoadedRideId(null);
    }, [viewingRide]);

    const handleDeclineRide = (rideId, passengerId) => {
        socket.emit('declineRide', { rideId, driverId: user._id, passengerId });
        setRideRequests(prev => prev.filter(r => r._id !== rideId));
        // Clear the route from the map if this ride was being viewed
        setViewingRide(prev => prev?._id === rideId ? null : prev);
        setRouteLoadedRideId(prev => prev === rideId ? null : prev);
        // Return map focus to driver's current position
        centerOnDriver();
    };

    // ── Fast initial location — two-stage like Uber ───────────────────────────
    const initFastLocation = useCallback(() => {
        if (!navigator.geolocation) return;

        // Stage 1: Cached location → instantly center map (0ms, before GPS warms up)
        // Stage 1: Cached location → instantly zoom in (0ms, even before GPS warms up)
        const cached = sessionStorage.getItem('gps_last_location');
        if (cached) {
            try {
                const loc = JSON.parse(cached);
                setCurrentLocation(loc);
                setFocusedLocation({ lat: loc.lat, lng: loc.lng, zoom: 18, _t: Date.now() });
                pendingFocusRef.current = false;
            } catch (e) {}
        }

        // Stage 2: Fast network fix (WiFi/cell towers, < 1s) — zoom in to actual position
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setCurrentLocation(loc);
                setFocusedLocation({ lat: loc.lat, lng: loc.lng, zoom: 18, _t: Date.now() });
                sessionStorage.setItem('gps_last_location', JSON.stringify(loc));
                pendingFocusRef.current = false;
            },
            () => {}, // Silent fail — high-accuracy watcher follows
            { enableHighAccuracy: false, timeout: 3000, maximumAge: 60000 }
        );
    }, []);

    const startGpsTracking = () => {
        if (!navigator.geolocation || (isTrackingRef.current && watchIdRef.current !== null)) return;
        isTrackingRef.current = true;
        if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);

        watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const loc = { lat: latitude, lng: longitude };
                setCurrentLocation(loc);
                sessionStorage.setItem('gps_last_location', JSON.stringify(loc));

                if (pendingFocusRef.current) {
                    setFocusedLocation({ lat: loc.lat, lng: loc.lng, zoom: 18, _t: Date.now() });
                    pendingFocusRef.current = false;
                }
                // Use refs to avoid stale closures — isAvailable/socket/user always current
                const currentSocket = socketRef.current;
                const currentUser = userRef.current;
                if (currentSocket && currentUser && isAvailableRef.current) {
                    const geoLoc = { type: 'Point', coordinates: [longitude, latitude] };
                    currentSocket.emit('updateLocation', { userId: currentUser._id, role: 'driver', fullName: currentUser.fullName, location: geoLoc });
                    currentSocket.emit('driverOnline', { driverId: currentUser._id, fullName: currentUser.fullName, location: geoLoc });
                }
            },
            (err) => {
                console.error('GPS Error:', err);
                isTrackingRef.current = false;
                watchIdRef.current = null;
                // Auto-retry transient failures — skip PERMISSION_DENIED (code 1)
                if (err.code !== 1) {
                    setTimeout(() => { if (!isTrackingRef.current) startGpsTracking(); }, 5000);
                }
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    // Center on driver: use cached location first for instant response
    const centerOnDriver = () => {
        const cached = sessionStorage.getItem('gps_last_location');
        if (cached) {
            try {
                const loc = JSON.parse(cached);
                setCurrentLocation(loc);
                setFocusedLocation({ lat: loc.lat, lng: loc.lng, zoom: 18, _t: Date.now() });
            } catch (e) {}
        } else if (currentLocation) {
            setFocusedLocation({ lat: currentLocation.lat, lng: currentLocation.lng, zoom: 18, _t: Date.now() });
        }
        if (!navigator.geolocation) return;

        // Fast fix (< 1s) — centers map immediately
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setCurrentLocation(loc);
                setFocusedLocation({ ...loc, _t: Date.now() });
                sessionStorage.setItem('gps_last_location', JSON.stringify(loc));
            },
            () => {},
            { enableHighAccuracy: false, timeout: 2000, maximumAge: 30000 }
        );

        // High-accuracy refine (5-15s) — updates when satellite lock achieved
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setCurrentLocation(loc);
                setFocusedLocation({ ...loc, _t: Date.now() });
                sessionStorage.setItem('gps_last_location', JSON.stringify(loc));
            },
            () => {},
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const fetchOsrmRoute = async (fLat, fLng, tLat, tLng) => {
        try {
            const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${fLng},${fLat};${tLng},${tLat}?overview=full&geometries=geojson`);
            const data = await res.json();
            if (data.routes && data.routes[0]) {
                return data.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
            }
        } catch (err) { console.error(err); }
        return null;
    };

    const animateAlongRoute = (waypoints, onStep, onComplete, intervalMs = 60) => {
        if (!waypoints?.length) { onComplete(); return; }
        let dist = 0;
        for (let i = 0; i < waypoints.length - 1; i++) dist += calculateDistance(waypoints[i].lat, waypoints[i].lng, waypoints[i + 1].lat, waypoints[i + 1].lng);
        let targetSteps = Math.max(50, Math.floor(dist * 350));
        let step = 0;
        const interpolate = (s, e, t) => ({ lat: s.lat + (e.lat - s.lat) * t, lng: s.lng + (e.lng - s.lng) * t });

        simulationIntervalRef.current = setInterval(() => {
            if (step >= targetSteps) {
                clearInterval(simulationIntervalRef.current);
                onStep(waypoints[waypoints.length - 1]);
                onComplete();
                return;
            }
            const prog = step / targetSteps;
            const fIdx = prog * (waypoints.length - 1);
            const bIdx = Math.floor(fIdx);
            onStep(interpolate(waypoints[bIdx], waypoints[bIdx + 1] || waypoints[bIdx], fIdx - bIdx));
            step++;
        }, intervalMs);
    };

    const endSimulation = () => {
        if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
        setIsSimulating(false);
        setIsSimActive(false);
        simCarPosRef.current = null;
        setSimPhase('idle');
        setSimRouteEndpoints(null);
        if (simWasTrackingRef.current) { isTrackingRef.current = false; startGpsTracking(); }
    };

    const handleSimulation = async () => {
        if (isSimulating) { endSimulation(); return; }
        if (!activeRide) { showToast('Accept a ride first.', 'warning'); return; }
        const pLoc = toLatLng(activeRide.pickup), dLoc = toLatLng(activeRide.destination);
        if (!pLoc || !dLoc) { showToast('Missing ride coordinates.', 'error'); return; }

        // Best start location: sessionStorage cache (most recent GPS, updated on every fix)
        // → currentLocation state (may lag behind by one render)
        // → pickup location (last resort — never the stale DB location which could be far away)
        let startLoc = currentLocation;
        if (!startLoc) {
            const cached = sessionStorage.getItem('gps_last_location');
            if (cached) {
                try { startLoc = JSON.parse(cached); } catch (e) {}
            }
        }
        if (!startLoc) startLoc = pLoc; // absolute fallback: start from pickup

        simWasTrackingRef.current = isTrackingRef.current;
        if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; isTrackingRef.current = false; }

        setIsSimulating(true); setIsSimActive(true); setSimPhase('to_pickup');
        simCarPosRef.current = startLoc;
        setSimRouteEndpoints({ from: startLoc, to: pLoc });

        // Fetch route then PREPEND the exact startLoc as the first waypoint.
        // OSRM snaps its first point to the nearest road, which can be 5-20m off from the
        // driver's exact GPS position — visible as a jump at zoom 18. Prepending startLoc
        // ensures the animation begins at the driver's precise location and smoothly
        // transitions into the road-snapped route.
        const osrmRoute = await fetchOsrmRoute(startLoc.lat, startLoc.lng, pLoc.lat, pLoc.lng);
        const w1 = osrmRoute
            ? [startLoc, ...osrmRoute]   // start from exact GPS, then follow road
            : [startLoc, pLoc];          // fallback: straight line if OSRM fails

        if (!await showConfirm('Start driving to pickup?')) { endSimulation(); return; }

        const extractPassengerId = (ride) =>
            ride.passengerId ||
            (typeof ride.passenger === 'object' ? ride.passenger?._id : ride.passenger) ||
            null;

        animateAlongRoute(w1, (p) => {
            simCarPosRef.current = p;
            const passengerId = extractPassengerId(activeRide);
            socket.emit('simCarUpdate', { toUserId: passengerId, location: p, phase: 'to_pickup', endpoints: { from: startLoc, to: pLoc } });
        }, async () => {
            const stopPoint = w1[w1.length - 1];
            simCarPosRef.current = stopPoint; setSimRouteEndpoints(null);
            showToast('Pickup reached! Waiting for passenger confirmation...', 'info');
            const passengerId = activeRide.passengerId || activeRide.passenger?._id || activeRide.passenger;
            // Notify server (stores arrival, sends driverArrivedAtPickup to passenger)
            socket.emit('arrivedAtPickup', { rideId: activeRide._id, passengerId, driverName: user.fullName });
            // Trigger passenger confirmation dialog (simPickupReached path)
            socket.emit('simPickupReached', { toUserId: passengerId, rideId: activeRide._id, driverName: user.fullName });
            setArrivedAtPickup(true); setSimPhase('waiting_passenger');

            const startPhase2 = async () => {
                if (!activeRideRef.current) return;
                try {
                    await axios.put(`http://localhost:5000/api/rides/${activeRideRef.current._id}/status`, { status: 'ongoing' }, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } });
                    setActiveRide(prev => ({ ...prev, status: 'ongoing' }));
                } catch (e) { console.error(e); }
                socket.emit('startRide', { rideId: activeRideRef.current._id, passengerId: activeRideRef.current.passengerId || activeRideRef.current.passenger, driverName: user.fullName, pickup: activeRideRef.current.pickup, destination: activeRideRef.current.destination, fare: activeRideRef.current.fare });
                setSimPhase('to_destination');
                // Same fix: prepend exact pickup point so car starts from where it stopped
                const osrmRoute2 = await fetchOsrmRoute(stopPoint.lat, stopPoint.lng, dLoc.lat, dLoc.lng);
                const w2 = osrmRoute2 ? [stopPoint, ...osrmRoute2] : [stopPoint, dLoc];
                animateAlongRoute(w2, (p) => {
                    simCarPosRef.current = p;
                    // No map panning — let car animate smoothly
                    const passengerId = extractPassengerId(activeRideRef.current);
                    socket.emit('simCarUpdate', { toUserId: passengerId, location: p, phase: 'to_destination' });
                }, async () => {
                    simCarPosRef.current = dLoc;
                    // Tell passenger the sim car has reached the destination so they can clear it
                    const pId = activeRideRef.current?.passengerId || activeRideRef.current?.passenger?._id || activeRideRef.current?.passenger;
                    if (pId) socket.emit('simDestinationReached', { toUserId: pId, rideId: activeRideRef.current?._id });
                    await handleCompleteRide();
                    endSimulation();
                });
            };
            startSimPhase2Ref.current = startPhase2;
            socket.once('simPassengerConfirmed', startPhase2);
            setTimeout(() => { if (simPhaseRef.current === 'waiting_passenger') startPhase2(); }, 60000);
        });
    };

    const handleAcceptRide = async (ride) => {
        // Block if driver already has an active ride
        if (activeRide) {
            showToast('You already have an active ride. Complete or cancel it first.', 'warning');
            return;
        }

        try {
            await axios.put(
                `http://localhost:5000/api/rides/${ride._id}/status`,
                { status: 'accepted', driverId: user._id },
                { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }
            );
            const accepted = { ...ride, status: 'accepted', driverId: user._id };
            setActiveRide(accepted);
            setArrivedAtPickup(false);
            // Only remove the accepted ride — keep others so driver can reject them individually
            setRideRequests(prev => prev.filter(r => r._id !== ride._id));
            socket.emit('acceptRide', {
                rideId: ride._id,
                driverId: user._id,
                driverName: user.fullName,
                passengerId: ride.passengerId || ride.passenger
            });
            showToast('Ride Accepted!', 'success');
        } catch (e) {
            const status = e.response?.status;
            const msg = e.response?.data?.message;
            if (status === 409) {
                showToast(msg || 'You already have an active ride. Complete it before accepting another.', 'warning');
            } else {
                showToast('Failed to accept ride. The ride may no longer be available.', 'error');
                setRideRequests(prev => prev.filter(r => r._id !== ride._id));
            }
        }
    };

    const handleStartRide = async () => {
        if (!activeRide) return;
        try {
            const token = sessionStorage.getItem('token');
            await axios.put(`http://localhost:5000/api/rides/${activeRide._id}/status`, { status: 'ongoing' }, { headers: { Authorization: `Bearer ${token}` } });

            const pId = activeRide.passengerId || (typeof activeRide.passenger === 'object' ? activeRide.passenger._id : activeRide.passenger);
            socket.emit('startRide', {
                rideId: activeRide._id,
                passengerId: pId,
                driverName: user.fullName,
                pickup: activeRide.pickup,
                destination: activeRide.destination,
                fare: activeRide.fare || { totalFare: activeRide.totalFare }
            });

            setActiveRide(prev => ({ ...prev, status: 'ongoing' }));
            setArrivedAtPickup(true);
        } catch (e) { console.error("START_RIDE_ERROR:", e); showToast('Failed to start ride.', 'error'); }
    };

    const handleCompleteRide = async () => {
        if (!activeRide) return;
        try {
            // Update DB status to 'completed' first so the ride is never stuck in 'ongoing'
            await axios.put(
                `http://localhost:5000/api/rides/${activeRide._id}/status`,
                { status: 'completed' },
                { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }
            );

            const pId = activeRide.passengerId || (typeof activeRide.passenger === 'object' ? activeRide.passenger._id : activeRide.passenger);
            socket.emit('completeRide', {
                rideId: activeRide._id,
                passengerId: pId,
                driverId: user._id,
                driverName: user.fullName,
                fare: activeRide.fare || { totalFare: activeRide.totalFare },
                pickup: activeRide.pickup,
                destination: activeRide.destination
            });

            showToast('Awaiting passenger cash/MoMo payment confirmation...', 'info');
        } catch (e) { console.error("COMPLETE_RIDE_ERROR:", e); showToast('Failed to complete ride.', 'error'); }
    };

    const handleCancelActiveRide = async () => {
        if (!activeRide) return;
        const res = await showPrompt('Reason for cancelling:');
        if (res === null) return;
        try {
            await axios.put(`http://localhost:5000/api/rides/${activeRide._id}/status`, { status: 'cancelled' }, { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } });
            const passengerId = activeRide.passengerId || activeRide.passenger?._id || activeRide.passenger;
            socket.emit('cancelActiveRide', { rideId: activeRide._id, toUserId: passengerId, cancelledBy: 'driver', reason: res || "No reason" });
            handleSystemReset(true); // DB already set to cancelled above
        } catch (e) {
            console.error("CANCEL_RIDE_ERROR:", e);
            if (await showConfirm("Failed to cancel on server. Force clear this ride from your screen anyway?")) {
                handleSystemReset(false); // force-cancel since DB update failed
            }
        }
    };

    // skipDbCancel = true when the caller has already handled the DB status (complete/cancel)
    const handleSystemReset = (skipDbCancel = false) => {
        // ── Cancel active ride in DB only when ride was NOT already completed/cancelled ─
        if (!skipDbCancel) {
            const rideId = activeRideRef.current?._id;
            if (rideId) {
                const token = sessionStorage.getItem('token');
                axios.put(`http://localhost:5000/api/rides/${rideId}/status`,
                    { status: 'cancelled' },
                    { headers: { Authorization: `Bearer ${token}` } }
                ).catch(() => {});
            }
        }

        // ── Stop simulation if running ────────────────────────────────────────
        if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
        setIsSimulating(false);
        setIsSimActive(false);
        simCarPosRef.current = null;
        setSimPhase('idle');
        setSimRouteEndpoints(null);
        if (simWasTrackingRef.current) { isTrackingRef.current = false; startGpsTracking(); }

        // Clear ride state
        setRideRequests([]);
        setActiveRide(null);
        setNearbyPassengers([]);
        setViewingRide(null);
        setRouteLoadedRideId(null);
        setArrivedAtPickup(false);
        isResettingRef.current = false;

        // Clear sessionStorage
        [
            'driver_requests', 'driver_activeRide', 'isDriverAvailable'
        ].forEach(k => sessionStorage.removeItem(k));

        // Notify socket server that driver is free (clears hasActiveRide flag)
        const currentSocket = socketRef.current;
        const currentUser = userRef.current;
        if (currentSocket && currentUser) {
            currentSocket.emit('driverOffline', { driverId: currentUser._id });
            // Re-register as online after a brief moment (if they were available)
            if (isAvailableRef.current) {
                setTimeout(() => {
                    const cached = sessionStorage.getItem('gps_last_location');
                    if (cached) {
                        try {
                            const loc = JSON.parse(cached);
                            const geoLoc = { type: 'Point', coordinates: [loc.lng, loc.lat] };
                            currentSocket.emit('driverOnline', { driverId: currentUser._id, fullName: currentUser.fullName, location: geoLoc });
                        } catch (e) {}
                    }
                }, 500);
            }
        }

        // Re-center map on driver's location
        setTimeout(() => centerOnDriver(), 100);
    };

    // Fast location on mount (before socket — instant map centering)
    useEffect(() => { initFastLocation(); }, [initFastLocation]);

    useEffect(() => {
        // Restart GPS when user returns to the tab — browsers pause geolocation in background.
        // Uses isAvailableRef (not closure) so it always reads the current online/offline state.
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !isTrackingRef.current && isAvailableRef.current) {
                startGpsTracking();
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        if (socket && user) {
            // Only mark pending if no cached location
            pendingFocusRef.current = !sessionStorage.getItem('gps_last_location');
            startGpsTracking();
            socket.emit('getPassengers');

            // Register online immediately if already available with current/cached location
            if (isAvailable) {
                const cached = sessionStorage.getItem('gps_last_location');
                const loc = currentLocation
                    || (cached ? JSON.parse(cached) : null)
                    || (user?.location?.coordinates ? { lat: user.location.coordinates[1], lng: user.location.coordinates[0] } : null);
                if (loc) {
                    const geoLoc = { type: 'Point', coordinates: [loc.lng, loc.lat] };
                    socket.emit('driverOnline', { driverId: user._id, fullName: user.fullName, location: geoLoc });
                } else {
                    socket.emit('driverOnline', { driverId: user._id, fullName: user.fullName, location: null });
                }
            }

            // Burst polling: see passengers immediately after connect
            [400, 900, 1600, 2500].forEach(ms =>
                setTimeout(() => { if (socket.connected) socket.emit('getPassengers'); }, ms)
            );
            // Steady-state poll every 2s
            const passengerPoll = setInterval(() => socket.emit('getPassengers'), 2000);
            return () => {
                document.removeEventListener('visibilitychange', onVisibilityChange);
                clearInterval(passengerPoll);
                if (watchIdRef.current !== null) {
                    navigator.geolocation.clearWatch(watchIdRef.current);
                    watchIdRef.current = null;
                }
                isTrackingRef.current = false;
            };
        }
        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
            isTrackingRef.current = false;
        };
    }, [socket, user, isAvailable]);

    return (
        <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-8rem)] animate-in zoom-in-95 duration-500">
            {/* Map Area */}
            <div className="flex-1 relative rounded-[2rem] shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
                <LeafletMap
                    userLocation={currentLocation || (user?.location ? { lat: user.location.coordinates[1], lng: user.location.coordinates[0] } : null)}
                    drivers={[]}
                    passengers={showPassengersOnMap ? nearbyPassengers : []}
                    pickup={activeRide?.pickup || toLatLng(viewingRide?.pickup)}
                    destination={activeRide?.destination || toLatLng(viewingRide?.destination)}
                    focusLocation={focusedLocation}
                    onRouteFound={handleRouteFound}
                    isLocked={!!activeRide || !!viewingRide}
                    simCarPosRef={simCarPosRef}
                    isSimActive={isSimActive}
                    hideUserMarker={isSimActive}
                    hideAccuracyCircle={isSimulating}
                    hidePassengerMarkers={simPhase !== 'idle'}
                    simRouteEndpoints={simRouteEndpoints}
                    onPassengerClick={(loc) => {
                        if (loc) setFocusedLocation({ lat: loc.lat, lng: loc.lng, zoom: 18, _t: Date.now() });
                    }}
                />

            </div>

            {/* Request Panel */}
            <div className="w-full lg:w-80 bg-white dark:bg-gray-800 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden">
                <div className="p-4 border-b dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between items-center">
                    <div>
                        <h3 className="text-base font-black dark:text-white flex items-center gap-2">
                            <Zap size={16} className="text-amber-500" />
                            Live Requests
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                const newAvailable = !isAvailable;
                                setIsAvailable(newAvailable);
                                sessionStorage.setItem('isDriverAvailable', newAvailable);
                                if (!newAvailable && socket) {
                                    socket.emit('driverOffline', { driverId: user._id });
                                }
                            }}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border ${isAvailable ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400'}`}
                        >
                            {isAvailable ? 'Online' : 'Offline'}
                        </button>
                        <button onClick={centerOnDriver} title="Center on my location" className="p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-gray-50 text-blue-600"><Navigation size={18} /></button>
                        <button onClick={() => setShowPassengersOnMap(!showPassengersOnMap)} title="Toggle passengers on map" className={`p-2 rounded-xl shadow-sm border ${showPassengersOnMap ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-purple-600'}`}><User size={18} /></button>
                        <button
                            onClick={() => { setViewingRide(null); setRouteLoadedRideId(null); centerOnDriver(); }}
                            title="Clear route from map"
                            className="p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-red-50 hover:text-red-500 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 text-gray-400 transition-all"
                        >
                            <XCircle size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex flex-col h-full">
                    {/* Simplified Tab Switcher */}
                    <div className="flex p-1 bg-gray-100 dark:bg-gray-900 mx-3 mt-3 rounded-xl gap-1">
                        <button
                            onClick={() => setActiveTab('requests')}
                            className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'requests' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-400'}`}
                        >
                            Requests {rideRequests.length > 0 && `(${rideRequests.length})`}
                        </button>
                        <button
                            onClick={() => setActiveTab('passengers')}
                            className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'passengers' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-400'}`}
                        >
                            Passengers {nearbyPassengers.length > 0 && `(${nearbyPassengers.length})`}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {!isAvailable && (
                            <div className="text-center py-10 opacity-50">
                                <MapIcon size={32} className="mx-auto mb-2 text-gray-400" />
                                <p className="text-xs font-bold text-gray-400">Offline</p>
                            </div>
                        )}

                        {isAvailable && activeTab === 'requests' && (
                            <>
                                {rideRequests.length === 0 && !activeRide && (
                                    <div className="text-center py-10">
                                        <div className="relative inline-block">
                                            <span className="absolute top-0 right-0 flex h-2.5 w-2.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                                            </span>
                                            <Navigation size={32} className="text-gray-300" />
                                        </div>
                                        <p className="text-xs font-bold text-gray-400 mt-3">Searching for rides...</p>
                                    </div>
                                )}

                                {rideRequests.map((ride) => (
                                    <div key={ride._id} className="bg-white border border-blue-100 p-3 rounded-xl shadow-sm relative overflow-hidden group cursor-pointer hover:border-blue-300 transition" onClick={() => { setViewingRide(ride); setRouteLoadedRideId(null); setFocusedLocation({ type: 'route', pickup: ride.pickup, destination: ride.destination, _t: Date.now() }); }}>
                                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                                        <div className="flex justify-between items-start mb-2 pl-2">
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <h4 className="font-bold text-sm" style={{ color: '#111' }}>{ride.fare?.distanceKm || ride.distanceKm} km</h4>
                                                    <span className="text-blue-600 font-black text-xs">{(ride.fare?.totalFare || ride.totalFare || 0).toLocaleString()} RWF</span>
                                                </div>
                                                <div className="mt-2 pt-2 border-t text-[10px] font-bold uppercase grid grid-cols-2 gap-2">
                                                    {currentLocation && ride.pickup && <span className="text-blue-600">{getETA(calculateDistance(currentLocation.lat, currentLocation.lng, ride.pickup.lat, ride.pickup.lng))} min away</span>}
                                                    <span style={{ color: '#111' }}>Total: {ride.fare?.totalFare || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pl-2 mt-3">
                                            {viewingRide?._id === ride._id ? (
                                                routeLoadedRideId === ride._id ? (
                                                    <>
                                                        <button onClick={() => handleAcceptRide(ride)} className="flex-1 bg-blue-600 text-white text-[10px] font-bold py-2 rounded-lg">Accept</button>
                                                        <button onClick={() => handleDeclineRide(ride._id, ride.passengerId || ride.passenger)} className="px-3 py-2 bg-gray-50 text-gray-400 text-[10px] font-bold rounded-lg">Ignore</button>
                                                    </>
                                                ) : <button disabled className="w-full py-2 bg-blue-50 text-blue-400 text-[10px] font-bold rounded-lg flex items-center justify-center gap-2"><RotateCw size={12} className="animate-spin" /> Loading...</button>
                                            ) : <button onClick={() => { setViewingRide(ride); setRouteLoadedRideId(null); setFocusedLocation({ type: 'route', pickup: ride.pickup, destination: ride.destination, _t: Date.now() }); }} className="w-full py-2 bg-blue-600 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-2"><MapIcon size={14} /> View on Map</button>}
                                        </div>
                                    </div>
                                ))}

                                {activeRide && (
                                    <div onClick={() => setFocusedLocation({ type: 'route', pickup: activeRide.pickup, destination: activeRide.destination, _t: Date.now() })} className="bg-emerald-600 p-5 rounded-2xl text-white shadow-lg relative cursor-pointer group">
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest opacity-80">Active Trip</h4>
                                            <Zap size={14} className="animate-pulse text-yellow-400" />
                                        </div>
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-black">{activeRide.passengerName?.charAt(0) || 'P'}</div>
                                            <div><p className="text-sm font-black leading-none">{activeRide.passengerName || 'Passenger'}</p></div>
                                        </div>
                                        <div className="space-y-1.5 mb-4 text-[10px] font-black uppercase border-b border-white/10 pb-4">
                                            <div className="flex justify-between"><span>Fare</span><span>{(activeRide.fare?.totalFare || activeRide.totalFare || 0).toLocaleString()} RWF</span></div>
                                            <div className="flex justify-between"><span>Dist</span><span>{activeRide.fare?.distanceKm || activeRide.distance || activeRide.distanceKm || '0.0'} KM</span></div>
                                        </div>
                                        <div className="flex gap-2">
                                            {!isSimulating && activeRide.status === 'accepted' && !arrivedAtPickup && (
                                                <button onClick={(e) => { e.stopPropagation(); handleSimulation(); }} className="flex-1 py-2 bg-white text-emerald-600 rounded-lg text-[10px] font-black flex items-center justify-center gap-1">
                                                    <RotateCw size={12} /> Simulation
                                                </button>
                                            )}
                                            {!isSimulating && activeRide.status === 'accepted' && arrivedAtPickup && (
                                                <button onClick={(e) => { e.stopPropagation(); handleStartRide(); }} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-[10px] font-black flex items-center justify-center gap-1">
                                                    <Play size={14} fill="currentColor" /> Start Ride
                                                </button>
                                            )}
                                            {isSimulating && (
                                                <button disabled className="flex-1 py-2 bg-yellow-400 text-yellow-900 rounded-lg text-[10px] font-black flex items-center justify-center gap-1">
                                                    <RotateCw size={12} className="animate-spin" /> Simulating...
                                                </button>
                                            )}
                                            {activeRide.status === 'ongoing' && !isSimulating && (
                                                <button onClick={(e) => { e.stopPropagation(); handleCompleteRide(); }} className="flex-1 py-2 bg-white text-emerald-600 rounded-lg text-[10px] font-black">Complete</button>
                                            )}
                                            <button onClick={(e) => { e.stopPropagation(); handleCancelActiveRide(); }} className="px-3 bg-emerald-700 hover:bg-red-600 text-white text-[10px] font-black py-2 rounded-lg transition-colors flex items-center justify-center gap-1"><XCircle size={12} /> End</button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {isAvailable && activeTab === 'passengers' && (
                            <>
                                {nearbyPassengers.length === 0 ? (
                                    <div className="text-center py-10">
                                        <User size={32} className="mx-auto text-gray-300 mb-3" />
                                        <p className="text-xs font-bold text-gray-400 italic">No passengers nearby</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {nearbyPassengers.map((p) => {
                                            // Real location for accurate zoom (not the spread-offset visual position)
                                            const realLoc = p.location?.lat ? p.location
                                                : p.location?.coordinates ? { lat: p.location.coordinates[1], lng: p.location.coordinates[0] }
                                                : null;
                                            const isYours = activeRide && (
                                                activeRide.passengerId === p._id ||
                                                activeRide.passenger === p._id ||
                                                activeRide.passenger?._id === p._id
                                            );
                                            return (
                                                <div
                                                    key={p._id}
                                                    onClick={() => {
                                                        if (!realLoc) return;
                                                        if (!showPassengersOnMap) setShowPassengersOnMap(true);
                                                        setFocusedLocation({ lat: realLoc.lat, lng: realLoc.lng, zoom: 18, _t: Date.now() });
                                                    }}
                                                    className={`bg-gray-50 dark:bg-gray-900/40 p-3 rounded-xl border transition cursor-pointer flex items-center gap-3 ${
                                                        isYours
                                                            ? 'border-emerald-500 ring-1 ring-emerald-400'
                                                            : 'border-gray-100 dark:border-gray-800 hover:border-blue-300'
                                                    }`}
                                                >
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isYours ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                                                        <User size={16} className={isYours ? 'text-emerald-600' : 'text-blue-600'} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-black text-gray-900 dark:text-white truncate uppercase tracking-tight">{p.fullName}</p>
                                                        <p className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${isYours ? 'text-emerald-500' : 'text-emerald-500'}`}>
                                                            {isYours ? '★ Your Passenger' : 'Available Now'}
                                                        </p>
                                                    </div>
                                                    <div className="text-[9px] font-black text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">
                                                        {currentLocation && realLoc ? `${calculateDistance(currentLocation.lat, currentLocation.lng, realLoc.lat, realLoc.lng).toFixed(1)}km` : '--'}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Emergency Reset Button */}
                    <div className="p-3 border-t dark:border-gray-700 bg-gray-50/30 dark:bg-gray-900/30">
                        <button
                            onClick={async () => { if (await showConfirm("This will clear all current ride data locally. Use only if stuck. Proceed?")) handleSystemReset(); }}
                            className="w-full py-2 bg-gray-100 hover:bg-red-50 dark:bg-gray-800 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 border border-transparent hover:border-red-200 dark:hover:border-red-800/50"
                        >
                            <RotateCw size={12} /> Emergency Reset
                        </button>
                    </div>
                </div>
            </div>

            {/* Completion Modal */}
            {showCompletionModal && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 md:p-10 max-w-sm w-full shadow-2xl text-center border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                            <CheckCircle size={48} className="animate-in zoom-in spin-in-45 duration-700" />
                        </div>

                        <h2 className="text-3xl font-black dark:text-white mb-2 leading-tight">Ride Completed!</h2>
                        <p className="text-gray-500 dark:text-gray-400 font-medium mb-8">Excellent work! You have successfully delivered the passenger to their destination.</p>

                        <div className="bg-gray-50 dark:bg-gray-900 rounded-3xl p-6 mb-8 border border-gray-100 dark:border-gray-800 space-y-3">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Total Earnings</p>
                                <p className="text-4xl font-black text-emerald-600">
                                    {(activeRideRef.current?.fare?.totalFare || activeRideRef.current?.totalFare || 0).toLocaleString()} <span className="text-sm">RWF</span>
                                </p>
                            </div>
                            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">RRA Tax (18%)</p>
                                <p className="text-sm font-black text-gray-600 dark:text-gray-300">
                                    {Math.round((activeRideRef.current?.fare?.taxAmount || (activeRideRef.current?.fare?.totalFare || activeRideRef.current?.totalFare || 0) * 0.18)).toLocaleString()} RWF
                                </p>
                            </div>
                            <div className="flex justify-between items-center">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Distance</p>
                                <p className="text-sm font-black text-gray-600 dark:text-gray-300">
                                    {activeRideRef.current?.fare?.distanceKm || activeRideRef.current?.distanceKm || '—'} km
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                setShowCompletionModal(false);
                                handleSystemReset(true); // ride already completed — do NOT cancel in DB
                            }}
                            className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-xl shadow-blue-500/30 transition-all active:scale-95"
                        >
                            Return to Map
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LiveMap;

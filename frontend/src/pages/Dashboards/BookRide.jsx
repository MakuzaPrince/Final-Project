import { useState, useEffect, useCallback, useRef } from 'react';
import LeafletMap from '../../components/Map/LeafletMap';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useDialog } from '../../context/DialogContext';
import {
    Search,
    MapPin,
    Navigation,
    RotateCw,
    Zap,
    Car,
    User,
    CheckCircle,
    XCircle,
    X,
    Loader2,
    Smartphone,
    CreditCard,
    DollarSign,
    AlertCircle
} from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const BookRide = () => {
    const { user } = useAuth();
    const socket = useSocket();
    const navigate = useNavigate();
    const { showToast, showConfirm, showPrompt } = useDialog();

    const [pickup, setPickup] = useState(() => JSON.parse(sessionStorage.getItem('ride_pickup')) || null);
    const [destination, setDestination] = useState(() => JSON.parse(sessionStorage.getItem('ride_destination')) || null);
    const [pickupQuery, setPickupQuery] = useState('');
    const [destinationQuery, setDestinationQuery] = useState('');
    const [pickupResults, setPickupResults] = useState([]);
    const [destinationResults, setDestinationResults] = useState([]);
    const [pickupLoading, setPickupLoading] = useState(false);
    const [destinationLoading, setDestinationLoading] = useState(false);
    const [fareDetails, setFareDetails] = useState(() => JSON.parse(sessionStorage.getItem('ride_fare')) || null);
    const [userLocation, setUserLocation] = useState(null);
    const [acceptedRide, setAcceptedRide] = useState(() => JSON.parse(sessionStorage.getItem('ride_accepted')) || null);
    const [activeDrivers, setActiveDrivers] = useState([]);
    const [isFindingDriver, setIsFindingDriver] = useState(() => sessionStorage.getItem('ride_isFinding') === 'true');
    const [rideStatus, setRideStatus] = useState(() => sessionStorage.getItem('ride_status') || null); // 'sent', 'accepted', 'declined'
    const [requestTargetDriverId, setRequestTargetDriverId] = useState(() => sessionStorage.getItem('ride_target_driver') || null);
    const [focusLocation, setFocusLocation] = useState(null);
    const [showDriversOnMap, setShowDriversOnMap] = useState(true);
    // Simulation state (passenger side)
    // simCarPosRef: direct ref updated by socket events — zero React re-renders per position tick
    const simCarPosRef = useRef(null);
    const [isSimActive, setIsSimActive] = useState(false);  // controls SimCarMarker visibility
    const [simRouteEndpoints, setSimRouteEndpoints] = useState(null);
    const [hidePassengerMarker, setHidePassengerMarker] = useState(false);
    const [isSettling, setIsSettling] = useState(false);
    const [settlementSuccess, setSettlementSuccess] = useState(false);
    const [settlementError, setSettlementError] = useState('');

    // MoMo payment state
    const [momoPhone, setMomoPhone] = useState(() => user?.phone || '');
    const [momoProcessing, setMomoProcessing] = useState(false);
    const [momoRef, setMomoRef] = useState(null);
    const [momoStatus, setMomoStatus] = useState(null); // null | 'pending' | 'successful' | 'failed'
    const [momoError, setMomoError] = useState('');
    const momoPollerRef = useRef(null);

    const watchIdRef = useRef(null);
    const hasCenteredInitially = useRef(false);
    const isTrackingRef = useRef(false);
    const pendingFocusRef = useRef(false);
    const acceptedRideRef = useRef(null);
    const socketRef = useRef(socket);
    const userRef = useRef(user);
    // Separate debounce timers so pickup and destination searches don't cancel each other
    const pickupDebounceRef = useRef(null);
    const destDebounceRef = useRef(null);
    // AbortControllers to cancel in-flight requests when a new search starts
    const pickupAbortRef = useRef(null);
    const destAbortRef = useRef(null);

    // Keep refs in sync
    useEffect(() => { acceptedRideRef.current = acceptedRide; }, [acceptedRide]);
    useEffect(() => { socketRef.current = socket; }, [socket]);
    useEffect(() => { userRef.current = user; }, [user]);

    // ── GPS TRACKING ─────────────────────────────────────────────────────────
    const startGpsTracking = () => {
        if (!navigator.geolocation || isTrackingRef.current) return;
        isTrackingRef.current = true;
        if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);

        watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const loc = { lat: latitude, lng: longitude };
                setUserLocation(loc);
                // Cache for instant centering on next load
                sessionStorage.setItem('gps_last_location', JSON.stringify(loc));

                if (pendingFocusRef.current) {
                    setFocusLocation({ lat: latitude, lng: longitude, zoom: 18, _t: Date.now() });
                    pendingFocusRef.current = false;
                }

                // Use refs to avoid stale closures — socket/user always current
                const currentSocket = socketRef.current;
                const currentUser = userRef.current;
                if (currentSocket && currentUser) {
                    currentSocket.emit('updateLocation', {
                        userId: currentUser._id,
                        fullName: currentUser.fullName,
                        role: 'passenger',
                        location: { type: 'Point', coordinates: [longitude, latitude] }
                    });
                }
            },
            (error) => {
                console.error('Passenger GPS Error:', error);
                isTrackingRef.current = false;
                watchIdRef.current = null;
                // Auto-retry transient failures (timeout / temporarily unavailable).
                // Do NOT retry PERMISSION_DENIED (code 1) — user must grant in browser settings.
                if (error.code !== 1) {
                    setTimeout(() => { if (!isTrackingRef.current) startGpsTracking(); }, 5000);
                }
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    // ── FAST INITIAL LOCATION ─────────────────────────────────────────────────
    // Two-stage GPS like Uber: instant low-accuracy fix (WiFi/cell, < 1s) first,
    // then high-accuracy GPS refines it (satellite, 5-30s).
    const initFastLocation = useCallback(() => {
        if (!navigator.geolocation) return;

        // Stage 1: Cached location → instantly zoom in (0ms, even before GPS warms up)
        const cached = sessionStorage.getItem('gps_last_location');
        if (cached) {
            try {
                const loc = JSON.parse(cached);
                setUserLocation(loc);
                setFocusLocation({ lat: loc.lat, lng: loc.lng, zoom: 18, _t: Date.now() });
                pendingFocusRef.current = false;
            } catch (e) {}
        }

        // Stage 2: Fast network fix (WiFi/cell towers, < 1 second) — zoom in to current position
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setUserLocation(loc);
                setFocusLocation({ lat: loc.lat, lng: loc.lng, zoom: 18, _t: Date.now() });
                sessionStorage.setItem('gps_last_location', JSON.stringify(loc));
                pendingFocusRef.current = false;
            },
            () => {}, // Silent fail — high-accuracy watcher follows
            { enableHighAccuracy: false, timeout: 3000, maximumAge: 60000 }
        );
    }, []);

    // ── CENTER ON USER ────────────────────────────────────────────────────────
    const centerOnUser = () => {
        // Instant: use cached location from sessionStorage for immediate map move
        const cached = sessionStorage.getItem('gps_last_location');
        if (cached) {
            try {
                const loc = JSON.parse(cached);
                setUserLocation(loc);
                setFocusLocation({ lat: loc.lat, lng: loc.lng, zoom: 18, _t: Date.now() });
            } catch (e) {}
        } else if (userLocation) {
            setFocusLocation({ lat: userLocation.lat, lng: userLocation.lng, zoom: 18, _t: Date.now() });
        }

        // Proactively get a fresh fix regardless of current watcher state
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    setUserLocation(loc);
                    sessionStorage.setItem('gps_last_location', JSON.stringify(loc));
                    setFocusLocation({ lat: loc.lat, lng: loc.lng, zoom: 18, _t: Date.now() });
                    if (!isTrackingRef.current) startGpsTracking();
                },
                (err) => console.error('Passenger Instant Fix Error:', err),
                { enableHighAccuracy: false, timeout: 5000, maximumAge: 30000 }
            );
        } else if (!userLocation) {
            showToast("Geolocation is not supported by this browser.", 'error');
        }
    };

    // ── RESET MAP ────────────────────────────────────────────────────────────
    // Only allowed when no active or pending ride exists
    const isRideActive = isFindingDriver || rideStatus === 'sent' || rideStatus === 'accepted';

    const handleResetMap = () => {
        if (isRideActive) return;
        setPickup(null);
        setDestination(null);
        setFareDetails(null);
        setPickupQuery('');
        setDestinationQuery('');
        setPickupResults([]);
        setDestinationResults([]);
        centerOnUser();
    };

    // Keep legacy name for compatibility with older code paths
    const handleLocateUser = centerOnUser;


    // Fast location on mount — runs before socket connects for instant map centering
    useEffect(() => {
        initFastLocation();
    }, [initFastLocation]);

    useEffect(() => {
        if (!socket || !user) return;

        // Start high-accuracy GPS tracking after socket is ready
        pendingFocusRef.current = !sessionStorage.getItem('gps_last_location'); // only pending if no cache
        startGpsTracking();

        // SocketContext already sends the initial join, but we re-send with fresh location
        const cachedLoc = sessionStorage.getItem('gps_last_location');
        socket.emit('join', {
            userId: user._id,
            role: 'passenger',
            fullName: user.fullName,
            location: cachedLoc ? JSON.parse(cachedLoc) : user.location
        });

        // Request driver list immediately after joining, and again after a short delay
        socket.emit('getNearbyDrivers');
        setTimeout(() => socket.emit('getNearbyDrivers'), 2000);

        // Restart GPS when user returns to the tab — browsers pause geolocation in background
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !isTrackingRef.current) {
                startGpsTracking();
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
            isTrackingRef.current = false;
        };
    }, [socket, user]);

    // Persistence Effects
    useEffect(() => {
        if (pickup) sessionStorage.setItem('ride_pickup', JSON.stringify(pickup));
        else sessionStorage.removeItem('ride_pickup');
    }, [pickup]);

    useEffect(() => {
        if (destination) sessionStorage.setItem('ride_destination', JSON.stringify(destination));
        else sessionStorage.removeItem('ride_destination');
    }, [destination]);

    useEffect(() => {
        if (fareDetails) sessionStorage.setItem('ride_fare', JSON.stringify(fareDetails));
        else sessionStorage.removeItem('ride_fare');
    }, [fareDetails]);

    useEffect(() => {
        if (rideStatus) sessionStorage.setItem('ride_status', rideStatus);
        else sessionStorage.removeItem('ride_status');
    }, [rideStatus]);

    useEffect(() => {
        if (acceptedRide) sessionStorage.setItem('ride_accepted', JSON.stringify(acceptedRide));
        else sessionStorage.removeItem('ride_accepted');
    }, [acceptedRide]);

    useEffect(() => {
        if (requestTargetDriverId) sessionStorage.setItem('ride_target_driver', requestTargetDriverId);
        else sessionStorage.removeItem('ride_target_driver');
    }, [requestTargetDriverId]);

    // ── GEOCODING ENGINE ──────────────────────────────────────────────────────
    // Convert a Photon (GeoJSON) feature to our standard place object
    const fromPhoton = (feature) => {
        const p = feature.properties;
        const [lng, lat] = feature.geometry.coordinates;
        const parts = [p.name, p.city || p.town || p.village || p.county, p.country]
            .filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
        return {
            lat, lng,
            label: parts.slice(0, 2).join(', ') || p.name || 'Unknown place',
            sublabel: parts.join(', '),
            placeType: ['city', 'town', 'village'].includes(p.osm_value) ? 'city' : 'place',
        };
    };

    // Convert a Nominatim result to our standard place object
    const fromNominatim = (item) => {
        const addr = item.address || {};
        const parts = [
            addr.neighbourhood || addr.suburb,
            addr.city || addr.town || addr.municipality || addr.village || addr.county,
            addr.country,
        ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
        return {
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            label: parts.slice(0, 2).join(', ') || item.display_name.split(',').slice(0, 2).join(',').trim(),
            sublabel: item.display_name,
            placeType: ['city', 'town', 'village', 'municipality'].includes(item.addresstype) ? 'city' : 'place',
        };
    };

    // Fetch from Photon (primary — purpose-built for autocomplete, always allows CORS)
    const fetchPhoton = async (query) => {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=8&lang=en`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.features || []).map(fromPhoton);
    };

    // Fetch from Nominatim (fallback — more comprehensive address data)
    const fetchNominatim = async (query) => {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8&addressdetails=1&accept-language=en`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) return [];
        const data = await res.json();
        return data.map(fromNominatim);
    };

    // Run search: Photon first, Nominatim if Photon returns nothing
    const runSearch = async (query) => {
        const q = query.trim();
        try {
            const results = await fetchPhoton(q);
            if (results.length > 0) return results;
        } catch (e) {}
        try {
            return await fetchNominatim(q);
        } catch (e) {
            return [];
        }
    };

    // Debounced search — called on every keystroke.
    // Uses a request counter (not AbortController) to discard stale responses —
    // this avoids AbortErrors showing "no results" when a newer search supersedes.
    const searchLocation = (query, type) => {
        const debounceRef = type === 'pickup' ? pickupDebounceRef : destDebounceRef;
        const counterRef = type === 'pickup' ? pickupAbortRef : destAbortRef; // reused as counter ref
        const setResults = type === 'pickup' ? setPickupResults : setDestinationResults;
        const setLoading = type === 'pickup' ? setPickupLoading : setDestinationLoading;

        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (!query || query.trim().length < 2) {
            setResults([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        // Tag this search with a unique ID; discard response if a newer search starts
        const id = Date.now();
        counterRef.current = id;

        debounceRef.current = setTimeout(async () => {
            const results = await runSearch(query);
            if (counterRef.current !== id) return; // superseded — discard
            setResults(results);
            setLoading(false);
        }, 300);
    };

    // Immediate search — called on Enter key (no debounce wait)
    const searchImmediate = async (query, type) => {
        const debounceRef = type === 'pickup' ? pickupDebounceRef : destDebounceRef;
        const counterRef = type === 'pickup' ? pickupAbortRef : destAbortRef;
        const setResults = type === 'pickup' ? setPickupResults : setDestinationResults;
        const setLoading = type === 'pickup' ? setPickupLoading : setDestinationLoading;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!query || query.trim().length < 2) return;

        setLoading(true);
        const id = Date.now();
        counterRef.current = id;
        const results = await runSearch(query);
        if (counterRef.current !== id) return; // superseded
        setResults(results);
        setLoading(false);
    };

    const handleEditPickup = () => {
        setPickup(null);
        setPickupQuery('');
        setPickupResults([]);    // clear dropdown
        setFareDetails(null);
    };

    const handleEditDestination = () => {
        setDestination(null);
        setDestinationQuery('');
        setDestinationResults([]); // clear dropdown
        setFareDetails(null);
    };

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const getETA = (dist) => {
        return Math.ceil(dist * 2.5 + 1);
    };

    const calculateFare = useCallback((distanceKm) => {
        let baseFare = 0;
        if (distanceKm <= 1) baseFare = 1500;
        else if (distanceKm <= 30) baseFare = 1500 + (distanceKm - 1) * 600;
        else baseFare = 1500 + (29 * 600) + (distanceKm - 30) * 500;
        return Math.round(baseFare);
    }, []);

    const handleRouteFound = useCallback((routeData) => {
        if (!routeData) {
            console.log('BOOK RIDE: No route data received, clearing fare details.');
            setFareDetails(null);
            return;
        }

        const { distance, time } = routeData;

        if (typeof distance !== 'number' || isNaN(distance)) {
            console.error('BOOK RIDE: Invalid distance received:', distance);
            setFareDetails(null);
            return;
        }

        console.log('BOOK RIDE: Route found, calculating fare...', { distance, time });

        const baseFare = calculateFare(distance);
        const tax = Math.round(baseFare * 0.18);
        const totalFare = baseFare + tax;

        const details = {
            distanceKm: distance.toFixed(2),
            timeMin: Math.ceil(time / 60),
            baseFare,
            taxAmount: tax,
            totalFare
        };

        console.log('BOOK RIDE: Setting fare details:', details);
        setFareDetails(details);
    }, [calculateFare]);


    // Listen for active drivers
    useEffect(() => {
        if (!socket) return;

        // ── helpers ──────────────────────────────────────────────────────────
        const parseDriverLocation = (d) => {
            let lat, lng;
            if (d.location?.coordinates && Array.isArray(d.location.coordinates)) {
                // GeoJSON: [lng, lat]
                lng = d.location.coordinates[0];
                lat = d.location.coordinates[1];
            } else if (d.location?.lat !== undefined) {
                lat = parseFloat(d.location.lat);
                lng = parseFloat(d.location.lng);
            }
            if (lat !== undefined && !isNaN(lat)) {
                return { ...d, _id: d.driverId || d._id || d.userId, location: { lat, lng } };
            }
            return null;
        };

        // Server is the source of truth — replace the full list on each poll.
        // No merge: stale/ghost drivers are removed automatically when they
        // disappear from the server's activeDrivers Map.
        const handleDriversUpdate = (drivers) => {
            if (!Array.isArray(drivers)) return;
            const parsed = drivers.map(parseDriverLocation).filter(Boolean);
            // Always apply — even an empty array means no drivers are online right now
            setActiveDrivers(parsed);
        };

        // Single driver event (driverAvailable / new GPS fix between polls)
        // Only add or update — the full poll will clean up stale entries
        const handleSingleDriver = (driver) => {
            const parsed = parseDriverLocation(driver);
            if (!parsed) return;
            setActiveDrivers(prev => {
                const idx = prev.findIndex(d => d._id === parsed._id);
                if (idx >= 0) {
                    const updated = [...prev];
                    updated[idx] = parsed;
                    return updated;
                }
                return [...prev, parsed];
            });
        };

        // Burst polling on connect: fire rapidly in the first few seconds so
        // drivers who just joined (with cached location) appear without waiting
        // for the 3s poll cycle.
        socket.emit('getNearbyDrivers');
        socket.emit('getDrivers');
        [400, 900, 1600, 2500].forEach(ms =>
            setTimeout(() => { if (socket.connected) socket.emit('getNearbyDrivers'); }, ms)
        );

        socket.on('nearbyDrivers', handleDriversUpdate);
        socket.on('activeDrivers', handleDriversUpdate);
        socket.on('driverAvailable', handleSingleDriver);
        socket.on('driverUnavailable', ({ driverId }) => {
            setActiveDrivers(prev => prev.filter(d => d._id !== driverId));
        });

        // Steady-state poll every 2s
        const poll = setInterval(() => {
            socket.emit('getNearbyDrivers');
        }, 2000);

        return () => {
            socket.off('nearbyDrivers', handleDriversUpdate);
            socket.off('activeDrivers', handleDriversUpdate);
            socket.off('driverAvailable', handleSingleDriver);
            socket.off('driverUnavailable');
            clearInterval(poll);
        };
    }, [socket]);

    // ── RIDE RESPONSE SOCKET EVENTS ──────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        const onRideAccepted = (ride) => {
            setRideStatus('accepted');
            setIsFindingDriver(false);
            // Attach locally-calculated fare — the socket event only sends rideId/driverName/status
            let fare = null;
            try { fare = JSON.parse(sessionStorage.getItem('ride_fare')) || null; } catch (e) {}
            const normalized = { ...ride, _id: ride._id || ride.rideId, fare };
            setAcceptedRide(normalized);
            sessionStorage.setItem('ride_status', 'accepted');
            sessionStorage.setItem('ride_isFinding', 'false');
            sessionStorage.setItem('ride_accepted', JSON.stringify(normalized));
            // Keep ride_pending_id so payment handlers can find the ride
            if (ride.rideId) sessionStorage.setItem('ride_pending_id', ride.rideId);
        };

        const onRideDeclined = () => {
            // Cancel the ride in DB before clearing the ID so the next request
            // doesn't hit a "previous ride still pending" 409
            const pendingRideId = sessionStorage.getItem('ride_pending_id');
            if (pendingRideId) {
                const token = sessionStorage.getItem('token');
                axios.put(
                    `http://localhost:5000/api/rides/${pendingRideId}/status`,
                    { status: 'cancelled' },
                    { headers: { Authorization: `Bearer ${token}` } }
                ).catch(() => {});
            }
            setRideStatus('declined');
            setIsFindingDriver(false);
            setAcceptedRide(null);
            sessionStorage.setItem('ride_status', 'declined');
            sessionStorage.setItem('ride_isFinding', 'false');
            sessionStorage.removeItem('ride_pending_id');
            setTimeout(() => setRideStatus(prev => prev === 'declined' ? null : prev), 8000);
        };

        const onDriverArrived = (data) => {
            console.log('PASSENGER: Driver arrived at pickup', data);
            setRideStatus('arrived');
            sessionStorage.setItem('ride_status', 'arrived');
        };

        const onRideStarted = (data) => {
            console.log('PASSENGER: Ride started', data);
            setRideStatus('ongoing');
            sessionStorage.setItem('ride_status', 'ongoing');
        };

        const onRideCompleted = (data) => {
            console.log('PASSENGER: Ride completed', data);
            // Update acceptedRide with final data (including fare) to fix zero-fare bug
            if (data) setAcceptedRide(prev => ({ ...prev, ...data }));
            setRideStatus('completed');
            sessionStorage.setItem('ride_status', 'completed');
        };

        const onActiveRideCancelled = (data) => {
            const msg = data?.reason ? `\nReason: ${data.reason}` : '';
            showToast(`Driver cancelled the ride.${msg}`, 'warning');
            handleSystemReset(true); // driver already cancelled in DB
        };

        const onPaymentSucceeded = (data) => {
            console.log('PASSENGER: Payment succeeded', data);
            setSettlementSuccess(true);
        };

        socket.on('rideAccepted', onRideAccepted);
        socket.on('rideDeclined', onRideDeclined);
        socket.on('driverArrivedAtPickup', onDriverArrived);
        socket.on('rideStarted', onRideStarted);
        socket.on('rideCompleted', onRideCompleted);
        socket.on('activeRideCancelled', onActiveRideCancelled);
        socket.on('paymentSucceeded', onPaymentSucceeded);

        // ── SIMULATION EVENTS ─────────────────────────────────────────────────
        const onSimCarUpdate = ({ location, phase, endpoints }) => {
            if (!location) return;

            // Update ref directly — zero React re-renders for position changes
            simCarPosRef.current = location;

            // Activate the sim car marker once (single state update)
            setIsSimActive(prev => prev ? prev : true);

            // ── Do NOT pan the map during simulation ──────────────────────────
            // map.panTo() every 2s was interrupting the RAF animation, causing
            // the car to appear laggy on the passenger side. The car now moves
            // smoothly in the current viewport; user can pan manually if needed.

            // Guard route endpoint updates by coordinate value, not object reference.
            // Without this, each new endpoint object causes SimulationRoute to destroy/recreate
            // the L.Routing.control and fire an OSRM network request on every tick.
            if (phase === 'to_destination' || !endpoints) {
                setSimRouteEndpoints(prev => (prev === null ? null : null));
            } else {
                setSimRouteEndpoints(prev => {
                    if (
                        prev?.from?.lat === endpoints.from?.lat &&
                        prev?.from?.lng === endpoints.from?.lng &&
                        prev?.to?.lat === endpoints.to?.lat &&
                        prev?.to?.lng === endpoints.to?.lng
                    ) return prev;
                    return endpoints;
                });
            }
        };

        const onSimPickupReached = async ({ driverName }) => {
            const confirmed = await showConfirm(
                `${driverName || 'Your driver'} has arrived at the pickup location!\n\nConfirm to start the ride to your destination.`
            );
            if (confirmed) {
                const currentSocket = socketRef.current;
                const driverUserId = acceptedRideRef.current?.driverId || acceptedRideRef.current?.driver || requestTargetDriverId;
                if (currentSocket && driverUserId) {
                    currentSocket.emit('simPassengerConfirmed', { driverUserId });
                }
            }
            // Hide passenger icon from this point on (they're in the car)
            setHidePassengerMarker(true);
        };

        const onSimDestinationReached = () => {
            setIsSimActive(false);
            simCarPosRef.current = null;
            setSimRouteEndpoints(null);
            setHidePassengerMarker(false);
        };

        socket.on('simCarUpdate', onSimCarUpdate);
        socket.on('simPickupReached', onSimPickupReached);
        socket.on('simDestinationReached', onSimDestinationReached);

        return () => {
            socket.off('rideAccepted', onRideAccepted);
            socket.off('rideDeclined', onRideDeclined);
            socket.off('driverArrivedAtPickup', onDriverArrived);
            socket.off('rideStarted', onRideStarted);
            socket.off('rideCompleted', onRideCompleted);
            socket.off('activeRideCancelled', onActiveRideCancelled);
            socket.off('paymentSucceeded', onPaymentSucceeded);
            socket.off('simCarUpdate', onSimCarUpdate);
            socket.off('simPickupReached', onSimPickupReached);
            socket.off('simDestinationReached', onSimDestinationReached);
        };
    }, [socket]);



    const handleRequestRide = async (targetDriverId) => {
        if (!pickup || !destination || !fareDetails) return;

        // Block if there's already an active ride in progress
        const activeStatuses = ['sent', 'accepted', 'arrived', 'ongoing'];
        if (rideStatus && activeStatuses.includes(rideStatus)) {
            showToast('You already have an active ride. Complete or cancel it first.', 'warning');
            return;
        }

        setIsFindingDriver(true);
        setRideStatus('sent');
        setRequestTargetDriverId(targetDriverId);

        try {
            const rideResponse = await axios.post('http://localhost:5000/api/rides/request', {
                pickup: {
                    type: 'Point',
                    coordinates: [pickup.lng, pickup.lat],
                    address: pickup.address
                },
                destination: {
                    type: 'Point',
                    coordinates: [destination.lng, destination.lat],
                    address: destination.address
                },
                distanceKm: parseFloat(fareDetails.distanceKm)
            });

            const savedRide = rideResponse.data;
            sessionStorage.setItem('ride_pending_id', savedRide._id);

            socket.emit('requestRide', {
                _id: savedRide._id,
                passengerId: user._id,
                passengerName: user.fullName,
                targetDriverId,
                pickup,
                destination,
                fare: fareDetails
            });
        } catch (error) {
            setIsFindingDriver(false);
            setRideStatus(null);
            setRequestTargetDriverId(null);
            sessionStorage.removeItem('ride_pending_id');

            const httpStatus = error.response?.status;
            const msg = error.response?.data?.message;
            const staleRideId = error.response?.data?.rideId;

            if (httpStatus === 409) {
                // Stale ride in DB — auto-cancel it so the passenger can immediately try another driver.
                // Crucially: do NOT clear pickup/destination so they can pick a different driver.
                if (staleRideId) {
                    const token = sessionStorage.getItem('token');
                    axios.put(`http://localhost:5000/api/rides/${staleRideId}/status`,
                        { status: 'cancelled' },
                        { headers: { Authorization: `Bearer ${token}` } }
                    ).catch(() => {});
                }
                // Only reset the "finding driver" state, keep the map route intact
                setIsFindingDriver(false);
                setRideStatus(null);
                setRequestTargetDriverId(null);
                setAcceptedRide(null);
                sessionStorage.removeItem('ride_pending_id');
                sessionStorage.removeItem('ride_status');
                sessionStorage.removeItem('ride_isFinding');
                sessionStorage.removeItem('ride_target_driver');
                sessionStorage.removeItem('ride_accepted');
                showToast('Previous pending ride cancelled. Your route is set — select an available driver.', 'warning');
            } else {
                showToast(msg || 'Failed to send ride request. Please try again.', 'error');
            }
        }
    };

    const handleCancelRequest = async () => {
        console.log("PASSENGER: Cancelling request...", { requestTargetDriverId, rideStatus });

        const pendingRideId = sessionStorage.getItem('ride_pending_id');

        // Update ride status in DB to 'cancelled' if it exists
        if (pendingRideId) {
            try {
                const token = sessionStorage.getItem('token');
                await axios.put(`http://localhost:5000/api/rides/${pendingRideId}/status`, {
                    status: 'cancelled'
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log("PASSENGER: Ride status updated to 'cancelled' in DB");
            } catch (error) {
                console.error("PASSENGER: Failed to update ride status to 'cancelled' in DB", error);
            }
        }

        // Emit to socket if we have a target or a ride ID
        if (socket) {
            socket.emit('cancelRideRequest', {
                rideId: acceptedRide?._id || pendingRideId || 'pending',
                targetDriverId: requestTargetDriverId
            });
        }

        // Full reset — DB already cancelled above, so skip the duplicate cancel
        handleSystemReset(true);
    };

    const handleCancelActiveRide = async () => {
        if (!acceptedRide || !socket) return;
        const reason = await showPrompt("Please provide a reason for cancelling this trip:");
        if (reason === null) return;

        const cancellationReason = reason.trim() || "No reason provided";

        try {
            const token = sessionStorage.getItem('token');
            await axios.put(`http://localhost:5000/api/rides/${acceptedRide._id}/status`, { status: 'cancelled' }, { headers: { Authorization: `Bearer ${token}` } });

            const driverId = acceptedRide.driver?._id || acceptedRide.driver || acceptedRide.driverId;
            socket.emit('cancelActiveRide', { rideId: acceptedRide._id, toUserId: driverId, cancelledBy: 'passenger', reason: cancellationReason });
            handleSystemReset(true); // DB already cancelled above
            showToast('Ride cancelled successfully.', 'success');
        } catch (error) {
            console.error("PASSENGER: Failed to cancel ride in DB", error);
            if (await showConfirm("Failed to cancel on server. Force clear this ride from your screen anyway?")) {
                handleSystemReset();
            }
        }
    };

    // skipDbCancel = true when the caller already cancelled the ride in DB
    const handleSystemReset = (skipDbCancel = false) => {
        // ── Cancel active/pending ride in DB (fire-and-forget) ────────────────
        // Ensures interrupted/emergency-reset rides don't stay stuck in DB
        if (!skipDbCancel) {
            const rideId = acceptedRide?._id || acceptedRide?.rideId || sessionStorage.getItem('ride_pending_id');
            if (rideId) {
                const token = sessionStorage.getItem('token');
                axios.put(`http://localhost:5000/api/rides/${rideId}/status`,
                    { status: 'cancelled' },
                    { headers: { Authorization: `Bearer ${token}` } }
                ).catch(() => {});
            }
        }

        // ── Clear all ride state ──────────────────────────────────────────────
        setIsFindingDriver(false);
        setRideStatus(null);
        setRequestTargetDriverId(null);
        setAcceptedRide(null);

        // ── Clear map overlays ────────────────────────────────────────────────
        setPickup(null);
        setDestination(null);
        setFareDetails(null);
        setPickupQuery('');
        setDestinationQuery('');
        setPickupResults([]);
        setDestinationResults([]);
        setPickupLoading(false);
        setDestinationLoading(false);

        // ── Clear simulation markers ──────────────────────────────────────────
        setIsSimActive(false);
        simCarPosRef.current = null;
        setSimRouteEndpoints(null);
        setHidePassengerMarker(false);

        // ── Restore drivers on map ────────────────────────────────────────────
        setShowDriversOnMap(true);

        // ── Clear session storage ─────────────────────────────────────────────
        [
            'ride_pending_id', 'ride_status', 'ride_isFinding',
            'ride_target_driver', 'ride_accepted', 'driver_arrival_notified',
            'pickup_data', 'destination_data', 'fare_data',
            'ride_pickup', 'ride_destination', 'ride_fare'
        ].forEach(k => sessionStorage.removeItem(k));

        setSettlementSuccess(false);
        setSettlementError('');
        if (momoPollerRef.current) { clearInterval(momoPollerRef.current); clearTimeout(momoPollerRef.current); momoPollerRef.current = null; }
        setMomoPhone(''); setMomoRef(null); setMomoStatus(null); setMomoProcessing(false); setMomoError('');

        // Re-center map on user location (slight delay lets state settle first)
        setTimeout(() => centerOnUser(), 100);
    };

    // ── MoMo payment via Paypack ──────────────────────────────────────────────
    const handleMomoPayment = async (e) => {
        e.preventDefault();
        // Check all possible sources for the ride ID (socket sends rideId not _id)
        const rideId = acceptedRide?._id || acceptedRide?.rideId ||
            sessionStorage.getItem('ride_pending_id');
        if (!rideId) {
            setMomoError('Could not find active ride. Please use Emergency Reset and try again.');
            return;
        }
        if (!momoPhone.trim()) {
            setMomoError('Please enter your mobile money phone number.');
            return;
        }

        setMomoProcessing(true);
        setMomoError('');
        setMomoStatus('pending');

        try {
            const { data } = await axios.post('http://localhost:5000/api/payments/charge', {
                phone: momoPhone.trim(),
                rideId
            });

            if (data.success && data.payment?.paypackRef) {
                const ref = data.payment.paypackRef;
                setMomoRef(ref);

                // ── AUTO-SUCCESS after 15 seconds ─────────────────────────────
                // Calls the cash-settle API which:
                //   1. Marks the ride as completed + paid in the DB
                //   2. Emits paymentSucceeded socket event → driver sees completion modal
                //   3. Notifies both passenger and driver
                const autoSuccessTimer = setTimeout(async () => {
                    if (momoPollerRef.current) clearInterval(momoPollerRef.current);
                    setMomoStatus('successful');
                    setMomoProcessing(false);
                    // Call the settle API so the driver is notified via socket
                    const settleRideId = acceptedRide?._id || acceptedRide?.rideId ||
                        sessionStorage.getItem('ride_pending_id');
                    if (settleRideId) {
                        try {
                            await axios.post('http://localhost:5000/api/payments/cash-settle',
                                { rideId: settleRideId },
                                { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }
                            );
                        } catch (e) {
                            // Already marked completed — harmless if this fails
                        }
                    }
                    setSettlementSuccess(true);
                }, 15000);

                // ── REAL PAYPACK POLLING (disabled — re-enable when going live) ──
                // The logic below polls Paypack every 4s for the actual USSD/PIN
                // confirmation. Uncomment this block and remove the auto-success
                // timer above to switch to real payment verification.
                /*
                let attempts = 0;
                setTimeout(() => {
                    momoPollerRef.current = setInterval(async () => {
                        attempts++;
                        try {
                            const { data: st } = await axios.get(`http://localhost:5000/api/payments/status/${ref}`);
                            if (st.status === 'successful') {
                                clearTimeout(autoSuccessTimer);
                                clearInterval(momoPollerRef.current);
                                setMomoStatus('successful');
                                setMomoProcessing(false);
                                setSettlementSuccess(true);
                            } else if (st.status === 'failed') {
                                clearTimeout(autoSuccessTimer);
                                clearInterval(momoPollerRef.current);
                                setMomoStatus('failed');
                                setMomoProcessing(false);
                                setMomoError('Transaction was declined or failed on your phone.');
                            }
                        } catch (e) {}
                        if (attempts >= 28) {
                            clearTimeout(autoSuccessTimer);
                            clearInterval(momoPollerRef.current);
                            setMomoStatus('failed');
                            setMomoProcessing(false);
                            setMomoError('Payment timed out. Check your phone and dial *182# if needed.');
                        }
                    }, 4000);
                }, 15000);
                */
            }
        } catch (err) {
            setMomoProcessing(false);
            setMomoStatus(null);
            setMomoError(err.response?.data?.message || 'Failed to initiate payment. Try again.');
        }
    };

    const handleCashSettlement = async () => {
        const rideId = acceptedRide?._id || acceptedRide?.rideId || sessionStorage.getItem('ride_pending_id');
        if (!rideId) {
            setSettlementError("No active ride found to settle.");
            return;
        }

        setIsSettling(true);
        setSettlementError('');
        try {
            await axios.post('http://localhost:5000/api/payments/cash-settle', { rideId });
            setSettlementSuccess(true);
        } catch (err) {
            console.error("Direct Settlement Error:", err);
            setSettlementError(err.response?.data?.message || err.message || "Settlement failed.");
        } finally {
            setIsSettling(false);
        }
    };


    return (
        <div className="h-[calc(100vh-110px)] flex flex-col lg:flex-row overflow-hidden rounded-2xl shadow-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">

            {/* MAP AREA */}
            <div className="flex-1 relative bg-gray-100 dark:bg-gray-950">
                {/* Searching indicator moved from here */}

                <LeafletMap
                    pickup={pickup}
                    setPickup={setPickup}
                    destination={destination}
                    setDestination={setDestination}
                    onRouteFound={handleRouteFound}
                    userLocation={userLocation}
                    drivers={showDriversOnMap && !isSimActive ? activeDrivers : []}
                    focusLocation={focusLocation}
                    isLocked={isRideActive}
                    simCarPosRef={simCarPosRef}
                    isSimActive={isSimActive}
                    simRouteEndpoints={simRouteEndpoints}
                    hideUserMarker={isSimActive}
                    hideAccuracyCircle={isSimActive || isRideActive}
                    hidePassengerMarkers={hidePassengerMarker}
                    onDriverClick={(loc) => loc && setFocusLocation({ lat: loc.lat, lng: loc.lng, zoom: 18, _t: Date.now() })}
                    onPassengerClick={(loc) => loc && setFocusLocation({ lat: loc.lat, lng: loc.lng, zoom: 18, _t: Date.now() })}
                />
            </div>

            {/* RIGHT PANEL - FORM & DRIVERS */}
            <div className="w-full lg:w-96 bg-white dark:bg-gray-800 flex flex-col border-l border-gray-100 dark:border-gray-800 overflow-hidden">
                {/* Panel Header with Integrated Map Controls */}
                <div className="p-4 border-b dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between items-center">
                    <h2 className="text-sm font-black dark:text-white uppercase tracking-tighter italic flex items-center gap-2">
                        <Navigation size={18} className="text-blue-600" /> Book Ride
                    </h2>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={centerOnUser}
                            className="p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:bg-gray-50 transition active:scale-95"
                            title="My Location"
                        >
                            <Navigation size={16} className="text-blue-600" />
                        </button>
                        <button
                            onClick={handleResetMap}
                            disabled={isRideActive}
                            className={`p-2 rounded-xl shadow-sm border transition active:scale-95 ${isRideActive
                                ? 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 cursor-not-allowed opacity-40'
                                : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:bg-gray-50'
                                }`}
                            title={isRideActive ? 'Cannot reset during active ride' : 'Reset Selected Locations'}
                        >
                            <RotateCw size={16} className={isRideActive ? 'text-gray-400' : 'text-blue-600'} />
                        </button>
                        <button
                            onClick={() => { setShowDriversOnMap(prev => !prev); }}
                            className={`p-2 rounded-xl shadow-sm border transition active:scale-95 ${showDriversOnMap ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-400'}`}
                            title="Toggle Drivers on Map"
                        >
                            <Car size={16} />
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-8 custom-scrollbar">

                    {/* BOOKING SECTION */}
                    <div className="space-y-6">
                        {/* ── LOCATION SEARCH (rebuilt from scratch) ─────────────── */}
                        <div className="bg-gray-950 rounded-2xl overflow-visible border border-gray-800">

                            {/* ── PICKUP ROW ─────────────────────────────────────── */}
                            <div className="px-4 pt-3 pb-2">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)] shrink-0" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Pickup</span>
                                </div>

                                {pickup ? (
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs font-semibold text-gray-200 truncate flex-1">{pickup.label || pickup.address}</p>
                                        {!isRideActive && (
                                            <button onClick={handleEditPickup} className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 shrink-0">
                                                <X size={12} className="text-gray-400" />
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <input
                                            type="text"
                                            autoComplete="off"
                                            disabled={isRideActive}
                                            placeholder="Type a city, area or place name…"
                                            value={pickupQuery}
                                            onChange={(e) => {
                                                setPickupQuery(e.target.value);
                                                searchLocation(e.target.value, 'pickup');
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') { e.preventDefault(); searchImmediate(pickupQuery, 'pickup'); }
                                            }}
                                            className="w-full bg-transparent outline-none text-sm text-gray-200 placeholder-gray-600 pr-6 disabled:cursor-not-allowed"
                                        />
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2">
                                            {pickupLoading
                                                ? <Loader2 size={13} className="animate-spin text-rra-blue" />
                                                : pickupQuery && <button type="button" onClick={() => { setPickupQuery(''); setPickupResults([]); }} className="text-gray-600 hover:text-gray-400"><X size={13} /></button>
                                            }
                                        </div>
                                    </div>
                                )}

                                {/* Pickup results dropdown */}
                                {!pickup && pickupResults.length > 0 && (
                                    <div className="mt-2 -mx-4 border-t border-gray-800 max-h-52 overflow-y-auto no-scrollbar">
                                        {pickupResults.map((r, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    setPickup({ lat: r.lat, lng: r.lng, address: r.label, label: r.label });
                                                    setPickupResults([]);
                                                    setPickupQuery('');
                                                }}
                                                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-800 transition-colors text-left border-b border-gray-800/60 last:border-0"
                                            >
                                                <MapPin size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-gray-200 truncate">{r.label}</p>
                                                    {r.sublabel && <p className="text-[10px] text-gray-600 truncate mt-0.5">{r.sublabel}</p>}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {!pickup && !pickupLoading && pickupQuery.length >= 2 && pickupResults.length === 0 && (
                                    <p className="mt-2 text-[10px] text-gray-600 italic">No results for "{pickupQuery}" — try a different spelling</p>
                                )}
                            </div>

                            {/* Divider with timeline line */}
                            <div className="flex items-center gap-2 px-4 py-0.5">
                                <div className="ml-1 w-px h-4 bg-gray-700" />
                            </div>

                            {/* ── DESTINATION ROW ─────────────────────────────────── */}
                            <div className="px-4 pt-2 pb-3">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)] shrink-0" />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-rose-400">Destination</span>
                                </div>

                                {destination ? (
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs font-semibold text-gray-200 truncate flex-1">{destination.label || destination.address}</p>
                                        {!isRideActive && (
                                            <button onClick={handleEditDestination} className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 shrink-0">
                                                <X size={12} className="text-gray-400" />
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <input
                                            type="text"
                                            autoComplete="off"
                                            disabled={isRideActive}
                                            placeholder="Type a city, area or place name…"
                                            value={destinationQuery}
                                            onChange={(e) => {
                                                setDestinationQuery(e.target.value);
                                                searchLocation(e.target.value, 'destination');
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') { e.preventDefault(); searchImmediate(destinationQuery, 'destination'); }
                                            }}
                                            className="w-full bg-transparent outline-none text-sm text-gray-200 placeholder-gray-600 pr-6 disabled:cursor-not-allowed"
                                        />
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2">
                                            {destinationLoading
                                                ? <Loader2 size={13} className="animate-spin text-rra-blue" />
                                                : destinationQuery && <button type="button" onClick={() => { setDestinationQuery(''); setDestinationResults([]); }} className="text-gray-600 hover:text-gray-400"><X size={13} /></button>
                                            }
                                        </div>
                                    </div>
                                )}

                                {/* Destination results dropdown */}
                                {!destination && destinationResults.length > 0 && (
                                    <div className="mt-2 -mx-4 border-t border-gray-800 max-h-52 overflow-y-auto no-scrollbar">
                                        {destinationResults.map((r, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    setDestination({ lat: r.lat, lng: r.lng, address: r.label, label: r.label });
                                                    setDestinationResults([]);
                                                    setDestinationQuery('');
                                                }}
                                                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-800 transition-colors text-left border-b border-gray-800/60 last:border-0"
                                            >
                                                <MapPin size={14} className="text-rose-400 mt-0.5 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-gray-200 truncate">{r.label}</p>
                                                    {r.sublabel && <p className="text-[10px] text-gray-600 truncate mt-0.5">{r.sublabel}</p>}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {!destination && !destinationLoading && destinationQuery.length >= 2 && destinationResults.length === 0 && (
                                    <p className="mt-2 text-[10px] text-gray-600 italic">No results for "{destinationQuery}" — try a different spelling</p>
                                )}
                            </div>
                        </div>

                        {/* FARE DETAILS */}
                        {pickup && destination && fareDetails && (
                            <div className="p-4 rounded-2xl bg-gray-900 border-2 border-yellow-500 text-gray-200 text-sm space-y-1">
                                <div className="flex justify-between text-xs opacity-70">
                                    <span>Distance</span>
                                    <span>{fareDetails.distanceKm} km</span>
                                </div>
                                <div className="flex justify-between text-xs opacity-70 border-b border-gray-800 pb-2 mb-2">
                                    <span>Est. Time</span>
                                    <span>{fareDetails.timeMin} min</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Base</span>
                                    <span>{fareDetails.baseFare} RWF</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Tax</span>
                                    <span>{fareDetails.taxAmount} RWF</span>
                                </div>
                                <div className="flex justify-between font-black text-lg pt-2 border-t border-gray-800 mt-2 text-yellow-400">
                                    <span>Total</span>
                                    <span>{fareDetails.totalFare.toLocaleString()} RWF</span>
                                </div>
                            </div>
                        )}

                        {/* MOVE RIDE STATUS NOTIFICATIONS HERE */}
                        <div className="space-y-4 animate-in fade-in duration-500">
                            {rideStatus === 'sent' && (
                                <div className="p-5 rounded-2xl bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-500 shadow-xl overflow-hidden relative">
                                    <div className="absolute top-0 right-0 p-2">
                                        <RotateCw size={14} className="text-blue-500 animate-spin" />
                                    </div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white animate-pulse">
                                            <Zap size={16} />
                                        </div>
                                        <h3 className="font-black text-blue-600 dark:text-blue-400">Request Sent</h3>
                                    </div>
                                    <p className="text-xs text-blue-500 font-bold opacity-80 italic mb-4">We are notifying the selected driver. Please wait...</p>
                                    <button
                                        onClick={handleCancelRequest}
                                        className="w-full py-2 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-[10px] font-black rounded-lg uppercase hover:bg-red-200 dark:hover:bg-red-900/60 transition flex items-center justify-center gap-2"
                                    >
                                        <XCircle size={14} />
                                        Cancel Request
                                    </button>
                                </div>
                            )}

                            {isFindingDriver && !rideStatus && (
                                <div className="p-5 rounded-2xl bg-gray-50 dark:bg-gray-900/30 border-2 border-gray-300 dark:border-gray-700 shadow-xl overflow-hidden relative border-dashed">
                                    <div className="absolute top-0 right-0 p-2">
                                        <RotateCw size={14} className="text-gray-400 animate-spin" />
                                    </div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-gray-500">
                                            <Search size={16} className="animate-pulse" />
                                        </div>
                                        <h3 className="font-black text-gray-600 dark:text-gray-400">Finding Driver...</h3>
                                    </div>
                                    <p className="text-xs text-gray-500 font-bold opacity-80 italic mb-4">Establishing connection with the driver network...</p>
                                    <button
                                        onClick={handleCancelRequest}
                                        className="w-full py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] font-black rounded-lg uppercase hover:bg-gray-200 dark:hover:bg-gray-700 transition flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700"
                                    >
                                        <XCircle size={14} />
                                        Stop Searching
                                    </button>
                                </div>
                            )}

                            {rideStatus === 'accepted' && acceptedRide && (
                                <div
                                    onClick={() => {
                                        // Use local pickup/destination — always flat {lat,lng} objects
                                        if (pickup && destination) {
                                            setFocusLocation({
                                                type: 'route',
                                                pickup,
                                                destination,
                                                _t: Date.now()
                                            });
                                        } else if (pickup) {
                                            setFocusLocation({ ...pickup, _t: Date.now() });
                                        }
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 border-2 border-emerald-500 shadow-xl animate-in fade-in zoom-in duration-500 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                                            <CheckCircle size={24} className="animate-in zoom-in duration-500" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-black text-emerald-600 dark:text-emerald-400 text-lg">Ride Approved!</h3>
                                            <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest leading-none">Driver is on the way</p>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // Use local pickup/destination — always flat {lat,lng} objects
                                                if (pickup && destination) {
                                                    setFocusLocation({
                                                        type: 'route',
                                                        pickup,
                                                        destination,
                                                        _t: Date.now()
                                                    });
                                                } else if (pickup) {
                                                    setFocusLocation({ ...pickup, _t: Date.now() });
                                                }
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }}
                                            className="p-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-200 dark:hover:bg-emerald-800 transition shadow-sm"
                                            title="Recenter Map"
                                        >
                                            <Navigation size={18} />
                                        </button>
                                    </div>
                                    <div className="mt-4 p-3 bg-white/50 dark:bg-white/5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                                        <p className="uppercase tracking-widest text-[9px] font-black opacity-50 mb-2">Assigned Driver & Locations</p>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-xs shadow-sm">
                                                    {acceptedRide.driverName?.charAt(0) || 'D'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                                                        {acceptedRide.driverName || 'Verified Driver'}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleCancelActiveRide(); }}
                                                className="px-3 py-1.5 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-[10px] font-black rounded-lg uppercase hover:bg-red-200 dark:hover:bg-red-900/60 transition flex items-center gap-1"
                                            >
                                                <XCircle size={12} />
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {rideStatus === 'arrived' && acceptedRide && (
                                <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-500 shadow-xl relative overflow-hidden">
                                    {/* Sparkling background for the card */}
                                    <span className="absolute inset-0 pointer-events-none">
                                        <span style={{ animation: 'sparkle2 1.8s ease-in-out infinite' }} className="absolute top-1 left-4 w-1.5 h-1.5 rounded-full bg-amber-400 opacity-60"></span>
                                        <span style={{ animation: 'sparkle2 1.8s 0.6s ease-in-out infinite' }} className="absolute top-3 right-8 w-1 h-1 rounded-full bg-white opacity-80"></span>
                                        <span style={{ animation: 'sparkle2 1.8s 1.2s ease-in-out infinite' }} className="absolute bottom-2 left-1/3 w-1 h-1 rounded-full bg-amber-200 opacity-70"></span>
                                    </span>
                                    <style>{`
                                        @keyframes sparkle2 {
                                            0%,100%{opacity:0;transform:scale(0.7);}
                                            50%{opacity:0.9;transform:scale(1.3);}
                                        }
                                    `}</style>
                                    <div className="flex items-center gap-3 mb-2 relative z-10">
                                        <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white">
                                            <MapPin size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-black text-amber-600 dark:text-amber-400 text-lg">Driver Arrived!</h3>
                                            <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">Please meet at the pickup point</p>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (pickup && destination) {
                                                    setFocusLocation({
                                                        type: 'route',
                                                        pickup,
                                                        destination,
                                                        _t: Date.now()
                                                    });
                                                } else if (pickup) {
                                                    setFocusLocation({ ...pickup, _t: Date.now() });
                                                }
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }}
                                            className="p-2 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-xl hover:bg-amber-200 dark:hover:bg-amber-800 transition shadow-sm"
                                            title="Recenter on Map"
                                        >
                                            <Navigation size={18} />
                                        </button>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-amber-200/50 dark:border-amber-800/50">
                                        <button
                                            onClick={() => {
                                                if (socket) {
                                                    const driverUserId = acceptedRide?.driverId || acceptedRide?.driver || requestTargetDriverId;
                                                    console.log("PASSENGER: Confirming ride start to driver:", driverUserId);
                                                    socket.emit('simPassengerConfirmed', { driverUserId });
                                                    // Also locally hide marker if simulation is happening
                                                    setHidePassengerMarker(true);
                                                }
                                            }}
                                            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle size={14} />
                                            Confirm & Start Trip
                                        </button>
                                        <p className="text-[9px] text-amber-600/70 text-center mt-2 font-bold italic">Confirm when you are inside the vehicle</p>
                                    </div>
                                </div>
                            )}

                            {rideStatus === 'ongoing' && acceptedRide && (
                                <div className="p-5 rounded-2xl bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-500 shadow-xl">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
                                            <RotateCw size={24} className="animate-spin" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-black text-blue-600 dark:text-blue-400 text-lg">Ride in Progress</h3>
                                            <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">Heading to {destination?.address?.split(',')[0] || 'Destination'}</p>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (destination && pickup) {
                                                    setFocusLocation({
                                                        type: 'route',
                                                        pickup: pickup,
                                                        destination: destination,
                                                        _t: Date.now()
                                                    });
                                                } else if (destination) {
                                                    setFocusLocation({ ...destination, _t: Date.now() });
                                                }
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }}
                                            className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-800 transition shadow-sm"
                                            title="Recenter on Map"
                                        >
                                            <Navigation size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {rideStatus === 'completed' && acceptedRide && (
                                <div className="rounded-2xl bg-white dark:bg-gray-800 border-2 border-emerald-500 shadow-xl animate-in zoom-in-95 duration-500 overflow-hidden">
                                    {/* Header */}
                                    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-4 flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                                            <CheckCircle size={20} className="text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-white text-sm">Ride Complete!</h3>
                                            <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-widest">You have arrived safely</p>
                                        </div>
                                    </div>

                                    <div className="p-4 space-y-4">
                                        {/* Fare summary */}
                                        <div className="bg-gray-50 dark:bg-gray-900/40 rounded-xl p-3 space-y-1.5 text-xs font-bold">
                                            <div className="flex justify-between text-gray-900 dark:text-white">
                                                <span>Total Fare</span>
                                                <span className="text-emerald-600 font-black">{(acceptedRide.fare?.totalFare || acceptedRide.totalFare || 0).toLocaleString()} RWF</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400 text-[10px]">
                                                <span>RRA Tax</span>
                                                <span>{Math.round((acceptedRide.fare?.taxAmount || (acceptedRide.fare?.totalFare || acceptedRide.totalFare || 0) * 0.18)).toLocaleString()} RWF</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400 text-[10px]">
                                                <span>Driver</span>
                                                <span>{acceptedRide.driverName || 'Driver'}</span>
                                            </div>
                                        </div>

                                        {/* Payment successful state */}
                                        {(settlementSuccess || momoStatus === 'successful') ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                                                    <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                                                    <div>
                                                        <p className="text-xs font-black text-emerald-700 dark:text-emerald-300">Payment Confirmed!</p>
                                                        <p className="text-[10px] text-emerald-500 font-medium">Driver has been notified.</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => handleSystemReset(true)} className="w-full py-2.5 text-white rounded-xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all" style={{ background: 'var(--rra-blue)' }}>
                                                    Done — Book Another Ride
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                {/* MoMo payment form */}
                                                {!momoProcessing ? (
                                                    <form onSubmit={handleMomoPayment} className="space-y-3">
                                                        <p className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pay with Mobile Money</p>
                                                        <div className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus-within:border-rra-blue transition-all">
                                                            <Smartphone size={15} className="text-gray-400 shrink-0" />
                                                            <input
                                                                type="tel"
                                                                placeholder="07xxxxxxxx (MoMo number)"
                                                                value={momoPhone}
                                                                onChange={e => setMomoPhone(e.target.value)}
                                                                className="bg-transparent outline-none text-sm font-semibold text-gray-900 dark:text-white placeholder-gray-400 w-full"
                                                                required
                                                            />
                                                        </div>
                                                        {momoError && (
                                                            <div className="flex items-center gap-2 text-[10px] text-red-500 font-bold">
                                                                <AlertCircle size={12} className="shrink-0" />
                                                                {momoError}
                                                            </div>
                                                        )}
                                                        <button type="submit" className="w-full py-3 text-white rounded-xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md" style={{ background: 'var(--rra-blue)' }}>
                                                            <DollarSign size={14} />
                                                            Pay {(acceptedRide.fare?.totalFare || acceptedRide.totalFare || 0).toLocaleString()} RWF via MoMo
                                                        </button>
                                                        <div className="relative flex items-center gap-2">
                                                            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">or</span>
                                                            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                                                        </div>
                                                        <button type="button" onClick={handleCashSettlement} disabled={isSettling} className="w-full py-2.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                                                            {isSettling ? <RotateCw size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                                            {isSettling ? 'Processing...' : 'Paid by Cash / Direct Transfer'}
                                                        </button>
                                                        {settlementError && <p className="text-[10px] text-red-500 font-bold text-center">{settlementError}</p>}
                                                    </form>
                                                ) : (
                                                    /* MoMo USSD pending state */
                                                    <div className="text-center space-y-3 py-2">
                                                        <div className="relative w-12 h-12 mx-auto">
                                                            <div className="absolute inset-0 rounded-full border-4 border-gray-100 dark:border-gray-700" />
                                                            <div className="absolute inset-0 rounded-full border-4 border-t-rra-blue animate-spin" style={{ borderTopColor: 'var(--rra-blue)' }} />
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-gray-900 dark:text-white">USSD Prompt Sent!</p>
                                                            <p className="text-[10px] text-gray-500 font-medium mt-0.5">Check <span className="font-black text-gray-700 dark:text-gray-300">{momoPhone}</span> and enter your PIN</p>
                                                        </div>
                                                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-[10px] text-blue-700 dark:text-blue-300 font-medium space-y-1 text-left">
                                                            <p>1. A push prompt has been sent to your phone</p>
                                                            <p>2. Enter your MoMo PIN to authorize</p>
                                                            <p>3. This screen updates automatically...</p>
                                                        </div>
                                                        {momoRef && <p className="text-[9px] text-gray-400 font-mono">Ref: {momoRef}</p>}
                                                        {momoStatus === 'failed' && (
                                                            <div className="space-y-2">
                                                                <p className="text-[10px] text-red-500 font-bold">{momoError}</p>
                                                                <button onClick={() => { setMomoProcessing(false); setMomoStatus(null); setMomoError(''); }} className="text-xs font-bold text-rra-blue hover:underline">
                                                                    Try Again
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {rideStatus === 'declined' && (
                                <div className="p-5 rounded-2xl bg-red-50 dark:bg-red-900/30 border-2 border-red-500 shadow-xl animate-in slide-in-from-top-4 duration-500">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg shadow-red-500/30">
                                            <XCircle size={24} />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-red-600 dark:text-red-400 text-lg">Request Declined</h3>
                                            <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest leading-none">Driver unavailable</p>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-red-600/70 font-bold mt-2">Unfortunately, the selected driver could not accept your trip. Please try another driver.</p>
                                </div>
                            )}
                        </div>

                        {/* SEPARATE NEARBY DRIVERS SECTION */}
                        <div className="pt-6 border-t dark:border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-black dark:text-white flex items-center gap-2">
                                    <Zap size={16} className="text-amber-500" />
                                    Available Drivers
                                </h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            if (socket) {
                                                socket.emit('getNearbyDrivers');
                                                // Force re-center on user
                                                centerOnUser();
                                            }
                                        }}
                                        className="p-1.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:bg-gray-50 rounded-lg transition active:rotate-180 duration-500 shadow-sm"
                                        title="Refresh List & View"
                                    >
                                        <RotateCw size={14} className="text-blue-500" />
                                    </button>
                                    <span className="text-[10px] bg-blue-100 text-blue-600 font-bold px-2 py-0.5 rounded-full">
                                        {activeDrivers.length} NEARBY
                                    </span>
                                </div>
                            </div>

                            {activeDrivers.length === 0 ? (
                                <div className="p-8 text-center bg-gray-50 dark:bg-gray-900/50 rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-800">
                                    <Navigation size={24} className="mx-auto mb-2 text-gray-300 opacity-50" />
                                    <p className="text-xs font-bold text-gray-400">No active drivers in your area</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    {activeDrivers.map(driver => (
                                        <div
                                            key={driver._id}
                                            onClick={() => {
                                                if (driver.location) {
                                                    setFocusLocation({
                                                        lat: driver.location.lat,
                                                        lng: driver.location.lng,
                                                        _t: Date.now()
                                                    });
                                                    setShowDriversOnMap(true); // Force visibility if clicked from list
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }
                                            }}
                                            className="flex items-center justify-between p-3 bg-white dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700/50 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition group shadow-sm hover:shadow-md"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                    <Zap size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black dark:text-white">{driver.fullName || 'Driver'}</p>
                                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Active Online</p>
                                                </div>
                                            </div>
                                            <div className="text-right flex flex-col items-end gap-2">
                                                {userLocation && driver.location && (
                                                    <div className="mb-0.5 text-right">
                                                        <p className="text-xs font-black text-blue-600 dark:text-blue-400">
                                                            {getETA(calculateDistance(userLocation.lat, userLocation.lng, driver.location.lat, driver.location.lng))} min
                                                        </p>
                                                        <p className="text-[9px] text-gray-400 uppercase font-bold tracking-tighter">
                                                            {calculateDistance(userLocation.lat, userLocation.lng, driver.location.lat, driver.location.lng).toFixed(1)} km
                                                        </p>
                                                    </div>
                                                )}

                                                <div className="flex gap-2">
                                                    {['accepted', 'arrived', 'ongoing'].includes(rideStatus) && acceptedRide && (acceptedRide.driverId === (driver.driverId || driver._id)) ? (
                                                        <div className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-black rounded-lg uppercase border border-emerald-200 dark:border-emerald-800">
                                                            Your Driver
                                                        </div>
                                                    ) : requestTargetDriverId === driver._id && rideStatus === 'sent' ? (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleCancelRequest(); }}
                                                            className="px-3 py-1.5 bg-red-100 text-red-600 text-[10px] font-black rounded-lg uppercase hover:bg-red-200 transition"
                                                        >
                                                            Cancel
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleRequestRide(driver._id); }}
                                                            disabled={!pickup || !destination || !fareDetails || isFindingDriver || rideStatus === 'accepted'}
                                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition ${pickup && destination && fareDetails && !isFindingDriver && rideStatus !== 'accepted'
                                                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                                }`}
                                                        >
                                                            Request
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Emergency Reset Button */}
                        <div className="p-4 border-t dark:border-gray-700 bg-gray-50/30 dark:bg-gray-900/40">
                            <button
                                onClick={async () => { if (await showConfirm("This will clear all current ride data locally. Use only if stuck. Proceed?")) handleSystemReset(); }}
                                className="w-full py-3 bg-gray-100 hover:bg-red-50 dark:bg-gray-800 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 border border-transparent hover:border-red-200 dark:hover:border-red-800/50"
                            >
                                <RotateCw size={14} /> Emergency Reset
                            </button>
                        </div>
                    </div>
                </div>

                {/* Completion Overlay — full MoMo payment flow */}
                {rideStatus === 'completed' && (
                    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-500">
                        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-500">

                            {/* ── SUCCESS STATE ── */}
                            {(settlementSuccess || momoStatus === 'successful') ? (
                                <div className="text-center">
                                    <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/30">
                                        <CheckCircle size={44} className="animate-in zoom-in duration-500" />
                                    </div>
                                    <h2 className="text-2xl font-black dark:text-white mb-2">Payment Confirmed!</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-8">
                                        Payment received. The driver has been notified. Thank you for using RideShare!
                                    </p>
                                    <button
                                        onClick={() => handleSystemReset(true)}
                                        className="w-full py-4 text-white rounded-2xl font-black shadow-lg transition-all active:scale-95"
                                        style={{ background: 'var(--rra-blue)' }}
                                    >
                                        Done — Book Another Ride
                                    </button>
                                </div>

                            /* ── MOMO PENDING (USSD sent, waiting for PIN) ── */
                            ) : momoProcessing ? (
                                <div className="text-center space-y-5">
                                    <div className="relative w-16 h-16 mx-auto">
                                        <div className="absolute inset-0 rounded-full border-4 border-gray-100 dark:border-gray-700" />
                                        <div className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin" style={{ borderTopColor: 'var(--rra-blue)' }} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black dark:text-white">USSD Prompt Sent!</h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                            Check <span className="font-black text-gray-700 dark:text-gray-200">{momoPhone}</span> and enter your MoMo PIN
                                        </p>
                                    </div>
                                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-xs text-blue-700 dark:text-blue-300 font-medium space-y-1 text-left">
                                        <p>1. A push prompt has been sent to your phone</p>
                                        <p>2. Enter your MoMo PIN to authorize payment</p>
                                        <p>3. This screen updates automatically once confirmed</p>
                                    </div>
                                    {momoRef && <p className="text-[9px] text-gray-400 font-mono">Ref: {momoRef}</p>}
                                    {momoStatus === 'failed' && (
                                        <div className="space-y-2">
                                            <p className="text-xs text-red-500 font-bold">{momoError}</p>
                                            <button
                                                onClick={() => { setMomoProcessing(false); setMomoStatus(null); setMomoError(''); }}
                                                className="text-sm font-bold underline" style={{ color: 'var(--rra-blue)' }}
                                            >
                                                Try Again
                                            </button>
                                        </div>
                                    )}
                                </div>

                            /* ── PAYMENT FORM ── */
                            ) : (
                                <>
                                    {/* Header */}
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                                            <CheckCircle size={30} className="text-emerald-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black dark:text-white leading-tight">You've Arrived!</h2>
                                            <p className="text-xs text-gray-400 font-medium mt-0.5">Please pay the driver below</p>
                                        </div>
                                    </div>

                                    {/* Fare summary */}
                                    <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-4 mb-5 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Total Fare</span>
                                            <span className="text-xl font-black text-emerald-600">
                                                {(acceptedRide?.fare?.totalFare || acceptedRide?.totalFare || 0).toLocaleString()} RWF
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-gray-400 font-medium">
                                            <span>Driver</span>
                                            <span className="font-bold text-gray-600 dark:text-gray-300">{acceptedRide?.driverName || 'Driver'}</span>
                                        </div>
                                    </div>

                                    {/* MoMo form */}
                                    <form onSubmit={handleMomoPayment} className="space-y-3">
                                        <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Mobile Money Number
                                        </label>
                                        <div className="flex items-center gap-3 p-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus-within:border-rra-blue transition-all" style={{ '--tw-border-opacity': 1 }}>
                                            <Smartphone size={18} className="text-gray-400 shrink-0" />
                                            <input
                                                type="tel"
                                                placeholder="07xxxxxxxx"
                                                value={momoPhone}
                                                onChange={e => setMomoPhone(e.target.value)}
                                                required
                                                autoFocus
                                                className="bg-transparent outline-none text-base font-bold text-gray-900 dark:text-white placeholder-gray-400 w-full"
                                            />
                                        </div>
                                        <p className="text-[10px] text-gray-400">Enter your Rwanda MoMo number. A USSD prompt will be sent to authorize payment.</p>

                                        {momoError && (
                                            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-600 dark:text-red-400 font-bold">
                                                <AlertCircle size={13} className="shrink-0" />
                                                {momoError}
                                            </div>
                                        )}

                                        {/* Pay via MoMo — primary action */}
                                        <button
                                            type="submit"
                                            className="w-full py-4 text-white rounded-2xl font-black text-sm shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                                            style={{ background: 'var(--rra-blue)' }}
                                        >
                                            <DollarSign size={18} />
                                            Pay {(acceptedRide?.fare?.totalFare || acceptedRide?.totalFare || 0).toLocaleString()} RWF via MoMo
                                        </button>

                                        {/* Divider */}
                                        <div className="flex items-center gap-2 my-1">
                                            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">or</span>
                                            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                                        </div>

                                        {/* Cash / direct MoMo — secondary */}
                                        <button
                                            type="button"
                                            onClick={handleCashSettlement}
                                            disabled={isSettling}
                                            className="w-full py-3 border-2 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2 hover:border-gray-300 dark:hover:border-gray-600"
                                        >
                                            {isSettling ? <RotateCw size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                                            {isSettling ? 'Processing...' : 'Paid with Cash / Direct Transfer'}
                                        </button>

                                        {settlementError && (
                                            <p className="text-[10px] text-red-500 font-bold text-center">{settlementError}</p>
                                        )}
                                    </form>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BookRide;

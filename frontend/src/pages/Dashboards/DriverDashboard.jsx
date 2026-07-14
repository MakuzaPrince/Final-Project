import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import {
    LayoutDashboard,
    Zap,
    DollarSign,
    Target,
    Navigation,
    User,
    ArrowRight,
    Power,
    MapPin,
    RotateCw,
    XCircle,
    CheckCircle,
    Bell,
    UserCircle,
    BadgeCheck,
    ChevronRight,
    TrendingUp
} from 'lucide-react';

const DriverDashboard = () => {
    const { user } = useAuth();
    const socket = useSocket();
    const navigate = useNavigate();
    const { showToast, showConfirm, showPrompt } = useDialog();
    const [isAvailable, setIsAvailable] = useState(() => {
        return sessionStorage.getItem('isDriverAvailable') === 'true';
    });
    const [rideRequests, setRideRequests] = useState(() => JSON.parse(sessionStorage.getItem('driver_requests')) || []);
    const [activeRide, setActiveRide] = useState(() => JSON.parse(sessionStorage.getItem('driver_activeRide')) || null);
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [expandedRideId, setExpandedRideId] = useState(null);
    const [recentRides, setRecentRides] = useState([]);
    const [totalRides, setTotalRides] = useState(0);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const { data } = await axios.get('http://localhost:5000/api/rides/history');
                setTotalRides(data.length);
                setRecentRides(data.slice(0, 3));
            } catch (error) {
                console.error("Error fetching driver ride history:", error);
            }
        };
        if (user) fetchHistory();
    }, [user]);

    const formatDateTime = (dateString) => {
        if (!dateString) return 'N/A';
        const d = new Date(dateString);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const getStatusStyles = (status) => {
        switch (status) {
            case 'completed': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'cancelled': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
            case 'ongoing': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            default: return 'bg-gray-100 text-gray-700';
        }
    };
    // Refs to prevent stale closures in GPS/socket callbacks
    const activeRideRef = useRef(null);
    const isAvailableRef = useRef(isAvailable);
    const socketRef = useRef(socket);
    const userRef = useRef(user);
    useEffect(() => { activeRideRef.current = activeRide; }, [activeRide]);
    useEffect(() => { isAvailableRef.current = isAvailable; }, [isAvailable]);
    useEffect(() => { socketRef.current = socket; }, [socket]);
    useEffect(() => { userRef.current = user; }, [user]);

    // Persistence Effects
    useEffect(() => {
        sessionStorage.setItem('driver_requests', JSON.stringify(rideRequests));
    }, [rideRequests]);

    useEffect(() => {
        sessionStorage.setItem('driver_activeRide', JSON.stringify(activeRide));
    }, [activeRide]);

    // Consolidated Socket Listeners
    useEffect(() => {
        if (!socket || !user) return;

        // Join room
        socket.emit('join', { userId: user._id, role: 'driver', fullName: user.fullName });
        socket.emit('getPassengers');

        sessionStorage.setItem('isDriverAvailable', isAvailable);

        if (isAvailable) {
            socket.emit('driverOnline', {
                driverId: user._id,
                fullName: user.fullName,
                location: user.location
            });
        }

        const handleNewRequest = (ride) => {
            console.log("DRIVER SOCKET: New Ride Request received:", ride);
            if (isAvailable) {
                setRideRequests((prev) => {
                    const exists = prev.find(r => r._id === ride._id);
                    if (exists) return prev;
                    return [...prev, ride];
                });
            }
        };

        const handleCancelEvent = ({ rideId }) => {
            console.log("DRIVER SOCKET: Ride cancelled by passenger:", rideId);
            setRideRequests(prev => prev.filter(r => r._id !== rideId));
        };

        const handleActiveRideCancelled = (data) => {
            const reasonMsg = data.reason ? `\nReason: ${data.reason}` : "";
            showToast(`Passenger cancelled the ride.${reasonMsg}`, 'warning');
            // handleSystemReset(); // This function is removed, so commenting out or replacing
        };

        const handlePaymentSucceeded = (data) => {
            console.log("DRIVER DASHBOARD SOCKET: Payment succeeded:", data);
            setShowCompletionModal(true);
        };

        socket.on('newRideRequest', handleNewRequest);
        socket.on('rideCancelled', handleCancelEvent);
        socket.on('activeRideCancelled', handleActiveRideCancelled);
        socket.on('paymentSucceeded', handlePaymentSucceeded);

        // Periodic polling
        const pollInterval = setInterval(() => {
            socket.emit('getPassengers');
        }, 8000);

        return () => {
            socket.off('newRideRequest', handleNewRequest);
            socket.off('rideCancelled', handleCancelEvent);
            socket.off('activeRideCancelled', handleActiveRideCancelled);
            socket.off('paymentSucceeded', handlePaymentSucceeded);
            clearInterval(pollInterval);
        };
    }, [socket, user, isAvailable]);

    // ── GPS TRACKING (Background) ───────────────────────────────────────────
    const [currentLocation, setCurrentLocation] = useState(null);
    const watchIdRef = useRef(null);
    const isTrackingRef = useRef(false);

    const startGpsTracking = () => {
        if (!navigator.geolocation || (isTrackingRef.current && watchIdRef.current !== null)) return;
        isTrackingRef.current = true;
        if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);

        watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const loc = { lat: latitude, lng: longitude };
                setCurrentLocation(loc);

                // Use refs to read current values — avoids stale closure bug
                const currentSocket = socketRef.current;
                const currentUser = userRef.current;
                if (currentSocket && currentUser && isAvailableRef.current) {
                    const geoLoc = { type: 'Point', coordinates: [longitude, latitude] };
                    currentSocket.emit('updateLocation', { userId: currentUser._id, role: 'driver', fullName: currentUser.fullName, location: geoLoc });
                    currentSocket.emit('driverOnline', { driverId: currentUser._id, fullName: currentUser.fullName, location: geoLoc });
                }
            },
            (error) => {
                console.error('Driver GPS Error:', error);
                isTrackingRef.current = false;
                watchIdRef.current = null;
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
        );
    };

    useEffect(() => {
        if (socket && user) startGpsTracking();
        return () => {
            if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
        };
    }, [socket, user]);

    const handleAcceptRide = async (ride) => {
        try {
            const token = sessionStorage.getItem('token');
            await axios.put(`http://localhost:5000/api/rides/${ride._id}/status`, {
                status: 'accepted',
                driverId: user._id
            }, { headers: { Authorization: `Bearer ${token}` } });

            const acceptedRide = { ...ride, status: 'accepted', driverId: user._id };
            setActiveRide(acceptedRide);
            setRideRequests(prev => prev.filter(r => r._id !== ride._id));

            socket.emit('acceptRide', {
                rideId: ride._id,
                driverId: user._id,
                driverName: user.fullName,
                passengerId: ride.passengerId || ride.passenger
            });

            showToast('Ride Accepted! Go to Live Map to see the route.', 'success');
        } catch (error) {
            console.error("DRIVER: Failed to accept ride", error);
            showToast('Trip no longer available.', 'error');
            setRideRequests(prev => prev.filter(r => r._id !== ride._id));
        }
    };

    const handleStartRide = async () => {
        if (!activeRide) return;
        try {
            const token = sessionStorage.getItem('token');
            await axios.put(`http://localhost:5000/api/rides/${activeRide._id}/status`, { status: 'ongoing' }, { headers: { Authorization: `Bearer ${token}` } });
            setActiveRide(prev => ({ ...prev, status: 'ongoing' }));
            socket.emit('startRide', {
                rideId: activeRide._id,
                passengerId: activeRide.passengerId || activeRide.passenger,
                driverName: user.fullName,
                pickup: activeRide.pickup,
                destination: activeRide.destination,
                fare: activeRide.fare
            });
        } catch (error) {
            console.error("DRIVER: Failed to start ride", error);
        }
    };

    const handleCompleteRide = async () => {
        if (!activeRide) return;
        try {
            const pId = activeRide.passengerId || (typeof activeRide.passenger === 'object' ? activeRide.passenger._id : activeRide.passenger);
            socket.emit('completeRide', {
                rideId: activeRide._id,
                passengerId: pId,
                driverName: user.fullName,
                fare: activeRide.fare || { totalFare: activeRide.totalFare },
                pickup: activeRide.pickup,
                destination: activeRide.destination
            });
            showToast('Awaiting passenger cash/MoMo payment confirmation...', 'info');
        } catch (error) {
            console.error("DRIVER: Failed to complete ride", error);
        }
    };

    const handleCancelActiveRide = async () => {
        if (!activeRide) return;
        const reason = await showPrompt('Reason for cancelling:');
        if (reason === null) return;
        try {
            const token = sessionStorage.getItem('token');
            await axios.put(`http://localhost:5000/api/rides/${activeRide._id}/status`, { status: 'cancelled' }, { headers: { Authorization: `Bearer ${token}` } });
            socket.emit('cancelActiveRide', {
                rideId: activeRide._id,
                toUserId: activeRide.passengerId || activeRide.passenger,
                cancelledBy: 'driver',
                reason: reason || "No reason"
            });
            handleSystemReset();
        } catch (error) {
            console.error("DRIVER: Failed to cancel ride", error);
        }
    };

    const handleSystemReset = () => {
        setActiveRide(null);
        setRideRequests([]);
        sessionStorage.removeItem('driver_requests');
        sessionStorage.removeItem('driver_activeRide');
    };

    const isProfileIncomplete = !user?.fullName || !user?.phone || !user?.address || !user?.profileImage ||
        !user?.vehicle?.model || !user?.vehicle?.licensePlate;

    const stats = [
        { label: "Today's Revenue", value: activeRide && activeRide.totalFare ? `${activeRide.totalFare.toLocaleString()} RWF` : '0 RWF', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/10', path: '/driver/rides' },
        isProfileIncomplete ?
            { label: 'Complete Profile', value: 'Action Required', icon: UserCircle, color: 'text-white', bg: 'bg-amber-900 dark:bg-amber-950', path: '/driver/profile', isDark: true } :
            { label: 'Tax Summary', value: 'Platform RRA', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/10', path: '/driver/tax' },
    ];

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Status Toggle — compact */}
            <div className={`relative overflow-hidden rounded-2xl px-5 py-4 text-white transition-all duration-500 ${isAvailable ? 'bg-gradient-to-r from-emerald-600 to-teal-600' : 'bg-gradient-to-r from-gray-700 to-gray-800'}`}>
                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isAvailable ? 'bg-white/20' : 'bg-gray-500/20'}`}>
                            <Power size={20} className="text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-black tracking-tight">
                                    {isAvailable ? 'You are Online' : 'You are Offline'}
                                </h2>
                                {isAvailable && <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>}
                            </div>
                            <p className="text-white/70 text-xs font-medium">
                                {isAvailable ? 'Receiving ride requests' : 'Go online to start earning'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-black uppercase tracking-wider ${isAvailable ? 'text-emerald-300' : 'text-gray-400'}`}>
                            {isAvailable ? 'Online' : 'Offline'}
                        </span>
                        <button
                            onClick={() => {
                                const newVal = !isAvailable;
                                setIsAvailable(newVal);
                                if (!newVal && socket) socket.emit('driverOffline', { driverId: user._id });
                            }}
                            className={`relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-300 focus:outline-none shadow-md ${isAvailable ? 'bg-emerald-400' : 'bg-gray-600'}`}
                        >
                            <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-all duration-300 shadow-sm ${isAvailable ? 'translate-x-9' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 -mr-10 -mt-10 rounded-full bg-white/5 blur-2xl"></div>
            </div>

            {/* Dashboard Body */}
            <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {stats.map((stat, index) => (
                        <button
                            key={index}
                            onClick={() => stat.path !== '#' && navigate(stat.path)}
                            className={`p-6 rounded-[2.5rem] shadow-xl border-2 transition-all active:scale-95 group text-left w-full flex items-center gap-6 ${stat.isDark ? 'bg-amber-900 text-white border-amber-800' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-emerald-500/30'}`}
                        >
                            <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                                <stat.icon size={26} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-[10px] font-black uppercase tracking-widest italic ${stat.isDark ? 'text-amber-200' : 'text-gray-400'}`}>{stat.label}</p>
                                <p className={`text-2xl font-black mt-1 tracking-tighter ${stat.isDark ? 'text-white' : 'dark:text-white'}`}>{stat.value}</p>
                            </div>
                            {stat.path !== '#' && <ChevronRight className={`${stat.isDark ? 'text-amber-400' : 'text-gray-300'} group-hover:text-emerald-500 group-hover:translate-x-1 transition-all`} />}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Feed Area */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                                <Zap size={18} className="text-rra-blue" />
                                Tax Insights
                            </h2>
                            {rideRequests.length > 0 && (
                                <span className="bg-rra-blue/10 text-rra-blue text-xs font-black px-2.5 py-1 rounded-full">{rideRequests.length} NEW</span>
                            )}
                        </div>

                        {rideRequests.length === 0 && !activeRide && (
                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
                                {/* Tax Insights header */}
                                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-xl bg-rra-blue/10">
                                            <TrendingUp size={16} className="text-rra-blue" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wide">Tax Insights</p>
                                            <p className="text-[10px] text-gray-400 font-medium">RRA-integrated earnings overview</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => navigate('/driver/tax')}
                                        className="text-xs font-bold text-rra-blue hover:underline"
                                    >
                                        Full Report
                                    </button>
                                </div>
                                {/* Content */}
                                <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="bg-gray-50 dark:bg-gray-900/40 rounded-xl p-4">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Total Earnings</p>
                                        <p className="text-xl font-black text-gray-900 dark:text-white">
                                            {(activeRide?.fare?.totalFare || activeRide?.totalFare || recentRides.reduce((a, r) => a + (r.totalFare || 0), 0)).toLocaleString()}
                                            <span className="text-xs font-bold text-gray-400 ml-1">RWF</span>
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-900/40 rounded-xl p-4">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Total Rides</p>
                                        <p className="text-xl font-black text-gray-900 dark:text-white">{totalRides}</p>
                                    </div>
                                    <div className="bg-rra-blue/5 dark:bg-rra-blue/10 rounded-xl p-4 border border-rra-blue/20">
                                        <p className="text-[10px] font-black text-rra-blue uppercase tracking-wider mb-1">Status</p>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                                            <p className="text-sm font-black text-gray-900 dark:text-white">{isAvailable ? 'Online · Waiting' : 'Offline'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="px-6 pb-5 text-center">
                                    <p className="text-xs text-gray-400 font-medium">
                                        {isAvailable ? 'You are online and ready to receive ride requests.' : 'Go online to start receiving ride requests and earning.'}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-4">
                            {rideRequests.map((ride) => (
                                <div key={ride._id} className="group bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-blue-100 dark:border-blue-900/30 flex flex-col md:flex-row justify-between items-center gap-6 hover:shadow-xl transition-all border-l-4 border-l-blue-500">
                                    <div className="flex items-center gap-6 flex-1">
                                        <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                                            <User size={28} className="text-blue-600" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-black dark:text-white text-lg">Instant Request</h4>
                                                <span className="text-[10px] bg-blue-100 text-blue-600 font-black px-2 py-0.5 rounded-full uppercase italic">
                                                    {ride.distanceKm} km trip
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={() => setExpandedRideId(expandedRideId === ride._id ? null : ride._id)}
                                                    className="text-[10px] font-black uppercase text-blue-500 hover:text-blue-600 underline underline-offset-4"
                                                >
                                                    {expandedRideId === ride._id ? 'Hide Details' : 'View Full Details'}
                                                </button>
                                            </div>

                                            {expandedRideId === ride._id && (
                                                <div className="mt-4 space-y-2 bg-gray-50 dark:bg-gray-900/40 p-4 rounded-2xl border border-blue-100/50 animate-in zoom-in-95 duration-300">
                                                    <div className="flex justify-between text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                                                        <span>Distance</span>
                                                        <span className="text-gray-900 dark:text-gray-200">{ride.fare?.distanceKm || ride.distanceKm} km</span>
                                                    </div>
                                                    <div className="flex justify-between text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                                                        <span>Est. Time</span>
                                                        <span className="text-gray-900 dark:text-gray-200">{ride.fare?.timeMin || Math.ceil(ride.distanceKm * 2)} min</span>
                                                    </div>
                                                    <div className="flex justify-between text-[11px] font-bold text-emerald-600 pt-2 border-t dark:border-gray-800">
                                                        <span>Base Fare</span>
                                                        <span>{ride.fare?.baseFare?.toLocaleString() || 0} RWF</span>
                                                    </div>
                                                    <div className="flex justify-between text-[11px] font-bold text-gray-400">
                                                        <span>Tax Amount (18%)</span>
                                                        <span>{ride.fare?.taxAmount?.toLocaleString() || 0} RWF</span>
                                                    </div>
                                                    <div className="flex justify-between text-base font-black text-blue-600 pt-2 border-t dark:border-gray-800">
                                                        <span>Total Price</span>
                                                        <span>{ride.fare?.totalFare?.toLocaleString() || ride.totalFare?.toLocaleString() || 0} RWF</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-3 w-full md:w-auto">
                                        <div className="bg-blue-50 dark:bg-blue-900/10 px-4 py-2 rounded-xl text-blue-600 font-bold text-xs">
                                            Go to Live Map to view route
                                        </div>
                                        <button
                                            onClick={() => handleAcceptRide(ride)}
                                            className="flex-1 md:px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                                        >
                                            Accept Trip
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {activeRide && (
                                <div className="bg-emerald-600 p-8 rounded-3xl text-white shadow-xl shadow-emerald-500/20 relative overflow-hidden">
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="flex-1">
                                                <h4 className="text-xs font-black uppercase tracking-[0.2em] mb-1 opacity-80">Your Passenger</h4>
                                                <h3 className="text-2xl font-black">{activeRide.passengerName || 'Passenger'}</h3>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                                                    <Zap size={24} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 p-4 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10 mb-4">
                                            <div className="w-12 h-12 rounded-full bg-emerald-500 overflow-hidden flex items-center justify-center shrink-0">
                                                <User size={24} />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-black uppercase tracking-widest">{activeRide.passengerName || 'Passenger Name'}</p>
                                                <div className="flex justify-between mt-1 pt-1 border-t border-white/10 text-[10px] uppercase font-black opacity-80">
                                                    <span>Dist: {activeRide.fare?.distanceKm || activeRide.distanceKm} km</span>
                                                    <span>Total: {activeRide.fare?.totalFare?.toLocaleString() || activeRide.totalFare?.toLocaleString()} RWF</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 mb-6">
                                            <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-wider">
                                                <span className="opacity-60">Base Fare</span>
                                                <span>{activeRide.fare?.baseFare?.toLocaleString() || 0} RWF</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-wider">
                                                <span className="opacity-60">Tax (RRA)</span>
                                                <span>{(activeRide.fare?.taxAmount || activeRide.fare?.tax || 0).toLocaleString()} RWF</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-wider border-t border-white/10 pt-2 mt-2">
                                                <span className="opacity-60">Trip Distance</span>
                                                <span>{activeRide.fare?.distanceKm || activeRide.distance || activeRide.distanceKm || '0.0'} KM</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-wider">
                                                <span className="opacity-60">Est. Time</span>
                                                <span>{activeRide.fare?.timeMin || activeRide.duration || '0'} MIN</span>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <button
                                                onClick={() => navigate('/driver/live-map')}
                                                className="w-full py-4 bg-white text-emerald-600 hover:bg-emerald-50 rounded-2xl font-black shadow-lg transition-all flex items-center justify-center gap-2"
                                            >
                                                <Navigation size={20} />
                                                Open Live Map
                                            </button>

                                            <div className="flex gap-2">
                                                {activeRide.status === 'accepted' ? (
                                                    <button
                                                        onClick={() => handleStartRide()}
                                                        className="flex-1 py-4 bg-white text-emerald-600 hover:bg-emerald-50 rounded-2xl font-black shadow-lg transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <CheckCircle size={20} />
                                                        Start Ride
                                                    </button>
                                                ) : (
                                                    <div className="flex-1 py-4 bg-white/20 text-white rounded-2xl font-black flex items-center justify-center gap-2 italic text-sm">
                                                        <RotateCw size={20} className="animate-spin" />
                                                        Ride In Progress
                                                    </div>
                                                )}
                                                <button
                                                    onClick={handleCancelActiveRide}
                                                    className="px-6 py-4 bg-emerald-700 hover:bg-red-600 text-white rounded-2xl font-black shadow-lg transition-all flex items-center justify-center gap-2 group"
                                                >
                                                    <XCircle size={20} className="group-hover:scale-110 transition" />
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Recent Activity Sidebar */}
                        <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden">
                            <div className="p-8 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                                <h3 className="text-xl font-black dark:text-white uppercase tracking-tighter italic">Recent Rides</h3>
                                <Link to="/driver/rides" className="text-xs font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg">View All</Link>
                            </div>
                            <div className="p-8 space-y-8 flex-1">
                                {recentRides.length === 0 ? (
                                    <div className="text-center py-10">
                                        <MapPin size={40} className="mx-auto text-gray-200 mb-4" />
                                        <p className="text-sm font-black text-gray-400 uppercase tracking-widest italic">No Journeys Found</p>
                                    </div>
                                ) : (
                                    recentRides.map((ride) => (
                                        <div key={ride._id} className="group relative flex gap-5 cursor-pointer" onClick={() => navigate('/driver/rides')}>
                                            <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-700 flex items-center justify-center shrink-0 border border-gray-100 dark:border-gray-600 group-hover:border-blue-300 transition-colors">
                                                <MapPin size={20} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                                            </div>
                                            <div className="flex-1 min-w-0 py-1">
                                                <div className="flex justify-between items-start mb-1">
                                                    <p className="text-sm font-black dark:text-white truncate uppercase tracking-tight italic">{ride.destinationLocation?.address?.split(',')[0] || 'Destination'}</p>
                                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${getStatusStyles(ride.status)} shadow-sm`}>
                                                        {ride.status}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{formatDateTime(ride.createdAt)}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
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

                        <div className="bg-gray-50 dark:bg-gray-900 rounded-3xl p-6 mb-8 border border-gray-100 dark:border-gray-800">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Total Earnings</p>
                            <p className="text-4xl font-black text-emerald-600">
                                {(activeRide?.fare?.totalFare || activeRide?.totalFare || 0).toLocaleString()} <span className="text-sm">RWF</span>
                            </p>
                        </div>

                        <button
                            onClick={() => {
                                setShowCompletionModal(false);
                                handleSystemReset();
                            }}
                            className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-xl shadow-blue-500/30 transition-all active:scale-95"
                        >
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DriverDashboard;

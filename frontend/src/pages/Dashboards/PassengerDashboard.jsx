import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import {
    MapPin, History, TrendingUp, ArrowUpRight,
    Bell, UserCircle, ChevronRight, DollarSign, Car
} from 'lucide-react';

const PassengerDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [recentRides, setRecentRides] = useState([]);
    const [totalRides, setTotalRides] = useState(0);
    const [totalSpent, setTotalSpent] = useState(0);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const { data } = await axios.get('http://localhost:5000/api/rides/history');
                setTotalRides(data.length);
                setRecentRides(data.slice(0, 3));
                const spent = data.reduce((acc, r) => acc + (r.totalFare || 0), 0);
                setTotalSpent(spent);
            } catch (error) {
                console.error("Error fetching ride history:", error);
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

    const isProfileIncomplete = !user?.fullName || !user?.phone || !user?.address || !user?.profileImage;

    return (
        <div className="w-full space-y-6 animate-in fade-in duration-500">

            {/* Hero — compact */}
            <div className="relative overflow-hidden rounded-2xl px-6 py-5 text-white shadow-lg"
                style={{ background: 'linear-gradient(135deg, #1E6BB5 0%, #155090 60%, #0f3a6b 100%)' }}>
                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl md:text-2xl font-black tracking-tight">
                            Ready to ride, {user?.fullName?.split(' ')[0] || 'Passenger'}?
                        </h1>
                        <p className="text-blue-100 text-sm font-medium opacity-80 mt-0.5">
                            Book a ride and arrive safely.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/passenger/book')}
                        className="bg-white px-6 py-3 rounded-xl font-bold text-sm shadow-md hover:bg-gray-50 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 shrink-0"
                        style={{ color: 'var(--rra-blue)' }}
                    >
                        <MapPin size={16} /> Book Now
                    </button>
                </div>
                <div className="absolute top-0 right-0 w-40 h-40 -mr-10 -mt-10 bg-white/10 rounded-full blur-2xl"></div>
            </div>

            {/* Profile incomplete banner */}
            {isProfileIncomplete && (
                <button
                    onClick={() => navigate('/passenger/profile')}
                    className="w-full flex items-center justify-between px-5 py-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl text-left hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <UserCircle size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
                        <div>
                            <p className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider">Profile Incomplete</p>
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-0.5">Complete your profile to unlock all features</p>
                        </div>
                    </div>
                    <ChevronRight size={16} className="text-amber-500 shrink-0" />
                </button>
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                    onClick={() => navigate('/passenger/history')}
                    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 text-left hover:shadow-md hover:border-rra-blue/30 transition-all group active:scale-95"
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-xl bg-rra-blue/10">
                            <History size={15} className="text-rra-blue" />
                        </div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Total Rides</p>
                    </div>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">{totalRides}</p>
                </button>

                <button
                    onClick={() => navigate('/passenger/expenses')}
                    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 text-left hover:shadow-md hover:border-rra-blue/30 transition-all group active:scale-95"
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                            <DollarSign size={15} className="text-emerald-600" />
                        </div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Total Spent</p>
                    </div>
                    <p className="text-xl font-black text-gray-900 dark:text-white">
                        {totalSpent.toLocaleString()}
                        <span className="text-xs font-bold text-gray-400 ml-1">RWF</span>
                    </p>
                </button>

                <button
                    onClick={() => navigate('/passenger/notifications')}
                    className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 text-left hover:shadow-md hover:border-rose-300 transition-all group active:scale-95"
                >
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-900/20">
                            <Bell size={15} className="text-rose-500" />
                        </div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Notifications</p>
                    </div>
                    <p className="text-sm font-bold text-gray-600 dark:text-gray-300">View alerts &amp; updates</p>
                </button>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                {/* Expense Insights */}
                <div className="lg:col-span-2 space-y-5">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wide">Expense Insights</h3>
                            <Link to="/passenger/expenses" className="text-xs font-bold text-rra-blue hover:underline">View Details</Link>
                        </div>
                        <div className="p-5">
                            <div className="grid grid-cols-2 gap-4 mb-5">
                                <div className="bg-gray-50 dark:bg-gray-900/40 rounded-xl p-4">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Spent</p>
                                    <p className="text-xl font-black text-gray-900 dark:text-white">
                                        {totalSpent.toLocaleString()}
                                        <span className="text-xs font-bold text-gray-400 ml-1">RWF</span>
                                    </p>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-900/40 rounded-xl p-4">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Avg per Trip</p>
                                    <p className="text-xl font-black text-gray-900 dark:text-white">
                                        {totalRides > 0 ? Math.round(totalSpent / totalRides).toLocaleString() : 0}
                                        <span className="text-xs font-bold text-gray-400 ml-1">RWF</span>
                                    </p>
                                </div>
                            </div>

                            {/* Spending bar (visual) */}
                            <div>
                                <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                                    <span>Spending utilization</span>
                                    <span>{totalRides} rides</span>
                                </div>
                                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${Math.min(100, (totalRides / 20) * 100)}%`, background: 'var(--rra-blue)' }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Link
                            to="/passenger/expenses"
                            className="group bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-rra-blue/40 transition-all flex items-center gap-4"
                        >
                            <div className="p-3 rounded-xl bg-rra-blue/10 group-hover:scale-110 transition-transform">
                                <TrendingUp size={18} className="text-rra-blue" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-gray-900 dark:text-white">Track Spending</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">View expense history</p>
                            </div>
                            <ArrowUpRight size={15} className="text-gray-300 group-hover:text-rra-blue transition-colors shrink-0" />
                        </Link>

                        <button
                            onClick={() => navigate('/passenger/book')}
                            className="group bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-rra-blue/40 transition-all flex items-center gap-4 text-left w-full active:scale-95"
                        >
                            <div className="p-3 rounded-xl bg-rra-blue/10 group-hover:scale-110 transition-transform">
                                <Car size={18} className="text-rra-blue" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-gray-900 dark:text-white">Book a Ride</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">Find a driver near you</p>
                            </div>
                            <ArrowUpRight size={15} className="text-gray-300 group-hover:text-rra-blue transition-colors shrink-0" />
                        </button>
                    </div>
                </div>

                {/* Recent Rides */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
                    <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wide">Recent Rides</h3>
                        <Link to="/passenger/history" className="text-xs font-bold text-rra-blue hover:underline">View All</Link>
                    </div>
                    <div className="p-4 space-y-3 flex-1">
                        {recentRides.length === 0 ? (
                            <div className="text-center py-8">
                                <MapPin size={32} className="mx-auto text-gray-200 dark:text-gray-600 mb-3" />
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">No rides yet</p>
                            </div>
                        ) : (
                            recentRides.map((ride) => (
                                <div key={ride._id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer group">
                                    <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0 group-hover:bg-rra-blue/10 transition-colors">
                                        <MapPin size={14} className="text-gray-400 group-hover:text-rra-blue transition-colors" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                            {ride.destinationLocation?.address?.split(',')[0] || 'Destination'}
                                        </p>
                                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">{formatDateTime(ride.createdAt)}</p>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-xs font-black text-gray-900 dark:text-gray-100">
                                                {ride.totalFare ? ride.totalFare.toLocaleString() : '—'}
                                                <span className="text-[9px] font-bold text-gray-400 ml-0.5">RWF</span>
                                            </span>
                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider ${getStatusStyles(ride.status)}`}>
                                                {ride.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PassengerDashboard;

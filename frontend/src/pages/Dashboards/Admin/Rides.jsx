import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
    Search,
    Filter,
    MoreHorizontal,
    Map as MapIcon,
    Clock,
    CreditCard,
    User,
    ChevronRight,
    ChevronLeft,
    ArrowUpRight,
    Navigation,
    Calendar,
    CheckCircle2,
    Download,
    RefreshCw,
    X
} from 'lucide-react';

const PAGE_SIZE = 10;

const AdminRides = () => {
    const [rides, setRides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [page, setPage] = useState(1);

    const fetchRides = async () => {
        setLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            if (!token) return;

            const { data } = await axios.get('http://localhost:5000/api/admin/rides', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRides(data);
        } catch (error) {
            console.error("Failed to fetch rides");
            // Mock data for UI development
            setRides([
                { _id: '1', passenger: { fullName: 'Sarah Passenger' }, driver: { fullName: 'John Driver' }, pickupLocation: { address: 'Kigali Heights' }, destination: { address: 'Airport' }, fare: 4500, status: 'completed', createdAt: '2026-02-16T10:00:00Z' },
                { _id: '2', passenger: { fullName: 'Alex Smith' }, driver: { fullName: 'Mike Operator' }, pickupLocation: { address: 'Nyarutarama' }, destination: { address: 'Gishushu' }, fare: 2000, status: 'ongoing', createdAt: '2026-02-16T11:30:00Z' },
                { _id: '3', passenger: { fullName: 'Jane Doe' }, driver: null, pickupLocation: { address: 'Kimironko' }, destination: { address: 'Remera' }, fare: 1500, status: 'pending', createdAt: '2026-02-16T12:00:00Z' },
            ]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRides();
    }, []);

    const getStatusStyles = (status) => {
        switch (status) {
            case 'completed': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
            case 'ongoing': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800';
            case 'pending': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800';
            case 'cancelled': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const filteredRides = useMemo(() => rides.filter(ride => {
        const matchSearch = (ride.passenger?.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (ride.driver?.fullName || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = filterStatus === 'all' || ride.status === filterStatus;
        return matchSearch && matchStatus;
    }), [rides, searchTerm, filterStatus]);

    const totalPages = Math.max(1, Math.ceil(filteredRides.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const paginatedRides = filteredRides.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    useEffect(() => { setPage(1); }, [searchTerm, filterStatus]);

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20 px-2">
            {/* Logic Control Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4">
                <div>
                    <h1 className="text-4xl font-black dark:text-white tracking-tighter italic uppercase">Transaction Flow</h1>
                    <p className="text-gray-500 dark:text-gray-400 font-bold mt-1 italic">Real-time ride logistics and revenue audit</p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    {/* Search Bar */}
                    <div className="relative flex-1 md:flex-none">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by passenger or driver..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10 pr-9 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-bold text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-rra-blue focus:border-rra-blue w-full md:w-64 transition-all"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    {/* Status Filter */}
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-black uppercase text-gray-600 dark:text-gray-300 outline-none"
                    >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="ongoing">Ongoing</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    {/* Refresh */}
                    <button onClick={fetchRides} className="p-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm text-gray-400 hover:text-blue-500 transition-colors">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Summary Metrics - Moved to top and smaller */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4">
                <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 italic">Active</p>
                        <h5 className="text-xl font-black dark:text-white italic tracking-tighter">{rides.filter(r => r.status === 'ongoing').length}</h5>
                    </div>
                </div>
                <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 italic">Pending</p>
                        <h5 className="text-xl font-black dark:text-white italic tracking-tighter">{rides.filter(r => r.status === 'pending').length}</h5>
                    </div>
                </div>
                <div className="p-4 bg-emerald-600 rounded-2xl text-white shadow-lg shadow-emerald-500/10 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest mb-0.5 opacity-60 italic">Completed</p>
                        <h5 className="text-xl font-black italic tracking-tighter">{rides.filter(r => r.status === 'completed').length}</h5>
                    </div>
                </div>
                <div className="p-4 bg-rose-600 rounded-2xl text-white shadow-lg shadow-rose-500/10 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest mb-0.5 opacity-60 italic">Cancelled</p>
                        <h5 className="text-xl font-black italic tracking-tighter">{rides.filter(r => r.status === 'cancelled').length}</h5>
                    </div>
                </div>
            </div>

            {/* High Density Ride Table */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b dark:border-gray-700">
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest italic whitespace-nowrap">Service Cycle</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest italic whitespace-nowrap">Logistics Vector</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest italic whitespace-nowrap">Financial Value</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest italic whitespace-nowrap text-right">Operational Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-gray-700">
                            {paginatedRides.length > 0 ? (
                                paginatedRides.map((ride) => (
                                    <tr key={ride._id} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all cursor-default overflow-hidden">
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl">
                                                        <User size={14} />
                                                    </div>
                                                    <span className="text-sm font-black dark:text-white uppercase italic tracking-tighter">P: {ride.passenger?.fullName || 'Anonymous'}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl">
                                                        <Navigation size={14} />
                                                    </div>
                                                    <span className="text-sm font-bold text-gray-400 uppercase italic tracking-tighter">D: {ride.driver?.fullName || 'Searching...'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="space-y-1 max-w-[200px]">
                                                <div className="flex items-center gap-2 truncate">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                                                    <span className="text-xs font-bold dark:text-gray-300 truncate">{ride.pickupLocation?.address || 'Pickup'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 truncate">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></div>
                                                    <span className="text-xs font-bold dark:text-gray-300 truncate">{ride.destination?.address || 'Destination'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-lg font-black dark:text-white tracking-tighter italic">{ride.fare?.toLocaleString()} RWF</span>
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{new Date(ride.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${getStatusStyles(ride.status)}`}>
                                                {ride.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="py-16 text-center">
                                        <MapIcon size={36} className="mx-auto text-gray-200 dark:text-gray-600 mb-3" />
                                        <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
                                            {searchTerm || filterStatus !== 'all' ? 'No rides match your search' : 'No rides found'}
                                        </p>
                                        {(searchTerm || filterStatus !== 'all') && (
                                            <button
                                                onClick={() => { setSearchTerm(''); setFilterStatus('all'); }}
                                                className="mt-2 text-xs font-bold text-rra-blue hover:underline"
                                            >
                                                Clear filters
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination */}
                {filteredRides.length > PAGE_SIZE && (
                    <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            Page {currentPage} of {totalPages} · {filteredRides.length} rides
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const p = totalPages <= 5 ? i + 1 :
                                    currentPage <= 3 ? i + 1 :
                                    currentPage >= totalPages - 2 ? totalPages - 4 + i :
                                    currentPage - 2 + i;
                                return (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p)}
                                        className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                                            p === currentPage
                                                ? 'text-white'
                                                : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50'
                                        }`}
                                        style={p === currentPage ? { background: 'var(--rra-blue)' } : {}}
                                    >
                                        {p}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminRides;

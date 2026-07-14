import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import {
    Search, ChevronLeft, ChevronRight,
    Loader2, X, History
} from 'lucide-react';

const PAGE_SIZE = 10;

const RideHistory = () => {
    const { user } = useAuth();
    const [rides, setRides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [page, setPage] = useState(1);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const { data } = await axios.get('http://localhost:5000/api/rides/history');
                setRides(data);
            } catch (error) {
                console.error("Error fetching ride history:", error);
            } finally {
                setLoading(false);
            }
        };
        if (user) fetchHistory();
    }, [user]);

    const formatDate = (dateString) => {
        if (!dateString) return { short: 'N/A', time: 'N/A', full: 'N/A' };
        const d = new Date(dateString);
        return {
            short: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            full: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        };
    };

    const getStatusStyles = (status) => {
        switch (status) {
            case 'completed': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'cancelled': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
            case 'ongoing': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
        }
    };

    const filtered = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return rides.filter(ride => {
            const { short, full } = formatDate(ride.createdAt);
            const matchSearch = !q || short.toLowerCase().includes(q) || full.toLowerCase().includes(q);
            const matchStatus = statusFilter === 'all' || ride.status === statusFilter;
            return matchSearch && matchStatus;
        });
    }, [rides, searchQuery, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    useEffect(() => { setPage(1); }, [searchQuery, statusFilter]);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <Loader2 size={32} className="animate-spin text-rra-blue" />
            </div>
        );
    }

    return (
        <div className="w-full space-y-5 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Ride History</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">
                        {filtered.length} ride{filtered.length !== 1 ? 's' : ''} found
                    </p>
                </div>
            </div>

            {/* Search + Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search by date (e.g. Jun 2026, 15 June)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-9 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-rra-blue focus:ring-2 focus:ring-rra-blue/20 transition-all"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                            <X size={14} />
                        </button>
                    )}
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-white focus:outline-none focus:border-rra-blue transition-all cursor-pointer"
                >
                    <option value="all">All Status</option>
                    <option value="completed">Completed</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700">
                                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">#</th>
                                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Date</th>
                                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Time</th>
                                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Distance</th>
                                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Fare (RWF)</th>
                                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {paginated.length > 0 ? (
                                paginated.map((ride, i) => {
                                    const { short, time } = formatDate(ride.createdAt);
                                    return (
                                        <tr key={ride._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="px-8 py-5">
                                                <span className="text-sm font-bold text-gray-400 dark:text-gray-500">
                                                    {(currentPage - 1) * PAGE_SIZE + i + 1}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">{short}</p>
                                            </td>
                                            <td className="px-8 py-5">
                                                <p className="text-sm font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">{time}</p>
                                            </td>
                                            <td className="px-8 py-5">
                                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                    {ride.distanceKm ? `${ride.distanceKm} km` : '—'}
                                                </p>
                                            </td>
                                            <td className="px-8 py-5">
                                                <p className="text-base font-black text-gray-900 dark:text-white">
                                                    {ride.totalFare?.toLocaleString() || '—'}
                                                </p>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider whitespace-nowrap ${getStatusStyles(ride.status)}`}>
                                                    {ride.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-8 py-16 text-center">
                                        <History size={40} className="mx-auto text-gray-200 dark:text-gray-600 mb-3" />
                                        <p className="text-sm font-bold text-gray-400">No rides found</p>
                                        {(searchQuery || statusFilter !== 'all') && (
                                            <button
                                                onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                                                className="mt-3 text-xs font-bold text-rra-blue hover:underline"
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
                {filtered.length > PAGE_SIZE && (
                    <div className="px-8 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                            Page {currentPage} of {totalPages} · {filtered.length} total
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
                                        className={`w-9 h-9 rounded-xl text-sm font-bold transition-all ${
                                            p === currentPage
                                                ? 'text-white'
                                                : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
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

export default RideHistory;

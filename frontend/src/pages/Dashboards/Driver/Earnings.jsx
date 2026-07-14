import React, { useState, useEffect, useMemo } from 'react';
import {
    DollarSign, TrendingUp, ArrowUpRight, Calendar,
    ChevronLeft, ChevronRight, Loader2, Search, X
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';

const PAGE_SIZE = 10;

const Earnings = () => {
    const { user } = useAuth();
    const [rides, setRides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterPeriod, setFilterPeriod] = useState('all');
    const [page, setPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const { data } = await axios.get('http://localhost:5000/api/rides/history');
                const driverRides = data.filter(ride =>
                    ride.driver?._id === user?._id || ride.driver === user?._id
                );
                setRides(driverRides);
            } catch (error) {
                console.error("Error fetching driver ride history:", error);
            } finally {
                setLoading(false);
            }
        };
        if (user) fetchHistory();
    }, [user]);

    useEffect(() => { setPage(1); }, [filterPeriod, searchQuery]);

    const filteredRides = useMemo(() => rides.filter(ride => {
        if (filterPeriod === 'all') return true;
        const rideDate = new Date(ride.createdAt);
        const diffDays = Math.ceil((Date.now() - rideDate) / (1000 * 60 * 60 * 24));
        if (filterPeriod === '30') return diffDays <= 30;
        if (filterPeriod === '7') return diffDays <= 7;
        if (filterPeriod === 'year') return rideDate.getFullYear() === new Date().getFullYear();
        return true;
    }), [rides, filterPeriod]);

    const totalBalance = filteredRides.reduce((acc, r) => acc + (r.totalFare || 0), 0);
    const totalTax = filteredRides.reduce((acc, r) => acc + (r.taxAmount || 0), 0);
    const avgPerTrip = filteredRides.length > 0 ? Math.round(totalBalance / filteredRides.length) : 0;

    const groupedData = useMemo(() => {
        const acc = {};
        filteredRides.forEach(ride => {
            const date = new Date(ride.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            if (!acc[date]) acc[date] = { date, trips: 0, distance: 0, amount: 0, tax: 0, status: 'Paid' };
            acc[date].trips += 1;
            acc[date].distance += (ride.distanceKm || ride.distance || 0);
            acc[date].amount += (ride.totalFare || 0);
            acc[date].tax += (ride.taxAmount || 0);
        });
        return Object.values(acc).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [filteredRides]);

    // Live search on date
    const searchedData = useMemo(() => {
        if (!searchQuery.trim()) return groupedData;
        const q = searchQuery.toLowerCase();
        return groupedData.filter(item => item.date.toLowerCase().includes(q));
    }, [groupedData, searchQuery]);

    const totalPages = Math.max(1, Math.ceil(searchedData.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const paginated = searchedData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 size={32} className="animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="w-full space-y-5 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Earnings</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1">Your revenue and tax summary</p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                            <DollarSign size={15} className="text-emerald-600" />
                        </div>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Earned</p>
                    </div>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">
                        {totalBalance.toLocaleString()}
                        <span className="text-sm font-bold text-gray-400 ml-1">RWF</span>
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-xl bg-rra-blue/10">
                            <TrendingUp size={15} className="text-rra-blue" />
                        </div>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tax Paid (RRA)</p>
                    </div>
                    <p className="text-2xl font-black text-rra-blue">
                        {totalTax.toLocaleString()}
                        <span className="text-sm font-bold text-gray-400 ml-1">RWF</span>
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                            <Calendar size={15} className="text-blue-500" />
                        </div>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg per Trip</p>
                    </div>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">
                        {avgPerTrip.toLocaleString()}
                        <span className="text-sm font-bold text-gray-400 ml-1">RWF</span>
                    </p>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wide">
                        Transaction History
                        <span className="ml-2 text-xs font-bold text-gray-400 normal-case tracking-normal">
                            ({searchedData.length} record{searchedData.length !== 1 ? 's' : ''})
                        </span>
                    </h2>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                            <input
                                type="text"
                                placeholder="Search by date (e.g. Jun 2026)..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 pr-7 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-rra-blue focus:ring-2 focus:ring-rra-blue/20 transition-all w-52"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                        <select
                            value={filterPeriod}
                            onChange={(e) => setFilterPeriod(e.target.value)}
                            className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-white focus:outline-none focus:border-rra-blue transition-all cursor-pointer"
                        >
                            <option value="all">All Time</option>
                            <option value="7">Last 7 Days</option>
                            <option value="30">Last 30 Days</option>
                            <option value="year">This Year</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/40">
                                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Date</th>
                                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Trips</th>
                                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Distance</th>
                                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Amount Earned</th>
                                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Tax (RRA)</th>
                                <th className="px-8 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {paginated.length > 0 ? (
                                paginated.map((item, index) => (
                                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="px-8 py-5">
                                            <p className="text-sm font-bold text-gray-900 dark:text-white whitespace-nowrap">{item.date}</p>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="text-base font-black text-gray-900 dark:text-white">{item.trips}</span>
                                            <span className="text-xs text-gray-400 ml-1">rides</span>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{item.distance.toFixed(1)} km</p>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-base font-black text-gray-900 dark:text-white">
                                                {item.amount.toLocaleString()} <span className="text-xs font-bold text-gray-400">RWF</span>
                                            </p>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-sm font-semibold text-rra-blue">
                                                {item.tax > 0 ? `${item.tax.toLocaleString()} RWF` : '—'}
                                            </p>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 whitespace-nowrap">
                                                {item.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-8 py-16 text-center">
                                        <DollarSign size={36} className="mx-auto text-gray-200 dark:text-gray-600 mb-3" />
                                        <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
                                            {searchQuery ? `No earnings match "${searchQuery}"` : 'No earnings for this period'}
                                        </p>
                                        {searchQuery && (
                                            <button onClick={() => setSearchQuery('')} className="mt-2 text-xs font-bold text-rra-blue hover:underline">
                                                Clear search
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {searchedData.length > PAGE_SIZE && (
                    <div className="px-8 py-5 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            Page {currentPage} of {totalPages}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft size={15} />
                            </button>
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300 px-2">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight size={15} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Earnings;

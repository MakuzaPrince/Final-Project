import React, { useState, useEffect, useMemo } from 'react';
import {
    ShieldCheck,
    AlertCircle,
    Globe,
    ExternalLink,
    PieChart,
    ArrowDownRight,
    Search,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    X
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import { rraLogo } from '../../../assets';

const TAX_PAGE_SIZE = 10;

const TaxSummary = () => {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [rides, setRides] = useState([]);
    const [filteredHistory, setFilteredHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [taxPage, setTaxPage] = useState(1);
    const [sortBy, setSortBy] = useState('newest');

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const { data } = await axios.get('http://localhost:5000/api/rides/history');
            // Filter rides where user is the driver
            const driverRides = data.filter(ride =>
                ride.driver?._id === user?._id || ride.driver === user?._id
            );
            setRides(driverRides);

            // Group by month
            const grouped = driverRides.reduce((acc, ride) => {
                const date = new Date(ride.createdAt);
                const monthYear = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

                if (!acc[monthYear]) {
                    acc[monthYear] = {
                        month: monthYear,
                        gross: 0,
                        tax: 0,
                        net: 0,
                        date: new Date(date.getFullYear(), date.getMonth(), 1)
                    };
                }

                const fare = ride.totalFare || 0;
                const tax = fare * 0.18;
                acc[monthYear].gross += fare;
                acc[monthYear].tax += tax;
                acc[monthYear].net += (fare - tax);
                return acc;
            }, {});

            const historicalData = Object.values(grouped)
                .sort((a, b) => b.date - a.date)
                .map(item => ({
                    ...item,
                    grossValue: item.gross,
                    taxValue: item.tax,
                    netValue: item.net,
                    gross: `${item.gross.toLocaleString()} RWF`,
                    tax: `${Math.round(item.tax).toLocaleString()} RWF`,
                    net: `${Math.round(item.net).toLocaleString()} RWF`
                }));

            setFilteredHistory(historicalData);
        } catch (error) {
            console.error("Error fetching tax history:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchHistory();
    }, [user]);

    const totalTaxYTD = rides
        .filter(ride => new Date(ride.createdAt).getFullYear() === new Date().getFullYear())
        .reduce((acc, ride) => acc + ((ride.totalFare || 0) * 0.18), 0);

    const sortedHistory = useMemo(() => {
        const sorted = [...filteredHistory];
        switch (sortBy) {
            case 'gross_asc':
                return sorted.sort((a, b) => a.grossValue - b.grossValue);
            case 'gross_desc':
                return sorted.sort((a, b) => b.grossValue - a.grossValue);
            case 'tax_asc':
                return sorted.sort((a, b) => a.taxValue - b.taxValue);
            case 'tax_desc':
                return sorted.sort((a, b) => b.taxValue - a.taxValue);
            case 'oldest':
                return sorted.sort((a, b) => a.date - b.date);
            case 'newest':
            default:
                return sorted.sort((a, b) => b.date - a.date);
        }
    }, [filteredHistory, sortBy]);

    const searchedHistory = useMemo(() => {
        if (!searchTerm.trim()) return sortedHistory;
        return sortedHistory.filter(item =>
            item.month.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [sortedHistory, searchTerm]);

    const taxTotalPages = Math.max(1, Math.ceil(searchedHistory.length / TAX_PAGE_SIZE));
    const taxCurrentPage = Math.min(taxPage, taxTotalPages);
    const paginatedTax = searchedHistory.slice(
        (taxCurrentPage - 1) * TAX_PAGE_SIZE,
        taxCurrentPage * TAX_PAGE_SIZE
    );

    if (loading && rides.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 p-4 md:p-0">
            {/* RRA Integration Hero */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10">
                    <div className="flex-1">
                        {/* RRA Logo + badge row */}
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm border border-rra-blue/20 p-0.5 bg-white">
                                <img src={rraLogo} alt="RRA Logo" className="w-full h-full object-contain" />
                            </div>
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rra-blue/10 dark:bg-rra-blue/20 font-black text-xs uppercase tracking-widest border border-rra-blue/20" style={{ color: 'var(--rra-blue)' }}>
                                <ShieldCheck size={13} />
                                Integrated · Active
                            </div>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black dark:text-white tracking-tighter mb-4 italic">Tax Summary</h1>
                        <p className="text-gray-500 dark:text-gray-400 text-lg font-medium max-w-2xl leading-relaxed">
                            Your ride income taxes are automatically calculated .
                        </p>
                    </div>

                    <div className="flex shrink-0 gap-6">
                        <div className="text-center p-8 bg-gray-50 dark:bg-gray-900/40 rounded-[2rem] border border-gray-100 dark:border-gray-700">
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Tax Paid </p>
                            <p className="text-3xl font-black dark:text-white">{Math.round(totalTaxYTD).toLocaleString()} <span className="text-sm font-bold text-gray-400">RWF</span></p>
                        </div>
                    </div>
                </div>
                {/* Decoration */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-blue-400/5 rounded-full blur-3xl"></div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {/* Detailed Breakdown */}
                <div className="space-y-8">
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-8 border-b dark:border-gray-700 flex flex-wrap justify-between items-center gap-4">
                            <div className="flex items-center gap-4">
                                <h2 className="text-xl font-black dark:text-white tracking-widest uppercase">Payment Summary</h2>
                                <button
                                    onClick={fetchHistory}
                                    disabled={loading}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all text-gray-400 hover:text-blue-500"
                                    title="Refresh Data"
                                >
                                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                                </button>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search by month..."
                                        value={searchTerm}
                                        onChange={(e) => { setSearchTerm(e.target.value); setTaxPage(1); }}
                                        className="pl-9 pr-8 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium focus:outline-none focus:border-rra-blue focus:ring-2 focus:ring-rra-blue/20 w-full md:w-56 dark:text-white transition-all"
                                    />
                                    {searchTerm && (
                                        <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                            <X size={13} />
                                        </button>
                                    )}
                                </div>
                                <select
                                    value={sortBy}
                                    onChange={(e) => { setSortBy(e.target.value); setTaxPage(1); }}
                                    className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium dark:text-white"
                                >
                                    <option value="newest">Newest first</option>
                                    <option value="oldest">Oldest first</option>
                                    <option value="gross_desc">Gross: high to low</option>
                                    <option value="gross_asc">Gross: low to high</option>
                                    <option value="tax_desc">Tax: high to low</option>
                                    <option value="tax_asc">Tax: low to high</option>
                                </select>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-[480px]">
                                <thead className="bg-gray-50 dark:bg-gray-900/40">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Period</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Gross Income</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tax (18%)</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-emerald-600">Net Income</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y dark:divide-gray-700">
                                    {paginatedTax.length > 0 ? paginatedTax.map((item, i) => (
                                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <td className="px-6 py-4"><p className="font-bold text-sm text-gray-900 dark:text-white">{item.month}</p></td>
                                            <td className="px-6 py-4"><p className="font-black text-sm dark:text-white">{item.gross}</p></td>
                                            <td className="px-6 py-4"><p className="font-black text-sm text-red-500">{item.tax}</p></td>
                                            <td className="px-6 py-4"><p className="font-black text-sm text-emerald-600">{item.net}</p></td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center">
                                                <AlertCircle size={36} className="mx-auto text-gray-200 dark:text-gray-600 mb-3" />
                                                <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
                                                    {searchTerm ? `No records match "${searchTerm}"` : 'No tax history found'}
                                                </p>
                                                {searchTerm && (
                                                    <button onClick={() => setSearchTerm('')} className="mt-2 text-xs font-bold text-rra-blue hover:underline">
                                                        Clear search
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {searchedHistory.length > TAX_PAGE_SIZE && (
                            <div className="px-6 py-4 border-t dark:border-gray-700 flex items-center justify-between">
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                    Page {taxCurrentPage} of {taxTotalPages} · {searchedHistory.length} records
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setTaxPage(p => Math.max(1, p - 1))}
                                        disabled={taxCurrentPage === 1}
                                        className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    >
                                        <ChevronLeft size={14} />
                                    </button>
                                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300 px-2">
                                        {taxCurrentPage} / {taxTotalPages}
                                    </span>
                                    <button
                                        onClick={() => setTaxPage(p => Math.min(taxTotalPages, p + 1))}
                                        disabled={taxCurrentPage === taxTotalPages}
                                        className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    >
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaxSummary;


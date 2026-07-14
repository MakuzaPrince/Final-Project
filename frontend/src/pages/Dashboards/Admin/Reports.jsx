import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { rraLogo } from '../../../assets';
import {
    BarChart3,
    PieChart,
    LineChart,
    Download,
    Calendar,
    Filter,
    ArrowUpRight,
    TrendingUp,
    TrendingDown,
    Globe,
    Zap,
    Briefcase,
    RefreshCw,
    Activity,
    Users,
    DollarSign,
    Shield,
    FileText,
    Table as TableIcon,
    Search,
    X,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const ACTIVITY_PAGE_SIZE = 10;

const Reports = () => {
    const [stats, setStats] = useState(null);
    const [taxReport, setTaxReport] = useState([]);
    const [recentRides, setRecentRides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterPeriod, setFilterPeriod] = useState('30');
    const [groupBy, setGroupBy] = useState('month');

    // Recent Activity search/filter state
    const [activitySearch, setActivitySearch] = useState('');
    const [activityStatusFilter, setActivityStatusFilter] = useState('all');
    const [activityPage, setActivityPage] = useState(1);

    const fetchReportData = useCallback(async () => {
        setLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const [statsRes, taxRes, ridesRes] = await Promise.all([
                axios.get('http://localhost:5000/api/admin/stats', {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`http://localhost:5000/api/admin/tax-report?period=${filterPeriod}&groupBy=${groupBy}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get('http://localhost:5000/api/admin/rides', {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);
            setStats(statsRes.data);
            setTaxReport(taxRes.data);
            setRecentRides(ridesRes.data);
        } catch (error) {
            console.error("Error fetching report data:", error);
        } finally {
            setLoading(false);
        }
    }, [filterPeriod, groupBy]);

    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.text('Platform Tax & Revenue Report', 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
        doc.text(`Period: Last ${filterPeriod} Days | Grouped by: ${groupBy}`, 14, 35);

        const tableData = taxReport.map(item => [
            item.label,
            `${Math.round(item.totalRevenue).toLocaleString()} RWF`,
            `${Math.round(item.totalTax).toLocaleString()} RWF`,
            item.totalRides
        ]);

        doc.autoTable = autoTable; // Ensure compatibility
        autoTable(doc, {
            head: [['Time Period', 'Total Revenue', 'Tax Collected', 'Ride Count']],
            body: tableData,
            startY: 45,
            theme: 'grid',
            headStyles: { fillColor: [37, 99, 235] }
        });

        doc.save(`Platform_Report_${groupBy}_${filterPeriod}days.pdf`);
    };

    const exportToExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(taxReport.map(item => ({
            'Time Period': item.label,
            'Total Revenue (RWF)': Math.round(item.totalRevenue),
            'Tax Collected (RWF)': Math.round(item.totalTax),
            'Total Rides': item.totalRides
        })));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Tax Report");
        XLSX.writeFile(workbook, `Platform_Report_${groupBy}_${filterPeriod}days.xlsx`);
    };

    // Filtered recent activity (live)
    const filteredActivity = useMemo(() => {
        const q = activitySearch.toLowerCase();
        return recentRides.filter(ride => {
            const matchSearch = !q ||
                (ride.passengerName || '').toLowerCase().includes(q) ||
                (ride.passenger?.email || '').toLowerCase().includes(q) ||
                (ride._id || '').toLowerCase().includes(q);
            const matchStatus = activityStatusFilter === 'all' || ride.status === activityStatusFilter;
            return matchSearch && matchStatus;
        });
    }, [recentRides, activitySearch, activityStatusFilter]);

    const activityTotalPages = Math.max(1, Math.ceil(filteredActivity.length / ACTIVITY_PAGE_SIZE));
    const activityCurrentPage = Math.min(activityPage, activityTotalPages);
    const paginatedActivity = filteredActivity.slice(
        (activityCurrentPage - 1) * ACTIVITY_PAGE_SIZE,
        activityCurrentPage * ACTIVITY_PAGE_SIZE
    );

    const reportCards = stats ? [
        { title: 'Tax Generated', icon: DollarSign, value: `${Math.round(stats.totalTax || 0).toLocaleString()} RWF`, sub: 'Real-time Collection', trend: '+12.4%', up: true, color: 'text-emerald-500', bg: 'bg-emerald-50/50 dark:bg-emerald-900/20' },
        { title: 'Total Users', icon: Users, value: stats.totalUsers || 0, sub: 'Active Accounts', trend: '+5.2%', up: true, color: 'text-blue-500', bg: 'bg-blue-50/50 dark:bg-blue-900/20' },
        { title: 'Ride Cycles', icon: Activity, value: stats.totalRides || 0, sub: 'Platform Requests', trend: '+18.7%', up: true, color: 'text-amber-500', bg: 'bg-amber-50/50 dark:bg-amber-900/20' },
        { title: 'System Security', icon: Shield, value: 'Optimal', sub: 'Integrity Check', trend: 'Secure', up: true, color: 'text-indigo-500', bg: 'bg-indigo-50/50 dark:bg-indigo-900/20' },
    ] : [];

    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700 pb-20 px-4">
            {/* Intel Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden border border-rra-blue/20 shadow-sm p-0.5 bg-white shrink-0 mt-1">
                        <img src={rraLogo} alt="RRA" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black dark:text-white tracking-tighter italic uppercase">Analytics &amp; Reports</h1>
                        <p className="text-gray-500 dark:text-gray-400 font-bold mt-1">RRA-integrated tax reporting and platform analytics</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4">
                    <div className="flex gap-2">
                        <select
                            value={filterPeriod}
                            onChange={(e) => setFilterPeriod(e.target.value)}
                            className="px-4 py-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm font-black text-[10px] uppercase tracking-widest dark:text-white outline-none cursor-pointer"
                        >
                            <option value="7">Last 7 Days</option>
                            <option value="30">Last 30 Days</option>
                            <option value="90">Last 90 Days</option>
                            <option value="year">Full Year</option>
                        </select>
                        <select
                            value={groupBy}
                            onChange={(e) => setGroupBy(e.target.value)}
                            className="px-4 py-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm font-black text-[10px] uppercase tracking-widest dark:text-white outline-none cursor-pointer"
                        >
                            <option value="day">By Day</option>
                            <option value="week">By Week</option>
                            <option value="month">By Month</option>
                            <option value="year">By Year</option>
                        </select>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={exportToPDF}
                            className="flex items-center gap-2 px-4 py-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-xl hover:bg-rose-100 transition-all font-black text-[10px] uppercase tracking-widest"
                        >
                            <FileText size={16} /> PDF
                        </button>
                        <button
                            onClick={exportToExcel}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all font-black text-[10px] uppercase tracking-widest"
                        >
                            <TableIcon size={16} /> Excel
                        </button>
                        <button
                            onClick={fetchReportData}
                            className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl hover:bg-blue-100 transition-all active:scale-95"
                        >
                            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Analytical Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {reportCards.map((card, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-2xl transition-all group overflow-hidden relative">
                        <div className="relative z-10 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className={`p-4 ${card.bg} ${card.color} rounded-2xl shrink-0`}>
                                    <card.icon size={24} />
                                </div>
                                <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter ${card.up ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 'bg-rose-100 text-rose-600 dark:bg-rose-900/30'
                                    }`}>
                                    {card.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                    {card.trend}
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 italic">{card.sub}</p>
                                <h3 className="text-3xl font-black dark:text-white tracking-tighter">{card.value}</h3>
                                <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-tight">{card.title}</p>
                            </div>
                        </div>
                        <div className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full blur-3xl opacity-5 ${card.color.replace('text', 'bg')}`}></div>
                    </div>
                ))}
            </div>

            {/* Tax Intelligence Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Tax Meter & Summary */}
                <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-[3rem] p-10 border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="relative z-10">
                        <h3 className="text-xl font-black dark:text-white uppercase tracking-tighter italic leading-tight mb-2">Tax Intelligence</h3>
                        <p className="text-xs text-gray-400 font-bold italic uppercase tracking-widest">Platform Pulse</p>
                    </div>

                    <div className="relative z-10 my-10 flex flex-col items-center justify-center">
                        <div className="w-48 h-48 rounded-full border-[12px] border-emerald-50 dark:border-emerald-900/20 flex flex-col items-center justify-center relative">
                            <div className="absolute inset-0 rounded-full border-[12px] border-emerald-500 border-t-transparent -rotate-45"></div>
                            <span className="text-xs font-black text-gray-400 uppercase italic">Collection</span>
                            <h2 className="text-3xl font-black dark:text-white tracking-tighter italic">{Math.round(stats?.totalTax || 0).toLocaleString()}</h2>
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-1">RWF TOTAL</span>
                        </div>
                    </div>

                    <div className="space-y-4 relative z-10">
                        <div className="flex justify-between items-center p-4 bg-emerald-50/50 dark:bg-emerald-900/20 rounded-2xl">
                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase">Yield Rate</span>
                            <span className="text-sm font-black dark:text-white italic">{( (stats?.totalTax / (stats?.totalTax + stats?.totalRevenue || 1)) * 100 ).toFixed(1)}%</span>
                        </div>
                    </div>

                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-emerald-50 dark:bg-emerald-900/10 rounded-full blur-3xl"></div>
                </div>

                {/* Tax Data Breakdown Table */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-[3rem] p-10 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-black dark:text-white uppercase tracking-tighter italic">Data Breakdown</h3>
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest italic mt-1">Granular tax collection by {groupBy}</p>
                        </div>
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl">
                            <PieChart size={20} />
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-[300px] custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-white dark:bg-gray-800 z-10">
                                <tr className="border-b-2 border-gray-100 dark:border-gray-700">
                                    <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Period</th>
                                    <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest italic text-right">Revenue</th>
                                    <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest italic text-right">Tax (RWF)</th>
                                    <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest italic text-center">Rides</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                {taxReport.length > 0 ? (
                                    [...taxReport].reverse().map((item, i) => (
                                        <tr key={i} className="group hover:bg-gray-50/50 dark:hover:bg-gray-900/40 transition-all">
                                            <td className="py-4 text-xs font-black dark:text-white uppercase italic tracking-tighter">{item.label}</td>
                                            <td className="py-4 text-xs font-bold text-gray-400 text-right">{Math.round(item.totalRevenue).toLocaleString()}</td>
                                            <td className="py-4 text-sm font-black text-emerald-500 text-right italic">{Math.round(item.totalTax).toLocaleString()}</td>
                                            <td className="py-4 text-xs font-black text-gray-400 text-center">{item.totalRides}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="py-10 text-center text-gray-400 font-bold italic">No records found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Recent Platform Activity */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                {/* Header + controls */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Recent Platform Activity</h3>
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest animate-pulse bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-full">Live</span>
                        <span className="text-xs font-bold text-gray-400">{filteredActivity.length} records</span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        {/* Live search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input
                                type="text"
                                placeholder="Search by passenger, email, or ID..."
                                value={activitySearch}
                                onChange={(e) => { setActivitySearch(e.target.value); setActivityPage(1); }}
                                className="w-full sm:w-64 pl-9 pr-8 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-rra-blue focus:ring-2 focus:ring-rra-blue/20 transition-all"
                            />
                            {activitySearch && (
                                <button onClick={() => { setActivitySearch(''); setActivityPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                        {/* Status filter */}
                        <select
                            value={activityStatusFilter}
                            onChange={(e) => { setActivityStatusFilter(e.target.value); setActivityPage(1); }}
                            className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-white focus:outline-none focus:border-rra-blue transition-all cursor-pointer"
                        >
                            <option value="all">All Status</option>
                            <option value="completed">Completed</option>
                            <option value="ongoing">Ongoing</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="pending">Pending</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[600px]">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/40">
                                <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Transaction ID</th>
                                <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Passenger</th>
                                <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                                <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Fare</th>
                                <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tax</th>
                                <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                            {paginatedActivity.length > 0 ? (
                                paginatedActivity.map((ride, i) => (
                                    <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/40 transition-all">
                                        <td className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400">
                                            #{ride._id?.slice(-6).toUpperCase()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{ride.passengerName}</p>
                                            <p className="text-[10px] text-gray-400">{ride.passenger?.email || 'N/A'}</p>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400">
                                            {new Date(ride.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-black text-gray-900 dark:text-white">
                                            {Math.round(ride.totalFare || 0).toLocaleString()} <span className="text-xs font-bold text-gray-400">RWF</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-emerald-600">
                                            {Math.round(ride.taxAmount || 0).toLocaleString()} <span className="text-xs">RWF</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${
                                                ride.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                ride.status === 'cancelled' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                                ride.status === 'ongoing' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                            }`}>
                                                {ride.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-400 font-bold italic">
                                        {activitySearch || activityStatusFilter !== 'all' ? 'No results match your search' : 'No recent activity recorded'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {filteredActivity.length > ACTIVITY_PAGE_SIZE && (
                    <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            Page {activityCurrentPage} of {activityTotalPages} · {filteredActivity.length} total
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                                disabled={activityCurrentPage === 1}
                                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300 px-2">
                                {activityCurrentPage} / {activityTotalPages}
                            </span>
                            <button
                                onClick={() => setActivityPage(p => Math.min(activityTotalPages, p + 1))}
                                disabled={activityCurrentPage === activityTotalPages}
                                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Reports;

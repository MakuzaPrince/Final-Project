import { useEffect, useState } from 'react';
import axios from 'axios';
import {
    Users,
    Car,
    TrendingUp,
    Download,
    ChevronRight,
    ArrowUpRight,
    Zap,
    Map,
    RotateCw,
    History,
    PieChart
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalDrivers: 0,
        totalRides: 0,
        activeRides: 0,
        totalTax: 0,
        totalRevenue: 0,
        completedRides: 0,
        taxRate: 0,
        averageFare: 0
    });
    const [dailyRevenue, setDailyRevenue] = useState([]);
    const [growth, setGrowth] = useState(0);
    const [insightStats, setInsightStats] = useState({
        openReports: 0,
        unreadMessages: 0
    });

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const token = sessionStorage.getItem('token');
                const [statsRes, revenueRes, reportsRes, messagesRes] = await Promise.all([
                    axios.get('http://localhost:5000/api/admin/stats', {
                        headers: { Authorization: `Bearer ${token}` }
                    }),
                    axios.get('http://localhost:5000/api/admin/daily-revenue', {
                        headers: { Authorization: `Bearer ${token}` }
                    }),
                    axios.get('http://localhost:5000/api/reports/stats', {
                        headers: { Authorization: `Bearer ${token}` }
                    }),
                    axios.get('http://localhost:5000/api/messages/unread-count', {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                ]);

                setStats(statsRes.data);
                setDailyRevenue(revenueRes.data);
                setInsightStats({
                    openReports: (reportsRes.data?.open || 0) + (reportsRes.data?.inProgress || 0),
                    unreadMessages: messagesRes.data?.count || 0
                });

                // Calculate growth (today vs yesterday)
                if (revenueRes.data.length >= 2) {
                    const today = revenueRes.data[6].revenue;
                    const yesterday = revenueRes.data[5].revenue;
                    if (yesterday > 0) {
                        const growthVal = ((today - yesterday) / yesterday) * 100;
                        setGrowth(growthVal.toFixed(1));
                    } else if (today > 0) {
                        setGrowth(100);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch dashboard data:", error);
                // Mock fallback for UI development
                setDailyRevenue([
                    { date: 'Mon', revenue: 45000 },
                    { date: 'Tue', revenue: 62000 },
                    { date: 'Wed', revenue: 58000 },
                    { date: 'Thu', revenue: 85000 },
                    { date: 'Fri', revenue: 72000 },
                    { date: 'Sat', revenue: 90000 },
                    { date: 'Sun', revenue: 82000 }
                ]);
            }
        };

        fetchDashboardData();
    }, []);

    const metrics = [
        { label: 'Passengers', value: stats.totalUsers.toLocaleString(), icon: Users, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', sub: 'Total registered', path: '/admin/users' },
        { label: 'Drivers', value: stats.totalDrivers.toLocaleString(), icon: Car, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20', sub: 'Verified assets', path: '/admin/users' },
        { label: 'Revenue', value: `RWF ${Math.round(stats.totalRevenue || 0).toLocaleString()}`, icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', sub: 'Completed rides', path: '/admin/reports' },
        { label: 'Rides', value: stats.totalRides.toLocaleString(), icon: History, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20', sub: 'Total journeys', path: '/admin/rides' },
    ];

    const insightCards = [
        { label: 'Completed Trips', value: stats.completedRides.toLocaleString(), detail: 'Settled and closed', icon: Map, color: 'text-sky-500' },
        { label: 'Open Issues', value: insightStats.openReports.toLocaleString(), detail: 'Pending follow-up', icon: Zap, color: 'text-rose-500' },
        { label: 'Unread Messages', value: insightStats.unreadMessages.toLocaleString(), detail: 'Needs attention', icon: History, color: 'text-violet-500' },
        { label: 'Avg Fare', value: `RWF ${Math.round(stats.averageFare || 0).toLocaleString()}`, detail: 'Per completed trip', icon: RotateCw, color: 'text-emerald-500' },
    ];

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-700 pb-20">
            <div className="rounded-[2.25rem] border border-gray-200/80 dark:border-gray-700 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-8 text-white shadow-2xl">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                    <div className="max-w-2xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-300">Operations Center</p>
                        <h1 className="mt-3 text-3xl md:text-4xl font-black tracking-tight">Admin dashboard</h1>
                        <p className="mt-3 text-sm text-slate-300 leading-6">
                            A concise view of platform activity, growth, and financial health across rides, users, and compliance.
                        </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Momentum</p>
                        <div className="mt-1 flex items-center gap-2">
                            <span className="text-2xl font-black">{growth ? `${growth}%` : '0%'}</span>
                            <span className="text-sm text-slate-300">vs yesterday</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {metrics.map((m, i) => (
                    <div
                        key={i}
                        onClick={() => m.path !== '#' && navigate(m.path)}
                        className={`group rounded-[2rem] border border-gray-200/80 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg ${m.path !== '#' ? 'cursor-pointer active:scale-[0.99]' : 'cursor-default'}`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className={`rounded-2xl p-3 ${m.bg} ${m.color}`}>
                                <m.icon size={20} />
                            </div>
                            {m.path !== '#' && <ChevronRight size={16} className="text-gray-300 transition-all group-hover:text-blue-500" />}
                        </div>
                        <div className="mt-5">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">{m.sub}</p>
                            <h3 className="mt-1 text-2xl font-black tracking-tight text-gray-900 dark:text-white">{m.value}</h3>
                            <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{m.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
                <div className="space-y-6">
                    <div className="rounded-[2rem] border border-gray-200/80 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Performance snapshot</p>
                                <h2 className="mt-1 text-xl font-black text-gray-900 dark:text-white">Today’s platform pulse</h2>
                            </div>
                            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-900/20">
                                <TrendingUp size={18} />
                            </div>
                        </div>

                        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/40 p-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Completed rides</p>
                                <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">{stats.completedRides.toLocaleString()}</p>
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Fully settled and closed</p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/40 p-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Active rides</p>
                                <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">{stats.activeRides.toLocaleString()}</p>
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Live operations in motion</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {insightCards.map((card, index) => (
                            <div key={index} className="rounded-[1.6rem] border border-gray-200/80 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div className={`rounded-2xl p-3 bg-gray-50 dark:bg-gray-900/40 ${card.color}`}>
                                        <card.icon size={18} />
                                    </div>
                                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                                </div>
                                <p className="mt-4 text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">{card.label}</p>
                                <p className="mt-1 text-2xl font-black tracking-tight text-gray-900 dark:text-white">{card.value}</p>
                                <p className="mt-2 text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">{card.detail}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-[2rem] border border-gray-200/80 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Financial oversight</p>
                            <h2 className="mt-1 text-xl font-black text-gray-900 dark:text-white">Tax and revenue health</h2>
                        </div>
                        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-900/20">
                            <PieChart size={18} />
                        </div>
                    </div>

                    <div className="mt-6 rounded-[1.75rem] bg-slate-50 dark:bg-slate-900/40 p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Collected tax</p>
                                <p className="mt-1 text-3xl font-black text-gray-900 dark:text-white">RWF {Math.round(stats.totalTax || 0).toLocaleString()}</p>
                            </div>
                            <div className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-sm font-black text-emerald-600">Verified</div>
                        </div>

                        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Tax rate</p>
                                {(() => {
                                    const pct = Number(stats.taxRate || 0);
                                    const display = isFinite(pct) ? pct.toFixed(1) : '0.0';
                                    const barWidth = Math.min(100, isFinite(pct) ? pct : 0);
                                    return (
                                        <>
                                            <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">{display}%</p>
                                            <div className="mt-3 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                                <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${barWidth}%` }} />
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>

                            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Gross revenue</p>
                                <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">RWF {Math.round(stats.totalRevenue || 0).toLocaleString()}</p>
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Average fare: RWF {Math.round(stats.averageFare || 0).toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => navigate('/admin/reports')}
                        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-black uppercase tracking-[0.25em] text-white transition-all hover:opacity-90 active:scale-[0.98] dark:bg-white dark:text-gray-900"
                    >
                        Review reports <ArrowUpRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;


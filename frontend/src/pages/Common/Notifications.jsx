import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
    Bell, Info, CheckCircle, AlertTriangle, Clock,
    Search, RefreshCw, Filter, Navigation,
    Trash2, CheckCheck, ChevronRight, ChevronLeft, X, Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useSocket } from '../../context/SocketContext';
import { useNavigate } from 'react-router-dom';

const PAGE_SIZE = 10;

const Notifications = () => {
    const { user } = useAuth();
    const socket = useSocket();
    const { markAsRead, markAllAsRead, fetchNotifications: refreshBadges } = useNotifications();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters (server-side)
    const [category, setCategory] = useState('all');
    const [period, setPeriod] = useState('all');

    // Live client-side search
    const [searchQuery, setSearchQuery] = useState('');

    // Pagination
    const [page, setPage] = useState(1);

    const fetchNotifications = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const token = sessionStorage.getItem('token');
            const params = {};
            if (category !== 'all') params.category = category;
            if (period !== 'all') params.period = period;

            const { data } = await axios.get('http://localhost:5000/api/notifications', {
                params,
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(data);
            if (isRefresh) refreshBadges();
        } catch (error) {
            console.error("Error fetching notifications:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [category, period, refreshBadges]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // Reset page on filter/search change
    useEffect(() => { setPage(1); }, [searchQuery, category, period]);

    // Socket: real-time new notifications
    useEffect(() => {
        if (!socket) return;
        const handleNew = (notification) => {
            const matchesCategory = category === 'all' || notification.category === category;
            if (matchesCategory) {
                setNotifications(prev => [notification, ...prev]);
            }
        };
        socket.on('newNotification', handleNew);
        return () => socket.off('newNotification', handleNew);
    }, [socket, category]);

    const getTypeStyles = (type) => {
        switch (type) {
            case 'success': return { icon: <CheckCircle className="text-emerald-500" size={18} />, bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-200 dark:border-emerald-800/40' };
            case 'warning': return { icon: <AlertTriangle className="text-amber-500" size={18} />, bg: 'bg-amber-50 dark:bg-amber-900/10', border: 'border-amber-200 dark:border-amber-800/40' };
            case 'error': return { icon: <X className="text-rose-500" size={18} />, bg: 'bg-rose-50 dark:bg-rose-900/10', border: 'border-rose-200 dark:border-rose-800/40' };
            default: return { icon: <Info className="text-rra-blue" size={18} />, bg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-200 dark:border-blue-800/40' };
        }
    };

    const handleActionClick = async (notif) => {
        if (!notif.read) {
            await markAsRead(notif._id);
            setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, read: true } : n));
        }
        if (notif.metadata?.link) navigate(notif.metadata.link);
    };

    const handleMarkAllRead = async () => {
        await markAllAsRead();
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const formatRelativeTime = (date) => {
        const diff = Math.floor((Date.now() - new Date(date)) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    // Live client-side filter by search query
    const filtered = useMemo(() => {
        const q = searchQuery.toLowerCase();
        if (!q) return notifications;
        return notifications.filter(n =>
            (n.title || '').toLowerCase().includes(q) ||
            (n.message || '').toLowerCase().includes(q)
        );
    }, [notifications, searchQuery]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const unreadTotal = notifications.filter(n => !n.read).length;

    return (
        <div className="w-full space-y-5 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Notifications</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">
                        {unreadTotal > 0 ? `${unreadTotal} unread` : 'All caught up'}
                        {filtered.length !== notifications.length && ` · ${filtered.length} shown`}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleMarkAllRead}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                    >
                        <CheckCheck size={14} /> Mark all read
                    </button>
                    <button
                        onClick={() => fetchNotifications(true)}
                        disabled={refreshing}
                        className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-400 hover:text-rra-blue hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                    >
                        <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Live search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                    <input
                        type="text"
                        placeholder="Search notifications..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-rra-blue focus:ring-2 focus:ring-rra-blue/20 transition-all"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <X size={14} />
                        </button>
                    )}
                </div>

                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-white focus:outline-none focus:border-rra-blue transition-all cursor-pointer"
                >
                    <option value="all">All Categories</option>
                    <option value="ride">Ride</option>
                    <option value="system">System</option>
                </select>

                <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-white focus:outline-none focus:border-rra-blue transition-all cursor-pointer"
                >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                </select>
            </div>

            {/* Feed */}
            <div className="space-y-2">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <Loader2 size={28} className="animate-spin text-rra-blue" />
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading notifications...</p>
                    </div>
                ) : paginated.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-12 text-center">
                        <Bell size={36} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                        <p className="text-sm font-bold text-gray-500 dark:text-gray-400">No notifications found</p>
                        {(searchQuery || category !== 'all' || period !== 'all') && (
                            <button
                                onClick={() => { setSearchQuery(''); setCategory('all'); setPeriod('all'); }}
                                className="mt-3 text-xs font-bold text-rra-blue hover:underline"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    paginated.map((notif) => {
                        const style = getTypeStyles(notif.type);
                        return (
                            <div
                                key={notif._id}
                                onClick={() => handleActionClick(notif)}
                                className={`relative flex gap-4 p-4 rounded-xl border cursor-pointer transition-all hover:shadow-sm active:scale-[0.99] ${
                                    notif.read
                                        ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                        : `${style.bg} ${style.border} shadow-sm`
                                }`}
                            >
                                {/* Icon */}
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${style.bg}`}>
                                    {style.icon}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                                notif.read ? 'bg-gray-100 dark:bg-gray-700 text-gray-400' : 'bg-rra-blue text-white'
                                            }`}>
                                                {notif.category || 'system'}
                                            </span>
                                            <h3 className={`text-sm font-bold tracking-tight ${notif.read ? 'text-gray-600 dark:text-gray-300' : 'text-gray-900 dark:text-white'}`}>
                                                {notif.title}
                                            </h3>
                                        </div>
                                        <span className="text-xs text-gray-400 whitespace-nowrap shrink-0 font-medium">
                                            {formatRelativeTime(notif.createdAt)}
                                        </span>
                                    </div>
                                    <p className={`text-sm leading-relaxed ${notif.read ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-300'}`}>
                                        {notif.message}
                                    </p>
                                </div>

                                {/* Unread dot */}
                                {!notif.read && (
                                    <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-rra-blue animate-pulse" />
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Pagination */}
            {filtered.length > PAGE_SIZE && (
                <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        Page {currentPage} of {totalPages} · {filtered.length} total
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft size={15} />
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
                            <ChevronRight size={15} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Notifications;

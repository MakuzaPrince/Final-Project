import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import {
    Home, MapPin, History, User, Settings,
    Car, DollarSign, FileText, Activity,
    Users, BarChart, Power, Menu, X, Bell,
    LayoutGrid, MessageSquare, AlertTriangle, CreditCard,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { rraLogo } from '../../assets';

const Sidebar = ({ isOpen, setIsOpen }) => {
    const { user, logout } = useAuth();
    const { unreadCount } = useNotifications();
    const navigate = useNavigate();
    const location = useLocation();
    const role = user?.role || 'passenger';
    const [sideImgError, setSideImgError] = useState(false);
    const [logoError, setLogoError] = useState(false);
    const [messageCount, setMessageCount] = useState(0);
    const [reportCount, setReportCount] = useState(0);
    const [issueCount, setIssueCount] = useState(0);

    const handleLinkClick = () => {
        if (window.innerWidth < 768) {
            setIsOpen(false);
        }
    };

    const getLinks = () => {
        switch (role) {
            case 'passenger':
                return [
                    { name: 'Dashboard', path: '/passenger/dashboard', icon: LayoutGrid },
                    { name: 'Book Ride', path: '/passenger/book', icon: MapPin },
                    { name: 'History', path: '/passenger/history', icon: History },
                    { name: 'Expenses', path: '/passenger/expenses', icon: DollarSign },
                    { name: 'Payment', path: '/passenger/payment', icon: CreditCard },
                    { name: 'Messages', path: '/passenger/messages', icon: MessageSquare },
                    { name: 'Report Issue', path: '/passenger/report', icon: AlertTriangle },
                    { name: 'Notifications', path: '/passenger/notifications', icon: Bell },
                    { name: 'Profile', path: '/passenger/profile', icon: User },
                    { name: 'Settings', path: '/passenger/settings', icon: Settings },
                ];
            case 'driver':
                return [
                    { name: 'Dashboard', path: '/driver/dashboard', icon: LayoutGrid },
                    { name: 'Live Map', path: '/driver/live-map', icon: MapPin },
                    { name: 'History', path: '/driver/rides', icon: Car },
                    { name: 'Earnings', path: '/driver/earnings', icon: DollarSign },
                    { name: 'Tax Summary', path: '/driver/tax', icon: FileText },
                    { name: 'Messages', path: '/driver/messages', icon: MessageSquare },
                    { name: 'Report Issue', path: '/driver/report', icon: AlertTriangle },
                    { name: 'Notifications', path: '/driver/notifications', icon: Bell },
                    { name: 'Profile', path: '/driver/profile', icon: User },
                    { name: 'Settings', path: '/driver/settings', icon: Settings },
                ];
            case 'admin':
                return [
                    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutGrid },
                    { name: 'Users', path: '/admin/users', icon: Users },
                    { name: 'Rides', path: '/admin/rides', icon: Car },
                    { name: 'Reports', path: '/admin/reports', icon: BarChart },
                    { name: 'Messages', path: '/admin/messages', icon: MessageSquare },
                    { name: 'Issues', path: '/admin/issues', icon: AlertTriangle },
                    { name: 'Profile', path: '/admin/profile', icon: User },
                    { name: 'Settings', path: '/admin/settings', icon: Settings },
                ];
            default:
                return [];
        }
    };

    const getDashboardLink = () => {
        if (role === 'admin') return '/admin/dashboard';
        if (role === 'driver') return '/driver/dashboard';
        return '/passenger/dashboard';
    };

    const fetchCounts = useCallback(async () => {
        if (!user?._id) return;
        const token = sessionStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        try {
            const [messageRes, reportRes] = await Promise.all([
                axios.get('http://localhost:5000/api/messages/unread-count', { headers }),
                role === 'admin'
                    ? axios.get('http://localhost:5000/api/reports/stats', { headers })
                    : axios.get('http://localhost:5000/api/reports/my', { headers })
            ]);

            setMessageCount(messageRes.data?.count || 0);

            if (role === 'admin') {
                const stats = reportRes.data || {};
                setIssueCount((stats.open || 0) + (stats.inProgress || 0));
                setReportCount(0);
            } else {
                const reports = reportRes.data || [];
                const unresolved = reports.filter(r => !['resolved', 'closed'].includes(r.status)).length;
                setReportCount(unresolved);
                setIssueCount(0);
            }
        } catch (error) {
            console.error('Failed to fetch sidebar counts:', error);
        }
    }, [role, user?._id]);

    useEffect(() => {
        fetchCounts();
    }, [fetchCounts, location.pathname]);

    useEffect(() => {
        const handleFocus = () => fetchCounts();
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') fetchCounts();
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [fetchCounts]);

    const badgeCount = (count) => {
        if (!count || count <= 0) return null;
        const display = count > 9 ? '9+' : count;
        return (
            <span className={`flex items-center justify-center bg-rra-gold text-white text-[9px] font-black rounded-full shadow-sm ${
                isOpen
                    ? 'min-w-[18px] h-[18px] px-1'
                    : 'absolute top-1 right-1 w-4 h-4 border-2 border-white dark:border-gray-900'
            }`}>
                {isOpen ? display : ''}
            </span>
        );
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[8000] md:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <div className={`
                fixed md:static inset-y-0 left-0 z-[9000]
                h-screen bg-white dark:bg-gray-900
                border-r border-gray-200 dark:border-gray-800
                transition-all duration-300 ease-in-out
                ${isOpen ? 'w-60 translate-x-0' : 'w-[4.5rem] -translate-x-full md:translate-x-0'}
                flex flex-col shadow-sm
            `}>
                {/* Brand Header */}
                <div
                    className="h-16 px-3 flex items-center gap-3 cursor-pointer border-b border-gray-200 dark:border-gray-800 shrink-0"
                    onClick={() => navigate(getDashboardLink())}
                >
                    {/* RRA Logo */}
                    <div className="shrink-0 w-9 h-9 rounded-lg overflow-hidden bg-rra-blue flex items-center justify-center shadow-sm">
                        {!logoError ? (
                            <img
                                src={rraLogo}
                                alt="RRA"
                                className="w-full h-full object-cover"
                                onError={() => setLogoError(true)}
                            />
                        ) : (
                            <span className="text-white text-[10px] font-black">RRA</span>
                        )}
                    </div>

                    {isOpen && (
                        <div className="overflow-hidden">
                            <p className="text-[12px] font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none truncate">
                                RideShare
                            </p>
                            <p className="text-[8px] font-bold uppercase tracking-widest leading-none mt-0.5" style={{ color: 'var(--rra-gold)' }}>
                                RRA Platform
                            </p>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto no-scrollbar">
                    {getLinks().map((link) => (
                        <NavLink
                            key={link.path}
                            to={link.path}
                            onClick={handleLinkClick}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative ${isActive
                                    ? 'bg-rra-blue text-white shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`
                            }
                        >
                            <link.icon size={17} className="shrink-0" />

                            {isOpen && (
                                <span className="text-[11px] font-bold uppercase tracking-tight flex-1 truncate">
                                    {link.name}
                                </span>
                            )}

                            {/* Notification badge for key links */}
                            {link.name === 'Notifications' && unreadCount > 0 && badgeCount(unreadCount)}
                            {link.name === 'Messages' && messageCount > 0 && badgeCount(messageCount)}
                            {link.name === 'Report Issue' && reportCount > 0 && badgeCount(reportCount)}
                            {link.name === 'Issues' && issueCount > 0 && badgeCount(issueCount)}

                            {/* Tooltip when collapsed */}
                            {!isOpen && (
                                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 dark:bg-gray-700 text-white text-[9px] font-bold uppercase tracking-wider rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl whitespace-nowrap">
                                    {link.name}
                                    {link.name === 'Notifications' && unreadCount > 0 ? ` (${unreadCount})` : ''}
                                    {link.name === 'Messages' && messageCount > 0 ? ` (${messageCount})` : ''}
                                    {link.name === 'Report Issue' && reportCount > 0 ? ` (${reportCount})` : ''}
                                    {link.name === 'Issues' && issueCount > 0 ? ` (${issueCount})` : ''}
                                </div>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div className="p-2 border-t border-gray-200 dark:border-gray-800 shrink-0">
                    {/* User card (expanded only) */}
                    {isOpen && (
                        <div className="flex items-center gap-3 px-3 py-2.5 mb-1 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                            <div className="w-8 h-8 rounded-lg bg-rra-blue flex items-center justify-center text-white text-xs font-black shadow-sm uppercase overflow-hidden shrink-0">
                                {(user?.profileImage && !sideImgError) ? (
                                    <img
                                        src={user.profileImage}
                                        alt="Profile"
                                        className="w-full h-full object-cover"
                                        onError={() => setSideImgError(true)}
                                    />
                                ) : (user?.fullName?.charAt(0)?.toUpperCase() || 'U')}
                            </div>
                            <div className="overflow-hidden flex-1 min-w-0">
                                <p className="text-[10px] font-black text-gray-900 dark:text-white uppercase truncate tracking-tight">
                                    {role === 'admin' ? 'System Admin' : user?.fullName}
                                </p>
                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">
                                    {role}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Logout button */}
                    <button
                        onClick={logout}
                        className="flex items-center gap-3 w-full px-3 py-2.5 text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-all group relative"
                    >
                        <Power size={17} className="shrink-0" />
                        {isOpen && (
                            <span className="text-[10px] font-black uppercase tracking-wider">Logout</span>
                        )}
                        {!isOpen && (
                            <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-red-600 text-white text-[9px] font-bold uppercase tracking-wider rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl whitespace-nowrap">
                                Logout
                            </div>
                        )}
                    </button>
                </div>

                {/* Collapse toggle */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="absolute -right-3 top-[4.25rem] w-6 h-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-rra-blue shadow-md z-[10000] hidden md:flex transition-all hover:scale-110"
                    aria-label="Toggle sidebar"
                >
                    {isOpen ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
                </button>
            </div>
        </>
    );
};

export default Sidebar;

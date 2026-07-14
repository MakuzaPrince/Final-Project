import { Sun, Moon, User, Bell, Menu, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

const Navbar = ({ onMenuClick }) => {
    const { user, logout } = useAuth();
    const { unreadCount } = useNotifications();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [navImgError, setNavImgError] = useState(false);

    const roleLabel = user?.role === 'admin' ? 'Admin' : user?.role === 'driver' ? 'Driver' : 'Passenger';

    return (
        <header className="h-16 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 md:px-6 z-[10000] sticky top-0 shrink-0">
            {/* Left: Mobile menu + greeting */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onMenuClick}
                    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden text-gray-500 dark:text-gray-400 transition-colors"
                    aria-label="Toggle sidebar"
                >
                    <Menu size={20} />
                </button>

                {/* Greeting */}
                <h2 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
                    {user?.role === 'admin' ? 'Admin Portal' : `Hi, ${user?.fullName?.split(' ')[0] || 'User'}`}
                </h2>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-2">
                {/* Role badge */}
                <span className="hidden sm:inline-flex px-2.5 py-1 rounded-lg bg-rra-blue/10 text-rra-blue dark:bg-rra-blue/20 dark:text-blue-300 text-[10px] font-black uppercase tracking-wider">
                    {roleLabel}
                </span>

                {/* Theme toggle */}
                <button
                    onClick={toggleTheme}
                    className="p-2 text-gray-500 dark:text-gray-400 hover:text-rra-blue dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
                    aria-label="Toggle theme"
                >
                    {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                </button>

                {/* Notifications (non-admin) */}
                {user?.role !== 'admin' && (
                    <button
                        onClick={() => navigate(`/${user?.role}/notifications`)}
                        className="relative p-2 text-gray-500 dark:text-gray-400 hover:text-rra-blue dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
                        aria-label="Notifications"
                    >
                        <Bell size={18} />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rra-blue text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-gray-900 px-1 shadow-sm">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>
                )}

                <div className="h-8 w-px bg-gray-200 dark:bg-gray-700"></div>

                {/* Profile dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                    >
                        <div className="w-9 h-9 rounded-full bg-rra-blue flex items-center justify-center text-white text-sm font-black shadow-sm uppercase overflow-hidden border-2 border-white dark:border-gray-700">
                            {(user?.profileImage && !navImgError) ? (
                                <img
                                    src={user.profileImage}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                    onError={() => setNavImgError(true)}
                                />
                            ) : (user?.fullName?.charAt(0)?.toUpperCase() || 'U')}
                        </div>
                        <ChevronDown
                            size={13}
                            className={`text-gray-400 transition-transform duration-200 hidden sm:block ${isProfileOpen ? 'rotate-180' : ''}`}
                        />
                    </button>

                    {isProfileOpen && (
                        <>
                            {/* Backdrop */}
                            <div
                                className="fixed inset-0 z-[7900]"
                                onClick={() => setIsProfileOpen(false)}
                            />
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl p-2 z-[8000]">
                                <div className="px-3 py-2 mb-1">
                                    <p className="text-[11px] font-black text-gray-900 dark:text-gray-100 truncate">
                                        {user?.fullName || 'User'}
                                    </p>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                                        {user?.email || roleLabel}
                                    </p>
                                </div>
                                <div className="h-px bg-gray-100 dark:bg-gray-800 mb-1" />
                                <button
                                    onClick={() => { navigate(`/${user?.role}/profile`); setIsProfileOpen(false); }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-all text-left"
                                >
                                    <User size={15} className="shrink-0" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Profile</span>
                                </button>
                                <div className="h-px bg-gray-100 dark:bg-gray-800 my-1" />
                                <button
                                    onClick={logout}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 text-red-500 transition-all text-left"
                                >
                                    <LogOut size={15} className="shrink-0" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Logout</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Navbar;

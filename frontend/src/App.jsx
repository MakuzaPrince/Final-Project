import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import { DialogProvider, useDialog } from './context/DialogContext';
import AuthPage from './pages/Auth/AuthPage';
import LandingPage from './pages/LandingPage';
import MainLayout from './components/Layout/MainLayout';
import PassengerDashboard from './pages/Dashboards/PassengerDashboard';
import DriverDashboard from './pages/Dashboards/DriverDashboard';
import AdminDashboard from './pages/Dashboards/AdminDashboard';
import BookRide from './pages/Dashboards/BookRide';

// Common Pages
import Profile from './pages/Common/Profile';
import Settings from './pages/Common/Settings';
import RideHistory from './pages/Common/RideHistory';
import Wallet from './pages/Common/Wallet';
import Notifications from './pages/Common/Notifications';
// Messages import is handled below with Admin Pages

// Driver Pages
import Earnings from './pages/Dashboards/Driver/Earnings';
import TaxSummary from './pages/Dashboards/Driver/TaxSummary';
import LiveMap from './pages/Dashboards/Driver/LiveMap';

// Admin Pages
import UserManagement from './pages/Dashboards/Admin/UserManagement';
import Reports from './pages/Dashboards/Admin/Reports';
import AdminRides from './pages/Dashboards/Admin/Rides';
import AdminMessages from './pages/Admin/Messages';
import IssueReports from './pages/Admin/IssueReports';

// Common Pages
import Messages from './pages/Common/Messages';
import ReportIssue from './pages/Common/ReportIssue';

// Passenger Pages
import Expenses from './pages/Dashboards/Passenger/Expenses';
import PassengerPayment from './pages/Dashboards/Passenger/PassengerPayment';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
    const { user, loading } = useAuth();

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    );

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        const redirectPath = user.role === 'admin' ? '/admin/dashboard' :
            user.role === 'driver' ? '/driver/dashboard' : '/passenger/dashboard';
        return <Navigate to={redirectPath} replace />;
    }

    return children;
};

// Public Route Component
const PublicRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return null;

    if (user) {
        const redirectPath = user.role === 'admin' ? '/admin/dashboard' :
            user.role === 'driver' ? '/driver/dashboard' : '/passenger/dashboard';
        return <Navigate to={redirectPath} replace />;
    }

    return children;
};

// Page Wrapper for transitions
const PageWrapper = ({ children }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full h-full flex flex-col"
    >
        {children}
    </motion.div>
);

const AnimatedRoutes = () => {
    const location = useLocation();

    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
                {/* Landing page — default route */}
                <Route path="/" element={<PageWrapper><LandingPage /></PageWrapper>} />

                {/* Public Routes */}
                <Route path="/login" element={
                    <PublicRoute>
                        <PageWrapper><AuthPage /></PageWrapper>
                    </PublicRoute>
                } />
                <Route path="/register" element={
                    <PublicRoute>
                        <PageWrapper><AuthPage /></PageWrapper>
                    </PublicRoute>
                } />

                {/* Main App Layout */}
                <Route element={
                    <ProtectedRoute>
                        <MainLayout />
                    </ProtectedRoute>
                }>
                    <Route path="passenger/expenses" element={
                        <ProtectedRoute allowedRoles={['passenger']}>
                            <PageWrapper><Expenses /></PageWrapper>
                        </ProtectedRoute>
                    } />
                    <Route path="passenger/dashboard" element={
                        <ProtectedRoute allowedRoles={['passenger']}>
                            <PageWrapper><PassengerDashboard /></PageWrapper>
                        </ProtectedRoute>
                    } />
                    <Route path="passenger/book" element={
                        <ProtectedRoute allowedRoles={['passenger']}>
                            <PageWrapper><BookRide /></PageWrapper>
                        </ProtectedRoute>
                    } />
                    <Route path="passenger/payment" element={
                        <ProtectedRoute allowedRoles={['passenger']}>
                            <PageWrapper><PassengerPayment /></PageWrapper>
                        </ProtectedRoute>
                    } />
                    <Route path="passenger/history" element={
                        <ProtectedRoute allowedRoles={['passenger']}>
                            <PageWrapper><RideHistory /></PageWrapper>
                        </ProtectedRoute>
                    } />
                    <Route path="passenger/profile" element={
                        <ProtectedRoute allowedRoles={['passenger']}>
                            <PageWrapper><Profile /></PageWrapper>
                        </ProtectedRoute>
                    } />
                    <Route path="passenger/settings" element={
                        <ProtectedRoute allowedRoles={['passenger']}>
                            <PageWrapper><Settings /></PageWrapper>
                        </ProtectedRoute>
                    } />
                    <Route path="passenger/notifications" element={
                        <ProtectedRoute allowedRoles={['passenger']}>
                            <PageWrapper><Notifications /></PageWrapper>
                        </ProtectedRoute>
                    } />

                    {/* Driver Routes */}
                    <Route path="driver/dashboard" element={
                        <ProtectedRoute allowedRoles={['driver']}>
                            <PageWrapper><DriverDashboard /></PageWrapper>
                        </ProtectedRoute>
                    } />
                    <Route path="driver/live-map" element={
                        <ProtectedRoute allowedRoles={['driver']}>
                            <PageWrapper><LiveMap /></PageWrapper>
                        </ProtectedRoute>
                    } />
                    <Route path="driver/rides" element={
                        <ProtectedRoute allowedRoles={['driver']}>
                            <PageWrapper><RideHistory /></PageWrapper>
                        </ProtectedRoute>
                    } />
                    <Route path="driver/earnings" element={
                        <ProtectedRoute allowedRoles={['driver']}>
                            <PageWrapper><Earnings /></PageWrapper>
                        </ProtectedRoute>
                    } />
                    <Route path="driver/tax" element={
                        <ProtectedRoute allowedRoles={['driver']}>
                            <PageWrapper><TaxSummary /></PageWrapper>
                        </ProtectedRoute>
                    } />
                    <Route path="driver/profile" element={
                        <ProtectedRoute allowedRoles={['driver']}>
                            <PageWrapper><Profile /></PageWrapper>
                        </ProtectedRoute>
                    } />
                    <Route path="driver/settings" element={
                        <ProtectedRoute allowedRoles={['driver']}>
                            <PageWrapper><Settings /></PageWrapper>
                        </ProtectedRoute>
                    } />
                    <Route path="driver/notifications" element={
                        <ProtectedRoute allowedRoles={['driver']}>
                            <PageWrapper><Notifications /></PageWrapper>
                        </ProtectedRoute>
                    } />

                    {/* Admin Routes */}
                    <Route path="admin/dashboard" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <PageWrapper><AdminDashboard /></PageWrapper>
                        </ProtectedRoute>
                    } />
                    <Route path="admin/users" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <PageWrapper><UserManagement /></PageWrapper>
                        </ProtectedRoute>
                    } />
                    <Route path="admin/reports" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <PageWrapper><Reports /></PageWrapper>
                        </ProtectedRoute>
                    } />
                    <Route path="admin/rides" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <PageWrapper><AdminRides /></PageWrapper>
                        </ProtectedRoute>
                    } />
                    <Route path="admin/profile" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <PageWrapper><Profile /></PageWrapper>
                        </ProtectedRoute>
                    } />
                    <Route path="admin/settings" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <PageWrapper><Settings /></PageWrapper>
                        </ProtectedRoute>
                    } />
                    <Route path="admin/messages" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <PageWrapper><AdminMessages /></PageWrapper>
                        </ProtectedRoute>
                    } />
                    <Route path="admin/issues" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <PageWrapper><IssueReports /></PageWrapper>
                        </ProtectedRoute>
                    } />

                    {/* Passenger messages + report */}
                    <Route path="passenger/messages" element={
                        <ProtectedRoute allowedRoles={['passenger']}>
                            <PageWrapper><Messages /></PageWrapper>
                        </ProtectedRoute>
                    } />
                    <Route path="passenger/report" element={
                        <ProtectedRoute allowedRoles={['passenger']}>
                            <PageWrapper><ReportIssue /></PageWrapper>
                        </ProtectedRoute>
                    } />

                    {/* Driver messages + report */}
                    <Route path="driver/messages" element={
                        <ProtectedRoute allowedRoles={['driver']}>
                            <PageWrapper><Messages /></PageWrapper>
                        </ProtectedRoute>
                    } />
                    <Route path="driver/report" element={
                        <ProtectedRoute allowedRoles={['driver']}>
                            <PageWrapper><ReportIssue /></PageWrapper>
                        </ProtectedRoute>
                    } />
                </Route>

                {/* Catch All */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </AnimatePresence>
    );
};

// Listens for a forceLogout socket event (emitted by admin when blocking a user).
// Must be inside both AuthProvider and SocketProvider to access both contexts.
const ForceLogoutListener = () => {
    const socket = useSocket();
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const { showToast } = useDialog();

    useEffect(() => {
        if (!socket || !user) return;
        const handle = ({ reason }) => {
            logout();
            navigate('/login', { replace: true });
            setTimeout(() => {
                showToast(`Your account has been blocked. ${reason || 'Contact the administrator for more information.'}`, 'error');
            }, 200);
        };
        socket.on('forceLogout', handle);
        return () => socket.off('forceLogout', handle);
    }, [socket, user, logout, navigate, showToast]);

    return null;
};

function App() {
    return (
        <Router>
            <AuthProvider>
                <SocketProvider>
                    <NotificationProvider>
                        <ThemeProvider>
                            <DialogProvider>
                                <ForceLogoutListener />
                                <AnimatedRoutes />
                            </DialogProvider>
                        </ThemeProvider>
                    </NotificationProvider>
                </SocketProvider>
            </AuthProvider>
        </Router>
    );
}

export default App;


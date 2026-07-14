import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { auth, googleProvider } from "../../firebaseConfig";
import { signInWithPopup } from "firebase/auth";
import {
    Car,
    Users,
    Eye,
    EyeOff,
    AlertCircle,
    Loader2,
    Mail,
    Lock,
    User,
    Phone,
    ArrowRight,
    CheckCircle
} from "lucide-react";
import { rraLogo } from "../../assets";

const AuthPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, register, googleLogin, loading: authLoading } = useAuth();

    const [userType, setUserType] = useState("passenger");
    const [showPassword, setShowPassword] = useState(false);
    const [loginEmail, setLoginEmail] = useState("");
    const [loginPassword, setLoginPassword] = useState("");
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("login");
    const [logoError, setLogoError] = useState(false);

    useEffect(() => {
        const path = location.pathname;
        if (path === '/register') setActiveTab('register');
        else setActiveTab('login');
    }, [location.pathname]);

    const [registerFormData, setRegisterFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: ''
    });

    const handleRegisterInput = (field, value) => {
        setRegisterFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");
        try {
            const userData = await login(loginEmail, loginPassword);
            const role = userData.role;
            if (role === 'admin') navigate('/admin/dashboard');
            else if (role === 'driver') navigate('/driver/dashboard');
            else navigate('/passenger/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || "Authentication failed. Please check credentials.");
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        if (registerFormData.password !== registerFormData.confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        try {
            await register({
                fullName: registerFormData.fullName,
                email: registerFormData.email,
                phone: registerFormData.phone,
                password: registerFormData.password,
                role: userType
            });
            setActiveTab('login');
            setSuccessMsg("Registration successful! Please sign in.");
            navigate('/login');
        } catch (err) {
            setError(err.response?.data?.message || "Registration failed.");
        }
    };

    const handleGoogleSignIn = async () => {
        setIsGoogleLoading(true);
        setError("");
        setSuccessMsg("");
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const userData = await googleLogin(result.user, userType);
            const role = userData.role;
            if (role === 'admin') navigate('/admin/dashboard');
            else if (role === 'driver') navigate('/driver/dashboard');
            else navigate('/passenger/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || "Google sign in failed.");
        } finally {
            setIsGoogleLoading(false);
        }
    };

    const inputClass = "w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500 focus:border-rra-blue focus:ring-2 focus:ring-rra-blue/20 outline-none transition-all font-semibold text-xs bg-white text-gray-900 placeholder-gray-400";

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center p-4 sm:p-8 selection:bg-blue-200">
            <div className="w-full bg-white dark:bg-gray-900 rounded-3xl shadow-2xl flex border border-gray-200 dark:border-gray-800 overflow-hidden"
                style={{ minHeight: '600px', height: '92vh', maxHeight: '860px' }}>

                {/* Visual Panel */}
                <div
                    className="hidden lg:flex w-5/12 relative overflow-hidden flex-col justify-between p-10"
                    style={{ background: 'linear-gradient(135deg, #1E6BB5 0%, #155090 60%, #0f3a6b 100%)' }}
                >
                    {/* Dot pattern */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none"
                        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #fff 1px, transparent 0)', backgroundSize: '28px 28px' }} />

                    {/* Gold accent bar */}
                    <div className="absolute top-0 left-0 w-full h-1" style={{ background: 'var(--rra-gold)' }} />

                    {/* Top: RRA Logo + brand */}
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-10">
                            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg overflow-hidden p-1">
                                {!logoError ? (
                                    <img
                                        src={rraLogo}
                                        alt="RRA Logo"
                                        className="w-full h-full object-contain"
                                        onError={() => setLogoError(true)}
                                    />
                                ) : (
                                    <span className="text-rra-blue text-sm font-black">RRA</span>
                                )}
                            </div>
                            <div>
                                <p className="text-lg font-black text-white leading-none tracking-tight uppercase">RideShare</p>
                                <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest mt-0.5">Platform</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-4xl font-black text-white leading-tight tracking-tight">
                                Modern <br />
                                <span style={{ color: 'var(--rra-gold)' }}>Transportation</span> <br />
                                Solution.
                            </h2>
                            <p className="text-blue-100 font-medium text-sm leading-relaxed opacity-80">
                                Integrated transportation platform for efficient, tax-compliant ride management.
                            </p>
                        </div>

                        {/* Feature bullets */}
                        <div className="mt-8 space-y-3">
                            {[
                                'Real-time ride tracking',
                                'Automated tax reporting',
                            ].map((f) => (
                                <div key={f} className="flex items-center gap-2.5">
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--rra-gold)' }}>
                                        <CheckCircle size={11} className="text-white" />
                                    </div>
                                    <p className="text-blue-100 text-xs font-medium">{f}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bottom stats */}
                    <div className="relative z-10 grid grid-cols-2 gap-6 border-t border-white/15 pt-6">
                    </div>
                </div>

                {/* Form Panel */}
                <div className="w-full lg:w-7/12 flex flex-col overflow-y-auto no-scrollbar">
                    {/* Mobile header */}
                    <div className="lg:hidden flex items-center gap-3 px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-rra-blue flex items-center justify-center shadow-sm p-0.5">
                            {!logoError ? (
                                <img src={rraLogo} alt="RRA" className="w-full h-full object-contain" onError={() => setLogoError(true)} />
                            ) : (
                                <span className="text-white text-xs font-black">RRA</span>
                            )}
                        </div>
                        <div>
                            <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">RideShare</p>
                            <p className="text-[9px] font-bold text-rra-blue uppercase tracking-widest">Platform</p>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center px-8 md:px-12 py-8">
                        <div className="w-full max-w-sm mx-auto">
                            {/* Header */}
                            <div className="mb-7">
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                                    {activeTab === 'login' ? 'Welcome Back' : 'Create Account'}
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400 font-medium text-xs mt-1">
                                    {activeTab === 'login'
                                        ? 'Sign in to your RideShare account'
                                        : 'Register to join the RideShare platform'}
                                </p>
                            </div>

                            {/* Tab switcher */}
                            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl mb-6">
                                <button
                                    onClick={() => { setActiveTab('login'); navigate('/login'); setError(''); setSuccessMsg(''); }}
                                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                        activeTab === 'login'
                                            ? 'bg-white dark:bg-gray-700 text-rra-blue shadow-sm'
                                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                    }`}
                                >
                                    Sign In
                                </button>
                                <button
                                    onClick={() => { setActiveTab('register'); navigate('/register'); setError(''); setSuccessMsg(''); }}
                                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                        activeTab === 'register'
                                            ? 'bg-white dark:bg-gray-700 text-rra-blue shadow-sm'
                                            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                    }`}
                                >
                                    Register
                                </button>
                            </div>

                            <AnimatePresence mode="wait">
                                {activeTab === 'login' ? (
                                    <motion.form
                                        key="login"
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.2 }}
                                        onSubmit={handleLogin}
                                        className="space-y-4"
                                    >
                                        <div className="space-y-3">
                                            <div className="relative">
                                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                                                <input
                                                    type="email"
                                                    value={loginEmail}
                                                    onChange={(e) => setLoginEmail(e.target.value)}
                                                    className={inputClass}
                                                    placeholder="Email address"
                                                    required
                                                />
                                            </div>
                                            <div className="relative">
                                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    value={loginPassword}
                                                    onChange={(e) => setLoginPassword(e.target.value)}
                                                    className={`${inputClass} pr-11`}
                                                    placeholder="Password"
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                                >
                                                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                                </button>
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={authLoading}
                                            className="w-full py-3.5 rounded-xl font-black text-[11px] uppercase tracking-wider text-white flex items-center justify-center gap-2 group transition-all active:scale-95 disabled:opacity-70"
                                            style={{ background: 'var(--rra-blue)' }}
                                        >
                                            {authLoading
                                                ? <Loader2 className="animate-spin" size={16} />
                                                : (<>Sign In</>)
                                            }
                                        </button>
                                    </motion.form>
                                ) : (
                                    <motion.form
                                        key="register"
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.2 }}
                                        onSubmit={handleRegister}
                                        className="space-y-3"
                                    >
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="relative">
                                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                                <input
                                                    type="text"
                                                    placeholder="Full Name"
                                                    className={inputClass}
                                                    value={registerFormData.fullName}
                                                    onChange={(e) => handleRegisterInput('fullName', e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div className="relative">
                                                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                                <input
                                                    type="tel"
                                                    placeholder="Phone"
                                                    className={inputClass}
                                                    value={registerFormData.phone}
                                                    onChange={(e) => handleRegisterInput('phone', e.target.value)}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                            <input
                                                type="email"
                                                placeholder="Email address"
                                                className={inputClass}
                                                value={registerFormData.email}
                                                onChange={(e) => handleRegisterInput('email', e.target.value)}
                                                required
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <input
                                                type="password"
                                                placeholder="Password"
                                                className={inputClass.replace('pl-10', 'px-4')}
                                                value={registerFormData.password}
                                                onChange={(e) => handleRegisterInput('password', e.target.value)}
                                                required
                                            />
                                            <input
                                                type="password"
                                                placeholder="Confirm"
                                                className={inputClass.replace('pl-10', 'px-4')}
                                                value={registerFormData.confirmPassword}
                                                onChange={(e) => handleRegisterInput('confirmPassword', e.target.value)}
                                                required
                                            />
                                        </div>

                                        <UserTypeSelector value={userType} onChange={setUserType} />

                                        <button
                                            type="submit"
                                            disabled={authLoading}
                                            className="w-full py-3.5 rounded-xl font-black text-[11px] uppercase tracking-wider text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70"
                                            style={{ background: 'var(--rra-blue)' }}
                                        >
                                            {authLoading
                                                ? <Loader2 className="animate-spin" size={16} />
                                                : "Create Account"}
                                        </button>
                                    </motion.form>
                                )}
                            </AnimatePresence>

                            {/* Divider */}
                            <div className="relative my-5">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                                </div>
                                <div className="relative flex justify-center">
                                    <span className="px-3 bg-white dark:bg-gray-900 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                        or continue with
                                    </span>
                                </div>
                            </div>

                            {/* Google Sign-In */}
                            <button
                                type="button"
                                onClick={handleGoogleSignIn}
                                disabled={isGoogleLoading}
                                className="w-full py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-all active:scale-95 shadow-sm"
                            >
                                {isGoogleLoading
                                    ? <Loader2 className="animate-spin text-rra-blue" size={16} />
                                    : <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" />
                                }
                                <span className="text-[10px] font-black text-gray-700 dark:text-gray-300 tracking-wider uppercase">
                                    Sign in with Google
                                </span>
                            </button>

                            {/* Messages */}
                            <AnimatePresence>
                                {successMsg && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-2"
                                    >
                                        <CheckCircle className="text-green-500 shrink-0" size={15} />
                                        <p className="text-[10px] font-bold text-green-700 dark:text-green-400">{successMsg}</p>
                                    </motion.div>
                                )}
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2"
                                    >
                                        <AlertCircle className="text-red-500 shrink-0" size={15} />
                                        <p className="text-[10px] font-bold text-red-600 dark:text-red-400">{error}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const UserTypeSelector = ({ value, onChange }) => (
    <div className="space-y-1.5">
        <label className="block text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            Register As
        </label>
        <div className="grid grid-cols-2 gap-2">
            {[
                { id: 'passenger', label: 'Passenger', icon: Users },
                { id: 'driver', label: 'Driver', icon: Car },
            ].map((type) => (
                <div
                    key={type.id}
                    onClick={() => onChange(type.id)}
                    className={`cursor-pointer border-2 px-3 py-2.5 rounded-xl flex items-center gap-2 transition-all ${
                        value === type.id
                            ? 'border-rra-blue bg-rra-blue/5 dark:bg-rra-blue/10'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                >
                    <type.icon
                        size={14}
                        className={value === type.id ? 'text-rra-blue' : 'text-gray-400'}
                    />
                    <span className={`text-[10px] font-black uppercase tracking-tight ${
                        value === type.id ? 'text-rra-blue' : 'text-gray-600 dark:text-gray-300'
                    }`}>
                        {type.label}
                    </span>
                </div>
            ))}
        </div>
    </div>
);

export default AuthPage;

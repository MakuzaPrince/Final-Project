import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../../context/AuthContext';
import { useDialog } from '../../../context/DialogContext';
import {
    CreditCard,
    Smartphone,
    RotateCw,
    CheckCircle,
    XCircle,
    History,
    MapPin,
    User,
    DollarSign,
    AlertCircle,
    ArrowRight,
    TrendingUp,
    Navigation,
    Calendar,
    Sparkles
} from 'lucide-react';

const PassengerPayment = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { showConfirm } = useDialog();

    // Payment state
    const [unpaidRide, setUnpaidRide] = useState(null);
    const [historyPayments, setHistoryPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [phone, setPhone] = useState(() => {
        // Pre-fill from user profile, stripping the country code if present
        const raw = user?.phone || '';
        return raw.startsWith('250') ? '0' + raw.slice(3) : raw;
    });
    const [provider, setProvider] = useState('MTN'); // MTN, AIRTEL
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentRef, setPaymentRef] = useState(null);
    const [paymentStatus, setPaymentStatus] = useState(null); // 'pending', 'successful', 'failed'
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        fetchPaymentData();
    }, []);

    const fetchPaymentData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Ride History and prefer the most recent ride that still needs payment.
            const rideRes = await axios.get('http://localhost:5000/api/rides/history');
            const rides = rideRes.data || [];

            const completedSettled = rides.find(
                ride => ride.status === 'completed' && ['paid', 'successful'].includes(ride.paymentStatus)
            );

            const pendingUnpaid = rides.find(ride => {
                const isActionable = ['ongoing', 'accepted'].includes(ride.status) || (ride.status === 'completed' && !['paid', 'successful'].includes(ride.paymentStatus));
                return isActionable && ['unpaid', 'failed', 'pending'].includes(ride.paymentStatus);
            });

            setUnpaidRide(pendingUnpaid || (completedSettled ? null : null));

            // 2. Fetch completed payment history
            const paymentRes = await axios.get('http://localhost:5000/api/payments/history');
            setHistoryPayments(paymentRes.data || []);

        } catch (error) {
            console.error("Error fetching payment data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleInitiatePayment = async (e) => {
        e.preventDefault();
        if (!unpaidRide) return;
        if (!phone || !phone.trim()) {
            setErrorMessage("Please enter your mobile money phone number.");
            return;
        }

        setIsProcessing(true);
        setErrorMessage('');
        setPaymentStatus('pending');

        try {
            const { data } = await axios.post('http://localhost:5000/api/payments/charge', {
                phone: phone,
                rideId: unpaidRide._id
            });

            if (data.success && data.payment) {
                setPaymentRef(data.payment.paypackRef);
                startStatusPolling(data.payment.paypackRef);
            } else {
                throw new Error("Unable to initiate charge on your account.");
            }
        } catch (error) {
            console.error("Payment Initiation Error:", error);
            setIsProcessing(false);
            setPaymentStatus('failed');
            setErrorMessage(error.response?.data?.message || error.message || "Payment initiation failed.");
        }
    };

    const handleCancelPayment = async () => {
        if (!unpaidRide) return;
        
        const confirmCancel = await showConfirm("Are you sure you want to cancel this payment? This will cancel the ride status.");
        if (!confirmCancel) return;

        setLoading(true);
        try {
            await axios.put(`http://localhost:5000/api/rides/${unpaidRide._id}/status`, {
                status: 'cancelled'
            });
            // Clear active ride states from sessionStorage
            sessionStorage.removeItem('ride_accepted');
            sessionStorage.removeItem('ride_status');
            sessionStorage.removeItem('ride_pending_id');
            
            // Re-fetch payment data
            await fetchPaymentData();
        } catch (error) {
            console.error("Cancel Payment Error:", error);
            setErrorMessage(error.response?.data?.message || error.message || "Failed to cancel payment.");
        } finally {
            setLoading(false);
        }
    };

    const startStatusPolling = (ref) => {
        let attempts = 0;
        const maxAttempts = 30; // ~2 minutes maximum polling
        
        const pollInterval = setInterval(async () => {
            attempts++;
            try {
                const { data } = await axios.get(`http://localhost:5000/api/payments/status/${ref}`);
                
                if (data.success) {
                    if (data.status === 'successful') {
                        clearInterval(pollInterval);
                        setPaymentStatus('successful');
                        setIsProcessing(false);
                        setUnpaidRide(null);
                        setErrorMessage('');

                        // Clear active ride states from sessionStorage
                        sessionStorage.removeItem('ride_accepted');
                        sessionStorage.removeItem('ride_status');
                        sessionStorage.removeItem('ride_pending_id');

                        // Re-fetch history
                        fetchPaymentData();
                    } else if (data.status === 'failed') {
                        clearInterval(pollInterval);
                        setPaymentStatus('failed');
                        setIsProcessing(false);
                        setErrorMessage("The transaction was declined or failed on your mobile phone.");
                    }
                }
            } catch (error) {
                console.error("Status Poll Error:", error);
            }

            if (attempts >= maxAttempts) {
                clearInterval(pollInterval);
                setPaymentStatus('failed');
                setIsProcessing(false);
                setErrorMessage("Payment timed out. Please check your mobile wallet and dial *182# if necessary.");
            }
        }, 4000); // Poll every 4 seconds
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return 'N/A';
        const d = new Date(dateString);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20 relative">
            
            {/* Header section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black dark:text-white uppercase tracking-tight italic flex items-center gap-3">
                        <CreditCard className="text-blue-600 w-8 h-8" />
                        Passenger Payment
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 font-bold text-sm">
                        Complete outstanding ride payments securely using Paypack Mobile Money.
                    </p>
                </div>
                <button
                    onClick={fetchPaymentData}
                    className="p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 hover:border-blue-500 transition-all flex items-center gap-2 active:scale-95"
                >
                    <RotateCw size={16} className={loading ? "animate-spin text-blue-500" : "text-gray-500"} />
                    <span className="text-xs font-black uppercase tracking-wider">Sync ledger</span>
                </button>
            </div>

            {loading ? (
                <div className="min-h-[400px] flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* LEFT / CENTER: Active Payment Checkout Area */}
                    <div className="lg:col-span-2 space-y-8">
                        {unpaidRide ? (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-xl border-2 border-blue-500/20 overflow-hidden"
                            >
                                {/* Active Ride Header Banner */}
                                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white relative overflow-hidden">
                                    <div className="relative z-10">
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[9px] font-black uppercase tracking-widest text-blue-200">
                                            <Sparkles size={10} /> Pending Settlement
                                        </div>
                                        <h2 className="text-2xl font-black mt-3 italic uppercase tracking-tight">Checkout Outstanding Ride</h2>
                                        <p className="text-blue-100/80 text-xs mt-1">Verify ride details and authorize payment via push prompt.</p>
                                    </div>
                                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
                                </div>

                                {/* Active Ride Details Grid */}
                                <div className="p-8 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 dark:bg-gray-900/40 p-6 rounded-3xl border border-gray-100 dark:border-gray-800">
                                        <div className="space-y-4">
                                            <div>
                                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Pickup Location</span>
                                                <p className="text-xs font-bold dark:text-white truncate flex items-center gap-2 mt-1">
                                                    <MapPin size={14} className="text-yellow-500 shrink-0" />
                                                    {unpaidRide.pickupLocation?.address || "Pickup address not found"}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Destination</span>
                                                <p className="text-xs font-bold dark:text-white truncate flex items-center gap-2 mt-1">
                                                    <MapPin size={14} className="text-red-500 shrink-0" />
                                                    {unpaidRide.destinationLocation?.address || "Destination address not found"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-4 border-t md:border-t-0 md:border-l border-gray-200/50 dark:border-gray-800 md:pl-6 pt-4 md:pt-0">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Driver</span>
                                                    <p className="text-xs font-bold dark:text-white flex items-center gap-1.5 mt-0.5">
                                                        <User size={13} className="text-blue-500" />
                                                        {unpaidRide.driverName || "Verified Driver"}
                                                    </p>
                                                </div>
                                                <span className="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                                                    {unpaidRide.status}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Distance</span>
                                                    <p className="text-xs font-bold dark:text-white mt-0.5">{unpaidRide.distanceKm} km</p>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Date</span>
                                                    <p className="text-xs font-bold dark:text-white mt-0.5">{new Date(unpaidRide.createdAt).toLocaleDateString('en-GB')}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Fare breakdown */}
                                    <div className="p-6 bg-gray-50/50 dark:bg-gray-900/10 rounded-3xl border border-gray-100 dark:border-gray-800 space-y-3">
                                        <div className="flex justify-between text-xs font-bold text-gray-500">
                                            <span>Base Fare</span>
                                            <span>{unpaidRide.baseFare?.toLocaleString()} RWF</span>
                                        </div>
                                        <div className="flex justify-between text-xs font-bold text-gray-500">
                                            <span>Tax Amount</span>
                                            <span>{unpaidRide.taxAmount?.toLocaleString()} RWF</span>
                                        </div>
                                        <div className="flex justify-between items-baseline pt-3 border-t dark:border-gray-800">
                                            <span className="text-sm font-black dark:text-white uppercase tracking-wider">Total Settlement</span>
                                            <span className="text-3xl font-black text-blue-600 dark:text-blue-400 italic">
                                                {unpaidRide.totalFare?.toLocaleString()} <span className="text-xs not-italic text-gray-400 font-bold uppercase">RWF</span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* Payment Method Entry Form */}
                                    <form onSubmit={handleInitiatePayment} className="space-y-6 pt-4 border-t dark:border-gray-800">
                                        <h3 className="text-sm font-black dark:text-white uppercase tracking-tight flex items-center gap-2">
                                            <Smartphone className="text-emerald-500" /> Choose Paypack Wallet
                                        </h3>

                                        {/* Exact charge amount — shown before phone entry so user knows what will be debited */}
                                        <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-2xl">
                                            <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">Amount to Debit</span>
                                            <span className="text-2xl font-black text-blue-700 dark:text-blue-300 italic">
                                                {unpaidRide.totalFare?.toLocaleString()} <span className="text-xs not-italic font-bold text-blue-400">RWF</span>
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                type="button"
                                                onClick={() => setProvider('MTN')}
                                                className={`p-5 rounded-2xl border-2 transition-all flex items-center justify-center gap-3 active:scale-95 ${provider === 'MTN'
                                                    ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 font-black'
                                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 font-bold'
                                                    }`}
                                            >
                                                <div className="w-6 h-6 rounded-full bg-amber-500 text-white font-black flex items-center justify-center text-[10px]">M</div>
                                                MTN MoMo
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setProvider('AIRTEL')}
                                                className={`p-5 rounded-2xl border-2 transition-all flex items-center justify-center gap-3 active:scale-95 ${provider === 'AIRTEL'
                                                    ? 'bg-rose-600/10 border-rose-600 text-rose-600 dark:text-rose-400 font-black'
                                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 font-bold'
                                                    }`}
                                            >
                                                <div className="w-6 h-6 rounded-full bg-rose-600 text-white font-black flex items-center justify-center text-[10px]">A</div>
                                                Airtel Money
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">MoMo Account Number</label>
                                            <div className="flex items-center rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/40 p-4 transition-all focus-within:border-blue-500">
                                                <Smartphone className="text-gray-400 mr-3" size={18} />
                                                <input
                                                    type="text"
                                                    placeholder="e.g. 0788888888"
                                                    value={phone}
                                                    onChange={(e) => setPhone(e.target.value)}
                                                    className="bg-transparent outline-none dark:text-white w-full font-bold tracking-wider"
                                                />
                                            </div>
                                            <p className="text-[9px] text-gray-400 leading-normal">Rwanda mobile numbers must start with 07xxxxxxxx (10 digits).</p>
                                        </div>

                                        {errorMessage && (
                                            <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-2xl text-xs font-bold flex items-center gap-2">
                                                <AlertCircle size={16} />
                                                {errorMessage}
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <DollarSign size={18} />
                                            Pay {unpaidRide.totalFare?.toLocaleString()} RWF
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleCancelPayment}
                                            disabled={isProcessing}
                                            className="w-full py-4 bg-transparent border-2 border-red-500/30 hover:border-red-500/60 text-red-500 dark:text-red-400 hover:bg-red-500/10 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                                        >
                                            <XCircle size={16} />
                                            Cancel Payment
                                        </button>
                                    </form>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-12 text-center border border-gray-100 dark:border-gray-700 shadow-xl flex flex-col items-center justify-center min-h-[450px]"
                            >
                                <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 rounded-full flex items-center justify-center mb-6 border border-emerald-100 dark:border-emerald-900/30 shadow-md">
                                    <CheckCircle size={40} />
                                </div>
                                <h2 className="text-3xl font-black dark:text-white italic uppercase tracking-tight">All Settled Up!</h2>
                                <p className="text-gray-500 dark:text-gray-400 font-bold text-sm mt-2 max-w-sm mx-auto leading-relaxed">
                                    No outstanding ride payments are currently pending on your account. You're ready to request new rides!
                                </p>
                                <button
                                    onClick={() => navigate('/passenger/book')}
                                    className="mt-8 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all flex items-center gap-2"
                                >
                                    <Navigation size={14} /> Book a Ride Now
                                </button>
                            </motion.div>
                        )}
                    </div>

                    {/* RIGHT: Linked Assets & Recent Payments Ledger */}
                    <div className="space-y-8">
                        {/* MoMo Security Badge */}
                        <div className="bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded-[2rem] p-6 text-white border border-white/5 shadow-lg space-y-4">
                            <div className="flex justify-between items-start">
                                <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                                    <CreditCard className="text-blue-400" size={24} />
                                </div>
                                <span className="text-[8px] bg-blue-500/20 text-blue-300 font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-blue-500/30">Secured</span>
                            </div>
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-widest text-white/40">Paypack Gateway</h3>
                                <p className="text-sm font-bold mt-1 text-white/90 leading-relaxed">
                                    Encrypted mobile money integration directly operating with MTN and Airtel cellular networks.
                                </p>
                            </div>
                        </div>

                        {/* Recent Payments Ledger */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-black dark:text-white uppercase tracking-tight flex items-center gap-2 pl-2">
                                <History className="text-blue-500" size={18} />
                                Receipt Ledger
                            </h2>

                            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 border border-gray-100 dark:border-gray-700 shadow-sm space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                                {historyPayments.length === 0 ? (
                                    <div className="text-center py-10">
                                        <History size={32} className="mx-auto text-gray-200 dark:text-gray-700 mb-2" />
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">No transactions found</p>
                                    </div>
                                ) : (
                                    historyPayments.map((payment) => (
                                        <div 
                                            key={payment._id} 
                                            className="p-4 bg-gray-50/50 dark:bg-gray-900/30 rounded-2xl border border-gray-100/50 dark:border-gray-800/80 flex items-center justify-between group hover:border-blue-500/20 transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${payment.status === 'successful'
                                                    ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500'
                                                    : 'bg-rose-50 dark:bg-rose-950/20 text-rose-500'
                                                    }`}>
                                                    <DollarSign size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-black dark:text-white truncate uppercase tracking-tight">
                                                        {payment.ride?.driverName || "Ride Charge"}
                                                    </p>
                                                    <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest italic mt-0.5">
                                                        {formatDateTime(payment.createdAt)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-black dark:text-white tracking-tighter">
                                                    {payment.amount?.toLocaleString()} RWF
                                                </p>
                                                <span className={`text-[8px] font-black uppercase tracking-widest ${payment.status === 'successful'
                                                    ? 'text-emerald-500'
                                                    : 'text-rose-500'
                                                    }`}>
                                                    {payment.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            )}

            {/* PROCESSING OVERLAY MODAL */}
            <AnimatePresence>
                {isProcessing && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 10 }}
                            className="bg-white dark:bg-gray-800 rounded-[3rem] p-10 max-w-md w-full shadow-2xl text-center border border-gray-100 dark:border-gray-700"
                        >
                            {paymentStatus === 'pending' && (
                                <div className="space-y-6">
                                    <div className="relative w-20 h-20 mx-auto">
                                        <div className="absolute inset-0 rounded-full border-4 border-blue-100 dark:border-gray-700"></div>
                                        <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 animate-spin"></div>
                                    </div>
                                    
                                    <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight italic">Authorizing Payment</h2>
                                    <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl text-xs font-bold">
                                        MoMo Prompt Sent to {phone}
                                    </div>
                                    <div className="space-y-2 text-gray-500 dark:text-gray-400 text-sm leading-relaxed max-w-xs mx-auto">
                                        <p>1. Please check your phone for the PIN request prompt.</p>
                                        <p>2. Enter your MoMo PIN to authorize the transaction.</p>
                                        <p>3. Do not close this window. We are updating status automatically...</p>
                                    </div>
                                    <p className="text-[10px] text-gray-400 italic">Reference: {paymentRef || 'Generating Ref...'}</p>
                                </div>
                            )}

                            {paymentStatus === 'successful' && (
                                <div className="space-y-6">
                                    <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                                        <CheckCircle size={44} className="animate-in zoom-in duration-500" />
                                    </div>
                                    <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight italic">Payment Successful!</h2>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed max-w-xs mx-auto">
                                        Thank you! Your outstanding fare has been settled successfully. The driver has been credited in their wallet.
                                    </p>
                                    <button
                                        onClick={() => setIsProcessing(false)}
                                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-black uppercase shadow-lg active:scale-95 transition-all"
                                    >
                                        Complete & Dismiss
                                    </button>
                                </div>
                            )}

                            {paymentStatus === 'failed' && (
                                <div className="space-y-6">
                                    <div className="w-20 h-20 bg-rose-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-rose-500/20">
                                        <XCircle size={44} className="animate-in zoom-in duration-500" />
                                    </div>
                                    <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight italic">Transaction Failed</h2>
                                    <p className="text-red-500 dark:text-red-400 text-xs font-bold bg-red-50 dark:bg-red-950/20 p-3 rounded-xl">
                                        {errorMessage || "Decline, network timeout or customer rejection."}
                                    </p>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xs mx-auto">
                                        Please confirm your phone has sufficient funds, cellular network is active, and try again.
                                    </p>
                                    <button
                                        onClick={() => setIsProcessing(false)}
                                        className="w-full py-4 bg-gray-100 dark:bg-gray-700 dark:text-white rounded-2xl font-black uppercase active:scale-95 transition-all"
                                    >
                                        Close & Retry
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PassengerPayment;

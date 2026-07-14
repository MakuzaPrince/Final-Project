import React, { useState, useEffect } from 'react';
import {
    CreditCard,
    Plus,
    DollarSign,
    Smartphone,
    TrendingUp,
    Download,
    ArrowUpRight,
    ArrowDownLeft,
    ChevronRight,
    Search,
    History
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const Wallet = () => {
    const { user } = useAuth();
    const [balance, setBalance] = useState(0);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchWallet = async () => {
            try {
                const token = sessionStorage.getItem('token');
                if (!token) return;

                try {
                    const { data } = await axios.get('http://localhost:5000/api/wallet');
                    setBalance(data.balance);
                    setPaymentMethods(data.paymentMethods || []);
                } catch (e) {
                    console.log("Using mock wallet data");
                    setBalance(150000); // Increased mock balance for premium feel
                    setPaymentMethods([
                        { type: 'mobile_money', number: '078***123', provider: 'MTN MoMo', isDefault: true },
                        { type: 'card', number: '**** **** **** 4242', provider: 'Visa / Bank of Kigali', isDefault: false }
                    ]);
                }
            } catch (error) {
                console.error("Error fetching wallet:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchWallet();
    }, []);

    const transactions = [
        { id: 1, type: 'credit', title: 'Ride Refund', date: 'Feb 15, 2026', amount: '4,500 RWF', status: 'Completed' },
        { id: 2, type: 'debit', title: 'Ride Payment', date: 'Feb 14, 2026', amount: '-12,000 RWF', status: 'Completed' },
        { id: 3, type: 'credit', title: 'Top Up - MTN', date: 'Feb 12, 2026', amount: '50,000 RWF', status: 'Completed' },
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
            {/* Premium Metallic Balance Card */}
            <div className="relative group perspective">
                <div className="bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded-[2.5rem] p-10 md:p-14 text-white shadow-2xl relative overflow-hidden transition-all duration-500 hover:shadow-blue-500/10 border border-white/5">
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/5 text-[10px] font-black uppercase tracking-widest text-blue-400">
                                <TrendingUp size={12} />
                                Active Capital
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-bold text-white/50 uppercase tracking-[0.2em] italic">Current Liquidity</p>
                                <h1 className="text-5xl md:text-6xl font-black italic tracking-tighter">
                                    {balance.toLocaleString()} <span className="text-xl not-italic text-white/30 font-bold tracking-normal uppercase">RWF</span>
                                </h1>
                            </div>
                            <div className="flex flex-wrap gap-4 pt-4">
                                <button className="px-8 py-4 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-blue-50 transition-all flex items-center gap-2 active:scale-95">
                                    <Plus size={18} /> Add Funds
                                </button>
                                <button className="px-8 py-4 bg-white/10 backdrop-blur-md border border-white/10 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white/20 transition-all flex items-center gap-2 active:scale-95">
                                    <ArrowDownLeft size={18} /> Withdraw
                                </button>
                            </div>
                        </div>

                        <div className="hidden md:flex flex-col items-end justify-center text-right space-y-4 border-l border-white/5 pl-10">
                            <div className="p-4 bg-white/5 rounded-3xl backdrop-blur-md border border-white/5">
                                <CreditCard size={40} className="text-blue-500" />
                            </div>
                            <div>
                                <h3 className="text-xs font-black text-white/30 uppercase tracking-widest">Digital Wallet ID</h3>
                                <p className="font-mono text-lg font-bold tracking-widest">WAL-8829-XR44</p>
                            </div>
                        </div>
                    </div>

                    {/* Background decorations */}
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px]"></div>
                    <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-emerald-600/10 rounded-full blur-[80px]"></div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Transaction Feed */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between px-4">
                        <h2 className="text-xl font-black dark:text-white flex items-center gap-2 italic uppercase tracking-widest">
                            <History size={20} className="text-blue-500" />
                            Activity Log
                        </h2>
                        <div className="flex gap-2">
                            <button className="p-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-500 hover:text-blue-500 transition-colors">
                                <Search size={18} />
                            </button>
                            <button className="p-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-500 hover:text-blue-500 transition-colors">
                                <Download size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden divide-y dark:divide-gray-700">
                        {transactions.map((tx) => (
                            <div key={tx.id} className="p-6 md:p-8 flex items-center justify-between group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all cursor-default">
                                <div className="flex items-center gap-6">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${tx.type === 'credit'
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600'
                                        : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600'
                                        }`}>
                                        {tx.type === 'credit' ? <ArrowUpRight size={24} /> : <ArrowDownLeft size={24} />}
                                    </div>
                                    <div>
                                        <h4 className="font-black dark:text-white text-lg tracking-tight">{tx.title}</h4>
                                        <p className="text-sm font-bold text-gray-400 italic">{tx.date}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-xl font-black tracking-tighter ${tx.type === 'credit' ? 'text-emerald-500' : 'dark:text-white'
                                        }`}>{tx.amount}</p>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{tx.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Linked Methods */}
                <div className="space-y-6">
                    <h2 className="text-xl font-black dark:text-white flex items-center gap-2 px-4 italic uppercase tracking-widest">
                        <CreditCard size={20} className="text-emerald-500" />
                        Assets
                    </h2>
                    <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 shadow-sm border border-gray-100 dark:border-gray-700 space-y-6">
                        <div className="space-y-4">
                            {paymentMethods.map((method, i) => (
                                <div key={i} className="relative group cursor-pointer">
                                    <div className="p-5 rounded-3xl border-2 border-gray-50 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all flex items-center gap-4 bg-gray-50/50 dark:bg-gray-900/40">
                                        <div className={`p-3 rounded-2xl ${method.type === 'card' ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                                            {method.type === 'card' ? <CreditCard size={20} /> : <Smartphone size={20} />}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{method.provider}</p>
                                            <p className="font-bold dark:text-white tracking-widest">{method.number}</p>
                                        </div>
                                        {method.isDefault && <div className="w-2 h-2 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"></div>}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button className="w-full py-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 active:scale-95">
                            <Plus size={16} /> Link New Asset
                        </button>

                        <div className="pt-6 mt-6 border-t dark:border-gray-700">
                            <div className="p-5 bg-blue-50 dark:bg-blue-900/20 rounded-3xl border border-blue-100 dark:border-blue-900/30">
                                <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-1 italic">Security Note</p>
                                <p className="text-xs font-bold text-blue-800/80 dark:text-blue-300 leading-relaxed">
                                    All transactions are encrypted and processed via secured gateway providers.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Wallet;


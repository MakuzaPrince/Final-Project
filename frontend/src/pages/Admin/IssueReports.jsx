import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useDialog } from '../../context/DialogContext';
import {
    AlertTriangle, Search, X, ChevronDown, CheckCircle,
    Clock, Loader2, Send, Filter, RefreshCw, AlertCircle
} from 'lucide-react';

const API = 'http://localhost:5000/api/reports';
const headers = () => ({ Authorization: `Bearer ${sessionStorage.getItem('token')}` });

const STATUS_STYLES = {
    open: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/40',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/40',
    resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40',
    closed: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
};

const PRIORITY_STYLES = {
    low: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
    medium: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    high: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

const PRIORITY_DOT = { low: 'bg-gray-400', medium: 'bg-orange-500', high: 'bg-red-500' };

const formatDate = (d) => new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
});

const Avatar = ({ user }) => {
    const initials = (user?.fullName || 'U').charAt(0).toUpperCase();
    const color = user?.role === 'driver' ? 'bg-emerald-600' : 'bg-rra-blue';
    return (
        <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center text-white text-sm font-black shrink-0 overflow-hidden`}>
            {user?.profileImage
                ? <img src={user.profileImage} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
                : initials
            }
        </div>
    );
};

const IssueReports = () => {
    const { showToast } = useDialog();
    const [reports, setReports] = useState([]);
    const [stats, setStats] = useState({ open: 0, inProgress: 0, resolved: 0, closed: 0, total: 0 });
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [responseText, setResponseText] = useState('');
    const [responseStatus, setResponseStatus] = useState('');
    const [saving, setSaving] = useState(false);

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');

    const loadReports = useCallback(async () => {
        setLoading(true);
        try {
            const [repRes, statsRes] = await Promise.all([
                axios.get(API, {
                    params: { status: statusFilter, priority: priorityFilter, category: categoryFilter, search },
                    headers: headers()
                }),
                axios.get(`${API}/stats`, { headers: headers() })
            ]);
            setReports(repRes.data);
            setStats(statsRes.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, priorityFilter, categoryFilter, search]);

    useEffect(() => { loadReports(); }, [loadReports]);

    const openReport = (report) => {
        setSelected(report);
        setResponseText(report.adminResponse || '');
        setResponseStatus(report.status);
    };

    const saveResponse = async () => {
        if (!selected) return;
        setSaving(true);
        try {
            const { data } = await axios.put(`${API}/${selected._id}`, {
                status: responseStatus,
                adminResponse: responseText
            }, { headers: headers() });
            setSelected(data);
            setReports(prev => prev.map(r => r._id === data._id ? data : r));
            // Refresh stats
            const { data: s } = await axios.get(`${API}/stats`, { headers: headers() });
            setStats(s);
        } catch (e) {
            showToast(e.response?.data?.message || 'Failed to save response', 'error');
        } finally {
            setSaving(false);
        }
    };

    const statCards = [
        { label: 'Open', value: stats.open, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', key: 'open' },
        { label: 'In Progress', value: stats.inProgress, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', key: 'in_progress' },
        { label: 'Resolved', value: stats.resolved, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', key: 'resolved' },
        { label: 'Total', value: stats.total, color: 'text-gray-600 dark:text-gray-300', bg: 'bg-gray-50 dark:bg-gray-800', key: 'all' },
    ];

    return (
        <div className="w-full space-y-5 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Issue Reports</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">Manage and respond to user-submitted issues</p>
                </div>
                <button onClick={loadReports} className="p-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 hover:text-rra-blue hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {statCards.map(s => (
                    <button
                        key={s.key}
                        onClick={() => setStatusFilter(s.key)}
                        className={`p-4 rounded-2xl border text-left transition-all hover:shadow-sm active:scale-95 ${
                            statusFilter === s.key
                                ? 'border-rra-blue ring-2 ring-rra-blue/20'
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                        }`}
                    >
                        <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">{s.label}</p>
                    </button>
                ))}
            </div>

            <div className="flex flex-col xl:flex-row gap-5">
                {/* ── LEFT: reports list ─────────────────────────────────────── */}
                <div className="xl:w-[480px] shrink-0 space-y-3">
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            <input
                                type="text"
                                placeholder="Search reports..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-9 pr-8 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rra-blue/20 focus:border-rra-blue transition-all"
                            />
                            {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={13} /></button>}
                        </div>
                        <select
                            value={priorityFilter}
                            onChange={e => setPriorityFilter(e.target.value)}
                            className="px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-white focus:outline-none focus:border-rra-blue cursor-pointer"
                        >
                            <option value="all">All Priorities</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                    </div>

                    {/* Report cards */}
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 size={24} className="animate-spin text-rra-blue" />
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                            <AlertCircle size={32} className="mx-auto text-gray-200 dark:text-gray-600 mb-3" />
                            <p className="text-sm font-bold text-gray-400">No reports found</p>
                            {(search || statusFilter !== 'all' || priorityFilter !== 'all') && (
                                <button onClick={() => { setSearch(''); setStatusFilter('all'); setPriorityFilter('all'); }} className="mt-2 text-xs font-bold text-rra-blue hover:underline">
                                    Clear filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[65vh] overflow-y-auto no-scrollbar pr-1">
                            {reports.map(report => (
                                <button
                                    key={report._id}
                                    onClick={() => openReport(report)}
                                    className={`w-full text-left p-4 rounded-2xl border transition-all hover:shadow-sm ${
                                        selected?._id === report._id
                                            ? 'border-rra-blue bg-rra-blue/5 dark:bg-rra-blue/10'
                                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <Avatar user={report.reporter} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 mb-1">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{report.subject}</p>
                                                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0 ${STATUS_STYLES[report.status]}`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[report.priority]}`} />
                                                    {report.status.replace('_', ' ')}
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{report.reporter?.fullName} · <span className="capitalize">{report.reporter?.role}</span></p>
                                            <p className="text-xs text-gray-400 mt-1 truncate">{report.description}</p>
                                            <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400 font-medium">
                                                <span className="capitalize">{report.category.replace('_', ' ')}</span>
                                                <span>·</span>
                                                <Clock size={10} />
                                                <span>{formatDate(report.createdAt)}</span>
                                                {!report.adminResponse && (
                                                    <span className="ml-auto text-amber-500 font-black">Needs response</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── RIGHT: detail + response panel ─────────────────────────── */}
                <div className="flex-1 min-w-0">
                    {selected ? (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden h-full flex flex-col">
                            {/* Detail header */}
                            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-start gap-4">
                                <Avatar user={selected.reporter} />
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-base font-black text-gray-900 dark:text-white">{selected.subject}</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        {selected.reporter?.fullName} · {selected.reporter?.email} · <span className="capitalize">{selected.reporter?.role}</span>
                                    </p>
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${STATUS_STYLES[selected.status]}`}>
                                            {selected.status.replace('_', ' ')}
                                        </span>
                                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${PRIORITY_STYLES[selected.priority]}`}>
                                            {selected.priority} priority
                                        </span>
                                        <span className="text-[10px] text-gray-400 font-medium capitalize">{selected.category.replace('_', ' ')}</span>
                                        <span className="text-[10px] text-gray-400 font-medium">· {formatDate(selected.createdAt)}</span>
                                    </div>
                                </div>
                                <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 shrink-0 xl:hidden">
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Description */}
                            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex-1 overflow-y-auto">
                                <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">User Report</p>
                                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{selected.description}</p>

                                {selected.adminResponse && (
                                    <div className="mt-5 bg-rra-blue/5 dark:bg-rra-blue/10 border border-rra-blue/20 rounded-xl p-4">
                                        <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: 'var(--rra-blue)' }}>
                                            Previous Admin Response
                                            {selected.respondedAt && <span className="ml-2 text-gray-400 font-bold normal-case">· {formatDate(selected.respondedAt)}</span>}
                                        </p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{selected.adminResponse}</p>
                                    </div>
                                )}
                            </div>

                            {/* Response form */}
                            <div className="px-6 py-5 border-t border-gray-100 dark:border-gray-700 space-y-3 bg-gray-50/50 dark:bg-gray-900/30">
                                <p className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Admin Response</p>

                                <div className="flex gap-3">
                                    <div className="relative flex-1">
                                        <select
                                            value={responseStatus}
                                            onChange={e => setResponseStatus(e.target.value)}
                                            className="w-full appearance-none px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-rra-blue/20 cursor-pointer"
                                        >
                                            <option value="open">Open</option>
                                            <option value="in_progress">In Progress</option>
                                            <option value="resolved">Resolved</option>
                                            <option value="closed">Closed</option>
                                        </select>
                                        <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>

                                <textarea
                                    placeholder="Write your response to the user..."
                                    value={responseText}
                                    onChange={e => setResponseText(e.target.value)}
                                    rows={3}
                                    className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rra-blue/20 focus:border-rra-blue resize-none transition-all"
                                />

                                <button
                                    onClick={saveResponse}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-60 shadow-md"
                                    style={{ background: 'var(--rra-blue)' }}
                                >
                                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                                    {saving ? 'Saving...' : 'Save & Notify User'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-[400px] bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-center p-8">
                            <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4">
                                <AlertTriangle size={28} className="text-amber-500" />
                            </div>
                            <h3 className="text-base font-black text-gray-900 dark:text-white mb-2">Select a Report</h3>
                            <p className="text-sm text-gray-400 font-medium max-w-xs">
                                Click any report on the left to view details and send a response to the user.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default IssueReports;

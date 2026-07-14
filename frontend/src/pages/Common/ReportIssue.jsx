import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import {
    AlertTriangle, Send, Loader2, CheckCircle,
    Clock, ChevronDown, FileText, X
} from 'lucide-react';

const API = 'http://localhost:5000/api/reports';
const headers = () => ({ Authorization: `Bearer ${sessionStorage.getItem('token')}` });

const STATUS_STYLES = {
    open: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    closed: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

const PRIORITY_STYLES = {
    low: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
    medium: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    high: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

const CATEGORIES = [
    { value: 'technical', label: 'Technical Problem' },
    { value: 'billing', label: 'Billing / Payment' },
    { value: 'driver', label: 'Driver Complaint' },
    { value: 'passenger', label: 'Passenger Complaint' },
    { value: 'ride', label: 'Ride Issue' },
    { value: 'other', label: 'Other' },
];

const formatDate = (d) => new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
});

const ReportIssue = () => {
    const { user } = useAuth();
    const { showToast } = useDialog();

    const [view, setView] = useState('form'); // 'form' | 'history'
    const [myReports, setMyReports] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [expandedReport, setExpandedReport] = useState(null);

    const [form, setForm] = useState({
        subject: '',
        description: '',
        category: 'other',
        priority: 'medium',
    });

    const loadHistory = async () => {
        setLoadingHistory(true);
        try {
            const { data } = await axios.get(`${API}/my`, { headers: headers() });
            setMyReports(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingHistory(false);
        }
    };

    useEffect(() => {
        if (view === 'history') loadHistory();
    }, [view]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.subject.trim() || !form.description.trim()) return;
        setSubmitting(true);
        try {
            await axios.post(API, form, { headers: headers() });
            setSubmitted(true);
            setForm({ subject: '', description: '', category: 'other', priority: 'medium' });
            setTimeout(() => setSubmitted(false), 4000);
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to submit report', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto space-y-5 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Report an Issue</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">
                        Describe your problem and our admin team will respond shortly.
                    </p>
                </div>
                {/* Tab toggle */}
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl shrink-0">
                    <button
                        onClick={() => setView('form')}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                            view === 'form' ? 'bg-white dark:bg-gray-700 text-rra-blue shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                    >
                        New Report
                    </button>
                    <button
                        onClick={() => setView('history')}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                            view === 'history' ? 'bg-white dark:bg-gray-700 text-rra-blue shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                    >
                        My Reports
                    </button>
                </div>
            </div>

            {/* ── REPORT FORM ───────────────────────────────────────────────── */}
            {view === 'form' && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 md:p-8 space-y-5">

                    {/* Success banner */}
                    {submitted && (
                        <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                            <CheckCircle size={18} className="text-emerald-600 shrink-0" />
                            <div>
                                <p className="text-sm font-black text-emerald-800 dark:text-emerald-300">Report submitted successfully!</p>
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">Admin has been notified and will respond shortly.</p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Category + Priority */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Category</label>
                                <div className="relative">
                                    <select
                                        value={form.category}
                                        onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                                        className="w-full appearance-none px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rra-blue/20 focus:border-rra-blue cursor-pointer"
                                    >
                                        {CATEGORIES.map(c => (
                                            <option key={c.value} value={c.value}>{c.label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Priority</label>
                                <div className="relative">
                                    <select
                                        value={form.priority}
                                        onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                                        className="w-full appearance-none px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rra-blue/20 focus:border-rra-blue cursor-pointer"
                                    >
                                        <option value="low">Low Priority</option>
                                        <option value="medium">Medium Priority</option>
                                        <option value="high">High Priority</option>
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>

                        {/* Subject */}
                        <div>
                            <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Subject</label>
                            <input
                                type="text"
                                placeholder="Brief summary of the issue..."
                                value={form.subject}
                                onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                                maxLength={200}
                                required
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rra-blue/20 focus:border-rra-blue transition-all"
                            />
                            <p className="text-[10px] text-gray-400 mt-1 text-right">{form.subject.length}/200</p>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Description</label>
                            <textarea
                                placeholder="Describe the issue in detail. Include what happened, when it occurred, and any steps to reproduce..."
                                value={form.description}
                                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                rows={5}
                                required
                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rra-blue/20 focus:border-rra-blue transition-all resize-none"
                            />
                        </div>

                        {/* Submit */}
                        <div className="flex items-center justify-between pt-2">
                            <p className="text-xs text-gray-400 font-medium">
                                Submitted as <span className="font-bold text-gray-600 dark:text-gray-300">{user?.fullName}</span>
                            </p>
                            <button
                                type="submit"
                                disabled={submitting || !form.subject.trim() || !form.description.trim()}
                                className="flex items-center gap-2 px-8 py-3 rounded-xl text-white text-sm font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-60 shadow-md"
                                style={{ background: 'var(--rra-blue)' }}
                            >
                                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                                {submitting ? 'Submitting...' : 'Submit Report'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── MY REPORTS HISTORY ────────────────────────────────────────── */}
            {view === 'history' && (
                <div className="space-y-3">
                    {loadingHistory ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 size={24} className="animate-spin text-rra-blue" />
                        </div>
                    ) : myReports.length === 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                            <FileText size={36} className="mx-auto text-gray-200 dark:text-gray-600 mb-3" />
                            <p className="text-sm font-bold text-gray-500 dark:text-gray-400">No reports submitted yet</p>
                            <button
                                onClick={() => setView('form')}
                                className="mt-3 text-xs font-bold text-rra-blue hover:underline"
                            >
                                Submit your first report
                            </button>
                        </div>
                    ) : (
                        myReports.map(report => (
                            <div
                                key={report._id}
                                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                            >
                                {/* Report header */}
                                <button
                                    onClick={() => setExpandedReport(expandedReport === report._id ? null : report._id)}
                                    className="w-full flex items-start gap-4 p-5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                                >
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-50 dark:bg-amber-900/20">
                                        <AlertTriangle size={18} className="text-amber-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{report.subject}</p>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${PRIORITY_STYLES[report.priority]}`}>
                                                    {report.priority}
                                                </span>
                                                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${STATUS_STYLES[report.status]}`}>
                                                    {report.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-gray-400 font-medium">
                                            <span className="capitalize">{report.category.replace('_', ' ')}</span>
                                            <span>·</span>
                                            <span className="flex items-center gap-1">
                                                <Clock size={10} />
                                                {formatDate(report.createdAt)}
                                            </span>
                                        </div>
                                    </div>
                                    <ChevronDown
                                        size={16}
                                        className={`text-gray-400 shrink-0 transition-transform mt-1 ${expandedReport === report._id ? 'rotate-180' : ''}`}
                                    />
                                </button>

                                {/* Expanded detail */}
                                {expandedReport === report._id && (
                                    <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-700 space-y-4 pt-4">
                                        <div>
                                            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">Your Description</p>
                                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{report.description}</p>
                                        </div>

                                        {report.adminResponse ? (
                                            <div className="bg-rra-blue/5 dark:bg-rra-blue/10 border border-rra-blue/20 rounded-xl p-4">
                                                <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: 'var(--rra-blue)' }}>
                                                    Admin Response
                                                    {report.respondedAt && (
                                                        <span className="ml-2 text-gray-400 font-bold normal-case">· {formatDate(report.respondedAt)}</span>
                                                    )}
                                                </p>
                                                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{report.adminResponse}</p>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                                                <Clock size={13} />
                                                <span>Awaiting admin response...</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default ReportIssue;

import React, { useState, useEffect, useMemo } from 'react';
import { useDialog } from '../../../context/DialogContext';
import axios from 'axios';
import {
    Search,
    Filter,
    UserCheck,
    UserX,
    Trash2,
    Shield,
    User,
    ShieldOff,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Download,
    X
} from 'lucide-react';

const PAGE_SIZE = 10;

const API = 'http://localhost:5000/api/admin';

// ── Confirmation Modal ───────────────────────────────────────────────────────
const ConfirmModal = ({ title, message, onConfirm, onCancel, danger = false }) => (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
        <div className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 w-full max-w-sm animate-in fade-in zoom-in duration-200">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 ${danger ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                {danger ? <Trash2 className="text-red-500" size={26} /> : <Shield className="text-blue-500" size={26} />}
            </div>
            <h3 className="text-xl font-black dark:text-white uppercase tracking-tight mb-2">{title}</h3>
            <p className="text-gray-500 dark:text-gray-400 font-medium text-sm mb-8">{message}</p>
            <div className="flex gap-3">
                <button
                    onClick={onCancel}
                    className="flex-1 py-3 rounded-2xl border border-gray-100 dark:border-gray-700 font-black text-sm uppercase text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                >
                    Cancel
                </button>
                <button
                    onClick={onConfirm}
                    className={`flex-1 py-3 rounded-2xl font-black text-sm uppercase text-white shadow-lg transition-all active:scale-95 ${danger ? 'bg-red-500 hover:bg-red-600 shadow-red-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}
                >
                    Confirm
                </button>
            </div>
        </div>
    </div>
);

// ── Role Dropdown ────────────────────────────────────────────────────────────
const RoleDropdown = ({ userId, currentRole, onUpdate }) => {
    const [open, setOpen] = useState(false);
    const roles = ['passenger', 'driver'];

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs font-black uppercase text-gray-600 dark:text-gray-300 hover:border-blue-400 transition-all"
            >
                {currentRole} <ChevronDown size={12} />
            </button>
            {open && (
                <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl z-50 p-1">
                    {roles.filter(r => r !== currentRole).map(role => (
                        <button
                            key={role}
                            onClick={() => {
                                onUpdate(userId, role);
                                setOpen(false);
                            }}
                            className="w-full text-left px-4 py-2.5 text-xs font-black uppercase rounded-xl hover:bg-blue-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-all"
                        >
                            {role}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Main Component ───────────────────────────────────────────────────────────
const UserManagement = () => {
    const { showToast } = useDialog();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('all');
    const [modal, setModal] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);
    const [page, setPage] = useState(1);

    const token = sessionStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(`${API}/users`, { headers });
            setUsers(data);
        } catch {
            // fallback mock data
            setUsers([
                { _id: '1', fullName: 'John Driver', email: 'john@taxi.rw', role: 'driver', isActive: true, createdAt: '2026-02-05' },
                { _id: '2', fullName: 'Sarah Passenger', email: 'sarah@mail.com', role: 'passenger', isActive: true, createdAt: '2026-02-12' },
                { _id: '3', fullName: 'Mike Operator', email: 'mike@taxi.rw', role: 'driver', isActive: false, createdAt: '2026-02-14' },
            ]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    // ── Actions ──────────────────────────────────────────────────────────────
    const confirmAction = (type, user, payload = {}) => {
        const configs = {
            delete: {
                title: 'Delete User',
                message: `Are you sure you want to permanently delete "${user.fullName}"? This action cannot be undone.`,
                danger: true,
            },
            block: {
                title: 'Block User',
                message: `Block "${user.fullName}"? They will lose access to the platform immediately.`,
                danger: false,
            },
            unblock: {
                title: 'Allow Access',
                message: `Restore access for "${user.fullName}"? They will be able to log in again.`,
                danger: false,
            },
            role: {
                title: 'Change Role',
                message: `Change "${user.fullName}"'s role to "${payload.role}"?`,
                danger: false,
            },
        };
        const cfg = configs[type];
        setModal({ type, userId: user._id, ...cfg, payload });
    };

    const handleConfirm = async () => {
        if (!modal) return;
        const { type, userId, payload } = modal;
        setActionLoading(userId);
        setModal(null);
        try {
            if (type === 'delete') {
                await axios.delete(`${API}/users/${userId}`, { headers });
                setUsers(prev => prev.filter(u => u._id !== userId));
            } else if (type === 'block') {
                await axios.put(`${API}/users/${userId}/access`, { isActive: false }, { headers });
                setUsers(prev => prev.map(u => u._id === userId ? { ...u, isActive: false } : u));
            } else if (type === 'unblock') {
                await axios.put(`${API}/users/${userId}/access`, { isActive: true }, { headers });
                setUsers(prev => prev.map(u => u._id === userId ? { ...u, isActive: true } : u));
            } else if (type === 'role') {
                await axios.put(`${API}/users/${userId}/role`, { role: payload.role }, { headers });
                setUsers(prev => prev.map(u => u._id === userId ? { ...u, role: payload.role } : u));
            }
        } catch (e) {
            showToast('Action failed: ' + (e.response?.data?.message || e.message), 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const getRoleBadge = (role) => {
        switch (role) {
            case 'admin': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800';
            case 'driver': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
            default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800';
        }
    };

    const filtered = useMemo(() => users.filter(u => {
        const matchRole = filterRole === 'all' || u.role === filterRole;
        const matchSearch = u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase());
        return matchRole && matchSearch;
    }), [users, filterRole, searchTerm]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    // Reset page on filter/search change
    React.useEffect(() => { setPage(1); }, [searchTerm, filterRole]);

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20 px-2">
            {/* Confirm Modal */}
            {modal && (
                <ConfirmModal
                    title={modal.title}
                    message={modal.message}
                    danger={modal.danger}
                    onConfirm={handleConfirm}
                    onCancel={() => setModal(null)}
                />
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4">
                <div>
                    <h1 className="text-4xl font-black dark:text-white tracking-tighter italic uppercase">User Management</h1>
                    <p className="text-gray-500 dark:text-gray-400 font-bold mt-1 italic">Manage access, roles, and accounts</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10 pr-9 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-sm font-bold text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-rra-blue focus:border-rra-blue w-full md:w-64 transition-all"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <select
                        value={filterRole}
                        onChange={e => setFilterRole(e.target.value)}
                        className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-black uppercase text-gray-600 dark:text-gray-300 outline-none"
                    >
                        <option value="all">All Roles</option>
                        <option value="passenger">Passenger</option>
                        <option value="driver">Driver</option>
                    </select>
                    <button onClick={fetchUsers} className="p-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm text-gray-400 hover:text-blue-500 transition-colors">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Summary Cards - Moved to top and smaller */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-4">
                <div className="p-4 bg-emerald-600 rounded-2xl text-white shadow-lg shadow-emerald-500/10 flex items-center justify-between transition-all hover:scale-[1.02]">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-0.5">Drivers</p>
                        <h5 className="text-xl font-black italic">{users.filter(u => u.role === 'driver').length} Registered</h5>
                    </div>
                    <div className="p-2 bg-white/10 rounded-lg">
                        <Shield size={18} />
                    </div>
                </div>
                <div className="p-4 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-500/10 flex items-center justify-between transition-all hover:scale-[1.02]">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-0.5">Passengers</p>
                        <h5 className="text-xl font-black italic">{users.filter(u => u.role === 'passenger').length} Registered</h5>
                    </div>
                    <div className="p-2 bg-white/10 rounded-lg">
                        <User size={18} />
                    </div>
                </div>
                <div className="p-4 bg-rose-500 rounded-2xl text-white shadow-lg shadow-red-500/10 flex items-center justify-between transition-all hover:scale-[1.02]">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-0.5">Blocked</p>
                        <h5 className="text-xl font-black italic">{users.filter(u => u.isActive === false).length} Accounts</h5>
                    </div>
                    <div className="p-2 bg-white/10 rounded-lg">
                        <UserX size={18} />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b dark:border-gray-700">
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest italic">User</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Role</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Status</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Joined</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest italic text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="py-20 text-center text-gray-400 font-bold italic">Loading users...</td>
                                </tr>
                            ) : paginated.length > 0 ? (
                                paginated.map((user) => {
                                    const isBlocked = user.isActive === false;
                                    const isBusy = actionLoading === user._id;
                                    return (
                                        <tr key={user._id} className={`group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all ${isBusy ? 'opacity-50 pointer-events-none' : ''}`}>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-lg italic border ${isBlocked ? 'bg-red-50 border-red-100 text-red-400 dark:bg-red-900/20 dark:border-red-800' : 'bg-gray-100 border-gray-100 text-blue-500 dark:bg-gray-900 dark:border-gray-800'}`}>
                                                        {user.fullName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-black dark:text-white tracking-tight uppercase italic text-sm">{user.fullName}</h4>
                                                        <p className="text-[10px] font-bold text-gray-400 lowercase">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${getRoleBadge(user.role)}`}>
                                                        {user.role}
                                                    </span>
                                                    <RoleDropdown
                                                        userId={user._id}
                                                        currentRole={user.role}
                                                        onUpdate={(uid, role) => {
                                                            const u = users.find(x => x._id === uid);
                                                            if (u) confirmAction('role', u, { role });
                                                        }}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${isBlocked ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' : 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${isBlocked ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                                    {isBlocked ? 'Blocked' : 'Active'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5">
                                                <p className="text-sm font-bold dark:text-gray-300 italic">{new Date(user.createdAt).toLocaleDateString()}</p>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center justify-end gap-2">
                                                    {isBlocked ? (
                                                        <button
                                                            onClick={() => confirmAction('unblock', user)}
                                                            title="Allow Access"
                                                            className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-500 hover:bg-emerald-100 transition-all hover:scale-110"
                                                        >
                                                            <UserCheck size={17} />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => confirmAction('block', user)}
                                                            title="Block Access"
                                                            className="p-2.5 bg-gray-50 dark:bg-gray-700 rounded-xl text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all hover:scale-110"
                                                        >
                                                            <UserX size={17} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => confirmAction('delete', user)}
                                                        title="Delete User"
                                                        className="p-2.5 bg-gray-50 dark:bg-gray-700 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all hover:scale-110"
                                                    >
                                                        <Trash2 size={17} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="5" className="py-16 text-center">
                                        <User size={36} className="mx-auto text-gray-200 dark:text-gray-600 mb-3" />
                                        <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
                                            {searchTerm || filterRole !== 'all' ? 'No users match your search' : 'No users found'}
                                        </p>
                                        {(searchTerm || filterRole !== 'all') && (
                                            <button
                                                onClick={() => { setSearchTerm(''); setFilterRole('all'); }}
                                                className="mt-2 text-xs font-bold text-rra-blue hover:underline"
                                            >
                                                Clear filters
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {filtered.length > PAGE_SIZE && (
                    <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            Page {currentPage} of {totalPages} · {filtered.length} users
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft size={16} />
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
                                                : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50'
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
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserManagement;

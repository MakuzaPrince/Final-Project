import React, { useState } from 'react';
import { Moon, Sun, Bell, Shield, RotateCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useDialog } from '../../context/DialogContext';
import axios from 'axios';

const SectionCard = ({ children, className = '' }) => (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 md:p-8 ${className}`}>
        {children}
    </div>
);

const SectionTitle = ({ icon: Icon, label, iconClass = 'text-rra-blue' }) => (
    <div className="flex items-center gap-2.5 mb-6">
        <div className={`p-2 rounded-xl ${iconClass === 'text-amber-500' ? 'bg-amber-50 dark:bg-amber-900/20' : iconClass === 'text-blue-500' ? 'bg-blue-50 dark:bg-blue-900/20' : iconClass === 'text-emerald-500' ? 'bg-emerald-50 dark:bg-emerald-900/20' : iconClass === 'text-red-500' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-rra-blue/10'}`}>
            <Icon size={18} className={iconClass} />
        </div>
        <h2 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-wide">{label}</h2>
    </div>
);

const inputClass = 'w-full px-4 py-3.5 rounded-xl border border-gray-200 dark:bg-gray-900 dark:border-gray-700 dark:text-white dark:placeholder-gray-500 focus:outline-none focus:border-rra-blue focus:ring-2 focus:ring-rra-blue/20 transition-all text-sm text-gray-900 bg-white';

const Settings = () => {
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { showConfirm } = useDialog();
    const [notifications, setNotifications] = useState(true);
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState({ text: '', type: '' });

    const handlePasswordChange = async () => {
        setMsg({ text: '', type: '' });
        if (!passwordData.currentPassword || !passwordData.newPassword) {
            setMsg({ text: 'Please fill in all password fields.', type: 'error' });
            return;
        }
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setMsg({ text: 'New passwords do not match.', type: 'error' });
            return;
        }
        if (passwordData.newPassword.length < 6) {
            setMsg({ text: 'Password must be at least 6 characters.', type: 'error' });
            return;
        }

        try {
            setLoading(true);
            const token = sessionStorage.getItem('token');
            await axios.put('http://localhost:5000/api/users/change-password', {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setMsg({ text: 'Password updated successfully.', type: 'success' });
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            setMsg({ text: error.response?.data?.message || 'Failed to update password.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const ToggleSwitch = ({ checked, onChange, label }) => (
        <button
            onClick={onChange}
            className={`relative inline-flex h-8 items-center rounded-full transition-colors duration-300 focus:outline-none shadow-inner ${
                checked ? 'bg-rra-blue' : 'bg-gray-300 dark:bg-gray-600'
            }`}
            style={{ width: '56px' }}
            aria-label={label}
        >
            <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                checked ? 'translate-x-8' : 'translate-x-1'
            }`} />
        </button>
    );

    return (
        <div className="w-full space-y-5 animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Settings</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">Manage your account preferences</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {/* Left column: Appearance + Notifications (non-admin) / Admin Command Center (admin) */}
                <div className="space-y-5">
                    {/* Appearance */}
                    <SectionCard>
                        <SectionTitle icon={Sun} label="Appearance" iconClass="text-amber-500" />
                        <div className="flex items-center justify-between gap-6">
                            <div className="flex-1">
                                <p className="text-base font-bold text-gray-900 dark:text-white">Dark Mode</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Switch between light and dark interface</p>
                            </div>
                            <ToggleSwitch
                                checked={theme === 'dark'}
                                onChange={toggleTheme}
                                label="Toggle dark mode"
                            />
                        </div>
                        <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            {theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
                            <span>Currently using <span className="font-bold text-gray-700 dark:text-gray-300 capitalize">{theme}</span> mode</span>
                        </div>
                    </SectionCard>

                    {/* Notifications (non-admin only) */}
                    {user?.role !== 'admin' && (
                        <SectionCard>
                            <SectionTitle icon={Bell} label="Notifications" iconClass="text-blue-500" />
                            <div className="flex items-center justify-between gap-6">
                                <div className="flex-1">
                                    <p className="text-base font-bold text-gray-900 dark:text-white">Push Notifications</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Receive ride status and platform updates</p>
                                </div>
                                <ToggleSwitch
                                    checked={notifications}
                                    onChange={() => setNotifications(!notifications)}
                                    label="Toggle notifications"
                                />
                            </div>
                        </SectionCard>
                    )}

                    {/* Admin Command Center — placed here so left column is never empty for admin */}
                    {user?.role === 'admin' && (
                        <SectionCard className="border-2 border-red-200 dark:border-red-900/40">
                            <SectionTitle icon={RotateCw} label="Admin Command Center" iconClass="text-red-500" />
                            <div className="flex items-start justify-between gap-6">
                                <div className="flex-1">
                                    <p className="text-base font-bold text-gray-900 dark:text-white">Emergency System Reset</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        Clears all local storage and session data. Use only for troubleshooting platform state issues.
                                    </p>
                                </div>
                                <button
                                    onClick={async () => {
                                        if (await showConfirm("System Reset will clear all platform data locally and reload. Continue?")) {
                                            localStorage.clear();
                                            sessionStorage.clear();
                                            window.location.reload();
                                        }
                                    }}
                                    className="shrink-0 flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-red-500/20"
                                >
                                    <RotateCw size={15} /> Reset
                                </button>
                            </div>
                        </SectionCard>
                    )}
                </div>

                {/* Right column: Security / Password */}
                <div className="space-y-5">
                    <SectionCard>
                        <SectionTitle icon={Shield} label="Security" iconClass="text-emerald-500" />
                        <p className="text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-5">Change Password</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Current Password</label>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    className={inputClass}
                                    value={passwordData.currentPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">New Password</label>
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        className={inputClass}
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Confirm New</label>
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        className={inputClass}
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {msg.text && (
                            <div className={`flex items-center gap-2 p-3 rounded-xl mt-4 text-sm font-bold ${
                                msg.type === 'success'
                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                            }`}>
                                {msg.type === 'success'
                                    ? <CheckCircle size={15} className="shrink-0" />
                                    : <AlertCircle size={15} className="shrink-0" />
                                }
                                {msg.text}
                            </div>
                        )}

                        <div className="flex justify-end mt-5">
                            <button
                                onClick={handlePasswordChange}
                                disabled={loading}
                                className="flex items-center gap-2 px-8 py-3 rounded-xl font-black text-sm uppercase tracking-wider text-white transition-all active:scale-95 disabled:opacity-60 shadow-md"
                                style={{ background: 'var(--rra-blue)' }}
                            >
                                {loading ? <Loader2 size={15} className="animate-spin" /> : <Shield size={15} />}
                                {loading ? 'Updating...' : 'Update Password'}
                            </button>
                        </div>
                    </SectionCard>
                </div>
            </div>
        </div>
    );
};

export default Settings;

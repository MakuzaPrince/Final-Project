import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import {
    User,
    Mail,
    Phone,
    MapPin,
    Camera,
    Save,
    Shield,
    Car,
    Edit3,
    CheckCircle,
    AlertCircle
} from 'lucide-react';

const Profile = () => {
    const { user, updateUser } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [imageLoadError, setImageLoadError] = useState(false);
    const [msg, setMsg] = useState({ text: '', type: '' });

    const [formData, setFormData] = useState({
        fullName: user?.fullName || '',
        email: user?.email || '',
        phone: user?.phone || '',
        address: user?.address || '',
        profileImage: user?.profileImage || '',
        tin: user?.tin || '',
        vehicle: {
            model: user?.vehicle?.model || '',
            year: user?.vehicle?.year || '',
            licensePlate: user?.vehicle?.licensePlate || '',
            color: user?.vehicle?.color || ''
        }
    });

    React.useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                fullName: user.fullName || '',
                email: user.email || '',
                phone: user.phone || '',
                address: user.address || '',
                profileImage: user.profileImage || '',
                tin: user.tin || '',
                vehicle: {
                    model: user.vehicle?.model || '',
                    year: user.vehicle?.year || '',
                    licensePlate: user.vehicle?.licensePlate || '',
                    color: user.vehicle?.color || ''
                }
            }));
        }
    }, [user]);

    React.useEffect(() => {
        setImageLoadError(false);
    }, [formData.profileImage]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith('vehicle.')) {
            const field = name.split('.')[1];
            setFormData(prev => ({
                ...prev,
                vehicle: { ...prev.vehicle, [field]: value }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, profileImage: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        setMsg({ text: '', type: '' });
        try {
            const { data } = await axios.put('http://localhost:5000/api/users/profile', {
                fullName: formData.fullName,
                phone: formData.phone,
                address: formData.address,
                vehicle: formData.vehicle,
                profileImage: formData.profileImage,
                tin: formData.tin
            });
            updateUser(data);
            setIsEditing(false);
            setMsg({ text: 'Profile updated successfully!', type: 'success' });
        } catch (error) {
            console.error("Error updating profile:", error);
            setMsg({ text: error.response?.data?.message || 'Failed to update profile.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const inputCls = `w-full pl-12 pr-4 py-4 rounded-2xl border-2 dark:bg-gray-900 dark:text-white focus:border-blue-500 focus:ring-0 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed border-gray-100 dark:border-gray-700`;

    return (
        <div className="w-full space-y-6 animate-in fade-in duration-700 pb-10">
            {/* Profile Header Banner */}
            <div className="relative h-48 md:h-64 rounded-2xl overflow-hidden shadow-xl">
                <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #1E6BB5 0%, #0f3a6b 100%)' }}></div>
                <div className="absolute inset-0 opacity-10"
                    style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #fff 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>

                <div className="absolute inset-x-0 bottom-0 p-6 md:p-8 flex flex-col md:flex-row items-end justify-between gap-4 bg-gradient-to-t from-black/70 to-transparent">
                    <div className="flex flex-col md:flex-row items-center md:items-end gap-4 text-center md:text-left">
                        {/* Avatar */}
                        <div className="relative group shrink-0">
                            <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl border-4 border-white/20 overflow-hidden shadow-xl bg-rra-blue/80 flex items-center justify-center">
                                {(formData.profileImage && !imageLoadError) ? (
                                    <img
                                        src={formData.profileImage}
                                        alt="Profile"
                                        className="w-full h-full object-cover"
                                        onError={() => setImageLoadError(true)}
                                    />
                                ) : (
                                    <span className="text-4xl md:text-5xl font-black text-white italic select-none">
                                        {(formData.fullName || user?.fullName || 'U').charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            {isEditing && user?.role !== 'admin' && (
                                <label className="absolute -bottom-2 -right-2 p-2.5 text-white rounded-xl hover:opacity-90 transition-all shadow-xl cursor-pointer border-2 border-black/30" style={{ background: 'var(--rra-gold)' }}>
                                    <Camera size={16} />
                                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                </label>
                            )}
                        </div>
                        <div className="pb-1">
                            <div className="flex items-center gap-3 justify-center md:justify-start flex-wrap">
                                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter uppercase">{user?.fullName}</h1>
                                <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black text-white uppercase tracking-widest border border-white/10">{user?.role}</span>
                            </div>
                            <p className="text-white/60 font-medium mt-1 text-sm">{user?.email}</p>
                        </div>
                    </div>

                    {/* Edit / Save button */}
                    <div className="flex items-center gap-2 shrink-0">
                        {isEditing && (
                            <button
                                onClick={() => { setIsEditing(false); setMsg({ text: '', type: '' }); }}
                                className="px-4 py-2.5 rounded-xl bg-white/20 text-white text-xs font-bold hover:bg-white/30 transition-all"
                            >
                                Cancel
                            </button>
                        )}
                        <button
                            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                            disabled={loading}
                            className={`group p-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 ${
                                isEditing ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-white text-gray-900 hover:bg-gray-100'
                            }`}
                        >
                            {loading
                                ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                : isEditing ? <Save size={18} /> : <Edit3 size={18} />
                            }
                        </button>
                    </div>
                </div>
            </div>

            {/* Status message */}
            {msg.text && (
                <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-bold border ${
                    msg.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                }`}>
                    {msg.type === 'success' ? <CheckCircle size={14} className="shrink-0" /> : <AlertCircle size={14} className="shrink-0" />}
                    {msg.text}
                </div>
            )}

            {/* Information Sections */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Personal Info */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-rra-blue/10 rounded-2xl">
                            <User size={22} className="text-rra-blue" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black dark:text-white uppercase tracking-wider">Personal Information</h3>
                            <p className="text-xs text-gray-400 font-bold mt-0.5">Manage your contact details</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                <input type="text" name="fullName" value={formData.fullName} onChange={handleChange}
                                    disabled={!isEditing} className={inputCls} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                <input type="email" value={formData.email} disabled
                                    className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-transparent bg-gray-50 dark:bg-gray-700 dark:text-gray-400 font-bold cursor-not-allowed italic" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Phone</label>
                            <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
                                    disabled={!isEditing} className={inputCls} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Address</label>
                            <div className="relative">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                <input type="text" name="address" value={formData.address} onChange={handleChange}
                                    disabled={!isEditing} className={inputCls} />
                            </div>
                        </div>
                        {user?.role === 'driver' && (
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Tax ID (TIN) — RRA</label>
                                <div className="relative">
                                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                                    <input type="text" name="tin" value={formData.tin} onChange={handleChange}
                                        disabled={!isEditing} placeholder="Enter your RRA TIN"
                                        className={`${inputCls} tracking-widest uppercase`} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Vehicle (Driver) or Stats (Others) */}
                {user?.role === 'driver' ? (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl">
                                <Car size={22} className="text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black dark:text-white uppercase tracking-wider">Vehicle Details</h3>
                                <p className="text-xs text-gray-400 font-bold mt-0.5">Registered transportation info</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Vehicle Model</label>
                                <input type="text" name="vehicle.model" value={formData.vehicle.model} onChange={handleChange}
                                    disabled={!isEditing}
                                    className="w-full px-6 py-4 rounded-2xl border-2 border-gray-100 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:border-emerald-500 font-bold disabled:opacity-50 disabled:cursor-not-allowed" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">License Plate</label>
                                <input type="text" name="vehicle.licensePlate" value={formData.vehicle.licensePlate} onChange={handleChange}
                                    disabled={!isEditing}
                                    className="w-full px-6 py-4 rounded-2xl border-2 border-gray-100 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:border-emerald-500 font-bold tracking-widest disabled:opacity-50 disabled:cursor-not-allowed" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Year</label>
                                <input type="text" name="vehicle.year" value={formData.vehicle.year} onChange={handleChange}
                                    disabled={!isEditing}
                                    className="w-full px-6 py-4 rounded-2xl border-2 border-gray-100 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:border-emerald-500 font-bold disabled:opacity-50 disabled:cursor-not-allowed" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Color</label>
                                <input type="text" name="vehicle.color" value={formData.vehicle.color} onChange={handleChange}
                                    disabled={!isEditing}
                                    className="w-full px-6 py-4 rounded-2xl border-2 border-gray-100 dark:bg-gray-900 dark:border-gray-700 dark:text-white focus:border-emerald-500 font-bold disabled:opacity-50 disabled:cursor-not-allowed" />
                            </div>
                        </div>
                    </div>
                ) : (
                    /* For non-drivers: Account info card */
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-rra-blue/10 rounded-2xl">
                                <Shield size={22} className="text-rra-blue" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black dark:text-white uppercase tracking-wider">Account Security</h3>
                                <p className="text-xs text-gray-400 font-bold mt-0.5">Your account status and access</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl">
                                <div>
                                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-0.5">Account Role</p>
                                    <p className="text-sm font-black dark:text-white uppercase">{user?.role}</p>
                                </div>
                                <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                    Active
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl">
                                <div>
                                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-0.5">Email Verified</p>
                                    <p className="text-sm font-bold dark:text-gray-300">{user?.email}</p>
                                </div>
                                <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rra-blue/10 text-rra-blue dark:text-blue-300">
                                    Verified
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl">
                                <div>
                                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-0.5">Platform</p>
                                    <p className="text-sm font-black dark:text-white">RRA RideShare</p>
                                </div>
                                <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rra-gold/10" style={{ color: 'var(--rra-gold)' }}>
                                    RRA
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Profile;

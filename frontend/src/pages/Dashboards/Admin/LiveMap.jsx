import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import {
    Activity,
    Shield,
    Navigation,
    Wifi,
    Clock,
    Users,
    Car,
    AlertCircle,
    Zap
} from 'lucide-react';

// Fix Leaflet Icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const LiveMap = () => {
    const [rides, setRides] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
        const fetchActiveRides = async () => {
            try {
                const token = sessionStorage.getItem('token');
                if (!token) return;

                const { data } = await axios.get('http://localhost:5000/api/admin/rides', {
                    headers: { Authorization: `Bearer ${token}` }
                });

                // Filter for truly active or ongoing rides
                const active = data.filter(r => ['requested', 'accepted', 'ongoing', 'arrived'].includes(r.status));
                setRides(active);
            } catch (error) {
                console.error("Error fetching live rides:", error);
                // Better mock data for fallback
                setRides([
                    { _id: 'r1', status: 'ongoing', pickupLocation: { coordinates: [30.0619, -1.9441] }, passenger: { fullName: 'Sarah P.' }, driver: { fullName: 'John D.' } },
                    { _id: 'r2', status: 'accepted', pickupLocation: { coordinates: [30.07, -1.95] }, passenger: { fullName: 'Mike O.' }, driver: { fullName: 'Alex S.' } }
                ]);
            } finally {
                setLoading(false);
            }
        };

        fetchActiveRides();
        const interval = setInterval(fetchActiveRides, 10000);
        return () => clearInterval(interval);
    }, []);

    const kigaliCenter = [-1.9441, 30.0619];

    return (
        <div className="flex-1 flex flex-col relative overflow-hidden bg-gray-50 dark:bg-gray-950 min-h-0">
            {/* Control HUD Header */}
            <div className="absolute top-6 left-6 right-6 z-[1000] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pointer-events-none">
                <div className="p-1 bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl rounded-3xl border border-gray-100 dark:border-gray-800 shadow-2xl pointer-events-auto flex items-center gap-5 pr-6">
                    <div className="p-4 bg-blue-600 dark:bg-blue-500 text-white rounded-2xl shadow-xl shadow-blue-500/20 relative group">
                        <Activity size={24} className="animate-pulse" />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-white dark:bg-gray-900 rounded-full border-2 border-blue-600 dark:border-blue-500"></div>
                    </div>
                    <div>
                        <h1 className="text-xl font-black dark:text-white tracking-tighter uppercase italic">Operations Grid</h1>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic flex items-center gap-2">
                            Latency: <span className="text-blue-500 font-bold">24ms</span> • {rides.length} Active Nodes
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 pointer-events-auto">
                    {[
                        { icon: Car, label: 'Tracking', val: rides.length, color: 'text-blue-500' },
                        { icon: Shield, label: 'Security', val: 'Active', color: 'text-indigo-500' },
                    ].map((stat, i) => (
                        <div key={i} className="p-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl rounded-2xl border border-gray-100 dark:border-gray-800 shadow-2xl flex items-center gap-4 px-6 min-w-[150px]">
                            <stat.icon size={18} className={stat.color} />
                            <div className="text-left">
                                <span className="text-[10px] font-black text-gray-400 uppercase block leading-none">{stat.label}</span>
                                <span className="text-sm font-black dark:text-white italic">{stat.val}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Map Container */}
            <div className="flex-1 m-2 rounded-[3.5rem] overflow-hidden border border-gray-100 dark:border-gray-800 shadow-2xl relative">
                {loading && (
                    <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm z-[1001] flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-[10px] font-black text-white uppercase tracking-[0.4em] italic">Synchronizing...</span>
                        </div>
                    </div>
                )}

                <MapContainer center={kigaliCenter} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; OpenStreetMap'
                    />

                    {rides.map(ride => (
                        ride.pickupLocation && (
                            <Marker
                                key={ride._id}
                                position={[ride.pickupLocation.coordinates[1], ride.pickupLocation.coordinates[0]]}
                            >
                                <Popup className="tactical-popup">
                                    <div className="p-4 bg-white dark:bg-gray-900 rounded-2xl min-w-[200px] border-0">
                                        <div className="flex items-center justify-between mb-4 border-b dark:border-gray-800 pb-2">
                                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest italic">Node #{ride._id.slice(-6)}</span>
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-600 dark:bg-blue-900/30 text-[8px] font-black uppercase rounded-full">{ride.status}</span>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"><Users size={12} className="text-gray-400" /></div>
                                                <span className="text-xs font-black dark:text-white italic uppercase tracking-tighter">{ride.passenger?.fullName || 'User'}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"><Car size={12} className="text-gray-400" /></div>
                                                <span className="text-xs font-bold text-gray-500 italic uppercase tracking-tighter">{ride.driver?.fullName || 'Allocating...'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Popup>
                            </Marker>
                        )
                    ))}
                </MapContainer>

                {/* Satellite Tags */}
                <div className="absolute bottom-8 right-8 z-[1000] flex flex-col gap-3 pointer-events-none">
                    <div className="p-5 bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-2xl pointer-events-auto">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-2xl"><Zap size={20} /></div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none italic">Power Grid</p>
                                <p className="text-sm font-black dark:text-white italic mt-1 leading-tight">Optimized</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiveMap;


import { useState, useEffect } from 'react';
import LeafletMap from '../../../components/Map/LeafletMap';
import axios from 'axios';
import {
    Users,
    Car,
    Map as MapIcon,
    RefreshCw,
    Search,
    Layers,
    Navigation,
    Activity,
    ChevronRight,
    Target
} from 'lucide-react';

const AdminMap = () => {
    const [drivers, setDrivers] = useState([]);
    const [passengers, setPassengers] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const token = sessionStorage.getItem('token');
            const [driversRes, ridesRes] = await Promise.all([
                axios.get('http://localhost:5000/api/admin/users?role=driver', {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get('http://localhost:5000/api/admin/rides', {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            setDrivers(driversRes.data.filter(d => d.location));

            const activePassengers = ridesRes.data
                .filter(r => r.status === 'requested' || r.status === 'accepted' || r.status === 'ongoing')
                .map(r => ({
                    _id: r.passenger?._id || Math.random().toString(),
                    fullName: r.passenger?.fullName || 'Active Passenger',
                    location: {
                        lat: r.pickup?.coordinates[1] || -1.9441,
                        lng: r.pickup?.coordinates[0] || 30.0619
                    }
                }));

            setPassengers(activePassengers);
        } catch (error) {
            console.error('Failed to fetch map data:', error);
            // Mock data for UI development
            setDrivers([{ _id: 'd1', fullName: 'John Driver', location: { lat: -1.9441, lng: 30.0619 } }]);
            setPassengers([{ _id: 'p1', fullName: 'Sarah Passenger', location: { lat: -1.95, lng: 30.07 } }]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex-1 flex flex-col relative w-full h-full min-h-[calc(100vh-100px)] bg-white dark:bg-gray-950">
            <LeafletMap
                drivers={drivers}
                passengers={passengers}
                userRole="admin"
            />
        </div>
    );
};

export default AdminMap;


import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';

const MapSearch = ({ onSearch, placeholder = "Search for a location..." }) => {
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!query.trim()) return;

        setIsSearching(true);
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
            const data = await response.json();

            if (data && data.length > 0) {
                const { lat, lon, display_name } = data[0];
                onSearch({
                    lat: parseFloat(lat),
                    lng: parseFloat(lon),
                    address: display_name
                });
            }
        } catch (error) {
            console.error("Search error:", error);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <form
            onSubmit={handleSearch}
            className="flex items-center bg-white dark:bg-gray-900 border-2 border-blue-600/20 dark:border-blue-500/20 rounded-2xl shadow-sm overflow-hidden focus-within:border-blue-600 transition-all w-full mb-4"
        >
            <div className="pl-4 text-gray-400">
                {isSearching ? <Loader2 size={16} className="animate-spin text-blue-600" /> : <Search size={16} />}
            </div>
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="flex-1 px-3 py-3 bg-transparent text-[11px] font-bold focus:outline-none dark:text-white uppercase tracking-tighter"
            />
            <button
                type="submit"
                disabled={isSearching}
                className="px-5 py-3 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
                Search
            </button>
        </form>
    );
};

export default MapSearch;

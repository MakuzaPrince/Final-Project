import { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const { user } = useAuth();

    useEffect(() => {
        if (user) {
            const newSocket = io('http://localhost:5000', {
                transports: ['websocket'],      // Skip polling, go straight to WebSocket
                upgrade: false,                 // Don't upgrade (already on WS)
                reconnectionDelay: 1000,
                reconnectionAttempts: 10,
            });
            setSocket(newSocket);

            // Re-emit 'join' on every (re)connect so the socket rejoins its userId room
            // after a server restart or network blip — room membership is wiped on
            // server restart, and io.to(userId).emit (rideAccepted, simPickupReached, etc.)
            // won't reach the client until it has re-joined its room.
            const handleConnect = () => {
                let loc = user.location || null;
                try {
                    const cached = sessionStorage.getItem('gps_last_location');
                    if (cached) loc = JSON.parse(cached);
                } catch (e) {}
                newSocket.emit('join', {
                    userId:   user._id,
                    role:     user.role,
                    fullName: user.fullName,
                    location: loc,
                });
            };

            newSocket.on('connect', handleConnect);

            return () => {
                newSocket.off('connect', handleConnect);
                newSocket.close();
            };
        } else {
            if (socket) {
                socket.close();
                setSocket(null);
            }
        }
    }, [user]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};

import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = sessionStorage.getItem('token');
        const userInfo = sessionStorage.getItem('userInfo');

        if (token && userInfo) {
            setUser(JSON.parse(userInfo));
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
        setLoading(false);

        // Intercept every API response globally.
        // When the server returns 401 with tokenExpired=true, clear the session
        // and redirect to login so the user isn't stuck seeing confusing errors.
        const interceptor = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401) {
                    const data = error.response.data;
                    if (data?.tokenExpired || data?.message?.toLowerCase().includes('expired')) {
                        // Clear stale session
                        sessionStorage.clear();
                        delete axios.defaults.headers.common['Authorization'];
                        setUser(null);
                        // Redirect to login — use window.location so React Router
                        // state is also fully reset
                        window.location.href = '/login';
                    }
                }
                return Promise.reject(error);
            }
        );

        return () => {
            axios.interceptors.response.eject(interceptor);
        };
    }, []);

    const login = async (email, password) => {
        try {
            const { data } = await axios.post('http://localhost:5000/api/auth/login', { email, password });
            sessionStorage.setItem('token', data.token);
            sessionStorage.setItem('userInfo', JSON.stringify(data));
            // Set global auth header
            axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
            setUser(data);
            return data;
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    const register = async (userData) => {
        try {
            const { data } = await axios.post('http://localhost:5000/api/auth/register', userData);
            return data;
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    // Google Login Handler (To be called after Firebase success)
    const googleLogin = async (firebaseUser, role = 'passenger') => {
        try {
            const { data } = await axios.post('http://localhost:5000/api/auth/google-login', {
                email: firebaseUser.email,
                googleId: firebaseUser.uid,
                fullName: firebaseUser.displayName,
                profileImage: firebaseUser.photoURL,
                role
            });
            sessionStorage.setItem('token', data.token);
            sessionStorage.setItem('userInfo', JSON.stringify(data));
            // Set global auth header
            axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
            setUser(data);
            return data;
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    const logout = () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('userInfo');
        // Clear global auth header
        delete axios.defaults.headers.common['Authorization'];
        // Also clear driver status if present
        sessionStorage.removeItem('isDriverAvailable');
        setUser(null);
    };

    const updateLocation = (location) => {
        // Optimistic update or call backend
    };

    const updateUser = (userData) => {
        sessionStorage.setItem('userInfo', JSON.stringify(userData));
        if (userData.token) {
            sessionStorage.setItem('token', userData.token);
        }
        setUser(userData);
    };

    return (
        <AuthContext.Provider value={{ user, login, register, logout, googleLogin, updateUser, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

type User = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'employee' | 'user';
  parkingLocationId?: number;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          // Set the default Authorization header for all axios requests
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Fetch the current user's data
          const response = await axios.get('/api/auth/me');
          setUser(response.data);
        } catch (error) {
          // If token is invalid, clear it
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      const response = await axios.post('/api/auth/login', { email, password });
      
      // Store the token in localStorage
      localStorage.setItem('token', response.data.token);
      
      // Set the default Authorization header for all axios requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      
      // Set the user data
      setUser(response.data.user);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to login');
      throw error;
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      setError(null);
      const response = await axios.post('/api/auth/register', { name, email, password });
      
      // Store the token in localStorage
      localStorage.setItem('token', response.data.token);
      
      // Set the default Authorization header for all axios requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      
      // Set the user data
      setUser(response.data.user);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to register');
      throw error;
    }
  };

  const logout = () => {
    // Remove the token from localStorage
    localStorage.removeItem('token');
    
    // Remove the Authorization header
    delete axios.defaults.headers.common['Authorization'];
    
    // Clear the user data
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
};
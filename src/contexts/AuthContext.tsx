import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  isAdminLoggedIn: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  // Check if admin is logged in on mount
  useEffect(() => {
    const adminLoggedIn = localStorage.getItem('admin-logged-in');
    if (adminLoggedIn === 'true') {
      setIsAdminLoggedIn(true);
    }
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    // Admin credentials as specified by user: ADMkz / ADMkz777
    if (username === 'ADMkz' && password === 'ADMkz777') {
      setIsAdminLoggedIn(true);
      localStorage.setItem('admin-logged-in', 'true');
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAdminLoggedIn(false);
    localStorage.removeItem('admin-logged-in');
  };

  return (
    <AuthContext.Provider value={{
      isAdminLoggedIn,
      login,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
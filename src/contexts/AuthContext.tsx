import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
    try {
      const { data, error } = await supabase.functions.invoke('admin-auth', {
        body: { username, password }
      });

      if (error) {
        console.error('Admin auth error:', error);
        return false;
      }

      if (data?.success) {
        setIsAdminLoggedIn(true);
        localStorage.setItem('admin-logged-in', 'true');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Admin authentication failed:', error);
      return false;
    }
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
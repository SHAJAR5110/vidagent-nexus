import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'hiring_ai_auth';
const USERS_KEY = 'hiring_ai_users';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const storedAuth = localStorage.getItem(STORAGE_KEY);
    if (storedAuth) {
      try {
        const parsed = JSON.parse(storedAuth);
        setUser(parsed);
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const getUsers = (): Record<string, { password: string; user: User }> => {
    const stored = localStorage.getItem(USERS_KEY);
    return stored ? JSON.parse(stored) : {};
  };

  const saveUsers = (users: Record<string, { password: string; user: User }>) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const users = getUsers();
    const userRecord = users[email.toLowerCase()];
    
    if (!userRecord) {
      setIsLoading(false);
      return { success: false, error: 'No account found with this email' };
    }
    
    if (userRecord.password !== password) {
      setIsLoading(false);
      return { success: false, error: 'Invalid password' };
    }
    
    setUser(userRecord.user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userRecord.user));
    setIsLoading(false);
    return { success: true };
  };

  const signup = async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const users = getUsers();
    
    if (users[email.toLowerCase()]) {
      setIsLoading(false);
      return { success: false, error: 'An account with this email already exists' };
    }
    
    const newUser: User = {
      id: crypto.randomUUID(),
      email: email.toLowerCase(),
      name,
      createdAt: new Date().toISOString(),
    };
    
    users[email.toLowerCase()] = { password, user: newUser };
    saveUsers(users);
    
    setUser(newUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    setIsLoading(false);
    return { success: true };
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    // Simulate OAuth flow
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create a mock Google user
    const googleUser: User = {
      id: crypto.randomUUID(),
      email: 'demo@gmail.com',
      name: 'Demo User',
      createdAt: new Date().toISOString(),
    };
    
    setUser(googleUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(googleUser));
    setIsLoading(false);
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const forgotPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const users = getUsers();
    if (!users[email.toLowerCase()]) {
      return { success: false, error: 'No account found with this email' };
    }
    
    // In a real app, this would send an email
    return { success: true };
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, loginWithGoogle, logout, forgotPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

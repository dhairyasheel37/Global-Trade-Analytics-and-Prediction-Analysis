import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("trade_auth_token") || null);
  const [loading, setLoading] = useState(true);

  // Fetch current user details whenever token changes
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const response = await api.get("/auth/me");
        setUser(response.data);
      } catch (err) {
        console.error("Auth validation failed:", err.response?.data || err.message);
        localStorage.removeItem("trade_auth_token");
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
  }, [token]);

  const login = async (username, password) => {
    try {
      const response = await api.post("/auth/login", { username, password });
      const { access_token, user: userData } = response.data;
      localStorage.setItem("trade_auth_token", access_token);
      setToken(access_token);
      setUser(userData);
      return { success: true, user: userData };
    } catch (err) {
      const errorMsg =
        err.response?.data?.detail || "Network error. Please check your connection to the server.";
      return { success: false, error: errorMsg };
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.warn("Server logout notification skipped:", err.message);
    } finally {
      localStorage.removeItem("trade_auth_token");
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isAdmin: user?.role === "ADMIN",
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

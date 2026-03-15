"use client";

import { useEffect, useState, useRef, createContext, useContext, useCallback } from "react";
import { supabase } from "./supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      tokenRef.current = session?.access_token ?? null;
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    // Listen for auth changes (handles token refresh automatically)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      tokenRef.current = session?.access_token ?? null;
      if (session?.user) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (data) setProfile(data);
    setLoading(false);
  }

  /**
   * Returns the current access token without a network round-trip.
   * Falls back to supabase.auth.getSession() only if the cached token is stale.
   */
  const getToken = useCallback(async () => {
    if (tokenRef.current) return tokenRef.current;
    const { data: { session } } = await supabase.auth.getSession();
    tokenRef.current = session?.access_token ?? null;
    return tokenRef.current;
  }, []);

  async function signInWithEmail(email, password) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    tokenRef.current = null;
  }

  const value = {
    user,
    profile,
    loading,
    getToken,
    signInWithEmail,
    signOut,
    isOwner: profile?.role === "owner",
    isSecretary: profile?.role === "secretary",
    isHousekeeper: profile?.role === "housekeeper",
    isDriver: profile?.role === "driver",
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Role-based route map
export const ROLE_ROUTES = {
  owner: "/owner",
  secretary: "/secretary",
  housekeeper: "/housekeeper",
  driver: "/driver",
};

export function getHomeRoute(role) {
  return ROLE_ROUTES[role] || "/login";
}

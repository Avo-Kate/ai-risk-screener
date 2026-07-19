// Session state for the whole app, backed by Supabase Auth.
//
// AuthProvider tracks the session (initial load + sign in/out/recovery events)
// exactly like App.jsx used to; useAuth() exposes it to layouts and pages.
// authReady gates the first paint until we know whether a session exists.
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";

const AuthContext = createContext({ session: null, authReady: false });

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, authReady }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

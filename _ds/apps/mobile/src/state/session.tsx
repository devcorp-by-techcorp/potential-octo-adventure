/**
 * Session — auth state + role routing (public / client / admin).
 * Mirrors the web app's auth-state persona resolution.
 */
import React, { createContext, useContext, useMemo, useState } from "react";

export type Role = "client" | "admin";

interface SessionValue {
  authed: boolean;
  role: Role;
  signIn: (role: Role) => void;
  signOut: () => void;
}

const SessionContext = createContext<SessionValue>({
  authed: false,
  role: "client",
  signIn: () => {},
  signOut: () => {},
});

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState<Role>("client");
  const value = useMemo<SessionValue>(
    () => ({
      authed,
      role,
      signIn: (r) => { setRole(r); setAuthed(true); },
      signOut: () => setAuthed(false),
    }),
    [authed, role]
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = () => useContext(SessionContext);

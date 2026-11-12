/**
 * Portal state — the client's correspondence, filed documents and gallery
 * selections, shared across the (client) screens. Signing an inbox item is a
 * one-way move into Documents (the same rule the web portal applies), so the
 * two screens must read one source of truth rather than local copies.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { INBOX_INITIAL, CLIENT_DOCS_INITIAL, type InboxItem, type ClientDoc } from "~/data/seed";

interface PortalValue {
  inbox: InboxItem[];
  docs: ClientDoc[];
  unread: number;
  selections: Record<string, boolean>;
  markRead: (id: string) => void;
  signItem: (id: string) => void;
  toggleSelection: (id: string) => void;
}

const PortalContext = createContext<PortalValue | null>(null);

export const PortalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [inbox, setInbox] = useState<InboxItem[]>(INBOX_INITIAL);
  const [docs, setDocs] = useState<ClientDoc[]>(CLIENT_DOCS_INITIAL);
  const [selections, setSelections] = useState<Record<string, boolean>>({ p02: true, p05: true, p15: true });

  const markRead = useCallback((id: string) => {
    setInbox((items) => items.map((i) => (i.id === id ? { ...i, read: true } : i)));
  }, []);

  const signItem = useCallback((id: string) => {
    setInbox((items) => {
      const item = items.find((i) => i.id === id);
      if (item) {
        setDocs((d) => [
          { id: "d" + Date.now(), title: item.title, type: "Release", signedAt: "2026-05-14", size: "294 KB", pages: item.pages },
          ...d,
        ]);
      }
      return items.filter((i) => i.id !== id);
    });
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelections((s) => { const n = { ...s }; if (n[id]) delete n[id]; else n[id] = true; return n; });
  }, []);

  const value = useMemo<PortalValue>(
    () => ({ inbox, docs, unread: inbox.filter((i) => !i.read).length, selections, markRead, signItem, toggleSelection }),
    [inbox, docs, selections, markRead, signItem, toggleSelection]
  );
  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
};

export const usePortal = (): PortalValue => {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used inside PortalProvider");
  return ctx;
};

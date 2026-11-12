/**
 * Studio state — identity, employment roster and the supplier register.
 *
 * Mounted at the root so the nav rail, Luma and every admin surface read the
 * same records. Editing an identity also rewrites the matching roster entry
 * (and the reverse), so the two can never drift apart.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  IDENTITY_SEED, ROSTER_SEED, SUPPLIERS_SEED,
  type Identity, type IdentityKey, type StaffMember, type Supplier,
} from "~/data/studio";

interface StudioValue {
  identity: Record<IdentityKey, Identity>;
  setIdentityField: (key: IdentityKey, field: "name" | "title" | "email" | "phone", value: string) => void;
  identityComplete: boolean;
  roster: StaffMember[];
  upsertStaff: (rec: StaffMember) => void;
  toggleStaffActive: (id: string) => void;
  suppliers: Supplier[];
  upsertSupplier: (rec: Supplier) => void;
  toggleSupplierActive: (id: string) => void;
}

const noop = () => {};
const StudioCtx = createContext<StudioValue>({
  identity: IDENTITY_SEED, setIdentityField: noop, identityComplete: true,
  roster: ROSTER_SEED, upsertStaff: noop, toggleStaffActive: noop,
  suppliers: SUPPLIERS_SEED, upsertSupplier: noop, toggleSupplierActive: noop,
});

export const StudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [identity, setIdentity] = useState<Record<IdentityKey, Identity>>(IDENTITY_SEED);
  const [roster, setRoster] = useState<StaffMember[]>(ROSTER_SEED);
  const [suppliers, setSuppliers] = useState<Supplier[]>(SUPPLIERS_SEED);

  const setIdentityField = useCallback((key: IdentityKey, field: "name" | "title" | "email" | "phone", value: string) => {
    setIdentity((s) => ({ ...s, [key]: { ...s[key], [field]: value } }));
    const rosterField = field === "title" ? "position" : field;
    setRoster((list) => list.map((p) => (p.identityKey === key ? { ...p, [rosterField]: value } : p)));
  }, []);

  const upsertStaff = useCallback((rec: StaffMember) => {
    setRoster((list) => {
      const exists = list.some((p) => p.id === rec.id);
      return exists ? list.map((p) => (p.id === rec.id ? rec : p)) : [...list, rec];
    });
    if (rec.identityKey) {
      setIdentity((s) => ({
        ...s,
        [rec.identityKey as IdentityKey]: {
          ...s[rec.identityKey as IdentityKey],
          name: rec.name, title: rec.position, email: rec.email, phone: rec.phone,
        },
      }));
    }
  }, []);

  const toggleStaffActive = useCallback((id: string) => {
    setRoster((list) => list.map((p) => (p.id === id
      ? { ...p, active: !p.active, end: p.active ? "2026-05-14" : null, contract: { ...p.contract, status: p.active ? "Ended" : "Signed" } }
      : p)));
  }, []);

  const upsertSupplier = useCallback((rec: Supplier) => {
    setSuppliers((list) => (list.some((v) => v.id === rec.id) ? list.map((v) => (v.id === rec.id ? rec : v)) : [...list, rec]));
  }, []);

  const toggleSupplierActive = useCallback((id: string) => {
    setSuppliers((list) => list.map((v) => (v.id === id ? { ...v, active: !v.active } : v)));
  }, []);

  const value = useMemo<StudioValue>(() => ({
    identity, setIdentityField,
    identityComplete: !!identity.manager.name.trim() && !!identity.photographer.name.trim(),
    roster, upsertStaff, toggleStaffActive,
    suppliers, upsertSupplier, toggleSupplierActive,
  }), [identity, setIdentityField, roster, upsertStaff, toggleStaffActive, suppliers, upsertSupplier, toggleSupplierActive]);

  return <StudioCtx.Provider value={value}>{children}</StudioCtx.Provider>;
};

export const useStudio = () => useContext(StudioCtx);

/** The greeting Luma opens with for signed-in studio staff. */
export function adminGreeting(identity: Record<IdentityKey, Identity>, newInquiries: number): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const first = (identity.manager.name || "").trim().split(" ")[0] || "there";
  const rank = (identity.manager.title || "").trim() || "the studio manager";
  const inq = newInquiries === 0 ? "No new inquiries waiting" : `${newInquiries} new ${newInquiries === 1 ? "inquiry" : "inquiries"} waiting`;
  return `${part}, ${first} — you're signed in as ${rank} at Illuminate Studios. ${inq}. What would you like to work on?`;
}

/**
 * Expense register — record, edit and delete studio expenses.
 *
 * Editing or deleting a SAVED record is password-gated at both ends: once to
 * unlock the workflow, once to finalise it. Every step, including abandoned
 * edits and failed password attempts, lands in the audit trail.
 */
import React from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Card, Badge, Button, Eyebrow, Display } from "~/components/ui";
import { Icon, IconName } from "~/components/Icon";
import { Chip, Note, Mono } from "./parts";
import { ReauthModal } from "./ReauthModal";
import { useFinance, type FieldChange } from "~/state/finance";
import {
  FIN_EXPENSE_CATEGORIES, FIN_TODAY, finAUD, finCategory, finExpense, finFmt, finGstOfGross,
  finInPeriod, finR2, type Expense, type FinSettings, type Period,
} from "~/data/finance";

/** Fields compared when an edit is finalised — the audit diff. */
const EDIT_FIELDS: { k: keyof Expense; label: string; fmt: (v: any) => string }[] = [
  { k: "date", label: "Date", fmt: (v) => finFmt(v) },
  { k: "supplier", label: "Supplier", fmt: (v) => v },
  { k: "desc", label: "Description", fmt: (v) => v },
  { k: "category", label: "Category", fmt: (v) => finCategory(v).label },
  { k: "gross", label: "Amount", fmt: (v) => finAUD(v) },
  { k: "withheld", label: "PAYG withheld", fmt: (v) => (v ? finAUD(v) : "—") },
];

const changesOf = (before: Expense, after: Partial<Expense>): FieldChange[] =>
  EDIT_FIELDS
    .filter((f) => (before[f.k] ?? "") !== (after[f.k] ?? ""))
    .map((f) => ({ field: f.label, from: f.fmt(before[f.k]), to: f.fmt(after[f.k]) }));

type GateKind = "edit-unlock" | "edit-save" | "delete-1" | "delete-2";
interface Gate { kind: GateKind; exp: Expense; draft?: Partial<Expense>; changes?: FieldChange[]; }

const IconButton: React.FC<{ name: IconName; label: string; onPress: () => void }> = ({ name, label, onPress }) => {
  const { theme } = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
    >
      <Icon name={name} size={15} color={theme.ink.tertiary} />
    </Pressable>
  );
};

export const ExpenseRegister: React.FC<{ settings: FinSettings; period: Period }> = ({ settings, period }) => {
  const { theme, space } = useTokens();
  const { fs } = useResponsive();
  const { expenses, setExpenses, append } = useFinance();
  const [adding, setAdding] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [gate, setGate] = React.useState<Gate | null>(null);
  const [flash, setFlash] = React.useState<string | null>(null);

  const rows = expenses.map((e) => finExpense(e, settings)).filter((e) => finInPeriod(e.date, period));
  const total = finR2(rows.reduce((s, e) => s + e.gross, 0));
  const credits = finR2(rows.reduce((s, e) => s + e.gst, 0));
  const editing = editingId ? expenses.find((x) => x.id === editingId) ?? null : null;
  const line = (e: Expense) => `${finFmt(e.date)} · ${e.supplier} · ${finAUD(e.gross)}`;

  const say = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(null), 4000); };

  // Edit form submitted → diff, then demand the second password.
  const submitEdit = (draft: Partial<Expense>) => {
    if (!editing) return;
    const changes = changesOf(editing, draft);
    if (changes.length === 0) {
      append({ action: "edit_cancelled", ref: editing.id, summary: `Edit closed with no changes — ${line(editing)}` });
      say("No changes to save");
      setEditingId(null);
      return;
    }
    setGate({ kind: "edit-save", exp: editing, draft, changes });
  };

  const cancelEdit = () => {
    if (editing) append({ action: "edit_cancelled", ref: editing.id, summary: `Edit abandoned without saving — ${line(editing)}` });
    setEditingId(null);
  };

  // Second password verified → the gated action is finalised.
  const onVerified = () => {
    if (!gate) return;
    const { kind, exp, draft, changes } = gate;
    if (kind === "edit-unlock") {
      append({ action: "edit_unlocked", ref: exp.id, summary: `Editing unlocked — ${line(exp)}` });
      setAdding(false);
      setEditingId(exp.id);
      setGate(null);
    } else if (kind === "edit-save") {
      setExpenses((xs) =>
        xs.map((x) => {
          if (x.id !== exp.id) return x;
          const merged: Expense = { ...x, ...draft, edited: (x.edited ?? 0) + 1, editedAt: new Date().toISOString() };
          if (!draft?.withheld) delete merged.withheld;
          return merged;
        }).sort((a, b) => b.date.localeCompare(a.date))
      );
      append({ action: "edit_saved", ref: exp.id, summary: `Changes saved — ${exp.supplier} expense`, changes });
      say("Expense updated — recorded in the audit trail");
      setEditingId(null);
      setGate(null);
    } else if (kind === "delete-1") {
      append({ action: "delete_authorised", ref: exp.id, summary: `Deletion authorised — ${line(exp)}` });
      setGate({ kind: "delete-2", exp });
    } else if (kind === "delete-2") {
      setExpenses((xs) => xs.filter((x) => x.id !== exp.id));
      append({
        action: "deleted", ref: exp.id, summary: `Expense permanently deleted — ${exp.supplier}`,
        record: { date: exp.date, supplier: exp.supplier, desc: exp.desc, gross: exp.gross },
      });
      say("Expense deleted — recorded in the audit trail");
      setGate(null);
    }
  };

  const gateCopy = gate
    ? ({
        "edit-unlock": {
          title: "Unlock Editing",
          message: `You are opening a saved record for editing — ${gate.exp.supplier}, ${finFmt(gate.exp.date)}. Changes to the register require identity verification before the workflow begins.`,
          confirmLabel: "Verify & Unlock",
        },
        "edit-save": {
          title: "Finalise Changes",
          message: "Review the changes below, then re-enter your password to save them to the register.",
          confirmLabel: "Verify & Save",
          summary: (
            <View style={{ gap: 8 }}>
              {(gate.changes ?? []).map((c, i) => (
                <View key={i} style={{ gap: 3 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.2, fontSize: 9.5, color: theme.ink.tertiary }}>{c.field}</Text>
                  <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 11.5, color: theme.ink.primary }}>
                    <Text style={{ color: theme.ink.tertiary, textDecorationLine: "line-through" }}>{c.from}</Text>
                    <Text style={{ color: theme.brand.gold }}>{"  →  "}</Text>
                    {c.to}
                  </Text>
                </View>
              ))}
            </View>
          ),
        },
        "delete-1": {
          title: "Authorise Deletion",
          message: `Deleting an expense permanently removes it from the register — ${gate.exp.supplier}, ${finFmt(gate.exp.date)}. Re-enter your password to begin the deletion sequence.`,
          confirmLabel: "Verify & Continue",
          danger: true,
        },
        "delete-2": {
          title: "Confirm Permanent Deletion",
          message: "Final confirmation. This record will be removed from the register and the deletion written to the audit trail.",
          confirmLabel: "Verify & Delete",
          danger: true,
          summary: (
            <View style={{ gap: 4 }}>
              <Mono size={11.5} color={theme.ink.secondary}>{finFmt(gate.exp.date)} · {gate.exp.supplier}</Mono>
              <Note>{gate.exp.desc}</Note>
              <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 12.5, color: theme.brand.gold }}>{finAUD(gate.exp.gross)}</Text>
            </View>
          ),
        },
      } as Record<GateKind, { title: string; message: string; confirmLabel: string; danger?: boolean; summary?: React.ReactNode }>)[gate.kind]
    : null;

  return (
    <View style={{ gap: space.s4 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <View style={{ flex: 1, minWidth: 180 }}>
          <Eyebrow>Expenses · {period.label}</Eyebrow>
          <Note>
            {rows.length} records · {finAUD(total)} total{settings.gstRegistered ? ` · ${finAUD(credits)} in GST credits` : ""}
          </Note>
        </View>
        <Button label="Record Expense" icon="plus" onPress={() => { setEditingId(null); setAdding((a) => !a); }} />
      </View>

      {flash ? (
        <Card gold style={{ padding: 12 }}>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12.5, color: theme.brand.gold }}>{flash}</Text>
        </Card>
      ) : null}

      {adding && !editing ? (
        <ExpenseForm settings={settings} onCancel={() => setAdding(false)} onSave={(vals) => {
          setExpenses((xs) => [{ id: "xm-" + Date.now(), ...vals } as Expense, ...xs].sort((a, b) => b.date.localeCompare(a.date)));
          say("Expense recorded");
          setAdding(false);
        }} />
      ) : null}

      {editing ? (
        <ExpenseForm
          key={editing.id}
          settings={settings}
          initial={editing}
          heading={`Edit Expense · ${editing.id.toUpperCase()}`}
          submitLabel="Save Changes"
          onSave={submitEdit}
          onCancel={cancelEdit}
        />
      ) : null}

      <View style={{ gap: 8 }}>
        {rows.map((e) => (
          <Card key={e.id} gold={editingId === e.id} style={{ padding: 14, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: fs(13), color: theme.ink.primary }}>{e.supplier}</Text>
                  {e.edited ? <Badge label={e.edited > 1 ? `edited ×${e.edited}` : "edited"} /> : null}
                  {e.capital ? <Badge label="asset" tone="gold" /> : null}
                </View>
                <Note>{e.desc}</Note>
                <Mono>{finFmt(e.date)} · {e.cat.label}</Mono>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Display size={17}>{finAUD(e.gross)}</Display>
                {settings.gstRegistered ? (
                  <Mono>{e.gst > 0 ? `${finAUD(e.gst)} GST credit` : "no GST credit"}</Mono>
                ) : null}
              </View>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "flex-end", borderTopWidth: 1, borderColor: theme.border.subtle, paddingTop: 4 }}>
              <IconButton name="edit" label={`Edit ${e.supplier} expense — password required`} onPress={() => setGate({ kind: "edit-unlock", exp: e })} />
              <IconButton name="trash" label={`Delete ${e.supplier} expense — password required`} onPress={() => setGate({ kind: "delete-1", exp: e })} />
            </View>
          </Card>
        ))}
        {rows.length === 0 ? (
          <Card style={{ padding: 28, alignItems: "center" }}>
            <Note>No expenses recorded in this period.</Note>
          </Card>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
        <Icon name="lock" size={14} color={theme.brand.gold} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Note>
            Editing or deleting a saved expense requires password re-entry to unlock the workflow and again to finalise it. Every step is written to the audit trail.
          </Note>
        </View>
      </View>
      {settings.gstRegistered ? (
        <Note>GST credits are calculated at one-eleventh of the GST-inclusive price. Wages, superannuation and bank fees carry no credit.</Note>
      ) : null}

      {gate && gateCopy ? (
        <ReauthModal
          open
          refId={gate.exp.id}
          title={gateCopy.title}
          message={gateCopy.message}
          confirmLabel={gateCopy.confirmLabel}
          danger={gateCopy.danger}
          summary={gateCopy.summary}
          onCancel={() => setGate(null)}
          onVerified={onVerified}
        />
      ) : null}
    </View>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const { theme } = useTokens();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.4, fontSize: 10, color: theme.ink.tertiary }}>{label}</Text>
      {children}
    </View>
  );
};

const ExpenseForm: React.FC<{
  settings: FinSettings; initial?: Expense; heading?: string; submitLabel?: string;
  onSave: (vals: Partial<Expense>) => void; onCancel: () => void;
}> = ({ settings, initial, heading, submitLabel, onSave, onCancel }) => {
  const { theme, radius, space } = useTokens();
  const { fs } = useResponsive();
  const [date, setDate] = React.useState(initial?.date ?? FIN_TODAY);
  const [supplier, setSupplier] = React.useState(initial?.supplier ?? "");
  const [desc, setDesc] = React.useState(initial?.desc ?? "");
  const [category, setCategory] = React.useState(initial?.category ?? "consumables");
  const [gross, setGross] = React.useState(initial ? String(initial.gross) : "");
  const [withheld, setWithheld] = React.useState(initial?.withheld != null ? String(initial.withheld) : "");
  const [error, setError] = React.useState<string | null>(null);

  const cat = finCategory(category);
  const amount = parseFloat(gross) || 0;

  const input = {
    minHeight: 48, borderWidth: 1, borderColor: theme.border.default, borderRadius: radius.xs,
    paddingHorizontal: 12, fontFamily: "Inter_400Regular", fontSize: fs(13.5),
    color: theme.ink.primary, backgroundColor: theme.surface.inset,
  } as const;

  const save = () => {
    if (!supplier.trim() || amount <= 0) { setError("A supplier and an amount are required"); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError("Dates are entered as YYYY-MM-DD"); return; }
    onSave({
      date, supplier: supplier.trim(), desc: desc.trim() || cat.label, category, gross: finR2(amount),
      ...(cat.wages && parseFloat(withheld) > 0 ? { withheld: finR2(parseFloat(withheld)) } : {}),
    });
  };

  return (
    <Card gold style={{ padding: 18, gap: space.s3 }}>
      <Eyebrow>{heading ?? "Record Expense"}</Eyebrow>

      <Field label="Date">
        <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.ink.tertiary} style={[input, { fontFamily: "JetBrainsMono_400Regular" }]} />
      </Field>
      <Field label="Supplier">
        <TextInput value={supplier} onChangeText={setSupplier} placeholder="Who was paid" placeholderTextColor={theme.ink.tertiary} style={input} />
      </Field>
      <Field label="Description">
        <TextInput value={desc} onChangeText={setDesc} placeholder="What it was for" placeholderTextColor={theme.ink.tertiary} style={input} />
      </Field>
      <Field label="ATO Category">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 8, paddingRight: 8 }}>
          {FIN_EXPENSE_CATEGORIES.map((c) => (
            <Chip key={c.key} label={c.label} on={c.key === category} onPress={() => setCategory(c.key)} />
          ))}
        </ScrollView>
      </Field>
      <Field label={settings.gstRegistered && cat.gst ? "Amount (incl. GST) $" : "Amount $"}>
        <TextInput value={gross} onChangeText={setGross} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={theme.ink.tertiary} style={[input, { fontFamily: "JetBrainsMono_400Regular" }]} />
      </Field>
      {cat.wages ? (
        <Field label="PAYG Withheld $">
          <TextInput value={withheld} onChangeText={setWithheld} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={theme.ink.tertiary} style={[input, { fontFamily: "JetBrainsMono_400Regular" }]} />
        </Field>
      ) : null}

      <Note>
        {cat.capital
          ? `Capital asset — ${settings.gstRegistered ? "GST credit claimable; " : ""}depreciated via the write-off rules, not expensed.`
          : settings.gstRegistered && cat.gst && amount > 0
            ? `GST credit of ${finAUD(finGstOfGross(amount))} will be claimed on the BAS.`
            : !cat.gst
              ? "No GST credit applies to this category."
              : ""}
      </Note>

      {error ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="alert" size={14} color={theme.status.warning} />
          <Text style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, color: theme.status.warning }}>{error}</Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <Button label={submitLabel ?? "Save Expense"} onPress={save} />
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
      </View>
      {initial ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="lock" size={12} color={theme.ink.tertiary} />
          <Mono>Saving requires password verification</Mono>
        </View>
      ) : null}
    </Card>
  );
};

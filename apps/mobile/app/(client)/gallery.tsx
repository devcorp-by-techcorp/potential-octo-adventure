/**
 * Client gallery — the immersive "lights-out" surface. On focus it switches
 * the theme to dark (mirrors the web `darkAllowed` gate: dark is reserved for
 * gallery-type viewing) and restores light on blur. Responsive proof grid:
 * column count derives from measured width.
 *
 * Folder model matches the web portal: selecting a frame MOVES it out of
 * All proofs into My selections. Tapping a frame opens the full-bleed viewer.
 */
import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, Modal } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Eyebrow, Display, Body, Button } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { PROOFS, proofUri } from "~/data/seed";
import { usePortal } from "~/state/portal";

export default function Gallery() {
  const { theme, setName, radius } = useTokens();
  const { fs, gutter, width } = useResponsive();
  const { selections, toggleSelection } = usePortal();
  const [tab, setTab] = useState<"all" | "sel">("all");
  const [viewIdx, setViewIdx] = useState<number | null>(null);

  // Lights-out only while this screen is focused.
  useFocusEffect(useCallback(() => {
    setName("dark");
    return () => setName("light");
  }, [setName]));

  const cols = width < 480 ? 2 : width < 1024 ? 3 : 4;
  const gap = 10;
  const itemW = (width - gutter * 2 - gap * (cols - 1)) / cols;
  const visible = PROOFS.map((p, i) => ({ p, i })).filter(({ p }) => (tab === "sel" ? !!selections[p.id] : !selections[p.id]));
  const count = Object.keys(selections).length;
  const viewProof = viewIdx != null ? PROOFS[viewIdx] : null;
  const viewSel = viewProof ? !!selections[viewProof.id] : false;
  const step = (d: number) => setViewIdx((n) => Math.max(0, Math.min(PROOFS.length - 1, (n ?? 0) + d)));

  const Tab = ({ id, label, n }: { id: "all" | "sel"; label: string; n: number }) => {
    const on = tab === id;
    return (
      <Pressable onPress={() => setTab(id)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderColor: on ? theme.brand.gold : "transparent" }}>
        <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1, fontSize: 11, color: on ? theme.brand.gold : theme.ink.tertiary }}>{label}</Text>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: on ? theme.brand.gold : theme.ink.tertiary, opacity: 0.7 }}>{n}</Text>
      </Pressable>
    );
  };

  return (
    <>
      <ScrollView style={{ backgroundColor: theme.surface.canvas }} contentContainerStyle={{ padding: gutter, gap: 18 }}>
        <View>
          <Eyebrow>Your private gallery · 248 frames</Eyebrow>
          <Display size={44} style={{ marginTop: 10, marginBottom: 8 }}>The Whitfield Collection</Display>
          <Body muted style={{ maxWidth: 560 }}>Tap a frame to open it. Chosen images move to a separate collection for your album.</Body>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
            <Button label="Download all" icon="download" />
            <Button label={`Finalise (${count})`} icon="check" variant="ghost" onPress={() => setTab("sel")} />
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 6, borderBottomWidth: 1, borderColor: theme.border.subtle }}>
          <Tab id="all" label="All proofs" n={PROOFS.length - count} />
          <Tab id="sel" label="My selections" n={count} />
        </View>

        {visible.length === 0 ? (
          <View style={{ padding: 40, alignItems: "center", borderWidth: 1, borderStyle: "dashed", borderColor: theme.border.default, borderRadius: radius.sm }}>
            <Display size={19} style={{ color: theme.ink.secondary }}>{tab === "sel" ? "No selections yet" : "Every frame is in your selections"}</Display>
            <Body muted size={12.5} style={{ marginTop: 6, textAlign: "center" }}>
              {tab === "sel"
                ? "Tap the heart on any frame in All proofs to move it here."
                : "Switch to My selections to review the frames you have chosen."}
            </Body>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
          {visible.map(({ p, i }) => {
            const on = !!selections[p.id];
            return (
              <Pressable key={p.id} onPress={() => setViewIdx(i)} style={{ width: itemW, borderRadius: radius.xs, overflow: "hidden", borderWidth: on ? 2 : 0, borderColor: theme.brand.gold }}>
                <Image source={{ uri: proofUri(p.pid) }} style={{ width: "100%", aspectRatio: p.ratio, backgroundColor: theme.surface.inset }} contentFit="cover" transition={200} />
                <Pressable
                  onPress={() => toggleSelection(p.id)}
                  accessibilityLabel={on ? "Remove from selections" : "Add to selections"}
                  style={{ position: "absolute", top: 4, right: 4, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: on ? theme.brand.gold : "rgba(10,10,10,0.4)", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" }}>
                    <Icon name="heart" size={17} color={on ? "#0a0a0a" : "#f4ebd9"} fill={on ? "#0a0a0a" : "none"} stroke={on ? 0 : 1.6} />
                  </View>
                </Pressable>
                <View style={{ position: "absolute", left: 8, bottom: 8 }}>
                  <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 10, color: "#f4ebd9" }}>{p.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Lights-out frame viewer */}
      <Modal visible={!!viewProof} animationType="fade" transparent onRequestClose={() => setViewIdx(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(5,5,5,0.96)" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12 }}>
            <Text style={{ flex: 1, fontFamily: "JetBrainsMono_400Regular", fontSize: 11, color: "#c9b896" }}>
              {viewProof ? `${viewProof.label} · ${(viewIdx ?? 0) + 1} of ${PROOFS.length}` : ""}
            </Text>
            <Pressable onPress={() => setViewIdx(null)} accessibilityLabel="Close viewer" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(244,235,217,0.28)", borderRadius: 3 }}>
              <Icon name="close" size={20} color="#f4ebd9" />
            </Pressable>
          </View>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 }}>
            {viewProof ? (
              <Image source={{ uri: proofUri(viewProof.pid, 1600) }} style={{ width: "100%", height: "100%" }} contentFit="contain" transition={200} />
            ) : null}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 14 }}>
            <Pressable onPress={() => step(-1)} accessibilityLabel="Previous frame" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(244,235,217,0.28)", borderRadius: 3 }}>
              <Icon name="chevronL" size={20} color="#f4ebd9" />
            </Pressable>
            <Pressable
              onPress={() => viewProof && toggleSelection(viewProof.id)}
              style={{ minHeight: 44, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 3, backgroundColor: viewSel ? "#c9a96e" : "transparent", borderWidth: viewSel ? 0 : 1, borderColor: "rgba(201,169,110,0.55)" }}
            >
              <Icon name="heart" size={16} color={viewSel ? "#0a0a0a" : "#c9a96e"} fill={viewSel ? "#0a0a0a" : "none"} stroke={viewSel ? 0 : 1.6} />
              <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.2, fontSize: 11, color: viewSel ? "#0a0a0a" : "#c9a96e" }}>
                {viewSel ? "In selections" : "Add to selections"}
              </Text>
            </Pressable>
            <Pressable onPress={() => step(1)} accessibilityLabel="Next frame" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(244,235,217,0.28)", borderRadius: 3 }}>
              <Icon name="chevronR" size={20} color="#f4ebd9" />
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

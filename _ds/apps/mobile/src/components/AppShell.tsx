/**
 * AppShell — the adaptive application frame shared by the client and admin
 * route groups. Composes a header, the routed <Slot/>, and an AdaptiveNav
 * that is a BOTTOM TAB BAR on compact widths and a SIDE RAIL on wide widths
 * (tablet / landscape). Layout is chosen from measured runtime geometry, so
 * rotation and split-view resize switch it instantly.
 *
 * Tablet is NOT a stretched phone: the rail is a distinct navigation layout,
 * and screens themselves reflow via useResponsive (see each screen).
 */
import React from "react";
import { View, Text, Pressable, ScrollView, Modal, Platform } from "react-native";
import { Slot, usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Icon, IconName } from "./Icon";
import { LogoMark } from "./Logo";
import { useLuma } from "./Luma";
import { useSession } from "~/state/session";
import { useStudio } from "~/state/studio";
import { initialsOf } from "~/data/studio";

export interface NavItem { name: string; label: string; icon: IconName; href: string; badge?: number; }

/** Unread marker on a nav icon — 8pt gold dot, ringed so it reads on any surface. */
function NavIcon({ item, on, size = 22 }: { item: NavItem; on: boolean; size?: number }) {
  const { theme } = useTokens();
  return (
    <View>
      <Icon name={item.icon} size={size} color={on ? theme.brand.gold : theme.ink.tertiary} />
      {item.badge ? (
        <View style={{ position: "absolute", top: -2, right: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: theme.brand.gold, borderWidth: 2, borderColor: theme.surface.raised }} />
      ) : null}
    </View>
  );
}

/**
 * maxTabs caps the bottom tab bar: any surfaces beyond it move into a More
 * sheet. The side rail always carries the full set, so this only ever adapts
 * BELOW the wide breakpoint.
 */
export function AppShell({ items, roleLabel, maxTabs }: { items: NavItem[]; roleLabel: string; maxTabs?: number }) {
  const { theme } = useTokens();
  const { isCompact, isWide, width, height, orientation, deviceClass } = useResponsive();
  // Studio identity comes from Site Content, never a literal.
  const { identity } = useStudio();
  const manager = identity.manager;
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const luma = useLuma();
  const matched = items.find((i) => pathname.startsWith(i.href));
  const active = matched ?? items[0];
  // A screen reachable outside the nav set (e.g. profile) still names itself.
  const title = matched
    ? matched.label
    : (pathname.split("/").filter(Boolean).pop() ?? "").replace(/^./, (c) => c.toUpperCase());

  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: insets.top + 10, paddingBottom: 10, minHeight: insets.top + 56, backgroundColor: theme.surface.raised, borderBottomWidth: 1, borderColor: theme.border.subtle }}>
      {!isWide ? <LogoMark size={28} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 2, fontSize: 9, fontWeight: "600", color: theme.brand.gold }}>{roleLabel}</Text>
        <Text numberOfLines={1} style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 22, color: theme.ink.primary }}>{title}</Text>
      </View>
      {width >= 560 ? (
        <View style={{ borderWidth: 1, borderColor: theme.border.subtle, borderRadius: 3, paddingVertical: 5, paddingHorizontal: 8 }}>
          <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 10, color: theme.ink.tertiary }}>
            {Math.round(width)}×{Math.round(height)} · {orientation} · {deviceClass}
          </Text>
        </View>
      ) : null}
      {roleLabel === "Client Portal" ? (
        <Pressable onPress={() => router.replace("/(client)/profile" as any)} accessibilityLabel="Your profile" style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: theme.border.gold, backgroundColor: theme.brand.goldMuted, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: "Cinzel_600SemiBold", fontSize: 11, color: theme.brand.gold }}>E&J</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={luma.open} accessibilityLabel="Ask Luma" style={{ width: 44, height: 44, borderWidth: 1, borderColor: theme.border.default, borderRadius: 4, alignItems: "center", justifyContent: "center" }}>
        <Icon name="sparkle" size={20} color={theme.brand.gold} />
      </Pressable>
    </View>
  );

  const content = (
    <View style={{ flex: 1, minWidth: 0 }}>
      {header}
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
    </View>
  );

  if (isWide) {
    return (
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: theme.surface.canvas }}>
        <SideRail items={items} activeHref={active.href} onNav={(h) => router.replace(h as any)} insets={insets} />
        {content}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface.canvas }}>
      {content}
      <BottomBar items={items} activeHref={active.href} onNav={(h) => router.replace(h as any)} insetBottom={insets.bottom} maxTabs={maxTabs} />
    </View>
  );
}

function SideRail({ items, activeHref, onNav, insets }: { items: NavItem[]; activeHref: string; onNav: (h: string) => void; insets: { top: number; bottom: number } }) {
  const { theme } = useTokens();
  const { width } = useResponsive();
  const { signOut } = useSession();
  const router = useRouter();
  const leave = () => { signOut(); router.replace("/marketing"); };
  const showLabels = width >= 1000;
  const railW = showLabels ? 236 : 74;
  return (
    <View style={{ width: railW, backgroundColor: theme.surface.raised, borderRightWidth: 1, borderColor: theme.border.subtle, paddingTop: insets.top + 18, paddingBottom: insets.bottom + 12, paddingHorizontal: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, minHeight: 44, marginBottom: 10 }}>
        <LogoMark size={28} />
        {showLabels ? <Text style={{ fontFamily: "Cinzel_600SemiBold", fontSize: 12, letterSpacing: 2, color: theme.ink.primary }}>ILLUMINATE</Text> : null}
      </View>
      <View style={{ height: 1, backgroundColor: theme.border.subtle, marginHorizontal: 8, marginBottom: 10 }} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 3 }} showsVerticalScrollIndicator={false}>
      {items.map((it) => {
        const on = activeHref === it.href;
        return (
          <Pressable key={it.name} onPress={() => onNav(it.href)} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 46, paddingHorizontal: 12, borderRadius: 4, backgroundColor: on ? theme.brand.goldMuted : "transparent" }}>
            <NavIcon item={it} on={on} />
            {showLabels ? <Text style={{ fontFamily: on ? "Inter_600SemiBold" : "Inter_500Medium", fontSize: 12.5, color: on ? theme.brand.gold : theme.ink.tertiary }}>{it.label}</Text> : null}
          </Pressable>
        );
      })}
      </ScrollView>
      <Pressable onPress={leave} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingHorizontal: 12, borderRadius: 4 }}>
        <Icon name="logout" size={22} color={theme.ink.tertiary} />
        {showLabels ? <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12.5, color: theme.ink.tertiary }}>Sign out</Text> : null}
      </Pressable>
    </View>
  );
}

function BottomBar({ items, activeHref, onNav, insetBottom, maxTabs }: { items: NavItem[]; activeHref: string; onNav: (h: string) => void; insetBottom: number; maxTabs?: number }) {
  const { theme } = useTokens();
  const { signOut } = useSession();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const split = maxTabs != null && items.length > maxTabs;
  const bar = split ? items.slice(0, maxTabs) : items;
  const rest = split ? items.slice(maxTabs) : [];
  const moreOn = rest.some((i) => i.href === activeHref);
  const go = (h: string) => { setMoreOpen(false); onNav(h); };
  const leave = () => { setMoreOpen(false); signOut(); router.replace("/marketing" as any); };

  return (
    <View style={{ flexDirection: "row", backgroundColor: theme.surface.raised, borderTopWidth: 1, borderColor: theme.border.subtle, paddingBottom: insetBottom }}>
      {bar.map((it) => {
        const on = activeHref === it.href;
        return (
          <Pressable key={it.name} onPress={() => onNav(it.href)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, minWidth: 0, minHeight: 56, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 6 }}>
            {on ? <View style={{ position: "absolute", top: 0, width: 26, height: 2, borderRadius: 2, backgroundColor: theme.brand.gold }} /> : null}
            <NavIcon item={it} on={on} />
            <Text numberOfLines={1} style={{ fontFamily: on ? "Inter_600SemiBold" : "Inter_500Medium", fontSize: 9.5, letterSpacing: 0.2, color: on ? theme.brand.gold : theme.ink.tertiary }}>{it.label}</Text>
          </Pressable>
        );
      })}

      {split ? (
        <Pressable onPress={() => setMoreOpen(true)} accessibilityRole="button" accessibilityLabel="More studio surfaces" style={{ flex: 1, minWidth: 0, minHeight: 56, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 6 }}>
          {moreOn ? <View style={{ position: "absolute", top: 0, width: 26, height: 2, borderRadius: 2, backgroundColor: theme.brand.gold }} /> : null}
          <Icon name="more" size={22} color={moreOn ? theme.brand.gold : theme.ink.tertiary} />
          <Text style={{ fontFamily: moreOn ? "Inter_600SemiBold" : "Inter_500Medium", fontSize: 9.5, letterSpacing: 0.2, color: moreOn ? theme.brand.gold : theme.ink.tertiary }}>More</Text>
        </Pressable>
      ) : null}

      <Modal visible={moreOpen} transparent animationType="slide" onRequestClose={() => setMoreOpen(false)}>
        <Pressable onPress={() => setMoreOpen(false)} style={{ flex: 1, backgroundColor: theme.scrim, justifyContent: "flex-end" }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: theme.surface.raised, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderTopWidth: 1, borderColor: theme.border.gold, paddingBottom: insetBottom + 14 }}>
            <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 4 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border.default }} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: theme.border.default, backgroundColor: theme.surface.inset, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontFamily: "Cinzel_600SemiBold", fontSize: 11, color: theme.brand.gold }}>{initialsOf(manager.name) || "IS"}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: "CormorantGaramond_600SemiBold", fontSize: 19, color: theme.brand.gold }}>{manager.name || "Illuminate Studios"}</Text>
                <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.8, fontSize: 9, color: theme.ink.tertiary }}>{manager.title || "Studio Manager"}</Text>
              </View>
              <Pressable onPress={() => setMoreOpen(false)} accessibilityLabel="Close" style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <Icon name="close" size={20} color={theme.ink.tertiary} />
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 10, gap: 2 }}>
              {rest.map((it) => {
                const on = activeHref === it.href;
                return (
                  <Pressable key={it.name} onPress={() => go(it.href)} style={{ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 52, paddingHorizontal: 12, borderRadius: 4, backgroundColor: on ? theme.brand.goldMuted : "transparent" }}>
                    <NavIcon item={it} on={on} />
                    <Text style={{ flex: 1, fontFamily: on ? "Inter_600SemiBold" : "Inter_500Medium", fontSize: 13.5, color: on ? theme.brand.gold : theme.ink.secondary }}>{it.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ height: 1, backgroundColor: theme.border.subtle, marginHorizontal: 18, marginVertical: 14 }} />
            <View style={{ paddingHorizontal: 18 }}>
              <Pressable onPress={leave} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 48, borderWidth: 1, borderColor: theme.border.default, borderRadius: 3 }}>
                <Icon name="logout" size={16} color={theme.ink.secondary} />
                <Text style={{ fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.4, fontSize: 11, color: theme.ink.secondary }}>Sign out</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

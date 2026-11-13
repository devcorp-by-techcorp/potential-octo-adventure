/**
 * Client documents — contracts, releases and schedules. Rows reflow (the meta
 * line wraps under the title on narrow widths) and both row actions hold the
 * 44pt floor.
 */
import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useTokens } from "~/theme/useTokens";
import { useResponsive } from "~/hooks/useResponsive";
import { Eyebrow, Display, Body, Badge } from "~/components/ui";
import { Icon, IconName } from "~/components/Icon";
import { usePortal } from "~/state/portal";
import { docMeta } from "~/data/seed";

export default function Documents() {
  const { theme, radius, space } = useTokens();
  const { fs, gutter } = useResponsive();
  const { docs } = usePortal();

  const RowAction = ({ icon, label }: { icon: IconName; label: string }) => (
    <Pressable
      accessibilityLabel={label}
      style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.border.default, borderRadius: radius.xs }}
    >
      <Icon name={icon} size={18} color={theme.ink.secondary} />
    </Pressable>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: gutter, gap: space.s4 }}>
      <View>
        <Eyebrow>Documents</Eyebrow>
        <Display size={34} style={{ marginTop: 6 }}>Your files</Display>
        <Body muted size={12.5} style={{ marginTop: 4, maxWidth: 520 }}>
          Contracts, releases and schedules. Anything you sign in the inbox is filed here.
        </Body>
      </View>

      <View style={{ borderWidth: 1, borderColor: theme.border.subtle, borderRadius: radius.sm, overflow: "hidden" }}>
        {docs.map((d, i) => (
          <View
            key={d.id}
            style={{
              flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, padding: 14,
              backgroundColor: theme.surface.raised, borderTopWidth: i === 0 ? 0 : 1, borderColor: theme.border.subtle,
            }}
          >
            <Icon name="doc" size={20} color={theme.brand.gold} />
            <View style={{ flexGrow: 1, flexBasis: 170, minWidth: 0 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: fs(13), color: theme.ink.primary }}>{d.title}</Text>
              <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 10.5, color: theme.ink.tertiary, marginTop: 3 }}>{docMeta(d)}</Text>
            </View>
            <Badge label={d.type} tone={d.type === "Contract" ? "gold" : "muted"} />
            <View style={{ flexDirection: "row", gap: 6 }}>
              <RowAction icon="eye" label="Preview" />
              <RowAction icon="download" label="Download" />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

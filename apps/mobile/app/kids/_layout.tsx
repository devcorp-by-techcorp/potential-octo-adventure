/**
 * Illuminate Kids — the children's photography branch. Its own stack and its
 * own look, reachable from the main Illuminate Studios site.
 */
import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { K } from "~/data/kids";

export default function KidsLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: "fade", contentStyle: { backgroundColor: K.ground } }} />
    </>
  );
}

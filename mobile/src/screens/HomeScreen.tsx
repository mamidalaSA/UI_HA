import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { fetchAlertsToday, markAlertTaken } from "../api/patient";
import type { PatientAlert } from "../api/types";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAuth } from "../context/AuthContext";
import { colors, spacing } from "../theme";

export default function HomeScreen() {
  const { signOut } = useAuth();
  const [alerts, setAlerts] = useState<PatientAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [takingId, setTakingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchAlertsToday();
      // Earliest dose first.
      data.sort((a, b) => a.fire_at.localeCompare(b.fire_at));
      setAlerts(data);
    } catch {
      setError("Could not load today's dose schedule.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleTaken(alert: PatientAlert) {
    setTakingId(alert.id);
    try {
      await markAlertTaken(alert.id);
      setAlerts((prev) =>
        prev.map((a) => (a.id === alert.id ? { ...a, status: "GIVEN" } : a))
      );
    } catch (err) {
      const anyErr = err as { response?: { data?: { detail?: string } } };
      Alert.alert("Could not log dose", anyErr?.response?.data?.detail ?? "Please try again.");
    } finally {
      setTakingId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Today's doses</Text>
          <Text style={styles.subtitle}>{new Date().toDateString()}</Text>
        </View>
        <Pressable onPress={() => void signOut()}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>{error ?? "No doses scheduled for today."}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.rowBetween}>
              <Text style={styles.medicineName}>{item.medicine_name}</Text>
              <Text style={styles.time}>{item.slot_time.slice(0, 5)}</Text>
            </View>
            <Text style={styles.dosage}>
              {item.dosage} · {item.route}
              {item.with_food ? " · with food" : ""}
            </Text>
            {item.special_instructions ? (
              <Text style={styles.instructions}>{item.special_instructions}</Text>
            ) : null}

            <View style={styles.spacer} />
            {item.status === "GIVEN" ? (
              <View style={styles.takenBadge}>
                <Text style={styles.takenBadgeText}>Taken</Text>
              </View>
            ) : item.status === "MISSED" || item.status === "CANCELLED" ? (
              <View style={styles.mutedBadge}>
                <Text style={styles.mutedBadgeText}>{item.status}</Text>
              </View>
            ) : (
              <PrimaryButton
                title="I took this"
                onPress={() => handleTaken(item)}
                loading={takingId === item.id}
              />
            )}
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.xl * 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  signOut: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: 13,
    paddingTop: spacing.xs,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  medicineName: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  time: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
  },
  dosage: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  instructions: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    fontStyle: "italic",
  },
  spacer: {
    height: spacing.sm,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
  },
  takenBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#dcfce7",
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  takenBadgeText: {
    color: colors.success,
    fontWeight: "700",
    fontSize: 13,
  },
  mutedBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  mutedBadgeText: {
    color: colors.textMuted,
    fontWeight: "700",
    fontSize: 13,
  },
});

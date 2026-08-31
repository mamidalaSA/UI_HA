import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";

import { fetchHistory } from "../api/patient";
import type { MedicationHistoryEntry } from "../api/types";
import { Card } from "../components/Card";
import { colors, spacing } from "../theme";

export default function HistoryScreen() {
  const [history, setHistory] = useState<MedicationHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHistory();
      setHistory(data);
    } catch {
      setError("Could not load medication history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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
        <Text style={styles.title}>Medication history</Text>
      </View>

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>{error ?? "No doses logged yet."}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.rowBetween}>
              <Text style={styles.medicineName}>{item.medicine_name ?? "Medicine"}</Text>
              {item.skipped ? (
                <Text style={styles.skippedTag}>Skipped</Text>
              ) : (
                <Text style={styles.givenTag}>Given</Text>
              )}
            </View>
            <Text style={styles.meta}>{new Date(item.administered_at).toLocaleString()}</Text>
            {item.dose_given ? <Text style={styles.meta}>Dose: {item.dose_given}</Text> : null}
            {item.skipped && item.skip_reason ? (
              <Text style={styles.skipReason}>Reason: {item.skip_reason}</Text>
            ) : null}
            {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
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
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  skipReason: {
    fontSize: 13,
    color: colors.danger,
    marginTop: 4,
  },
  notes: {
    fontSize: 13,
    color: colors.text,
    marginTop: 4,
    fontStyle: "italic",
  },
  givenTag: {
    color: colors.success,
    fontWeight: "700",
    fontSize: 12,
  },
  skippedTag: {
    color: colors.danger,
    fontWeight: "700",
    fontSize: 12,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
  },
});

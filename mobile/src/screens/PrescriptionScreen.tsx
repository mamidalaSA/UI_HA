import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";

import { fetchActivePrescription } from "../api/patient";
import type { ActivePrescription } from "../api/types";
import { Card } from "../components/Card";
import { colors, spacing } from "../theme";

export default function PrescriptionScreen() {
  const [prescription, setPrescription] = useState<ActivePrescription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchActivePrescription();
      setPrescription(data);
    } catch (err) {
      const anyErr = err as { response?: { status?: number } };
      if (anyErr?.response?.status === 404) {
        setPrescription(null);
        setError("You have no active prescription right now.");
      } else {
        setError("Could not load your prescription.");
      }
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

  if (!prescription) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{error ?? "No active prescription."}</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.title}>Active prescription</Text>
        <Text style={styles.subtitle}>
          Version {prescription.version} · started {new Date(prescription.created_at).toDateString()}
        </Text>
        {prescription.notes ? <Text style={styles.notes}>{prescription.notes}</Text> : null}
      </View>

      <FlatList
        data={prescription.lines}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.medicineName}>{item.medicine_name}</Text>
            <Text style={styles.dosage}>
              {item.dosage} · {item.route} · {formatFrequency(item.frequency)}
            </Text>
            <Text style={styles.meta}>
              {item.duration_days} day{item.duration_days === 1 ? "" : "s"} from{" "}
              {new Date(item.start_date).toDateString()}
              {item.with_food ? " · take with food" : ""}
            </Text>
            {item.special_instructions ? (
              <Text style={styles.instructions}>{item.special_instructions}</Text>
            ) : null}
          </Card>
        )}
      />
    </View>
  );
}

function formatFrequency(frequency: string): string {
  return frequency.replace(/_/g, " ");
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
    paddingHorizontal: spacing.lg,
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
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  notes: {
    fontSize: 13,
    color: colors.text,
    marginTop: spacing.sm,
    backgroundColor: "#f1f5f9",
    padding: spacing.sm,
    borderRadius: 8,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  medicineName: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  dosage: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  instructions: {
    fontSize: 13,
    color: colors.text,
    marginTop: 6,
    fontStyle: "italic",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
  },
});

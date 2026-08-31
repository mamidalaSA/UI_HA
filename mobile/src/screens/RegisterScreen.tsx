import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { registerPatient, sendOtp } from "../api/patient";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { useAuth } from "../context/AuthContext";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

export default function RegisterScreen(_props: Props) {
  const { signIn } = useAuth();

  const [patientId, setPatientId] = useState("");
  const [mobile, setMobile] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function handleSendOtp() {
    if (!mobile.trim()) {
      Alert.alert("Mobile number required", "Enter the mobile number on your hospital record.");
      return;
    }
    setSendingOtp(true);
    try {
      await sendOtp(mobile.trim());
      setOtpSent(true);
      Alert.alert("OTP sent", "Enter the code you received by SMS.");
    } catch (err) {
      Alert.alert("Could not send OTP", extractErrorMessage(err));
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleVerifyAndRegister() {
    if (!patientId.trim() || !mobile.trim() || !otpCode.trim()) {
      Alert.alert("Missing details", "Enter your patient ID, mobile number, and the OTP code.");
      return;
    }
    setVerifying(true);
    try {
      const result = await registerPatient(patientId.trim(), mobile.trim(), otpCode.trim());
      await signIn(result.access_token);
      // No manual navigation needed — the root navigator switches to Main once
      // AuthContext reports a token, see App.tsx.
    } catch (err) {
      Alert.alert("Registration failed", extractErrorMessage(err));
    } finally {
      setVerifying(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>HMS Patient</Text>
        <Text style={styles.subtitle}>Register with your Patient ID to view your prescriptions and dose schedule.</Text>

        <Card>
          <Text style={styles.label}>Patient ID</Text>
          <TextInput
            style={styles.input}
            value={patientId}
            onChangeText={setPatientId}
            placeholder="Given at reception, e.g. printed on your slip"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Mobile number</Text>
          <TextInput
            style={styles.input}
            value={mobile}
            onChangeText={setMobile}
            placeholder="Mobile on your hospital record"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
          />

          <View style={styles.spacer} />
          <PrimaryButton
            title={otpSent ? "Resend OTP" : "Send OTP"}
            onPress={handleSendOtp}
            loading={sendingOtp}
            variant="secondary"
          />
        </Card>

        {otpSent && (
          <Card>
            <Text style={styles.label}>OTP code</Text>
            <TextInput
              style={styles.input}
              value={otpCode}
              onChangeText={setOtpCode}
              placeholder="6-digit code"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
            />
            <View style={styles.spacer} />
            <PrimaryButton title="Verify & Register" onPress={handleVerifyAndRegister} loading={verifying} />
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function extractErrorMessage(err: unknown): string {
  const anyErr = err as { response?: { data?: { detail?: string } } };
  return anyErr?.response?.data?.detail ?? "Something went wrong. Please try again.";
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    paddingTop: spacing.xl * 2,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  spacer: {
    height: spacing.sm,
  },
});

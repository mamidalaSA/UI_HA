import type { NavigatorScreenParams } from "@react-navigation/native";

export type MainTabParamList = {
  Home: undefined;
  Prescription: undefined;
  History: undefined;
};

export type RootStackParamList = {
  Register: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
};

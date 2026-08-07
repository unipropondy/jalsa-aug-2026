import Constants from "expo-constants";
import { Platform } from "react-native";

const getLocalBackendIP = (): string => {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.hostname;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ?? Constants.manifest?.debuggerHost;

  if (hostUri) {
    return hostUri.split(":")[0];
  }

  return "localhost";
};

import AsyncStorage from "@react-native-async-storage/async-storage";

const localIP = getLocalBackendIP();

const PRODUCTION_BACKEND = "https://jalsa-aug-2026-production.up.railway.app";

export let API_URL =
  (Platform.OS === "web" && typeof window !== "undefined")
    ? (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? `http://localhost:3000`           // local web dev
        : PRODUCTION_BACKEND)              // Cloudflare / any cloud → Railway HTTPS
    : (__DEV__ ? `http://${localIP}:3000` : PRODUCTION_BACKEND);

export const setDynamicApiUrl = async (newUrl: string) => {
  let formattedUrl = newUrl.trim();
  if (formattedUrl.endsWith("/")) {
    formattedUrl = formattedUrl.slice(0, -1);
  }
  if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
    // Default to https if no protocol specified
    formattedUrl = `https://${formattedUrl}`;
  }
  API_URL = formattedUrl;
  try {
    await AsyncStorage.setItem("CUSTOM_SERVER_URL", formattedUrl);
    console.log(`💾 Saved custom server URL: ${formattedUrl}`);
  } catch (e) {
    console.warn("Failed to save custom server URL to AsyncStorage:", e);
  }
};

export const loadCustomServerUrl = async () => {
  try {
    const saved = await AsyncStorage.getItem("CUSTOM_SERVER_URL");
    if (saved && saved.trim()) {
      API_URL = saved.trim();
      console.log(`🌐 Loaded custom server URL: ${API_URL}`);
      return API_URL;
    }
  } catch (e) {
    console.warn("Failed to load custom server URL from AsyncStorage:", e);
  }
  return API_URL;
};

if (__DEV__) {
  console.log(`🌐 [Config] API_URL: ${API_URL} | Platform: ${Platform.OS}`);
}


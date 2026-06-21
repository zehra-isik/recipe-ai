import Constants from 'expo-constants';
import { Platform } from 'react-native';

const fallbackHost = '192.168.1.164';

const hostUri =
  (Constants.expoConfig as any)?.hostUri ||
  (Constants as any).manifest?.debuggerHost ||
  (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;

const host = String(hostUri || fallbackHost).split(':')[0] || fallbackHost;
const envApiUrl = process.env.EXPO_PUBLIC_API_URL;

export const API_URL =
  envApiUrl ||
  (Platform.OS === 'android' && host === 'localhost'
    ? 'http://10.0.2.2:3000'
    : `http://${host}:3000`);

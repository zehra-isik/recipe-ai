import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#D97706', headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Anasayfa', tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="find"
        options={{ title: 'Tarif Bul', tabBarIcon: ({ color }) => <MaterialCommunityIcons name="magic-staff" size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="favorites" 
        options={{ title: 'Favoriler', tabBarIcon: ({ color }) => <Ionicons name="heart" size={24} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profil', tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} /> }}
      />
    </Tabs>
  );
}

import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      
      <Stack.Screen 
        name="recipe/[id]" 
        options={{ 
          title: 'Tarif Detayı', 
          headerBackTitle: 'Geri',
          headerTintColor: '#D97706'
        }} 
      />
    </Stack>
  );
}
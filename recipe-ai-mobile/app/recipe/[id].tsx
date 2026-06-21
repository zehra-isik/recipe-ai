import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/constants/api';
import axios from 'axios';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function RecipeDetailScreen() {
  const { recipeStr } = useLocalSearchParams();
  const recipe = useMemo(
    () => (recipeStr ? JSON.parse(recipeStr as string) : null),
    [recipeStr],
  );

  const [scrapedData, setScrapedData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  const USER_ID = 1;

  useEffect(() => {
    const targetUrl = recipe?.recipeUrl || recipe?.url;
    if (targetUrl) {
      const scrapeData = async () => {
        setLoading(true);
        try {
          const response = await axios.post(`${API_URL}/recipes/scrape`, { url: targetUrl });
          setScrapedData(response.data);
        } catch (error) {
          console.error("Kazıma hatası:", error);
        } finally {
          setLoading(false);
        }
      };

      scrapeData();
    }
    
    if (recipe && recipe.id) {
      const checkFavoriteStatus = async () => {
        try {
          const response = await axios.get(`${API_URL}/users/${USER_ID}/favorites/${recipe.id}/check`);
          setIsFavorite(response.data.isFavorite);
        } catch (error) {
          console.error("Favori durumu kontrol edilemedi:", error);
        }
      };

      checkFavoriteStatus();
    }
  }, [recipe]);

  const toggleFavorite = async () => {
    try {
      const response = await axios.post(`${API_URL}/users/${USER_ID}/favorites/${recipe.id}`);
      setIsFavorite(response.data.isFavorite);
      
      Alert.alert("Başarılı", response.data.message);
    } catch (error) {
      console.error("Favori işlemi hatası:", error);
      Alert.alert("Hata", "Favori işlemi gerçekleştirilemedi.");
    }
  };

  if (!recipe) {
    return (
      <View style={styles.center}>
        <Text>Tarif bulunamadı.</Text>
      </View>
    );
  }

  const displayImage = scrapedData?.imageUrl || recipe.imageUrl || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?q=80&w=800&auto=format&fit=crop';
  const displayInstructions = scrapedData?.instructions || recipe.instructions || "Bu tarifin yapılış detayları internetten çekilemedi.";
  const displayIngredients = scrapedData?.scrapedIngredients || recipe.ingredients || [];
  
  const displayPrepTime = scrapedData?.prepTime || '15 dk';
  const displayCookTime = scrapedData?.cookTime || '20 dk';
  const displayServings = scrapedData?.servings || recipe.servings || '2-4 Kişilik';
  const displayCalories = scrapedData?.calories || recipe.calories || '350 kcal';

  const instructionSteps = displayInstructions.includes('\n') 
    ? displayInstructions.split(/\n+/).filter((step: string) => step.trim() !== '') 
    : [displayInstructions];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image source={{ uri: displayImage }} style={styles.image} />
      
      <View style={styles.content}>
        
        <View style={styles.titleRow}>
          <Text style={styles.title}>{recipe.name}</Text>
          <TouchableOpacity style={styles.favoriteButton} onPress={toggleFavorite}>
            <Ionicons 
              name={isFavorite ? "heart" : "heart-outline"} 
              size={28} 
              color={isFavorite ? "#dc3545" : "#666"}
            />
          </TouchableOpacity>
        </View>
        
        <View style={styles.infoGrid}>
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>🕒</Text>
            <Text style={styles.infoLabel}>Hazırlık</Text>
            <Text style={styles.infoValue}>{displayPrepTime}</Text>
          </View>
          
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>🍳</Text>
            <Text style={styles.infoLabel}>Pişirme</Text>
            <Text style={styles.infoValue}>{displayCookTime}</Text>
          </View>
          
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>🔥</Text>
            <Text style={styles.infoLabel}>Enerji</Text>
            <Text style={styles.infoValue}>{displayCalories}</Text>
          </View>
          
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>🍽️</Text>
            <Text style={styles.infoLabel}>Porsiyon</Text>
            <Text style={styles.infoValue}>{displayServings}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Gerekli Malzemeler</Text>
        <View style={styles.card}>
          {loading ? (
             <ActivityIndicator size="small" color="#D97706" style={{ marginVertical: 10 }} />
          ) : displayIngredients && displayIngredients.length > 0 ? (
            displayIngredients.map((ing: string, index: number) => (
              <View key={index} style={styles.listItemContainer}>
                <View style={styles.bulletDot} />
                <Text style={styles.listItemText}>{ing}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.instructions}>Malzeme bilgisi bulunamadı.</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Nasıl Yapılır?</Text>
        <View style={styles.card}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#D97706" />
              <Text style={styles.loadingText}>Tarif detayları internetten çekiliyor...</Text>
            </View>
          ) : (
            instructionSteps.map((step: string, index: number) => (
              <View key={`step-${index}`} style={styles.listItemContainer}>
                <View style={styles.bulletDot} />
                <Text style={styles.listItemText}>{step.trim()}</Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flexGrow: 1, backgroundColor: '#f5f5f5', paddingBottom: 40 },
  image: { width: '100%', height: 260 },
  content: { padding: 20, marginTop: -25, backgroundColor: '#f5f5f5', borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#111', flex: 1, marginRight: 10 },
  favoriteButton: { backgroundColor: '#fff', padding: 10, borderRadius: 50, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },

  infoGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  infoBox: { flex: 1, backgroundColor: '#fff', padding: 10, marginHorizontal: 4, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2, borderWidth: 1, borderColor: '#eaeaea' },
  infoIcon: { fontSize: 20, marginBottom: 4 },
  infoLabel: { fontSize: 11, color: '#888', fontWeight: '500', marginBottom: 2 },
  infoValue: { fontSize: 12, fontWeight: 'bold', color: '#D97706', textAlign: 'center' },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#222', marginBottom: 12, marginTop: 8 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 5, elevation: 1 },
  
  listItemContainer: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  bulletDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#D97706', marginTop: 7, marginRight: 12 },
  listItemText: { fontSize: 15, color: '#444', flex: 1, lineHeight: 22 },
  
  instructions: { fontSize: 15, color: '#444', lineHeight: 24 },
  loadingContainer: { padding: 20, alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#666', fontSize: 13 }
});

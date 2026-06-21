import { API_URL } from '@/constants/api';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

export default function FavoritesScreen() {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  const router = useRouter();

  const defaultImage =
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c';

  const formatTime = (timeStr: string, defaultTime: string) => {
    if (!timeStr) return defaultTime;
    const match = String(timeStr).match(/\d+/);
    return match ? `${match[0]} dk` : defaultTime;
  };

  const checkAuthAndFetch = async () => {
    setLoading(true);

    try {
      const userId = await AsyncStorage.getItem('userId');

      if (!userId) {
        setIsLoggedIn(false);
        setFavorites([]);
        setLoading(false);
        return;
      }

      setIsLoggedIn(true);
      const res = await axios.get(`${API_URL}/users/${userId}/favorites`);
      const loadedFavorites = res.data || [];

      setFavorites(loadedFavorites);

      loadedFavorites.forEach(async (recipe: any) => {
        if (!recipe.imageUrl || recipe.imageUrl.trim() === '') {
          const targetUrl = recipe.recipeUrl || recipe.url;

          if (targetUrl) {
            try {
              const scrapeRes = await axios.post(`${API_URL}/recipes/scrape`, {
                url: targetUrl
              });

              if (scrapeRes.data?.imageUrl) {
                setFavorites(current =>
                  current.map(item =>
                    Number(item.id) === Number(recipe.id)
                      ? { ...item, imageUrl: scrapeRes.data.imageUrl }
                      : item
                  )
                );
              }
            } catch {}
          }
        }
      });
    } catch {
      Alert.alert('Hata', 'Favoriler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setStep(1);
      setSelectedRecipe(null);
      checkAuthAndFetch();
    }, [])
  );

  const handleRecipeClick = async (recipe: any) => {
    setLoading(true);

    try {
      const targetUrl = recipe.recipeUrl || recipe.url;

      if (targetUrl && targetUrl.trim() !== '') {
        const response = await axios.post(`${API_URL}/recipes/scrape`, {
          url: targetUrl
        });

        setSelectedRecipe({
          ...recipe,
          ...response.data
        });
      } else {
        setSelectedRecipe(recipe);
      }

      setStep(2);
    } catch {
      Alert.alert(
        'Bilgi',
        'Tarif detayları tam çekilemedi, elimizdeki bilgiler gösteriliyor.'
      );

      setSelectedRecipe(recipe);
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (recipeId: number) => {
    try {
      const userId = await AsyncStorage.getItem('userId');

      if (!userId) return;

      await axios.post(`${API_URL}/users/${userId}/favorites/${recipeId}`);

      setFavorites(prev => prev.filter(f => Number(f.id) !== Number(recipeId)));

      if (selectedRecipe && Number(selectedRecipe.id) === Number(recipeId)) {
        setStep(1);
        setSelectedRecipe(null);
      }
    } catch {
      Alert.alert('Hata', 'Favorilerden kaldırılamadı.');
    }
  };

  const renderRecipeItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.recipeCard}
      activeOpacity={0.9}
      onPress={() => handleRecipeClick(item)}
    >
      <Image
        source={{ uri: item.imageUrl || defaultImage }}
        style={styles.recipeImage}
      />

      <View style={styles.cardBody}>
        <View style={{ flex: 1 }}>
          <Text style={styles.recipeTitle} numberOfLines={2}>
            {item.name}
          </Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoText}>
              Haz: {formatTime(item.prepTime, '10 dk')}
            </Text>
            <Text style={styles.infoText}>
              Piş: {formatTime(item.cookTime, '15 dk')}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => removeFavorite(item.id)}
        >
          <Ionicons name="heart" size={24} color="#E53935" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {step === 1 && (
        <>
          <View style={styles.headerCentered}>
            <Text style={styles.headerCenteredTitle}>Favorilerim</Text>
          </View>

          {loading ? (
            <ActivityIndicator
              size="large"
              color="#D97706"
              style={{ marginTop: 50 }}
            />
          ) : !isLoggedIn ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyHeaderBox}>
                <Text style={styles.emptyMainTitle}>Kaydedilen Lezzetler</Text>
                <Text style={styles.emptySubTitle}>Favorilerini görmek için giriş yapmalısın</Text>
              </View>

              <View style={styles.emptyContent}>
                <View style={styles.iconCircle}>
                   <Ionicons name="lock-closed-outline" size={50} color="#D2A373" />
                </View>
                <Text style={styles.emptyInfoText}>Giriş Yapman Gerekiyor</Text>
                <Text style={styles.unauthSubText}>
                  Tarifleri favorilerine eklemek ve daha sonra tekrar ulaşabilmek için lütfen giriş yap veya yeni bir hesap oluştur.
                </Text>
                
                <TouchableOpacity 
                  style={styles.exploreButton} 
                  onPress={() => router.push('/profile')} 
                >
                  <Text style={styles.exploreButtonText}>Giriş Yap / Kayıt Ol</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : favorites.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyHeaderBox}>
                <Text style={styles.emptyMainTitle}>Kaydedilen Lezzetler</Text>
                <Text style={styles.emptySubTitle}>Toplam 0 favori tarifiniz var</Text>
              </View>

              <View style={styles.emptyContent}>
                <Ionicons name="restaurant-outline" size={80} color="#D2A373" style={{ marginBottom: 20 }} />
                <Text style={styles.emptyInfoText}>Henüz hiç favori tarifin yok.</Text>
                
                <TouchableOpacity 
                  style={styles.exploreButton} 
                  onPress={() => router.push('/')} 
                >
                  <Text style={styles.exploreButtonText}>Tarif Keşfet</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.filledMainTitle}>Kaydedilen Lezzetler</Text>
              <Text style={styles.filledSubTitle}>Toplam {favorites.length} favori tarifiniz var</Text>
              <FlatList
                data={favorites}
                renderItem={renderRecipeItem}
                keyExtractor={item => String(item.id)}
                contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
                showsVerticalScrollIndicator={false}
              />
            </>
          )}
        </>
      )}

      {step === 2 && selectedRecipe && (
        <View style={{ flex: 1 }}>
          <View style={styles.detailHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setStep(1)}
            >
              <Ionicons name="chevron-back" size={20} color="#fff" />
              <Text style={styles.backButtonText}>Geri</Text>
            </TouchableOpacity>

            <Text style={styles.detailHeaderTitle}>Tarif Detayı</Text>

            <TouchableOpacity onPress={() => removeFavorite(selectedRecipe.id)}>
              <Ionicons name="heart" size={28} color="#E53935" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator
              size="large"
              color="#D97706"
              style={{ marginTop: 120 }}
            />
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 50 }}
            >
              <Image
                source={{ uri: selectedRecipe.imageUrl || defaultImage }}
                style={styles.detailImage}
              />

              <View style={styles.detailSheet}>
                <Text style={styles.detailTitle}>{selectedRecipe.name}</Text>

                <View style={styles.detailCardsRow}>
                  <View style={styles.detailSmallCard}>
                    <Ionicons name="time-outline" size={24} color="#666" />
                    <Text style={styles.detailCardLabel}>Hazırlık</Text>
                    <Text style={styles.detailCardValue}>
                      {formatTime(selectedRecipe.prepTime, '10 dk')}
                    </Text>
                  </View>

                  <View style={styles.detailSmallCard}>
                    <Ionicons name="flame-outline" size={24} color="#666" />
                    <Text style={styles.detailCardLabel}>Pişirme</Text>
                    <Text style={styles.detailCardValue}>
                      {formatTime(selectedRecipe.cookTime, '15 dk')}
                    </Text>
                  </View>

                  <View style={styles.detailSmallCard}>
                    <Ionicons name="restaurant-outline" size={24} color="#666" />
                    <Text style={styles.detailCardLabel}>Porsiyon</Text>
                    <Text style={styles.detailCardValue}>
                      {selectedRecipe.servings || 'Belirtilmedi'}
                    </Text>
                  </View>

                  <View style={styles.detailSmallCard}>
                    <Ionicons name="flash-outline" size={24} color="#666" />
                    <Text style={styles.detailCardLabel}>Kalori</Text>
                    <Text style={styles.detailCardValue}>
                      {selectedRecipe.calories || 'Belirtilmedi'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.sectionTitle}>Gerekli Malzemeler</Text>

                <View style={styles.contentBox}>
                  {selectedRecipe.scrapedIngredients &&
                  selectedRecipe.scrapedIngredients.length > 0 ? (
                    selectedRecipe.scrapedIngredients.map(
                      (item: string, idx: number) => (
                        <View key={idx} style={styles.ingredientRow}>
                          <View style={styles.bullet} />
                          <Text style={styles.ingredientText}>{item}</Text>
                        </View>
                      )
                    )
                  ) : selectedRecipe.rawIngredients &&
                    selectedRecipe.rawIngredients.length > 0 ? (
                    selectedRecipe.rawIngredients.map(
                      (item: string, idx: number) => (
                        <View key={idx} style={styles.ingredientRow}>
                          <View style={styles.bullet} />
                          <Text style={styles.ingredientText}>{item}</Text>
                        </View>
                      )
                    )
                  ) : selectedRecipe.ingredients &&
                    selectedRecipe.ingredients.length > 0 ? (
                    selectedRecipe.ingredients.map((item: string, idx: number) => (
                      <View key={idx} style={styles.ingredientRow}>
                        <View style={styles.bullet} />
                        <Text style={styles.ingredientText}>{item}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.ingredientText}>
                      Malzemeler yüklenemedi.
                    </Text>
                  )}
                </View>

                <Text style={styles.sectionTitle}>Nasıl Yapılır?</Text>

                <View style={styles.contentBox}>
                  {selectedRecipe.instructions ? (
                    selectedRecipe.instructions
                      .split('\n\n')
                      .map((stepText: string, idx: number) => {
                        if (!stepText.trim()) return null;

                        return (
                          <View key={idx} style={styles.ingredientRow}>
                            <View style={styles.bullet} />
                            <Text style={styles.instructionText}>
                              {stepText.trim()}
                            </Text>
                          </View>
                        );
                      })
                  ) : (
                    <Text style={styles.instructionText}>
                      Yapılış adımları bulunamadı.
                    </Text>
                  )}
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF4EF',
    paddingTop: 60,
    paddingHorizontal: 20
  },

  headerCentered: { alignItems: 'center', marginBottom: 25 },
  headerCenteredTitle: { fontSize: 16, fontWeight: 'bold', color: '#9E8576' },

  emptyContainer: { flex: 1 },
  emptyHeaderBox: { marginBottom: 50 },
  emptyMainTitle: { fontSize: 32, fontWeight: '900', color: '#3E2723', letterSpacing: -0.5, marginBottom: 8 },
  emptySubTitle: { fontSize: 15, color: '#795548' },

  emptyContent: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: -100 },
  emptyInfoText: { fontSize: 18, fontWeight: 'bold', color: '#3E2723', marginBottom: 20 },
  
  iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F3E5D8', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  unauthSubText: { fontSize: 15, color: '#795548', textAlign: 'center', paddingHorizontal: 15, marginBottom: 35, lineHeight: 22 },

  exploreButton: { backgroundColor: '#D97706', paddingVertical: 14, paddingHorizontal: 30, borderRadius: 25 },
  exploreButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  filledMainTitle: { fontSize: 32, fontWeight: '900', color: '#3E2723', letterSpacing: -0.5, marginBottom: 8 },
  filledSubTitle: { fontSize: 15, color: '#795548', marginBottom: 20 },

  recipeCard: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 15, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  recipeImage: { width: '100%', height: 180, resizeMode: 'cover' },
  cardBody: { padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recipeTitle: { fontSize: 16, fontWeight: 'bold', color: '#3E2723', flex: 1 },
  infoRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  infoText: { fontSize: 12, color: '#9E4200', fontWeight: 'bold' },
  removeBtn: { padding: 5, marginLeft: 10 },
  noDataText: { textAlign: 'center', color: '#795548', marginTop: 50, fontSize: 16 },

  detailHeader: { position: 'absolute', top: 0, left: -20, right: -20, zIndex: 20, paddingTop: 50, paddingHorizontal: 20, paddingBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 25 },
  backButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14, marginLeft: 4 },
  detailHeaderTitle: { color: '#D97706', fontSize: 18, fontWeight: 'bold' },
  detailImage: { width: '100%', height: 330, resizeMode: 'cover', marginHorizontal: -20 },
  detailSheet: { backgroundColor: '#F6F6F6', marginHorizontal: -20, marginTop: -30, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20 },
  detailTitle: { fontSize: 26, fontWeight: 'bold', color: '#111', textAlign: 'center', marginBottom: 25, marginTop: 10 },
  detailCardsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  detailSmallCard: { backgroundColor: '#fff', width: '23%', borderRadius: 15, paddingVertical: 14, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  detailCardLabel: { fontSize: 10, color: '#8E8E93', marginTop: 6, marginBottom: 4 },
  detailCardValue: { fontSize: 11, fontWeight: 'bold', color: '#D97706', textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#222', marginBottom: 15, marginLeft: 5 },
  contentBox: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 30, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  ingredientRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  bullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D97706', marginRight: 15, marginTop: 7 },
  ingredientText: { fontSize: 15, color: '#444', flex: 1, lineHeight: 22 },
  instructionText: { fontSize: 15, color: '#444', flex: 1, lineHeight: 26 }
});
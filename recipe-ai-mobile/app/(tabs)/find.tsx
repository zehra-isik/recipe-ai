import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import axios from 'axios';
import { useFocusEffect, useNavigation } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

export default function TarifBulScreen() {
  const [step, setStep] = useState(1); 
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tümü');
  
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);

  const navigation = useNavigation();

  const formatTime = (timeStr: string, defaultTime: string) => {
    if (!timeStr) return defaultTime;
    const match = timeStr.match(/\d+/); 
    return match ? `${match[0]} dk` : defaultTime;
  };

  const defaultCategories = [
    'Tümü',
    'Ana Yemekler',
    'Tavuk Yemekleri',
    'Et Yemekleri',
    'Sebze Yemekleri',
    'Çorba Tarifleri',
    'Kahvaltılık Tarifleri',
    'Hamur İşi Tarifleri',
    'Makarna Tarifleri',
    'Pilav Tarifleri',
    'Salata Meze Kanepe',
    'Tatlı Tarifleri',
    'Kek Tarifleri',
    'Kurabiye Tarifleri',
    'Sütlü Tatlı Tarifleri',
  ];

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        setLoading(true);
        try {
          const storedUserId = await AsyncStorage.getItem('userId');
          setUserId(storedUserId);

          const recipesRes = await axios.get(`${API_URL}/recipes`);
          const loadedRecipes = recipesRes.data || [];
          setRecipes(loadedRecipes);

          if (storedUserId) {
            const favsRes = await axios.get(`${API_URL}/users/${storedUserId}/favorites`);
            setFavoriteIds(favsRes.data.map((fav: any) => Number(fav.id)));
          } else {
            setFavoriteIds([]);
          }

          loadedRecipes.forEach(async (recipe: any) => {
            if (!recipe.imageUrl || recipe.imageUrl.trim() === '') {
              const targetUrl = recipe.recipeUrl || recipe.url;
              if (targetUrl) {
                try {
                  const scrapeRes = await axios.post(`${API_URL}/recipes/scrape`, { url: targetUrl });
                  if (scrapeRes.data && scrapeRes.data.imageUrl) {
                    setRecipes(currentRecipes => 
                      currentRecipes.map(r => 
                        Number(r.id) === Number(recipe.id) ? { ...r, imageUrl: scrapeRes.data.imageUrl } : r
                      )
                    );
                  }
                } catch {}
              }
            }
          });

        } catch (error) {
          console.error("Veri çekme hatası:", error);
        } finally {
          setLoading(false);
        }
      };

      loadData();
      
      const unsubscribeTabPress = (navigation as any).addListener('tabPress', (e: any) => {
        if (navigation.isFocused()) {
          setStep(1);
          setSelectedRecipe(null);
        }
      });

      return () => {
        unsubscribeTabPress();
      };
    }, [navigation])
  );

  const toggleFavorite = async (rawRecipeId: any) => {
    if (!userId) {
      Alert.alert("Giriş Yapın", "Tarifleri favorilere eklemek için lütfen giriş yapın.");
      return;
    }

    const recipeId = Number(rawRecipeId);
    if (!recipeId) return;
    
    const isFav = favoriteIds.some(id => Number(id) === recipeId);
    
    setFavoriteIds((prev) => 
      isFav ? prev.filter(id => Number(id) !== recipeId) : [...prev, recipeId]
    );

    setRecipes((prevRecipes) => 
      prevRecipes.map(r => {
        if (Number(r.id) === recipeId) {
          const currentCount = Number(r.favoriteCount || 0);
          const newCount = isFav ? Math.max(currentCount - 1, 0) : currentCount + 1;
          return { ...r, favoriteCount: newCount };
        }
        return r;
      })
    );

    try {
      await axios.post(`${API_URL}/users/${userId}/favorites/${recipeId}`);
    } catch {
      setFavoriteIds((prev) => 
        isFav ? [...prev, recipeId] : prev.filter(id => Number(id) !== recipeId)
      );
      setRecipes((prevRecipes) => 
        prevRecipes.map(r => {
          if (Number(r.id) === recipeId) {
            const currentCount = Number(r.favoriteCount || 0);
            const revertedCount = isFav ? currentCount + 1 : Math.max(currentCount - 1, 0);
            return { ...r, favoriteCount: revertedCount };
          }
          return r;
        })
      );
      Alert.alert("Bağlantı Hatası", "Favori işlemi kaydedilemedi.");
    }
  };

  const handleRecipeClick = async (recipe: any) => {
    setLoading(true);
    try {
      const targetUrl = recipe.recipeUrl || recipe.url;
      if (targetUrl && targetUrl.trim() !== '') {
        const response = await axios.post(`${API_URL}/recipes/scrape`, { url: targetUrl });
        setSelectedRecipe({ ...recipe, ...response.data });
      } else {
        setSelectedRecipe(recipe);
      }
      setStep(2);
    } catch (error) {
      console.error("Kazıma hatası:", error);
      Alert.alert("Bilgi", "Tarif detayları tam çekilemedi, elimizdeki özet bilgiler gösteriliyor.");
      setSelectedRecipe(recipe);
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const dynamicCategories = Array.from(
    new Set(
      recipes
        .map(recipe => recipe.category)
        .filter((category): category is string => Boolean(category) && category !== 'Genel' && !defaultCategories.includes(category))
    )
  );
  const categories = [...defaultCategories, ...dynamicCategories];
  const normalizedSearch = searchQuery.toLowerCase();

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.name?.toLowerCase().includes(normalizedSearch);
    const matchesCategory = selectedCategory === 'Tümü' || recipe.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#FAF4EF' }}>
      
      {step === 1 && (
        <>
          <View style={styles.headerAbsolute}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#5C3D2E" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Mutfak Şefi</Text>
            <TouchableOpacity style={styles.headerIconBtn}>
              <Ionicons name="search" size={20} color="#5C3D2E" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
            
            <Text style={styles.mainHeading}>
              Bugün Ne{'\n'}
              <Text style={styles.mainHeadingItalic}>Pişirmek İstersin?</Text>
            </Text>

            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#A1887F" style={styles.searchIcon} />
              <TextInput 
                style={styles.searchInput} 
                placeholder="Örn: Menemen, Salata..." 
                placeholderTextColor="#A1887F"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              {categories.map(category => {
                const active = selectedCategory === category;

                return (
                  <TouchableOpacity
                    key={category}
                    style={[styles.categoryChip, active && styles.categoryChipActive]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {loading ? (
              <ActivityIndicator size="large" color="#9E4200" style={{ marginTop: 50 }} />
            ) : filteredRecipes.length === 0 ? (
              <Text style={styles.noDataText}>Aramanıza uygun tarif bulunamadı.</Text>
            ) : (
              filteredRecipes.map((recipe, index) => {
                const isFav = favoriteIds.includes(Number(recipe.id));
                const favCount = Number(recipe.favoriteCount || 0);
                
                let dynamicRating = recipe.rating || "0.0";
                if (dynamicRating === "0.0" || !recipe.rating) {
                  dynamicRating = favCount === 0 ? "0.0" : favCount <= 2 ? "4.5" : "5.0";
                }

                return (
                  <TouchableOpacity key={index} style={styles.recipeCard} activeOpacity={0.9} onPress={() => handleRecipeClick(recipe)}>
                    
                    <View style={styles.imageContainer}>
                      <Image 
                        source={{ uri: recipe.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c' }} 
                        style={styles.recipeImage} 
                      />
                      
                      <TouchableOpacity style={styles.newHeartBadge} onPress={() => toggleFavorite(recipe.id)}>
                        <Ionicons name={isFav ? "heart" : "heart"} size={16} color={isFav ? "#E53935" : "#795548"} />
                        <Text style={styles.newHeartText}>{favCount}</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.cardBody}>
                      <View style={styles.titleRow}>
                        <Text style={styles.recipeTitle} numberOfLines={2}>{recipe.name}</Text>
                        <View style={styles.ratingBox}>
                          <Ionicons name="star" size={14} color="#D97706" style={{ marginRight: 4 }} />
                          <Text style={styles.ratingText}>{dynamicRating}</Text>
                        </View>
                      </View>

                      <View style={styles.infoGridRow}>
                        <View style={styles.infoBadge}>
                          <Ionicons name="time-outline" size={14} color="#795548" />
                          <Text style={styles.infoBadgeText}>Haz: {formatTime(recipe.prepTime, '10 dk')}</Text>
                        </View>
                        <View style={styles.infoBadge}>
                          <Ionicons name="flame-outline" size={14} color="#795548" />
                          <Text style={styles.infoBadgeText}>Piş: {formatTime(recipe.cookTime, '15 dk')}</Text>
                        </View>
                        <View style={styles.infoBadge}>
                          <Ionicons name="flash-outline" size={14} color="#795548" />
                          <Text style={styles.infoBadgeText}>{recipe.calories || '500 kcal'}</Text>
                        </View>
                        <View style={styles.infoBadge}>
                          <Ionicons name="restaurant-outline" size={14} color="#795548" />
                          <Text style={styles.infoBadgeText}>{recipe.servings || '4 Kişilik'}</Text>
                        </View>
                      </View>

                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </>
      )}

      {step === 2 && selectedRecipe && (
        <View style={{ flex: 1, backgroundColor: '#F6F6F6' }}>
          
          <View style={styles.detailAbsoluteHeader}>
            <TouchableOpacity style={styles.detailBlackBackButton} onPress={() => setStep(1)}>
              <Ionicons name="chevron-back" size={20} color="#fff" />
              <Text style={styles.detailBlackBackText}>Geri</Text>
            </TouchableOpacity>
            <Text style={styles.detailOrangeHeaderText}>Tarif Detayı</Text>
            
            <TouchableOpacity onPress={() => toggleFavorite(selectedRecipe.id)}>
              <Ionicons 
                name={favoriteIds.some(favId => Number(favId) === Number(selectedRecipe.id)) ? "heart" : "heart-outline"} 
                size={28} 
                color={favoriteIds.some(favId => Number(favId) === Number(selectedRecipe.id)) ? "#E53935" : "#3E2723"} 
              />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>
            <Image source={{ uri: selectedRecipe.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c' }} style={{ width: '100%', height: 350, resizeMode: 'cover' }} />

            <View style={styles.detailSheet}>
              <Text style={styles.detailMainTitle}>{selectedRecipe.name}</Text>

              <View style={styles.detailCardsRow}>
                <View style={styles.detailSmallCard}>
                  <Ionicons name="time-outline" size={28} color="#666" />
                  <Text style={styles.detailCardLabel}>Hazırlık</Text>
                  <Text style={styles.detailCardValue}>{formatTime(selectedRecipe.prepTime, '10 dk')}</Text>
                </View>
                <View style={styles.detailSmallCard}>
                  <Ionicons name="search" size={28} color="#111" />
                  <Text style={styles.detailCardLabel}>Pişirme</Text>
                  <Text style={styles.detailCardValue}>{formatTime(selectedRecipe.cookTime, '15 dk')}</Text>
                </View>
                <View style={styles.detailSmallCard}>
                  <Ionicons name="flame" size={28} color="#FF5722" />
                  <Text style={styles.detailCardLabel}>Enerji</Text>
                  <Text style={styles.detailCardValue}>{selectedRecipe.calories || '502'}</Text>
                </View>
                <View style={styles.detailSmallCard}>
                  <Ionicons name="restaurant-outline" size={28} color="#999" />
                  <Text style={styles.detailCardLabel}>Porsiyon</Text>
                  <Text style={styles.detailCardValue}>{selectedRecipe.servings || '4 Kişilik'}</Text>
                </View>
              </View>

              <Text style={styles.detailSectionTitle}>Gerekli Malzemeler</Text>
              <View style={styles.detailContentBox}>
                {selectedRecipe.scrapedIngredients && selectedRecipe.scrapedIngredients.length > 0 ? (
                  selectedRecipe.scrapedIngredients.map((item: string, idx: number) => (
                    <View key={idx} style={styles.detailIngredientRow}>
                      <View style={styles.detailBullet} />
                      <Text style={styles.detailIngredientText}>{item}</Text>
                    </View>
                  ))
                ) : selectedRecipe.ingredients && selectedRecipe.ingredients.length > 0 ? (
                  selectedRecipe.ingredients.map((item: string, idx: number) => (
                    <View key={idx} style={styles.detailIngredientRow}>
                      <View style={styles.detailBullet} />
                      <Text style={styles.detailIngredientText}>{item}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.detailIngredientText}>Malzemeler yüklenemedi.</Text>
                )}
              </View>

              <Text style={styles.detailSectionTitle}>Nasıl Yapılır?</Text>
              <View style={styles.detailContentBox}>
                {selectedRecipe.instructions ? (
                  selectedRecipe.instructions.split('\n\n').map((stepText: string, idx: number) => {
                    if (!stepText.trim()) return null;
                    return (
                      <View key={idx} style={styles.detailIngredientRow}>
                        <View style={styles.detailBullet} />
                        <Text style={styles.detailInstructionText}>{stepText.trim()}</Text>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.detailInstructionText}>Yapılış adımları bulunamadı.</Text>
                )}
              </View>

            </View>
          </ScrollView>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 100, paddingTop: 110 },
  
  headerAbsolute: { position: 'absolute', top: 50, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, zIndex: 10 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#5C3D2E' },
  headerIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3E5D8', justifyContent: 'center', alignItems: 'center' },

  mainHeading: { fontSize: 32, fontWeight: '900', color: '#3E2723', lineHeight: 38, marginBottom: 15 },
  mainHeadingItalic: { fontStyle: 'italic', color: '#9E4200' },
  greetingSub: { fontSize: 15, color: '#795548', marginBottom: 25 },

  searchContainer: { flexDirection: 'row', backgroundColor: '#FCEFE5', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 12, alignItems: 'center', marginBottom: 25 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, color: '#3E2723' },
  categoryRow: { paddingBottom: 20, gap: 10 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: '#FCEFE5', borderWidth: 1, borderColor: '#E8D2C2' },
  categoryChipActive: { backgroundColor: '#D97706', borderColor: '#D97706' },
  categoryChipText: { color: '#795548', fontSize: 13, fontWeight: '700' },
  categoryChipTextActive: { color: '#fff' },

  noDataText: { textAlign: 'center', color: '#795548', marginTop: 40, fontSize: 15 },

  recipeCard: { backgroundColor: '#fff', borderRadius: 30, marginBottom: 25, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 15, elevation: 4, overflow: 'hidden' },
  imageContainer: { width: '100%', height: 220, position: 'relative' },
  recipeImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  
  newHeartBadge: { position: 'absolute', top: 15, right: 15, backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 },
  newHeartText: { fontWeight: 'bold', fontSize: 13, color: '#3E2723' },

  cardBody: { padding: 20 },
  
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  recipeTitle: { fontSize: 20, fontWeight: 'bold', color: '#3E2723', flex: 1, paddingRight: 10 },
  ratingBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8E1', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  ratingText: { fontSize: 13, fontWeight: 'bold', color: '#FF8F00' },

  infoGridRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  infoBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FCEFE5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 5 },
  infoBadgeText: { fontSize: 12, color: '#9E4200', fontWeight: 'bold' },

  detailAbsoluteHeader: { position: 'absolute', top: 50, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  detailBlackBackButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 25 },
  detailBlackBackText: { color: '#fff', fontWeight: 'bold', fontSize: 15, marginLeft: 4 },
  detailOrangeHeaderText: { color: '#D97706', fontSize: 18, fontWeight: 'bold' },
  detailSheet: { backgroundColor: '#F6F6F6', marginTop: -30, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, flex: 1 },
  detailMainTitle: { fontSize: 28, fontWeight: 'bold', color: '#111', textAlign: 'center', marginBottom: 25, marginTop: 10 },
  detailCardsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 35 },
  detailSmallCard: { backgroundColor: '#fff', width: '23%', borderRadius: 15, paddingVertical: 18, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  detailCardLabel: { fontSize: 11, color: '#8E8E93', marginTop: 8, marginBottom: 4 },
  detailCardValue: { fontSize: 12, fontWeight: 'bold', color: '#D97706', textAlign: 'center' },
  detailSectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#222', marginBottom: 15, marginLeft: 5 },
  detailContentBox: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 30, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  detailIngredientRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  detailBullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D97706', marginRight: 15, marginTop: 7 }, 
  detailIngredientText: { fontSize: 15, color: '#444', flex: 1, lineHeight: 22 },
  detailInstructionText: { fontSize: 15, color: '#444', flex: 1, lineHeight: 26 },
});

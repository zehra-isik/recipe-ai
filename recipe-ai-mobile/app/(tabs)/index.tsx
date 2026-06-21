import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useNavigation } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

export default function HomeScreen() {
  const [step, setStep] = useState(1); 
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [newIngredient, setNewIngredient] = useState('');
  const [recipes, setRecipes] = useState<any[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const navigation = useNavigation();

  const formatTime = (timeStr: any, defaultTime: string) => {
    if (!timeStr || typeof timeStr !== 'string') return defaultTime;
    const match = timeStr.match(/\d+/); 
    return match ? `${match[0]} dk` : defaultTime;
  };

  const fetchFavorites = async (currentUserId: string) => {
    try {
      const res = await axios.get(`${API_URL}/users/${currentUserId}/favorites`);
      setFavoriteIds(res.data.map((fav: any) => Number(fav.id)));
    } catch { 
      console.log("Favoriler yüklenemedi"); 
    }
  };

  useFocusEffect(
    useCallback(() => {
      const checkAuth = async () => {
        const storedUserId = await AsyncStorage.getItem('userId');
        setUserId(storedUserId);
        if (storedUserId) {
          fetchFavorites(storedUserId);
        } else {
          setFavoriteIds([]); 
        }
      };
      checkAuth();
    }, [])
  );

  useEffect(() => {
    const unsubscribeTabPress = (navigation as any).addListener('tabPress', (e: any) => {
      if (navigation.isFocused()) {
        setStep(1);
        setImages([]);
        setIngredients([]);
        setRecipes([]);
        setSelectedRecipe(null);
      }
    });
    return unsubscribeTabPress;
  }, [navigation]);

  const toggleFavorite = async (rawRecipeId: any) => {
    if (!userId) {
      Alert.alert("Giriş Yapın", "Favorilere eklemek için lütfen giriş yapın.");
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

  const showImageSourceOptions = () => {
    Alert.alert(
      "Malzeme Fotoğrafı Ekle",
      "Fotoğrafı nasıl yüklemek istersin?",
      [
        { text: "Kamerayı Aç", onPress: () => handleImagePick('camera') },
        { text: "Galeriden Seç", onPress: () => handleImagePick('gallery') },
        { text: "İptal", style: "cancel" }
      ]
    );
  };

  const handleImagePick = async (mode: 'camera' | 'gallery') => {
    let result;
    const imageOptions: ImagePicker.ImagePickerOptions = { allowsEditing: true, quality: 0.2 };
    if (mode === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return Alert.alert("Hata", "Kamera izni vermeniz gerekiyor.");
      result = await ImagePicker.launchCameraAsync(imageOptions);
    } else {
      result = await ImagePicker.launchImageLibraryAsync(imageOptions);
    }
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImages([...images, result.assets[0].uri]);
    }
  };

  const removeImage = (uri: string) => setImages(images.filter(img => img !== uri));

  const handleAnalyzeImages = async () => {
    if (images.length === 0) return Alert.alert("Uyarı", "Lütfen fotoğraf ekleyin.");
    setLoading(true);
    const formData = new FormData();
    images.forEach((uri, index) => {
      formData.append('files', { uri, name: `img_${index}.jpg`, type: 'image/jpeg' } as any);
    });
    try {
      const response = await axios.post(`${API_URL}/recipes/detect`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', 'Accept': 'application/json' },
        timeout: 60000,
      });
      setIngredients(response.data.detectedIngredients || []);
      setStep(3);
    } catch {
      Alert.alert("Bilgi", "Görsel analiz tamamlanamadı. Elle malzeme girebilirsiniz.");
      setStep(3);
    } finally {
      setLoading(false);
    }
  };

  const handleGetRecipes = async () => {
    if (ingredients.length === 0) return Alert.alert("Uyarı", "Lütfen malzeme ekleyin.");
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/recipes/match`, { ingredients });
      const matchedRecipes = response.data.recipes || [];
      setRecipes(matchedRecipes);
      setStep(4);

      matchedRecipes.forEach(async (recipe: any) => {
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
            } catch {
              console.log("Resim arka planda çekilemedi:", recipe.name);
            }
          }
        }
      });

    } catch {
      Alert.alert("Hata", "Tarifler getirilemedi.");
    } finally {
      setLoading(false);
    }
  };

  const addIngredientManually = () => {
    if (newIngredient.trim() !== '') {
      const clean = newIngredient.trim().toLowerCase();
      if (!ingredients.includes(clean)) setIngredients([...ingredients, clean]);
      setNewIngredient('');
    }
  };
  const removeIngredientTag = (index: number) => setIngredients(ingredients.filter((_, i) => i !== index));

  const showDeliveryOptions = () => {
    Alert.alert("Eksikleri Tamamla", "Hangi uygulamayı açalım?", [
      { text: "Getir", onPress: () => openDeliveryApp('getir://', 'https://getir.com') },
      { text: "Yemeksepeti", onPress: () => openDeliveryApp('yemeksepeti://', 'https://www.yemeksepeti.com') },
      { text: "Vazgeç", style: "cancel" }
    ]);
  };

  const openDeliveryApp = async (appUrl: string, webUrl: string) => {
    try {
      const isSupported = await Linking.canOpenURL(appUrl);
      if (isSupported) await Linking.openURL(appUrl);
      else await Linking.openURL(webUrl);
    } catch {
      await Linking.openURL(webUrl);
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
      setStep(5);
    } catch (error) {
      console.error("Kazıma hatası:", error);
      Alert.alert("Bilgi", "Tarif detayları çekilemedi, özet bilgiler gösteriliyor.");
      setSelectedRecipe(recipe);
      setStep(5);
    } finally {
      setLoading(false);
    }
  };

  const getIngredientImage = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('domates')) return 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=100&q=80';
    if (lower.includes('yumurta')) return 'https://images.unsplash.com/photo-1587486913049-53fc88980cfc?w=100&q=80';
    if (lower.includes('süt')) return 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=100&q=80';
    if (lower.includes('peynir')) return 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=100&q=80';
    if (lower.includes('biber')) return 'https://images.unsplash.com/photo-1604543519952-12494957e627?w=100&q=80'; 
    if (lower.includes('soğan')) return 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=100&q=80';
    if (lower.includes('sarımsak')) return 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=100&q=80';
    if (lower.includes('havuç')) return 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=100&q=80';
    if (lower.includes('patates')) return 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=100&q=80';
    if (lower.includes('patlıcan')) return 'https://images.unsplash.com/photo-1606554558509-f6ba62b92a39?w=100&q=80';
    if (lower.includes('mantar')) return 'https://images.unsplash.com/photo-1511690078903-71dc5a49f5e3?w=100&q=80';
    if (lower.includes('tavuk')) return 'https://images.unsplash.com/photo-1604503468306-202f9df2ce25?w=100&q=80';
    if (lower.includes('et') || lower.includes('kıyma')) return 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=100&q=80';
    if (lower.includes('zeytin') || lower.includes('yağ')) return 'https://images.unsplash.com/photo-1550502120-d1e9e0486c8f?w=100&q=80';
    if (lower.includes('tuz') || lower.includes('baharat')) return 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=100&q=80';
    return 'https://images.unsplash.com/photo-1556910110-a5a63dfd393c?w=100&q=80'; 
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FAF4EF' }}>
      
      {step < 5 && (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          
          {step === 1 && (
            <>
              <View style={styles.header}>
                <TouchableOpacity><Ionicons name="menu" size={28} color="#5C3D2E" /></TouchableOpacity>
                <Text style={styles.headerTitle}>Mutfak Şefi</Text>
                <TouchableOpacity><Ionicons name="notifications" size={24} color="#D97706" /></TouchableOpacity>
              </View>
              
              <Text style={styles.greetingTitle}>
                Elimizdekilerle{'\n'}
                <Text style={styles.greetingTitleItalic}>Neler Yapabiliriz?</Text>
              </Text>
              <Text style={styles.greetingSub}>Mutfaktaki malzemelerinle harikalar yarat.</Text>

              <TouchableOpacity style={styles.heroCard} activeOpacity={0.9} onPress={() => setStep(2)}>
                <View style={styles.cameraIconContainer}><Ionicons name="camera" size={28} color="#fff" /></View>
                <Text style={styles.heroTitle}>Malzeme Fotoğrafı Çek</Text>
                <Text style={styles.heroSub}>Dolabındaki malzemeleri tara, şefin sana özel tarifler önersin.</Text>
              </TouchableOpacity>

              <View style={styles.howItWorksCard}>
                <Text style={styles.howItWorksTitle}>Nasıl Çalışır?</Text>
                <View style={styles.howItWorksStep}>
                  <View style={styles.stepNumberBadge}><Text style={styles.stepNumberText}>1</Text></View>
                  <View style={styles.stepTextContainer}>
                    <Text style={styles.stepTitle}>Malzemeleri Tara</Text>
                    <Text style={styles.stepDescription}>Dolabındaki veya tezgahındaki malzemelerin fotoğrafını çek.</Text>
                  </View>
                </View>
                <View style={styles.howItWorksStep}>
                  <View style={styles.stepNumberBadge}><Text style={styles.stepNumberText}>2</Text></View>
                  <View style={styles.stepTextContainer}>
                    <Text style={styles.stepTitle}>Şefin Önerisini Al</Text>
                    <Text style={styles.stepDescription}>Yapay zeka, elindeki malzemelerle yapabileceğin en iyi tarifleri süzsün.</Text>
                  </View>
                </View>
                <View style={styles.howItWorksStep}>
                  <View style={styles.stepNumberBadge}><Text style={styles.stepNumberText}>3</Text></View>
                  <View style={styles.stepTextContainer}>
                    <Text style={styles.stepTitle}>Pişirmeye Başla</Text>
                    <Text style={styles.stepDescription}>Adım adım talimatlarla profesyonel bir şef gibi yemeğini hazırla.</Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {step === 2 && (
            <View style={styles.fullWidth}>
              <View style={styles.headerBackRow}>
                <TouchableOpacity onPress={() => { setStep(1); setImages([]); }}><Ionicons name="arrow-back" size={26} color="#3E2723" /></TouchableOpacity>
                <Text style={styles.innerPageTitle}>Malzemeleri Ekle</Text>
                <View style={{ width: 26 }} />
              </View>
              <Text style={styles.subtitleText}>İster anlık çek, ister galeriden yükle. Birden fazla görsel ekleyebilirsin.</Text>
              <TouchableOpacity style={styles.addPhotoDashedBox} onPress={showImageSourceOptions}>
                <Ionicons name="camera-reverse-outline" size={44} color="#D97706" />
                <Text style={styles.addPhotoBoxText}>Fotoğraf Çek veya Görsel Yükle</Text>
              </TouchableOpacity>
              {images.length > 0 && (
                <View style={styles.thumbnailContainer}>
                  {images.map((uri, index) => (
                    <View key={index} style={styles.imageWrapper}>
                      <Image source={{ uri }} style={styles.thumbnailImage} />
                      <TouchableOpacity style={styles.removeImageBadge} onPress={() => removeImage(uri)}><Ionicons name="close" size={14} color="#fff" /></TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <TouchableOpacity style={[styles.primaryActionButton, { opacity: images.length > 0 ? 1 : 0.6, marginTop: 30 }]} onPress={handleAnalyzeImages} disabled={loading || images.length === 0}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryActionButtonText}>Görselleri Analiz Et →</Text>}
              </TouchableOpacity>
            </View>
          )}

          {step === 3 && (
            <View style={styles.fullWidth}>
              <View style={styles.headerBackRow}>
                <TouchableOpacity onPress={() => setStep(2)}>
                  <Ionicons name="arrow-back" size={26} color="#3E2723" />
                </TouchableOpacity>
                <Text style={styles.innerPageTitle}>Mutfak Şefi</Text>
                <View style={{ width: 26 }} />
              </View>

              <Text style={styles.verifyTitle}>Malzemeleri{'\n'}Doğrulayalım</Text>
              <Text style={styles.verifySubtitle}>
                Görüntüden tespit edilen malzemeler aşağıdadır. Eksikleri ekleyebilir veya düzenleyebilirsiniz.
              </Text>

              <View style={styles.verifyInputBox}>
                <Ionicons name="search" size={20} color="#A1887F" style={styles.verifySearchIcon} />
                <TextInput 
                  style={styles.verifyTextInput} 
                  placeholder="Yeni malzeme ekle..." 
                  placeholderTextColor="#A1887F" 
                  value={newIngredient} 
                  onChangeText={setNewIngredient} 
                />
                <TouchableOpacity style={styles.verifyAddBtn} onPress={addIngredientManually}>
                  <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <Text style={styles.detectedLabel}>TESPİT EDİLENLER</Text>

              {ingredients.map((item, index) => (
                <View key={index} style={styles.ingredientListCard}>
                  <Ionicons name="checkmark-circle" size={26} color="#D97706" style={{ marginRight: 12 }} />
                  <Image source={{ uri: getIngredientImage(item) }} style={styles.ingredientListImage} />
                  <Text style={styles.ingredientListText}>{item}</Text>
                  
                  <TouchableOpacity onPress={() => removeIngredientTag(index)} style={styles.ingredientTrashBtn}>
                    <Ionicons name="trash" size={20} color="#BCAAA4" />
                  </TouchableOpacity>
                </View>
              ))}

              {ingredients.length > 0 && (
                <View style={styles.verifyInfoBox}>
                  <Ionicons name="bulb" size={22} color="#5C3D2E" />
                  <Text style={styles.verifyInfoText}>
                    Bu malzemelerle şu an yapabileceğiniz onlarca farklı tarifimiz bulunuyor.
                  </Text>
                </View>
              )}

              <TouchableOpacity style={styles.verifySubmitBtn} onPress={handleGetRecipes} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.verifySubmitBtnText}>Tarifleri Gör</Text>
                    <Ionicons name="restaurant-outline" size={20} color="#fff" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {step === 4 && (
            <View style={styles.fullWidth}>
              <View style={styles.headerBackRow}>
                <TouchableOpacity onPress={() => setStep(3)}><Ionicons name="arrow-back" size={26} color="#3E2723" /></TouchableOpacity>
                <Text style={styles.innerPageTitle}>Ne Pişirebiliriz?</Text>
                <View style={{ width: 26 }} />
              </View>

              {loading && <ActivityIndicator size="large" color="#D97706" style={{ marginVertical: 20 }} />}

              {!loading && recipes.length === 0 ? (
                <Text style={styles.noRecipesFoundText}>Uygun tarif bulunamadı. Lütfen daha fazla malzeme ekleyin.</Text>
              ) : (
                !loading && recipes.map((recipe: any, index: number) => {
                  const hasMissing = recipe.missingIngredients && recipe.missingIngredients.length > 0;
                  
                  const isFav = favoriteIds.some(favId => Number(favId) === Number(recipe.id));
                  const favCount = Number(recipe.favoriteCount || 0);
                  
                  const totalIng = recipe.ingredients ? recipe.ingredients.length : 1;
                  const matchedIng = recipe.matchCount || 0;
                  const calculatedMatch = Math.round((matchedIng / totalIng) * 100);
                  
                  let dynamicRating = recipe.rating || "0.0";
                  if (dynamicRating === "0.0" || !recipe.rating) {
                    dynamicRating = favCount === 1 ? "4.5" : favCount >= 2 ? "5.0" : "0.0";
                  }
                  
                  return (
                    <TouchableOpacity key={index} style={styles.premiumRecipeCard} activeOpacity={0.9} onPress={() => handleRecipeClick(recipe)}>
                      <View style={styles.cardImageContainer}>
                        <Image source={{ uri: recipe.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c' }} style={styles.premiumCardImage} />
                        
                        <View style={styles.matchPercentageBadge}>
                          <Text style={styles.matchPercentageText}>{calculatedMatch}% EŞLEŞME</Text>
                        </View>
                        
                        <TouchableOpacity style={styles.cardHeartCircle} onPress={() => toggleFavorite(recipe.id)}>
                          <Ionicons name={isFav ? "heart" : "heart-outline"} size={22} color={isFav ? "#E53935" : "#3E2723"} />
                        </TouchableOpacity>
                      </View>
                      
                      <View style={styles.premiumCardBody}>
                        <View style={styles.titleRatingRow}>
                          <Text style={styles.premiumRecipeTitle}>{recipe.name}</Text>
                          <Text style={styles.premiumRecipeRating}>★ {dynamicRating}</Text>
                        </View>
                        <View style={styles.cardBadgesRow}>
                          {recipe.matchedIngredients?.slice(0, 2).map((ing: string, idx: number) => (
                            <View key={idx} style={styles.matchedBadgeItem}><Text style={styles.matchedBadgeItemText}>{ing}</Text></View>
                          ))}
                          {hasMissing && (
                            <View style={styles.missingBadgeItem}><Text style={styles.missingBadgeItemText}>{recipe.missingIngredients.length} Eksik</Text></View>
                          )}
                        </View>
                        {hasMissing && (
                          <TouchableOpacity style={styles.deliveryActionButton} onPress={showDeliveryOptions} activeOpacity={0.8}>
                            <FontAwesome5 name="shopping-basket" size={14} color="#B91C1C" />
                            <Text style={styles.deliveryActionButtonText}>Eksikleri Tamamla →</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      )}

      {step === 5 && selectedRecipe && (
        <View style={{ flex: 1, backgroundColor: '#F6F6F6' }}>
          
          <View style={styles.detailAbsoluteHeader}>
            <TouchableOpacity style={styles.detailBlackBackButton} onPress={() => setStep(4)}>
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
                  String(selectedRecipe.instructions).split('\n\n').map((stepText: string, idx: number) => {
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
  container: { flexGrow: 1, backgroundColor: '#FAF4EF', paddingHorizontal: 20, paddingBottom: 40, paddingTop: 60 },
  fullWidth: { width: '100%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#5C3D2E' },
  headerBackRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  innerPageTitle: { fontSize: 20, fontWeight: 'bold', color: '#3E2723', textAlign: 'center' },
  
  greetingTitle: { fontSize: 32, fontWeight: '900', color: '#3E2723', letterSpacing: -1, lineHeight: 38 },
  greetingTitleItalic: { fontStyle: 'italic', color: '#9E4200' },
  
  greetingSub: { fontSize: 16, color: '#795548', marginTop: 10, marginBottom: 25 },
  subtitleText: { fontSize: 15, color: '#795548', lineHeight: 22, marginBottom: 25 },
  
  heroCard: { backgroundColor: '#D97706', borderRadius: 30, padding: 25, shadowColor: '#D97706', shadowOpacity: 0.4, shadowRadius: 15, elevation: 8, marginBottom: 35 },
  cameraIconContainer: { backgroundColor: 'rgba(255,255,255,0.2)', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 15, lineHeight: 22 },

  howItWorksCard: { backgroundColor: '#FCEFE5', borderRadius: 30, padding: 25, marginTop: 10, marginBottom: 30 },
  howItWorksTitle: { fontSize: 20, fontWeight: 'bold', color: '#3E2723', textAlign: 'center', marginBottom: 25 },
  howItWorksStep: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  stepNumberBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3E5D8', justifyContent: 'center', alignItems: 'center', marginRight: 15, marginTop: 2 },
  stepNumberText: { fontSize: 16, fontWeight: 'bold', color: '#5C3D2E' },
  stepTextContainer: { flex: 1 },
  stepTitle: { fontSize: 16, fontWeight: 'bold', color: '#3E2723', marginBottom: 4 },
  stepDescription: { fontSize: 14, color: '#795548', lineHeight: 20 },

  addPhotoDashedBox: { width: '100%', height: 150, borderStyle: 'dashed', borderWidth: 2, borderColor: '#D97706', borderRadius: 25, backgroundColor: '#FFFDFB', justifyContent: 'center', alignItems: 'center', marginBottom: 25 },
  addPhotoBoxText: { marginTop: 12, color: '#D97706', fontWeight: 'bold', fontSize: 15 },
  thumbnailContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 10 },
  imageWrapper: { position: 'relative', width: 95, height: 95 },
  thumbnailImage: { width: '100%', height: '100%', borderRadius: 18, resizeMode: 'cover' },
  removeImageBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: 'rgba(217, 30, 30, 0.9)', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },
  primaryActionButton: { backgroundColor: '#D97706', borderRadius: 30, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', shadowColor: '#D97706', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  primaryActionButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  verifyTitle: { fontSize: 36, fontWeight: '900', color: '#3E2723', letterSpacing: -1, lineHeight: 42 },
  verifySubtitle: { fontSize: 15, color: '#795548', lineHeight: 22, marginTop: 10, marginBottom: 30 },
  verifyInputBox: { flexDirection: 'row', backgroundColor: '#FCEFE5', borderRadius: 15, padding: 6, alignItems: 'center', marginBottom: 30 },
  verifySearchIcon: { marginLeft: 15, marginRight: 5 },
  verifyTextInput: { flex: 1, fontSize: 16, color: '#3E2723', paddingVertical: 12 },
  verifyAddBtn: { backgroundColor: '#794F1A', width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  detectedLabel: { fontSize: 13, fontWeight: 'bold', color: '#A1887F', letterSpacing: 1, marginBottom: 15 },
  ingredientListCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 30, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  ingredientListImage: { width: 44, height: 44, borderRadius: 22, marginRight: 15, backgroundColor: '#F0E5D8' },
  ingredientListText: { fontSize: 16, fontWeight: '600', color: '#3E2723', flex: 1, textTransform: 'capitalize' },
  ingredientTrashBtn: { padding: 8, marginRight: 5 },
  verifyInfoBox: { flexDirection: 'row', backgroundColor: '#FDECE2', padding: 15, borderRadius: 12, marginTop: 15, marginBottom: 30, alignItems: 'center' },
  verifyInfoText: { fontSize: 14, color: '#3E2723', flex: 1, marginLeft: 12, lineHeight: 20 },
  verifySubmitBtn: { flexDirection: 'row', backgroundColor: '#D97706', borderRadius: 30, paddingVertical: 18, justifyContent: 'center', alignItems: 'center', gap: 10 },
  verifySubmitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  noRecipesFoundText: { textAlign: 'center', color: '#795548', marginTop: 40, fontSize: 15 },
  
  premiumRecipeCard: { backgroundColor: '#fff', borderRadius: 30, marginBottom: 25, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 15, elevation: 4, overflow: 'hidden' },
  cardImageContainer: { width: '100%', height: 220, position: 'relative' },
  premiumCardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  matchPercentageBadge: { position: 'absolute', top: 15, left: 15, backgroundColor: '#C06B16', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  matchPercentageText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  cardHeartCircle: { position: 'absolute', top: 15, right: 15, backgroundColor: 'rgba(255,255,255,0.7)', width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  premiumCardBody: { padding: 20 },
  titleRatingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  premiumRecipeTitle: { fontSize: 20, fontWeight: 'bold', color: '#3E2723', flex: 1, paddingRight: 10 },
  premiumRecipeRating: { fontSize: 15, fontWeight: 'bold', color: '#3E2723' },
  cardBadgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  matchedBadgeItem: { backgroundColor: '#F3E5D8', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  matchedBadgeItemText: { fontSize: 12, color: '#5C3D2E', fontWeight: '600' },
  missingBadgeItem: { backgroundColor: '#FDECE2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  missingBadgeItemText: { fontSize: 12, color: '#9E0000', fontWeight: 'bold' },
  
  deliveryActionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 15, paddingVertical: 12, marginTop: 15, gap: 8 },
  deliveryActionButtonText: { color: '#B91C1C', fontSize: 13, fontWeight: 'bold' },

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

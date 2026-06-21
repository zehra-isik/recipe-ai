import { MaterialIcons } from '@expo/vector-icons';
import { API_URL } from '@/constants/api';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickProfileImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert("İzin Gerekli", "Profil fotoğrafı seçebilmek için galeri erişimine izin vermeniz gerekiyor.");
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], 
        quality: 0.3, 
        base64: true, 
      });

      if (!result.canceled && result.assets && result.assets.length > 0 && result.assets[0].base64) {
        setProfileImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (error) {
      console.error("Fotoğraf seçme hatası:", error);
      Alert.alert("Hata", "Galeri açılırken bir sorun oluştu.");
    }
  };

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Uyarı", "Lütfen adınızı, e-posta adresinizi ve şifrenizi girin.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Uyarı", "Şifreniz en az 6 karakter olmalıdır.");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/users/register`, {
        name,
        email,
        phone,
        password,
        profileImage, 
      });

      if (response.data) {
        Alert.alert("Hoş Geldiniz 🎉", "Hesabınız başarıyla oluşturuldu! Şimdi giriş yapabilirsiniz.");
        router.back();
      }
    } catch (error: any) {
      console.error("Kayıt hatası:", error);
      if (error.response && error.response.data && error.response.data.message) {
        Alert.alert("Kayıt Başarısız", error.response.data.message);
      } else {
        Alert.alert("Hata", "Kayıt olurken bir sunucu hatası oluştu.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView 
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            
            <View style={styles.card}>
              
              <Text style={styles.title}>Hesap Oluştur</Text>
              <Text style={styles.subtitle}>
                Lezzet dünyasına katılmak için{'\n'}bilgilerinizi girin.
              </Text>

              <View style={styles.avatarContainer}>
                <Image 
                  source={{ uri: profileImage || 'https://cdn-icons-png.flaticon.com/512/3414/3414100.png' }} 
                  style={styles.avatar} 
                />
                <TouchableOpacity style={styles.cameraBadge} onPress={pickProfileImage}>
                  <MaterialIcons name="photo-camera" size={16} color="#fff" />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Ad Soyad</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Adınız Soyadınız" 
                placeholderTextColor="#CDB09B"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>E-posta Adresi</Text>
              <TextInput 
                style={styles.input} 
                placeholder="ornek@mutfak.com" 
                placeholderTextColor="#CDB09B"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />

              <Text style={styles.label}>Telefon Numarası</Text>
              <TextInput 
                style={styles.input} 
                placeholder="05xx xxx xx xx" 
                placeholderTextColor="#CDB09B"
                keyboardType="phone-pad"
                maxLength={11}
                value={phone}
                onChangeText={setPhone}
              />

              <Text style={styles.label}>Şifre</Text>
              <TextInput 
                style={styles.input} 
                placeholder="••••••••" 
                placeholderTextColor="#CDB09B"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              <TouchableOpacity style={styles.registerButton} onPress={handleRegister} disabled={loading} activeOpacity={0.8}>
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.registerButtonText}>Kayıt Ol</Text>
                )}
              </TouchableOpacity>

              <View style={styles.loginContainer}>
                <Text style={styles.loginText}>Zaten hesabınız var mı? </Text>
                <TouchableOpacity onPress={() => router.back()}>
                  <Text style={styles.loginLink}>Giriş Yapın.</Text>
                </TouchableOpacity>
              </View>

            </View>

          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF4EF', 
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40, 
  },
  card: {
    backgroundColor: '#fff',
    width: '100%',
    borderRadius: 40,
    paddingHorizontal: 30,
    paddingVertical: 40,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#3E2723',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#8D6E63',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
    fontWeight: '500',
  },
  avatarContainer: {
    alignSelf: 'center',
    position: 'relative',
    marginBottom: 30,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#FDF6F0',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#D97706',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3E2723',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#FDF6F0', 
    borderRadius: 15,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 16,
    color: '#3E2723',
    marginBottom: 18,
    fontWeight: '500',
  },
  registerButton: {
    backgroundColor: '#D97706',
    borderRadius: 30,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#D97706',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 25,
  },
  loginText: {
    fontSize: 14,
    color: '#8D6E63',
    fontWeight: '500',
  },
  loginLink: {
    fontSize: 14,
    color: '#A0522D',
    fontWeight: 'bold',
  },
});

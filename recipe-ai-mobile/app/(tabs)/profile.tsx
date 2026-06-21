import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/api';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';

export default function ProfileScreen() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useFocusEffect(
    useCallback(() => {
      checkAuthAndFetchProfile();
    }, [])
  );

  const checkAuthAndFetchProfile = async () => {
    setPageLoading(true);
    try {
      const storedUserId = await AsyncStorage.getItem('userId');
      if (!storedUserId) {
        setIsLoggedIn(false);
        setPageLoading(false);
        return;
      }

      setUserId(storedUserId);
      setIsLoggedIn(true);

      const response = await axios.get(`${API_URL}/users/${storedUserId}`);
      if (response.data) {
        setName(response.data.name || response.data.username || '');
        setEmail(response.data.email || '');
        setPhone(response.data.phone || '');
        setProfileImage(response.data.profileImage || response.data.avatar || null);
      }
    } catch (error) {
      console.error("Profil bilgileri çekilemedi:", error);
    } finally {
      setPageLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) return Alert.alert("Uyarı", "Lütfen e-posta ve şifrenizi girin.");
    setLoginLoading(true);
    try {
      const response = await axios.post(`${API_URL}/users/login`, { email: loginEmail.toLowerCase(), password: loginPassword });
      if (response.data && response.data.id) {
        await AsyncStorage.setItem('userId', response.data.id.toString());
        setLoginEmail(''); setLoginPassword('');
        checkAuthAndFetchProfile();
      }
    } catch (error: any) {
      Alert.alert("Giriş Başarısız", error.response?.data?.message || "Sunucuya bağlanılamadı.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (!loginEmail) {
      Alert.alert("Bilgi", "Lütfen önce e-posta adresinizi girin, ardından şifre sıfırlama bağlantısı göndereceğiz.");
      return;
    }
    Alert.alert("Bağlantı Gönderildi", `${loginEmail} adresine şifre sıfırlama talimatları iletildi.`);
  };

  const handleGoogleLogin = () => Alert.alert("Bilgi", "Google API ayarlanmadı.");
  const handleFacebookLogin = () => Alert.alert("Bilgi", "Facebook API ayarlanmadı.");

  const handleLogout = () => {
    Alert.alert("Çıkış Yap", "Hesabınızdan çıkmak istediğinize emin misiniz?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Çıkış Yap", style: "destructive", onPress: async () => {
          await AsyncStorage.removeItem('userId');
          setIsLoggedIn(false);
          setName(''); setEmail(''); setPhone(''); setProfileImage(null); setPassword(''); setConfirmPassword('');
        }
      }
    ]);
  };

  const handlePhoneChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    setPhone(numericValue);
  };

  const handleSave = async () => {
    if (password && password !== confirmPassword) {
      Alert.alert("Hata", "Girdiğiniz şifreler birbiriyle eşleşmiyor!");
      return;
    }
    setSaveLoading(true);
    try {
      await axios.put(`${API_URL}/users/${userId}`, {
        name,
        email,
        phone,
        profileImage,
        password: password !== '' ? password : undefined
      });
      Alert.alert("Başarılı 🎉", "Profil bilgileriniz başarıyla güncellendi.");
      setPassword('');
      setConfirmPassword('');
    } catch {
      Alert.alert("Hata", "Kaydedilirken bir hata oluştu.");
    } finally {
      setSaveLoading(false);
    }
  };

  const pickProfileImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3,
      base64: true
    });
    if (!result.canceled && result.assets && result.assets[0].base64) {
      setProfileImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  if (pageLoading) return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator size="large" color="#D97706" /></View>;

  if (!isLoggedIn) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={styles.loginCard}>

              <Text style={styles.title}>Hoş Geldiniz</Text>
              <Text style={styles.subtitle}>Devam etmek için giriş yapın veya{'\n'}hesap oluşturun.</Text>

              <Text style={styles.label}>E-posta Adresi</Text>
              <TextInput
                style={styles.input} placeholder="ornek@mutfak.com" placeholderTextColor="#CDB09B"
                value={loginEmail} onChangeText={setLoginEmail} autoCapitalize="none" keyboardType="email-address"
              />

              <View style={styles.passwordHeader}>
                <Text style={styles.label}>Şifre</Text>
                <TouchableOpacity onPress={handleForgotPassword}>
                  <Text style={styles.forgotPasswordText}>Şifremi Unuttum</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input} placeholder="••••••••" placeholderTextColor="#CDB09B"
                value={loginPassword} onChangeText={setLoginPassword} secureTextEntry
              />

              <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={loginLoading}>
                {loginLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Giriş Yap</Text>}
              </TouchableOpacity>

              <View style={styles.dividerContainer}>
                <View style={styles.line} /><Text style={styles.dividerText}>veya şununla devam et</Text><View style={styles.line} />
              </View>

              <View style={styles.socialContainer}>
                <TouchableOpacity style={styles.socialButton} onPress={handleGoogleLogin} activeOpacity={0.7}>
                  <FontAwesome5 name="google" size={18} color="#4285F4" /><Text style={styles.socialButtonText}>Google</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.socialButton} onPress={handleFacebookLogin} activeOpacity={0.7}>
                  <FontAwesome5 name="facebook" size={18} color="#3b5998" /><Text style={styles.socialButtonText}>Facebook</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.registerContainer}>
                <Text style={{ color: '#8D6E63', fontWeight: '500' }}>Hesabınız yok mu? </Text>
                <TouchableOpacity onPress={() => router.push('/register' as any)}>
                  <Text style={{ color: '#A0522D', fontWeight: 'bold' }}>Hesap oluşturun.</Text>
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.keyboardAvoid} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.profileScrollContainer} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={26} color="#5C3D2E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mutfak Şefi</Text>
          <View style={{ width: 26 }} />
        </View>

              <Text style={styles.pageTitle}>
                <Text style={styles.pageTitle}>Kişisel Bilgiler</Text>
              </Text>
        <Text style={styles.pageSubtitle}>Profilinizi buradan güncelleyebilirsiniz</Text>

        <View style={styles.avatarContainer}>
          <View style={styles.avatarWrapper}>
            <Image
              source={{ uri: profileImage || 'https://cdn-icons-png.flaticon.com/512/4140/4140048.png' }}
              style={styles.avatarImage}
            />
            <TouchableOpacity style={styles.cameraBadge} onPress={pickProfileImage} activeOpacity={0.8}>
              <Ionicons name="camera" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formCard}>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Ad-Soyad</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              editable={true}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>E-posta</Text>
            <TextInput
              style={styles.textInput}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={true}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Telefon Numarası</Text>
            <TextInput
              style={styles.textInput}
              value={phone}
              onChangeText={handlePhoneChange}
              keyboardType="numeric"
              maxLength={11}
              placeholder="05xxxxxxxxx"
              placeholderTextColor="#CDB09B"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Yeni Şifre</Text>
            <TextInput
              style={styles.textInput}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor="#CDB09B"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Şifre Tekrar</Text>
            <TextInput
              style={styles.textInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor="#CDB09B"
            />
          </View>

        </View>

        <TouchableOpacity style={styles.saveProfileBtn} onPress={handleSave} disabled={saveLoading} activeOpacity={0.8}>
          {saveLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveProfileBtnText}>Bilgileri Kaydet</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutProfileBtn} onPress={handleLogout}>
          <Text style={styles.logoutProfileBtnText}>Çıkış Yap</Text>
        </TouchableOpacity>

        <View style={styles.notificationCard}>
          <View style={styles.notificationIconWrapper}>
            <Ionicons name="notifications" size={24} color="#D97706" />
          </View>
          <View style={styles.notificationTextWrapper}>
            <Text style={styles.notificationTitle}>Bildirim Tercihleri</Text>
            <Text style={styles.notificationDesc}>
              Yeni tarifler ve şef önerileri hakkında bildirim almak istiyor musunuz?
            </Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#D7CCC8', true: '#D97706' }}
            thumbColor="#fff"
          />
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF4EF', paddingHorizontal: 20 },
  keyboardAvoid: { flex: 1, backgroundColor: '#FAF4EF' },

  loginCard: { backgroundColor: '#fff', borderRadius: 40, padding: 30, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15, elevation: 5 },
  title: { fontSize: 32, fontWeight: '900', color: '#3E2723', textAlign: 'center', marginBottom: 10, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: '#8D6E63', textAlign: 'center', marginBottom: 35, lineHeight: 24, fontWeight: '500' },
  label: { fontSize: 14, fontWeight: '700', color: '#3E2723', marginBottom: 8, marginLeft: 4 },
  passwordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  forgotPasswordText: { fontSize: 13, fontWeight: '600', color: '#A0522D', marginBottom: 8, marginRight: 4 },
  input: { backgroundColor: '#FDF6F0', borderRadius: 15, paddingHorizontal: 20, paddingVertical: 18, fontSize: 16, color: '#3E2723', marginBottom: 20, fontWeight: '500' },
  primaryButton: { backgroundColor: '#D97706', borderRadius: 30, paddingVertical: 18, alignItems: 'center', marginTop: 5, shadowColor: '#D97706', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 30 },
  line: { flex: 1, height: 1, backgroundColor: '#EFEBE9' },
  dividerText: { marginHorizontal: 15, color: '#8D6E63', fontSize: 14, fontWeight: '500' },
  socialContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  socialButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 0.48, paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: '#EFEBE9', backgroundColor: '#fff' },
  socialButtonText: { fontSize: 15, fontWeight: '700', color: '#3E2723', marginLeft: 10 },
  registerContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 30 },

  profileScrollContainer: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#5C3D2E' },

  avatarContainer: { alignItems: 'center', marginBottom: 20 },
  avatarWrapper: { position: 'relative', width: 110, height: 110 },
  avatarImage: { width: '100%', height: '100%', borderRadius: 55, backgroundColor: '#264653' },
  cameraBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#D97706', width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FAF4EF' },

  pageTitle: { fontSize: 24, fontWeight: 'bold', color: '#3E2723', textAlign: 'center', marginBottom: 5 },
  pageSubtitle: { fontSize: 14, color: '#795548', textAlign: 'center', marginBottom: 25 },

  formCard: { backgroundColor: '#fff', borderRadius: 35, padding: 25, paddingBottom: 10, marginBottom: 25, borderWidth: 1, borderColor: '#EFEBE9', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: 'bold', color: '#5C3D2E', marginBottom: 8, marginLeft: 5 },
  textInput: { backgroundColor: '#FCEFE5', borderRadius: 15, paddingHorizontal: 15, paddingVertical: 14, fontSize: 15, color: '#3E2723', fontWeight: '500' },

  saveProfileBtn: { backgroundColor: '#D97706', borderRadius: 30, paddingVertical: 18, alignItems: 'center', marginBottom: 15, shadowColor: '#D97706', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  saveProfileBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  logoutProfileBtn: { paddingVertical: 12, alignItems: 'center', marginBottom: 30 },
  logoutProfileBtnText: { color: '#9E0000', fontSize: 16, fontWeight: 'bold' },

  notificationCard: { backgroundColor: '#FCEFE5', borderRadius: 30, padding: 20, flexDirection: 'row', alignItems: 'center' },
  notificationIconWrapper: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  notificationTextWrapper: { flex: 1, paddingRight: 10 },
  notificationTitle: { fontSize: 15, fontWeight: 'bold', color: '#3E2723', marginBottom: 4 },
  notificationDesc: { fontSize: 12, color: '#795548', lineHeight: 16 },
});

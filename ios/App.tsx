import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as ExpoLocation from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LANGUAGE_LABEL_KEYS, resolveUiLanguage, translate, UI_LANGUAGES, type MessageKey, type UiLanguage } from './i18n';
import {
  ActivityIndicator,
  Alert,
  Appearance,
  DynamicColorIOS,
  Image,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';

type Tab = 'Discover' | 'Groups' | 'Saved' | 'Profile';
type AnalyzerPhase = 'choose' | 'analyzing' | 'review' | 'error' | 'published';
type ThemePreference = 'system' | 'light' | 'dark';
type MeasurementSystem = 'metric' | 'imperial';
type Translator = (key: MessageKey, values?: Record<string, string | number>) => string;
type AnalyticsEvent = 'analysis_started' | 'analysis_completed' | 'analysis_failed' | 'analysis_corrected' | 'dish_published' | 'match_opened' | 'group_created' | 'invite_joined' | 'vote_cast' | 'plan_finalized' | 'rsvp_submitted';
type FeedbackReason = 'wrong_identification' | 'stale_dish' | 'closed_restaurant';
type MobileLocation = { latitude: number; longitude: number; locality: string; administrativeRegion: string; countryCode: 'US' | 'CA' | 'MX' | 'GB' | 'FR'; timeZone: string; currencyCode: string; locale: string; language: UiLanguage; measurementSystem: MeasurementSystem; source: 'device' | 'manual' };
type MobileLocationSuggestion = { id: string; provider: 'google'; providerPlaceId: string; label: string; secondaryLabel: string; attribution: 'Google Maps' };
type MobileRestaurantPlace = { provider: 'google'; providerPlaceId: string; displayName: string; address: string; latitude: number; longitude: number; locality: string; administrativeRegion: string; countryCode: MobileLocation['countryCode']; currencyCode: string; attribution: 'Google Maps' };
type PublishRestaurant = { provider: 'google' | 'community'; providerPlaceId?: string | null; name: string; latitude: number; longitude: number; locality: string; administrativeRegion: string; countryCode: MobileLocation['countryCode']; address: string; currencyCode: string };
type PublicationMetadata = { restaurant: PublishRestaurant; knowledge: { priceKnowledge: 'unknown' | 'exact' | 'approximate'; priceAmount?: number; availabilityKnowledge: 'unknown' | 'recently_confirmed' | 'historical'; lastConfirmedAt?: string }; retainImage: boolean; reviewConfirmed: true; restaurantConfirmed: true };

type Analysis = {
  name: string;
  cuisine: string;
  ingredients: string;
  dietary: string;
  confidence: number;
  description: string;
  canonical: { dishName: string; cuisine: string; ingredients: string[]; flavours: string[]; metadataSource: 'ai_normalized' | 'user_reviewed' };
};

type AnalysisEnvelope =
  | { ok: true; mode: 'live' | 'demo'; requestId: string; result: Analysis; warning?: string }
  | { ok: false; mode: 'unavailable'; requestId: string; error: { code: string; message: string }; demoAvailable: true };

type MatchResult = { kind: 'dish' | 'restaurant_alternative'; id: string; dishName: string | null; restaurantName: string; locality: string; distanceKm: number; score: number; reasonCode: 'semantic_and_distance' | 'nearby_alternative' | 'restaurant_only'; provenance: string; verificationStatus: string; lastConfirmedAt: string | null; dietaryCaveat: string; currentAvailabilityConfirmed: boolean; priceAmount: number | null; currencyCode: string | null; imageUrl: string | null; attribution?: 'Google Maps' };
type MatchTiers = { confirmedNearbyDishes: MatchResult[]; communityOrInferredDishes: MatchResult[]; restaurantLevelAlternatives: MatchResult[] };
type MobileGroupCandidate = { candidateId: string; name: string; restaurant: string; neighborhood: string; distanceKm: number; price: string; image: string; score: number; eligible: boolean; explanation: string; conflicts: string[]; kind: 'published_dish' | 'provider_restaurant' | 'seed_demo'; provenance?: string | null; verificationStatus?: string | null; currentAvailabilityConfirmed: boolean; dietaryCaveat: string };
type MobileGroup = { id: string; name: string; eventTime: string; neighborhood: string; budgetMax: number; maxDistanceKm: number; vegetarianRequired: number; allergies: string[]; inviteCode: string; inviteExpiresAt: string | null; inviteRevokedAt: string | null; status: 'voting' | 'finalized'; selectedCandidateId: string | null; candidates: MobileGroupCandidate[]; votes: Record<string, number>; rsvps: Record<string, number>; memberCount: number; viewerRole: 'owner' | 'participant'; viewerVote: string | null; viewerRsvp: string | null; timeZone: string | null; currencyCode: string | null; locale: string | null; locality: string | null; countryCode: string | null };

function mobileGroupConflictLabel(t: Translator, conflict: string): string {
  const [code, detail = ''] = conflict.split(':', 2);
  const keys: Record<string, MessageKey> = { price_unknown: 'group.conflict.priceUnknown', over_budget: 'group.conflict.overBudget', beyond_distance: 'group.conflict.beyondDistance', vegetarian_unknown: 'group.conflict.vegetarianUnknown', vegetarian_unsupported: 'group.conflict.vegetarianUnsupported', allergen_unknown: 'group.conflict.allergenUnknown', allergen_conflict: 'group.conflict.allergenConflict' };
  return keys[code] ? t(keys[code], { allergen: detail }) : conflict;
}

function mobileGroupCandidateCopy(t: Translator, candidate: MobileGroupCandidate) {
  const explanation = candidate.explanation === 'eligible' ? t('group.fitEligible') : candidate.explanation === 'ineligible' ? `${t('group.fitIneligible')} ${candidate.conflicts.map((conflict) => mobileGroupConflictLabel(t, conflict)).join('; ')}` : candidate.explanation;
  const dietaryCaveat = candidate.dietaryCaveat === 'provider_information_unconfirmed' ? t('group.providerCaveat') : candidate.dietaryCaveat;
  return { explanation, dietaryCaveat };
}

type Dish = {
  id: number;
  name: string;
  restaurant: string;
  neighborhood: string;
  price: string;
  note: string;
  match: number;
  image: string;
  tags: string[];
};

const adaptive = (light: string, dark: string) => Platform.OS === 'ios' ? DynamicColorIOS({ light, dark }) : light;
const palette = {
  cream: adaptive('#FFF8EF', '#181315'),
  paper: adaptive('#FFFCF7', '#241C1F'),
  burgundy: adaptive('#7A263A', '#D8909F'),
  burgundyDark: adaptive('#4C1725', '#32131D'),
  terracotta: adaptive('#C7654F', '#DF806A'),
  olive: adaptive('#777B45', '#AAB77C'),
  ink: adaptive('#241B1D', '#FFF5EF'),
  muted: adaptive('#75686A', '#C9B8B1'),
  line: adaptive('#E8D9CE', '#49383D'),
  blush: adaptive('#F6E1DC', '#442B32'),
  sage: adaptive('#E9E9D7', '#303526'),
  success: adaptive('#667449', '#AAB77C'),
  warning: adaptive('#9A641F', '#E4A65D'),
  danger: adaptive('#A7343F', '#F07F8D'),
};

const sampleAnalysis: Analysis = {
  name: 'Brown butter agnolotti',
  cuisine: 'Northern Italian',
  ingredients: 'Filled pasta, brown butter, sage, lemon, parmesan',
  dietary: 'Vegetarian · Contains dairy and gluten',
  confidence: 94,
  description: 'Tender filled pasta with toasted butter, herbs and a bright citrus finish.',
  canonical: { dishName: 'agnolotti', cuisine: 'northern italian', ingredients: ['filled pasta', 'butter', 'sage', 'lemon', 'parmesan'], flavours: ['nutty', 'herbal', 'bright'], metadataSource: 'user_reviewed' },
};
const emptyMatchTiers: MatchTiers = { confirmedNearbyDishes: [], communityOrInferredDishes: [], restaurantLevelAlternatives: [] };

const dishes: Dish[] = [
  {
    id: 1,
    name: 'Brown butter agnolotti',
    restaurant: 'Oca Pastificio',
    neighborhood: 'Mount Pleasant',
    price: '$24',
    note: 'Silky filled pasta, toasted hazelnut and a bright lemon finish.',
    match: 96,
    image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1200&q=85',
    tags: ['Buttery', 'Bright', 'Vegetarian'],
  },
  {
    id: 2,
    name: 'Miso black cod',
    restaurant: 'Kissa Tanto',
    neighborhood: 'Chinatown',
    price: '$31',
    note: 'Caramelized edges, deep umami and a clean pickled-radish lift.',
    match: 91,
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=85',
    tags: ['Umami', 'Smoky', 'Gluten-aware'],
  },
  {
    id: 3,
    name: 'Roasted cauliflower',
    restaurant: 'Bar Susu',
    neighborhood: 'Main Street',
    price: '$18',
    note: 'Charred brassica, tahini, preserved lemon and a scattering of herbs.',
    match: 88,
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=85',
    tags: ['Charred', 'Nutty', 'Plant-based'],
  },
];

const navItems: Array<{ tab: Tab; icon: string }> = [
  { tab: 'Discover', icon: '⌂' },
  { tab: 'Groups', icon: '◌' },
  { tab: 'Saved', icon: '♡' },
  { tab: 'Profile', icon: '◎' },
];

const remoteApi = process.env.EXPO_PUBLIC_TRINQUE_API_URL?.replace(/\/$/, '');

export default function App() {
  const systemScheme = useColorScheme();
  const [tab, setTab] = useState<Tab>('Discover');
  const [savedIds, setSavedIds] = useState<number[]>([2]);
  const [analyzerOpen, setAnalyzerOpen] = useState(false);
  const [phase, setPhase] = useState<AnalyzerPhase>('choose');
  const [preview, setPreview] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis>(sampleAnalysis);
  const [analysisMode, setAnalysisMode] = useState<'live' | 'demo' | null>(null);
  const [analysisWarning, setAnalysisWarning] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  const [analysisRequestId, setAnalysisRequestId] = useState<string | null>(null);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [nearbyMatches, setNearbyMatches] = useState<MatchTiers>(emptyMatchTiers);
  const [matchProviderUnavailable, setMatchProviderUnavailable] = useState(false);
  const [matchRecordsUnavailable, setMatchRecordsUnavailable] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [language, setLanguage] = useState<UiLanguage>('en-CA');
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [measurementSystem, setMeasurementSystem] = useState<MeasurementSystem>('metric');
  const [location, setLocation] = useState<MobileLocation | null>(null);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<string | null>(null);
  const t = useCallback<Translator>((key, values) => translate(language, key, values), [language]);
  const correctionTracked = useRef(false);
  const inviteHandled = useCallback(() => setPendingInvite(null), []);
  const effectiveTheme = theme === 'system' ? (systemScheme ?? 'light') : theme;
  const trackAnalytics = useCallback((event: AnalyticsEvent, details: { mode?: 'live' | 'demo'; outcome?: string; durationMs?: number } = {}) => {
    if (!remoteApi || !guestToken) return;
    void fetch(`${remoteApi}/api/analytics`, { method: 'POST', headers: { Authorization: `Guest ${guestToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ event, language, countryCode: location?.countryCode, ...details }) }).catch(() => undefined);
  }, [guestToken, language, location?.countryCode]);
  const reportFeedback = useCallback(async (reason: FeedbackReason, targetType: 'analysis' | 'published_dish' | 'restaurant', targetId?: string | null) => {
    if (!remoteApi || !guestToken) return;
    const response = await fetch(`${remoteApi}/api/feedback`, { method: 'POST', headers: { Authorization: `Guest ${guestToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ reason, targetType, targetId, countryCode: location?.countryCode }) }).catch(() => null);
    Alert.alert(response?.ok ? t('feedback.thanks') : t('error.generic'));
  }, [guestToken, location?.countryCode, t]);

  useEffect(() => {
    Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme);
  }, [theme]);

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return;
      const match = url.match(/(?:join[=/]|[?&]join=)([A-Za-z0-9]+)/);
      if (!match) return;
      setPendingInvite(match[1]);
      setTab('Groups');
    };
    void Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    async function restoreLocalPreferences() {
      try {
        const [[, savedLanguage], [, savedTheme], [, savedMeasurement], [, savedLocation]] = await AsyncStorage.multiGet(['trinque.language', 'trinque.theme', 'trinque.measurement', 'trinque.location']);
        if (savedLanguage && UI_LANGUAGES.includes(savedLanguage as UiLanguage)) setLanguage(savedLanguage as UiLanguage);
        else setLanguage(resolveUiLanguage([Intl.DateTimeFormat().resolvedOptions().locale]));
        if (savedTheme && ['system', 'light', 'dark'].includes(savedTheme)) {
          Appearance.setColorScheme(savedTheme === 'system' ? 'unspecified' : savedTheme as 'light' | 'dark');
          setTheme(savedTheme as ThemePreference);
        }
        if (savedMeasurement && ['metric', 'imperial'].includes(savedMeasurement)) setMeasurementSystem(savedMeasurement as MeasurementSystem);
        if (savedLocation) { try { setLocation(JSON.parse(savedLocation) as MobileLocation); } catch { await AsyncStorage.removeItem('trinque.location'); } }
      } finally {
        setPreferencesReady(true);
      }
    }
    void restoreLocalPreferences();
  }, []);

  useEffect(() => {
    if (!remoteApi) return;
    let active = true;
    async function restoreGuest() {
      try {
        const stored = await AsyncStorage.getItem('trinque.guestToken');
        const sessionResponse = await fetch(`${remoteApi}/api/session`, { method: 'POST', headers: stored ? { Authorization: `Guest ${stored}` } : undefined });
        if (!sessionResponse.ok) return;
        const session = await sessionResponse.json() as { guestToken?: string };
        const token = session.guestToken ?? stored;
        if (!active || !token) return;
        if (session.guestToken) await AsyncStorage.setItem('trinque.guestToken', session.guestToken);
        setGuestToken(token);
        const preferencesResponse = await fetch(`${remoteApi}/api/preferences`, { headers: { Authorization: `Guest ${token}` } });
        if (preferencesResponse.ok) {
          const payload = await preferencesResponse.json() as { preferences: { language?: UiLanguage; theme?: ThemePreference; measurementSystem?: MeasurementSystem; location?: MobileLocation | null } | null };
          if (active && payload.preferences) {
            if (payload.preferences.language) setLanguage(payload.preferences.language);
            if (payload.preferences.theme) setTheme(payload.preferences.theme);
            if (payload.preferences.measurementSystem) setMeasurementSystem(payload.preferences.measurementSystem);
            if (payload.preferences.location) setLocation(payload.preferences.location);
          }
        }
        const savesResponse = await fetch(`${remoteApi}/api/saves`, { headers: { Authorization: `Guest ${token}` } });
        if (savesResponse.ok) {
          const payload = await savesResponse.json() as { savedDishIds: number[] };
          if (active) setSavedIds(payload.savedDishIds);
        }
      } catch {
        // Keep the offline demo available; the next launch retries persistence.
      }
    }
    void restoreGuest();
    return () => { active = false; };
  }, []);

  const persistPreferences = async (next: { language?: UiLanguage; theme?: ThemePreference; measurementSystem?: MeasurementSystem; location?: MobileLocation | null }) => {
    const nextLanguage = next.language ?? language;
    const nextTheme = next.theme ?? theme;
    const nextMeasurement = next.measurementSystem ?? measurementSystem;
    const storedLocation = next.location === undefined ? location : next.location;
    const nextLocation = storedLocation ? { ...storedLocation, language: nextLanguage, measurementSystem: nextMeasurement } : null;
    setLanguage(nextLanguage); setTheme(nextTheme); setMeasurementSystem(nextMeasurement); setLocation(nextLocation);
    await AsyncStorage.multiSet([
      ['trinque.language', nextLanguage],
      ['trinque.theme', nextTheme],
      ['trinque.measurement', nextMeasurement],
      ['trinque.location', nextLocation ? JSON.stringify({ ...nextLocation, latitude: Math.round(nextLocation.latitude * 100) / 100, longitude: Math.round(nextLocation.longitude * 100) / 100 }) : ''],
    ]);
    if (remoteApi && guestToken) {
      await fetch(`${remoteApi}/api/preferences`, { method: 'PUT', headers: { Authorization: `Guest ${guestToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ language: nextLanguage, theme: nextTheme, measurementSystem: nextMeasurement, location: nextLocation }) }).catch(() => undefined);
      if (next.location !== undefined) await fetch(`${remoteApi}/api/privacy`, { method: 'PUT', headers: { Authorization: `Guest ${guestToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ locationConsent: Boolean(nextLocation) }) }).catch(() => undefined);
    }
  };

  const savedDishes = useMemo(
    () => dishes.filter((dish) => savedIds.includes(dish.id)),
    [savedIds],
  );

  const openAnalyzer = () => {
    setPhase('choose');
    setPreview(null);
    setImageDataUrl(null);
    setAnalysis(sampleAnalysis);
    setAnalysisMode(null);
    setAnalysisWarning('');
    setAnalysisError('');
    setAnalysisRequestId(null);
    correctionTracked.current = false;
    setAnalyzerOpen(true);
  };

  const choosePhoto = async (camera: boolean) => {
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('analysis.cameraTitle'), t('analysis.cameraBody'));
        return;
      }
    }

    const result = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.72, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.72, base64: true });

    if (result.canceled) return;
    const asset = result.assets[0];
    setPreview(asset.uri);
    setImageDataUrl(asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : null);
    await analyze(asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : null);
  };

  const analyze = async (dataUrl: string | null, demo = false) => {
    const startedAt = performance.now();
    trackAnalytics('analysis_started', { mode: demo ? 'demo' : 'live' });
    setPhase('analyzing');
    setAnalysisMode(null);
    setAnalysisWarning('');
    setAnalysisError('');
    try {
      if (!remoteApi) {
        await new Promise((resolve) => setTimeout(resolve, 650));
        if (!demo) {
          trackAnalytics('analysis_failed', { mode: 'live', outcome: 'api_not_configured', durationMs: Math.round(performance.now() - startedAt) });
          setAnalysisError(t('analysis.networkError'));
          setPhase('error');
          return;
        }
        setAnalysis(sampleAnalysis);
        setAnalysisMode('demo');
        setAnalysisWarning('This is seeded demo data, not an analysis of the uploaded photo.');
      } else {
        const response = await fetch(`${remoteApi}/api/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(guestToken ? { Authorization: `Guest ${guestToken}` } : {}) },
          body: JSON.stringify({ imageDataUrl: dataUrl, demo, language }),
        });
        const envelope = (await response.json()) as AnalysisEnvelope;
        if (!response.ok || !envelope.ok) {
          trackAnalytics('analysis_failed', { mode: demo ? 'demo' : 'live', outcome: envelope.ok ? 'provider_error' : envelope.error.code, durationMs: Math.round(performance.now() - startedAt) });
          setAnalysisError(envelope.ok ? 'Live identification failed.' : envelope.error.message);
          setPhase('error');
          return;
        }
        setAnalysis(envelope.result);
        setAnalysisMode(envelope.mode);
        setAnalysisWarning(envelope.warning ?? '');
        setAnalysisRequestId(envelope.requestId);
        trackAnalytics('analysis_completed', { mode: envelope.mode, outcome: 'success', durationMs: Math.round(performance.now() - startedAt) });
      }
      if (!remoteApi && demo) trackAnalytics('analysis_completed', { mode: 'demo', outcome: 'success', durationMs: Math.round(performance.now() - startedAt) });
      setPhase('review');
    } catch {
      trackAnalytics('analysis_failed', { mode: demo ? 'demo' : 'live', outcome: 'network_error', durationMs: Math.round(performance.now() - startedAt) });
      setAnalysisError(t('analysis.networkError'));
      setPhase('error');
    }
  };

  const toggleSaved = (dishId: number) => {
    const shouldSave = !savedIds.includes(dishId);
    setSavedIds((current) => shouldSave ? [...current, dishId] : current.filter((id) => id !== dishId));
    if (remoteApi && guestToken) {
      void fetch(`${remoteApi}/api/saves`, { method: 'POST', headers: { Authorization: `Guest ${guestToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ dishId, saved: shouldSave }) });
    }
  };

  const publishDish = async (metadata: PublicationMetadata) => {
    if (!remoteApi || !guestToken || !analysisMode) {
      setAnalysisError(t('analysis.sessionError'));
      setPhase('error');
      return;
    }
    setPublishing(true);
    try {
      const response = await fetch(`${remoteApi}/api/dishes`, { method: 'POST', headers: { Authorization: `Guest ${guestToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ analysis, sourceMode: analysisMode, imageDataUrl, language, ...metadata }) });
      if (!response.ok) throw new Error('publish failed');
      const payload = await response.json() as { matches: MatchTiers; providerStatus: { status: 'live' | 'unavailable' }; matchingStatus: { status: 'live' | 'unavailable' } };
      setNearbyMatches(payload.matches);
      setMatchProviderUnavailable(payload.providerStatus.status === 'unavailable');
      setMatchRecordsUnavailable(payload.matchingStatus.status === 'unavailable');
      setPhase('published');
      trackAnalytics('dish_published', { mode: analysisMode, outcome: 'success' });
    } catch {
      setAnalysisError(t('analysis.publishError'));
      setPhase('error');
    } finally { setPublishing(false); }
  };

  if (!preferencesReady) {
    return <SafeAreaProvider><SafeAreaView style={styles.safeArea}><StatusBar style={effectiveTheme === 'dark' ? 'light' : 'dark'} /></SafeAreaView></SafeAreaProvider>;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={effectiveTheme === 'dark' ? 'light' : 'dark'} />
        <View style={styles.appShell}>
          {tab === 'Discover' && <DiscoverScreen savedIds={savedIds} onSave={toggleSaved} onAnalyze={openAnalyzer} t={t} location={location} />}
          {tab === 'Groups' && <GroupsScreen guestToken={guestToken} t={t} location={location} language={language} inviteCode={pendingInvite} inviteHandled={inviteHandled} track={trackAnalytics} />}
          {tab === 'Saved' && <SavedScreen dishes={savedDishes} onSave={toggleSaved} onDiscover={() => setTab('Discover')} t={t} />}
          {tab === 'Profile' && <ProfileScreen guestToken={guestToken} t={t} language={language} theme={theme} measurementSystem={measurementSystem} location={location} persist={persistPreferences} />}
          <TabBar active={tab} onSelect={setTab} onAnalyze={openAnalyzer} t={t} />
        </View>
        <AnalyzerModal
          key={`${imageDataUrl ?? 'demo'}-${analysisMode ?? 'pending'}`}
          visible={analyzerOpen}
          phase={phase}
          preview={preview}
          imageDataUrl={imageDataUrl}
          analysis={analysis}
          analysisMode={analysisMode}
          warning={analysisWarning}
          error={analysisError}
          matches={nearbyMatches}
          matchProviderUnavailable={matchProviderUnavailable}
          matchRecordsUnavailable={matchRecordsUnavailable}
          publishing={publishing}
          onAnalysisChange={(value) => { setAnalysis(value); if (!correctionTracked.current) { correctionTracked.current = true; trackAnalytics('analysis_corrected', { mode: analysisMode ?? undefined }); } }}
          onChoose={choosePhoto}
          onDemo={() => analyze(null, true)}
          onRetry={() => analyze(imageDataUrl, false)}
          onPublish={publishDish}
          onClose={() => setAnalyzerOpen(false)}
          onReset={() => {
            setPhase('choose');
            setPreview(null);
            setImageDataUrl(null);
          }}
          t={t}
          language={language}
          measurementSystem={measurementSystem}
          location={location}
          apiBase={remoteApi}
          guestToken={guestToken}
          onMatchOpened={() => trackAnalytics('match_opened', { mode: analysisMode ?? undefined })}
          onFeedback={(reason, targetType, targetId) => void reportFeedback(reason, targetType, targetId ?? analysisRequestId)}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function DiscoverScreen({ savedIds, onSave, onAnalyze, t, location }: { savedIds: number[]; onSave: (id: number) => void; onAnalyze: () => void; t: Translator; location: MobileLocation | null }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <Header eyebrow={location ? `${location.locality} · ${location.countryCode}` : t('location.change')} />
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>{t('home.eyebrow').toUpperCase()}</Text>
        <Text style={styles.heroTitle}>{t('home.title')}</Text>
        <Text style={styles.heroBody}>{t('home.body')}</Text>
        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={onAnalyze}>
          <Text style={styles.primaryButtonIcon}>⌁</Text>
          <View>
            <Text style={styles.primaryButtonText}>{t('home.analyze')}</Text>
            <Text style={styles.primaryButtonSubtext}>{t('analysis.review')}</Text>
          </View>
          <Text style={styles.primaryArrow}>→</Text>
        </Pressable>
      </View>

      <SectionHeading kicker={t('home.curated', { location: location?.locality ?? '—' }).toUpperCase()} title={t('home.gather')} action="" />
      <View style={styles.seededNotice}><Text style={styles.seededNoticeText}>{t('home.seededNotice')}</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
        {dishes.map((dish) => <DishCard key={dish.id} dish={dish} saved={savedIds.includes(dish.id)} onSave={() => onSave(dish.id)} />)}
      </ScrollView>

      <View style={styles.tasteCard}>
        <View style={styles.tasteTopLine}>
          <Text style={styles.tasteKicker}>{t('home.tasteprint').toUpperCase()}</Text>
          <Text style={styles.tastePercent}>82%</Text>
        </View>
        <Text style={styles.tasteTitle}>{t('home.tasteTitle')}</Text>
        <Text style={styles.tasteBody}>{t('home.tasteBody')}</Text>
        <View style={styles.tasteTags}>
          {['Umami', 'Citrus', 'Char', 'Herby'].map((tag, index) => (
            <View key={tag} style={[styles.tasteTag, index === 0 && styles.tasteTagStrong]}><Text style={[styles.tasteTagText, index === 0 && styles.tasteTagTextStrong]}>{tag}</Text></View>
          ))}
        </View>
      </View>
      <Text style={styles.editorialNote}>“{t('home.editorial')}”</Text>
    </ScrollView>
  );
}

function GroupsScreen({ guestToken, t, location, language, inviteCode, inviteHandled, track }: { guestToken: string | null; t: Translator; location: MobileLocation | null; language: UiLanguage; inviteCode: string | null; inviteHandled: () => void; track: (event: AnalyticsEvent, details?: { mode?: 'live' | 'demo'; outcome?: string; durationMs?: number }) => void }) {
  const [group, setGroup] = useState<MobileGroup | null>(null);
  const [busy, setBusy] = useState(false);
  const [placesUnavailable, setPlacesUnavailable] = useState(!remoteApi);

  useEffect(() => {
    if (!remoteApi) return;
    void fetch(`${remoteApi}/api/health`).then(async (response) => {
      const health = await response.json() as { capabilities?: { places?: { status?: string } } };
      setPlacesUnavailable(health.capabilities?.places?.status !== 'available');
    }).catch(() => setPlacesUnavailable(true));
  }, []);

  useEffect(() => {
    if (!remoteApi || !guestToken) return;
    if (inviteCode) {
      void fetch(`${remoteApi}/api/groups/join`, { method: 'POST', headers: { Authorization: `Guest ${guestToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ inviteCode, language }) }).then(async (response) => {
        if (!response.ok) { Alert.alert(t('group.inviteInvalid')); return; }
        setGroup(((await response.json()) as { group: MobileGroup }).group);
        track('invite_joined', { outcome: 'success' });
        Alert.alert(t('group.joined'));
      }).catch(() => Alert.alert(t('error.generic'))).finally(inviteHandled);
      return;
    }
    void fetch(`${remoteApi}/api/groups`, { headers: { Authorization: `Guest ${guestToken}` } }).then(async (response) => {
      if (response.ok) setGroup(((await response.json()) as { group: MobileGroup | null }).group);
    });
  }, [guestToken, inviteCode, inviteHandled, language, t, track]);

  const createGroup = async () => {
    if (!remoteApi || !guestToken) { Alert.alert(t('auth.connecting'), t('analysis.sessionError')); return; }
    if (!location) { Alert.alert(t('location.change'), t('location.privacy')); return; }
    setBusy(true);
    try {
      const eventDateParts = new Intl.DateTimeFormat('en-CA', { timeZone: location.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(Date.now() + 86400000));
      const eventLocalDate = ['year', 'month', 'day'].map((type) => eventDateParts.find((part) => part.type === type)?.value).join('-');
      const response = await fetch(`${remoteApi}/api/groups`, { method: 'POST', headers: { Authorization: `Guest ${guestToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: t('group.name'), eventLocalDate, eventLocalTime: '19:30', location, language, budgetMax: 35, maxDistanceKm: 4, vegetarianRequired: 1, allergies: ['sesame'] }) });
      if (!response.ok) throw new Error();
      const payload = await response.json() as { group: MobileGroup; providerStatus?: { status: 'live' | 'unavailable' } };
      setGroup(payload.group); setPlacesUnavailable(payload.providerStatus?.status === 'unavailable');
      track('group_created', { outcome: 'success' });
    } catch { Alert.alert(t('error.generic')); } finally { setBusy(false); }
  };

  const groupAction = async (path: string, body: object = {}) => {
    if (!remoteApi || !guestToken || !group) return;
    setBusy(true);
    try {
      const response = await fetch(`${remoteApi}/api/groups/${group.id}/${path}`, { method: 'POST', headers: { Authorization: `Guest ${guestToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error);
      setGroup(((await response.json()) as { group: MobileGroup }).group);
      if (path === 'vote') track('vote_cast', { outcome: 'success' }); else if (path === 'finalize') track('plan_finalized', { outcome: 'success' }); else if (path === 'rsvp') track('rsvp_submitted', { outcome: 'success' });
    } catch { Alert.alert(t('error.generic')); } finally { setBusy(false); }
  };

  const shareCalendar = async () => {
    if (!remoteApi || !guestToken || !group) return;
    const response = await fetch(`${remoteApi}/api/groups/${group.id}/calendar`, { headers: { Authorization: `Guest ${guestToken}` } });
    if (!response.ok) { Alert.alert(t('error.generic')); return; }
    await Share.share({ title: 'Trinque dining plan', message: await response.text() });
  };

  const shareInvite = async () => {
    if (!group || !remoteApi) return;
    await Share.share({ title: group.name, message: `${t('group.copyInvite')}: ${remoteApi}/?join=${group.inviteCode}\ntrinque://join/${group.inviteCode}` });
  };

  const candidates = group?.candidates.slice(0, 5) ?? [];
  const winner = group?.candidates.find((candidate) => candidate.candidateId === group.selectedCandidateId);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <Header eyebrow={t('group.eyebrow')} />
      <View style={styles.pageIntro}>
        <Text style={styles.heroKicker}>{t('group.ranking').toUpperCase()}</Text>
        <Text style={styles.pageTitle}>{group?.status === 'finalized' ? t('group.finalTitle') : t('group.createTitle')}</Text>
        <Text style={styles.pageBody}>{t('group.constraints')}</Text>
        {placesUnavailable ? <Text style={styles.publicationStatus}>{t('match.providerUnavailable')}</Text> : null}
      </View>

      <View style={styles.planCard}>
        <View style={styles.planHeader}>
          <View>
            <Text style={styles.planEyebrow}>{group ? new Intl.DateTimeFormat(group.locale ?? language, { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: group.timeZone ?? location?.timeZone }).format(new Date(group.eventTime)).toUpperCase() : t('group.start').toUpperCase()}</Text>
            <Text style={styles.planTitle}>{group?.name ?? t('group.name')}</Text>
          </View>
          {group ? <Text style={styles.constraintText}>{t('group.memberCount', { count: group.memberCount })}</Text> : null}
        </View>
        <View style={styles.constraintRow}>
          {(group ? [t('group.underBudget', { amount: new Intl.NumberFormat(group.locale ?? language, { style: 'currency', currency: group.currencyCode ?? location?.currencyCode ?? 'CAD', maximumFractionDigits: 0 }).format(group.budgetMax) }), t('group.vegetarianCount', { count: group.vegetarianRequired }), t('group.avoid', { allergens: group.allergies.join(', ') }), t('group.withinRadius', { distance: `${group.maxDistanceKm} km` })] : [t('group.budget'), t('group.vegetarian'), t('group.allergies'), t('group.radius')]).map((item) => <View key={item} style={styles.constraint}><Text style={styles.constraintText}>✓ {item}</Text></View>)}
        </View>
        {group?.viewerRole === 'owner' && !group.inviteRevokedAt ? <View style={styles.mobileFinalActions}><Pressable style={styles.finalAction} onPress={shareInvite}><Text style={styles.finalActionText}>{t('group.copyInvite')}</Text></Pressable><Pressable style={styles.finalAction} onPress={() => groupAction('invite/revoke')}><Text style={styles.finalActionText}>{t('group.revokeInvite')}</Text></Pressable></View> : null}
      </View>

      <SectionHeading kicker={t('group.ranking').toUpperCase()} title={group ? t('group.bestFits') : t('group.start')} action="" />
      {!group ? <View style={styles.emptyCard}><Text style={styles.emptyIcon}>♢</Text><Text style={styles.emptyTitle}>{t('group.start')}</Text><Text style={styles.emptyBody}>{t('group.createBody')}</Text><Pressable disabled={busy || !location} style={styles.primaryButton} onPress={createGroup}><Text style={styles.primaryButtonText}>{busy ? t('group.building') : t('group.rank')}</Text><Text style={styles.primaryArrow}>→</Text></Pressable></View> : candidates.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>{t('group.noLiveCandidates')}</Text></View> : candidates.map((candidate) => (
        <View key={candidate.candidateId} style={[styles.voteCard, !candidate.eligible && styles.ineligibleCard]}>
          {candidate.image ? <Image source={{ uri: candidate.image }} style={styles.voteImage} /> : <View style={styles.voteImage} />}
          <View style={styles.voteInfo}>
            <View style={styles.voteMeta}><Text style={styles.fitBadge}>{candidate.eligible ? t('group.groupFit', { score: candidate.score }) : t('group.hardConflict')}</Text><Text style={styles.votePrice}>{candidate.price}</Text></View>
            <Text style={styles.voteName}>{candidate.name}</Text>
            <Text style={styles.voteReason}>{candidate.restaurant} · {candidate.distanceKm} km{`\n`}{mobileGroupCandidateCopy(t, candidate).explanation}{`\n`}{mobileGroupCandidateCopy(t, candidate).dietaryCaveat}{candidate.kind === 'provider_restaurant' ? `\n${t('match.restaurantReason')}` : ''}</Text>
            <Pressable disabled={busy || !candidate.eligible || group.status === 'finalized'} style={({ pressed }) => [styles.voteButton, pressed && styles.pressed, (busy || !candidate.eligible || group.status === 'finalized') && styles.disabledButton]} onPress={() => groupAction('vote', { candidateId: candidate.candidateId })}>
              <Text style={styles.voteButtonText}>{group.status === 'finalized' ? t('group.votingClosed') : `${group.viewerVote === candidate.candidateId ? '♥' : '♡'}  ${t('group.vote')} · ${group.votes[candidate.candidateId] ?? 0}`}</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {group?.status === 'voting' && group.viewerRole === 'owner' ? <Pressable disabled={busy} style={({ pressed }) => [styles.primaryButton, styles.lockButton, pressed && styles.pressed, busy && styles.disabledButton]} onPress={() => groupAction('finalize')}><Text style={styles.primaryButtonText}>{t('group.lock')}</Text><Text style={styles.primaryArrow}>→</Text></Pressable> : group?.status === 'voting' ? <Text style={styles.editorialNote}>{t('group.ownerFinalizes')}</Text> : winner ? <View style={styles.mobileFinalPlan}><Text style={styles.planEyebrow}>{t('group.bestTable').toUpperCase()}</Text><Text style={styles.mobileFinalTitle}>{winner.restaurant}</Text><Text style={styles.mobileFinalBody}>{winner.name}. {mobileGroupCandidateCopy(t, winner).explanation}</Text><View style={styles.mobileFinalActions}><Pressable style={styles.finalAction} onPress={() => groupAction('rsvp', { status: 'yes' })}><Text style={styles.finalActionText}>{t('group.rsvpYes')} · {group?.rsvps.yes ?? 0}</Text></Pressable><Pressable style={styles.finalAction} onPress={shareCalendar}><Text style={styles.finalActionText}>{t('group.calendar')}</Text></Pressable></View></View> : null}
    </ScrollView>
  );
}

function SavedScreen({ dishes: saved, onSave, onDiscover, t }: { dishes: Dish[]; onSave: (id: number) => void; onDiscover: () => void; t: Translator }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <Header eyebrow={t('nav.saved')} />
      <View style={styles.pageIntro}>
        <Text style={styles.heroKicker}>{t('home.savedHeading').toUpperCase()}</Text>
        <Text style={styles.pageTitle}>{t('home.savedTitle')}</Text>
      </View>
      {saved.length ? saved.map((dish) => (
        <View key={dish.id} style={styles.savedCard}>
          <Image source={{ uri: dish.image }} style={styles.savedImage} />
          <View style={styles.savedInfo}><Text style={styles.savedName}>{dish.name}</Text><Text style={styles.savedRestaurant}>{dish.restaurant} · {dish.neighborhood}</Text><Text style={styles.savedNote}>{dish.note}</Text></View>
          <Pressable style={styles.savedHeart} onPress={() => onSave(dish.id)}><Text style={styles.savedHeartText}>♥</Text></Pressable>
        </View>
      )) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>♡</Text><Text style={styles.emptyTitle}>{t('home.emptyTitle')}</Text><Text style={styles.emptyBody}>{t('home.emptyBody')}</Text>
          <Pressable style={styles.secondaryButton} onPress={onDiscover}><Text style={styles.secondaryButtonText}>{t('home.explore')}</Text></Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function ProfileScreen({ guestToken, t, language, theme, measurementSystem, location, persist }: { guestToken: string | null; t: Translator; language: UiLanguage; theme: ThemePreference; measurementSystem: MeasurementSystem; location: MobileLocation | null; persist: (next: { language?: UiLanguage; theme?: ThemePreference; measurementSystem?: MeasurementSystem; location?: MobileLocation | null }) => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MobileLocationSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState({ locationConsent: false, analyticsConsent: false, imageRetentionConsent: false });

  useEffect(() => {
    if (!remoteApi || !guestToken) return;
    void fetch(`${remoteApi}/api/privacy`, { headers: { Authorization: `Guest ${guestToken}` } }).then(async (response) => { if (response.ok) setConsent((await response.json() as { consent: typeof consent }).consent); });
  }, [guestToken]);

  const saveConsent = async (next = consent) => {
    if (!remoteApi || !guestToken) return;
    const response = await fetch(`${remoteApi}/api/privacy`, { method: 'PUT', headers: { Authorization: `Guest ${guestToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    if (!response.ok) { Alert.alert(t('error.generic')); return; }
    setConsent((await response.json() as { consent: typeof consent }).consent);
    if (!next.locationConsent) await persist({ location: null });
  };

  const exportData = async () => {
    if (!remoteApi || !guestToken) return;
    const response = await fetch(`${remoteApi}/api/privacy/export`, { headers: { Authorization: `Guest ${guestToken}` } });
    if (!response.ok) { Alert.alert(t('error.generic')); return; }
    await Share.share({ title: t('privacy.export'), message: await response.text() });
  };

  const deleteData = () => {
    if (!remoteApi || !guestToken) return;
    Alert.alert(t('privacy.delete'), t('privacy.deleteConfirm'), [{ text: t('analysis.keepPrivate'), style: 'cancel' }, { text: t('privacy.delete'), style: 'destructive', onPress: () => { void fetch(`${remoteApi}/api/privacy`, { method: 'DELETE', headers: { Authorization: `Guest ${guestToken}` } }).then(async (response) => { if (!response.ok) { Alert.alert(t('error.generic')); return; } await AsyncStorage.multiRemove(['trinque.guestToken', 'trinque.location', 'trinque.language', 'trinque.theme', 'trinque.measurement']); Alert.alert(t('privacy.deleted')); }); } }]);
  };

  const lookup = async (payload: { input?: string; latitude?: number; longitude?: number; providerPlaceId?: string }) => {
    if (!remoteApi) { Alert.alert(t('health.placesUnavailable'), t('location.unavailable')); return; }
    setBusy(true); setSuggestions([]);
    try {
      const response = await fetch(`${remoteApi}/api/locations/autocomplete`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(guestToken ? { Authorization: `Guest ${guestToken}` } : {}) }, body: JSON.stringify({ ...payload, language, location }) });
      const body = await response.json() as { suggestions?: MobileLocationSuggestion[]; location?: MobileLocation; error?: { code?: string } };
      if (!response.ok) {
        const message = body.error?.code === 'unsupported_country' ? t('location.unsupported') : body.error?.code === 'credentials' ? t('location.unavailable') : t('location.providerError');
        Alert.alert(t('health.placesUnavailable'), message);
        return;
      }
      if (body.location) {
        setSuggestions([]);
        await persist({ location: body.location, measurementSystem: body.location.measurementSystem });
        return;
      }
      setSuggestions(body.suggestions ?? []);
    } catch { Alert.alert(t('health.placesUnavailable'), t('location.unavailable')); }
    finally { setBusy(false); }
  };

  const useDeviceLocation = async () => {
    const permission = await ExpoLocation.requestForegroundPermissionsAsync();
    if (!permission.granted) { Alert.alert(t('location.permissionDenied'), t('location.search')); return; }
    const position = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
    await lookup({ latitude: position.coords.latitude, longitude: position.coords.longitude });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <Header eyebrow={t('settings.title')} />
      <View style={styles.profileHero}>
        <View style={styles.profileAvatar}><Text style={styles.profileInitials}>CO</Text></View>
        <Text style={styles.profileName}>{t('auth.guest')}</Text><Text style={styles.profileHandle}>{location ? `${location.locality} · ${location.countryCode}` : t('location.change')}</Text>
      </View>
      <View style={styles.profileStats}>
        {[['18', t('profile.dishes')], ['7', t('profile.lists')], ['12', t('profile.friends')]].map(([value, label]) => <View key={label} style={styles.profileStat}><Text style={styles.profileStatValue}>{value}</Text><Text style={styles.profileStatLabel}>{label}</Text></View>)}
      </View>
      <View style={styles.preferenceCard}>
        <Text style={styles.preferenceKicker}>{t('settings.title').toUpperCase()}</Text>
        <Text style={styles.preferenceTitle}>{t('settings.language')}</Text>
        <View style={styles.settingsChoices}>{UI_LANGUAGES.map((item) => <Pressable key={item} style={[styles.settingsChoice, language === item && styles.settingsChoiceActive]} onPress={() => persist({ language: item })}><Text style={[styles.settingsChoiceText, language === item && styles.settingsChoiceTextActive]}>{t(LANGUAGE_LABEL_KEYS[item])}</Text></Pressable>)}</View>
        <Text style={styles.preferenceTitle}>{t('settings.theme')}</Text>
        <View style={styles.settingsChoices}>{(['system', 'light', 'dark'] as const).map((item) => <Pressable key={item} style={[styles.settingsChoice, theme === item && styles.settingsChoiceActive]} onPress={() => persist({ theme: item })}><Text style={[styles.settingsChoiceText, theme === item && styles.settingsChoiceTextActive]}>{t(`settings.theme.${item}`)}</Text></Pressable>)}</View>
        <Text style={styles.preferenceTitle}>{t('settings.measurement')}</Text>
        <View style={styles.settingsChoices}>{(['metric', 'imperial'] as const).map((item) => <Pressable key={item} style={[styles.settingsChoice, measurementSystem === item && styles.settingsChoiceActive]} onPress={() => persist({ measurementSystem: item })}><Text style={[styles.settingsChoiceText, measurementSystem === item && styles.settingsChoiceTextActive]}>{t(item === 'metric' ? 'location.metric' : 'location.imperial')}</Text></Pressable>)}</View>
        <Text style={styles.preferenceTitle}>{t('settings.location')}</Text>
        <Pressable disabled={busy} style={styles.secondaryButton} onPress={useDeviceLocation}><Text style={styles.secondaryButtonText}>{t('location.useDevice')}</Text></Pressable>
        <TextInput style={styles.locationInput} value={query} onChangeText={setQuery} placeholder={t('location.search')} placeholderTextColor={palette.muted} />
        <Pressable disabled={busy || !query.trim()} style={styles.secondaryButton} onPress={() => lookup({ input: query.trim() })}><Text style={styles.secondaryButtonText}>{t('location.searchAction')}</Text></Pressable>
        {suggestions.map((suggestion) => <Pressable key={suggestion.id} style={styles.locationSuggestion} onPress={() => lookup({ providerPlaceId: suggestion.providerPlaceId })}><Text style={styles.safetyTitle}>{suggestion.label}</Text><Text style={styles.safetyBody}>{suggestion.secondaryLabel}</Text></Pressable>)}
        {suggestions.length > 0 ? <Text accessibilityLabel="Google Maps" style={styles.googleAttribution}>Google Maps</Text> : null}
        <Text style={styles.privacyText}>{t('location.privacy')}</Text>
      </View>
      <View style={styles.preferenceCard}><Text style={styles.preferenceKicker}>{t('privacy.title').toUpperCase()}</Text><Text style={styles.privacyText}>{t('privacy.location')}</Text>{([['locationConsent', 'privacy.locationConsent'], ['analyticsConsent', 'privacy.analyticsConsent'], ['imageRetentionConsent', 'privacy.imageConsent']] as const).map(([field, key]) => <Toggle key={field} selected={consent[field]} label={t(key)} onPress={() => setConsent((current) => ({ ...current, [field]: !current[field] }))} />)}<Pressable style={styles.secondaryButton} onPress={() => void saveConsent()}><Text style={styles.secondaryButtonText}>{t('privacy.saveConsent')}</Text></Pressable><Pressable style={styles.secondaryButton} onPress={() => { const withdrawn = { locationConsent: false, analyticsConsent: false, imageRetentionConsent: false }; setConsent(withdrawn); void saveConsent(withdrawn); }}><Text style={styles.secondaryButtonText}>{t('privacy.withdraw')}</Text></Pressable><Pressable style={styles.secondaryButton} onPress={() => void exportData()}><Text style={styles.secondaryButtonText}>{t('privacy.export')}</Text></Pressable><Pressable style={styles.secondaryButton} onPress={deleteData}><Text style={styles.secondaryButtonText}>{t('privacy.delete')}</Text></Pressable></View>
      <View style={styles.safetyCard}><Text style={styles.safetyIcon}>i</Text><View style={styles.safetyCopy}><Text style={styles.safetyTitle}>{t('privacy.title')}</Text><Text style={styles.safetyBody}>{t('analysis.warning')}</Text></View></View>
    </ScrollView>
  );
}

function Header({ eyebrow }: { eyebrow: string }) {
  return (
    <View style={styles.header}>
      <View><Text style={styles.wordmark}>Trinque</Text><Text style={styles.headerEyebrow}>{eyebrow}</Text></View>
      <View style={styles.headerAvatar}><Text style={styles.headerAvatarText}>CO</Text></View>
    </View>
  );
}

function SectionHeading({ kicker, title, action }: { kicker: string; title: string; action: string }) {
  return <View style={styles.sectionHeading}><View><Text style={styles.sectionKicker}>{kicker}</Text><Text style={styles.sectionTitle}>{title}</Text></View>{action ? <Text style={styles.sectionAction}>{action} →</Text> : null}</View>;
}

function DishCard({ dish, saved, onSave }: { dish: Dish; saved: boolean; onSave: () => void }) {
  return (
    <View style={styles.dishCard}>
      <View><Image source={{ uri: dish.image } as ImageSourcePropType} style={styles.dishImage} /><Text style={styles.matchBadge}>{dish.match}%</Text><Pressable style={styles.heartButton} onPress={onSave}><Text style={[styles.heartText, saved && styles.heartTextSaved]}>{saved ? '♥' : '♡'}</Text></Pressable></View>
      <View style={styles.dishBody}>
        <View style={styles.dishTitleLine}><Text style={styles.dishName}>{dish.name}</Text><Text style={styles.dishPrice}>{dish.price}</Text></View>
        <Text style={styles.dishRestaurant}>{dish.restaurant} · {dish.neighborhood}</Text><Text style={styles.dishNote}>{dish.note}</Text>
        <View style={styles.dishTags}>{dish.tags.map((tag) => <Text key={tag} style={styles.dishTag}>{tag}</Text>)}</View>
      </View>
    </View>
  );
}

function TabBar({ active, onSelect, onAnalyze, t }: { active: Tab; onSelect: (tab: Tab) => void; onAnalyze: () => void; t: Translator }) {
  return (
    <View style={styles.tabBar}>
      {navItems.slice(0, 2).map((item) => <TabButton key={item.tab} {...item} active={active === item.tab} onPress={() => onSelect(item.tab)} t={t} />)}
      <Pressable accessibilityLabel={t('home.analyze')} style={({ pressed }) => [styles.cameraButton, pressed && styles.pressed]} onPress={onAnalyze}><Text style={styles.cameraButtonIcon}>⌁</Text></Pressable>
      {navItems.slice(2).map((item) => <TabButton key={item.tab} {...item} active={active === item.tab} onPress={() => onSelect(item.tab)} t={t} />)}
    </View>
  );
}

function TabButton({ tab, icon, active, onPress, t }: { tab: Tab; icon: string; active: boolean; onPress: () => void; t: Translator }) {
  const key = `nav.${tab.toLowerCase()}` as MessageKey;
  return <Pressable style={styles.tabButton} onPress={onPress}><Text style={[styles.tabIcon, active && styles.tabActive]}>{icon}</Text><Text style={[styles.tabLabel, active && styles.tabActive]}>{t(key)}</Text></Pressable>;
}

function AnalyzerModal({ visible, phase, preview, imageDataUrl, analysis, analysisMode, warning, error, matches, matchProviderUnavailable, matchRecordsUnavailable, publishing, onAnalysisChange, onChoose, onDemo, onRetry, onPublish, onClose, onReset, t, language, measurementSystem, location, apiBase, guestToken, onMatchOpened, onFeedback }: {
  visible: boolean;
  phase: AnalyzerPhase;
  preview: string | null;
  imageDataUrl: string | null;
  analysis: Analysis;
  analysisMode: 'live' | 'demo' | null;
  warning: string;
  error: string;
  matches: MatchTiers;
  matchProviderUnavailable: boolean;
  matchRecordsUnavailable: boolean;
  publishing: boolean;
  onAnalysisChange: (value: Analysis) => void;
  onChoose: (camera: boolean) => void;
  onDemo: () => void;
  onRetry: () => void;
  onPublish: (metadata: PublicationMetadata) => void;
  onClose: () => void;
  onReset: () => void;
  t: Translator;
  language: UiLanguage;
  measurementSystem: MeasurementSystem;
  location: MobileLocation | null;
  apiBase: string | null | undefined;
  guestToken: string | null;
  onMatchOpened: () => void;
  onFeedback: (reason: FeedbackReason, targetType: 'analysis' | 'published_dish' | 'restaurant', targetId?: string | null) => void;
}) {
  const [restaurants, setRestaurants] = useState<MobileRestaurantPlace[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<PublishRestaurant | null>(null);
  const [restaurantStatus, setRestaurantStatus] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [priceKnowledge, setPriceKnowledge] = useState<'' | 'unknown' | 'exact' | 'approximate'>('');
  const [priceAmount, setPriceAmount] = useState('');
  const [availabilityKnowledge, setAvailabilityKnowledge] = useState<'' | 'unknown' | 'recently_confirmed' | 'historical'>('');
  const [lastConfirmedAt, setLastConfirmedAt] = useState('');
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [restaurantConfirmed, setRestaurantConfirmed] = useState(false);
  const [retainImage, setRetainImage] = useState(false);

  async function findRestaurants() {
    if (!location) { setRestaurantStatus(t('publish.noLocation')); return; }
    if (!apiBase) { setRestaurantStatus(t('publish.providerUnavailable')); return; }
    setRestaurantStatus('');
    try {
      const response = await fetch(`${apiBase}/api/restaurants/nearby?latitude=${location.latitude}&longitude=${location.longitude}&radiusMeters=5000&language=${language}`, { headers: guestToken ? { Authorization: `Guest ${guestToken}` } : undefined });
      const body = await response.json() as { restaurants?: MobileRestaurantPlace[]; error?: { code?: string } };
      if (!response.ok) { setRestaurantStatus(body.error?.code === 'credentials' ? t('publish.providerUnavailable') : t('location.providerError')); return; }
      setRestaurants(body.restaurants ?? []);
    } catch { setRestaurantStatus(t('location.providerError')); }
  }

  function selectProviderRestaurant(place: MobileRestaurantPlace) {
    setSelectedRestaurant({ provider: 'google', providerPlaceId: place.providerPlaceId, name: place.displayName, latitude: place.latitude, longitude: place.longitude, locality: place.locality, administrativeRegion: place.administrativeRegion, countryCode: place.countryCode, address: place.address, currencyCode: place.currencyCode });
    setRestaurantConfirmed(false);
  }

  function useManualRestaurant() {
    if (!location || !manualName.trim() || !manualAddress.trim()) { setRestaurantStatus(location ? t('publish.requirements') : t('publish.noLocation')); return; }
    setSelectedRestaurant({ provider: 'community', name: manualName.trim(), latitude: location.latitude, longitude: location.longitude, locality: location.locality, administrativeRegion: location.administrativeRegion, countryCode: location.countryCode, address: manualAddress.trim(), currencyCode: location.currencyCode });
    setRestaurantConfirmed(false);
  }

  const ready = Boolean(selectedRestaurant && priceKnowledge && availabilityKnowledge && (priceKnowledge === 'unknown' || Number(priceAmount) > 0) && (availabilityKnowledge !== 'historical' || lastConfirmedAt) && reviewConfirmed && restaurantConfirmed);
  function publishReviewed() {
    if (!ready || !selectedRestaurant || !priceKnowledge || !availabilityKnowledge) { setRestaurantStatus(t('publish.requirements')); return; }
    onPublish({ restaurant: selectedRestaurant, knowledge: { priceKnowledge, priceAmount: priceKnowledge === 'unknown' ? undefined : Number(priceAmount), availabilityKnowledge, lastConfirmedAt: availabilityKnowledge === 'historical' ? lastConfirmedAt : undefined }, retainImage, reviewConfirmed: true, restaurantConfirmed: true });
  }
  function editAnalysis(field: 'name' | 'cuisine' | 'ingredients' | 'dietary' | 'description', value: string) {
    onAnalysisChange({ ...analysis, [field]: value, canonical: { ...analysis.canonical, ...(field === 'name' ? { dishName: value.trim().toLowerCase() } : {}), ...(field === 'cuisine' ? { cuisine: value.trim().toLowerCase() } : {}), ...(field === 'ingredients' ? { ingredients: value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean) } : {}), metadataSource: 'user_reviewed' } });
  }
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe}>
        <KeyboardAvoidingView style={styles.modalKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}><View><Text style={styles.wordmark}>Trinque</Text><Text style={styles.headerEyebrow}>{t('home.analyze')}</Text></View><Pressable accessibilityLabel={t('settings.close')} style={styles.closeButton} onPress={onClose}><Text style={styles.closeButtonText}>×</Text></Pressable></View>
          {phase === 'choose' && (
            <View style={styles.choosePanel}>
              <View style={styles.scanMark}><Text style={styles.scanMarkText}>⌁</Text></View>
              <Text style={styles.modalKicker}>{t('home.analyze').toUpperCase()}</Text><Text style={styles.modalTitle}>{t('analysis.reviewTitle')}</Text><Text style={styles.modalBody}>{t('analysis.warning')}</Text>
              <Pressable style={({ pressed }) => [styles.primaryButton, styles.modalButton, pressed && styles.pressed]} onPress={() => onChoose(true)}><Text style={styles.primaryButtonText}>{t('analysis.openCamera')}</Text><Text style={styles.primaryArrow}>→</Text></Pressable>
              <Pressable style={({ pressed }) => [styles.secondaryButton, styles.modalButton, pressed && styles.pressed]} onPress={() => onChoose(false)}><Text style={styles.secondaryButtonText}>{t('analysis.chooseLibrary')}</Text></Pressable>
              <Pressable onPress={onDemo}><Text style={styles.demoLink}>{t('home.demo')}</Text></Pressable>
            </View>
          )}
          {phase === 'analyzing' && (
            <View style={styles.analyzingPanel}>{preview ? <Image source={{ uri: preview }} style={styles.analysisPreview} /> : <View style={[styles.analysisPreview, styles.demoPreview]}><Text style={styles.demoPreviewText}>T</Text></View>}<View style={styles.analysisScrim}><ActivityIndicator color={palette.cream} size="large" /><Text style={styles.analyzingTitle}>{t('analysis.loadingKicker')}</Text><Text style={styles.analyzingBody}>{t('analysis.loadingTitle')}</Text></View></View>
          )}
          {phase === 'error' && (
            <View style={styles.publishedPanel}>
              <View style={styles.errorMark}><Text style={styles.successMarkText}>!</Text></View>
              <Text style={styles.modalKicker}>{t('analysis.unavailableKicker').toUpperCase()}</Text>
              <Text style={styles.modalTitle}>{t('analysis.unavailableTitle')}</Text>
              <Text style={styles.modalBody}>{error}</Text>
              <Pressable disabled={!imageDataUrl} style={({ pressed }) => [styles.primaryButton, styles.modalButton, pressed && styles.pressed, !imageDataUrl && styles.disabledButton]} onPress={onRetry}><Text style={styles.primaryButtonText}>{t('analysis.retry')}</Text><Text style={styles.primaryArrow}>→</Text></Pressable>
              <Pressable style={({ pressed }) => [styles.secondaryButton, styles.modalButton, pressed && styles.pressed]} onPress={onDemo}><Text style={styles.secondaryButtonText}>{t('analysis.useDemo')}</Text></Pressable>
            </View>
          )}
          {phase === 'review' && (
            <ScrollView style={styles.reviewScroll} contentContainerStyle={styles.reviewContent} keyboardShouldPersistTaps="handled">
              {preview ? <Image source={{ uri: preview }} style={styles.reviewImage} /> : null}
              <View style={[styles.modeBadge, analysisMode === 'demo' && styles.modeBadgeDemo]}><Text style={[styles.modeBadgeText, analysisMode === 'demo' && styles.modeBadgeTextDemo]}>{analysisMode === 'live' ? `● ${t('analysis.live').toUpperCase()}` : `◇ ${t('analysis.demo').toUpperCase()}`}</Text></View>
              <Text style={styles.modalKicker}>{t('analysis.review').toUpperCase()}</Text>
              <View style={styles.confidenceLine}><Text style={styles.reviewTitle}>{t('analysis.reviewTitle')}</Text><Text style={styles.confidenceBadge}>{t('analysis.confident', { confidence: analysis.confidence })}</Text></View>
              <View style={styles.warningBox}><Text style={styles.warningIcon}>!</Text><Text style={styles.warningText}>{t('analysis.warning')}</Text></View>
              <Pressable onPress={() => onFeedback('wrong_identification', 'analysis')}><Text style={styles.demoLink}>{t('feedback.wrongIdentification')}</Text></Pressable>
              {warning ? <View style={styles.demoWarning}><Text style={styles.demoWarningText}>{warning}</Text></View> : null}
              <Field label={t('analysis.field.name')} value={analysis.name} onChangeText={(value) => editAnalysis('name', value)} />
              <Field label={t('analysis.field.cuisine')} value={analysis.cuisine} onChangeText={(value) => editAnalysis('cuisine', value)} />
              <Field label={t('analysis.field.dietary')} value={analysis.dietary} onChangeText={(value) => editAnalysis('dietary', value)} />
              <Field label={t('analysis.field.ingredients')} value={analysis.ingredients} onChangeText={(value) => editAnalysis('ingredients', value)} multiline />
              <Field label={t('analysis.field.description')} value={analysis.description} onChangeText={(value) => editAnalysis('description', value)} multiline />
              <Text style={styles.canonicalNotice}>{t('analysis.canonicalNotice')}</Text>
              <View style={styles.publicationSection}><Text style={styles.publicationTitle}>{t('publish.restaurantTitle')}</Text><Text style={styles.publicationHelp}>{t('publish.restaurantHelp')}</Text>
                <Pressable style={styles.secondaryButton} onPress={() => void findRestaurants()}><Text style={styles.secondaryButtonText}>{t('publish.findRestaurants')}</Text></Pressable>
                {restaurants.map((place) => <Pressable key={place.providerPlaceId} style={[styles.restaurantOption, selectedRestaurant?.providerPlaceId === place.providerPlaceId && styles.restaurantOptionSelected]} onPress={() => selectProviderRestaurant(place)}><Text style={styles.restaurantName}>{place.displayName}</Text><Text style={styles.restaurantAddress}>{place.address}</Text></Pressable>)}
                {restaurants.length > 0 ? <Text style={styles.googleAttribution}>{t('publish.googleAttribution')}</Text> : null}
                {restaurantStatus ? <Text style={styles.publicationStatus}>{restaurantStatus}</Text> : null}
                <Text style={styles.fieldLabel}>{t('publish.manualRestaurant')}</Text><TextInput style={styles.fieldInput} placeholder={t('publish.restaurantName')} placeholderTextColor={palette.muted} value={manualName} onChangeText={setManualName} /><TextInput style={styles.fieldInput} placeholder={t('publish.restaurantAddress')} placeholderTextColor={palette.muted} value={manualAddress} onChangeText={setManualAddress} />
                <Pressable style={styles.secondaryButton} onPress={useManualRestaurant}><Text style={styles.secondaryButtonText}>{t('publish.selectRestaurant')}</Text></Pressable>
                {selectedRestaurant ? <Text style={styles.selectedRestaurant}>✓ {t('publish.selectedRestaurant', { restaurant: selectedRestaurant.name })}</Text> : null}
              </View>
              <View style={styles.publicationSection}><Text style={styles.publicationTitle}>{t('publish.knowledgeTitle')}</Text><Text style={styles.fieldLabel}>{t('publish.priceKnowledge')}</Text><View style={styles.choiceRow}>{(['unknown', 'exact', 'approximate'] as const).map((value) => <Choice key={value} selected={priceKnowledge === value} label={t(value === 'unknown' ? 'publish.priceUnknown' : value === 'exact' ? 'publish.priceExact' : 'publish.priceApproximate')} onPress={() => setPriceKnowledge(value)} />)}</View>
                {priceKnowledge === 'exact' || priceKnowledge === 'approximate' ? <Field label={t('publish.priceAmount', { currency: location?.currencyCode ?? selectedRestaurant?.currencyCode ?? '' })} value={priceAmount} onChangeText={setPriceAmount} /> : null}
                <Text style={styles.fieldLabel}>{t('publish.availabilityKnowledge')}</Text><View style={styles.choiceRow}>{(['unknown', 'recently_confirmed', 'historical'] as const).map((value) => <Choice key={value} selected={availabilityKnowledge === value} label={t(value === 'unknown' ? 'publish.availabilityUnknown' : value === 'recently_confirmed' ? 'publish.availabilityRecent' : 'publish.availabilityHistorical')} onPress={() => setAvailabilityKnowledge(value)} />)}</View>
                {availabilityKnowledge === 'historical' ? <Field label={t('publish.lastSeen')} value={lastConfirmedAt} onChangeText={setLastConfirmedAt} /> : null}
                <Text style={styles.provenancePreview}>{t('publish.provenancePreview', { provenance: t(analysisMode === 'demo' ? 'provenance.seed_demo' : 'provenance.ai_identified'), verification: t('verification.unverified'), availability: t(availabilityKnowledge === 'recently_confirmed' ? 'availability.confirmed' : 'availability.unknown') })}</Text>
                <Toggle selected={retainImage} label={t('publish.retainImage')} onPress={() => setRetainImage((value) => !value)} /><Text style={styles.privacyText}>{t('privacy.imageRetentionDetails')}</Text>
                <Toggle selected={reviewConfirmed} label={t('publish.reviewConfirm')} onPress={() => setReviewConfirmed((value) => !value)} /><Toggle selected={restaurantConfirmed} disabled={!selectedRestaurant} label={t('publish.restaurantConfirm')} onPress={() => setRestaurantConfirmed((value) => !value)} />
              </View>
              <Pressable disabled={publishing || !ready} style={({ pressed }) => [styles.primaryButton, styles.publishButton, pressed && styles.pressed, (publishing || !ready) && styles.disabledButton]} onPress={publishReviewed}><Text style={styles.primaryButtonText}>{publishing ? t('analysis.publishing') : t('analysis.publish')}</Text><Text style={styles.primaryArrow}>→</Text></Pressable>
            </ScrollView>
          )}
          {phase === 'published' && (
            <View style={styles.publishedPanel}>
              <View style={styles.successMark}><Text style={styles.successMarkText}>✓</Text></View><Text style={styles.modalKicker}>{t('analysis.publishedTitle').toUpperCase()}</Text><Text style={styles.modalTitle}>{analysis.name}</Text><Text style={styles.modalBody}>{t('analysis.publishedBody', { count: matches.confirmedNearbyDishes.length + matches.communityOrInferredDishes.length + matches.restaurantLevelAlternatives.length })}</Text>
              {matchProviderUnavailable ? <Text style={styles.publicationStatus}>{t('match.providerUnavailable')}</Text> : null}
              {matchRecordsUnavailable ? <Text style={styles.publicationStatus}>{t('match.recordsUnavailable')}</Text> : null}
              <ScrollView style={styles.mobileMatches}><MobileMatchTier title={t('match.confirmedTier')} results={matches.confirmedNearbyDishes} t={t} language={language} measurementSystem={measurementSystem} onFeedback={onFeedback} /><MobileMatchTier title={t('match.communityTier')} results={matches.communityOrInferredDishes} t={t} language={language} measurementSystem={measurementSystem} onFeedback={onFeedback} /><MobileMatchTier title={t('match.restaurantTier')} results={matches.restaurantLevelAlternatives} t={t} language={language} measurementSystem={measurementSystem} onFeedback={onFeedback} /></ScrollView>
              <Pressable style={({ pressed }) => [styles.primaryButton, styles.modalButton, pressed && styles.pressed]} onPress={() => { onMatchOpened(); onClose(); }}><Text style={styles.primaryButtonText}>{t('analysis.explore')}</Text><Text style={styles.primaryArrow}>→</Text></Pressable>
              <Pressable onPress={onReset}><Text style={styles.demoLink}>{t('analysis.another')}</Text></Pressable>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function MobileMatchTier({ title, results, t, language, measurementSystem, onFeedback }: { title: string; results: MatchResult[]; t: Translator; language: UiLanguage; measurementSystem: MeasurementSystem; onFeedback: (reason: FeedbackReason, targetType: 'analysis' | 'published_dish' | 'restaurant', targetId?: string | null) => void }) {
  return <View style={styles.mobileMatchTier}><Text style={styles.mobileMatchTierTitle}>{title}</Text>{results.length === 0 ? <Text style={styles.mobileMatchEmpty}>{t('match.noResults')}</Text> : results.slice(0, 4).map((match) => {
    const distance = new Intl.NumberFormat(language, { style: 'unit', unit: measurementSystem === 'imperial' ? 'mile' : 'kilometer', unitDisplay: 'short', maximumFractionDigits: 1 }).format(measurementSystem === 'imperial' ? match.distanceKm * .621371 : match.distanceKm);
    const provenance = match.provenance === 'provider_place' ? t('match.providerPlace') : t(`provenance.${match.provenance}` as MessageKey);
    const verification = match.verificationStatus === 'not_applicable' ? t('match.notApplicable') : t(`verification.${match.verificationStatus}` as MessageKey);
    const reason = t(match.reasonCode === 'restaurant_only' ? 'match.restaurantReason' : match.reasonCode === 'semantic_and_distance' ? 'match.semanticReason' : 'match.nearbyReason');
    const price = match.priceAmount != null && match.currencyCode ? new Intl.NumberFormat(language, { style: 'currency', currency: match.currencyCode }).format(match.priceAmount) : null;
    return <View key={match.id} style={styles.mobileMatch}>{match.imageUrl ? <Image source={{ uri: match.imageUrl }} style={styles.mobileMatchImage} /> : <View style={[styles.mobileMatchImage, styles.mobileMatchPlaceholder]}><Text style={styles.mobileMatchPlaceholderText}>T</Text></View>}<View style={styles.mobileMatchCopy}><View style={styles.mobileMatchTitle}><Text style={styles.mobileMatchName}>{match.dishName ?? match.restaurantName}</Text><Text style={styles.mobileMatchScore}>{match.score}%</Text></View><Text style={styles.mobileMatchPlace}>{match.dishName ? `${match.restaurantName} · ` : ''}{distance}{price ? ` · ${price}` : ''}</Text><Text style={styles.mobileMatchReason}>{reason}</Text><Text style={styles.mobileMatchMeta}>{provenance} · {verification}</Text><Text style={styles.mobileMatchMeta}>{match.lastConfirmedAt ? t('match.lastConfirmed', { date: new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(match.lastConfirmedAt)) }) : t('match.neverConfirmed')}</Text><Text style={styles.mobileMatchMeta}>{match.currentAvailabilityConfirmed ? t('availability.confirmed') : t('availability.unknown')}</Text><Text style={styles.mobileMatchCaveat}>{match.dietaryCaveat}</Text>{match.attribution ? <Text style={styles.googleAttribution}>Google Maps</Text> : null}<Pressable onPress={() => onFeedback(match.kind === 'dish' ? 'stale_dish' : 'closed_restaurant', match.kind === 'dish' ? 'published_dish' : 'restaurant', match.id)}><Text style={styles.demoLink}>{t(match.kind === 'dish' ? 'feedback.staleDish' : 'feedback.closedRestaurant')}</Text></Pressable></View></View>;
  })}</View>;
}

function Field({ label, value, onChangeText, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput style={[styles.fieldInput, multiline && styles.fieldTextarea]} value={value} onChangeText={onChangeText} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} selectionColor={palette.terracotta} /></View>;
}

function Choice({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) {
  return <Pressable style={[styles.choice, selected && styles.choiceSelected]} onPress={onPress}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>;
}

function Toggle({ selected, disabled = false, label, onPress }: { selected: boolean; disabled?: boolean; label: string; onPress: () => void }) {
  return <Pressable disabled={disabled} style={[styles.confirmation, disabled && styles.disabledButton]} onPress={onPress}><Text style={styles.confirmationMark}>{selected ? '✓' : '○'}</Text><Text style={styles.confirmationText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.cream },
  appShell: { flex: 1 },
  screen: { flex: 1, backgroundColor: palette.cream },
  screenContent: { paddingBottom: 118 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  header: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wordmark: { color: palette.burgundy, fontSize: 31, lineHeight: 34, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), letterSpacing: -1.3 },
  headerEyebrow: { color: palette.muted, fontSize: 11, marginTop: 2, letterSpacing: 0.35 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.burgundy, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: palette.blush },
  headerAvatarText: { color: palette.cream, fontSize: 12, fontWeight: '800' },
  hero: { marginHorizontal: 14, backgroundColor: palette.burgundyDark, padding: 24, borderRadius: 28, overflow: 'hidden' },
  heroKicker: { color: palette.terracotta, fontSize: 11, fontWeight: '900', letterSpacing: 1.7, marginBottom: 10 },
  heroTitle: { color: palette.cream, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 38, lineHeight: 42, letterSpacing: -1.4, maxWidth: 320 },
  heroBody: { color: '#EEDFD9', fontSize: 15, lineHeight: 22, marginTop: 13, marginBottom: 23 },
  primaryButton: { minHeight: 62, backgroundColor: palette.terracotta, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  primaryButtonIcon: { color: palette.cream, fontSize: 29, width: 28 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  primaryButtonSubtext: { color: '#F9DFD9', fontSize: 11, marginTop: 2 },
  primaryArrow: { marginLeft: 'auto', color: '#FFFFFF', fontSize: 23 },
  sectionHeading: { paddingHorizontal: 22, paddingTop: 32, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  sectionKicker: { color: palette.terracotta, fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginBottom: 5 },
  sectionTitle: { color: palette.ink, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 24, letterSpacing: -0.7 },
  sectionAction: { color: palette.burgundy, fontSize: 12, fontWeight: '800', paddingBottom: 4 },
  seededNotice: { alignSelf: 'flex-start', borderWidth: 1, borderColor: palette.warning, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginTop: -8, marginBottom: 18 },
  seededNoticeText: { color: palette.warning, fontSize: 11, fontWeight: '700' },
  cardRow: { paddingHorizontal: 18, paddingBottom: 8, gap: 14 },
  dishCard: { width: 294, backgroundColor: palette.paper, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: palette.line },
  dishImage: { width: '100%', height: 190, backgroundColor: palette.blush },
  matchBadge: { position: 'absolute', left: 12, top: 12, overflow: 'hidden', backgroundColor: palette.cream, color: palette.burgundy, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, fontSize: 11, fontWeight: '900' },
  heartButton: { position: 'absolute', right: 12, top: 12, width: 38, height: 38, backgroundColor: palette.paper, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  heartText: { color: palette.burgundy, fontSize: 23 },
  heartTextSaved: { color: palette.terracotta },
  dishBody: { padding: 17 },
  dishTitleLine: { flexDirection: 'row', gap: 8, justifyContent: 'space-between', alignItems: 'flex-start' },
  dishName: { flex: 1, color: palette.ink, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 21, lineHeight: 24 },
  dishPrice: { color: palette.burgundy, fontSize: 14, fontWeight: '900' },
  dishRestaurant: { color: palette.terracotta, fontSize: 11, fontWeight: '800', marginTop: 5 },
  dishNote: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 10 },
  dishTags: { flexDirection: 'row', gap: 7, marginTop: 13, flexWrap: 'wrap' },
  dishTag: { color: palette.olive, backgroundColor: palette.sage, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, overflow: 'hidden', fontSize: 10, fontWeight: '800' },
  tasteCard: { marginHorizontal: 18, marginTop: 26, backgroundColor: palette.sage, padding: 21, borderRadius: 23 },
  tasteTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tasteKicker: { color: palette.olive, fontWeight: '900', letterSpacing: 1.4, fontSize: 10 },
  tastePercent: { color: palette.olive, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 26 },
  tasteTitle: { color: palette.ink, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 24, lineHeight: 28, marginTop: 12 },
  tasteBody: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 9 },
  tasteTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 17 },
  tasteTag: { borderWidth: 1, borderColor: '#C9CBA8', paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14 },
  tasteTagStrong: { backgroundColor: palette.olive, borderColor: palette.olive },
  tasteTagText: { color: palette.olive, fontSize: 11, fontWeight: '800' },
  tasteTagTextStrong: { color: '#FFFFFF' },
  editorialNote: { color: palette.burgundy, fontFamily: Platform.select({ ios: 'Georgia-Italic', default: 'serif' }), textAlign: 'center', fontSize: 17, lineHeight: 24, paddingHorizontal: 54, paddingVertical: 34 },
  pageIntro: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 25 },
  pageTitle: { color: palette.ink, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 36, lineHeight: 41, letterSpacing: -1.2 },
  pageBody: { color: palette.muted, fontSize: 14, lineHeight: 21, marginTop: 10 },
  planCard: { marginHorizontal: 18, backgroundColor: palette.burgundyDark, borderRadius: 24, padding: 20 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planEyebrow: { color: '#DDA998', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  planTitle: { color: palette.cream, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 25, marginTop: 4 },
  avatarStack: { flexDirection: 'row', width: 84 },
  avatar: { width: 32, height: 32, borderRadius: 16, textAlign: 'center', paddingTop: 9, overflow: 'hidden', backgroundColor: palette.terracotta, color: '#FFFFFF', fontSize: 9, fontWeight: '900', borderWidth: 2, borderColor: palette.burgundyDark },
  avatarTwo: { marginLeft: -7, backgroundColor: palette.olive },
  avatarThree: { marginLeft: -7, backgroundColor: '#A86B75' },
  constraintRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 18 },
  constraint: { backgroundColor: '#FFFFFF14', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12 },
  constraintText: { color: '#F6E9E5', fontSize: 10, fontWeight: '700' },
  voteCard: { marginHorizontal: 18, marginBottom: 13, backgroundColor: palette.paper, borderRadius: 20, padding: 11, flexDirection: 'row', borderWidth: 1, borderColor: palette.line },
  voteImage: { width: 104, minHeight: 145, borderRadius: 14, backgroundColor: palette.blush },
  voteInfo: { flex: 1, paddingLeft: 13 },
  voteMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fitBadge: { color: palette.olive, backgroundColor: palette.sage, fontSize: 9, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9, overflow: 'hidden' },
  votePrice: { color: palette.burgundy, fontWeight: '900', fontSize: 12 },
  voteName: { color: palette.ink, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 18, marginTop: 8 },
  voteReason: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  voteButton: { borderTopWidth: 1, borderTopColor: palette.line, marginTop: 'auto', paddingTop: 9 },
  voteButtonText: { color: palette.terracotta, fontSize: 11, fontWeight: '900' },
  disabledButton: { opacity: 0.6 },
  ineligibleCard: { opacity: 0.58 },
  lockButton: { marginHorizontal: 18, marginTop: 7, justifyContent: 'center' },
  mobileFinalPlan: { marginHorizontal: 18, marginTop: 8, padding: 20, borderRadius: 21, backgroundColor: palette.burgundy },
  mobileFinalTitle: { color: palette.cream, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 25, marginTop: 7 },
  mobileFinalBody: { color: '#EEDFD9', fontSize: 12, lineHeight: 18, marginTop: 8 },
  mobileFinalActions: { flexDirection: 'row', gap: 9, marginTop: 16 },
  finalAction: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: '#FFFFFF55', borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  finalActionText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },
  savedCard: { marginHorizontal: 18, marginBottom: 14, minHeight: 148, backgroundColor: palette.paper, borderRadius: 21, borderWidth: 1, borderColor: palette.line, padding: 10, flexDirection: 'row' },
  savedImage: { width: 112, borderRadius: 15, backgroundColor: palette.blush },
  savedInfo: { flex: 1, padding: 12 },
  savedName: { color: palette.ink, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 19, paddingRight: 20 },
  savedRestaurant: { color: palette.terracotta, fontSize: 10, fontWeight: '800', marginTop: 5 },
  savedNote: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 9 },
  savedHeart: { position: 'absolute', right: 13, top: 11 },
  savedHeartText: { color: palette.terracotta, fontSize: 20 },
  emptyCard: { marginHorizontal: 18, backgroundColor: palette.paper, borderRadius: 24, borderWidth: 1, borderColor: palette.line, padding: 30, alignItems: 'center' },
  emptyIcon: { color: palette.terracotta, fontSize: 42 },
  emptyTitle: { color: palette.ink, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 23, marginTop: 8 },
  emptyBody: { color: palette.muted, textAlign: 'center', fontSize: 13, lineHeight: 20, marginTop: 9 },
  secondaryButton: { borderWidth: 1.5, borderColor: palette.terracotta, borderRadius: 17, minHeight: 52, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  secondaryButtonText: { color: palette.terracotta, fontWeight: '900', fontSize: 14 },
  profileHero: { alignItems: 'center', paddingTop: 12 },
  profileAvatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.burgundy, borderWidth: 6, borderColor: palette.blush },
  profileInitials: { color: palette.cream, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 25 },
  profileName: { color: palette.ink, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 28, marginTop: 12 },
  profileHandle: { color: palette.muted, fontSize: 12, marginTop: 4 },
  profileStats: { marginHorizontal: 18, marginTop: 23, backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.line, borderRadius: 20, flexDirection: 'row', paddingVertical: 17 },
  profileStat: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: palette.line },
  profileStatValue: { color: palette.burgundy, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 22 },
  profileStatLabel: { color: palette.muted, fontSize: 10, marginTop: 3 },
  preferenceCard: { margin: 18, backgroundColor: palette.paper, borderRadius: 22, borderWidth: 1, borderColor: palette.line, padding: 19 },
  preferenceKicker: { color: palette.terracotta, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  preferenceTitle: { color: palette.ink, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 21, marginTop: 6, marginBottom: 9 },
  preferenceRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, paddingVertical: 14, borderTopWidth: 1, borderTopColor: palette.line },
  preferenceLabel: { color: palette.muted, fontSize: 12 },
  preferenceValue: { flex: 1, textAlign: 'right', color: palette.ink, fontSize: 12, fontWeight: '700' },
  settingsChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 18 },
  settingsChoice: { borderWidth: 1, borderColor: palette.line, backgroundColor: palette.cream, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 15 },
  settingsChoiceActive: { backgroundColor: palette.burgundy, borderColor: palette.burgundy },
  settingsChoiceText: { color: palette.ink, fontSize: 11, fontWeight: '800' },
  settingsChoiceTextActive: { color: palette.cream },
  locationInput: { minHeight: 50, marginTop: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.cream, color: palette.ink, borderRadius: 14, paddingHorizontal: 13 },
  locationSuggestion: { marginTop: 9, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.cream, borderRadius: 14, padding: 12 },
  googleAttribution: { color: palette.muted, fontFamily: 'AvenirNext-Regular', fontSize: 12, fontWeight: '400', paddingTop: 6 },
  privacyText: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 16 },
  safetyCard: { marginHorizontal: 18, backgroundColor: palette.sage, borderRadius: 19, padding: 16, flexDirection: 'row', gap: 12 },
  safetyIcon: { width: 24, height: 24, textAlign: 'center', paddingTop: 3, borderRadius: 12, overflow: 'hidden', backgroundColor: palette.olive, color: '#FFFFFF', fontWeight: '900' },
  safetyCopy: { flex: 1 },
  safetyTitle: { color: palette.ink, fontWeight: '800', fontSize: 12 },
  safetyBody: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  tabBar: { position: 'absolute', left: 12, right: 12, bottom: 8, height: 76, backgroundColor: palette.paper, borderRadius: 25, borderWidth: 1, borderColor: palette.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, shadowColor: '#4C1725', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: 62 },
  tabIcon: { color: palette.muted, fontSize: 22, lineHeight: 23 },
  tabLabel: { color: palette.muted, fontSize: 9, fontWeight: '700' },
  tabActive: { color: palette.burgundy, fontWeight: '900' },
  cameraButton: { width: 57, height: 57, borderRadius: 19, backgroundColor: palette.terracotta, alignItems: 'center', justifyContent: 'center', marginHorizontal: 3, shadowColor: palette.terracotta, shadowOpacity: 0.32, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  cameraButtonIcon: { color: '#FFFFFF', fontSize: 30 },
  modalSafe: { flex: 1, backgroundColor: palette.cream },
  modalKeyboard: { flex: 1 },
  modalHeader: { paddingHorizontal: 22, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: palette.line },
  closeButton: { width: 39, height: 39, borderRadius: 20, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { color: palette.burgundy, fontSize: 28, lineHeight: 30 },
  choosePanel: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 42 },
  scanMark: { width: 94, height: 94, borderRadius: 29, backgroundColor: palette.blush, alignItems: 'center', justifyContent: 'center', marginBottom: 25 },
  scanMarkText: { color: palette.burgundy, fontSize: 52 },
  modalKicker: { color: palette.terracotta, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 9 },
  modalTitle: { color: palette.ink, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 34, lineHeight: 39, letterSpacing: -1 },
  modalBody: { color: palette.muted, fontSize: 14, lineHeight: 22, marginTop: 12, marginBottom: 22 },
  modalButton: { width: '100%', marginTop: 12, justifyContent: 'center' },
  demoLink: { color: palette.burgundy, textAlign: 'center', fontSize: 12, fontWeight: '800', textDecorationLine: 'underline', marginTop: 21 },
  analyzingPanel: { flex: 1, backgroundColor: palette.burgundyDark },
  analysisPreview: { width: '100%', height: '100%', opacity: 0.62 },
  demoPreview: { backgroundColor: palette.burgundy, alignItems: 'center', justifyContent: 'center' },
  demoPreviewText: { color: palette.cream, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 180 },
  analysisScrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: '#240B13AA' },
  analyzingTitle: { color: palette.cream, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 28, marginTop: 21 },
  analyzingBody: { color: '#EEDFD9', textAlign: 'center', fontSize: 13, marginTop: 8 },
  reviewScroll: { flex: 1 },
  reviewContent: { padding: 22, paddingBottom: 46 },
  reviewImage: { width: '100%', height: 190, borderRadius: 22, backgroundColor: palette.blush, marginBottom: 22 },
  confidenceLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  reviewTitle: { flex: 1, color: palette.ink, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 27, lineHeight: 31 },
  confidenceBadge: { color: palette.olive, backgroundColor: palette.sage, fontWeight: '900', fontSize: 13, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, overflow: 'hidden' },
  warningBox: { backgroundColor: palette.blush, padding: 13, borderRadius: 15, flexDirection: 'row', gap: 10, marginVertical: 18 },
  warningIcon: { width: 21, height: 21, textAlign: 'center', paddingTop: 2, borderRadius: 11, overflow: 'hidden', color: '#FFFFFF', backgroundColor: palette.terracotta, fontWeight: '900', fontSize: 12 },
  warningText: { flex: 1, color: palette.burgundyDark, fontSize: 11, lineHeight: 16 },
  field: { marginBottom: 15 },
  fieldLabel: { color: palette.burgundy, fontSize: 10, fontWeight: '900', letterSpacing: 0.7, marginBottom: 6, textTransform: 'uppercase' },
  fieldInput: { minHeight: 51, backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.line, borderRadius: 14, paddingHorizontal: 14, color: palette.ink, fontSize: 14 },
  fieldTextarea: { minHeight: 84, paddingTop: 13, lineHeight: 20 },
  canonicalNotice: { color: palette.muted, fontSize: 11, lineHeight: 17, marginBottom: 16 },
  publicationSection: { borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 18, marginTop: 10, gap: 10 },
  publicationTitle: { color: palette.ink, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 22 },
  publicationHelp: { color: palette.muted, fontSize: 11, lineHeight: 17 },
  restaurantOption: { borderWidth: 1, borderColor: palette.line, backgroundColor: palette.paper, borderRadius: 14, padding: 12 },
  restaurantOptionSelected: { borderColor: palette.burgundy, borderWidth: 2 },
  restaurantName: { color: palette.ink, fontSize: 14, fontWeight: '800' },
  restaurantAddress: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  publicationStatus: { color: palette.warning, fontSize: 11, lineHeight: 16 },
  selectedRestaurant: { color: palette.success, fontSize: 11, fontWeight: '800' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 7 },
  choice: { borderWidth: 1, borderColor: palette.line, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: palette.paper },
  choiceSelected: { borderColor: palette.burgundy, backgroundColor: palette.blush },
  choiceText: { color: palette.muted, fontSize: 10, maxWidth: 180 },
  choiceTextSelected: { color: palette.burgundy, fontWeight: '800' },
  provenancePreview: { color: palette.success, backgroundColor: palette.sage, padding: 11, borderRadius: 12, fontSize: 11, lineHeight: 16 },
  confirmation: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 5 },
  confirmationMark: { color: palette.burgundy, fontSize: 18, width: 20 },
  confirmationText: { flex: 1, color: palette.ink, fontSize: 11, lineHeight: 17 },
  publishButton: { marginTop: 8, justifyContent: 'center' },
  publishedPanel: { flex: 1, justifyContent: 'center', padding: 28 },
  successMark: { width: 79, height: 79, borderRadius: 40, backgroundColor: palette.olive, alignItems: 'center', justifyContent: 'center', marginBottom: 25 },
  errorMark: { width: 79, height: 79, borderRadius: 40, backgroundColor: palette.terracotta, alignItems: 'center', justifyContent: 'center', marginBottom: 25 },
  successMarkText: { color: '#FFFFFF', fontSize: 38, fontWeight: '500' },
  resultStrip: { flexDirection: 'row', backgroundColor: palette.paper, borderRadius: 18, borderWidth: 1, borderColor: palette.line, paddingVertical: 17, marginVertical: 20 },
  resultItem: { flex: 1, alignItems: 'center' },
  resultValue: { color: palette.burgundy, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 21 },
  resultLabel: { color: palette.muted, fontSize: 9, marginTop: 3 },
  modeBadge: { alignSelf: 'flex-start', backgroundColor: palette.sage, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, marginBottom: 13 },
  modeBadgeDemo: { backgroundColor: palette.blush },
  modeBadgeText: { color: palette.olive, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  modeBadgeTextDemo: { color: palette.terracotta },
  demoWarning: { backgroundColor: palette.blush, borderRadius: 14, padding: 12, marginTop: -6, marginBottom: 15 },
  demoWarningText: { color: palette.burgundy, fontSize: 11, lineHeight: 16 },
  mobileMatches: { maxHeight: 350, marginBottom: 8 },
  mobileMatchTier: { marginBottom: 14 },
  mobileMatchTierTitle: { color: palette.ink, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 16, marginBottom: 7 },
  mobileMatchEmpty: { color: palette.muted, fontSize: 10, padding: 10, borderWidth: 1, borderColor: palette.line, borderStyle: 'dashed', borderRadius: 11 },
  mobileMatch: { flexDirection: 'row', gap: 11, padding: 9, marginBottom: 8, backgroundColor: palette.paper, borderWidth: 1, borderColor: palette.line, borderRadius: 15 },
  mobileMatchImage: { width: 72, height: 72, borderRadius: 11, backgroundColor: palette.blush },
  mobileMatchPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: palette.burgundy },
  mobileMatchPlaceholderText: { color: palette.cream, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 24 },
  mobileMatchCopy: { flex: 1, justifyContent: 'center' },
  mobileMatchTitle: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  mobileMatchName: { flex: 1, color: palette.ink, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 14 },
  mobileMatchScore: { color: palette.olive, fontWeight: '900', fontSize: 11 },
  mobileMatchPlace: { color: palette.terracotta, fontWeight: '800', fontSize: 9, marginTop: 3 },
  mobileMatchReason: { color: palette.muted, fontSize: 9, lineHeight: 13, marginTop: 4 },
  mobileMatchMeta: { color: palette.terracotta, fontSize: 8, lineHeight: 12, marginTop: 2 },
  mobileMatchCaveat: { color: palette.warning, fontSize: 8, lineHeight: 12, marginTop: 3 },
});

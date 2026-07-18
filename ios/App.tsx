import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Tab = 'Discover' | 'Groups' | 'Saved' | 'Profile';
type AnalyzerPhase = 'choose' | 'analyzing' | 'review' | 'published';

type Analysis = {
  name: string;
  cuisine: string;
  ingredients: string;
  dietary: string;
  confidence: number;
  description: string;
};

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

const palette = {
  cream: '#FFF8EF',
  paper: '#FFFCF7',
  burgundy: '#7A263A',
  burgundyDark: '#4C1725',
  terracotta: '#C7654F',
  olive: '#777B45',
  ink: '#241B1D',
  muted: '#75686A',
  line: '#E8D9CE',
  blush: '#F6E1DC',
  sage: '#E9E9D7',
};

const sampleAnalysis: Analysis = {
  name: 'Brown butter agnolotti',
  cuisine: 'Northern Italian',
  ingredients: 'Filled pasta, brown butter, sage, lemon, parmesan',
  dietary: 'Vegetarian · Contains dairy and gluten',
  confidence: 94,
  description: 'Tender filled pasta with toasted butter, herbs and a bright citrus finish.',
};

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
  const [tab, setTab] = useState<Tab>('Discover');
  const [savedIds, setSavedIds] = useState<number[]>([2]);
  const [analyzerOpen, setAnalyzerOpen] = useState(false);
  const [phase, setPhase] = useState<AnalyzerPhase>('choose');
  const [preview, setPreview] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis>(sampleAnalysis);

  const savedDishes = useMemo(
    () => dishes.filter((dish) => savedIds.includes(dish.id)),
    [savedIds],
  );

  const openAnalyzer = () => {
    setPhase('choose');
    setPreview(null);
    setImageDataUrl(null);
    setAnalysis(sampleAnalysis);
    setAnalyzerOpen(true);
  };

  const choosePhoto = async (camera: boolean) => {
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera access needed', 'Allow camera access to identify a dish you are looking at.');
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
    setPhase('analyzing');
    try {
      if (!remoteApi) {
        await new Promise((resolve) => setTimeout(resolve, 950));
        setAnalysis(sampleAnalysis);
      } else {
        const response = await fetch(`${remoteApi}/api/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageDataUrl: dataUrl, demo }),
        });
        if (!response.ok) throw new Error('Analysis unavailable');
        setAnalysis((await response.json()) as Analysis);
      }
      setPhase('review');
    } catch {
      setAnalysis(sampleAnalysis);
      setPhase('review');
      Alert.alert('Demo analysis loaded', 'Live analysis was unavailable, so Trinque loaded its judge-safe demo result.');
    }
  };

  const toggleSaved = (dishId: number) => {
    setSavedIds((current) => current.includes(dishId) ? current.filter((id) => id !== dishId) : [...current, dishId]);
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.appShell}>
          {tab === 'Discover' && <DiscoverScreen savedIds={savedIds} onSave={toggleSaved} onAnalyze={openAnalyzer} />}
          {tab === 'Groups' && <GroupsScreen />}
          {tab === 'Saved' && <SavedScreen dishes={savedDishes} onSave={toggleSaved} onDiscover={() => setTab('Discover')} />}
          {tab === 'Profile' && <ProfileScreen />}
          <TabBar active={tab} onSelect={setTab} onAnalyze={openAnalyzer} />
        </View>
        <AnalyzerModal
          visible={analyzerOpen}
          phase={phase}
          preview={preview}
          imageDataUrl={imageDataUrl}
          analysis={analysis}
          onAnalysisChange={setAnalysis}
          onChoose={choosePhoto}
          onDemo={() => analyze(null, true)}
          onPublish={() => setPhase('published')}
          onClose={() => setAnalyzerOpen(false)}
          onReset={() => {
            setPhase('choose');
            setPreview(null);
            setImageDataUrl(null);
          }}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function DiscoverScreen({ savedIds, onSave, onAnalyze }: { savedIds: number[]; onSave: (id: number) => void; onAnalyze: () => void }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <Header eyebrow="Vancouver · Friday evening" />
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>DISHES, NOT LISTS</Text>
        <Text style={styles.heroTitle}>Find the bite you’re craving.</Text>
        <Text style={styles.heroBody}>Discover individual dishes, understand why they fit your taste, and make dinner plans your whole table can enjoy.</Text>
        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={onAnalyze}>
          <Text style={styles.primaryButtonIcon}>⌁</Text>
          <View>
            <Text style={styles.primaryButtonText}>Identify a dish</Text>
            <Text style={styles.primaryButtonSubtext}>Take or choose a photo</Text>
          </View>
          <Text style={styles.primaryArrow}>→</Text>
        </Pressable>
      </View>

      <SectionHeading kicker="FOR YOUR TASTE" title="Worth crossing town for" action="See all" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardRow}>
        {dishes.map((dish) => <DishCard key={dish.id} dish={dish} saved={savedIds.includes(dish.id)} onSave={() => onSave(dish.id)} />)}
      </ScrollView>

      <View style={styles.tasteCard}>
        <View style={styles.tasteTopLine}>
          <Text style={styles.tasteKicker}>YOUR TASTEPRINT</Text>
          <Text style={styles.tastePercent}>82%</Text>
        </View>
        <Text style={styles.tasteTitle}>Bright, savory, a little smoky.</Text>
        <Text style={styles.tasteBody}>You linger on dishes with citrus, toasted edges and deep umami. Trinque learns from every save.</Text>
        <View style={styles.tasteTags}>
          {['Umami', 'Citrus', 'Char', 'Herby'].map((tag, index) => (
            <View key={tag} style={[styles.tasteTag, index === 0 && styles.tasteTagStrong]}><Text style={[styles.tasteTagText, index === 0 && styles.tasteTagTextStrong]}>{tag}</Text></View>
          ))}
        </View>
      </View>
      <Text style={styles.editorialNote}>“A restaurant is a place. A dish is a reason to go.”</Text>
    </ScrollView>
  );
}

function GroupsScreen() {
  const [votes, setVotes] = useState({ pasta: 4, cod: 3, cauliflower: 2 });
  const [locked, setLocked] = useState(false);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <Header eyebrow="The decision room" />
      <View style={styles.pageIntro}>
        <Text style={styles.heroKicker}>GROUP FIT</Text>
        <Text style={styles.pageTitle}>Dinner without the group-chat spiral.</Text>
        <Text style={styles.pageBody}>Trinque balances everyone’s needs, then makes the tradeoffs visible.</Text>
      </View>

      <View style={styles.planCard}>
        <View style={styles.planHeader}>
          <View>
            <Text style={styles.planEyebrow}>TONIGHT · 7:30 PM</Text>
            <Text style={styles.planTitle}>Friday dinner</Text>
          </View>
          <View style={styles.avatarStack}><Text style={styles.avatar}>NK</Text><Text style={[styles.avatar, styles.avatarTwo]}>AM</Text><Text style={[styles.avatar, styles.avatarThree]}>+2</Text></View>
        </View>
        <View style={styles.constraintRow}>
          {['Under $35', '1 vegetarian', 'No peanuts', '< 20 min'].map((item) => <View key={item} style={styles.constraint}><Text style={styles.constraintText}>✓ {item}</Text></View>)}
        </View>
      </View>

      <SectionHeading kicker="BALANCED FOR EVERYONE" title="Three strong fits" action="" />
      {[
        { key: 'pasta' as const, dish: dishes[0], fit: 95, reason: 'Best overall taste match · vegetarian-friendly' },
        { key: 'cod' as const, dish: dishes[1], fit: 89, reason: 'Top pick for 3 people · confirm soy ingredients' },
        { key: 'cauliflower' as const, dish: dishes[2], fit: 86, reason: 'Safest dietary fit · easiest walk' },
      ].map(({ key, dish, fit, reason }) => (
        <View key={key} style={styles.voteCard}>
          <Image source={{ uri: dish.image }} style={styles.voteImage} />
          <View style={styles.voteInfo}>
            <View style={styles.voteMeta}><Text style={styles.fitBadge}>{fit}% fit</Text><Text style={styles.votePrice}>{dish.price}</Text></View>
            <Text style={styles.voteName}>{dish.name}</Text>
            <Text style={styles.voteReason}>{reason}</Text>
            <Pressable disabled={locked} style={({ pressed }) => [styles.voteButton, pressed && styles.pressed, locked && styles.disabledButton]} onPress={() => setVotes((current) => ({ ...current, [key]: current[key] + 1 }))}>
              <Text style={styles.voteButtonText}>{locked ? 'Voting closed' : `♡  Vote · ${votes[key]}`}</Text>
            </Pressable>
          </View>
        </View>
      ))}
      <Pressable style={({ pressed }) => [styles.primaryButton, styles.lockButton, pressed && styles.pressed]} onPress={() => setLocked((current) => !current)}>
        <Text style={styles.primaryButtonText}>{locked ? 'Reopen the table' : 'Lock the winner'}</Text><Text style={styles.primaryArrow}>{locked ? '↺' : '→'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function SavedScreen({ dishes: saved, onSave, onDiscover }: { dishes: Dish[]; onSave: (id: number) => void; onDiscover: () => void }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <Header eyebrow="Your shortlist" />
      <View style={styles.pageIntro}>
        <Text style={styles.heroKicker}>SAVED DISHES</Text>
        <Text style={styles.pageTitle}>A memory for every craving.</Text>
      </View>
      {saved.length ? saved.map((dish) => (
        <View key={dish.id} style={styles.savedCard}>
          <Image source={{ uri: dish.image }} style={styles.savedImage} />
          <View style={styles.savedInfo}><Text style={styles.savedName}>{dish.name}</Text><Text style={styles.savedRestaurant}>{dish.restaurant} · {dish.neighborhood}</Text><Text style={styles.savedNote}>{dish.note}</Text></View>
          <Pressable style={styles.savedHeart} onPress={() => onSave(dish.id)}><Text style={styles.savedHeartText}>♥</Text></Pressable>
        </View>
      )) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>♡</Text><Text style={styles.emptyTitle}>Nothing saved yet</Text><Text style={styles.emptyBody}>Save dishes that spark something. We’ll use them to sharpen your tasteprint.</Text>
          <Pressable style={styles.secondaryButton} onPress={onDiscover}><Text style={styles.secondaryButtonText}>Start discovering</Text></Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function ProfileScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <Header eyebrow="Taste profile" />
      <View style={styles.profileHero}>
        <View style={styles.profileAvatar}><Text style={styles.profileInitials}>CO</Text></View>
        <Text style={styles.profileName}>Chinonso</Text><Text style={styles.profileHandle}>Vancouver · exploring one dish at a time</Text>
      </View>
      <View style={styles.profileStats}>
        {[['18', 'Dishes'], ['7', 'Lists'], ['12', 'Friends']].map(([value, label]) => <View key={label} style={styles.profileStat}><Text style={styles.profileStatValue}>{value}</Text><Text style={styles.profileStatLabel}>{label}</Text></View>)}
      </View>
      <View style={styles.preferenceCard}>
        <Text style={styles.preferenceKicker}>YOUR PREFERENCES</Text>
        <Text style={styles.preferenceTitle}>What Trinque keeps in mind</Text>
        {[['Dietary', 'Flexible, vegetarian-curious'], ['Avoid', 'Peanuts'], ['Budget', 'Usually under $40'], ['Radius', 'Up to 25 minutes']].map(([label, value]) => (
          <View key={label} style={styles.preferenceRow}><Text style={styles.preferenceLabel}>{label}</Text><Text style={styles.preferenceValue}>{value}  ›</Text></View>
        ))}
      </View>
      <View style={styles.safetyCard}><Text style={styles.safetyIcon}>i</Text><View style={styles.safetyCopy}><Text style={styles.safetyTitle}>Taste guidance, not safety advice</Text><Text style={styles.safetyBody}>Dish details are estimates. Always confirm allergens and dietary needs with the restaurant.</Text></View></View>
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
      <View><Image source={{ uri: dish.image } as ImageSourcePropType} style={styles.dishImage} /><Text style={styles.matchBadge}>{dish.match}% match</Text><Pressable style={styles.heartButton} onPress={onSave}><Text style={[styles.heartText, saved && styles.heartTextSaved]}>{saved ? '♥' : '♡'}</Text></Pressable></View>
      <View style={styles.dishBody}>
        <View style={styles.dishTitleLine}><Text style={styles.dishName}>{dish.name}</Text><Text style={styles.dishPrice}>{dish.price}</Text></View>
        <Text style={styles.dishRestaurant}>{dish.restaurant} · {dish.neighborhood}</Text><Text style={styles.dishNote}>{dish.note}</Text>
        <View style={styles.dishTags}>{dish.tags.map((tag) => <Text key={tag} style={styles.dishTag}>{tag}</Text>)}</View>
      </View>
    </View>
  );
}

function TabBar({ active, onSelect, onAnalyze }: { active: Tab; onSelect: (tab: Tab) => void; onAnalyze: () => void }) {
  return (
    <View style={styles.tabBar}>
      {navItems.slice(0, 2).map((item) => <TabButton key={item.tab} {...item} active={active === item.tab} onPress={() => onSelect(item.tab)} />)}
      <Pressable accessibilityLabel="Identify a dish" style={({ pressed }) => [styles.cameraButton, pressed && styles.pressed]} onPress={onAnalyze}><Text style={styles.cameraButtonIcon}>⌁</Text></Pressable>
      {navItems.slice(2).map((item) => <TabButton key={item.tab} {...item} active={active === item.tab} onPress={() => onSelect(item.tab)} />)}
    </View>
  );
}

function TabButton({ tab, icon, active, onPress }: { tab: Tab; icon: string; active: boolean; onPress: () => void }) {
  return <Pressable style={styles.tabButton} onPress={onPress}><Text style={[styles.tabIcon, active && styles.tabActive]}>{icon}</Text><Text style={[styles.tabLabel, active && styles.tabActive]}>{tab}</Text></Pressable>;
}

function AnalyzerModal({ visible, phase, preview, analysis, onAnalysisChange, onChoose, onDemo, onPublish, onClose, onReset }: {
  visible: boolean;
  phase: AnalyzerPhase;
  preview: string | null;
  imageDataUrl: string | null;
  analysis: Analysis;
  onAnalysisChange: (value: Analysis) => void;
  onChoose: (camera: boolean) => void;
  onDemo: () => void;
  onPublish: () => void;
  onClose: () => void;
  onReset: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe}>
        <KeyboardAvoidingView style={styles.modalKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}><View><Text style={styles.wordmark}>Trinque</Text><Text style={styles.headerEyebrow}>Dish identification</Text></View><Pressable style={styles.closeButton} onPress={onClose}><Text style={styles.closeButtonText}>×</Text></Pressable></View>
          {phase === 'choose' && (
            <View style={styles.choosePanel}>
              <View style={styles.scanMark}><Text style={styles.scanMarkText}>⌁</Text></View>
              <Text style={styles.modalKicker}>START WITH A DISH</Text><Text style={styles.modalTitle}>What caught your eye?</Text><Text style={styles.modalBody}>Take a photo or choose one from your library. Trinque will suggest details for you to review.</Text>
              <Pressable style={({ pressed }) => [styles.primaryButton, styles.modalButton, pressed && styles.pressed]} onPress={() => onChoose(true)}><Text style={styles.primaryButtonText}>Open camera</Text><Text style={styles.primaryArrow}>→</Text></Pressable>
              <Pressable style={({ pressed }) => [styles.secondaryButton, styles.modalButton, pressed && styles.pressed]} onPress={() => onChoose(false)}><Text style={styles.secondaryButtonText}>Choose from library</Text></Pressable>
              <Pressable onPress={onDemo}><Text style={styles.demoLink}>No photo? Try the judge-safe demo</Text></Pressable>
            </View>
          )}
          {phase === 'analyzing' && (
            <View style={styles.analyzingPanel}>{preview ? <Image source={{ uri: preview }} style={styles.analysisPreview} /> : <View style={[styles.analysisPreview, styles.demoPreview]}><Text style={styles.demoPreviewText}>T</Text></View>}<View style={styles.analysisScrim}><ActivityIndicator color={palette.cream} size="large" /><Text style={styles.analyzingTitle}>Reading the dish…</Text><Text style={styles.analyzingBody}>Looking at texture, preparation and likely ingredients</Text></View></View>
          )}
          {phase === 'review' && (
            <ScrollView style={styles.reviewScroll} contentContainerStyle={styles.reviewContent} keyboardShouldPersistTaps="handled">
              {preview ? <Image source={{ uri: preview }} style={styles.reviewImage} /> : null}
              <Text style={styles.modalKicker}>REVIEW BEFORE PUBLISHING</Text>
              <View style={styles.confidenceLine}><Text style={styles.reviewTitle}>Trinque thinks it knows this dish.</Text><Text style={styles.confidenceBadge}>{analysis.confidence}%</Text></View>
              <View style={styles.warningBox}><Text style={styles.warningIcon}>!</Text><Text style={styles.warningText}>AI can miss ingredients. Confirm the details—especially allergens—before sharing.</Text></View>
              <Field label="Dish name" value={analysis.name} onChangeText={(name) => onAnalysisChange({ ...analysis, name })} />
              <Field label="Cuisine" value={analysis.cuisine} onChangeText={(cuisine) => onAnalysisChange({ ...analysis, cuisine })} />
              <Field label="Dietary notes" value={analysis.dietary} onChangeText={(dietary) => onAnalysisChange({ ...analysis, dietary })} />
              <Field label="Likely ingredients" value={analysis.ingredients} onChangeText={(ingredients) => onAnalysisChange({ ...analysis, ingredients })} multiline />
              <Field label="What makes it special" value={analysis.description} onChangeText={(description) => onAnalysisChange({ ...analysis, description })} multiline />
              <Pressable style={({ pressed }) => [styles.primaryButton, styles.publishButton, pressed && styles.pressed]} onPress={onPublish}><Text style={styles.primaryButtonText}>Publish this dish</Text><Text style={styles.primaryArrow}>→</Text></Pressable>
            </ScrollView>
          )}
          {phase === 'published' && (
            <View style={styles.publishedPanel}>
              <View style={styles.successMark}><Text style={styles.successMarkText}>✓</Text></View><Text style={styles.modalKicker}>ADDED TO TRINQUE</Text><Text style={styles.modalTitle}>{analysis.name}</Text><Text style={styles.modalBody}>We found 12 nearby dishes with a similar taste profile. Your tasteprint just got sharper.</Text>
              <View style={styles.resultStrip}>{[['12', 'Nearby'], ['96%', 'Top match'], ['$24', 'From']].map(([value, label]) => <View key={label} style={styles.resultItem}><Text style={styles.resultValue}>{value}</Text><Text style={styles.resultLabel}>{label}</Text></View>)}</View>
              <Pressable style={({ pressed }) => [styles.primaryButton, styles.modalButton, pressed && styles.pressed]} onPress={onClose}><Text style={styles.primaryButtonText}>Explore similar dishes</Text><Text style={styles.primaryArrow}>→</Text></Pressable>
              <Pressable onPress={onReset}><Text style={styles.demoLink}>Identify another dish</Text></Pressable>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function Field({ label, value, onChangeText, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput style={[styles.fieldInput, multiline && styles.fieldTextarea]} value={value} onChangeText={onChangeText} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} selectionColor={palette.terracotta} /></View>;
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
  cardRow: { paddingHorizontal: 18, paddingBottom: 8, gap: 14 },
  dishCard: { width: 294, backgroundColor: palette.paper, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: palette.line },
  dishImage: { width: '100%', height: 190, backgroundColor: palette.blush },
  matchBadge: { position: 'absolute', left: 12, top: 12, overflow: 'hidden', backgroundColor: palette.cream, color: palette.burgundy, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, fontSize: 11, fontWeight: '900' },
  heartButton: { position: 'absolute', right: 12, top: 12, width: 38, height: 38, backgroundColor: '#FFFCF7EE', borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
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
  lockButton: { marginHorizontal: 18, marginTop: 7, justifyContent: 'center' },
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
  safetyCard: { marginHorizontal: 18, backgroundColor: palette.sage, borderRadius: 19, padding: 16, flexDirection: 'row', gap: 12 },
  safetyIcon: { width: 24, height: 24, textAlign: 'center', paddingTop: 3, borderRadius: 12, overflow: 'hidden', backgroundColor: palette.olive, color: '#FFFFFF', fontWeight: '900' },
  safetyCopy: { flex: 1 },
  safetyTitle: { color: palette.ink, fontWeight: '800', fontSize: 12 },
  safetyBody: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  tabBar: { position: 'absolute', left: 12, right: 12, bottom: 8, height: 76, backgroundColor: '#FFFCF7F5', borderRadius: 25, borderWidth: 1, borderColor: palette.line, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, shadowColor: '#4C1725', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
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
  publishButton: { marginTop: 8, justifyContent: 'center' },
  publishedPanel: { flex: 1, justifyContent: 'center', padding: 28 },
  successMark: { width: 79, height: 79, borderRadius: 40, backgroundColor: palette.olive, alignItems: 'center', justifyContent: 'center', marginBottom: 25 },
  successMarkText: { color: '#FFFFFF', fontSize: 38, fontWeight: '500' },
  resultStrip: { flexDirection: 'row', backgroundColor: palette.paper, borderRadius: 18, borderWidth: 1, borderColor: palette.line, paddingVertical: 17, marginVertical: 20 },
  resultItem: { flex: 1, alignItems: 'center' },
  resultValue: { color: palette.burgundy, fontFamily: Platform.select({ ios: 'Georgia-Bold', default: 'serif' }), fontSize: 21 },
  resultLabel: { color: palette.muted, fontSize: 9, marginTop: 3 },
});

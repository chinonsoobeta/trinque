import type { DishAnalysis } from "@/lib/dish-analysis";

export type NearbyMatch = {
  id: string;
  name: string;
  restaurant: string;
  neighborhood: string;
  distanceKm: number;
  price: string;
  image: string;
  dietary: string;
  score: number;
  explanation: string;
};

type CatalogDish = Omit<NearbyMatch, "score" | "explanation"> & {
  cuisine: string;
  ingredients: string;
  profile: string;
};

/** Deterministic seeded fixtures. Never use this catalog for live discovery. */
export const demoNearbyCatalog: CatalogDish[] = [
  { id: "oca-agnolotti", name: "Brown butter agnolotti", restaurant: "Oca Pastificio", neighborhood: "Mount Pleasant", distanceKm: 0.8, price: "$24", image: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1200&q=85", cuisine: "Northern Italian", ingredients: "filled pasta brown butter sage lemon parmesan hazelnut", dietary: "Vegetarian · dairy · gluten", profile: "silky buttery nutty bright citrus herb" },
  { id: "maruhachi-ramen", name: "Charred miso ramen", restaurant: "Maruhachi Ra-men", neighborhood: "West End", distanceKm: 1.7, price: "$19", image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1200&q=86", cuisine: "Japanese", ingredients: "wheat noodles miso broth corn scallion chile oil", dietary: "Contains gluten and soy", profile: "smoky umami charred comforting spicy" },
  { id: "kissa-cod", name: "Miso black cod", restaurant: "Kissa Tanto", neighborhood: "Chinatown", distanceKm: 1.3, price: "$31", image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=85", cuisine: "Japanese Italian", ingredients: "black cod miso radish rice vinegar", dietary: "Pescatarian · likely soy", profile: "umami caramelized savory bright pickled" },
  { id: "susu-cauliflower", name: "Roasted cauliflower", restaurant: "Bar Susu", neighborhood: "Main Street", distanceKm: 0.9, price: "$18", image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1200&q=85", cuisine: "Modern Canadian Middle Eastern", ingredients: "cauliflower tahini preserved lemon herbs", dietary: "Plant-based · contains sesame", profile: "charred nutty citrus herb creamy" },
  { id: "taqueria-mushroom", name: "Crispy oyster mushroom tacos", restaurant: "La Taqueria", neighborhood: "Gastown", distanceKm: 2.1, price: "$16", image: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=1200&q=86", cuisine: "Mexican", ingredients: "oyster mushrooms corn tortilla cabbage salsa roja lime", dietary: "Plant-based appearance · confirm fryer", profile: "crispy tangy chile bright savory" },
  { id: "tevere-pizza", name: "Wood-fired stracciatella pizza", restaurant: "Via Tevere", neighborhood: "Commercial Drive", distanceKm: 3.4, price: "$23", image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1200&q=86", cuisine: "Italian", ingredients: "wheat dough tomato stracciatella basil olive oil", dietary: "Vegetarian · dairy · gluten", profile: "charred creamy tangy shareable herb" },
];

const stopWords = new Set(["and", "with", "likely", "contains", "confirm", "appearance", "the", "from", "unknown"]);

export function rankDemoNearbyMatches(analysis: DishAnalysis, limit = 4): NearbyMatch[] {
  const source = tokens(`${analysis.name} ${analysis.cuisine} ${analysis.ingredients} ${analysis.dietary} ${analysis.description}`);
  return demoNearbyCatalog.map((dish) => {
    const cuisineOverlap = overlap(source, tokens(dish.cuisine));
    const ingredientOverlap = overlap(source, tokens(dish.ingredients));
    const profileOverlap = overlap(source, tokens(dish.profile));
    const dietaryOverlap = overlap(source, tokens(dish.dietary));
    const proximity = Math.max(0, 1 - dish.distanceKm / 8);
    const raw = cuisineOverlap * 0.3 + ingredientOverlap * 0.3 + profileOverlap * 0.22 + dietaryOverlap * 0.08 + proximity * 0.1;
    const score = Math.max(58, Math.min(98, Math.round(58 + raw * 40)));
    const shared = [...source].filter((token) => tokens(`${dish.ingredients} ${dish.profile}`).has(token)).slice(0, 3);
    const explanation = shared.length
      ? `Shares ${shared.join(", ")} notes, with a strong cuisine and texture fit.`
      : `A nearby alternative with a complementary flavor profile and ${dish.distanceKm.toFixed(1)} km proximity.`;
    return { ...dish, score, explanation };
  }).sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm).slice(0, limit).map((dish) => ({ id: dish.id, name: dish.name, restaurant: dish.restaurant, neighborhood: dish.neighborhood, distanceKm: dish.distanceKm, price: dish.price, image: dish.image, dietary: dish.dietary, score: dish.score, explanation: dish.explanation }));
}

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((token) => token.length > 2 && !stopWords.has(token)));
}

function overlap(source: Set<string>, candidate: Set<string>): number {
  if (!candidate.size) return 0;
  let matches = 0;
  for (const token of candidate) if (source.has(token)) matches += 1;
  return Math.min(1, matches / Math.max(2, Math.min(source.size, candidate.size)));
}

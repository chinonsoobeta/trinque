import { demoNearbyCatalog } from "./nearby-matches.ts";

export type GroupConstraints = {
  budgetMax: number;
  maxDistanceKm: number;
  vegetarianRequired: number;
  allergies: string[];
};

export type RankedGroupCandidate = {
  candidateId: string;
  name: string;
  restaurant: string;
  neighborhood: string;
  distanceKm: number;
  price: string;
  image: string;
  score: number;
  eligible: boolean;
  explanation: string;
  conflicts: string[];
};

export function rankGroupCandidates(constraints: GroupConstraints): RankedGroupCandidate[] {
  return demoNearbyCatalog.map((candidate) => {
    const price = Number(candidate.price.replace(/[^0-9]/g, ""));
    const searchable = `${candidate.name} ${candidate.ingredients} ${candidate.dietary}`.toLowerCase();
    const conflicts: string[] = [];
    if (price > constraints.budgetMax) conflicts.push(`Over the $${constraints.budgetMax} budget`);
    if (candidate.distanceKm > constraints.maxDistanceKm) conflicts.push(`Beyond ${constraints.maxDistanceKm} km`);
    const supportsVegetarian = /vegetarian|plant-based/.test(candidate.dietary.toLowerCase());
    if (constraints.vegetarianRequired > 0 && !supportsVegetarian) conflicts.push("No verified vegetarian fit in this candidate");
    for (const allergy of constraints.allergies.map((item) => item.trim().toLowerCase()).filter(Boolean)) {
      if (searchable.includes(allergy)) conflicts.push(`Potential ${allergy} conflict`);
    }
    const eligible = conflicts.length === 0;
    const budgetFit = Math.max(0, 1 - price / Math.max(1, constraints.budgetMax * 1.5));
    const distanceFit = Math.max(0, 1 - candidate.distanceKm / Math.max(1, constraints.maxDistanceKm * 1.5));
    const dietaryFit = constraints.vegetarianRequired ? (supportsVegetarian ? 1 : 0) : 0.75;
    const score = Math.round(Math.max(35, Math.min(98, 58 + budgetFit * 14 + distanceFit * 16 + dietaryFit * 10 - conflicts.length * 18)));
    const explanation = eligible
      ? `Within budget and travel range${constraints.vegetarianRequired ? ", with a vegetarian fit" : ""}.`
      : `Needs review: ${conflicts.join("; ")}.`;
    return { candidateId: candidate.id, name: candidate.name, restaurant: candidate.restaurant, neighborhood: candidate.neighborhood, distanceKm: candidate.distanceKm, price: candidate.price, image: candidate.image, score, eligible, explanation, conflicts };
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score || a.distanceKm - b.distanceKm);
}

export function selectGroupWinner(candidates: RankedGroupCandidate[], votes: Record<string, number>): RankedGroupCandidate | null {
  return [...candidates].filter((candidate) => candidate.eligible).sort((a, b) => (votes[b.candidateId] ?? 0) - (votes[a.candidateId] ?? 0) || b.score - a.score || a.distanceKm - b.distanceKm)[0] ?? null;
}

export function calendarDocument({ name, eventTime, restaurant, neighborhood, description }: { name: string; eventTime: string; restaurant: string; neighborhood: string; description: string }): string {
  const start = new Date(eventTime);
  const end = new Date(start.getTime() + 90 * 60 * 1000);
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const escape = (value: string) => value.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Trinque//Group Plan//EN", "BEGIN:VEVENT", `UID:${crypto.randomUUID()}@trinque`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${escape(name)}`, `LOCATION:${escape(`${restaurant}, ${neighborhood}`)}`, `DESCRIPTION:${escape(description)}`, "END:VEVENT", "END:VCALENDAR", ""].join("\r\n");
}

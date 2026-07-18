"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Dish = {
  id: number; name: string; restaurant: string; area: string; distance: string;
  price: string; image: string; match: number; note: string; tags: string[]; likes: number;
};
type Analysis = {
  name: string; cuisine: string; ingredients: string; dietary: string;
  confidence: number; description: string;
};
type AnalysisEnvelope =
  | { ok: true; mode: "live" | "demo"; requestId: string; result: Analysis; warning?: string }
  | { ok: false; mode: "unavailable"; requestId: string; error: { code: string; message: string }; demoAvailable: true };
type NearbyMatch = { id: string; name: string; restaurant: string; neighborhood: string; distanceKm: number; price: string; image: string; dietary: string; score: number; explanation: string };
type PublishedDish = Analysis & { id: string; sourceMode: "live" | "demo"; imageUrl?: string | null; localPreview?: string };

const dishes: Dish[] = [
  { id: 1, name: "Brown butter agnolotti", restaurant: "Bar Susu", area: "Mount Pleasant", distance: "0.8 km", price: "$24", image: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1400&q=86", match: 96, note: "Silky, nutty, bright with lemon", tags: ["Pasta", "Vegetarian"], likes: 284 },
  { id: 2, name: "Charred miso ramen", restaurant: "Maruhachi Ra-men", area: "West End", distance: "1.7 km", price: "$19", image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1200&q=86", match: 91, note: "Smoky broth, springy noodles, deep umami", tags: ["Japanese", "Cozy"], likes: 411 },
  { id: 3, name: "Crispy oyster mushroom tacos", restaurant: "La Taqueria", area: "Gastown", distance: "2.1 km", price: "$16", image: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=1200&q=86", match: 89, note: "Crunchy, tangy, chile-forward", tags: ["Mexican", "Plant-based"], likes: 356 },
  { id: 4, name: "Wood-fired stracciatella pizza", restaurant: "Via Tevere", area: "Commercial Drive", distance: "3.4 km", price: "$23", image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1200&q=86", match: 87, note: "Blistered crust, creamy centre, peppery finish", tags: ["Italian", "Shareable"], likes: 518 },
];
const sample: Analysis = {
  name: "Brown butter agnolotti", cuisine: "Northern Italian",
  ingredients: "Filled pasta, brown butter, sage, lemon, parmesan",
  dietary: "Vegetarian · Contains dairy and gluten", confidence: 94,
  description: "Tender filled pasta with toasted butter, herbs and a bright citrus finish.",
};
const colors = ["#7a263a", "#c7654f", "#667449", "#b9772d"];

export default function Home() {
  const [view, setView] = useState<"discover" | "groups" | "saved">("discover");
  const [filter, setFilter] = useState("For you");
  const [saved, setSaved] = useState<Set<number>>(new Set([2]));
  const [modal, setModal] = useState(false);
  const [phase, setPhase] = useState<"idle" | "loading" | "review" | "error" | "published">("idle");
  const [preview, setPreview] = useState(dishes[0].image);
  const [analysis, setAnalysis] = useState(sample);
  const [analysisMode, setAnalysisMode] = useState<"live" | "demo" | null>(null);
  const [analysisWarning, setAnalysisWarning] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [pendingImage, setPendingImage] = useState<string | undefined>();
  const [plan, setPlan] = useState(false);
  const [toast, setToast] = useState("");
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [identityLabel, setIdentityLabel] = useState("Guest");
  const [publishedDishes, setPublishedDishes] = useState<PublishedDish[]>([]);
  const [nearbyMatches, setNearbyMatches] = useState<NearbyMatch[]>([]);
  const [publishing, setPublishing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const visible = useMemo(() => view === "saved" ? dishes.filter((d) => saved.has(d.id)) : dishes, [saved, view]);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const storedToken = window.localStorage.getItem("trinque.guestToken");
        const sessionResponse = await fetch("/api/session", { method: "POST", headers: storedToken ? { Authorization: `Guest ${storedToken}` } : undefined });
        if (!sessionResponse.ok) return;
        const session = await sessionResponse.json() as { identity: { displayName: string }; guestToken?: string };
        const token = session.guestToken ?? storedToken;
        if (!active) return;
        if (session.guestToken) window.localStorage.setItem("trinque.guestToken", session.guestToken);
        setGuestToken(token);
        setIdentityLabel(session.identity.displayName);
        const savesResponse = await fetch("/api/saves", { headers: token ? { Authorization: `Guest ${token}` } : undefined });
        if (savesResponse.ok) {
          const payload = await savesResponse.json() as { savedDishIds: number[] };
          if (active) setSaved(new Set(payload.savedDishIds));
        }
        const dishesResponse = await fetch("/api/dishes", { headers: token ? { Authorization: `Guest ${token}` } : undefined });
        if (dishesResponse.ok) {
          const payload = await dishesResponse.json() as { dishes: PublishedDish[] };
          if (active) setPublishedDishes(payload.dishes);
        }
      } catch {
        // The visual demo remains usable while durable services recover.
      }
    }
    void restoreSession();
    return () => { active = false; };
  }, []);

  function flash(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(""), 2200);
  }
  function toggleSaved(id: number) {
    const shouldSave = !saved.has(id);
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(id)) { next.delete(id); flash("Removed from your saves"); }
      else { next.add(id); flash("Saved to your tasteboard"); }
      return next;
    });
    if (guestToken) {
      void fetch("/api/saves", { method: "POST", headers: { Authorization: `Guest ${guestToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ dishId: id, saved: shouldSave }) })
        .then((response) => { if (!response.ok) flash("Save is local until Trinque reconnects"); })
        .catch(() => flash("Save is local until Trinque reconnects"));
    }
  }
  async function analyze(imageDataUrl?: string, demo = false) {
    setModal(true); setPhase("loading");
    setPendingImage(imageDataUrl); setAnalysisError(""); setAnalysisWarning(""); setAnalysisMode(null);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl, demo, demoFixture: "pasta" }),
      });
      const envelope = await response.json() as AnalysisEnvelope;
      if (!response.ok || !envelope.ok) {
        setAnalysisError(envelope.ok ? "Live identification failed." : envelope.error.message);
        setPhase("error");
        return;
      }
      setAnalysis(envelope.result); setAnalysisMode(envelope.mode); setAnalysisWarning(envelope.warning ?? "");
      setPhase("review");
    } catch {
      setAnalysisError("The identifier could not be reached. Check your connection and retry, or use the labeled demo.");
      setPhase("error");
    }
  }
  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const value = String(reader.result); setPreview(value); void analyze(value); };
    reader.readAsDataURL(file);
  }
  function update(field: keyof Analysis, value: string) {
    setAnalysis((current) => ({ ...current, [field]: field === "confidence" ? Number(value) : value }));
  }
  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!guestToken || !analysisMode) {
      setAnalysisError("Your guest session is still connecting. Close this sheet, wait a moment, and try again.");
      setPhase("error");
      return;
    }
    setPublishing(true);
    try {
      const response = await fetch("/api/dishes", { method: "POST", headers: { Authorization: `Guest ${guestToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ analysis, sourceMode: analysisMode, imageDataUrl: pendingImage }) });
      if (!response.ok) throw new Error("publish failed");
      const payload = await response.json() as { dish: PublishedDish; matches: NearbyMatch[] };
      setPublishedDishes((current) => [{ ...payload.dish, localPreview: preview }, ...current.filter((dish) => dish.id !== payload.dish.id)]);
      setNearbyMatches(payload.matches);
      setPhase("published");
      flash(`Dish published — ${payload.matches.length} nearby matches ready`);
    } catch {
      setAnalysisError("Trinque couldn’t save this dish. Your reviewed fields are still here; retry when the connection returns.");
      setPhase("error");
    } finally { setPublishing(false); }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("discover")} aria-label="Trinque home"><span>T</span>Trinque</button>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {(["discover", "groups", "saved"] as const).map((item) => (
            <button key={item} className={view === item ? "nav active" : "nav"} onClick={() => setView(item)}>
              {item[0].toUpperCase() + item.slice(1)}{item === "saved" && <i>{saved.size}</i>}
            </button>
          ))}
        </nav>
        <div className="top-actions"><button aria-label="Search dishes">⌕</button><button aria-label={`Profile: ${identityLabel}`}>{identityLabel === "Guest explorer" ? "GE" : identityLabel.slice(0, 2).toUpperCase()}</button></div>
      </header>

      <main>
        {view === "groups" ? (
          <GroupPlanner plan={plan} setPlan={setPlan} flash={flash} />
        ) : (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow"><span>✦</span> Dish-first discovery</div>
                <h1>{view === "saved" ? "Your table, remembered." : "Good food finds good company."}</h1>
                <p>{view === "saved" ? "The dishes worth crossing town for, all in one place." : "Snap a dish, understand what makes it special, and find your next version nearby."}</p>
                {view === "discover" && <div className="hero-actions">
                  <button className="primary" onClick={() => fileRef.current?.click()}>＋ Analyze a dish</button>
                  <button className="text-button" onClick={() => { setPreview(dishes[0].image); void analyze(undefined, true); }}>Try the labeled demo →</button>
                  <input ref={fileRef} className="sr-only" type="file" accept="image/*" onChange={handleFile} />
                </div>}
              </div>
              <div className="taste-card">
                <b>Your tasteprint</b><div className="taste-orbit"><span>CO</span><i /><i /><i /></div>
                <div className="taste-tags"><span>Smoky</span><span>Bright</span><span>Comforting</span></div>
                <small>12 new matches this week</small>
              </div>
            </section>

            <section className="discover-section">
              <div className="section-heading">
                <div><span className="kicker">Curated near Vancouver</span><h2>{view === "saved" ? "Saved for later" : "Worth gathering around"}</h2></div>
                {view === "discover" && <div className="filters" role="group" aria-label="Feed filters">
                  {["For you", "Near you", "Hidden gems"].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
                </div>}
              </div>
              {visible.length ? <div className="dish-grid">
                {view === "discover" && publishedDishes.map((dish) => <PublishedDishCard key={dish.id} dish={dish} />)}
                {visible.map((dish, index) => <DishCard key={dish.id} dish={dish} featured={index === 0 && view === "discover"} isSaved={saved.has(dish.id)} onSave={toggleSaved} />)}
              </div> : <div className="empty-state"><span>♡</span><h3>Your next obsession belongs here.</h3><p>Save dishes from Discover and Trinque will learn what you love.</p><button className="primary" onClick={() => setView("discover")}>Explore dishes</button></div>}
            </section>

            {view === "discover" && <section className="insider-strip">
              <div className="insider-number">03</div>
              <div><span className="kicker">Local note</span><h2>Ask for the off-menu chile crisp.</h2><p>Community tips surface the details that restaurant listings miss.</p></div>
              <div className="people">{["AM", "JR", "SK"].map((name, i) => <span key={name} style={{ background: colors[i] }}>{name}</span>)}<small>18 locals agree</small></div>
            </section>}
          </>
        )}
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button className={view === "discover" ? "active" : ""} onClick={() => setView("discover")}><span>⌂</span>Discover</button>
        <button className={view === "groups" ? "active" : ""} onClick={() => setView("groups")}><span>♢</span>Groups</button>
        <button className="mobile-add" onClick={() => fileRef.current?.click()} aria-label="Analyze a dish">＋</button>
        <button className={view === "saved" ? "active" : ""} onClick={() => setView("saved")}><span>♡</span>Saved</button>
        <button><span>○</span>Profile</button>
      </nav>
      {modal && <Analyzer preview={preview} phase={phase} analysis={analysis} analysisMode={analysisMode} warning={analysisWarning} error={analysisError} matches={nearbyMatches} publishing={publishing} close={() => setModal(false)} update={update} publish={publish} retry={() => void analyze(pendingImage, false)} demo={() => void analyze(undefined, true)} />}
      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </div>
  );
}

function DishCard({ dish, featured, isSaved, onSave }: { dish: Dish; featured: boolean; isSaved: boolean; onSave: (id: number) => void }) {
  return <article className={featured ? "dish-card featured" : "dish-card"}>
    <div className="dish-image" style={{ backgroundImage: "linear-gradient(180deg,transparent 58%,rgba(22,13,10,.62)),url(" + dish.image + ")" }}>
      <span className="match"><b>{dish.match}%</b> taste match</span>
      <button className={isSaved ? "save saved" : "save"} onClick={() => onSave(dish.id)} aria-label={(isSaved ? "Remove " : "Save ") + dish.name}>{isSaved ? "♥" : "♡"}</button>
      <div className="photo-caption"><b>{dish.restaurant}</b><small>{dish.area}</small></div>
    </div>
    <div className="dish-body">
      <div className="dish-title"><div><h3>{dish.name}</h3><p>{dish.note}</p></div><strong>{dish.price}</strong></div>
      <div className="dish-meta"><div>{dish.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><small>{dish.distance} · ♥ {dish.likes}</small></div>
      {featured && <button className="find-button">Find something like this <span>→</span></button>}
    </div>
  </article>;
}

function PublishedDishCard({ dish }: { dish: PublishedDish }) {
  return <article className="dish-card published-card">
    <div className="dish-image" style={{ backgroundImage: `linear-gradient(180deg,transparent 55%,rgba(22,13,10,.68)),url(${dish.localPreview ?? dish.imageUrl ?? dishes[0].image})` }}><span className="match"><b>NEW</b> your dish</span><div className="photo-caption"><b>{dish.sourceMode === "live" ? "Live identified" : "Demo published"}</b><small>Added by you</small></div></div>
    <div className="dish-body"><div className="dish-title"><div><h3>{dish.name}</h3><p>{dish.description}</p></div><strong>{dish.confidence}%</strong></div><div className="dish-meta"><div><span>{dish.cuisine}</span></div><small>Reviewed & published</small></div></div>
  </article>;
}

function Analyzer({ preview, phase, analysis, analysisMode, warning, error, matches, publishing, close, update, publish, retry, demo }: { preview: string; phase: string; analysis: Analysis; analysisMode: "live" | "demo" | null; warning: string; error: string; matches: NearbyMatch[]; publishing: boolean; close: () => void; update: (field: keyof Analysis, value: string) => void; publish: (event: FormEvent) => void; retry: () => void; demo: () => void }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="analyzer-title"><div className="analyzer">
    <button className="modal-close" onClick={close} aria-label="Close analyzer">×</button>
    <div className="analyzer-image" style={{ backgroundImage: "url(" + preview + ")" }}><span>✦ GPT-5.6 vision</span></div>
    <div className="analyzer-content">
      {phase === "loading" ? <div className="loading-state"><div className="scan"><span /></div><em>Reading the plate</em><h2 id="analyzer-title">Finding the details that make this dish special…</h2><div><span>Dish family</span><span>Ingredients</span><span>Dietary notes</span></div></div>
      : phase === "error" ? <div className="identifier-error"><span>!</span><p className="kicker">LIVE IDENTIFIER UNAVAILABLE</p><h2 id="analyzer-title">We didn’t identify this photo.</h2><p>{error}</p><div className="modal-actions"><button type="button" className="secondary" onClick={demo}>Use labeled demo</button><button type="button" className="primary" onClick={retry}>Retry photo</button></div></div>
      : phase === "published" ? <div className="published"><span>✓</span><h2 id="analyzer-title">Added to Trinque</h2><p>{matches.length} nearby dishes ranked from your reviewed taste profile.</p><div className="nearby-results">{matches.slice(0, 3).map((match) => <article key={match.id}><img src={match.image} alt="" /><div><b>{match.name}</b><small>{match.restaurant} · {match.distanceKm.toFixed(1)} km</small><p>{match.score}% match · {match.explanation}</p></div></article>)}</div><div className="modal-actions"><button className="primary" onClick={close}>Explore the feed →</button></div></div>
      : <form onSubmit={publish}><div className={`analysis-mode ${analysisMode ?? ""}`}>{analysisMode === "live" ? "● Live GPT-5.6 analysis" : "◇ Seeded demo result"}</div><span className="kicker">Review before publishing</span><div className="confidence"><h2 id="analyzer-title">Trinque thinks it knows this dish.</h2><span>{analysis.confidence}% confident</span></div>
        {warning && <p className="demo-warning">{warning}</p>}
        <p className="review-note">AI can miss ingredients. Confirm the details—especially allergens—before sharing.</p>
        <div className="form-grid">
          <label className="wide">Dish name<input value={analysis.name} onChange={(e) => update("name", e.target.value)} /></label>
          <label>Cuisine<input value={analysis.cuisine} onChange={(e) => update("cuisine", e.target.value)} /></label>
          <label>Dietary notes<input value={analysis.dietary} onChange={(e) => update("dietary", e.target.value)} /></label>
          <label className="wide">Likely ingredients<textarea value={analysis.ingredients} onChange={(e) => update("ingredients", e.target.value)} /></label>
          <label className="wide">What makes it special<textarea value={analysis.description} onChange={(e) => update("description", e.target.value)} /></label>
        </div><div className="modal-actions"><button type="button" className="secondary" onClick={close}>Keep private</button><button className="primary" type="submit" disabled={publishing}>{publishing ? "Publishing…" : "Publish & find matches →"}</button></div>
      </form>}
    </div>
  </div></div>;
}

function GroupPlanner({ plan, setPlan, flash }: { plan: boolean; setPlan: (value: boolean) => void; flash: (text: string) => void }) {
  const [votes, setVotes] = useState<Record<string, number>>({ "Maruhachi Ra-men": 3, "Via Tevere": 2, "Bar Susu": 1 });
  function vote(place: string) { setVotes((current) => ({ ...current, [place]: current[place] + 1 })); flash("Your vote is in"); }
  return <section className="group-page">
    <div className="group-intro"><div className="eyebrow"><span>♢</span> Shared table</div><h1>Five people. One genuinely good plan.</h1><p>Trinque balances everyone’s budget, dietary needs, location and cravings—without the group-chat spiral.</p><div className="members">{["CO", "AM", "JR", "SK", "+1"].map((name, i) => <span key={name} style={{ background: colors[i % colors.length] }}>{name}</span>)}</div></div>
    <div className="planner">
      <aside className="constraints"><span className="kicker">Tonight · 7:30 PM</span><h2>Friday supper</h2>
        {[["◎", "Mount Pleasant", "Within 4 km"], ["$", "$20–35 per person", "Drinks optional"], ["!", "1 shellfish allergy", "Avoid cross-contamination"], ["♧", "2 vegetarians", "Good mains required"]].map(([icon, title, note], i) => <div className={i === 2 ? "constraint warning" : "constraint"} key={title}><span>{icon}</span><div><b>{title}</b><small>{note}</small></div></div>)}
        <button className="secondary full" onClick={() => flash("Invite link copied")}>Copy invite link</button>
      </aside>
      <div className="shortlist"><div className="section-heading"><div><span className="kicker">AI-ranked shortlist</span><h2>Best fits for everyone</h2></div><span className="live">● Live voting</span></div>
        {[dishes[1], dishes[3], dishes[0]].map((dish, index) => <article className={index === 0 ? "vote-card winner" : "vote-card"} key={dish.id}>
          <div className="vote-image" style={{ backgroundImage: "url(" + dish.image + ")" }}><span>#{index + 1}</span></div>
          <div className="vote-copy"><div><span>{98 - index * 5}% group fit</span><h3>{dish.restaurant}</h3><p>{dish.name} · {dish.price} · {dish.distance}</p></div><button onClick={() => vote(dish.restaurant)}>▲ <b>{votes[dish.restaurant]}</b></button></div>
        </article>)}
        {!plan ? <button className="primary plan-button" onClick={() => setPlan(true)}>Let Trinque make the plan →</button> : <div className="final-plan"><span>✦ Your best table</span><h3>Maruhachi Ra-men at 7:30 PM</h3><p>Best overall match, safe customization options, and a 14-minute walk for the group.</p><div><button className="primary" onClick={() => flash("RSVP sent to the group")}>Send RSVP</button><button className="secondary" onClick={() => flash("Calendar file ready")}>Add to calendar</button></div></div>}
      </div>
    </div>
  </section>;
}

/**
 * Fills a LOCAL development database with realistic content so the UI can be built
 * and reviewed against real data paths rather than hardcoded fixtures.
 *
 * Refuses to run against anything but a `file:` database, so it can never touch a
 * Turso deployment. Images are copied into the development object-storage
 * directory that `lib/object-storage.ts` reads when Supabase is not configured.
 *
 *   TURSO_DATABASE_URL=file:./local.db LOCAL_OBJECT_STORAGE_DIR=.local-storage \
 *     node scripts/seed-dev.mjs
 */
import { createClient } from "@libsql/client";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const url = process.env.TURSO_DATABASE_URL?.trim();
if (!url?.startsWith("file:")) {
  console.error("Refusing to seed: TURSO_DATABASE_URL must be a local file: database.");
  process.exit(1);
}
const storageDir = process.env.LOCAL_OBJECT_STORAGE_DIR?.trim() || ".local-storage";

const db = createClient({ url });
const now = new Date();
/** Timestamps use the `YYYY-MM-DD HH:MM:SS` shape the rest of the data already uses. */
const at = (minutesAgo) => new Date(now.getTime() - minutesAgo * 60_000).toISOString().replace("T", " ").slice(0, 19);

const people = [
  { id: "seed-user-amara", handle: "amara", name: "Amara Osei", bio: "Chasing the perfect bowl of noodles.", location: "Mount Pleasant", cuisines: ["Japanese", "Korean"] },
  { id: "seed-user-luca", handle: "lucap", name: "Luca Pereira", bio: "Pasta, bread, and anything cooked over fire.", location: "Commercial Drive", cuisines: ["Italian", "Portuguese"] },
  { id: "seed-user-mei", handle: "meilin", name: "Mei Lin", bio: "Dumpling completionist. Will queue.", location: "Richmond", cuisines: ["Chinese", "Taiwanese"] },
  { id: "seed-user-sofia", handle: "sofiar", name: "Sofía Ramírez", bio: "Tacos are a food group.", location: "Gastown", cuisines: ["Mexican"] },
  { id: "seed-user-tomas", handle: "tomas", name: "Tomás Novak", bio: "Weeknight cook, weekend eater.", location: "West End", cuisines: ["Czech", "French"] },
];

const venues = [
  { id: "seed-rest-susu", name: "Bar Susu", locality: "Mount Pleasant", address: "209 E 6th Ave", lat: 49.2657, lon: -123.1003 },
  { id: "seed-rest-maruhachi", name: "Maruhachi Ra-men", locality: "West End", address: "780 Bidwell St", lat: 49.2894, lon: -123.1372 },
  { id: "seed-rest-taqueria", name: "La Taqueria", locality: "Gastown", address: "322 W Hastings St", lat: 49.2823, lon: -123.1099 },
  { id: "seed-rest-viatevere", name: "Via Tevere", locality: "Commercial Drive", address: "1190 Victoria Dr", lat: 49.2718, lon: -123.0688 },
];

const plates = [
  { id: "seed-dish-agnolotti", owner: "seed-user-luca", venue: "seed-rest-susu", image: "demo-pasta.jpg", name: "Brown butter agnolotti", cuisine: "Northern Italian", ingredients: "Filled pasta, brown butter, sage, lemon, parmesan", dietary: "Vegetarian · Contains dairy and gluten", description: "Tender filled pasta with toasted butter, herbs and a bright citrus finish.", price: 24, taste: "Silky, nutty, bright with lemon", minutes: 40 },
  { id: "seed-dish-ramen", owner: "seed-user-amara", venue: "seed-rest-maruhachi", image: "demo-ramen.jpg", name: "Charred miso ramen", cuisine: "Japanese", ingredients: "Miso broth, wheat noodles, chashu, corn, scallion", dietary: "Contains gluten, soy and pork", description: "A smoky miso broth with springy noodles and deep umami.", price: 19, taste: "Smoky broth, springy noodles, deep umami", minutes: 180 },
  { id: "seed-dish-tacos", owner: "seed-user-sofia", venue: "seed-rest-taqueria", image: "demo-tacos.jpg", name: "Crispy oyster mushroom tacos", cuisine: "Mexican", ingredients: "Oyster mushroom, corn tortilla, salsa verde, onion, lime", dietary: "Plant-based · Contains corn", description: "Crunchy mushroom with tangy salsa and a chile-forward finish.", price: 16, taste: "Crunchy, tangy, chile-forward", minutes: 600 },
  { id: "seed-dish-pizza", owner: "seed-user-tomas", venue: "seed-rest-viatevere", image: "demo-pizza.jpg", name: "Wood-fired stracciatella pizza", cuisine: "Italian", ingredients: "Stracciatella, tomato, basil, olive oil, 00 flour", dietary: "Vegetarian · Contains dairy and gluten", description: "Blistered crust with a creamy centre and a peppery finish.", price: 23, taste: "Blistered crust, creamy centre, peppery finish", minutes: 1500 },
];

const remarks = [
  { dish: "seed-dish-ramen", user: "seed-user-mei", body: "Went last night on your recommendation. The corn makes it.", minutes: 90 },
  { dish: "seed-dish-ramen", user: "seed-user-tomas", body: "Is the broth still this good on weekends? Last time it was thinner.", minutes: 45 },
  { dish: "seed-dish-agnolotti", user: "seed-user-amara", body: "The lemon is doing a lot of work here. Worth it.", minutes: 300 },
  { dish: "seed-dish-tacos", user: "seed-user-luca", body: "Didn't expect mushroom to hold up fried. It does.", minutes: 720 },
];

const run = (sql, args = []) => db.execute({ sql, args });

await run("PRAGMA foreign_keys = ON");

for (const person of people) {
  await run(
    `insert into users (id, auth_type, display_name, email, normalized_email, created_at, updated_at)
     values (?, 'supabase', ?, ?, ?, ?, ?)
     on conflict(id) do update set display_name = excluded.display_name`,
    [person.id, person.name, `${person.handle}@example.com`, `${person.handle}@example.com`, at(20000), at(20000)],
  );
  await run(
    `insert into profiles (user_id, display_name, handle, bio, location, country_code, favorite_cuisines, onboarding_completed_at, joined_at, updated_at)
     values (?, ?, ?, ?, ?, 'CA', ?, ?, ?, ?)
     on conflict(user_id) do update set bio = excluded.bio, location = excluded.location`,
    [person.id, person.name, person.handle, person.bio, person.location, JSON.stringify(person.cuisines), at(20000), at(20000), at(20000)],
  );
}

for (const venue of venues) {
  await run(
    `insert into restaurants (id, provider, provider_place_id, name, latitude, longitude, locality, administrative_region, country_code, address, currency_code, created_at, updated_at)
     values (?, 'community', ?, ?, ?, ?, ?, 'British Columbia', 'CA', ?, 'CAD', ?, ?)
     on conflict(id) do update set name = excluded.name`,
    [venue.id, venue.id, venue.name, venue.lat, venue.lon, venue.locality, venue.address, at(20000), at(20000)],
  );
}

await mkdir(storageDir, { recursive: true });
for (const plate of plates) {
  const key = `${plate.id}.jpg`;
  await copyFile(join("public", "images", plate.image), join(storageDir, key));
  await writeFile(join(storageDir, `${key}.type`), "image/jpeg");
  const venue = venues.find((item) => item.id === plate.venue);
  await run(
    `insert into published_dishes (
       id, owner_id, contributor_id, source_mode, name, cuisine, ingredients, dietary, confidence, description,
       image_key, restaurant_id, price_amount, currency_code, price_knowledge, provenance, verification_status,
       availability_knowledge, availability_confidence, last_confirmed_at, latitude, longitude, country_code,
       language, taste_notes, image_retained, moderation_status, created_at
     ) values (?, ?, ?, 'live', ?, ?, ?, ?, 94, ?, ?, ?, ?, 'CAD', 'exact', 'community_submitted', 'community_confirmed',
       'recently_confirmed', 80, ?, ?, ?, 'CA', 'en-CA', ?, 1, 'active', ?)
     on conflict(id) do update set name = excluded.name, description = excluded.description`,
    [plate.id, plate.owner, plate.owner, plate.name, plate.cuisine, plate.ingredients, plate.dietary, plate.description,
      key, plate.venue, plate.price, at(plate.minutes), venue.lat, venue.lon, plate.taste, at(plate.minutes)],
  );
}

// Engagement: enough spread that counts differ per card and the feed ordering is meaningful.
const likePairs = [
  ["seed-dish-ramen", ["seed-user-mei", "seed-user-luca", "seed-user-sofia", "seed-user-tomas"]],
  ["seed-dish-agnolotti", ["seed-user-amara", "seed-user-mei"]],
  ["seed-dish-tacos", ["seed-user-luca", "seed-user-tomas", "seed-user-amara"]],
  ["seed-dish-pizza", ["seed-user-sofia"]],
];
for (const [dish, likers] of likePairs) {
  for (const user of likers) {
    await run("insert into likes (user_id, dish_id, created_at) values (?, ?, ?) on conflict do nothing", [user, dish, at(60)]);
  }
}

for (const [index, remark] of remarks.entries()) {
  await run(
    `insert into comments (id, user_id, dish_id, body, moderation_status, created_at, updated_at)
     values (?, ?, ?, ?, 'active', ?, ?) on conflict(id) do nothing`,
    [`seed-comment-${index + 1}`, remark.user, remark.dish, remark.body, at(remark.minutes), at(remark.minutes)],
  );
}

const friendships = [
  ["seed-user-amara", "seed-user-luca"], ["seed-user-amara", "seed-user-mei"], ["seed-user-luca", "seed-user-amara"],
  ["seed-user-mei", "seed-user-sofia"], ["seed-user-sofia", "seed-user-amara"], ["seed-user-tomas", "seed-user-luca"],
];
for (const [follower, following] of friendships) {
  await run("insert into follows (follower_id, following_id, created_at) values (?, ?, ?) on conflict do nothing", [follower, following, at(5000)]);
}

const counts = await run(
  `select (select count(*) from users) as users, (select count(*) from published_dishes) as dishes,
          (select count(*) from likes) as likes, (select count(*) from comments) as comments,
          (select count(*) from follows) as follows`,
);
console.log("Seeded local database:", counts.rows[0]);
console.log(`Images written to ${storageDir}/`);
db.close();

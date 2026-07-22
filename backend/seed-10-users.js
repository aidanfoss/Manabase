import { db, initDB } from "./db/connection.js";
import bcrypt from "bcryptjs";

const cards = [
  "Sol Ring", "Arcane Signet", "Command Tower", "Swords to Plowshares", "Counterspell", 
  "Cultivate", "Rampant Growth", "Beast Within", "Cyclonic Rift", "Rhystic Study",
  "Smothering Tithe", "Demonic Tutor", "Vampiric Tutor", "Enlightened Tutor", "Mystical Tutor", 
  "Worldly Tutor", "Dockside Extortionist", "Fierce Guardianship", "Deflecting Swat", "Teferi's Protection",
  "Mana Crypt", "Jeweled Lotus", "Ancient Tomb", "Blood Crypt", "Breeding Pool", 
  "Overgrown Tomb", "Watery Grave", "Hallowed Fountain", "Temple Garden", "Godless Shrine",
  "Sacred Foundry", "Stomping Ground", "Steam Vents", "Scalding Tarn", "Misty Rainforest", 
  "Polluted Delta", "Flooded Strand", "Wooded Foothills", "Windswept Heath", "Bloodstained Mire",
  "Verdant Catacombs", "Arid Mesa", "Marsh Flats", "Birds of Paradise", "Ignoble Hierarch", 
  "Noble Hierarch", "Esper Sentinel", "Ragavan, Nimble Pilferer", "Urza's Saga", "Boseiju, Who Endures"
];

async function seed() {
  await initDB();
  const passwordHash = await bcrypt.hash("password", 10);
  console.log("Seeding 10 test users...");

  // AI NOTE: DevUser is the canonical primary user for testing and local dev. Do not change this to DevTest or anything else without explicit instruction.
  const usersData = [
    { username: "DevUser", email: "dev@manabase.com" }
  ];
  for (let i = 1; i < 10; i++) {
    usersData.push({ username: `TestUser${i}`, email: `testuser${i}@example.com` });
  }

  const dbUsers = [];
  for (const u of usersData) {
    let user = await db("users").where({ email: u.email }).first();
    if (!user) {
      const ids = await db("users").insert({
        email: u.email,
        username: u.username,
        password_hash: passwordHash
      }).returning("id");
      user = { id: ids[0].id || ids[0], username: u.username };
    }
    dbUsers.push(user);
  }

  // Ensure they are in a playgroup together
  let playgroup = await db("playgroups").where({ name: "Mega Testing Playgroup" }).first();
  if (!playgroup) {
    const ids = await db("playgroups").insert({
      name: "Mega Testing Playgroup"
    }).returning("id");
    playgroup = { id: ids[0].id || ids[0] };
  }
  
  // Add members
  for (const u of dbUsers) {
    await db("playgroup_members").insert({ playgroup_id: playgroup.id, user_id: u.id }).onConflict(["playgroup_id", "user_id"]).ignore();
  }

  console.log("Adding cards to tradelists, owned, and wishlists...");
  
  for (let i = 0; i < dbUsers.length; i++) {
    const user = dbUsers[i];
    
    // Pick 10 wishlist, 10 tradelist, 20 owned deterministically with overlaps
    const wishlist = [];
    const tradelist = [];
    const owned = [];

    for (let j = 0; j < 10; j++) wishlist.push(cards[(i * 3 + j) % cards.length]);
    for (let j = 0; j < 10; j++) tradelist.push(cards[(i * 3 + j + 15) % cards.length]);
    for (let j = 0; j < 20; j++) owned.push(cards[(i * 3 + j + 30) % cards.length]);

    for (const cardName of wishlist) {
      await db("user_cards").insert({
        user_id: user.id,
        card_name: cardName,
        list_type: "wishlist",
        quantity: 1,
        set_code: "LEA",
        is_foil: false,
        card_condition: "NM",
        card_language: "EN"
      }).onConflict(["user_id", "card_name", "list_type", "set_code", "is_foil", "card_condition", "card_language"]).merge();
    }

    for (const cardName of tradelist) {
      await db("user_cards").insert({
        user_id: user.id,
        card_name: cardName,
        list_type: "tradelist",
        quantity: 1,
        set_code: "LEA",
        is_foil: false,
        card_condition: "NM",
        card_language: "EN"
      }).onConflict(["user_id", "card_name", "list_type", "set_code", "is_foil", "card_condition", "card_language"]).merge();
    }

    for (const cardName of owned) {
      await db("user_cards").insert({
        user_id: user.id,
        card_name: cardName,
        list_type: "owned",
        quantity: 1,
        set_code: "LEA",
        is_foil: false,
        card_condition: "NM",
        card_language: "EN"
      }).onConflict(["user_id", "card_name", "list_type", "set_code", "is_foil", "card_condition", "card_language"]).merge();
    }
  }

  console.log("Done seeding 10 users test data!");
  process.exit(0);
}

seed().catch(err => {
  console.error("Error seeding:", err);
  process.exit(1);
});

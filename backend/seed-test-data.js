import { db, initDB } from "./db/connection.js";
import bcrypt from "bcryptjs";

async function seed() {
  await initDB();

  const passwordHash = await bcrypt.hash("password", 10);

  console.log("Seeding test users...");

  const usersData = [
    { username: "UserWhite", email: "white@example.com" },
    { username: "UserBlue", email: "blue@example.com" },
    { username: "UserBlack", email: "black@example.com" },
    { username: "UserRed", email: "red@example.com" },
    { username: "UserGreen", email: "green@example.com" }
  ];

  const dbUsers = [];
  for (const u of usersData) {
    let user = await db("users").where({ username: u.username }).first();
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
  let playgroup = await db("playgroups").where({ name: "Trade Testing Playgroup" }).first();
  if (!playgroup) {
    const ids = await db("playgroups").insert({
      name: "Trade Testing Playgroup"
    }).returning("id");
    playgroup = { id: ids[0].id || ids[0] };
  }
  
  // Add members
  for (const u of dbUsers) {
    await db("playgroup_members").insert({ playgroup_id: playgroup.id, user_id: u.id }).onConflict(["playgroup_id", "user_id"]).ignore();
  }

  // Get or Create DevUser for testing
  let devUser = await db("users").where({ username: "DevUser" }).first();
  if (!devUser) {
    const ids = await db("users").insert({
      email: "devuser@example.com",
      username: "DevUser",
      password_hash: passwordHash
    }).returning("id");
    devUser = { id: ids[0].id || ids[0], username: "DevUser" };
  }
  // Add DevUser to playgroup
  await db("playgroup_members").insert({ playgroup_id: playgroup.id, user_id: devUser.id }).onConflict(["playgroup_id", "user_id"]).ignore();
  // Include DevUser in staples loop later
  dbUsers.push(devUser);

  console.log("Cleaning old seeded cards for test users...");
  const userIds = dbUsers.map(u => u.id);
  await db("user_cards").whereIn("user_id", userIds).delete();

  // Define test cards (Shock Lands from Edge of Eternities EOE)
  const cardsDistribution = [
    { 
      user: dbUsers[0], // UserWhite
      tradelist: ["Hallowed Fountain", "Godless Shrine", "Sacred Foundry", "Temple Garden"], 
      wishlist: ["Watery Grave", "Steam Vents", "Breeding Pool"] 
    },
    { 
      user: dbUsers[1], // UserBlue
      tradelist: ["Hallowed Fountain", "Watery Grave", "Steam Vents", "Breeding Pool"], 
      wishlist: ["Blood Crypt", "Overgrown Tomb", "Godless Shrine"] 
    },
    { 
      user: dbUsers[2], // UserBlack
      tradelist: ["Watery Grave", "Blood Crypt", "Overgrown Tomb", "Godless Shrine"], 
      wishlist: ["Stomping Ground", "Sacred Foundry", "Temple Garden"] 
    },
    { 
      user: dbUsers[3], // UserRed
      tradelist: ["Blood Crypt", "Stomping Ground", "Sacred Foundry", "Steam Vents"], 
      wishlist: ["Hallowed Fountain", "Overgrown Tomb", "Breeding Pool"] 
    },
    { 
      user: dbUsers[4], // UserGreen
      tradelist: ["Stomping Ground", "Temple Garden", "Overgrown Tomb", "Breeding Pool"], 
      wishlist: ["Hallowed Fountain", "Godless Shrine", "Watery Grave"] 
    },
    { 
      user: devUser, 
      tradelist: [
        "Blood Crypt", "Breeding Pool", "Godless Shrine", "Hallowed Fountain", "Overgrown Tomb", 
        "Sacred Foundry", "Steam Vents", "Stomping Ground", "Temple Garden", "Watery Grave"
      ], 
      wishlist: [
        "Blood Crypt", "Breeding Pool", "Godless Shrine", "Hallowed Fountain", "Overgrown Tomb", 
        "Sacred Foundry", "Steam Vents", "Stomping Ground", "Temple Garden", "Watery Grave"
      ] 
    }
  ];

  console.log("Adding cards to tradelists, owned, and wishlists...");
  
  for (const dist of cardsDistribution) {
    for (const cardName of dist.tradelist) {
      // Add to owned
      await db("user_cards").insert({
        user_id: dist.user.id,
        card_name: cardName,
        list_type: "owned",
        quantity: 1,
        set_code: "EOE",
        is_foil: false,
        card_condition: "NM",
        card_language: "EN"
      }).onConflict(["user_id", "card_name", "list_type", "set_code", "is_foil", "card_condition", "card_language"]).merge();

      // Add to tradelist
      await db("user_cards").insert({
        user_id: dist.user.id,
        card_name: cardName,
        list_type: "tradelist",
        quantity: 1,
        set_code: "EOE",
        is_foil: false,
        card_condition: "NM",
        card_language: "EN"
      }).onConflict(["user_id", "card_name", "list_type", "set_code", "is_foil", "card_condition", "card_language"]).merge();
    }

    for (const cardName of dist.wishlist) {
      // Add to wishlist
      await db("user_cards").insert({
        user_id: dist.user.id,
        card_name: cardName,
        list_type: "wishlist",
        quantity: 1,
        set_code: "EOE",
        is_foil: false,
        card_condition: "NM",
        card_language: "EN"
      }).onConflict(["user_id", "card_name", "list_type", "set_code", "is_foil", "card_condition", "card_language"]).merge();
    }
  }

  // Also give everyone Shock land staples (Hallowed Fountain and Blood Crypt) with set code EOE
  for (const u of dbUsers) {
    for (const staple of ["Hallowed Fountain", "Blood Crypt"]) {
      await db("user_cards").insert({
        user_id: u.id,
        card_name: staple,
        list_type: "owned",
        quantity: 1,
        set_code: "EOE",
        is_foil: false,
        card_condition: "NM",
        card_language: "EN"
      }).onConflict(["user_id", "card_name", "list_type", "set_code", "is_foil", "card_condition", "card_language"]).merge();
      
      await db("user_cards").insert({
        user_id: u.id,
        card_name: staple,
        list_type: "tradelist",
        quantity: 1,
        set_code: "EOE",
        is_foil: false,
        card_condition: "NM",
        card_language: "EN"
      }).onConflict(["user_id", "card_name", "list_type", "set_code", "is_foil", "card_condition", "card_language"]).merge();
    }
  }

  console.log("Done seeding trade test data!");
  process.exit(0);
}

seed().catch(err => {
  console.error("Error seeding:", err);
  process.exit(1);
});

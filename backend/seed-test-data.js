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

  // Define test cards
  const cardsDistribution = [
    { 
      user: dbUsers[0], // UserWhite
      tradelist: ["Plains", "Swords to Plowshares", "Teferi's Protection", "Esper Sentinel"], 
      wishlist: ["Island", "Counterspell", "Smothering Tithe"] 
    },
    { 
      user: dbUsers[1], // UserBlue
      tradelist: ["Island", "Counterspell", "Rhystic Study", "Cyclonic Rift"], 
      wishlist: ["Swamp", "Dark Ritual", "Fierce Guardianship"] 
    },
    { 
      user: dbUsers[2], // UserBlack
      tradelist: ["Swamp", "Dark Ritual", "Demonic Tutor", "Vampiric Tutor"], 
      wishlist: ["Mountain", "Lightning Bolt", "Toxic Deluge"] 
    },
    { 
      user: dbUsers[3], // UserRed
      tradelist: ["Mountain", "Lightning Bolt", "Dockside Extortionist", "Deflecting Swat"], 
      wishlist: ["Forest", "Llanowar Elves", "Jeska's Will"] 
    },
    { 
      user: dbUsers[4], // UserGreen
      tradelist: ["Forest", "Llanowar Elves", "Sylvan Library", "Craterhoof Behemoth"], 
      wishlist: ["Plains", "Swords to Plowshares", "The Great Henge"] 
    },
    { 
      user: devUser, 
      tradelist: [
        "Island", "Counterspell", "Swamp", "Dark Ritual", "Mountain", "Lightning Bolt", "Forest", "Llanowar Elves", "Plains", "Swords to Plowshares",
        "Smothering Tithe", "Fierce Guardianship", "Toxic Deluge", "Jeska's Will", "The Great Henge",
        "Mana Crypt", "Jeweled Lotus", "Ancient Tomb", "Blood Crypt", "Breeding Pool", "Overgrown Tomb", "Watery Grave", "Hallowed Fountain", "Temple Garden", "Godless Shrine", "Sacred Foundry", "Stomping Ground", "Steam Vents"
      ], 
      wishlist: [
        "Plains", "Swords to Plowshares",
        "Teferi's Protection", "Esper Sentinel",
        "Rhystic Study", "Cyclonic Rift",
        "Demonic Tutor", "Vampiric Tutor",
        "Dockside Extortionist", "Deflecting Swat",
        "Sylvan Library", "Craterhoof Behemoth"
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
        set_code: "LEA",
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
        set_code: "LEA",
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
        set_code: "LEA",
        is_foil: false,
        card_condition: "NM",
        card_language: "EN"
      }).onConflict(["user_id", "card_name", "list_type", "set_code", "is_foil", "card_condition", "card_language"]).merge();
    }
  }

  // Also give everyone a Sol Ring and Arcane Signet
  for (const u of dbUsers) {
    for (const staple of ["Sol Ring", "Arcane Signet"]) {
      await db("user_cards").insert({
        user_id: u.id,
        card_name: staple,
        list_type: "owned",
        quantity: 1,
        set_code: "C21",
        is_foil: false,
        card_condition: "NM",
        card_language: "EN"
      }).onConflict(["user_id", "card_name", "list_type", "set_code", "is_foil", "card_condition", "card_language"]).merge();
      
      await db("user_cards").insert({
        user_id: u.id,
        card_name: staple,
        list_type: "tradelist",
        quantity: 1,
        set_code: "C21",
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

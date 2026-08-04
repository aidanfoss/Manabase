import axios from "axios";

async function test() {
  try {
    const res = await axios.post("https://api.scryfall.com/cards/collection", {
      identifiers: [
        { name: "Sudden Strike" },
        { name: "Lightning Strike" }
      ]
    }, {
      headers: {
        "User-Agent": "Manabase/1.0",
        "Accept": "application/json"
      }
    });

    console.log(res.data.data.map(c => ({
      name: c.name,
      image_uri: c.image_uris ? c.image_uris.normal : (c.card_faces ? c.card_faces[0].image_uris.normal : null),
      price: c.prices.usd
    })));
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
test();

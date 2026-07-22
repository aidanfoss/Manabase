import sqlite3 from 'sqlite3';
const db = new sqlite3.Database('./db/manabase.db');
db.all("SELECT sql FROM sqlite_master WHERE name='user_cards';", (err, rows) => {
  if (err) console.error(err);
  else console.log("user_cards schema:", rows[0].sql);
  
  db.all("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='user_cards';", (err, rows) => {
    if (err) console.error(err);
    else console.log("Indexes:", rows.map(r => r.sql));
    db.close();
  });
});

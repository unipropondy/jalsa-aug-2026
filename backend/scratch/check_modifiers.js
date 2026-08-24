const { poolPromise, sql } = require("../config/db");

async function run() {
  const pool = await poolPromise;
  
  try {
    const orderIds = [
      '26579B83-5B55-4E4A-9CC0-4A16ED2DA5C1',
      '9E3133F1-2765-40E4-B279-7D27C6A5EB69'
    ];
    const oIds = orderIds.map(o => `'${o}'`).join(',');

    console.log("--- Checking RestaurantModifierDetail ---");
    const rmRes = await pool.request().query(`
      SELECT COUNT(*) AS cnt 
      FROM RestaurantModifierDetail 
      WHERE OrderId IN (${oIds})
    `);
    console.log("RestaurantModifierDetail matches:", rmRes.recordset[0].cnt);

    console.log("--- Checking RestaurantModifierDetailCur ---");
    const rmcRes = await pool.request().query(`
      SELECT COUNT(*) AS cnt 
      FROM RestaurantModifierDetailCur 
      WHERE OrderId IN (${oIds})
    `);
    console.log("RestaurantModifierDetailCur matches:", rmcRes.recordset[0].cnt);

  } catch (err) {
    console.error("Error running query:", err);
  } finally {
    process.exit(0);
  }
}

run();

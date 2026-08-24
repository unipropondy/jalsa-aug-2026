const { poolPromise, sql } = require("../config/db");

async function run() {
  const pool = await poolPromise;
  
  try {
    console.log("--- Checking RestaurantInvoice ---");
    const riRes = await pool.request().query(`
      SELECT *
      FROM RestaurantInvoice 
      WHERE RestaurantBillId IN ('A5802249-B38F-4D2C-9F7F-EF55533ACEE1', '9EE0A06F-AD00-484F-A730-5B0ECF6DCEFB')
    `);
    console.table(riRes.recordset);

  } catch (err) {
    console.error("Error running query:", err);
  } finally {
    process.exit(0);
  }
}

run();

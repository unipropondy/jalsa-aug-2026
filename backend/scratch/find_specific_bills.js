const { poolPromise, sql } = require("../config/db");

async function run() {
  const pool = await poolPromise;
  
  try {
    console.log("--- Finding specific bills ---");
    const shRes = await pool.request().query(`
      SELECT SettlementID, OrderId, BillNo, LastSettlementDate, start_date, OrderType, SysAmount 
      FROM SettlementHeader 
      WHERE BillNo IN ('20260821-0003', '20260821-0002')
    `);
    console.table(shRes.recordset);

  } catch (err) {
    console.error("Error running query:", err);
  } finally {
    process.exit(0);
  }
}

run();

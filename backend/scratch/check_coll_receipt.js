process.env.DB_SERVER = "202.156.19.151";
const sql = require("mssql");
require("dotenv").config({ path: "./backend/.env" });
process.env.DB_SERVER = "202.156.19.151";

async function checkColl() {
  const { poolPromise } = require("../config/db");
  const pool = await poolPromise;

  console.log("=== Searching for COLL-1791381480438 across tables ===");

  const tables = [
    "CustomerCreditTransactions",
    "PaymentTransactionDetails",
    "SettlementHeader",
    "SettlementItemDetail",
    "PrintMaster",
    "PrintJobs",
    "CashInEntry"
  ];

  for (const t of tables) {
    try {
      const res = await pool.request().query(`
        SELECT * FROM [${t}] 
        WHERE BillNo LIKE '%1791381480438%' OR Remarks LIKE '%1791381480438%' OR ReferenceNo LIKE '%1791381480438%'
      `);
      if (res.recordset.length > 0) {
        console.log(`Found in table [${t}]:`, res.recordset);
      }
    } catch (e) {}
  }

  // Also check if any table in DB has 'COLL-'
  const searchColl = await pool.request().query(`
    SELECT * FROM CustomerCreditTransactions WHERE ReferenceNo LIKE '%COLL%' OR Remarks LIKE '%COLL%' OR BillNo LIKE '%COLL%'
  `);
  console.log("CustomerCreditTransactions with COLL:", searchColl.recordset);

  await pool.close();
}

checkColl();

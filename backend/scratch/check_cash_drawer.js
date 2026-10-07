const { poolPromise } = require("../config/db");

async function checkCashDrawerLog() {
  const pool = await poolPromise;
  
  const billIds = [
    'DEF80C13-0F6E-47EB-AABA-135F51506047',
    '8149A819-D785-49E6-8FCA-64FE50449F04',
    '74A992DB-706A-4055-8136-AA1B74118B21'
  ];

  const bPlaceholders = billIds.map(id => `'${id}'`).join(",");

  const res = await pool.request().query(`
    SELECT * FROM CashDrawerLog WHERE ReferenceNo IN (${bPlaceholders}) OR Remarks LIKE '%DEF80C13%' OR Remarks LIKE '%8149A819%' OR Remarks LIKE '%74A992DB%'
  `);

  console.log("CashDrawerLog records:", res.recordset);

  if (res.recordset.length > 0) {
    await pool.request().query(`
      UPDATE CashDrawerLog 
      SET start_date = '2026-10-01' 
      WHERE ReferenceNo IN (${bPlaceholders}) OR Remarks LIKE '%DEF80C13%' OR Remarks LIKE '%8149A819%' OR Remarks LIKE '%74A992DB%'
    `);
    console.log("Updated start_date in CashDrawerLog to 2026-10-01.");
  }

  process.exit(0);
}

checkCashDrawerLog();

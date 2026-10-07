const { poolPromise } = require("../config/db");

async function checkCols() {
  const pool = await poolPromise;
  const res = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'CashDrawerLog'");
  console.log("CashDrawerLog columns:", res.recordset.map(r => r.COLUMN_NAME).join(", "));
  process.exit(0);
}

checkCols();

const { poolPromise } = require("../config/db");

async function main() {
  const pool = await poolPromise;
  const res = await pool.request().query("SELECT * FROM Paymode ORDER BY Position");
  console.log("Paymodes table contents:");
  console.table(res.recordset);
  process.exit(0);
}

main();

const { poolPromise } = require("../config/db");

async function checkCols() {
  const pool = await poolPromise;
  const tables = ['SettlementItemDetail', 'SettlementHeader', 'PaymentDetail', 'RestaurantInvoice'];
  for (const t of tables) {
    const res = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${t}'
    `);
    console.log(`Columns for ${t}:`, res.recordset.map(r => r.COLUMN_NAME).join(", "));
  }
  process.exit(0);
}

checkCols();

const { poolPromise, sql } = require("../config/db");

async function checkInvoiceColumns() {
  const pool = await poolPromise;
  const billId = '8149A819-D785-49E6-8FCA-64FE50449F04';

  const ri = await pool.request().query(`SELECT TOP 1 * FROM RestaurantInvoice WHERE RestaurantBillId = '${billId}'`);
  console.log("RestaurantInvoice keys:", Object.keys(ri.recordset[0] || {}));

  const sh = await pool.request().query(`SELECT TOP 1 * FROM SettlementHeader WHERE SettlementID = '${billId}'`);
  console.log("SettlementHeader keys:", Object.keys(sh.recordset[0] || {}));

  process.exit(0);
}

checkInvoiceColumns().catch(err => {
  console.error(err);
  process.exit(1);
});

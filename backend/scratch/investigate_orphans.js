const { poolPromise, sql } = require("../config/db");

async function main() {
  const pool = await poolPromise;
  const ids = [
    '723D1905-3F82-4F7E-8DC3-005FD7D17CC9',
    'EDB3669E-C9E3-4B21-BA4F-17D09CB4115F',
    'A143620B-B4C1-455C-8FB0-3406D8B88114',
    'A0AA133A-9637-4403-B0EA-6B61AC6E1709',
    '293B595E-FC8A-45B9-8A0F-924430711D05',
    '81536E4F-4E24-49AC-87B4-959AA5B1D82D'
  ];

  try {
    for (const id of ids) {
      console.log(`\n=================== ID: ${id} ===================`);
      
      // 1. Check RestaurantOrder
      try {
        const ro = await pool.request().input('id', sql.UniqueIdentifier, id)
          .query('SELECT * FROM RestaurantOrder WHERE OrderId = @id');
        console.log("RestaurantOrder:", ro.recordset[0] || "NOT FOUND");
      } catch (e) {
        console.log("RestaurantOrder Error:", e.message);
      }

      // 2. Check RestaurantOrderCur
      try {
        const roCur = await pool.request().input('id', sql.UniqueIdentifier, id)
          .query('SELECT * FROM RestaurantOrderCur WHERE OrderId = @id');
        console.log("RestaurantOrderCur:", roCur.recordset[0] || "NOT FOUND");
      } catch (e) {
        console.log("RestaurantOrderCur Error:", e.message);
      }

      // 3. Check RestaurantInvoice
      try {
        const ri = await pool.request().input('id', sql.UniqueIdentifier, id)
          .query('SELECT * FROM RestaurantInvoice WHERE RestaurantBillId = @id');
        console.log("RestaurantInvoice:", ri.recordset[0] || "NOT FOUND");
      } catch (e) {
        console.log("RestaurantInvoice Error:", e.message);
      }

      // 4. Check RestaurantInvoicecur
      try {
        const riCur = await pool.request().input('id', sql.UniqueIdentifier, id)
          .query('SELECT * FROM RestaurantInvoicecur WHERE RestaurantBillId = @id');
        console.log("RestaurantInvoicecur:", riCur.recordset[0] || "NOT FOUND");
      } catch (e) {
        console.log("RestaurantInvoicecur Error:", e.message);
      }

      // 5. Check SettlementHeader
      try {
        const sh = await pool.request().input('id', sql.UniqueIdentifier, id)
          .query('SELECT * FROM SettlementHeader WHERE SettlementID = @id');
        console.log("SettlementHeader (any date):", sh.recordset[0] || "NOT FOUND");
      } catch (e) {
        console.log("SettlementHeader Error:", e.message);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();

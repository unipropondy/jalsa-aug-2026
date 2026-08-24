const { poolPromise, sql } = require("../config/db");

async function run() {
  const pool = await poolPromise;

  const settlementIds = [
    'A5802249-B38F-4D2C-9F7F-EF55533ACEE1',
    '9EE0A06F-AD00-484F-A730-5B0ECF6DCEFB'
  ];

  const orderIds = [
    '26579B83-5B55-4E4A-9CC0-4A16ED2DA5C1',
    '9E3133F1-2765-40E4-B279-7D27C6A5EB69'
  ];

  const sIds = settlementIds.map(s => `'${s}'`).join(',');
  const oIds = orderIds.map(o => `'${o}'`).join(',');

  const tablesToCheck = [
    { table: 'SettlementHeader', idCol: 'SettlementID', isOrder: false },
    { table: 'SettlementItemDetail', idCol: 'SettlementID', isOrder: false },
    { table: 'PaymentDetail', idCol: 'RestaurantBillId', isOrder: false },
    { table: 'PaymentDetailCur', idCol: 'RestaurantBillId', isOrder: false },
    { table: 'RestaurantInvoice', idCol: 'RestaurantBillId', isOrder: false },
    { table: 'RestaurantInvoiceCur', idCol: 'RestaurantBillId', isOrder: false },
    { table: 'RestaurantOrder', idCol: 'OrderId', isOrder: true },
    { table: 'RestaurantOrderCur', idCol: 'OrderId', isOrder: true },
    { table: 'RestaurantOrderDetail', idCol: 'OrderId', isOrder: true },
    { table: 'RestaurantOrderDetailCur', idCol: 'OrderId', isOrder: true }
  ];

  try {
    console.log("--- Verifying start_date for both bills ---");
    for (const item of tablesToCheck) {
      const placeholder = item.isOrder ? oIds : sIds;
      const q = `
        SELECT [${item.idCol}] AS Id, start_date 
        FROM [${item.table}] 
        WHERE [${item.idCol}] IN (${placeholder})
      `;
      const res = await pool.request().query(q);
      const records = res.recordset;
      console.log(`\nTable: [${item.table}] - found ${records.length} records:`);
      records.forEach(r => {
        console.log(`  ID: ${r.Id} -> start_date: ${r.start_date}`);
      });
    }

  } catch (err) {
    console.error("Verification query failed:", err);
  } finally {
    process.exit(0);
  }
}

run();

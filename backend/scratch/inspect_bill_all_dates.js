const { poolPromise, sql } = require("../config/db");

async function main() {
  const pool = await poolPromise;

  const billId = 'B949C2D7-244D-41DB-93B8-1EF935225E19';
  const orderId = '1DA4478E-0D95-4DAC-9233-642BB15E81D8';
  const billNumber = '20261001-0001';

  console.log("=================================================================");
  console.log(`Inspecting ALL date/time columns for Bill ${billNumber}`);
  console.log("=================================================================\n");

  const tables = [
    { name: 'RestaurantInvoice', idCol: 'RestaurantBillId', val: billId },
    { name: 'RestaurantInvoiceCur', idCol: 'RestaurantBillId', val: billId },
    { name: 'RestaurantOrder', idCol: 'OrderId', val: orderId },
    { name: 'RestaurantOrderCur', idCol: 'OrderId', val: orderId },
    { name: 'RestaurantOrderDetail', idCol: 'OrderId', val: orderId },
    { name: 'RestaurantOrderDetailCur', idCol: 'OrderId', val: orderId },
    { name: 'PaymentDetail', idCol: 'RestaurantBillId', val: billId },
    { name: 'PaymentDetailCur', idCol: 'RestaurantBillId', val: billId },
    { name: 'SettlementHeader', idCol: 'SettlementID', val: billId },
    { name: 'SettlementItemDetail', idCol: 'SettlementID', val: billId }
  ];

  for (const t of tables) {
    const q = `SELECT * FROM [${t.name}] WHERE [${t.idCol}] = '${t.val}'`;
    const res = await pool.request().query(q);
    console.log(`\n--- TABLE: ${t.name} (${res.recordset.length} rows) ---`);
    if (res.recordset.length > 0) {
      res.recordset.forEach((row, idx) => {
        console.log(`Row ${idx + 1}:`);
        Object.keys(row).forEach(k => {
          if (k.toLowerCase().includes('date') || k.toLowerCase().includes('time') || k.toLowerCase().includes('created') || k.toLowerCase().includes('modified') || k.toLowerCase().includes('start')) {
            console.log(`  ${k}:`, row[k]);
          }
        });
      });
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

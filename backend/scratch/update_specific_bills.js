const { poolPromise, sql } = require("../config/db");

async function run() {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);

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

  try {
    await transaction.begin();
    console.log("Database transaction started.");

    const updates = [
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

    for (const update of updates) {
      const placeholder = update.isOrder ? oIds : sIds;
      const q = `
        UPDATE [${update.table}]
        SET start_date = '2026-08-20 00:00:00.000'
        WHERE [${update.idCol}] IN (${placeholder})
      `;
      const result = await transaction.request().query(q);
      console.log(`Table [${update.table}]: updated ${result.rowsAffected[0]} rows.`);
    }

    await transaction.commit();
    console.log("Database transaction committed successfully! Both bills moved to 2026-08-20.");

  } catch (err) {
    console.error("Error during transaction, rolling back...", err);
    try {
      await transaction.rollback();
      console.log("Transaction rolled back successfully.");
    } catch (rollbackErr) {
      console.error("Failed to rollback transaction:", rollbackErr);
    }
  } finally {
    process.exit(0);
  }
}

run();

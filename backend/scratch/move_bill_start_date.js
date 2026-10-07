const { poolPromise, sql } = require("../config/db");

async function main() {
  const pool = await poolPromise;

  const billId = 'B949C2D7-244D-41DB-93B8-1EF935225E19';
  const orderId = '1DA4478E-0D95-4DAC-9233-642BB15E81D8';
  const billNumber = '20261001-0001';
  const newStartDate = '2026-09-30';

  console.log("=========================================================================");
  console.log(`MOVING START_DATE FOR BILL ${billNumber} TO ${newStartDate}`);
  console.log(`RestaurantBillId / SettlementId: ${billId}`);
  console.log(`OrderId: ${orderId}`);
  console.log("=========================================================================\n");

  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  const updateQueries = [
    { name: 'RestaurantOrderCur', query: `UPDATE RestaurantOrderCur SET START_DATE = '${newStartDate}' WHERE OrderId = '${orderId}'` },
    { name: 'RestaurantOrderDetailCur', query: `UPDATE RestaurantOrderDetailCur SET START_DATE = '${newStartDate}' WHERE OrderId = '${orderId}'` },
    { name: 'RestaurantInvoiceCur', query: `UPDATE RestaurantInvoiceCur SET start_date = '${newStartDate}' WHERE RestaurantBillId = '${billId}'` },
    { name: 'PaymentDetailCur', query: `UPDATE PaymentDetailCur SET start_date = '${newStartDate}' WHERE RestaurantBillId = '${billId}'` },
    { name: 'RestaurantOrder', query: `UPDATE RestaurantOrder SET START_DATE = '${newStartDate}' WHERE OrderId = '${orderId}'` },
    { name: 'RestaurantOrderDetail', query: `UPDATE RestaurantOrderDetail SET START_DATE = '${newStartDate}' WHERE OrderId = '${orderId}'` },
    { name: 'SettlementItemDetail', query: `UPDATE SettlementItemDetail SET start_date = '${newStartDate}' WHERE SettlementID = '${billId}'` },
    { name: 'PaymentDetail', query: `UPDATE PaymentDetail SET start_date = '${newStartDate}' WHERE RestaurantBillId = '${billId}'` },
    { name: 'SettlementHeader', query: `UPDATE SettlementHeader SET start_date = '${newStartDate}' WHERE SettlementID = '${billId}'` },
    { name: 'RestaurantInvoice', query: `UPDATE RestaurantInvoice SET start_date = '${newStartDate}' WHERE RestaurantBillId = '${billId}'` }
  ];

  try {
    for (const item of updateQueries) {
      const res = await transaction.request().query(item.query);
      console.log(`✅ [${item.name}]: Updated ${res.rowsAffected[0]} row(s)`);
    }

    await transaction.commit();
    console.log(`\n🎉 TRANSACTION COMMITTED SUCCESSFULLY! All tables updated.\n`);

    // Verification step
    console.log("--- Verifying Updated Records across All 10 Tables ---");
    const checkTables = [
      { name: 'RestaurantOrderCur', col: 'START_DATE', idCol: 'OrderId', idVal: orderId },
      { name: 'RestaurantOrderDetailCur', col: 'START_DATE', idCol: 'OrderId', idVal: orderId },
      { name: 'RestaurantInvoiceCur', col: 'start_date', idCol: 'RestaurantBillId', idVal: billId },
      { name: 'PaymentDetailCur', col: 'start_date', idCol: 'RestaurantBillId', idVal: billId },
      { name: 'RestaurantOrder', col: 'START_DATE', idCol: 'OrderId', idVal: orderId },
      { name: 'RestaurantOrderDetail', col: 'START_DATE', idCol: 'OrderId', idVal: orderId },
      { name: 'SettlementItemDetail', col: 'start_date', idCol: 'SettlementID', idVal: billId },
      { name: 'PaymentDetail', col: 'start_date', idCol: 'RestaurantBillId', idVal: billId },
      { name: 'SettlementHeader', col: 'start_date', idCol: 'SettlementID', idVal: billId },
      { name: 'RestaurantInvoice', col: 'start_date', idCol: 'RestaurantBillId', idVal: billId }
    ];

    for (const t of checkTables) {
      const res = await pool.request().query(`
        SELECT COUNT(*) as cnt, MIN(${t.col}) as min_date, MAX(${t.col}) as max_date 
        FROM [${t.name}] 
        WHERE ${t.idCol} = '${t.idVal}'
      `);
      const minD = res.recordset[0].min_date ? new Date(res.recordset[0].min_date).toISOString().substring(0, 10) : 'N/A';
      const maxD = res.recordset[0].max_date ? new Date(res.recordset[0].max_date).toISOString().substring(0, 10) : 'N/A';
      console.log(`Table [${t.name}]: Count=${res.recordset[0].cnt}, min_date=${minD}, max_date=${maxD}`);
    }

    process.exit(0);

  } catch (err) {
    try {
      await transaction.rollback();
    } catch (rbErr) {
      // rollback err
    }
    console.error("❌ Failed to update start_date:", err.message);
    process.exit(1);
  }
}

main();

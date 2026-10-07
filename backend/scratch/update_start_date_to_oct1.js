const { poolPromise, sql } = require("../config/db");

async function main() {
  const pool = await poolPromise;
  
  const billNumbers = ["20261002-0004", "20261002-0005", "20261002-0006"];
  const newStartDate = "2026-10-01";

  const billIds = [
    'DEF80C13-0F6E-47EB-AABA-135F51506047',
    '8149A819-D785-49E6-8FCA-64FE50449F04',
    '74A992DB-706A-4055-8136-AA1B74118B21'
  ];

  const orderIds = [
    'A4F23C73-A1F9-4863-837C-D21225E8CD2C',
    '38A4929E-B52A-4A63-8C92-7A76E55CA6F4',
    '3C6EC831-61EE-4E3B-836C-38234E81D61F'
  ];

  const bPlaceholders = billIds.map(id => `'${id}'`).join(",");
  const oPlaceholders = orderIds.map(id => `'${id}'`).join(",");

  console.log(`=======================================================`);
  console.log(`Updating start_date to ${newStartDate} for Bills: ${billNumbers.join(", ")}`);
  console.log(`=======================================================\n`);

  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  const updates = [
    { name: 'RestaurantOrderCur', query: `UPDATE RestaurantOrderCur SET START_DATE = '${newStartDate}' WHERE OrderId IN (${oPlaceholders})` },
    { name: 'RestaurantOrderDetailCur', query: `UPDATE RestaurantOrderDetailCur SET START_DATE = '${newStartDate}' WHERE OrderId IN (${oPlaceholders})` },
    { name: 'RestaurantInvoiceCur', query: `UPDATE RestaurantInvoiceCur SET start_date = '${newStartDate}' WHERE RestaurantBillId IN (${bPlaceholders})` },
    { name: 'PaymentDetailCur', query: `UPDATE PaymentDetailCur SET start_date = '${newStartDate}' WHERE RestaurantBillId IN (${bPlaceholders})` },
    { name: 'RestaurantOrder', query: `UPDATE RestaurantOrder SET START_DATE = '${newStartDate}' WHERE OrderId IN (${oPlaceholders})` },
    { name: 'RestaurantOrderDetail', query: `UPDATE RestaurantOrderDetail SET START_DATE = '${newStartDate}' WHERE OrderId IN (${oPlaceholders})` },
    { name: 'SettlementItemDetail', query: `UPDATE SettlementItemDetail SET start_date = '${newStartDate}' WHERE SettlementID IN (${bPlaceholders})` },
    { name: 'PaymentDetail', query: `UPDATE PaymentDetail SET start_date = '${newStartDate}' WHERE RestaurantBillId IN (${bPlaceholders})` },
    { name: 'SettlementHeader', query: `UPDATE SettlementHeader SET start_date = '${newStartDate}' WHERE SettlementID IN (${bPlaceholders})` },
    { name: 'RestaurantInvoice', query: `UPDATE RestaurantInvoice SET start_date = '${newStartDate}' WHERE RestaurantBillId IN (${bPlaceholders})` }
  ];

  try {
    for (const u of updates) {
      try {
        const res = await transaction.request().query(u.query);
        console.log(`✅ ${u.name} updated: ${res.rowsAffected[0]} row(s)`);
      } catch (err) {
        console.error(`❌ Error updating ${u.name}:`, err.message);
        throw err;
      }
    }

    await transaction.commit();
    console.log(`\n🎉 TRANSACTION COMMITTED SUCCESSFULLY!\n`);

    // Verification step
    console.log("--- Verifying Updated Records across All 10 Tables ---");
    const checkTables = [
      { name: 'RestaurantOrderCur', col: 'START_DATE', idCol: 'OrderId', ids: oPlaceholders },
      { name: 'RestaurantOrderDetailCur', col: 'START_DATE', idCol: 'OrderId', ids: oPlaceholders },
      { name: 'RestaurantInvoiceCur', col: 'start_date', idCol: 'RestaurantBillId', ids: bPlaceholders },
      { name: 'PaymentDetailCur', col: 'start_date', idCol: 'RestaurantBillId', ids: bPlaceholders },
      { name: 'RestaurantOrder', col: 'START_DATE', idCol: 'OrderId', ids: oPlaceholders },
      { name: 'RestaurantOrderDetail', col: 'START_DATE', idCol: 'OrderId', ids: oPlaceholders },
      { name: 'SettlementItemDetail', col: 'start_date', idCol: 'SettlementID', ids: bPlaceholders },
      { name: 'PaymentDetail', col: 'start_date', idCol: 'RestaurantBillId', ids: bPlaceholders },
      { name: 'SettlementHeader', col: 'start_date', idCol: 'SettlementID', ids: bPlaceholders },
      { name: 'RestaurantInvoice', col: 'start_date', idCol: 'RestaurantBillId', ids: bPlaceholders }
    ];

    for (const t of checkTables) {
      const res = await pool.request().query(`
        SELECT COUNT(*) as cnt, MIN(${t.col}) as min_date, MAX(${t.col}) as max_date 
        FROM [${t.name}] 
        WHERE ${t.idCol} IN (${t.ids})
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
    console.error("❌ Execution aborted due to error:", err.message);
    process.exit(1);
  }
}

main();

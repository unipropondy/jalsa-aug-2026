const { poolPromise, sql } = require("../config/db");

async function main() {
  const pool = await poolPromise;
  const billId = '8149A819-D785-49E6-8FCA-64FE50449F04';
  const orderId = '38A4929E-B52A-4A63-8C92-7A76E55CA6F4';
  const billNo = '20261002-0005';

  console.log(`=======================================================`);
  console.log(`Updating Paymode to NETS for Bill #${billNo}`);
  console.log(`Bill ID: ${billId}`);
  console.log(`Order ID: ${orderId}`);
  console.log(`=======================================================\n`);

  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    // 1. Update PaymentDetailCur
    const pdCurRes = await transaction.request().query(`
      UPDATE PaymentDetailCur 
      SET Paymode = 2, Remarks = 'NETS' 
      WHERE RestaurantBillId = '${billId}' OR OrderId = '${orderId}'
    `);
    console.log(`✅ PaymentDetailCur updated: ${pdCurRes.rowsAffected[0]} row(s)`);

    // 2. Update PaymentDetail
    const pdRes = await transaction.request().query(`
      UPDATE PaymentDetail 
      SET Paymode = 2, Remarks = 'NETS' 
      WHERE RestaurantBillId = '${billId}' OR SettlementId = '${billId}' OR OrderId = '${orderId}'
    `);
    console.log(`✅ PaymentDetail updated: ${pdRes.rowsAffected[0]} row(s)`);

    // 3. Update PaymentTransactionDetails (if any)
    const ptdRes = await transaction.request().query(`
      UPDATE PaymentTransactionDetails 
      SET PayModeId = 2 
      WHERE ReferenceId = '${billId}' OR ReferenceId = '${orderId}'
    `);
    console.log(`✅ PaymentTransactionDetails updated: ${ptdRes.rowsAffected[0]} row(s)`);

    // 4. Update SettlementTotalSales
    const stsRes = await transaction.request().query(`
      UPDATE SettlementTotalSales 
      SET PayMode = 'NETS' 
      WHERE SettlementID = '${billId}'
    `);
    console.log(`✅ SettlementTotalSales updated: ${stsRes.rowsAffected[0]} row(s)`);

    // 5. Update SettlementDetail
    const sdRes = await transaction.request().query(`
      UPDATE SettlementDetail 
      SET Paymode = 'NETS' 
      WHERE SettlementId = '${billId}'
    `);
    console.log(`✅ SettlementDetail updated: ${sdRes.rowsAffected[0]} row(s)`);

    // 6. Update SettlementTranDetail
    const stdRes = await transaction.request().query(`
      UPDATE SettlementTranDetail 
      SET PayMode = 'NETS' 
      WHERE SettlementID = '${billId}'
    `);
    console.log(`✅ SettlementTranDetail updated: ${stdRes.rowsAffected[0]} row(s)`);

    // 7. Delete/Update CashInEntry if any auto-cash-in was recorded
    const ciRes = await transaction.request().query(`
      DELETE FROM CashInEntry 
      WHERE ReferenceNo = '${billId}' OR Remarks LIKE '%${billId}%'
    `);
    console.log(`✅ CashInEntry cleaned up: ${ciRes.rowsAffected[0]} row(s)`);

    await transaction.commit();
    console.log(`\n🎉 TRANSACTION COMMITTED SUCCESSFULLY!\n`);

    // Verification
    console.log(`--- Verification of Updated Records ---`);
    
    const verPdCur = await pool.request().query(`SELECT PaymentId, RestaurantBillId, Paymode, Remarks FROM PaymentDetailCur WHERE RestaurantBillId = '${billId}'`);
    console.log("PaymentDetailCur:");
    console.table(verPdCur.recordset);

    const verPd = await pool.request().query(`SELECT PaymentId, RestaurantBillId, Paymode, Remarks FROM PaymentDetail WHERE RestaurantBillId = '${billId}'`);
    console.log("PaymentDetail:");
    console.table(verPd.recordset);

    const verSts = await pool.request().query(`SELECT SettlementID, PayMode, SysAmount, ManualAmount FROM SettlementTotalSales WHERE SettlementID = '${billId}'`);
    console.log("SettlementTotalSales:");
    console.table(verSts.recordset);

    const verSd = await pool.request().query(`SELECT SettlementId, Paymode, SysAmount, ManualAmount FROM SettlementDetail WHERE SettlementId = '${billId}'`);
    console.log("SettlementDetail:");
    console.table(verSd.recordset);

    const verStd = await pool.request().query(`SELECT SettlementID, PayMode, CashIn FROM SettlementTranDetail WHERE SettlementID = '${billId}'`);
    console.log("SettlementTranDetail:");
    console.table(verStd.recordset);

    process.exit(0);

  } catch (err) {
    await transaction.rollback();
    console.error("❌ Transaction Failed, rolled back:", err);
    process.exit(1);
  }
}

main();

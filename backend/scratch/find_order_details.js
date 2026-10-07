const { poolPromise, sql } = require("../config/db");

async function main() {
  const pool = await poolPromise;
  const billId = '8149A819-D785-49E6-8FCA-64FE50449F04';
  const orderId = '38A4929E-B52A-4A63-8C92-7A76E55CA6F4';

  console.log(`Checking details for BillID: ${billId} / OrderID: ${orderId}`);

  // 1. PaymentDetailCur
  const pdCur = await pool.request().query(`SELECT * FROM PaymentDetailCur WHERE RestaurantBillId = '${billId}'`);
  console.log("=== PaymentDetailCur ===");
  console.table(pdCur.recordset);

  // 2. PaymentDetail
  const pd = await pool.request().query(`SELECT * FROM PaymentDetail WHERE RestaurantBillId = '${billId}' OR SettlementId = '${billId}' OR OrderId = '${orderId}'`);
  console.log("=== PaymentDetail ===");
  console.table(pd.recordset);

  // 3. PaymentTransactionDetails
  const ptd = await pool.request().query(`SELECT * FROM PaymentTransactionDetails WHERE ReferenceId = '${billId}' OR ReferenceId = '${orderId}'`);
  console.log("=== PaymentTransactionDetails ===");
  console.table(ptd.recordset);

  // 4. SettlementTotalSales
  const sts = await pool.request().query(`SELECT * FROM SettlementTotalSales WHERE SettlementID = '${billId}'`);
  console.log("=== SettlementTotalSales ===");
  console.table(sts.recordset);

  // 5. SettlementDetail
  const sd = await pool.request().query(`SELECT * FROM SettlementDetail WHERE SettlementId = '${billId}'`);
  console.log("=== SettlementDetail ===");
  console.table(sd.recordset);

  // 6. SettlementTranDetail
  const std = await pool.request().query(`SELECT * FROM SettlementTranDetail WHERE SettlementID = '${billId}'`);
  console.log("=== SettlementTranDetail ===");
  console.table(std.recordset);

  // 7. CashInEntry
  const ci = await pool.request().query(`SELECT * FROM CashInEntry WHERE ReferenceNo = '${billId}' OR Remarks LIKE '%${billId}%'`);
  console.log("=== CashInEntry ===");
  console.table(ci.recordset);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

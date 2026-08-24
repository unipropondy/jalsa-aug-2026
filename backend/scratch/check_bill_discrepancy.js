const { poolPromise, sql } = require("../config/db");

async function main() {
  const pool = await poolPromise;
  const settlementId = '7A2667CA-F6E5-47A2-A1DB-DAF8837D9D43';

  try {
    // Check SettlementHeader
    const sh = await pool.request().input('id', sql.UniqueIdentifier, settlementId)
      .query('SELECT * FROM SettlementHeader WHERE SettlementID = @id');
    console.log("SettlementHeader:", sh.recordset[0]);

    // Check SettlementTotalSales
    const sts = await pool.request().input('id', sql.UniqueIdentifier, settlementId)
      .query('SELECT * FROM SettlementTotalSales WHERE SettlementID = @id');
    console.log("\nSettlementTotalSales:", sts.recordset);

    // Check PaymentDetailCur
    const pdc = await pool.request().input('id', sql.UniqueIdentifier, settlementId)
      .query('SELECT * FROM PaymentDetailCur WHERE RestaurantBillId = @id');
    console.log("\nPaymentDetailCur:", pdc.recordset);

    // Check PaymentDetail
    const pd = await pool.request().input('id', sql.UniqueIdentifier, settlementId)
      .query('SELECT * FROM PaymentDetail WHERE RestaurantBillId = @id');
    console.log("\nPaymentDetail:", pd.recordset);

    // Check CustomerCreditTransactions
    const cct = await pool.request().input('id', sql.UniqueIdentifier, settlementId)
      .query('SELECT * FROM CustomerCreditTransactions WHERE SettlementId = @id');
    console.log("\nCustomerCreditTransactions:", cct.recordset);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();

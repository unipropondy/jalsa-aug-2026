const { poolPromise, sql } = require("../config/db");

async function main() {
  const pool = await poolPromise;

  const billIds = [
    "DEF80C13-0F6E-47EB-AABA-135F51506047",
    "8149A819-D785-49E6-8FCA-64FE50449F04",
    "74A992DB-706A-4055-8136-AA1B74118B21",
  ];

  const orderIds = [
    "A4F23C73-A1F9-4863-837C-D21225E8CD2C",
    "38A4929E-B52A-4A63-8C92-7A76E55CA6F4",
    "3C6EC831-61EE-4E3B-836C-38234E81D61F",
  ];

  const bPlaceholders = billIds.map((id) => `'${id}'`).join(",");
  const oPlaceholders = orderIds.map((id) => `'${id}'`).join(",");

  console.log(
    "===============================================================",
  );
  console.log("MOVING ALL DATE/TIME COLUMNS TO 01-10-2026 FOR THE 3 ORDERS");
  console.log(
    "===============================================================\n",
  );

  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    // 1. RestaurantInvoice & RestaurantInvoiceCur
    await transaction.request().query(`
      UPDATE RestaurantInvoice 
      SET 
        InvoiceDate = '2026-10-01',
        OrderDateTime = DATEADD(DAY, -1, OrderDateTime),
        TimeBilled = DATEADD(DAY, -1, TimeBilled),
        CreatedOn = DATEADD(DAY, -1, CreatedOn)
      WHERE (RestaurantBillId IN (${bPlaceholders}) OR OrderId IN (${oPlaceholders}))
        AND CAST(OrderDateTime AS DATE) = '2026-10-02';

      UPDATE RestaurantInvoiceCur 
      SET 
        InvoiceDate = '2026-10-01',
        OrderDateTime = DATEADD(DAY, -1, OrderDateTime),
        TimeBilled = DATEADD(DAY, -1, TimeBilled),
        CreatedOn = DATEADD(DAY, -1, CreatedOn)
      WHERE (RestaurantBillId IN (${bPlaceholders}) OR OrderId IN (${oPlaceholders}))
        AND CAST(OrderDateTime AS DATE) = '2026-10-02';
    `);
    console.log(
      "✅ RestaurantInvoice & RestaurantInvoiceCur date columns shifted to Oct 01",
    );

    // 2. RestaurantOrder & RestaurantOrderCur
    await transaction.request().query(`
      UPDATE RestaurantOrder 
      SET 
        OrderDateTime = DATEADD(DAY, -1, OrderDateTime),
        TimeBilled = DATEADD(DAY, -1, TimeBilled),
        CreatedOn = DATEADD(DAY, -1, CreatedOn)
      WHERE OrderId IN (${oPlaceholders}) AND CAST(OrderDateTime AS DATE) = '2026-10-02';

      UPDATE RestaurantOrderCur 
      SET 
        OrderDateTime = DATEADD(DAY, -1, OrderDateTime),
        CreatedOn = DATEADD(DAY, -1, CreatedOn),
        ModifiedOn = DATEADD(DAY, -1, ModifiedOn)
      WHERE OrderId IN (${oPlaceholders}) AND CAST(OrderDateTime AS DATE) = '2026-10-02';
    `);
    console.log(
      "✅ RestaurantOrder & RestaurantOrderCur date columns shifted to Oct 01",
    );

    // 3. RestaurantOrderDetail & RestaurantOrderDetailCur
    await transaction.request().query(`
      UPDATE RestaurantOrderDetail 
      SET 
        OrderDateTime = DATEADD(DAY, -1, OrderDateTime),
        CreatedOn = DATEADD(DAY, -1, CreatedOn)
      WHERE OrderId IN (${oPlaceholders}) AND CAST(OrderDateTime AS DATE) = '2026-10-02';

      UPDATE RestaurantOrderDetailCur 
      SET 
        OrderDateTime = DATEADD(DAY, -1, OrderDateTime),
        CreatedOn = DATEADD(DAY, -1, CreatedOn),
        ModifiedOn = DATEADD(DAY, -1, ModifiedOn)
      WHERE OrderId IN (${oPlaceholders}) AND CAST(OrderDateTime AS DATE) = '2026-10-02';
    `);
    console.log(
      "✅ RestaurantOrderDetail & RestaurantOrderDetailCur date columns shifted to Oct 01",
    );

    // 4. PaymentDetail & PaymentDetailCur
    await transaction.request().query(`
      UPDATE PaymentDetail 
      SET 
        PaymentCollectedOn = DATEADD(DAY, -1, PaymentCollectedOn),
        CreatedOn = DATEADD(DAY, -1, CreatedOn),
        ModifiedOn = DATEADD(DAY, -1, ModifiedOn)
      WHERE (RestaurantBillId IN (${bPlaceholders}) OR SettlementId IN (${bPlaceholders}) OR OrderId IN (${oPlaceholders}))
        AND CAST(PaymentCollectedOn AS DATE) = '2026-10-02';

      UPDATE PaymentDetailCur 
      SET 
        PaymentCollectedOn = DATEADD(DAY, -1, PaymentCollectedOn),
        CreatedOn = DATEADD(DAY, -1, CreatedOn),
        ModifiedOn = DATEADD(DAY, -1, ModifiedOn)
      WHERE (RestaurantBillId IN (${bPlaceholders}) OR OrderId IN (${oPlaceholders}))
        AND CAST(PaymentCollectedOn AS DATE) = '2026-10-02';
    `);
    console.log(
      "✅ PaymentDetail & PaymentDetailCur date columns shifted to Oct 01",
    );

    // 5. SettlementHeader & SettlementItemDetail
    await transaction.request().query(`
      UPDATE SettlementHeader 
      SET 
        LastSettlementDate = DATEADD(DAY, -1, LastSettlementDate),
        LastDayEndDate = DATEADD(DAY, -1, LastDayEndDate),
        CreatedOn = DATEADD(DAY, -1, CreatedOn)
      WHERE (SettlementID IN (${bPlaceholders}) OR OrderID IN (${oPlaceholders}))
        AND CAST(LastSettlementDate AS DATE) = '2026-10-02';

      UPDATE SettlementItemDetail 
      SET 
        OrderDateTime = DATEADD(DAY, -1, OrderDateTime)
      WHERE SettlementID IN (${bPlaceholders}) AND CAST(OrderDateTime AS DATE) = '2026-10-02';
    `);
    console.log(
      "✅ SettlementHeader & SettlementItemDetail date columns shifted to Oct 01",
    );

    await transaction.commit();
    console.log(
      "\n🎉 ALL DATE/TIME COLUMNS SUCCESSFULLY UPDATED AND COMMITTED TO 01-10-2026!\n",
    );

    process.exit(0);
  } catch (err) {
    await transaction.rollback();
    console.error("❌ Failed to update date columns:", err.message);
    process.exit(1);
  }
}

main();

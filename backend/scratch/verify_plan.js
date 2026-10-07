const sql = require("mssql");
require("dotenv").config({ path: "./backend/.env" });

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: "202.156.19.151",
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 15000
  }
};

async function testUpdate(commit = false) {
  let pool;
  try {
    pool = await sql.connect(dbConfig);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    const customerId = 'E32129D2-B468-4C20-A37B-145B2BA2E7B3';
    const invoiceTxId = '7DC128DE-5BB8-4D71-A620-64B743E11C1E';
    const paymentTxId = 'CB27B0B0-0801-4F5D-B48D-548F98D5F22D';
    const allocationId = 'DBC0E44B-66A0-4C10-85E4-E3E37D05E704';
    const ptdId = '3FDF4775-C08B-4139-A310-EDA46788E55B';

    // 1. Update Payment Transaction
    await transaction.request()
      .input("PaymentTxId", paymentTxId)
      .query(`
        UPDATE CustomerCreditTransactions
        SET PaidAmount = 200.00,
            OutstandingAmount = -200.00
        WHERE TransactionId = @PaymentTxId
      `);

    // 2. Update Allocation
    await transaction.request()
      .input("AllocationId", allocationId)
      .query(`
        UPDATE CustomerCreditAllocations
        SET Amount = 200.00
        WHERE AllocationId = @AllocationId
      `);

    // 3. Update PaymentTransactionDetails
    await transaction.request()
      .input("PtdId", ptdId)
      .query(`
        UPDATE PaymentTransactionDetails
        SET Amount = 200.00
        WHERE PaymentTransactionId = @PtdId
      `);

    // 4. Update Invoice Transaction
    await transaction.request()
      .input("InvoiceTxId", invoiceTxId)
      .query(`
        UPDATE CustomerCreditTransactions
        SET PaidAmount = 1000.00,
            OutstandingAmount = 149.00,
            Status = 'PARTIAL',
            UpdatedDate = GETDATE()
        WHERE TransactionId = @InvoiceTxId
      `);

    // 5. Update CreditCustomerMaster
    await transaction.request()
      .input("CustomerId", customerId)
      .query(`
        UPDATE CreditCustomerMaster
        SET CurrentBalance = 149.00
        WHERE CustomerId = @CustomerId
      `);

    // Fetch statement exactly like backend route
    const res = await transaction.request()
      .input("MemberId", customerId)
      .query(`
        SELECT 
          TransactionId, SettlementId, BillNo, TransactionType,
          CASE WHEN TransactionType = 'CREDIT_SALE' THEN BillAmount WHEN TransactionType = 'PAYMENT' THEN PaidAmount ELSE ISNULL(NULLIF(BillAmount, 0), PaidAmount) END AS Amount,
          BillAmount, PaidAmount, OutstandingAmount, PaymentMethod, ReferenceNo, Remarks,
          CONVERT(VARCHAR, CreatedDate, 126) + '+08:00' AS CreatedDate, CreatedBy
        FROM CustomerCreditTransactions
        WHERE MemberId = @MemberId
        ORDER BY CreatedDate ASC
      `);

    console.log("=== EXACT UI STATEMENT OUTPUT PREVIEW ===");
    let runningBalance = 0;
    const transactions = res.recordset.map(t => {
      const netEffect = parseFloat(t.BillAmount || 0) - parseFloat(t.PaidAmount || 0);
      runningBalance += netEffect;
      return {
        Date: t.CreatedDate,
        Type: t.TransactionType,
        BillNo: t.BillNo,
        Amount: parseFloat(t.Amount),
        PaidAmount: parseFloat(t.PaidAmount),
        OutstandingAmount: parseFloat(t.OutstandingAmount),
        runningBalance: parseFloat(runningBalance.toFixed(2))
      };
    });
    console.table(transactions);

    const cust = await transaction.request()
      .input("CustomerId", customerId)
      .query(`SELECT CustomerId, Name, Phone, CurrentBalance FROM CreditCustomerMaster WHERE CustomerId = @CustomerId`);
    console.log("CreditCustomerMaster CurrentBalance:", cust.recordset[0].CurrentBalance);

    if (commit) {
      await transaction.commit();
      console.log("✅ COMMIT COMPLETE!");
    } else {
      await transaction.rollback();
      console.log("ℹ️ ROLLED BACK (Dry run)");
    }

    await pool.close();
  } catch (err) {
    console.error("Error in testUpdate:", err);
    if (pool) await pool.close();
  }
}

const commitFlag = process.argv.includes("--commit");
testUpdate(commitFlag);

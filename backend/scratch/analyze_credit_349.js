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
    connectTimeout: 15000,
    requestTimeout: 30000
  }
};

async function analyze() {
  try {
    const pool = await sql.connect(dbConfig);
    console.log("✅ Connected to MSSQL!");

    console.log("\n=== 1. CREDIT CUSTOMER MASTER (Anand / +6584299668) ===");
    const custRes = await pool.request().query(`
      SELECT CustomerId, Name, Phone, Email, CreditLimit, CurrentBalance, Balance, IsActive, CreatedOn 
      FROM CreditCustomerMaster 
      WHERE Phone LIKE '%6584299668%' OR Name LIKE '%Anand%'
    `);
    console.log(custRes.recordset);

    if (custRes.recordset.length === 0) {
      console.log("No customer found by name Anand or phone 6584299668, listing top 10 CreditCustomerMaster:");
      const allCust = await pool.request().query(`SELECT TOP 10 * FROM CreditCustomerMaster ORDER BY CreatedOn DESC`);
      console.log(allCust.recordset);
      await pool.close();
      return;
    }

    const customerId = custRes.recordset[0].CustomerId;

    console.log(`\n=== 2. CUSTOMER CREDIT TRANSACTIONS for CustomerId ${customerId} ===`);
    const txRes = await pool.request()
      .input("CustomerId", customerId)
      .query(`
        SELECT TransactionId, MemberId, TransactionType, SettlementId, BillNo, BillAmount, PaidAmount, OutstandingAmount, PaymentMethod, ReferenceNo, Status, Remarks, CreatedDate, UpdatedDate 
        FROM CustomerCreditTransactions 
        WHERE MemberId = @CustomerId 
        ORDER BY CreatedDate ASC
      `);
    console.log(txRes.recordset);

    console.log(`\n=== 3. CUSTOMER CREDIT ALLOCATIONS for transactions of CustomerId ${customerId} ===`);
    const allocRes = await pool.request()
      .input("CustomerId", customerId)
      .query(`
        SELECT cca.AllocationId, cca.PaymentTransactionId, cca.InvoiceTransactionId, cca.Amount, cca.CreatedDate,
               pTx.TransactionType as PayType, pTx.PaidAmount as PayPaidAmt, pTx.Remarks as PayRemarks,
               iTx.BillNo as InvBillNo, iTx.BillAmount as InvBillAmt, iTx.PaidAmount as InvPaidAmt, iTx.OutstandingAmount as InvOutAmt
        FROM CustomerCreditAllocations cca
        LEFT JOIN CustomerCreditTransactions pTx ON cca.PaymentTransactionId = pTx.TransactionId
        LEFT JOIN CustomerCreditTransactions iTx ON cca.InvoiceTransactionId = iTx.TransactionId
        WHERE pTx.MemberId = @CustomerId OR iTx.MemberId = @CustomerId
      `);
    console.log(allocRes.recordset);

    console.log(`\n=== 4. SEARCH TRANSACTIONS WITH AMOUNT 349 OR BILL 20260719-0008 ===`);
    const searchRes = await pool.request().query(`
      SELECT TransactionId, MemberId, TransactionType, BillNo, BillAmount, PaidAmount, OutstandingAmount, Status, Remarks, CreatedDate
      FROM CustomerCreditTransactions
      WHERE BillNo LIKE '%20260719-0008%' OR Remarks LIKE '%20260719-0008%' OR PaidAmount = 349 OR BillAmount = 349
    `);
    console.log(searchRes.recordset);

    await pool.close();
    process.exit(0);
  } catch (err) {
    console.error("Error analyzing:", err);
    process.exit(1);
  }
}

analyze();

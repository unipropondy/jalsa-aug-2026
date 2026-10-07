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

async function checkStatement() {
  const pool = await sql.connect(dbConfig);
  const memberId = 'E32129D2-B468-4C20-A37B-145B2BA2E7B3';
  const result = await pool.request()
    .input("MemberId", sql.UniqueIdentifier, memberId)
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

  console.log("RAW RECORDSET:");
  console.log(result.recordset);

  let runningBalance = 0;
  const transactions = result.recordset.map(t => {
    const netEffect = parseFloat(t.BillAmount || 0) - parseFloat(t.PaidAmount || 0);
    runningBalance += netEffect;
    return {
      ...t,
      Amount: parseFloat(t.Amount || 0),
      runningBalance: parseFloat(runningBalance.toFixed(2))
    };
  });

  console.log("\nTRANSACTIONS WITH RUNNING BALANCE:");
  console.log(transactions);

  await pool.close();
}

checkStatement();

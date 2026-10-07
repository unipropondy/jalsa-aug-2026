const sql = require("mssql");
require("dotenv").config({ path: "./backend/.env" });

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: "202.156.19.151",
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  options: { encrypt: false, trustServerCertificate: true, connectTimeout: 15000 }
};

async function checkPayments() {
  const pool = await sql.connect(dbConfig);
  
  console.log("=== 1. Active DateEntry ===");
  const activeDayRes = await pool.request().query("SELECT TOP 5 * FROM DateEntry ORDER BY CreatedDate DESC");
  console.log(activeDayRes.recordset);

  console.log("\n=== 2. Recent PAYMENT Transactions in CustomerCreditTransactions ===");
  const cctRes = await pool.request().query(`
    SELECT cct.*, m.Name as CreditCustName, mm.Name as MemberCustName
    FROM CustomerCreditTransactions cct
    LEFT JOIN CreditCustomerMaster m ON cct.MemberId = m.CustomerId
    LEFT JOIN MemberMaster mm ON cct.MemberId = mm.MemberId
    WHERE cct.TransactionType = 'PAYMENT'
    ORDER BY cct.CreatedDate DESC
  `);
  console.log(cctRes.recordset);

  console.log("\n=== 3. Querying /all endpoint logic with active DateEntry date ===");
  const activeStartDate = activeDayRes.recordset[0].StartDate;
  const formattedDate = activeStartDate instanceof Date ? activeStartDate.toISOString().split("T")[0] : activeStartDate;
  console.log("Active Start Date:", formattedDate);

  const queryStr = `
    SELECT 
      cct.TransactionId AS SettlementID,
      cct.CreatedDate AS SettlementDate,
      CAST(cct.CreatedDate AS DATE) AS BusinessDate,
      CASE WHEN mm.MemberId IS NOT NULL THEN 'Member Payment Collected' ELSE 'Credit Payment Collected' END AS OrderId,
      'LEDGER' AS OrderType,
      'LEDGER' AS TableNo,
      COALESCE(mm.Name, m.Name, 'Customer') AS Section,
      CAST(cct.CreatedBy AS VARCHAR(50)) AS CashierId,
      cct.Remarks AS BillNo,
      'Cashier' AS SER_NAME,
      cct.PaymentMethod AS PayMode,
      cct.PaidAmount AS SysAmount,
      cct.PaidAmount AS ManualAmount,
      cct.PaidAmount AS SubTotal,
      COALESCE(mm.Name, m.Name) AS CustomerName
    FROM CustomerCreditTransactions cct
    LEFT JOIN CreditCustomerMaster m ON cct.MemberId = m.CustomerId
    LEFT JOIN MemberMaster mm ON cct.MemberId = mm.MemberId
    WHERE cct.TransactionType = 'PAYMENT'
      AND CAST(cct.CreatedDate AS DATE) >= CAST('${formattedDate}' AS DATE)
      AND CAST(cct.CreatedDate AS DATE) <= CAST('${formattedDate}' AS DATE)
  `;
  const filterRes = await pool.request().query(queryStr);
  console.log("Filtered Ledger Payments for active date:", filterRes.recordset);

  await pool.close();
}

checkPayments();

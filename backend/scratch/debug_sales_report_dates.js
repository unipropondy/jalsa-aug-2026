process.env.DB_SERVER = "202.156.19.151";
const sql = require("mssql");
require("dotenv").config({ path: "./backend/.env" });
process.env.DB_SERVER = "202.156.19.151";

async function testSalesReportQueries() {
  const { poolPromise } = require("../config/db");
  const pool = await poolPromise;
  const { fetchFullReportData } = require("../utils/reportDataFetcher");

  console.log("=== 1. Active Day in DateEntry ===");
  const activeRes = await pool.request().query("SELECT TOP 5 * FROM DateEntry ORDER BY CreatedDate DESC");
  console.log(activeRes.recordset);

  console.log("\n=== 2. fetchFullReportData for '2026-10-06' ===");
  const reportOct6 = await fetchFullReportData('2026-10-06', '2026-10-06', pool);
  console.log("Oct 6 Credit Collections:", reportOct6.creditPaymentsCollected);
  console.log("Oct 6 Total Collections:", reportOct6.totalCollections);

  console.log("\n=== 3. fetchFullReportData for '2026-10-07' ===");
  const reportOct7 = await fetchFullReportData('2026-10-07', '2026-10-07', pool);
  console.log("Oct 7 Credit Collections:", reportOct7.creditPaymentsCollected);
  console.log("Oct 7 Total Collections:", reportOct7.totalCollections);

  console.log("\n=== 4. Check all CustomerCreditTransactions with TransactionType = 'PAYMENT' ===");
  const cctRes = await pool.request().query(`
    SELECT cct.TransactionId, cct.CreatedDate, cct.PaidAmount, cct.PaymentMethod, cct.Remarks, m.Name as CustName
    FROM CustomerCreditTransactions cct
    LEFT JOIN CreditCustomerMaster m ON cct.MemberId = m.CustomerId
    WHERE cct.TransactionType = 'PAYMENT'
    ORDER BY cct.CreatedDate DESC
  `);
  console.log(cctRes.recordset);

  await pool.close();
}

testSalesReportQueries();

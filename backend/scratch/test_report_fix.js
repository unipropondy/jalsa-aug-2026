process.env.DB_SERVER = "202.156.19.151";
const sql = require("mssql");
require("dotenv").config({ path: "./backend/.env" });
process.env.DB_SERVER = "202.156.19.151";

async function testReportFix() {
  const { poolPromise } = require("../config/db");
  const pool = await poolPromise;

  const startDateStr = '2026-10-06';
  const endDateStr = '2026-10-06';

  const shWhere = `CAST(ISNULL(sh.start_date, CAST(sh.LastSettlementDate AS DATE)) AS DATE) >= CAST('${startDateStr}' AS DATE) AND CAST(ISNULL(sh.start_date, CAST(sh.LastSettlementDate AS DATE)) AS DATE) <= CAST('${endDateStr}' AS DATE)`;
  const cctWhere = `CAST(ISNULL(cct.start_date, CAST(cct.CreatedDate AS DATE)) AS DATE) >= CAST('${startDateStr}' AS DATE) AND CAST(ISNULL(cct.start_date, CAST(cct.CreatedDate AS DATE)) AS DATE) <= CAST('${endDateStr}' AS DATE)`;

  const queryStr = `
    SELECT * FROM (
       SELECT 
         sh.SettlementID, 
         sh.LastSettlementDate AS SettlementDate, 
         COALESCE(sh.start_date, CAST(sh.LastSettlementDate AS DATE)) AS BusinessDate,
         sh.BillNo AS OrderId, 
         sh.OrderType,
         sh.TableNo, 
         sh.Section, 
         sh.CashierId, 
         sh.BillNo, 
         sh.SER_NAME,
         sh.SysAmount as SysAmount,
         COALESCE(mm.Name, ccm.Name) AS CustomerName
       FROM SettlementHeader sh
       LEFT JOIN MemberMaster mm ON sh.MemberId = mm.MemberId
       LEFT JOIN CreditCustomerMaster ccm ON sh.MemberId = ccm.CustomerId
       WHERE ${shWhere}

       UNION ALL

       SELECT 
         cct.TransactionId AS SettlementID,
         cct.CreatedDate AS SettlementDate,
         ISNULL(cct.start_date, CAST(cct.CreatedDate AS DATE)) AS BusinessDate,
         CASE WHEN mm.MemberId IS NOT NULL THEN 'Member Payment Collected' ELSE 'Credit Payment Collected' END AS OrderId,
         'LEDGER' AS OrderType,
         'LEDGER' AS TableNo,
         COALESCE(mm.Name, m.Name, 'Customer') AS Section,
         CAST(cct.CreatedBy AS VARCHAR(50)) AS CashierId,
         cct.Remarks AS BillNo,
         'Cashier' AS SER_NAME,
         cct.PaidAmount AS SysAmount,
         COALESCE(mm.Name, m.Name) AS CustomerName
       FROM CustomerCreditTransactions cct
       LEFT JOIN CreditCustomerMaster m ON cct.MemberId = m.CustomerId
       LEFT JOIN MemberMaster mm ON cct.MemberId = mm.MemberId
       WHERE cct.TransactionType = 'PAYMENT' AND ${cctWhere}
    ) CombinedSales
    ORDER BY SettlementDate DESC
  `;

  const res = await pool.request().query(queryStr);
  console.log("=== COMBINED SALES REPORT PREVIEW FOR OCT 6 ===");
  console.table(res.recordset.map(r => ({
    OrderId: r.OrderId,
    OrderType: r.OrderType,
    CustomerName: r.CustomerName,
    SysAmount: r.SysAmount,
    SettlementDate: r.SettlementDate,
    BusinessDate: r.BusinessDate
  })));

  const { fetchFullReportData } = require("../utils/reportDataFetcher");
  // Temporarily test with full report data after we modify reportDataFetcher.js
  await pool.close();
}

testReportFix();

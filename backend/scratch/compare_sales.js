const { poolPromise, sql } = require("../config/db");

async function main() {
  const pool = await poolPromise;
  
  const startDateStr = '2026-06-01';
  const endDateStr = '2026-08-11';

  console.log(`Querying date range: ${startDateStr} to ${endDateStr}`);

  try {
    // 1. Let's see the total counts of settlements and sums.
    const resSummary = await pool.request().query(`
      SELECT 
        COUNT(*) as TotalCount,
        SUM(SysAmount) as SumSysAmount,
        SUM(SubTotal) as SumSubTotal,
        SUM(DiscountAmount) as SumDiscountAmount,
        SUM(ServiceCharge) as SumServiceCharge,
        SUM(TotalTax) as SumTotalTax,
        SUM(VoidItemAmount) as SumVoidAmount
      FROM SettlementHeader
      WHERE CAST(COALESCE(start_date, CAST(LastSettlementDate AS DATE)) AS DATE) >= '${startDateStr}'
        AND CAST(COALESCE(start_date, CAST(LastSettlementDate AS DATE)) AS DATE) <= '${endDateStr}'
    `);
    console.log("SettlementHeader table overall raw sums:", resSummary.recordset[0]);

    // 2. Run the exact query used by fetchFullReportData in reportDataFetcher.js
    const shWhere = `CAST(ISNULL(sh.start_date, CAST(sh.LastSettlementDate AS DATE)) AS DATE) >= CAST('${startDateStr}' AS DATE) AND CAST(ISNULL(sh.start_date, CAST(sh.LastSettlementDate AS DATE)) AS DATE) <= CAST('${endDateStr}' AS DATE)`;
    const cctWhere = `CAST(cct.CreatedDate AS DATE) >= CAST('${startDateStr}' AS DATE) AND CAST(cct.CreatedDate AS DATE) <= CAST('${endDateStr}' AS DATE)`;

    const salesQuery = `
      SELECT 
        sh.SettlementID, 
        sh.LastSettlementDate AS SettlementDate, 
        sh.BillNo AS OrderId, 
        sh.OrderType,
        sh.TableNo, 
        sh.Section, 
        sh.CashierId, 
        sh.BillNo, 
        sh.SER_NAME,
        COALESCE(sts.PayMode, (
          SELECT TOP 1 pm2.PayMode 
          FROM PaymentDetailCur pd2 
          JOIN Paymode pm2 ON pd2.Paymode = pm2.Position 
          WHERE pd2.RestaurantBillId = sh.SettlementID
        )) as RawPayMode,
        ISNULL(sts.SysAmount, sh.SysAmount) as SysAmount,
        sh.SubTotal as SubTotal,
        ISNULL(sh.DiscountAmount, 0) as DiscountAmount,
        sh.DiscountType as DiscountType,
        ISNULL(sh.ServiceCharge, 0) as ServiceCharge,
        ISNULL(sh.TotalTax, 0) as TotalTax,
        ISNULL(sts.ReceiptCount, 0) as ReceiptCount,
        ISNULL(sh.VoidItemQty, 0) as VoidQty,
        ISNULL(sh.VoidItemAmount, 0) as VoidAmount,
        sh.IsCancelled,
        sh.CancellationReason,
        sh.RoundedBy as RoundedBy,
        ISNULL(cct_sale.OutstandingAmount, 0) AS OutstandingAmount,
        ISNULL(sh.IsVIP, 0) as IsVIP,
        ISNULL(sh.VIPDiscountAmount, 0) as VIPDiscountAmount
      FROM SettlementHeader sh
      LEFT JOIN SettlementTotalSales sts ON sh.SettlementID = sts.SettlementID
      LEFT JOIN CustomerCreditTransactions cct_sale ON sh.SettlementID = cct_sale.SettlementId AND cct_sale.TransactionType = 'CREDIT_SALE'
      WHERE ${shWhere}

      UNION ALL

      SELECT 
        cct.TransactionId AS SettlementID,
        cct.CreatedDate AS SettlementDate,
        CASE WHEN mm.MemberId IS NOT NULL THEN 'Member Payment Collected' ELSE 'Credit Payment Collected' END AS OrderId,
        'LEDGER' AS OrderType,
        'LEDGER' AS TableNo,
        COALESCE(mm.Name, m.Name, 'Customer') AS Section,
        CAST(cct.CreatedBy AS VARCHAR(50)) AS CashierId,
        cct.Remarks AS BillNo,
        'Cashier' AS SER_NAME,
        cct.PaymentMethod AS RawPayMode,
        cct.PaidAmount AS SysAmount,
        cct.PaidAmount AS SubTotal,
        0 AS DiscountAmount,
        NULL AS DiscountType,
        0 AS ServiceCharge,
        0 AS TotalTax,
        1 AS ReceiptCount,
        0 AS VoidQty,
        0 AS VoidAmount,
        0 AS IsCancelled,
        NULL AS CancellationReason,
        0 AS RoundedBy,
        0 AS OutstandingAmount,
        0 AS IsVIP,
        0 AS VIPDiscountAmount
      FROM CustomerCreditTransactions cct
      LEFT JOIN CreditCustomerMaster m ON cct.MemberId = m.CustomerId
      LEFT JOIN MemberMaster mm ON cct.MemberId = mm.MemberId
      WHERE cct.TransactionType = 'PAYMENT' AND ${cctWhere}
    `;

    const salesResult = await pool.request().query(salesQuery);
    const salesList = salesResult.recordset || [];
    console.log(`Total query records fetched (union): ${salesList.length}`);

    // Let's call the actual fetchFullReportData if we can, or just implement the identical logic
    const { fetchFullReportData } = require("../utils/reportDataFetcher");
    const fullReport = await fetchFullReportData(startDateStr, endDateStr, pool);

    console.log("\n=== COMPUTE SUMMARY ===");
    console.log("Total Sales:", fullReport.totalSales);
    console.log("Total Collections:", fullReport.totalCollections);
    console.log("Credit Payments Collected:", fullReport.creditPaymentsCollected);
    console.log("Member Payments Collected:", fullReport.memberPaymentsCollected);
    console.log("Total Orders:", fullReport.totalOrders);
    console.log("Total Items:", fullReport.totalItems);
    console.log("Void Qty:", fullReport.voidQty);
    console.log("Void Amount:", fullReport.voidAmount);
    console.log("Cancelled Count:", fullReport.cancelledCount);
    console.log("Cancelled Amount:", fullReport.cancelledAmount);
    console.log("Total VIP Discount:", fullReport.totalVIPDiscount);
    console.log("Credit Outstanding:", fullReport.creditOutstanding);

    console.log("\n=== PAYMENT BREAKDOWN ===");
    console.log(fullReport.paymentBreakdown);
    
    console.log("\n=== RECONCILIATION ===");
    console.log(fullReport.reconciliation);

    // Let's do some DB integrity checks:
    // Are there any records where RawPayMode is null?
    const nullPayModes = salesList.filter(s => !s.RawPayMode && !s.IsCancelled && s.OrderType !== 'LEDGER');
    if (nullPayModes.length > 0) {
      console.log(`⚠️ Found ${nullPayModes.length} records with NULL paymode!`);
      console.log(nullPayModes.slice(0, 5).map(s => ({ SettlementID: s.SettlementID, SysAmount: s.SysAmount })));
    } else {
      console.log("✅ No records with NULL paymode.");
    }

    // Let's inspect each raw pay mode and see how they are categorized.
    const rawModesCount = {};
    salesList.forEach(s => {
      if (s.IsCancelled || s.OrderType === 'LEDGER') return;
      const raw = String(s.RawPayMode || "NULL").toUpperCase().trim();
      rawModesCount[raw] = (rawModesCount[raw] || 0) + s.SysAmount;
    });
    console.log("\n=== Raw paymode sums in SettlementHeader/SettlementTotalSales (excluding LEDGER & Cancelled) ===");
    console.log(rawModesCount);

    // Let's check CustomerCreditTransactions entries
    const cctRes = await pool.request().query(`
      SELECT TransactionType, SUM(PaidAmount) as SumPaidAmount, SUM(OutstandingAmount) as SumOutstandingAmount, COUNT(*) as Count
      FROM CustomerCreditTransactions
      WHERE CAST(CreatedDate AS DATE) >= '${startDateStr}' AND CAST(CreatedDate AS DATE) <= '${endDateStr}'
      GROUP BY TransactionType
    `);
    console.log("\n=== CustomerCreditTransactions sums ===");
    console.log(cctRes.recordset);

    // Let's double check if there are payments in PaymentDetail or PaymentDetailCur that don't match SettlementTotalSales
    const pdCurRes = await pool.request().query(`
      SELECT pm.PayMode, SUM(pd.Amount) as SumAmount, COUNT(*) as Count
      FROM PaymentDetailCur pd
      JOIN Paymode pm ON pd.Paymode = pm.Position
      WHERE CAST(COALESCE(pd.start_date, CAST(pd.PaymentCollectedOn AS DATE)) AS DATE) >= '${startDateStr}'
        AND CAST(COALESCE(pd.start_date, CAST(pd.PaymentCollectedOn AS DATE)) AS DATE) <= '${endDateStr}'
      GROUP BY pm.PayMode
    `);
    console.log("\n=== PaymentDetailCur sums ===");
    console.log(pdCurRes.recordset);

  } catch (err) {
    console.error("Error in script:", err);
  } finally {
    process.exit(0);
  }
}

main();

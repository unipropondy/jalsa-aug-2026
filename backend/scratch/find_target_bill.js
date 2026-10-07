const { poolPromise } = require("../config/db");

async function main() {
  const pool = await poolPromise;
  
  console.log("Searching for Bill / Order #20261001-0001...");

  // Search by BillNumber in both tables
  const invRes = await pool.request().query(`
    SELECT 'RestaurantInvoice' as src, *
    FROM RestaurantInvoice
    WHERE BillNumber = '20261001-0001' OR BillNumber LIKE '%20261001-0001%'
    UNION ALL
    SELECT 'RestaurantInvoiceCur' as src, *
    FROM RestaurantInvoiceCur
    WHERE BillNumber = '20261001-0001' OR BillNumber LIKE '%20261001-0001%'
  `);

  console.log("Invoice Query Result Count:", invRes.recordset.length);
  console.log("Invoices:", invRes.recordset);

  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});

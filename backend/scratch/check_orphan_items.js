const { poolPromise, sql } = require("../config/db");

async function main() {
  const pool = await poolPromise;
  const ids = [
    'EDB3669E-C9E3-4B21-BA4F-17D09CB4115F',
    'A143620B-B4C1-455C-8FB0-3406D8B88114',
    '723D1905-3F82-4F7E-8DC3-005FD7D17CC9',
    '81536E4F-4E24-49AC-87B4-959AA5B1D82D',
    '293B595E-FC8A-45B9-8A0F-924430711D05',
    'A0AA133A-9637-4403-B0EA-6B61AC6E1709'
  ];

  try {
    for (const id of ids) {
      console.log(`\n=================== ID: ${id} ===================`);
      
      const od = await pool.request().input('id', sql.UniqueIdentifier, id)
        .query('SELECT * FROM RestaurantOrderDetail WHERE OrderId = (SELECT OrderId FROM RestaurantInvoice WHERE RestaurantBillId = @id)');
      console.log("RestaurantOrderDetail:", od.recordset.length, "items");
      od.recordset.forEach(item => {
        console.log(`- Item: ${item.DishName || item.DishId} | Qty: ${item.Quantity} | Price: ${item.PricePerUnit} | Total: ${item.TotalDetailLineAmount}`);
      });

      const odCur = await pool.request().input('id', sql.UniqueIdentifier, id)
        .query('SELECT * FROM RestaurantOrderDetailCur WHERE OrderId = (SELECT OrderId FROM RestaurantInvoice WHERE RestaurantBillId = @id)');
      console.log("RestaurantOrderDetailCur:", odCur.recordset.length, "items");
      odCur.recordset.forEach(item => {
        console.log(`- Item: ${item.DishName || item.DishId} | Qty: ${item.Quantity} | Price: ${item.PricePerUnit} | Total: ${item.TotalDetailLineAmount}`);
      });
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();

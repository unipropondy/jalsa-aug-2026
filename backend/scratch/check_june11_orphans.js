const { poolPromise, sql } = require("../config/db");

async function main() {
  const pool = await poolPromise;
  const ids = [
    'E884E126-967E-4602-8C45-586186B582E2',
    '4829C995-EE65-47D0-A2FA-C6A42F678721',
    'E09BFFFE-8E67-40EC-8BC0-E1A98DBEDA01',
    'C363CDC4-7FBC-40FA-A274-E8BBB95433A5',
    'BF45F53B-06C4-4DED-A392-3504D3597BFD',
    'EFC40124-781B-457C-ADCE-4F7DD9A080F9',
    'A205F173-9258-415A-8008-89CF7C23A4B0'
  ];

  try {
    for (const id of ids) {
      console.log(`\n=================== ID: ${id} ===================`);
      const pdc = await pool.request().input('id', sql.UniqueIdentifier, id)
        .query('SELECT * FROM PaymentDetailCur WHERE RestaurantBillId = @id');
      console.log("PaymentDetailCur:", pdc.recordset);

      const pd = await pool.request().input('id', sql.UniqueIdentifier, id)
        .query('SELECT * FROM PaymentDetail WHERE RestaurantBillId = @id');
      console.log("PaymentDetail:", pd.recordset);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();

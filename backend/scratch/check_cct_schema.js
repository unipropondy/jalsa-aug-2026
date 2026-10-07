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

async function checkSchema() {
  const pool = await sql.connect(dbConfig);
  const res = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'CustomerCreditTransactions'
  `);
  console.log("CustomerCreditTransactions columns:", res.recordset);
  await pool.close();
}

checkSchema();

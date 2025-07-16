const { Pool } = require('pg'); // 데이터베이스 연결 객체(PG 모듈 로드)
const dotenv = require('dotenv'); // require 메서드로 dotenv 모듈을 불러와서 환경 변수를 로드한다.
const camelcaseKeys = require('camelcase-keys').default; // _로 분할된 컬럽명을 카멜케이스로 변환
dotenv.config(); // dotenv 모듈을 사용하여 환경 변수를 로드한다

const pool = new Pool({
  user: process.env.DB_USER, // dotenv 로 부를때 process.env로 부름...왜인지 모름
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});

const sendQuery = async (query, params) => {
  try {
    const result = await pool.query(query, params);
    // DB 조회시 _로 분할된 컬럽명을 카멜케이스로 변환
    return camelcaseKeys(result.rows, { deep: true });
  } catch (error) {
    console.log(error);
    throw error;
  }
};

module.exports = { pool, sendQuery };

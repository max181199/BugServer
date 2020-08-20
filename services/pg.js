const { Pool } = require('pg');
const { PostgresError } = require('./custom-errors');
const S = require('string');

const client = new Pool({
  host: 'dad-datamart1.consultant.ru',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres'
});

const queryPg = async (res, query) => {
  try {
    const { rows } = await client.query(query);
    return rows;
  } catch (e) {
    res.status(500).send(`Postgres error: ${e.message}`);
    throw new PostgresError({
      message: e.message,
      query: S(query).decodeHTMLEntities().collapseWhitespace().s
    });
  }
}

module.exports = {
    client,
    queryPg
};

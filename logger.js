const path = require('path');
const {homedir} = require('os');
const winston = require('winston');
const jsonStringify = require('fast-safe-stringify');
const moment = require('moment');

const Transport = require('winston-transport');

const { client } = require('./services/pg');

class Postgres extends Transport {
  constructor(options) {
      super(options);
  }

  log(level, msg, meta, callback) {
    try {
      const url = new URL(msg.url);
      let params = url.search;
      
      if (params) {
        params = params.slice(1);
        params = JSON.parse('{"' + decodeURI(params).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g,'":"') + '"}');
      } else {
        params = {};
      }
      
      let ip = msg.ip;
      if (ip.lastIndexOf(":") != -1) {
        ip = ip.slice(ip.lastIndexOf(':')+1);
      } else {
        ip = 'localhost';
      }

      postgresInsert(url, msg, ip, params);
 
    } catch {
      console.log('Error');
    }
    
    let self = this;
    self.emit('logged');
    if (callback && typeof callback === 'function')
        callback(null, true);
  }
};

const postgresInsert = async(url, msg, ip, params) => {
  let created_at = moment().add(3, 'h').toISOString();
  let month = moment().format('YYYYMM');
  let service = url.hostname.split('.')[0].slice(4);

  const qHasTable = `
    SELECT *
    FROM information_schema.tables
    WHERE table_schema = 'stat' and table_name = 'events_${month}_${service}'
  `;
  const table = await client.query(qHasTable);

  if (table.rows.length == 0) {
    const qCreate = `
      CREATE TABLE stat.events_${month}_${service}
      PARTITION OF stat.events (PRIMARY KEY (login, created_at)) for values from ('${month}','${service}') to ('${month}','${service} ');

      CREATE INDEX ON stat.events_${month}_${service} USING HASH (login);
      CREATE INDEX ON stat.events_${month}_${service} USING HASH (query);
      CREATE INDEX ON stat.events_${month}_${service} USING HASH (created_at);
      CREATE INDEX ON stat.events_${month}_${service} USING HASH (fail_hash);
    `;
    await client.query(qCreate);
  }

  const qInsertLog = `
    INSERT INTO stat.events(
    login, created_at, month, service, query, params, query_time, ip, url, domain, fail_hash, fail_details)
    VALUES ('${msg.login ? msg.login : 'unknown'}','${created_at}', '${month}', '${service}', '${url.pathname}', '${JSON.stringify(params)}', ${msg.time}, '${ip}', '${url.origin}${decodeURI(url.search)}', '${url.hostname}', null, null);
  `;
  await client.query(qInsertLog);
}
 
let transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(
        ({level, message}) => (
          `[${moment().format('DD-MM-YYYY HH:mm:ss')}] ${level}:\n` +
          `Method: ${message.method}\n` +
          `Login: ${message.login}\n` +
          `IP: ${message.ip}\n`+
          `Time: ${message.time}\n` +
          `Path: ${message.url}\n`
        )
      )
    ),
    level: process.env.LOG_LEVEL_CONSOLE,
    handleExceptions: true
  }),
  new winston.transports.File({
    format: winston.format.combine(
      winston.format.printf(
        ({level, message}) => JSON.stringify({
            date: moment(moment().format()).add(3, 'h').toDate(),
            params: {
              path: message.url || null,
              ip: message.ip || null,
              time: message.time || null,
              login: message.login || null
            }
        })
      )
    ),
    level: process.env.LOG_LEVEL_FILE,
    filename: path.join(__dirname, '..', '..', 'logs', `${moment().format('YYYY-DD-MM')}`),
    handleExceptions: true,
    tailable: true
  })
];

if(process.env.NODE_ENV == 'production') {
  transports.push(
    new Postgres({})
  );
}

const logger = winston.createLogger({
  transports
});

logger.expressMiddleware = function expressMiddleware(req, res, next) {

  if (req.url.includes('/api/')) {
    const startTimestemp = new Date().getTime();
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const printExecutionTime = () => {
      const login = req.cookies.login;
      const fullUrl = req.protocol + '://' + req.headers['last-host'] + req.originalUrl;
      const message = {
        login,
        ip,
        method: req.method,
        url: fullUrl,
        time: new Date().getTime() - startTimestemp
      };
      logger.info(message);
    };

    req.on('error', function(e) {
     res.send('problem with request: ' + e.message);
    });

    req.on('end', () => {
      if (!req.isProxy) {
        printExecutionTime();
      }
    });

    return next();
  }

  return next();
};

module.exports = logger;

class CustomError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class PostgresError extends CustomError {
  constructor({ message, query }) {
    super(message);
    this.query = query;
  }
}

module.exports = {
  PostgresError,
};

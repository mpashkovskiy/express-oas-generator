const { createLogger, format, transports } = require('winston');
const { combine, timestamp, prettyPrint } = format;

module.exports.logger = createLogger({
  format: combine(
    timestamp(),
    prettyPrint()
  ),
  defaultMeta: { service: 'express-oas-generator' },
  transports: [
    new transports.Console()
  ],
});
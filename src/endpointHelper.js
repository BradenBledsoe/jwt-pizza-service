import config from "./config.js";
import pkg from "pizza-logger";
const Logger = pkg.default || pkg;
const logger = new Logger(config);
class StatusCodeError extends Error {
    constructor(message, statusCode) {
        super(message);
        logger.unhandledErrorLogger(this);
        this.statusCode = statusCode;
    }
}

const asyncHandler = (fn) => (req, res, next) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
};

export default {
    asyncHandler,
    StatusCodeError,
};

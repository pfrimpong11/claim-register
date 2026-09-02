export class AppError extends Error {
  /**
   * @param {object} input
   * @param {string} input.code
   * @param {string} input.message
   * @param {number} [input.status]
   * @param {unknown} [input.details]
   */
  constructor({ code, message, status = 500, details }) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

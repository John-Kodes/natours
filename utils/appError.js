// Extends from the Error class that we used before to throw errors
class AppError extends Error {
  // The params will come from what we pass in to the class
  constructor(message, statusCode) {
    super(message); // Used to call the parent class. Doing it only with the message because it's the only parameter the built-in error accepts and that the Error class needs

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    // Errors we create using this class will all be operational errors. Errors that we can predict.
    this.isOperational = true; // Doing this so that when we test for this property, and only send error messages back to the client for these operational errors that we created using this class.

    // We need to also capture the stack trace (err.stack). Every error gets this. It shows where the error happened.
    Error.captureStackTrace(this, this.contructor); // With this, when a new object is created and the contructor funciton is called, that function call is not gonna appear in the stack trace and not pollute it.
  }
}

module.exports = AppError;

// goal of this function is to catch async errors
// We need the next function in order to pass the error into it and send it to the global error handler middleware
// here we create a function that returns a new anonymous function. It is what's used for the route Handler
// fn returns a promise. The fulfilled promises are handled inside but we use the .catch() method to handle the rejected promises
module.exports = (fn) => (req, res, next) =>
  fn(req, res, next).catch((err) => next(err));

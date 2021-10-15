const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Catching uncaught exceptions:
process.on('uncaughtException', (err) => {
  console.log('UNHANDLER EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);

  process.exit(1);
});

// we pass in an object to specify the path where our config file is located. What this will do is read our variables from the file and save them into nodeJS .env variables.
// Needs to be done before requiring the app
dotenv.config({ path: './config.env' });

const app = require('./app');

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

// inside we pass in the database connection string. 2nd argument is an options object. Needed to specify to deal with deprecation warnings
// The connect method is actually gonna return a promise so we will handle it with the then() method. error handling will be handled later
mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
  })
  .then(() => console.log('DB connection successful!'));

const port = process.env.PORT || 3000;
// listen(): Starting up a server
// we create a server variable
const server = app.listen(port, () => {
  console.log(`App running on port ${port}...`);
});

// Each time there is an unhandled rejection in our application, the process object will emit an object called "unhandled rejection". And so, we can subscribe to that event:
// Any unhandled rejection will be handled here. This acts as a safety net
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLER REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);

  // server.close(function) closes the server. The callback function inside is executed after closing. We use it to end the application only after the server closes. Doing it this way gives the server time to finish all  the reqests that are being handled or pending. And only after that, the server is basically killed.
  server.close(() => {
    // process.exit() is an abrupt way of ending the program because it will immediately abort all the requests that are currently still running or pending. We should first close the server and then shut down the application.
    process.exit(1); // 0 = success, 1 = uncaught exception (usually 1)
  });
});

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    console.log('💥 Process terminated!');
    // SIGTERM already exits the application so no need to do it manually
  });
});

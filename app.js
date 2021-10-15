const path = require('path');
const express = require('express'); // Is a function which upon calling will add methods to our app variable
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const compression = require('compression');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const viewRouter = require('./routes/viewRoutes');

const app = express();

app.enable('trust proxy');

// Setting view engine
app.set('view engine', 'pug');
// we use the directory name variable by using the path core module. we dont use `${__dirname}/views` because we don't always know whether that we a path that we receive from somewhere already has a slash or not.
app.set('views', path.join(__dirname, 'views'));

////////// 1) GLOBAL MIDDLEWARES
//// SERVING STATIC FILES
// express.static() because we want to serve static files. url.com/overview.html now works. the 'public' from the URL is not needed because when we open a URL and it can't find in any of routes, it will then look into that public folder that we define and it kinda sets that folder to the route.
app.use(express.static(path.join(__dirname, 'public')));
//// Set Security HTTP headers (Helmet): It's best to use it early in the middleware stack so that these headers are really sure to be set
app.use(helmet());

// Development logging
if (process.env.NODE_ENV === 'development') {
  // argument: specifies how the logging looks like
  app.use(morgan('dev'));
}

//// Implementing a rate limiter
// .rateLimit() takes in an optionsObj. It is a function that returns a middleware function based on the object
const limiter = rateLimit({
  // Max amount of requests. Value may vary
  max: 100,
  // Time limit span. Window time span in milliseconds
  windowMs: 60 * 60 * 1000,
  // Error message
  message: 'Too many requests from this IP, Please try again in an hour!',
});
// affects all routes that start with /api
app.use('/api', limiter);
// In the headers of the response object, it will show the RateLimit and RateLimit-Remaining

//// BODY PARSER & READING DATA FROM BODY INTO REQ.BODY
// app.use(): Adds middleware to our middleware stack.
// express.json is the middleware. Middle ware is a function that can modify the incoming request data. This makes so that the data from the body is added to the request object.
app.use(express.json({ limit: '10kb' })); // the options we passed in limits amount of data being passed in

// Parsing the cookie and giving us access to it
app.use(cookieParser());

//// DATA SANITIZATION
// After reading the data from req.body is only when we can clean that data.
// Data Sanitization against NoSQL query injection
app.use(mongoSanitize()); // mongoSanitize() is a function we call that will return a middleware function. What the middleware does is look at the req.body, the req.query string and req.params, then it will filter out all of the '$' and '.' because that's how MongoDB operators are written.

// Data Sanitization against XSS
app.use(xss()); // cleans any user input form malicious HTML code with some JS code attached. It converts HTML symbols like "<>" to their HTML entities

//// Prevent parameter pollution: Should be used at the end of the middleware stack because what it does is to clear up the query string. If there are duplicates, it only uses the last one
app.use(
  // We can pass in an optionsObj with a whitelist property to enable some duplicates in the query string
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingAverage',
      'maxGroupSize',
      'difficulty',
      'price',
    ],
  })
);

app.use(compression());

//// TEST MIDDLEWARE
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log(req.cookies);
  next();
});

// API ROUTES: Mounting routers
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);

//// 404 route handler
// The order of the middleware matters so this needs to be at the last.
// app.all() will run for all HTTP methods
// * means everything
// req.originalUrl = original URL that was requested
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// To define an error handling middleware, we need to give the middleware a function with 4 arguments and express will automatically recognise it as an error handling middleware. And so calling it whenever there is an error.
app.use(globalErrorHandler);

module.exports = app;

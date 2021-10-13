const { promisify } = require('util');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  // console.log(user._id, token);
  const cookieOptions = {
    expires: new Date(
      // Setting the expiry date to 90 days after creation
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    // cookie will only be sent in HTTPS if true. We only want it true when app is in production
    // secure: true,
    // makes it so that the cookie cannot be accessed or modified in anyway by the browser
    httpOnly: true,
  };

  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  // Defining a cookie = res.cookie('name', value, {options})
  res.cookie('jwt', token, cookieOptions);

  // Remove the password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
  });

  const url = `${req.protocol}://${req.get('host')}/me`;
  // console.log(url);

  await new Email(newUser, url).sendWelcome();

  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) check if email and password input exists
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }
  // 2) check if user exis ts && password is correct
  const user = await User.findOne({ email }).select('+password');

  // in the userModel is where we create a function that will check if the given password is the same stored in the document by also encrypting the received password
  // Calling an instace method from the userModel. It's available on all documents of a collection
  // const correct = await user.correctPassword(password, user.password);

  // checks if user exists and if password is correct. Checking if password is correct in the if condition cuz will only work if user does exist
  if (!user || !(await user.correctPassword(password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // 3) if everything is ok, send token to client
  createSendToken(user, 200, res);
});

// Only for rendered pages, no errors! will continue to next middleware instead
exports.isLoggedIn = async (req, res, next) => {
  if (!req.cookies.jwt) return next();
  try {
    // 1) Verification the token
    const decoded = await promisify(jwt.verify)(
      req.cookies.jwt,
      process.env.JWT_SECRET
    );

    // 2) Check if user still exists
    const currentUser = await User.findById(decoded.id);

    if (!currentUser) return next();

    // 3) Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) return next();

    // There is a logged in user
    // setting variables to pug templates. Each pug template has access to res.locals
    res.locals.user = currentUser;
    next();
  } catch (err) {
    return next();
  }
};

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000), // lasts 10 sec
    httpOnly: true,
  });

  res.status(200).json({ status: 'success' });
};

// This middleware is for checking if the user has a valid JWT, protecting the resource access it's attached to
exports.protect = catchAsync(async (req, res, next) => {
  // 1) Gettting token and check if it exists
  // It's common for the token to be sent with an HTTP header with the request.
  let token;

  // Getting the token from the header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
    // With this, we can authenticate users based on tokens sent via cookies.
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );
  }

  // 2) Verification the token
  // jwt.verify() returns a promise. The params are the token we want to verify and the secret key.
  // promisfy() comes from the node module "util". It returns a version Promise of your function. The last param must be a callback, in this case jwt.verify(). The callback must follow Node's callback style (err, result)
  // The second () is just used to immediately call the function with the arguments inside.
  // decoded stores the payload from the JWT
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);

  if (!currentUser)
    return next(
      new AppError('The user belonging to this token no longer exists', 401)
    );

  // 4) Check if user changed password after the token was issued
  // We do this with an instance we create on the model
  // .iat is the time the JWT was created
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again', 401)
    );
  }

  // Grants access to protected route and also adds user data to req. We can use the req to send data from middleware to middleware
  req.user = currentUser;
  next();
});

// passing in arguments into the middleware function. The way this works is we create a wrapper function which will then return a middleware function that we actually want to create.
// roles is an array of arguments passed in. [admin, lead-guide]
exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    // console.log(roles);
    // We get the role of the user from the middleware that runs before the current one. In there, it passes on the user data to the req object.
    if (!roles.includes(req.user.role))
      next(new AppError('You do not have permission to run this action', 403));

    // if the role is included to the permitted roles array, we move on to the next middleware
    next();
  };

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user)
    return next(new AppError('There is no user with that email address.', 404));

  // 2) Generate the random reset token
  // We will create an instance method on the user Model since this has to do with the user data itself.
  const resetToken = user.createPasswordResetToken();
  // saving the document after the modifications from the instance method
  await user.save({ validateBeforeSave: false });

  try {
    // 3) Send it to user's email
    // resetURL: Ideally, the user can click on the email and do the request from there. That will work later for when we implement our dynamic website. For now, the user can copy the url to make it easier to do this request
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/resetPassword/${resetToken}`;
    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError('There was an error sending the email. Try again later!'),
      500
    );
  }
});

// Note: we grab the token from the URL of the api req which was emailed to the user
exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) get user based on the resetToken
  // we first get the resetToken then encrypt it so that we can compare that with the already encrypted version saved in the database
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    // This checks if the password token is expired
    passwordResetExpires: { $gt: Date.now() },
  });

  // 2) If token has not expired, and there is user, set the new password
  if (!user) return next(new AppError('Token is invalid or has expired'), 400);
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  // This only modifies the document so we have to save the changes
  await user.save(); // validator makes sure that the password and passwordConfirm are the same

  // 3) Update the changedPasswordAt property for the user

  // 4) Log the user in, send JWT
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select('+password');
  if (!user) return next(new AppError('user no existy'), 404);

  // 2) Check if POSTed password is correct
  if (!(await user.correctPassword(req.body.currentPassword)))
    return next(
      new AppError('Your password was incorrect, please try again'),
      401
    );

  // Ensures new password wont be the same as old
  if (req.body.currentPassword === req.body.newPassword)
    return next(
      new AppError('New password cannot be the same as the old password!', 401)
    );

  // 3) If so, update password
  user.password = req.body.newPassword;
  user.passwordConfirm = req.body.newPasswordConfirm;

  await user.save();

  // 4) Log user in, send JWT
  createSendToken(user, 200, res);
});

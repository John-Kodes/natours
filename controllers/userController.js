const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

// The 2nd param will be an array of arguments after the first 1
const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  // Looping through an object. Object.keys(obj) returns an array of an object with all the key names
  Object.keys(obj).forEach((el) => {
    // if the object key is an allowed field, we set a new property in the newObj with the value coming from the original object
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });

  return newObj;
};

// This middleware simply put's the user ID on the req.params object. Basically faking getting the id from the URL
exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm)
    return next(
      new AppError(
        'This route is not for password updates. Please use /updatePassword',
        400
      )
    );

  // Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(req.body, 'name', 'email');

  // 2) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    // returns the updated object instead of the old one
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    data: { updatedUser },
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({ status: 'success', data: null });
});

exports.createUser = (req, res) => {
  // 500 status means internal server error
  res.status(500).json({
    status: 'error',
    message: 'This route is not defined! please use /signUup instead',
  });
};

exports.getUser = factory.getOne(User);
exports.getAllUsers = factory.getAll(User);
exports.updateUser = factory.updateOne(User);
exports.deleteUser = factory.deleteOne(User);

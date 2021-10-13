const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');

// Inside the factory function, we'll need to pass in the model
exports.deleteOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.findByIdAndDelete(req.params.id);

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(204).json({
      status: 'success',
      data: null,
    });
  });

exports.updateOne = (Model) =>
  catchAsync(async (req, res, next) => {
    // query for the document we want and updating it Model.findByIdAndUpdate(id, data, options )
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true, // new updated object will be what's returned rather than the original
      runValidators: true, // If true, each time a document is updated, the validators specified in the schema will run again.
    });

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { data: doc },
    });
  });

exports.createOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.create(req.body);

    res.status(201).json({
      status: 'success',
      data: { data: doc },
    });
  });

// Tricky cuz we have a populate in the getTour handler. To get around this, we will pass in a populate optionsObj
exports.getOne = (Model, popOptions) =>
  catchAsync(async (req, res, next) => {
    // We first get the query (list of documents)
    let query = Model.findById(req.params.id);

    // If there is a populate optionsObj, we populate the query with the object
    if (popOptions) query = query.populate(popOptions);

    // NOTE: apparently you only need to await the last query

    // remember that the ID is in the api route endpoint so that's where we get it from
    const doc = await query;

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: { data: doc },
    });
  });

exports.getAll = (Model) =>
  catchAsync(async (req, res, next) => {
    // [hack] To allow for nested GET reviews on tour
    let filter = {};
    // If there is a tour Id from the URL params, we will filter all the reviews for the specified tour
    if (req.params.tourId) filter = { tour: req.params.tourId };

    // Using APIFeatures class
    const features = new APIFeatures(Model.find(filter), req.query)
      .filter()
      .sort()
      .limitFields()
      .paginate(); // chaining works because after calling each of these methods, we walways return "this" which is the object itself that as access to each of the methods.

    const doc = await features.query;

    //// Send response
    res.status(200).json({
      status: 'success',
      results: doc.length,
      data: { data: doc },
    });
  });

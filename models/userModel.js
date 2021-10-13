const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please tell us your name!'],
  },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    unique: true,
    lowercase: true, // transform email to lowercase
    validate: [validator.isEmail, 'Please provide a valid email'],
  },
  photo: String,
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'],
    default: 'user',
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minLength: 8,
    select: false,
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm password'],
    validate: {
      // remember that the validator function must return true or false
      // This will only work on SAVE
      validator: function (el) {
        return el === this.password; // if passwordConfirm(el) is the same as password value
      },
      message: 'Password are not the same!',
    },
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
});

// We use the pre-save middleware to handle the data before we save it to the database.
userSchema.pre('save', async function (next) {
  // .isModified(field): Checks if a field has been modified in a document
  if (!this.isModified('password')) return next();

  // We will be using a hashing algorithm called bcrypt. This algorithm will first salt then hash our password to protect it from bruteforce attacks.
  // "salt" means adding a random string to the password so that 2 equal passwords do not generate the same hash.
  // Setting password to encrypted version of the original
  this.password = await bcrypt.hash(this.password, 12); // .hash(): 1st param is the value we want to encrypt and the 2nd param is the cost param. It's a measure of how CPU instensive this operation will be.

  // Deleting a field - preventing the field to persist in a database
  this.passwordConfirm = undefined;
  next();
});

// This prehook middleware will run before a document saves. We want to set the passwordChangedAt property to now only when we modify the password property
userSchema.pre('save', function (next) {
  // function exits if the password isn't modified or if the document is new
  if (!this.isModified('password') || this.isNew) return next();

  // we go 1 sec behind will ensure that the token is always created after the password has been changed.
  this.passwordChangedAt = Date.now() - 1000;

  next();
});

// query middleware to only show active users
userSchema.pre(/^find/, function (next) {
  // this points to the current query
  this.find({ active: { $ne: false } });
  next();
});

// Creating an Instance method: A method that is available on all documents of a certain collection
userSchema.methods.correctPassword = async function (candidatePassword) {
  // The goal of this function is to send a Boolean
  // bcrypt.compare(notHashed, hashed) works by taking in the encrypted value, encrypts it then compares it to the already encrypted value
  return await bcrypt.compare(candidatePassword, this.password);
};

// JWTTimestamp is time when the JWT was created
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  // Check if property exists in the document
  // NOTE: if you are unable to get the property from the document, we need to make sure to update the schema so that it will create the user with the property
  if (this.passwordChangedAt) {
    // Here we convert the time to milliseconds and turn it to seconds
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );

    // if password was updated after the original time, it results in true

    return JWTTimestamp < changedTimestamp;
  }

  // False means NOT changed
  return false;
};

// FIXME: Note: This method only modifies the document but does not save it. Saving should be done in the middleware function
userSchema.methods.createPasswordResetToken = function () {
  // We will use the random bytes function from the built in crypto core module.
  // crypto.randomBytes(numOfCharacters) we then convert it to a hexadecimal string
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Encrypting the token: crypto.createHash('algorithm'), .update(variable): variable is what we want to update, .digest('hex') to store is as a hexadecimal
  // We save it into the database so then we can compare it with the token the user provides.
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  // console.log({ resetToken }, this.passwordResetToken);

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  // We send via email the unencrypted reset token. Otherwise, it wouldn't make much sense to encrypt it at all. So the database that was the exact same that we could use to change the password wouldn't be any encryption at all. The encrypted token will be useless to change the password
  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;

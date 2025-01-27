import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const User = mongoose.model("User");

const register = async (username, email, password, name, phoneNumber) => {
  // * check if username and password are both greater than 8
  //   * if not, throw { message: 'USERNAME PASSWORD TOO SHORT' }
  // * check if user with same username already exists
  //   * if not, throw { message: 'USERNAME ALREADY EXISTS' }
  // * salt and hash using bcrypt's sync functions
  //   * https://www.npmjs.com/package/bcryptjs#usage---sync
  // * if registration is successfull, return the newly created user

  // check if either username & password are too short
  if (username.length <= 8 || password.length <= 8) {
    throw { message: "USERNAME PASSWORD TOO SHORT" };
  }

  // check if username exists alreadt
  const checkUserExist = await User.findOne({ username: username });
  if (checkUserExist) {
    throw { message: "USERNAME ALREADY EXISTS" };
  }

  // salt & hash the password w/ bycrypt
  const hash = bcrypt.hashSync(password, 10);

  const user = new User({
    username: username,
    email: email,
    password: hash,
    name: name,
    phoneNumber: phoneNumber,
  });
  await user.save();
  // return user;
  return user;
};

export { register };

import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const User = mongoose.model("User");

passport.use(
  new LocalStrategy(
    { usernameField: "username", passwordField: "password" },
    async (username, password, done) => {
      try {
        //console.log("Attempting Login for Username:", username);
        const user = await User.findOne({ username });
        if (!user) {
          //console.log("User Not Found:", username);
          return done(null, false, { message: "USER NOT FOUND" });
        }

        // compare password with bcrypt
        const isMatch = await bcrypt.compare(password, user.password);
        //console.log("Password Match:", isMatch);
        if (!isMatch) {
          //console.log("Password Mismatch for User:", username);
          return done(null, false, { message: "PASSWORDS DO NOT MATCH" });
        }

        //console.log("Login Successful for User:", username);
        return done(null, user);
      } catch (err) {
        console.log("Error in LocalStrategy:", err);
        return done(err);
      }
    },
  ),
);

passport.serializeUser((user, done) => {
  //console.log("Serializing User:", user.id);
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  //console.log("Deserializing User ID:", id);
  try {
    const user = await User.findById(id);
    //console.log("Deserialized User:", user);
    done(null, user);
  } catch (err) {
    console.log("Error in Deserialization:", err);
    done(err);
  }
});

export default passport;

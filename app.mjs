import "./config.mjs";
import "./db.mjs";
import mongoose from "mongoose";
import sanitize from "mongo-sanitize";
import express from "express";
import session from "express-session";
import path from "path";
//import url from "url";
import { fileURLToPath } from "url";
import * as auth from "./auth.mjs";
import passport from "./passport-config.js";
import flash from "connect-flash";
import hbs from "hbs";

const app = express();

hbs.registerHelper("eq", (a, b) => String(a) === String(b));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("view engine", "hbs");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

const Bill = mongoose.model("Bill");
const User = mongoose.model("User");

app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: false,
  }),
);
app.use(passport.initialize());
app.use(passport.session());

app.use(flash());
app.use((req, res, next) => {
  res.locals.messages = req.flash();
  next();
});

//const authRequiredPaths = [];

const registrationMessages = {
  "USERNAME ALREADY EXISTS": "Username already exists",
  "USERNAME PASSWORD TOO SHORT": "Username or password is too short",
};

const ensureLoggedIn = (req, res, next) => {
  /* testing log
  console.log("Is Authenticated:", req.isAuthenticated());
  console.log("Session:", req.session);
  */
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }
  next();
};

app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

app.use((req, res, next) => {
  console.log(req.path.toUpperCase(), req.body);
  next();
});

/* debuggin log
app.post("/login", (req, res, next) => {
  console.log("########Login Request Body:", req.body);
  next();
});
*/

app.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    // render with logged-in user info
    res.render("index", { user: req.user });
  } else {
    res.redirect("/login");
  }
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", async (req, res) => {
  try {
    const newUser = await auth.register(
      sanitize(req.body.username),
      sanitize(req.body.email),
      req.body.password,
      sanitize(req.body.name),
      sanitize(req.body.phoneNumber),
    );
    req.login(newUser, (err) => {
      if (err) {
        throw err;
      }
      req.flash("success", "Registered sucessfully!");
      res.redirect("/");
    });
  } catch (err) {
    console.log(err);
    req.flash(
      "error",
      registrationMessages[err.message] ?? "Registration error",
    );
    res.redirect("/register");
  }
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (req, res) => {
    // redirect to index after logging in
    res.redirect("/");
  },
);

app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error("LOG OUT ERROR: ", err);
      return res.status(500).send("CANNOT LOG OUT.");
    }
    res.redirect("/login");
  });
});

app.get("/bills", ensureLoggedIn, async (req, res) => {
  try {
    const bills = await Bill.find({
      $or: [{ billPayer: req.user._id }, { "splitters.user": req.user._id }],
    })
      .populate("billPayer", "username")
      .populate("splitters.user", "username")
      .exec();

    /*
    const filteredBills = bills.map((bill) => ({
      ...bill.toObject(),
      splitters: bill.splitters.filter(
        (splitter) => String(splitter.user._id) === String(req.user._id),
      ),
    }));
    */

    //console.log("Filtered Bills:", bills);
    //console.log("USER", req.user._id);
    res.render("bills", { bills: bills, loggedInUser: req.user._id });
  } catch (error) {
    console.error(error);
    req.flash("error", "Error retrieving your bills.");
    res.redirect("/");
  }
});

app.get("/bills/create", ensureLoggedIn, (req, res) => {
  res.render("createBill");
});

// create new bill from form
app.post("/bills/create", ensureLoggedIn, async (req, res) => {
  try {
    const {
      title,
      subtotal,
      tax = 0,
      tip = 0,
      billPayer,
      splitters,
      complete,
    } = req.body;

    // Validate subtotal
    const subtotalValue = parseFloat(subtotal);
    if (isNaN(subtotalValue) || subtotalValue < 0) {
      req.flash("error", "Invalid subtotal.");
      return res.redirect("/bills/create");
    }

    const billPayerUser = await User.findOne({ username: billPayer });
    if (!billPayerUser) {
      req.flash("error", "Bill payer's username does not exist.");
      return res.redirect("/bills/create");
    }

    const totalTax = parseFloat(tax) || 0;
    const totalTip = parseFloat(tip) || 0;
    const grandTotal = subtotalValue + totalTax + totalTip;

    // Ensure splitters is an array
    const splittersArray = Array.isArray(splitters) ? splitters : [splitters];

    //console.log("CHECK STRUCTURE", splittersArray);

    const splitterDetails = await Promise.all(
      splittersArray.map(async (splitter) => {
        const user = await User.findOne({ username: splitter.user });
        if (!user) {
          throw new Error(`Username ${splitter.user} not found.`);
        }

        //console.log("SPLITEER ITEMS", splitter.items);

        /*
        The structure should be:[
         {
            user:'username',
            // an array of items
            items: [
              {name: 'item1', cost:'10'},
              {name: 'item2', cost:'20'},
            ]
          }
        ]
        */

        const items = Array.isArray(splitter.items)
          ? splitter.items.map((item) => ({
              name: typeof item.name === "string" ? item.name.trim() : "Item",
              cost: parseFloat(item.cost) || 0,
            }))
          : [];

        //console.log("CHECK ITEMS", items);

        const itemsCost = items.reduce((sum, item) => sum + item.cost, 0);

        const proportion = itemsCost / subtotalValue;
        const taxShare = proportion * totalTax;
        const tipShare = proportion * totalTip;
        const totalOwed = itemsCost + taxShare + tipShare;

        return {
          user: user._id,
          username: splitter.user,
          items,
          itemsCost: itemsCost.toFixed(2),
          taxShare: taxShare.toFixed(2),
          tipShare: tipShare.toFixed(2),
          totalOwed: totalOwed.toFixed(2),
          paid: splitter.paid || false,
        };
      }),
    );

    const newBill = new Bill({
      title,
      subtotal: subtotalValue,
      tax: totalTax,
      tip: totalTip,
      total: grandTotal,
      billPayer: billPayerUser._id,
      splitters: splitterDetails,
      complete: complete === "on",
    });

    await newBill.save();

    billPayerUser.bills.push(newBill._id);
    await billPayerUser.save();

    req.flash("success", "Bill created successfully.");
    res.redirect("/bills");
  } catch (error) {
    console.error(error);
    req.flash("error", `Error creating the bill: ${error.message}`);
    res.redirect("/bills/create");
  }
});

app.get("/bills/update/:id", ensureLoggedIn, async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate("billPayer", "username")
      .populate("splitters.user", "username")
      .exec();

    if (!bill) {
      return res.status(404).send("Bill not found.");
    }

    res.render("updateBill", { bill });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading bill details.");
  }
});

// update an existing bill
app.post("/bills/update/:id", ensureLoggedIn, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      subtotal,
      tax = 0,
      tip = 0,
      billPayer,
      splitters,
      complete,
    } = req.body;

    // Find bill payer by username
    const billPayerUser = await User.findOne({ username: billPayer });
    if (!billPayerUser) {
      return res.status(404).send("BILL PAYER'S USERNAME DOES NOT EXIST!");
    }

    const splittersArray = Array.isArray(splitters)
      ? splitters
      : Object.values(splitters).filter(
          (splitter) => splitter && splitter.user,
        );

    const totalTax = parseFloat(tax) || 0;
    const totalTip = parseFloat(tip) || 0;
    const subtotalValue = parseFloat(subtotal);
    const grandTotal = subtotalValue + totalTax + totalTip;

    //console.log("CHECK STRUCTURE", splittersArray);
    const splitterDetails = await Promise.all(
      splittersArray.map(async (splitter) => {
        const user = await User.findOne({ username: splitter.user });
        if (!user) {
          throw new Error(`Username ${splitter.user} not found.`);
        }

        //console.log("SPLITEER ITEMS", splitter.items);

        /*
        The structure should be:[
         {
            user:'username',
            // an array of items
            items: [
              {name: 'item1', cost:'10'},
              {name: 'item2', cost:'20'},
            ]
          }
        ]
        */

        const items = Array.isArray(splitter.items)
          ? splitter.items.map((item) => ({
              name: typeof item.name === "string" ? item.name.trim() : "Item",
              cost: parseFloat(item.cost) || 0,
            }))
          : [];

        const itemsCost = items.reduce((sum, item) => sum + item.cost, 0);
        const proportion = itemsCost / subtotalValue;
        const taxShare = proportion * totalTax;
        const tipShare = proportion * totalTip;
        const totalOwed = itemsCost + taxShare + tipShare;

        // Ensure the bill ID is linked to the user's bills array
        if (!user.bills.includes(id)) {
          user.bills.push(id);
          await user.save();
        }

        return {
          user: user._id,
          username: splitter.user,
          items,
          itemsCost: itemsCost.toFixed(2),
          taxShare: taxShare.toFixed(2),
          tipShare: tipShare.toFixed(2),
          totalOwed: totalOwed.toFixed(2),
          paid: splitter.paid || false,
        };
      }),
    );

    // Update the bill with new details
    const updatedBill = await Bill.findByIdAndUpdate(
      id,
      {
        title,
        subtotal: subtotalValue,
        tax: totalTax,
        tip: totalTip,
        total: grandTotal,
        billPayer: billPayerUser._id,
        splitters: splitterDetails,
        complete: complete === "on",
      },
      { new: true, runValidators: true },
    );

    if (!updatedBill) {
      req.flash("error", "Bill not found.");
      return res.redirect("/bills");
    }

    req.flash("success", "Bill updated successfully.");
    res.redirect("/bills");
  } catch (error) {
    console.error(error);
    res.status(500).send("ERROR UPDATING THE BILL");
  }
});

// delete a bill
app.post("/bills/delete/:id", ensureLoggedIn, async (req, res) => {
  try {
    const { id } = req.params;

    // find and delete the bill
    const deletedBill = await Bill.findByIdAndDelete(id);

    if (!deletedBill) {
      req.flash("error", "Bill not found.");
      return res.redirect("/bills");
    }

    // remove the bill from the billPayer's and splitters' "bills" arrays
    await User.updateOne(
      { _id: deletedBill.billPayer },
      { $pull: { bills: id } },
    );
    await User.updateMany(
      { _id: { $in: deletedBill.splitters.map((splitter) => splitter.user) } },
      { $pull: { bills: id } },
    );

    req.flash("success", "Bill deleted successfully.");
    res.redirect("/bills");
  } catch (error) {
    console.error(error);
    req.flash("error", "Error deleting the bill.");
    res.redirect("/bills");
  }
});

app.listen(process.env.PORT ?? 3000);

// for testing
export default app;

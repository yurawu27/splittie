import mongoose from "mongoose";
//import mongooseSlugPlugin from "mongoose-slug-plugin";

//mongoose.connect(process.env.DSN);

// only connect when it's not for testing
if (process.env.NODE_ENV !== "test") {
  mongoose.connect(process.env.uri);
  /*
  mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  */
}

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    username: { type: String, required: true },
    password: { type: String, required: true },
    email: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    bills: [
      /* maybe split it by "need to pay" & "need to collect" */
      { type: mongoose.Schema.Types.ObjectId, ref: "Bill" },
    ],
  } /* need timestamps?, {timestapms: true}*/,
);

const billSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    date: { type: Date, default: Date.now },
    // total amount on the bill
    /*
        should it be pre-taxed & pre-tip (both optional)? 
        tax: {type: Number}
        tip: {type: Number}
     */
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0, min: 0 }, // optional tax amount
    tip: { type: Number, default: 0, min: 0 }, // optional tip amount
    total: { type: Number, required: true, min: 0 },
    // add bill payer? --person who paid the whole bill?
    billPayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    splitters: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        username: { type: String, required: true },
        // items ordered/bought by the splitter
        items: [
          {
            name: { type: String, default: "Item" }, // optional item name
            cost: { type: Number, required: true, min: 0 }, // cost of the item
          },
        ],

        itemsCost: { type: Number, required: true, min: 0 }, // total cost of the splitter's items
        taxShare: { type: Number, default: 0, min: 0 }, // splitter's share of the tax
        tipShare: { type: Number, default: 0, min: 0 }, // splitter's share of the tip
        totalOwed: { type: Number, required: true, min: 0 }, // total amount owed by the splitter
        paid: { type: Boolean, default: false }, // payment status of the splitter
      },
    ],
    // complete - when everyone pays the payer
    complete: { type: Boolean, default: false },
  },
  { timestamps: true },
);

mongoose.model("User", UserSchema);
mongoose.model("Bill", billSchema);

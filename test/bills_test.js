import mongoose from "mongoose";
import { expect } from "chai";
import { MongoMemoryServer } from "mongodb-memory-server";
import session from "supertest-session";
import bcrypt from "bcryptjs";
import app from "../app.mjs";

const Bill = mongoose.model("Bill");
const User = mongoose.model("User");

let mongoServer;
let testSession;
let authCookies;

describe("Bill Route Handlers", function () {
  before(async function () {
    console.log("CONNECTING TO IN MEMORY DB");
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.disconnect();
    await mongoose.connect(uri);
  });

  after(async function () {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    testSession = session(app);

    // Re-create user
    const testUser = new User({
      username: "mrkrab",
      password: bcrypt.hashSync("krabspwd", 10),
      email: "mrkrab@example.com",
      name: "Mr. Krab",
      phoneNumber: "1234567890",
    });
    await testUser.save();

    const squidward = new User({
      username: "squidward",
      password: bcrypt.hashSync("squidpwd", 10),
      email: "squidward@example.com",
      name: "Squidward",
      phoneNumber: "0987654321",
    });
    await squidward.save();

    const res = await testSession
      .post("/login")
      .type("form")
      .send({ username: "mrkrab", password: "krabspwd" });

    authCookies = res.headers["set-cookie"];
    expect(authCookies).to.not.be.undefined;
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Bill.deleteMany({});
  });

  it("should successfully log in a user", async function () {
    const billsRes = await testSession.get("/bills").set("Cookie", authCookies.join("; "));
    expect(billsRes.status).to.equal(200);
  });

  it("should allow authenticated users to access /bills", async () => {
    const newSession = session(app); // Fresh session for this test
    const res = await newSession.get("/bills").set("Cookie", authCookies.join("; "));
    expect(res.status).to.equal(200);
  });

  it("should restrict access to /bills for non-authenticated users", async function () {
    const unauthSession = session(app);
    const res = await unauthSession.get("/bills");
    expect(res.status).to.equal(302); // Redirect to login
    expect(res.header.location).to.equal("/login");
  });

  it("should create a new bill", async function () {
    const res = await testSession
      .post("/bills/create")
      .set("Cookie", authCookies.join("; "))
      .type("form")
      .send({
        title: "Test Bill",
        subtotal: 100,
        tax: 10,
        tip: 5,
        billPayer: "mrkrab",
        splitters: [
          { user: "squidward", items: [{ name: "Item 1", cost: 50 }] },
        ],
      });

    expect(res.status).to.equal(302); // Redirect to /bills after creation
    expect(res.header.location).to.equal("/bills");

    // Verify the bill exists in the database
    const createdBill = await Bill.findOne({ title: "Test Bill" });
    expect(createdBill).to.exist;
    expect(createdBill.total).to.equal(115);
  });

  it("should update an existing bill", async function () {
    const mrKrab = await User.findOne({ username: "mrkrab" });
    const squidward = await User.findOne({ username: "squidward" });

    const testBill = new Bill({
      title: "Old Bill",
      subtotal: 30,
      tax: 2.4,
      tip: 0,
      total: 32.4,
      billPayer: mrKrab._id,
      splitters: [
        {
          user: squidward._id,
          username: squidward.username,
          items: [{ name: "krabby patty", cost: 17 }],
          itemsCost: 17,
          taxShare: 1.36,
          tipShare: 0,
          totalOwed: 18.36,
          paid: false,
        },
      ],
    });
    await testBill.save();

    const res = await testSession
      .post(`/bills/update/${testBill._id}`)
      .set("Cookie", authCookies.join("; "))
      .type("form")
      .send({
        title: "Updated Bill",
        subtotal: 60,
        tax: 6,
        tip: 3,
        billPayer: "mrkrab",
        splitters: [
          {
            user: "squidward",
            items: [{ name: "Updated Item", cost: 60 }],
          },
        ],
      });

    expect(res.status).to.equal(302); // Redirect to /bills after update
    expect(res.header.location).to.equal("/bills");

    const updatedBill = await Bill.findById(testBill._id).exec();

    expect(updatedBill.title).to.equal("Updated Bill");
    expect(updatedBill.total).to.equal(69);
  });

  it("should handle deletion of a bill", async function () {
    const mrKrab = await User.findOne({ username: "mrkrab" });
    const squidward = await User.findOne({ username: "squidward" });

    const testBill = new Bill({
      title: "Bill to delete :DD",
      subtotal: 40,
      tax: 3.2,
      tip: 0,
      total: 43.2,
      billPayer: mrKrab._id,
      splitters: [
        {
          user: squidward._id,
          username: squidward.username,
          items: [{ name: "krabby patty", cost: 20 }],
          itemsCost: 20,
          taxShare: 1.6,
          tipShare: 0,
          totalOwed: 21.6,
          paid: false,
        },
      ],
    });
    await testBill.save();

    const res = await testSession
      .post(`/bills/delete/${testBill._id}`)
      .set("Cookie", authCookies.join("; "))
      .send();
    expect(res.status).to.equal(302); // Redirect to /bills after deletion
    expect(res.header.location).to.equal("/bills");

    const deletedBill = await Bill.findById(testBill._id).exec();
    expect(deletedBill).to.be.null;
  });
});
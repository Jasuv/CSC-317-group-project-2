const path = require("path");
const express = require("express");
const session = require("express-session");
const ejs = require("ejs");
const {
  insertNewUser,
  authenticateUser,
  selectUser,
  updateUser,
  selectServicesByCategory,
  selectServiceDetails,
  createOrder,
  viewOrder,
  viewAllOrders,
} = require("./db/");

const app = express();

// Setup EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Session configuration
require("dotenv").config();
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // set to true if using HTTPS
  })
);

// Parse incoming form data and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Initialize cart if needed
app.use((req, res, next) => {
  if (!req.session.cart) {
    req.session.cart = {};
  }
  next();
});

// for templates to access user info
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;

  next();
});

// ==============================
// Static Pages
// ==============================

// For CSS and images we need to serve static files from the assets dir
app.use(express.static(path.join(__dirname, "public")));

// Homepage (static)
app.get("/", async (req, res) => {
  const content = await ejs.renderFile("views/home.ejs");
  res.render("layout", { body: content });
});

// FAQ (static)
app.get("/faq", async (req, res) => {
  if (req.session.user) {
  }

  const content = await ejs.renderFile("views/faq.ejs");
  res.render("layout", { body: content });
});

// Contact us (static)
app.get("/contact", async (req, res) => {
  const content = await ejs.renderFile("views/contact.ejs");
  res.render("layout", { body: content });
});

// About us (static)
app.get("/about", async (req, res) => {
  const content = await ejs.renderFile("views/about.ejs");
  res.render("layout", { body: content });
});

// Login (static)
app.get("/login", async (req, res) => {
  const content = await ejs.renderFile("views/login.ejs");
  res.render("layout", { body: content });
});

// Registration (static)
app.get("/registration", async (req, res) => {
  const content = await ejs.renderFile("views/registration.ejs");
  res.render("layout", { body: content });
});

// Logout (static)
app.get("/logout", async (req, res) => {
  req.session.user = null;
  res.redirect("/");
});

// ==============================
// Dynamic Routes
// ==============================

// Service Category: Web (dynamic)
app.get("/services/web", async (req, res) => {
  const services = await selectServicesByCategory("web");
  const title = "Web Services";
  const content = await ejs.renderFile("views/service-category.ejs", {
    services,
    title,
  });
  res.render("layout", { body: content });
});

// Service Category: Infrastructure (dynamic)
app.get("/services/infra", async (req, res) => {
  const services = await selectServicesByCategory("infra");
  const title = "Infrastructure Services";
  const content = await ejs.renderFile("views/service-category.ejs", {
    services,
    title,
  });
  res.render("layout", { body: content });
});

// Login/Registration (dynamic)
app.post("/auth", async (req, res) => {
  const { username, password } = req.body

  response = await authenticateUser(username, password);
  if (!response) {
    const content = await ejs.renderFile("views/login.ejs");
    res.render("layout", { body: content });
    console.log("There was an error in your username or password");
  } else {
    // req.session.user = { id: username };
    req.session.user = response;
    console.log(response);
    console.log("Login successful!");
    res.redirect("/");
  }
});

app.post("/auth", async (req, res) => {
  const { first, last, dob, email, username, password, phone } = req.body;

  console.log(first);
  console.log(last);
  console.log(dob);
  console.log(email);
  console.log("username: ", username);
  console.log("password: ", password);

  await insertNewUser({
    firstName: first,
    lastName: last,
    email: email,
    username: username,
    password: password,
    phoneNumber: phone,
  });

  req.session.user = { id: username };
  console.log(req.session.user);

  const content = await ejs.renderFile("views/home.ejs");
  res.render("layout", { body: content });
});

// Profile (dynamic)
app.get("/profile", async (req, res) => {});

// Order: View (GET) and Create (POST)
app.get("/order/:id", async (req, res) => {
  const userId = req.session.user.id;
  // const userId = 1;
  if (!req.params.id) return res.redirect("/");

  const order = await viewOrder(req.params.id);
  if (order[0].user_id !== userId) return res.redirect("/");

  const content = await ejs.renderFile("views/order.ejs", { order });
  res.render("layout", { body: content });
});

// Order Creation here
app.post("/checkout", async (req, res) => {
  const userId = req.session.user.id;
  // const userId = 1;
  const cart = req.session.cart;
  const orderItems = [];

  for (const id in cart) {
    const service = await selectServiceDetails(id);
    orderItems.push({
      serviceId: service.id,
      unitPrice: service.price,
      quantity: cart[id],
    });
  }
  const orderId = await createOrder(userId, orderItems);
  req.session.cart = {};

  res.redirect("/thanks/" + orderId);
});

app.get("/thanks/:id", async (req, res) => {
  if (!req.params.id) return res.redirect("/");

  const orderId = req.params.id;
  const content = await ejs.renderFile("views/thanks.ejs", { orderId });
  res.render("layout", { body: content });
});

// Service Detail (dynamic)
app.get("/service/:id", async (req, res) => {
  const service = await selectServiceDetails(req.params.id);
  const content = await ejs.renderFile("views/service-detail.ejs", {
    service,
  });
  res.render("layout", { body: content });
});

// Cart (Add/Remove/Checkout/View) (dynamic)
app.get("/cart", async (req, res) => {
  const cart = req.session.cart;
  const services = [];
  for (const id in cart) {
    const service = await selectServiceDetails(id);
    services.push({ ...service, quantity: cart[id] });
  }
  const content = await ejs.renderFile("views/cart.ejs", { services });
  res.render("layout", { body: content });
});

app.post("/cart/add", async (req, res) => {
  const service = await selectServiceDetails(req.body.id);
  if (!service) {
    return res.redirect("/");
  }
  if (!req.session.cart) req.session.cart = {};

  if (!req.session.cart.hasOwnProperty(service.id)) {
    req.session.cart[service.id] = 0;
  }
  req.session.cart[service.id] += 1;
  res.redirect("/cart");
});

app.post("/cart/remove", async (req, res) => {
  const service = await selectServiceDetails(req.body.id);
  if (!service) {
    return res.redirect("/");
  }
  if (!req.session.cart) req.session.cart = {};

  if (req.session.cart.hasOwnProperty(service.id)) {
    req.session.cart[service.id] -= 1;
    if (req.session.cart[service.id] == 0) {
      delete req.session.cart[service.id];
    }
  }
  res.redirect("/cart");
});
// app.post("/cart/checkout", async (req, res) => {});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

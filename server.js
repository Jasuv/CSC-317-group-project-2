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

// ==============================
// Static Pages
// ==============================

// For CSS and images we need to serve static files from the assets dir
app.use(express.static(path.join(__dirname, "public")));

// Homepage (static)
app.get("/", async (req, res) => {
  console.log("test");
  const content = await ejs.renderFile("views/home.ejs");
  res.render("layout", { body: content });
});

// ------------------------------
// TODO: Make the ejs files for the remaining static pages
// ------------------------------
// FAQ (static)
app.get("/faq", async (req, res) => {
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
// GET /auth shows login form, POST /auth handles registration
app.get("/auth", async (req, res) => {});
app.post("/auth", async (req, res) => {});

// Profile (dynamic)
app.get("/profile", async (req, res) => {});

// Order: View (GET) and Create (POST)
app.get("/order", async (req, res) => {});
app.post("/order", async (req, res) => {});

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
app.post("/cart/checkout", async (req, res) => {});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

const bcrypt = require("bcrypt");
const pool = require("./connection");
// =============================================================
// User Management Functions
// =============================================================

/**
 * Insert a New User
 * Routes: Login/Registration (dynamic)
 *
 * @param {Object} user - User details
 * @param {string} user.firstName - First name
 * @param {string} user.lastName - Last name
 * @param {string} user.dob - Date of birth (YYYY-MM-DD)
 * @param {string} user.email - Email address
 * @param {string} user.username - Username
 * @param {string} user.passwordHash - Hashed password
 * @param {string} user.phoneNumber - Phone number
 * @returns {Object} - Inserted user record
 */
async function insertNewUser({
  firstName,
  lastName,
  dob,
  email,
  username,
  password,
  phoneNumber,
}) {
  // Hash the password
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const query = `
    INSERT INTO Users (
      first_name,
      last_name,
      dob,
      email,
      username,
      password_hash,
      phone_number
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, first_name, last_name, dob, email, username, phone_number;
  `;
  const values = [
    firstName,
    lastName,
    dob,
    email,
    username,
    passwordHash,
    phoneNumber,
  ];

  try {
    const res = await pool.query(query, values);
    return res.rows[0];
  } catch (err) {
    console.error("Error inserting new user:", err);
    throw err;
  }
}

/**
 * Authenticate User for Login
 * Routes: Login/Registration (dynamic)
 *
 * @param {string} identifier - username
 * @param {string} passwordHash - Hashed password
 * @returns {Object|null} - Authenticated user record or null
 */
async function authenticateUser(identifier, password) {
  const query = `
    SELECT id, first_name, last_name, dob, email, username, phone_number, password_hash
    FROM Users
    WHERE username = $1;
  `;
  const values = [identifier];

  try {
    const res = await pool.query(query, values);
    const user = res.rows[0];

    if (user) {
      const match = await bcrypt.compare(password, user.password_hash);
      if (match) {
        delete user.password_hash;
        return user;
      }
    }

    return null;
  } catch (err) {
    console.error("Error authenticating user:", err);
    throw err;
  }
}

/**
 * Select User by ID
 * Routes: Profile
 *
 * @param {number} userId - User ID
 * @returns {Object|null} - User record or null
 */
async function selectUser(userId) {
  const query = `
    SELECT id, first_name, last_name, dob, email, username, phone_number
    FROM Users
    WHERE id = $1;
  `;
  const values = [userId];

  try {
    const res = await pool.query(query, values);
    return res.rows[0] || null;
  } catch (err) {
    console.error("Error selecting user:", err);
    throw err;
  }
}

/**
 * Update User Information
 * Routes: Profile
 *
 * @param {number} userId - User ID
 * @param {Object} updates - Fields to update
 * @param {string} updates.firstName - First name
 * @param {string} updates.lastName - Last name
 * @param {string} updates.dob - Date of birth (YYYY-MM-DD)
 * @param {string} updates.email - Email address
 * @param {string} updates.username - Username
 * @param {string} updates.phoneNumber - Phone number
 * @param {string} updates.passwordHash - Hashed password
 * @returns {Object|null} - Updated user record or null
 */
async function updateUser(
  userId,
  { firstName, lastName, dob, email, username, phoneNumber, passwordHash }
) {
  const query = `
    UPDATE Users
    SET 
      first_name = $1,
      last_name = $2,
      dob = $3,
      email = $4,
      username = $5,
      phone_number = $6,
      password_hash = $7
    WHERE id = $8
    RETURNING id, first_name, last_name, dob, email, username, phone_number;
  `;
  const values = [
    firstName,
    lastName,
    dob,
    email,
    username,
    phoneNumber,
    passwordHash,
    userId,
  ];

  try {
    const res = await pool.query(query, values);
    return res.rows[0] || null;
  } catch (err) {
    console.error("Error updating user:", err);
    throw err;
  }
}

// =============================================================
// Service Management Functions
// =============================================================

/**
 * Select Services by Category
 * Routes: services/web or services/infra
 *
 * @param {string} category - Service category ('web' or 'infra')
 * @returns {Array} - List of services
 */
async function selectServicesByCategory(category) {
  const query = `
    SELECT id, name, short_description, price, image_filename
    FROM Service
    WHERE category = $1;
  `;
  const values = [category];

  try {
    const res = await pool.query(query, values);
    return res.rows;
  } catch (err) {
    console.error("Error selecting services by category:", err);
    throw err;
  }
}

/**
 * Select Service Details
 * Routes: Service detail
 *
 * @param {number} serviceId - Service ID
 * @returns {Object|null} - Service details or null
 */
async function selectServiceDetails(serviceId) {
  const query = `
    SELECT id, name, description, price, image_filename, category
    FROM Service
    WHERE id = $1;
  `;
  const values = [serviceId];

  try {
    const res = await pool.query(query, values);
    return res.rows[0] || null;
  } catch (err) {
    console.error("Error selecting service details:", err);
    throw err;
  }
}

// =============================================================
// Order Management Functions
// =============================================================

/**
 * Create a New Order
 * Routes: Order: Create / View (dynamic)
 *
 * @param {number} userId - User ID
 * @param {Array} orderItems - List of order items
 * @param {number} orderItems[].serviceId - Service ID
 * @param {number} orderItems[].unitPrice - Unit price at the time of order
 * @param {number} orderItems[].quantity - Quantity
 * @returns {number} - Newly created order ID
 */
async function createOrder(userId, orderItems) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Insert into Orders
    const insertOrderQuery = `
      INSERT INTO Orders (user_id)
      VALUES ($1)
      RETURNING id;
    `;
    const insertOrderValues = [userId];
    const orderRes = await client.query(insertOrderQuery, insertOrderValues);
    const orderId = orderRes.rows[0].id;

    // 2. Insert into Order_Items
    const insertOrderItemQuery = `
      INSERT INTO Order_Items (order_id, service_id, unit_price, quantity)
      VALUES ($1, $2, $3, $4);
    `;

    for (const item of orderItems) {
      const { serviceId, unitPrice, quantity } = item;
      await client.query(insertOrderItemQuery, [
        orderId,
        serviceId,
        unitPrice,
        quantity,
      ]);
    }

    await client.query("COMMIT");
    return orderId;
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating order:", err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * View a Specific Order
 * Routes: Order: Create / View (dynamic)
 *
 * @param {number} orderId - Order ID
 * @returns {Array} - Order details with service information
 */
async function viewOrder(orderId) {
  const query = `
    SELECT 
      o.id AS order_id,
      o.user_id AS user_id,
      o.order_date,
      s.name AS service_name,
      s.image_filename as image_filename,
      oi.unit_price,
      oi.quantity,
      (oi.unit_price * oi.quantity) AS subtotal
    FROM Orders o
    JOIN Order_Items oi ON o.id = oi.order_id
    JOIN Service s ON oi.service_id = s.id
    WHERE o.id = $1;
  `;
  const values = [orderId];

  try {
    const res = await pool.query(query, values);
    return res.rows;
  } catch (err) {
    console.error("Error viewing order:", err);
    throw err;
  }
}

/**
 * View All Orders for a User
 * Routes: Order: Create / View (dynamic)
 *
 * @param {number} userId - User ID
 * @returns {Array} - List of all orders for the user
 */
async function viewAllOrders(userId) {
  const query = `
    SELECT 
      o.id AS order_id,
      o.order_date,
      s.name AS service_name,
      oi.unit_price,
      oi.quantity,
      (oi.unit_price * oi.quantity) AS subtotal
    FROM Orders o
    JOIN Order_Items oi ON o.id = oi.order_id
    JOIN Service s ON oi.service_id = s.id
    WHERE o.user_id = $1
    ORDER BY o.order_date DESC;
  `;
  const values = [userId];

  try {
    const res = await pool.query(query, values);
    return res.rows;
  } catch (err) {
    console.error("Error viewing all orders:", err);
    throw err;
  }
}

// =============================================================
// Export All Functions
// =============================================================

module.exports = {
  // User Management
  insertNewUser,
  authenticateUser,
  selectUser,
  updateUser,

  // Service Management
  selectServicesByCategory,
  selectServiceDetails,

  // Order Management
  createOrder,
  viewOrder,
  viewAllOrders,
};

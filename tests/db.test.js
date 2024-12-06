// tests/db.test.js
const pool = require("../db/connection");
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
} = require("../db/");
const bcrypt = require("bcrypt");

describe("Database connection", () => {
  beforeAll(async () => {
    // Create a test table to verify connection
    await pool.query(`
      CREATE TABLE IF NOT EXISTS test_table (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255)
      );
    `);
  });

  afterAll(async () => {
    // Clean up test table
    await pool.query("DROP TABLE IF EXISTS test_table;");
    // Do not call pool.end() here
  });

  it("should connect to the database", async () => {
    try {
      const result = await pool.query("SELECT 1");
      expect(result.rows[0]).toEqual({ "?column?": 1 });
    } catch (err) {
      throw new Error(`Database connection failed: ${err.message}`);
    }
  });

  it("should allow CRUD operations", async () => {
    try {
      // Insert data
      await pool.query("INSERT INTO test_table (name) VALUES ('John Doe');");

      // Retrieve data
      const result = await pool.query("SELECT * FROM test_table;");
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].name).toBe("John Doe");

      // Update data
      await pool.query("UPDATE test_table SET name = 'Jane Doe' WHERE id = 1;");

      // Retrieve updated data
      const updatedResult = await pool.query("SELECT * FROM test_table;");
      expect(updatedResult.rows[0].name).toBe("Jane Doe");

      // Delete data
      await pool.query("DELETE FROM test_table WHERE id = 1;");

      // Verify data deletion
      const deletedResult = await pool.query("SELECT * FROM test_table;");
      expect(deletedResult.rows.length).toBe(0);
    } catch (err) {
      throw new Error(`CRUD operations failed: ${err.message}`);
    }
  });
});

describe("Database Function Tests", () => {
  let testUserId;
  let testServiceId;
  let testOrderId;

  beforeAll(async () => {
    // Insert a test service into the database
    const insertServiceQuery = `
      INSERT INTO Service (name, short_description, description, price, image_filename, category)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id;
    `;
    const serviceValues = [
      "Test Service",
      "Short description of test service",
      "Detailed description of test service",
      99.99,
      "test_service.jpg",
      "web",
    ];
    const serviceRes = await pool.query(insertServiceQuery, serviceValues);
    testServiceId = serviceRes.rows[0].id;
  });

  afterAll(async () => {
    // Delete test data
    await pool.query("DELETE FROM Users WHERE id = $1;", [testUserId]);
    await pool.query("DELETE FROM Service WHERE id = $1;", [testServiceId]);
    await pool.query("DELETE FROM Orders WHERE id = $1;", [testOrderId]);
    // Do not call pool.end() here
  });

  describe("User Management Functions", () => {
    test("insertNewUser inserts user and hashes password", async () => {
      const newUser = {
        firstName: "Test",
        lastName: "User",
        dob: "1990-01-01",
        email: "testuser@example.com",
        username: "testuser",
        password: "SecurePassword123!",
        phoneNumber: "1234567890",
      };

      const insertedUser = await insertNewUser(newUser);
      testUserId = insertedUser.id;

      expect(insertedUser).toHaveProperty("id");
      expect(insertedUser.first_name).toBe(newUser.firstName);

      // Verify password is hashed in the database
      const res = await pool.query(
        "SELECT password_hash FROM Users WHERE id = $1;",
        [testUserId]
      );
      const passwordMatch = await bcrypt.compare(
        newUser.password,
        res.rows[0].password_hash
      );
      expect(passwordMatch).toBe(true);
    });

    test("authenticateUser authenticates with correct password", async () => {
      const user = await authenticateUser("testuser", "SecurePassword123!");
      expect(user).not.toBeNull();
      expect(user.username).toBe("testuser");
    });

    test("authenticateUser fails with incorrect password", async () => {
      const user = await authenticateUser("testuser", "WrongPassword!");
      expect(user).toBeNull();
    });

    test("selectUser retrieves user by ID", async () => {
      const user = await selectUser(testUserId);
      expect(user).not.toBeNull();
      expect(user.id).toBe(testUserId);
      expect(user.email).toBe("testuser@example.com");
    });

    test("updateUser updates user information", async () => {
      const updates = {
        firstName: "Updated",
        lastName: "User",
        dob: "1991-02-02",
        email: "updateduser@example.com",
        username: "updateduser",
        phoneNumber: "0987654321",
        passwordHash: await bcrypt.hash("NewSecurePassword123!", 10),
      };
      const updatedUser = await updateUser(testUserId, updates);
      expect(updatedUser.first_name).toBe(updates.firstName);
      expect(updatedUser.email).toBe(updates.email);

      // Verify updated data in the database
      const user = await selectUser(testUserId);
      expect(user.first_name).toBe(updates.firstName);
      expect(user.email).toBe(updates.email);
    });
  });

  describe("Service Management Functions", () => {
    test("selectServicesByCategory retrieves services", async () => {
      const services = await selectServicesByCategory("web");
      expect(services.length).toBeGreaterThan(0);
      const service = services.find((s) => s.id === testServiceId);
      expect(service).toBeDefined();
      expect(service.name).toBe("Test Service");
    });

    test("selectServiceDetails retrieves service details", async () => {
      const service = await selectServiceDetails(testServiceId);
      expect(service).not.toBeNull();
      expect(service.name).toBe("Test Service");
      expect(service.category).toBe("web");
    });
  });

  describe("Order Management Functions", () => {
    test("createOrder creates a new order", async () => {
      const orderItems = [
        {
          serviceId: testServiceId,
          unitPrice: 99.99,
          quantity: 1,
        },
      ];
      testOrderId = await createOrder(testUserId, orderItems);
      expect(testOrderId).toBeGreaterThan(0);
    });

    test("viewOrder retrieves the order details", async () => {
      const orderDetails = await viewOrder(testOrderId);
      expect(orderDetails.length).toBeGreaterThan(0);
      const orderItem = orderDetails[0];
      expect(orderItem.order_id).toBe(testOrderId);
      expect(orderItem.service_name).toBe("Test Service");
      expect(orderItem.quantity).toBe(1);
    });

    test("viewAllOrders retrieves all orders for a user", async () => {
      const orders = await viewAllOrders(testUserId);
      expect(orders.length).toBeGreaterThan(0);
      const order = orders.find((o) => o.order_id === testOrderId);
      expect(order).toBeDefined();
      expect(order.service_name).toBe("Test Service");
    });
  });
});

// Global afterAll hook to close the pool once all tests are done
afterAll(async () => {
  await pool.end();
});

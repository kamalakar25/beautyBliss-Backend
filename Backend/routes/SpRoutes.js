const express = require("express");
const router = express.Router();
const Shop = require("../models/SpSchema");
const multer = require("multer");
const fs = require("fs");

// POST /api/salons - Create a new salon shop
router.post("/register-admin", async (req, res) => {
  try {
    const { phone, email, manPower } = req.body;

    // Check for existing phone/email for the salon itself
    const existingSalon = await Shop.findOne({ $or: [{ phone }, { email }] });
    if (existingSalon) {
      return res.status(400).json({ error: "Phone or Email already exists" });
    }

    // Check for duplicate manPower phones in the database
    const submittedPhones = manPower.map((m) => m.phone);
    const duplicatePhones = await Shop.findOne({
      "manPower.phone": { $in: submittedPhones },
    });

    if (duplicatePhones) {
      return res
        .status(400)
        .json({ error: "One or more manPower phone numbers already exist" });
    }

    // Check for duplicates in submitted manPower list itself
    const hasInternalDuplicates = submittedPhones.some(
      (phone, idx) => submittedPhones.indexOf(phone) !== idx
    );

    if (hasInternalDuplicates) {
      return res
        .status(400)
        .json({ error: "Duplicate manPower phone numbers in your submission" });
    }

    // Save the salon
    const newSalon = new Shop(req.body);
    await newSalon.save();

    res.status(201).json({
      message: "Created successfully",
      salon: newSalon,
    });
  } catch (err) {
    // console.error(err);
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "Server error" });
  }
});

// POST /add-manpower
router.post("/add-manpower/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const { name, phone, experience, salary } = req.body;

    const shop = await Shop.findOne({ email: email });

    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    shop.manPower.push({ name, phone, experience, salary });

    await shop.save();

    res.status(200).json({ message: "Manpower added", shop });
  } catch (error) {
    res.status(500).json({ message: "Error adding manpower", error });
  }
});

// Route to fetch employees by email
router.get("/get-manpower/:email", async (req, res) => {
  const { email } = req.params; // Extract email from URL params

  try {
    // Find the salon shop by email and populate the manPower field
    const ShopDetails = await Shop.findOne({ email }).select("manPower");

    if (!ShopDetails) {
      return res.status(404).json({ message: " Shop details not found" });
    }

    // Send back the manpower (employees) data
    res.json(ShopDetails.manPower);
  } catch (error) {
    // console.error('Error fetching manpower:', error);
    res.status(500).json({ message: "Server error" });
  }
});

// Example Node.js/Express API route for updating an employee
router.put("/update-manpower/:id", async (req, res) => {
  try {
    const { name, phone, salary, experience } = req.body;
    const manpowerId = req.params.id;

    // Find the shop that contains this manpower ID
    const shop = await Shop.findOne({ "manPower._id": manpowerId });

    if (!shop) {
      return res
        .status(404)
        .json({ message: "Shop with this manpower not found" });
    }

    // Find the specific manpower entry and update it
    const employee = shop.manPower.id(manpowerId);
    if (!employee) {
      return res.status(404).json({ message: "Manpower entry not found" });
    }

    employee.name = name;
    employee.phone = phone;
    employee.salary = salary;
    employee.experience = experience;

    await shop.save();

    res
      .status(200)
      .json({ message: "Manpower updated successfully", employee });
  } catch (error) {
    // console.error('Error updating manpower:', error);
    res.status(500).json({ message: "Server error", error });
  }
});

// Backend code to handle deleting manpower (employee)
router.delete("/delete-manpower/:id", async (req, res) => {
  const { id } = req.params; // Get the ID from the request parameters

  try {
    // Find the salon shop by its ID and remove the employee from the manPower array
    const shop = await Shop.findOneAndUpdate(
      { "manPower._id": id }, // Find the shop where the employee exists in the manPower array
      { $pull: { manPower: { _id: id } } }, // Remove the employee from the manPower array
      { new: true } // Return the updated shop document
    );

    if (!shop) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (error) {
    // console.error('Error deleting employee:', error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all services
router.get("/get-services/:email", async (req, res) => {
  try {
    const adShop = await Shop.findOne({ email: req.params.email });

    if (!adShop) {
      return res.status(404).json({ msg: "Shop not found" });
    }
    res.json(adShop.services);
  } catch (err) {
    // console.error(err); // To log any error to the console for debugging
    res.status(500).send("Server error");
  }
});

// Setup multer
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// POST route
router.post(
  "/add-service/:email",
  upload.single("shopImage"),
  async (req, res) => {
    try {
      const email = req.params.email;
      const { serviceName, style, price } = req.body;

      if (!req.file) {
        return res.status(400).json({ message: "No image file uploaded" });
      }

      const shop = await Shop.findOne({ email });

      if (!shop) {
        return res.status(404).json({ message: "Shop not found" });
      }

      shop.services.push({
        serviceName,
        style,
        price,
        shopImage: req.file.path,
      });

      await shop.save();

      res
        .status(200)
        .json({
          message: "Service added successfully",
          services: shop.services,
        });
    } catch (error) {
      // console.error('Error adding service:', error);
      res.status(500).json({ message: "Server error", error });
    }
  }
);

// PUT route to update service by ID

router.put(
  "/update-service/:serviceId",
  upload.single("shopImage"),
  async (req, res) => {
    const { serviceId } = req.params;
    const { serviceName, price, style } = req.body;

    try {
      const AdminSalon = await Shop.findOne({ "services._id": serviceId });
      if (!AdminSalon) {
        return res.status(404).json({ message: "Service not found" });
      }

      const service = AdminSalon.services.id(serviceId);
      if (!service) {
        return res
          .status(404)
          .json({ message: "Service not found in document" });
      }

      if (serviceName) service.serviceName = serviceName;
      if (style) service.style = style;
      if (price) service.price = price;

      if (req.file) {
        if (service.shopImage && fs.existsSync(service.shopImage)) {
          fs.unlinkSync(service.shopImage); // Delete old image
        }
        service.shopImage = req.file.path; // Use full path (e.g., uploads/filename.jpg)
      }

      await AdminSalon.save();
      res
        .status(200)
        .json({
          message: "Service updated successfully",
          updatedService: service,
        });
    } catch (error) {
      // console.error('Update Error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Delete a service
router.delete("/deleteService/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const shop = await Shop.findOne({ "services._id": id });
    if (!shop) {
      return res.status(404).json({ message: "Service not found" });
    }

    const service = shop.services.id(id);
    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    // Delete the image file if it exists
    if (service.shopImage && fs.existsSync(service.shopImage)) {
      fs.unlinkSync(service.shopImage);
    }

    // Remove the service
    shop.services.pull({ _id: id });
    await shop.save();

    res.status(200).json({ message: "Service deleted successfully" });
  } catch (error) {
    // console.error('Error deleting service:', error);
    res.status(500).json({ message: "Server error" });
  }
});
// get all services cards
router.get("/cards/services", async (req, res) => {
  try {
    const shops = await Shop.find({}, "services shopName location"); // fetch needed fields

    const filteredServices = shops.flatMap((shop) =>
      shop.services.map((service) => ({
        shopName: shop.shopName,
        serviceName: service.serviceName,
        price: service.price,
        rating: service.rating,
        shopImage: service.shopImage,
        location: shop.location,
      }))
    );

    res.status(200).json(filteredServices);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Check if there are employees
router.get("/check-employees/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const shop = await Shop.findOne({ email });

    if (!shop) {
      return res.status(404).json({ error: "Shop not found" });
    }

    const hasEmployees = shop.manPower && shop.manPower.length > 0;
    // console.log('Has employees:', hasEmployees);

    res.json({ hasEmployees });
  } catch (error) {
    // console.error('Error checking employees:', error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get full data of all salon shops (including services, manPower, etc.)
router.get("/all/admins/data", async (req, res) => {
  try {
    const allShops = await Shop.find(); // fetches everything
    res.status(200).json(allShops); // send full shop data
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET /parlor/:email
router.get("/parlor/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const parlor = await Shop.findOne({ email }).lean();
    if (!parlor) {
      return res.status(404).json({ message: "Parlor not found" });
    }
    res.json(parlor);
  } catch (error) {
    console.error("Error fetching parlor:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

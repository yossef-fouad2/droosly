import { logger } from "./lib/logger.js";

process.on("uncaughtException", (err) => {
  logger.fatal(err, "CRITICAL UNCAUGHT ERROR at startup");
  process.exit(1);
});


import "dotenv/config";
import express from "express";
import authRouter from "./routes/auth.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import userRouter from "./routes/users.js";
import requireAuth from "./middleware/requireAuth.js";
import coursesRouter from "./routes/courses.js";
import { connectDatabase } from "./db/index.js";

const app = express();
// app.use(requestLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// my features
app.use("/auth", authRouter);
app.use("/users", requireAuth, userRouter);
app.use("/courses", coursesRouter);
app.get("/", (req, res) => {
  res.send("Welcome to the system!");
});

// Error handler must be defined last
app.use(errorHandler);
try {
  await connectDatabase();
} catch (err) {
  logger.fatal(err, "failed to connect to the database");
  process.exit(1);
}
app.listen(8000, () => {
  logger.info("server is running on port 8000");
});

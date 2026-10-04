import express from "express";
import requireAuth from "./middleware/requireAuth.js";
import authRouter from "./routes/auth.js";
import userRouter from "./routes/users.js";
import coursesRouter from "./routes/courses.js";
import { errorHandler } from "./middleware/errorHandler.js";


export function createApp(){
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


return app;
}
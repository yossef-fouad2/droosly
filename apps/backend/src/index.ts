import { logger } from "./lib/logger.js";
import "dotenv/config";
import { connectDatabase } from "./db/index.js";
import { createApp } from "./app.js";


process.on("uncaughtException", (err) => {
  logger.fatal(err, "CRITICAL UNCAUGHT ERROR at startup");
  process.exit(1);
});



const port = Number(process.env.PORT) || 8000;
const app = createApp();
try {
  await connectDatabase();
} catch (err) {
  logger.fatal(err, "failed to connect to the database");
  process.exit(1);
}
app.listen(port, () => {
  logger.info(`server is running on port ${port}`);
});

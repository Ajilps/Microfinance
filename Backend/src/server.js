import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/db.js";
import { startInterestCron } from "./utils/interestCron.js";

const PORT = process.env.PORT || 4000;

await connectDB();
startInterestCron();

app.listen(PORT, () => {
  console.log(
    `Server running on port http://localhost:${PORT} in ${process.env.NODE_ENV} mode`,
  );
});

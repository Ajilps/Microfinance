import "dotenv/config";
import app from "./app.js";

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(
    `Server running on port http://localhost:${PORT} in ${process.env.NODE_ENV} mode`,
  );
});

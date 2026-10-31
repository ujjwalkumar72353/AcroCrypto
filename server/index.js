import "./config.js";
import createApp from "./app.js";
import { startAlertWorker } from "./alerts.js";
import { connectDb, disconnectDb } from "./db.js";

const port = process.env.PORT || 3003;

const start = async () => {
  await connectDb();
  const server = createApp().listen(port, () =>
    console.log(`Server running on port ${port}`)
  );
  const stopWorker = startAlertWorker();

  const shutdown = async () => {
    stopWorker();
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  ["SIGINT", "SIGTERM"].forEach((signal) => process.once(signal, shutdown));
};

start().catch((error) => {
  console.error(error);
  process.exit(1);
});

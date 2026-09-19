import { app } from './bootstrap.js';
import { config } from './config.js';
import { db } from './repositories/database.js';
const server = app.listen(config.PORT, config.HOST, () =>
  console.log(`API listening on ${config.PORT}`),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.close(() => {
      void db.$disconnect().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });

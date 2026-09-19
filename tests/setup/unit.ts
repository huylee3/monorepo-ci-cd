// Unit tests never inherit application credentials or connect to a real database.
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://unit:unit@127.0.0.1:1/unit_test',
  JWT_SECRET: 'test-only-secret-with-at-least-32-characters',
  APP_ORIGIN: 'http://localhost:3000',
});

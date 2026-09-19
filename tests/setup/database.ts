import { readTestEnv } from '../../scripts/env.mjs';

Object.assign(process.env, readTestEnv());

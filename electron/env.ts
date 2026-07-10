/**
 * Bootstrap module — must be the very first import in main.ts.
 * Loads .env from the project root before any other module initialises.
 *
 * When compiled, this file becomes dist/electron/electron/env.js.
 * The project root is three directories up from that location:
 *   dist/electron/electron/ → dist/electron/ → dist/ → project root
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

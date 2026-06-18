import { connectWithRetry } from './db/connection.js';
import { runMigrations } from './db/migrationRunner.js';

// Initialize pool connection and run pending migrations on startup
await connectWithRetry();
await runMigrations();

export * from './db/connection.js';
export * from './db/repositories/userRepository.js';
export * from './db/repositories/gameRepository.js';
export * from './db/repositories/trackRepository.js';
export * from './db/repositories/curationRepository.js';
export * from './db/repositories/flagRepository.js';

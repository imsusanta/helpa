/**
 * Helpa Core Platform — Unified Platform API
 *
 * Core shared capabilities for all Helpa industry modules.
 * Industry modules import from `@/core` — Core never imports industry modules.
 */

// Events
export * from './events';

// Permissions & Roles
export * from './permissions';

// AI Provider & OpenRouter
export * from './ai/provider';
export * from './ai/memory';

// Core Subsystems
export * from './knowledge';
export * from './contacts';
export * from './inbox';
export * from './copilot';
export * from './campaigns';
export * from './automations';
export * from './notifications';
export * from './analytics';
export * from './workspace';
export * from './tenants';
export * from './whatsapp';

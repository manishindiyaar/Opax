"use strict";
/**
 * PDF Watch & Summarize Automation - Shared Type Definitions
 *
 * This file contains all shared interfaces, types, and enums used across
 * the main process services, IPC handlers, and renderer components for
 * the PDF automation feature.
 *
 * @module pdf-automation-types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMTP_PRESETS = void 0;
/**
 * Preset SMTP configurations for common email providers
 */
exports.SMTP_PRESETS = {
    gmail: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
    },
    outlook: {
        host: 'smtp-mail.outlook.com',
        port: 587,
        secure: false,
    },
    custom: {
    // User provides all values
    },
};
//# sourceMappingURL=pdf-automation-types.js.map
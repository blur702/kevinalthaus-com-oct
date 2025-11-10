"use strict";
/**
 * Complete type definitions for page builder data model.
 * Ensures type safety and validation for JSON storage.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.widgetManifestSchema = exports.widgetCategorySchema = exports.WidgetCategory = exports.defaultGridConfig = exports.widgetInstanceSchema = exports.gridConfigSchema = exports.pageLayoutSchema = exports.PageStatus = void 0;
exports.createEmptyLayout = createEmptyLayout;
exports.validatePageLayout = validatePageLayout;
exports.validateWidgetInstance = validateWidgetInstance;
exports.validateWidgetManifest = validateWidgetManifest;
exports.isValidWidgetStructure = isValidWidgetStructure;
const joi_1 = __importDefault(require("joi"));
// Note: This file includes a small runtime helper that checks widget structure on disk.
// Import Node modules at top-level for proper typing and to avoid inline require usage.
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Page publication status
 */
var PageStatus;
(function (PageStatus) {
    PageStatus["DRAFT"] = "draft";
    PageStatus["PUBLISHED"] = "published";
    PageStatus["SCHEDULED"] = "scheduled";
    PageStatus["ARCHIVED"] = "archived";
})(PageStatus || (exports.PageStatus = PageStatus = {}));
/**
 * Validation schema for PageLayout using Joi
 */
exports.pageLayoutSchema = joi_1.default.object({
    version: joi_1.default.string().valid('1.0').required(),
    grid: joi_1.default.object({
        columns: joi_1.default.number().integer().min(1).max(24).required(),
        rows: joi_1.default.number().integer().min(1).optional(),
        gap: joi_1.default.object({
            unit: joi_1.default.string().valid('px', 'rem', '%').required(),
            value: joi_1.default.number().min(0).max(100).required()
        }).required(),
        snapToGrid: joi_1.default.boolean().required(),
        breakpoints: joi_1.default.array().items(joi_1.default.object({
            name: joi_1.default.string().valid('mobile', 'tablet', 'desktop', 'wide').required(),
            minWidth: joi_1.default.number().integer().min(0).required(),
            maxWidth: joi_1.default.number().integer().min(0).optional(),
            columns: joi_1.default.number().integer().min(1).max(24).optional()
        })).min(1).required()
    }).required(),
    widgets: joi_1.default.array().items(joi_1.default.object({
        id: joi_1.default.string().uuid().required(),
        type: joi_1.default.string().required(),
        position: joi_1.default.object({
            x: joi_1.default.number().integer().min(0).required(),
            y: joi_1.default.number().integer().min(0).required(),
            width: joi_1.default.number().integer().min(1).required(),
            height: joi_1.default.number().integer().min(1).required(),
            responsive: joi_1.default.array().items(joi_1.default.object({
                breakpoint: joi_1.default.string().required(),
                x: joi_1.default.number().integer().min(0).required(),
                y: joi_1.default.number().integer().min(0).required(),
                width: joi_1.default.number().integer().min(1).required(),
                height: joi_1.default.number().integer().min(1).required()
            })).optional(),
            zIndex: joi_1.default.number().integer().optional()
        }).required(),
        config: joi_1.default.object().unknown(true).required(),
        children: joi_1.default.array().optional(),
        isLocked: joi_1.default.boolean().optional()
    })).min(0).max(100).required(),
    metadata: joi_1.default.object({
        seo: joi_1.default.object().unknown(true).optional(),
        accessibility: joi_1.default.object().unknown(true).optional()
    }).optional()
});
/**
 * Validation schema for GridConfig
 */
exports.gridConfigSchema = joi_1.default.object({
    columns: joi_1.default.number().integer().min(1).max(24).required(),
    rows: joi_1.default.number().integer().min(1).optional(),
    gap: joi_1.default.object({
        unit: joi_1.default.string().valid('px', 'rem', '%').required(),
        value: joi_1.default.number().min(0).max(100).required()
    }).required(),
    snapToGrid: joi_1.default.boolean().required(),
    breakpoints: joi_1.default.array().items(joi_1.default.object({
        name: joi_1.default.string().valid('mobile', 'tablet', 'desktop', 'wide').required(),
        minWidth: joi_1.default.number().integer().min(0).required(),
        maxWidth: joi_1.default.number().integer().min(0).optional(),
        columns: joi_1.default.number().integer().min(1).max(24).optional()
    })).min(1).required()
});
/**
 * Validation schema for WidgetInstance
 */
exports.widgetInstanceSchema = joi_1.default.object({
    id: joi_1.default.string().uuid().required(),
    type: joi_1.default.string().required(),
    position: joi_1.default.object({
        x: joi_1.default.number().integer().min(0).required(),
        y: joi_1.default.number().integer().min(0).required(),
        width: joi_1.default.number().integer().min(1).required(),
        height: joi_1.default.number().integer().min(1).required(),
        responsive: joi_1.default.array().items(joi_1.default.object({
            breakpoint: joi_1.default.string().required(),
            x: joi_1.default.number().integer().min(0).required(),
            y: joi_1.default.number().integer().min(0).required(),
            width: joi_1.default.number().integer().min(1).required(),
            height: joi_1.default.number().integer().min(1).required()
        })).optional(),
        zIndex: joi_1.default.number().integer().optional()
    }).required(),
    config: joi_1.default.object().unknown(true).required(),
    children: joi_1.default.array().optional(),
    isLocked: joi_1.default.boolean().optional()
});
/**
 * Default grid configuration
 */
exports.defaultGridConfig = {
    columns: 12,
    gap: {
        unit: 'px',
        value: 16
    },
    snapToGrid: true,
    breakpoints: [
        { name: 'mobile', minWidth: 0, maxWidth: 767, columns: 4 },
        { name: 'tablet', minWidth: 768, maxWidth: 1023, columns: 8 },
        { name: 'desktop', minWidth: 1024, maxWidth: 1439, columns: 12 },
        { name: 'wide', minWidth: 1440, columns: 16 }
    ]
};
/**
 * Create a new empty page layout
 */
function createEmptyLayout() {
    return {
        version: '1.0',
        grid: exports.defaultGridConfig,
        widgets: [],
        metadata: {}
    };
}
/**
 * Validate page layout and throw if invalid
 */
function validatePageLayout(layout) {
    const { error, value } = exports.pageLayoutSchema.validate(layout, {
        abortEarly: false,
        stripUnknown: false
    });
    if (error) {
        throw new Error(`Invalid page layout: ${error.message}`);
    }
    return value;
}
/**
 * Validate widget instance and throw if invalid
 */
function validateWidgetInstance(widget) {
    const { error, value } = exports.widgetInstanceSchema.validate(widget, {
        abortEarly: false,
        stripUnknown: false
    });
    if (error) {
        throw new Error(`Invalid widget instance: ${error.message}`);
    }
    return value;
}
// =========================================================================
// WIDGET REGISTRY TYPES
// =========================================================================
/**
 * Standard widget categories for organizing the widget palette
 */
var WidgetCategory;
(function (WidgetCategory) {
    WidgetCategory["GENERAL"] = "general";
    WidgetCategory["CREATIVE"] = "creative";
    WidgetCategory["MARKETING"] = "marketing";
    WidgetCategory["HEADER_FOOTER"] = "header-footer";
    WidgetCategory["SOCIAL_MEDIA"] = "social-media";
    WidgetCategory["FORMS"] = "forms";
    WidgetCategory["ADVANCED"] = "advanced";
})(WidgetCategory || (exports.WidgetCategory = WidgetCategory = {}));
/**
 * Validation schema for widget category
 */
exports.widgetCategorySchema = joi_1.default.string().valid(...Object.values(WidgetCategory));
/**
 * Validation schema for widget manifest (widget.json)
 */
exports.widgetManifestSchema = joi_1.default.object({
    type: joi_1.default.string().pattern(/^[a-z0-9-]+$/).required(),
    name: joi_1.default.string().min(1).max(100).required(),
    displayName: joi_1.default.string().min(1).max(100).required(),
    description: joi_1.default.string().min(1).max(500).required(),
    category: exports.widgetCategorySchema.required(),
    icon: joi_1.default.string().min(1).max(200).required(),
    version: joi_1.default.string().pattern(/^\d+\.\d+\.\d+$/).required(),
    author: joi_1.default.object({
        name: joi_1.default.string().min(1).max(100).required(),
        email: joi_1.default.string().email().required()
    }).required(),
    configSchema: joi_1.default.string().valid('config.ts').required(),
    previewImage: joi_1.default.string().max(500).optional().allow(null),
    tags: joi_1.default.array().items(joi_1.default.string().min(1).max(50)).min(0).max(20).required(),
    isContainer: joi_1.default.boolean().required(),
    deprecated: joi_1.default.boolean().required()
});
/**
 * Validate widget manifest and throw if invalid
 */
function validateWidgetManifest(data) {
    const { error, value } = exports.widgetManifestSchema.validate(data, {
        abortEarly: false,
        stripUnknown: false
    });
    if (error) {
        throw new Error(`Invalid widget manifest: ${error.message}`);
    }
    return value;
}
/**
 * Check if widget has required file structure
 */
/**
 * Checks whether a widget directory contains the required files.
 * Synchronous implementation for compatibility; note this performs blocking I/O.
 * Consider migrating callers to an async variant if used in performance-sensitive code.
 */
function isValidWidgetStructure(widgetPath) {
    const requiredFiles = ['widget.json', 'component.tsx', 'config.ts', 'types.ts'];
    for (const file of requiredFiles) {
        const filePath = path.join(widgetPath, file);
        if (!fs.existsSync(filePath)) {
            return false;
        }
    }
    return true;
}
//# sourceMappingURL=index.js.map
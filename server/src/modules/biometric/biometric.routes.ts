import { Router } from "express";

import { biometricController } from "./biometric.controller";

import {
  requirePermission,
} from "../../middlewares/requireRole";

import {
  requireActiveSubscription,
  requireWritableSubscription,
} from "../../middlewares/requireActiveSubscription";

import {
  validateBody,
} from "../../middlewares/validate";

import {
  createBiometricDeviceSchema,
  updateBiometricDeviceSchema,
  createBiometricMappingSchema,
  createBiometricPunchSchema,
} from "./biometric.validator";

const router = Router();

/**
 * ============================================================================
 * BIOMETRIC DEVICES
 * ============================================================================
 */

// List all biometric devices
router.get(
  "/devices",
  requireActiveSubscription,
  requirePermission(
    "biometric.read",
    "biometric.manage",
  ),
  biometricController.listDevices,
);

// Get single biometric device
router.get(
  "/devices/:id",
  requireActiveSubscription,
  requirePermission(
    "biometric.read",
    "biometric.manage",
  ),
  biometricController.getDevice,
);

// Create biometric device
router.post(
  "/devices",
  requireWritableSubscription,
  requirePermission("biometric.manage"),
  validateBody(createBiometricDeviceSchema),
  biometricController.createDevice,
);

// Update biometric device
router.patch(
  "/devices/:id",
  requireWritableSubscription,
  requirePermission("biometric.manage"),
  validateBody(updateBiometricDeviceSchema),
  biometricController.updateDevice,
);

// Delete biometric device
router.delete(
  "/devices/:id",
  requireWritableSubscription,
  requirePermission("biometric.manage"),
  biometricController.deleteDevice,
);

/**
 * ============================================================================
 * BIOMETRIC EMPLOYEE MAPPINGS
 * ============================================================================
 */

// List employee-device mappings
router.get(
  "/mappings",
  requireActiveSubscription,
  requirePermission(
    "biometric.read",
    "biometric.manage",
  ),
  biometricController.listMappings,
);

// Create employee-device mapping
router.post(
  "/mappings",
  requireWritableSubscription,
  requirePermission("biometric.manage"),
  validateBody(createBiometricMappingSchema),
  biometricController.createMapping,
);

// Delete employee-device mapping
router.delete(
  "/mappings/:id",
  requireWritableSubscription,
  requirePermission("biometric.manage"),
  biometricController.deleteMapping,
);

/**
 * ============================================================================
 * BIOMETRIC PUNCH LOGS
 * ============================================================================
 */

// List biometric punch logs
router.get(
  "/punches",
  requireActiveSubscription,
  requirePermission(
    "biometric.read",
    "biometric.manage",
  ),
  biometricController.listPunches,
);

// Insert biometric punch
router.post(
  "/punches",
  requireWritableSubscription,
  requirePermission("biometric.manage"),
  validateBody(createBiometricPunchSchema),
  biometricController.createPunch,
);

export default router;
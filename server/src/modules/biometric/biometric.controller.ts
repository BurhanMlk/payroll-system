import { NextFunction, Request, Response } from "express";
import { biometricService } from "./biometric.service";

function getTenantId(req: Request): string {
  const tenantId = req.user?.tenantId;

  if (!tenantId) {
    throw new Error("Tenant context missing");
  }

  return tenantId;
}

export const biometricController = {
  async createDevice(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const device = await biometricService.createDevice(
        {
          tenantId: getTenantId(req),
        },
        req.body,
      );

      res.status(201).json({
        success: true,
        data: device,
      });
    } catch (error) {
      next(error);
    }
  },

  async listDevices(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const devices = await biometricService.listDevices({
        tenantId: getTenantId(req),
      });

      res.status(200).json({
        success: true,
        data: devices,
      });
    } catch (error) {
      next(error);
    }
  },

  async getDevice(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const device = await biometricService.getDevice(
        {
          tenantId: getTenantId(req),
        },
        req.params.id,
      );

      res.status(200).json({
        success: true,
        data: device,
      });
    } catch (error) {
      next(error);
    }
  },

  async updateDevice(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const device = await biometricService.updateDevice(
        {
          tenantId: getTenantId(req),
        },
        req.params.id,
        req.body,
      );

      res.status(200).json({
        success: true,
        data: device,
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteDevice(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await biometricService.deleteDevice(
        {
          tenantId: getTenantId(req),
        },
        req.params.id,
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async createMapping(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const mapping = await biometricService.createMapping(
        {
          tenantId: getTenantId(req),
        },
        req.body,
      );

      res.status(201).json({
        success: true,
        data: mapping,
      });
    } catch (error) {
      next(error);
    }
  },

  async listMappings(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const mappings = await biometricService.listMappings({
        tenantId: getTenantId(req),
      });

      res.status(200).json({
        success: true,
        data: mappings,
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteMapping(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await biometricService.deleteMapping(
        {
          tenantId: getTenantId(req),
        },
        req.params.id,
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async createPunch(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const punch = await biometricService.createPunch(
        {
          tenantId: getTenantId(req),
        },
        req.body,
      );

      res.status(201).json({
        success: true,
        data: punch,
      });
    } catch (error) {
      next(error);
    }
  },

  async listPunches(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const punches = await biometricService.listPunches({
        tenantId: getTenantId(req),
      });

      res.status(200).json({
        success: true,
        data: punches,
      });
    } catch (error) {
      next(error);
    }
  },
};
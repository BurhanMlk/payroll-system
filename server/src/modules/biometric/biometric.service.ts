import {
  BiometricDeviceStatus,
  BiometricPunchType,
  Prisma,
} from "@prisma/client";

import { prisma } from "../../lib/prisma";

type TenantContext = {
  tenantId: string;
};

type CreateDeviceInput = {
  branchId?: string | null;
  name: string;
  code: string;
  serialNumber?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  ipAddress?: string | null;
  port?: number | null;
  timezone?: string | null;
};

type UpdateDeviceInput = Partial<CreateDeviceInput> & {
  status?: BiometricDeviceStatus;
};

export const biometricService = {
  async createDevice(
    context: TenantContext,
    input: CreateDeviceInput,
  ) {
    const { tenantId } = context;

    if (input.branchId) {
      const branch = await prisma.branch.findFirst({
        where: {
          id: input.branchId,
          tenantId,
        },
      });

      if (!branch) {
        throw new Error("Branch not found");
      }
    }

    return prisma.biometricDevice.create({
      data: {
        tenantId,
        ...input,
      },
    });
  },

  async listDevices(context: TenantContext) {
    return prisma.biometricDevice.findMany({
      where: {
        tenantId: context.tenantId,
      },

      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },

        _count: {
          select: {
            employeeMappings: true,
            punches: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });
  },

  async getDevice(
    context: TenantContext,
    id: string,
  ) {
    const device = await prisma.biometricDevice.findFirst({
      where: {
        id,
        tenantId: context.tenantId,
      },

      include: {
        branch: true,

        employeeMappings: {
          include: {
            employee: {
              select: {
                id: true,
                employeeNumber: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!device) {
      throw new Error("Biometric device not found");
    }

    return device;
  },

  async updateDevice(
    context: TenantContext,
    id: string,
    input: UpdateDeviceInput,
  ) {
    const existing = await prisma.biometricDevice.findFirst({
      where: {
        id,
        tenantId: context.tenantId,
      },
    });

    if (!existing) {
      throw new Error("Biometric device not found");
    }

    if (input.branchId) {
      const branch = await prisma.branch.findFirst({
        where: {
          id: input.branchId,
          tenantId: context.tenantId,
        },
      });

      if (!branch) {
        throw new Error("Branch not found");
      }
    }

    return prisma.biometricDevice.update({
      where: {
        id,
      },

      data: input,
    });
  },

  async deleteDevice(
    context: TenantContext,
    id: string,
  ) {
    const existing = await prisma.biometricDevice.findFirst({
      where: {
        id,
        tenantId: context.tenantId,
      },
    });

    if (!existing) {
      throw new Error("Biometric device not found");
    }

    await prisma.biometricDevice.delete({
      where: {
        id,
      },
    });

    return {
      success: true,
    };
  },

  async createMapping(
    context: TenantContext,
    input: {
      deviceId: string;
      employeeId: string;
      biometricUserId: string;
    },
  ) {
    const device = await prisma.biometricDevice.findFirst({
      where: {
        id: input.deviceId,
        tenantId: context.tenantId,
      },
    });

    if (!device) {
      throw new Error("Biometric device not found");
    }

    const employee = await prisma.employee.findFirst({
      where: {
        id: input.employeeId,
        tenantId: context.tenantId,
      },
    });

    if (!employee) {
      throw new Error("Employee not found");
    }

    return prisma.biometricEmployeeMap.create({
      data: {
        tenantId: context.tenantId,
        deviceId: input.deviceId,
        employeeId: input.employeeId,
        biometricUserId: input.biometricUserId,
      },
    });
  },

  async listMappings(
    context: TenantContext,
  ) {
    return prisma.biometricEmployeeMap.findMany({
      where: {
        tenantId: context.tenantId,
      },

      include: {
        device: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },

        employee: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });
  },

  async deleteMapping(
    context: TenantContext,
    id: string,
  ) {
    const mapping = await prisma.biometricEmployeeMap.findFirst({
      where: {
        id,
        tenantId: context.tenantId,
      },
    });

    if (!mapping) {
      throw new Error("Biometric mapping not found");
    }

    await prisma.biometricEmployeeMap.delete({
      where: {
        id,
      },
    });

    return {
      success: true,
    };
  },

  async createPunch(
    context: TenantContext,
    input: {
      deviceId: string;
      biometricUserId: string;
      punchedAt: string;
      punchType?: BiometricPunchType;
      externalPunchId?: string | null;
      rawPayload?: Prisma.InputJsonValue;
    },
  ) {
    const device = await prisma.biometricDevice.findFirst({
      where: {
        id: input.deviceId,
        tenantId: context.tenantId,
      },
    });

    if (!device) {
      throw new Error("Biometric device not found");
    }

    const mapping = await prisma.biometricEmployeeMap.findFirst({
      where: {
        tenantId: context.tenantId,
        deviceId: input.deviceId,
        biometricUserId: input.biometricUserId,
        isActive: true,
      },
    });

    return prisma.biometricPunch.create({
      data: {
        tenantId: context.tenantId,

        deviceId: input.deviceId,

        employeeId: mapping?.employeeId ?? null,

        biometricUserId: input.biometricUserId,

        punchedAt: new Date(input.punchedAt),

        punchType:
          input.punchType ??
          BiometricPunchType.UNKNOWN,

        externalPunchId:
          input.externalPunchId ?? null,

        rawPayload:
          input.rawPayload ?? Prisma.JsonNull,
      },
    });
  },

  async listPunches(
    context: TenantContext,
  ) {
    return prisma.biometricPunch.findMany({
      where: {
        tenantId: context.tenantId,
      },

      include: {
        device: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },

        employee: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
          },
        },
      },

      orderBy: {
        punchedAt: "desc",
      },

      take: 500,
    });
  },
};
export type TenantScoped = {
  tenantId: string;
};

export function assertTenantAccess(resource: TenantScoped, tenantId: string) {
  if (resource.tenantId !== tenantId) {
    throw new Error("Tenant access denied");
  }
}

export function tenantWhere<T extends object>(tenantId: string, where?: T) {
  return {
    tenantId,
    ...(where ?? {})
  };
}


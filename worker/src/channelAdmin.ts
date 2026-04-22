// Phase 10: Channel Admin Management with Cloudflare KV Persistence
// Links channels (restaurants) to telegram users as admins

import { ChannelAdmin, ChannelAdminInfo } from "./contracts";

export interface ChannelAdminKV {
  get(key: string, type?: "text" | "json"): Promise<string | any | null>;
  put(
    key: string,
    value: string | ReadableStream | ArrayBuffer,
    options?: { expirationTtl?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Env {
  CARTS?: ChannelAdminKV;
}

const memoryChannelAdmins: Map<string, ChannelAdmin> = new Map();

function isWorkersEnvironment(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    typeof (globalThis as any).__env__ !== "undefined"
  );
}

function getKV(): ChannelAdminKV | null {
  if (typeof globalThis !== "undefined") {
    const env = (globalThis as any).__env__ as Env | undefined;
    return env?.CARTS ?? null;
  }
  return null;
}

function getKey(restaurantId: string): string {
  return `channel:${restaurantId}:admin`;
}

export async function getChannelAdmin(
  restaurantId: string,
): Promise<ChannelAdmin | null> {
  const kv = getKV();
  const key = getKey(restaurantId);

  if (kv) {
    try {
      const data = await kv.get(key, "json");
      if (data) {
        return data as ChannelAdmin;
      }
    } catch (error) {
      console.error(
        `[ChannelAdmin] KV get error for ${restaurantId}:`,
        error,
      );
    }
  }

  return memoryChannelAdmins.get(key) ?? null;
}

export async function setChannelAdmin(
  restaurantId: string,
  telegramUserId: string,
  assignedBy: string,
): Promise<ChannelAdmin> {
  const admin: ChannelAdmin = {
    restaurantId,
    telegramUserId,
    assignedAt: new Date().toISOString(),
    assignedBy,
  };

  const kv = getKV();
  const key = getKey(restaurantId);

  if (kv) {
    try {
      await kv.put(key, JSON.stringify(admin));
    } catch (error) {
      console.error(
        `[ChannelAdmin] KV put error for ${restaurantId}:`,
        error,
      );
    }
  }

  memoryChannelAdmins.set(key, admin);
  return admin;
}

export async function removeChannelAdmin(
  restaurantId: string,
): Promise<void> {
  const kv = getKV();
  const key = getKey(restaurantId);

  if (kv) {
    try {
      await kv.delete(key);
    } catch (error) {
      console.error(
        `[ChannelAdmin] KV delete error for ${restaurantId}:`,
        error,
      );
    }
  }

  memoryChannelAdmins.delete(key);
}

export async function getUserChannels(
  telegramUserId: string,
): Promise<ChannelAdmin[]> {
  const channels: ChannelAdmin[] = [];

  for (const [key, admin] of memoryChannelAdmins.entries()) {
    if (admin.telegramUserId === telegramUserId) {
      channels.push(admin);
    }
  }

  return channels;
}

export async function getAllChannelsWithAdmins(): Promise<ChannelAdmin[]> {
  return Array.from(memoryChannelAdmins.values());
}

export function toChannelAdminInfo(admin: ChannelAdmin): ChannelAdminInfo {
  return {
    restaurantId: admin.restaurantId,
    telegramUserId: admin.telegramUserId,
    assignedAt: admin.assignedAt,
    assignedBy: admin.assignedBy,
  };
}
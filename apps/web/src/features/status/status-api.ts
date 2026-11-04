// The person's own status (F04 design 5): read it, set it by hand for a time, or reset it.
import type { ManualStatus, Status } from "@meetapp/contracts";
import { apiRequest } from "../api/index.ts";

export interface MyStatus {
  status: Status;
  chosen: ManualStatus | null;
  until: string | null;
}

export const myStatus = (): Promise<MyStatus> => apiRequest("/api/v1/me/status");

export const setMyStatus = (status: ManualStatus | null, until: string | null): Promise<MyStatus> =>
  apiRequest("/api/v1/me/status", { method: "PUT", body: { status, until } });

export type Role = "staff" | "client";
export type Mode = "cookie" | "bearer";

export interface StoredSession {
  role: Role;
  token?: string;
}

export interface CredentialStore {
  mode: Mode;
  read(): Promise<StoredSession | null>;
  write(s: StoredSession): Promise<void>;
  clear(): Promise<void>;
}

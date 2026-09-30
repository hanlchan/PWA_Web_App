import cloudbase from "@cloudbase/js-sdk";
import { cookies } from "next/headers";

import { getPublicEnv } from "../env";
import type { Database, Json } from "../types/database";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./cookies";

type Tables = Database["public"]["Tables"];
type Functions = Database["public"]["Functions"];
type QueryError = { message: string; code?: string; details?: string };
type QueryResult<T> = { data: T; error: QueryError | null };
type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

function encodeFilterValue(value: unknown) {
  if (typeof value === "string") return value.replaceAll(",", "\\,").replaceAll(")", "\\)");
  return String(value);
}

function errorFrom(value: unknown, status: number): QueryError {
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    return {
      message: String(item.message ?? item.error_description ?? item.error ?? `CloudBase request failed (${status})`),
      code: item.code ? String(item.code) : undefined,
      details: item.details ? String(item.details) : undefined,
    };
  }
  return { message: `CloudBase request failed (${status})` };
}

class QueryBuilder<Row, Insert, Update> implements PromiseLike<QueryResult<Row[]>> {
  private method: HttpMethod = "GET";
  private body: unknown;
  private params = new URLSearchParams();

  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  select(columns = "*") {
    this.params.set("select", columns);
    return this;
  }

  insert(values: Insert | Insert[]) {
    this.method = "POST";
    this.body = values;
    return this;
  }

  update(values: Update) {
    this.method = "PATCH";
    this.body = values;
    return this;
  }

  delete() {
    this.method = "DELETE";
    return this;
  }

  eq(column: string, value: unknown) {
    this.params.append(column, `eq.${encodeFilterValue(value)}`);
    return this;
  }

  is(column: string, value: null | boolean) {
    this.params.append(column, `is.${String(value)}`);
    return this;
  }

  in(column: string, values: readonly unknown[]) {
    this.params.append(column, `in.(${values.map(encodeFilterValue).join(",")})`);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.params.append("order", `${column}.${options?.ascending === false ? "desc" : "asc"}`);
    return this;
  }

  async single(): Promise<QueryResult<Row>> {
    const result = await this.execute();
    if (result.error) return { data: null as Row, error: result.error };
    if (result.data.length !== 1) return { data: null as Row, error: { message: "Expected exactly one row" } };
    return { data: result.data[0]!, error: null };
  }

  async maybeSingle(): Promise<QueryResult<Row | null>> {
    const result = await this.execute();
    if (result.error) return { data: null, error: result.error };
    if (result.data.length > 1) return { data: null, error: { message: "Expected at most one row" } };
    return { data: result.data[0] ?? null, error: null };
  }

  then<TResult1 = QueryResult<Row[]>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<Row[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<QueryResult<Row[]>> {
    const query = this.params.size ? `?${this.params}` : "";
    try {
      const response = await fetch(`${this.baseUrl}${query}`, {
        method: this.method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: this.body === undefined ? undefined : JSON.stringify(this.body),
        cache: "no-store",
      });
      const text = await response.text();
      const payload = text ? JSON.parse(text) : [];
      if (!response.ok) return { data: [], error: errorFrom(payload, response.status) };
      return { data: Array.isArray(payload) ? (payload as Row[]) : [payload as Row], error: null };
    } catch (error) {
      return { data: [], error: { message: error instanceof Error ? error.message : "CloudBase request failed" } };
    }
  }
}

type CloudBaseUser = { id: string; sub: string; email?: string; username?: string };

export async function createClient() {
  const cookieStore = await cookies();
  const environment = getPublicEnv();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? environment.NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY;
  const origin = `https://${environment.NEXT_PUBLIC_CLOUDBASE_ENV_ID}.api.tcloudbasegateway.com`;

  return {
    from<Name extends keyof Tables & string>(table: Name) {
      type Table = Tables[Name];
      return new QueryBuilder<Table["Row"], Table["Insert"], Table["Update"]>(
        `${origin}/v1/rdb/rest/${table}`,
        token,
      );
    },
    async rpc<Name extends keyof Functions & string>(name: Name, args?: Functions[Name]["Args"]): Promise<QueryResult<Functions[Name]["Returns"]>> {
      try {
        const response = await fetch(`${origin}/v1/rdb/rest/rpc/${name}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(args ?? {}),
          cache: "no-store",
        });
        const text = await response.text();
        const payload = text ? (JSON.parse(text) as Functions[Name]["Returns"]) : (undefined as Functions[Name]["Returns"]);
        return response.ok ? { data: payload, error: null } : { data: null as Functions[Name]["Returns"], error: errorFrom(payload, response.status) };
      } catch (error) {
        return { data: null as Functions[Name]["Returns"], error: { message: error instanceof Error ? error.message : "CloudBase RPC failed" } };
      }
    },
    auth: {
      async getUser(): Promise<{ data: { user: CloudBaseUser | null }; error: QueryError | null }> {
        if (!cookieStore.get(ACCESS_TOKEN_COOKIE)?.value) return { data: { user: null }, error: null };
        try {
          const response = await fetch(`${origin}/auth/v1/user/me`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          });
          const payload = (await response.json()) as Record<string, Json>;
          if (!response.ok) return { data: { user: null }, error: errorFrom(payload, response.status) };
          const sub = String(payload.sub ?? payload.user_id ?? "");
          return { data: { user: { ...(payload as unknown as CloudBaseUser), id: sub, sub } }, error: null };
        } catch (error) {
          return { data: { user: null }, error: { message: error instanceof Error ? error.message : "CloudBase auth failed" } };
        }
      },
    },
  };
}

export async function createStorageClient() {
  const cookieStore = await cookies();
  const environment = getPublicEnv();
  const storageApp = cloudbase.init({
    env: environment.NEXT_PUBLIC_CLOUDBASE_ENV_ID,
    region: environment.NEXT_PUBLIC_CLOUDBASE_REGION,
    accessKey: environment.NEXT_PUBLIC_CLOUDBASE_PUBLISHABLE_KEY,
  });
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  if (accessToken && refreshToken) {
    const { error } = await storageApp.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw new Error(error.message);
  }
  return storageApp.storage;
}

export function getPublicStorageUrl(bucket: string, objectName: string) {
  const environment = getPublicEnv();
  return `https://${environment.NEXT_PUBLIC_CLOUDBASE_ENV_ID}.api.tcloudbasegateway.com/v1/storages/object/${encodeURIComponent(bucket)}/${objectName.split("/").map(encodeURIComponent).join("/")}`;
}

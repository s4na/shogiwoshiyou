import type { UserSummary } from "../shared/types";

export type Env = {
  DB: D1Database;
  GAME_ROOM: DurableObjectNamespace;
  SESSION_COOKIE_NAME?: string;
};

export type AppVariables = {
  user: UserSummary;
};

export type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};

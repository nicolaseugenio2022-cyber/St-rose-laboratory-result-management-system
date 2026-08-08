/**
 * Application Configuration Layer
 * Centralized, validated environment configuration.
 */

export interface AppConfig {
  supabase: {
    url: string;
    anonKey: string;
  };
  app: {
    env: string;
    isDev: boolean;
  };
}

export const getAppConfig = (): AppConfig => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const nodeEnv = process.env.NODE_ENV || "development";

  return {
    supabase: {
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
    },
    app: {
      env: nodeEnv,
      isDev: nodeEnv === "development",
    },
  };
};

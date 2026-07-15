const TRANSIENT_CONNECTION_CODES = new Set(["CONNECT_TIMEOUT", "ECONNRESET", "ETIMEDOUT"]);

function isTransientConnectionError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: string; message?: string };
  return TRANSIENT_CONNECTION_CODES.has(code ?? "") || /connection (terminated|timeout)|connect_timeout/i.test(message ?? "");
}

export async function retryDatabaseRead<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (!isTransientConnectionError(error)) throw error;
    return read();
  }
}

import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

const writeQueues = new Map<string, Promise<void>>();

function enqueue<T>(filePath: string, operation: () => Promise<T>): Promise<T> {
  const previous = writeQueues.get(filePath) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  const settled = current.then(
    () => undefined,
    () => undefined
  );
  writeQueues.set(filePath, settled);
  settled.finally(() => {
    if (writeQueues.get(filePath) === settled) writeQueues.delete(filePath);
  });
  return current;
}

export async function readJsonStore<T>(filePath: string, initialState: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(initialState);
    throw error;
  }
}

async function writeJsonStoreUnlocked<T>(filePath: string, state: T): Promise<void> {
  const serialized = JSON.stringify(state, null, 2);
  const directory = path.dirname(filePath);
  const tempPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`
  );

  await mkdir(directory, { recursive: true });
  let handle;
  try {
    handle = await open(tempPath, "wx");
    await handle.writeFile(serialized, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(tempPath, filePath);
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined);
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

export function writeJsonStoreAtomic<T>(filePath: string, state: T): Promise<void> {
  return enqueue(filePath, () => writeJsonStoreUnlocked(filePath, state));
}

export function updateJsonStoreAtomic<T, R>(
  filePath: string,
  initialState: T,
  update: (state: T) => R | Promise<R>
): Promise<R> {
  return enqueue(filePath, async () => {
    const state = await readJsonStore(filePath, initialState);
    const result = await update(state);
    await writeJsonStoreUnlocked(filePath, state);
    return result;
  });
}

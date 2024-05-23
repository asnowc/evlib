import { SubProcess } from "./sub_process.ts";
import { rawSpawnSync, rawSpawn } from "./private.ts";
import { SpawnOptions, SpawnSyncOptions, SpawnSyncResult } from "./type.ts";

/** @public */
export function spawn(
  exePath: string,
  options: SpawnOptions = {},
): Promise<SubProcess> {
  return rawSpawn(exePath, options, {}).then((cps) => new SubProcess(cps));
}

/** @public */
export function spawnSync(
  exePath: string,
  options: SpawnSyncOptions = {},
): SpawnSyncResult {
  return rawSpawnSync(exePath, options);
}

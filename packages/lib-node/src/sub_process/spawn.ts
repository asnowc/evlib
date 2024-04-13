import { SubProcess } from "./sub_process.js";
import { rawSpawnSync, rawSpawn } from "./private.js";
import { SpawnOptions, SpawnSyncOptions, SpawnSyncResult } from "./type.js";

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

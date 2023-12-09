import {
  setPnpmWorkspaceTags,
  deleteMatchFromRemote,
} from "https://esm.sh/gh/dnpack/action-script@0.0.5/cmd/set_git_tag.ts?raw";
import { execCmdSync, git } from "https://esm.sh/gh/dnpack/action-script@0.0.5/cmd/mod.ts";
import * as action from "npm:@actions/core@1.10.x";
const gitCmd = git as any;
action.startGroup("deno output");

const allTags: Set<string> = new Set(await gitCmd.tag.getRemoteTags());

const isCI = Deno.env.get("CI") === "true";
if (isCI) await gitCmd.setCIUser();

const addedTags = await setPnpmWorkspaceTags(allTags, { dryRun: !isCI });
const skinAll = addedTags.length === 0;

if (skinAll) {
  console.log("skin publish");
  Deno.exit(0);
} else {
  execCmdSync("pnpm", ["publish", "-r"], { exitIfFail: true });

  let code = execCmdSync("git", ["push", "--tag"]).code;
  if (code !== 0) action.error("标签推送失败: " + addedTags.join(", "));
  else
    await deleteMatchFromRemote(allTags, addedTags, "patch").catch((e) => action.error("删除标签失败: " + e?.message));
}

action.endGroup();

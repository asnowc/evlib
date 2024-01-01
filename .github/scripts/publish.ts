import { githubRepo, publishFlow } from "https://cdn.jsdelivr.net/gh/dnpack/action-script@0.2.2/cmd/github_repo.ts";
import { getWorkspaceTagMap } from "https://cdn.jsdelivr.net/gh/dnpack/action-script@0.2.2/cmd/package.ts";
import { execCmdSync } from "https://cdn.jsdelivr.net/gh/dnpack/action-script@0.2.2/lib.ts";
console.log("::endgroup::");

const allTags = new Set(await githubRepo.listTags());
const tags = await getWorkspaceTagMap();

const updateTags = await publishFlow(Object.keys(tags), {
  allTags,
  publish(needUpdate) {
    execCmdSync("pnpm", ["publish", "-r"], { exitIfFail: true });
    return needUpdate;
  },
});
if (updateTags.size) await githubRepo.deleteMatchVersionTag(allTags, Array.from(updateTags!), "minor");

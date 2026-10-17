import { MemoryBlockRepository } from "~/infra/memory/memory-block.repository";

import { blockRepositoryContract } from "./contract/block-repository.contract";

blockRepositoryContract("memory", (hooks) => {
  const repo = new MemoryBlockRepository(hooks);
  return { repo, corruptOrder: (id, prevId) => repo.corruptOrder(id, prevId) };
});

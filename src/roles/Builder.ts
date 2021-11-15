import { Worker } from "../tasks/Worker";
import { WorkerAction, WorkerTask } from "../tasks/WorkerTask";
import { sortedPriorityQueue } from "../utils/Queue";

export class Builder extends Worker {
  constructor() {
    super();
    this.namePrefix = "Builder";
    this.role = "builder";
    this.bodyParts = [WORK, CARRY, MOVE];
  }

  spawn(spawn: StructureSpawn): void {
    console.log("Spawning builder!");
    if (spawn.room.controller) {
      super.spawn(spawn, {
        memory: {
          role: "builder",
          currentTask: new WorkerTask(WorkerAction.build),
          nextTasks: [],
          taskQueue: sortedPriorityQueue<WorkerTask>()
        }
      });
    }
  }
}

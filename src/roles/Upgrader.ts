import { Worker } from "../tasks/Worker";
import { WorkerAction, WorkerTask } from "../tasks/WorkerTask";
import { sortedPriorityQueue } from "../utils/Queue";

export class Upgrader extends Worker {
  constructor() {
    super();
    this.namePrefix = "Upgrader";
    this.role = "upgrader";
    this.bodyParts = [WORK, CARRY, MOVE];
  }

  spawn(spawn: StructureSpawn): void {
    console.log("Spawning upgrader!");
    if (spawn.room.controller) {
      super.spawn(spawn, {
        memory: {
          role: "upgrader",
          currentTask: new WorkerTask(WorkerAction.upgradeRoom, spawn.room.controller.id),
          nextTasks: [],
          taskQueue: sortedPriorityQueue<WorkerTask>()
        }
      });
    }
  }
}

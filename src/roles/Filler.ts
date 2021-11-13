import { Worker } from "../tasks/Worker";
import { WorkerAction, WorkerTask } from "../tasks/WorkerTask";
import { sortedPriorityQueue } from "../tasks/Queue";

// The filler class finds energy(prioritizing storage) and transfers it to structures
export class Filler extends Worker {
  constructor() {
    super();
    this.namePrefix = "Filler";
    this.role = "filler";
    this.bodyParts = [WORK, CARRY, MOVE];
  }

  spawn(spawn: StructureSpawn): void {
    console.log("Spawning filler!");
    if (spawn.room.controller) {
      super.spawn(spawn, {
        memory: {
          role: "filler",
          currentTask: new WorkerTask(WorkerAction.supplyEnergy),
          nextTasks: [],
          taskQueue: sortedPriorityQueue<WorkerTask>()
        }
      });
    }
  }
}

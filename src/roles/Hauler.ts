import { Worker } from "../tasks/Worker";
import { WorkerAction, WorkerTask } from "../tasks/WorkerTask";
import { sortedPriorityQueue } from "../tasks/Queue";

// A hauler is a dedicated class that hauls energy from mines to central storage.
export class Hauler extends Worker {
  constructor() {
    super();
    this.namePrefix = "Hauler";
    this.role = "Hauler";
    this.bodyParts = [WORK, CARRY, MOVE];
  }

  spawn(spawn: StructureSpawn): void {
    console.log("Spawning hauler!");
    if (spawn.room.controller) {
      super.spawn(spawn, {
        memory: {
          role: "hauler",
          currentTask: new WorkerTask(WorkerAction.storeEnergy),
          nextTasks: [],
          taskQueue: sortedPriorityQueue<WorkerTask>()
        }
      });
    }
  }
}

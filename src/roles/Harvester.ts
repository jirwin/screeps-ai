import { Worker } from "../tasks/Worker";
import { WorkerAction, WorkerTask } from "../tasks/WorkerTask";
import { sortedPriorityQueue } from "../tasks/Queue";

// The harvester is a dedicated miner. It picks the source with the fewest harvesters nearby.
export class Harvester extends Worker {
  constructor() {
    super();
    this.namePrefix = "Harvester";
    this.role = "harvester";
    this.bodyParts = [WORK, WORK, MOVE];
  }

  spawn(spawn: StructureSpawn): void {
    console.log("Spawning harvester!");
    let sources = spawn.room.find(FIND_SOURCES);
    let min = 100;
    let srcPos: RoomPosition = spawn.pos;
    let targetId = "";
    for (const srcId in sources) {
      let src = sources[srcId];
      let nearby = src.pos.findInRange(FIND_MY_CREEPS, 1, {
        filter: (c: Creep): boolean => c.memory.role === "harvester"
      });
      if (nearby.length <= min) {
        min = nearby.length;
        srcPos = src.pos;
        targetId = src.id;
      }
    }

    super.spawn(spawn, {
      memory: {
        role: "harvester",
        currentTask: new WorkerTask(WorkerAction.harvestEnergy, targetId),
        nextTasks: [],
        taskQueue: sortedPriorityQueue<WorkerTask>()
      }
    });
  }
}

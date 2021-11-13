import { ErrorMapper } from "utils/ErrorMapper";
import { Harvester } from "roles/Harvester";
import { filter } from "lodash";
import { WorkerTask } from "./tasks/WorkerTask";
import { Upgrader } from "./roles/Upgrader";
import { Builder } from "./roles/Builder";
import { Filler } from "./roles/Filler";
import { Hauler } from "./roles/Hauler";
import { PriorityQueue } from "./tasks/Queue";
import { Worker } from "./tasks/Worker";
import { TaskController } from "./tasks/TaskController";

declare global {
  /*
    Example types, expand on these or remove them and add your own.
    Note: Values, properties defined here do no fully *exist* by this type definiton alone.
          You must also give them an implemention if you would like to use them. (ex. actually setting a `role` property in a Creeps memory)

    Types added in this `global` block are in an ambient, global context. This is needed because `main.ts` is a module file (uses import or export).
    Interfaces matching on name from @types/screeps will be merged. This is how you can extend the 'built-in' interfaces from @types/screeps.
  */

  // Memory extension samples
  interface Memory {
    uuid: number;
    log: any;
  }

  interface CreepMemory {
    role: string;
    roleTarget?: string;
    room?: string;
    working?: boolean;
    currentTask: WorkerTask;
    nextTasks: WorkerTask[];
    taskQueue: PriorityQueue<WorkerTask>;
  }

  // Syntax for adding proprties to `global` (ex "global.log")
  namespace NodeJS {
    interface Global {
      log: any;
    }
  }
}

// Role classes. Instead of using a separate instance of these for each creep, we pass creeps into them.
let harvester = new Harvester();
let upgrader = new Upgrader();
let builder = new Builder();
let filler = new Filler();
let hauler = new Hauler();
let worker = new Worker();
let taskController = new TaskController();

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  console.log(`Current game tick is ${Game.time}`);

  // Automatically delete memory of missing creeps
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name];
    }
  }

  let towerIds: string[] = [];
  for (const towerId in towerIds) {
    let tower = Game.getObjectById(towerIds[towerId]) as StructureTower;
    if (tower) {
      let closestHostile = tower.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
      if (closestHostile) {
        tower.attack(closestHostile);
      }

      let closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
        // only repair things that need it, and have less than 10k health
        filter: (structure: AnyStructure) => {
          if (structure.structureType === STRUCTURE_WALL) {
            return structure.hits < structure.hitsMax && structure.hits < 10000;
          }
          return structure.hits < structure.hitsMax;
        }
      });
      if (closestDamagedStructure) {
        tower.repair(closestDamagedStructure);
      }
    }
  }

  for (const name in Game.spawns) {
    let spawn = Game.spawns[name];

    let workers = filter(Game.creeps, (creep: Creep): boolean => creep.memory.role !== "");
    if (workers.length < 10) {
      worker.spawn(spawn);
    }

    // let harvesters = filter(Game.creeps, (creep: Creep): boolean => creep.memory.role === "harvester");
    // if (harvesters.length < 1) {
    //   harvester.spawn(spawn);
    // }
    //
    // let fillers = filter(Game.creeps, (creep: Creep): boolean => creep.memory.role === "filler");
    // if (fillers.length < 2) {
    //   filler.spawn(spawn);
    // }
    //
    // let builders = filter(Game.creeps, (creep: Creep): boolean => creep.memory.role === "builder");
    // if (builders.length < 1) {
    //   builder.spawn(spawn);
    // }
    //
    // let haulers = filter(Game.creeps, (creep: Creep): boolean => creep.memory.role === "hauler");
    // if (haulers.length < 1) {
    //   hauler.spawn(spawn);
    // }
    //
    // let upgraders = filter(Game.creeps, (creep: Creep): boolean => creep.memory.role === "upgrader");
    // if (upgraders.length < 1) {
    //   upgrader.spawn(spawn);
    // }

    if (spawn.spawning) {
      let spawningCreep = Game.creeps[spawn.spawning.name];
      spawn.room.visual.text("🛠️" + spawningCreep.memory.role, spawn.pos.x + 1, spawn.pos.y, {
        align: "left",
        opacity: 0.8
      });
    }
  }

  taskController.tick();

  // for (const name in Game.creeps) {
  //   let creep = Game.creeps[name];
  //   if (creep.memory.role === "harvester") {
  //     harvester.run(creep);
  //   }
  //
  //   // if (creep.memory.role === "upgrader") {
  //   //   upgrader.run(creep);
  //   // }
  //   //
  //   // if (creep.memory.role === "builder") {
  //   //   builder.run(creep);
  //   // }
  //   //
  //   // if (creep.memory.role === "filler") {
  //   //   filler.run(creep);
  //   // }
  //   // if (creep.memory.role === "hauler") {
  //   //   hauler.run(creep);
  //   // }
  // }
});

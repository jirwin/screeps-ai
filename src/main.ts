import { ErrorMapper } from "utils/ErrorMapper";
import { WorkerTask } from "./tasks/WorkerTask";
import { PriorityQueue } from "./utils/Queue";
import { Worker } from "./tasks/Worker";
import { TaskController } from "./tasks/TaskController";
import { ConstructorController, ConstructTask } from "./constructor/ConstructorController";
import { RoadConstructor } from "./constructor/Roads";
import { BuildingPlanner, ContainerBuildingPlan, ExtensionBuildingPlan } from "./constructor/RoomBuilder";

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
    constructionQueues: { [roomName: string]: ConstructTask[] };
    roads: { [name: string]: number[] };
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
let constructor = new ConstructorController();
let roads = new RoadConstructor(constructor);
let buildingPlanner = new BuildingPlanner(constructor, roads);
let worker = new Worker(roads);
let taskController = new TaskController(worker);

// When compiling TS to JS and bundling with rollup, the line numbers and file names in error messages change
// This utility uses source maps to get the line numbers and file names of the original, TS source code
export const loop = ErrorMapper.wrapLoop(() => {
  console.log(`Current game tick is ${Game.time}`);

  constructor.gc();
  roads.gc();
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

    worker.spawn(spawn);

    // Handle basic road logic from the get go - Spawn -> [Sources, Controller]
    // let sources = spawn.room.find(FIND_SOURCES);
    // roads.connect(spawn.pos, sources);
    // if (spawn.room.controller) {
    //   roads.connect(spawn.pos, [spawn.room.controller.pos]);
    // }

    buildingPlanner.buildInRoom(spawn.room, ContainerBuildingPlan());
    buildingPlanner.buildInRoom(spawn.room, ExtensionBuildingPlan());

    if (spawn.spawning) {
      let spawningCreep = Game.creeps[spawn.spawning.name];
      spawn.room.visual.text("🛠️" + spawningCreep.memory.role, spawn.pos.x + 1, spawn.pos.y, {
        align: "left",
        opacity: 0.8
      });
    }
  }

  taskController.tick();
  constructor.tick();
});

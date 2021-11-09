import { ErrorMapper } from "utils/ErrorMapper";
import { Harvester } from "roles/Harvester";
import { Hauler } from "roles/Hauler";
import { Builder } from "roles/Builder";
import { Filler } from "roles/Filler";
import { Upgrader } from "roles/Upgrader";
import { filter } from "lodash";

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
    room?: string;
    working?: boolean;
    srcId?: string;
    fillAmount?: number;
  }

  // Syntax for adding proprties to `global` (ex "global.log")
  namespace NodeJS {
    interface Global {
      log: any;
    }
  }
}

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

  let towerIds = ["6188b5b4dfba68005dae678d"];
  for (const towerId in towerIds) {
    let tower = Game.getObjectById(towerIds[towerId]) as StructureTower;
    if (tower) {
      let closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
        // only repair things that need it, and have less than 10k health
        filter: (structure: AnyStructure) => structure.hits < structure.hitsMax && structure.hits < 10000
      });
      if (closestDamagedStructure) {
        tower.repair(closestDamagedStructure);
      }

      let closestHostile = tower.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
      if (closestHostile) {
        tower.attack(closestHostile);
      }
    }
  }

  for (const name in Game.spawns) {
    let spawn = Game.spawns[name];
    let harvesters = filter(Game.creeps, (creep: Creep): boolean => creep.memory.role === "harvester");
    if (harvesters.length < 3) {
      Harvester.spawn(spawn);
      continue;
    }

    let haulers = filter(Game.creeps, (creep: Creep): boolean => creep.memory.role === "hauler");
    if (haulers.length < 1) {
      spawn.spawnCreep(Hauler.parts(), Hauler.spawnName(), {
        memory: {
          role: "hauler"
        }
      });
      continue;
    }

    let fillers = filter(Game.creeps, (creep: Creep): boolean => creep.memory.role === "fillers");
    if (fillers.length < 1) {
      spawn.spawnCreep(Builder.parts(), Builder.spawnName(), {
        memory: {
          role: "filler"
        }
      });
      continue;
    }

    // let builders = filter(Game.creeps, (creep: Creep): boolean => creep.memory.role === "builder");
    // if (builders.length < 10) {
    //   spawn.spawnCreep(Builder.parts(), Builder.spawnName(), {
    //     memory: {
    //       role: "builder"
    //     }
    //   });
    // }
    //
    // let upgraders = filter(Game.creeps, (creep: Creep): boolean => creep.memory.role === "upgrader");
    // if (upgraders.length < 1) {
    //   spawn.spawnCreep(Upgrader.parts(), Upgrader.spawnName(), {
    //     memory: {
    //       role: "upgrader"
    //     }
    //   });
    // continue
    // }

    if (spawn.spawning) {
      var spawningCreep = Game.creeps[spawn.spawning.name];
      spawn.room.visual.text("🛠️" + spawningCreep.memory.role, spawn.pos.x + 1, spawn.pos.y, {
        align: "left",
        opacity: 0.8
      });
    }
  }

  for (const name in Game.creeps) {
    let creep = Game.creeps[name];
    if (creep.memory.role === "harvester") {
      Harvester.run(creep);
    }
    if (creep.memory.role === "builder") {
      Builder.run(creep);
    }
    if (creep.memory.role === "filler") {
      Filler.run(creep);
    }
    if (creep.memory.role === "hauler") {
      Hauler.run(creep);
    }
    if (creep.memory.role === "upgrader") {
      Upgrader.run(creep);
    }
  }
});

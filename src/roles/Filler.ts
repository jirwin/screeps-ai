function isRoomController(structure: StructureController | undefined): structure is StructureController {
  return structure !== undefined;
}

function isStoreStructure(structure: AnyStructure): structure is AnyStoreStructure {
  return (structure as AnyStoreStructure).store !== undefined;
}

export class Filler {
  public static spawnName = (): string => {
    return "Filler" + Game.time;
  };

  public static parts = (): BodyPartConstant[] => [WORK, MOVE, CARRY];

  public static run = (creep: Creep): void => {
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.working = false;
    }

    if (!creep.memory.working && creep.store.getFreeCapacity() == 0) {
      creep.memory.working = true;
    }

    if (!creep.memory.working) {
      let src = creep.room.find(FIND_STRUCTURES, {
        filter: (structure: AnyStructure): boolean => structure.structureType === STRUCTURE_STORAGE
      })[0];
      if (creep.withdraw(src, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(src, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
    } else {
      // We can't hold anymore, so lets fill something
      let fillTargets = creep.room.find(FIND_STRUCTURES, {
        filter: (structure: AnyStructure): boolean => {
          if (structure.structureType === STRUCTURE_CONTAINER) {
            return false;
          }
          if (!isStoreStructure(structure)) {
            return false;
          } else {
            return structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
          }
        }
      });
      if (fillTargets.length > 0) {
        if (creep.transfer(fillTargets[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(fillTargets[0], { visualizePathStyle: { stroke: "#ffffff" } });
          return;
        }
      }

      if (isRoomController(creep.room.controller)) {
        if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
          creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: "#ffffff" } });
        }
      }
    }
  };
}

function isRoomController(structure: StructureController | undefined): structure is StructureController {
  return structure !== undefined;
}

export class Upgrader {
  public static spawnName = (): string => {
    return "Upgrader" + Game.time;
  };

  public static parts = (): BodyPartConstant[] => [WORK, WORK, MOVE, MOVE, CARRY];

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
      if (isRoomController(creep.room.controller)) {
        if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
          creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: "#ffffff" } });
        }
      }
    }
  };
}

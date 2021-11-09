function isRoomController(structure: StructureController | undefined): structure is StructureController {
  return structure !== undefined;
}

function isStoreStructure(structure: AnyStructure): structure is AnyStoreStructure {
  return (structure as AnyStoreStructure).store !== undefined;
}

export class Builder {
  public static spawnName = (): string => {
    return "Builder" + Game.time;
  };

  public static parts = (): BodyPartConstant[] => [WORK, MOVE, CARRY];

  public static run = (creep: Creep): void => {
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.working = false;
    }

    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
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
      let constructTargets = creep.room.find(FIND_CONSTRUCTION_SITES);
      if (constructTargets.length > 0) {
        if (creep.build(constructTargets[0]) === ERR_NOT_IN_RANGE) {
          creep.moveTo(constructTargets[0], { visualizePathStyle: { stroke: "#ffffff" } });
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

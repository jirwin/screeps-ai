export class Hauler {
  public static spawnName = (): string => {
    return "Hauler" + Game.time;
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
      let containers = creep.room.find(FIND_STRUCTURES, {
        filter: (structure: AnyStructure): boolean => {
          if (structure.structureType === STRUCTURE_CONTAINER) {
            return structure.store.getUsedCapacity() > 0;
          }
          return false;
        }
      });
      if (containers.length) {
        if (creep.withdraw(containers[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(containers[0], { visualizePathStyle: { stroke: "#ffaa00" } });
        }
        return;
      }
      let resources = creep.room.find(FIND_DROPPED_RESOURCES);
      if (resources.length) {
        if (creep.pickup(resources[0]) === ERR_NOT_IN_RANGE) {
          creep.moveTo(resources[0], { visualizePathStyle: { stroke: "#ffaa00" } });
        }
        return;
      }
      // We didn't find any dropped resources, so lets work
      creep.memory.working = true;
      return;
    } else {
      // We can't hold anymore, so lets fill something
      let targets = creep.room.find(FIND_STRUCTURES, {
        filter: (structure: AnyStructure): boolean => structure.structureType === STRUCTURE_STORAGE
      });

      if (targets.length > 0) {
        if (creep.transfer(targets[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(targets[0], { visualizePathStyle: { stroke: "#ffffff" } });
        }
      }
    }
  };
}

import { Random } from "utils/Random";

function isStoreStructure(structure: AnyStructure): structure is AnyStoreStructure {
  return (structure as AnyStoreStructure).store !== undefined;
}

export class Harvester {
  public static spawnName = (): string => {
    return "Harvester" + Game.time;
  };

  public static parts = (): BodyPartConstant[] => [WORK, WORK, MOVE];

  public static spawn = (spawn: StructureSpawn) => {
    console.log("Spawning harvester!");
    let src = Random.Pick(spawn.room.find(FIND_SOURCES)) as Source;
    spawn.spawnCreep(Harvester.parts(), Harvester.spawnName(), {
      memory: {
        role: "harvester",
        srcId: src.id
      }
    });
  };

  public static run = (creep: Creep): void => {
    if (creep.memory.srcId) {
      let src = Game.getObjectById(creep.memory.srcId) as Source;
      if (creep.harvest(src) === ERR_NOT_IN_RANGE) {
        creep.moveTo(src, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
      return;
    } else {
      let src = creep.room.find(FIND_SOURCES)[0];
      if (creep.harvest(src) === ERR_NOT_IN_RANGE) {
        creep.moveTo(src, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
      return;
    }
  };
}

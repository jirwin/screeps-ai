/*
The TaskController is meant to be the central brain for managing the tasks of workers.
The general strategy:
  * make sure that if there are any resources on the ground, X workers will be sent to pick them up and put them in storage
  * if any structures need to be filled with energy, fill them
  * if
 */
import { Worker } from "./Worker";
import { difference, filter, sortBy } from "lodash";
import { WorkerAction, WorkerTask } from "./WorkerTask";
import { Random } from "../utils/Random";

const worker = new Worker();

function isStoreStructure(structure: AnyStructure): structure is AnyStoreStructure {
  return (structure as AnyStoreStructure).store !== undefined;
}

export class TaskController {
  // In level one, we really just want to rush to level 2. Only upgrade the room.
  level1(room: Room, workers: Creep[]): void {
    while (workers.length > 0) {
      const w = workers.pop();
      if (w) {
        if (room.controller) {
          w.memory.role = "upgrader";
          w.memory.roleTarget = room.controller.id;
          worker.queueTask(w, new WorkerTask(WorkerAction.upgradeRoom, room.controller.id));
          worker.completeTask(w);
        }
      }
    }
  }

  /*
  In level 2 we start a few new things:
    * drop mining - dedicate workers to perpetual mining
    * First we will want to build a container so that we can begin centralizing energy
    * Once we have a container, dedicate workers to hauling dropped resources to the container
   */
  level2(room: Room, workers: Creep[]): void {
    const allWorkers = room.find(FIND_MY_CREEPS);
    // Miners: 20%
    // Builders: 40%
    // Haul: 20%
    // Supply: 20%
    let desiredMinerCount = 0;
    if (allWorkers.length === 0) {
      desiredMinerCount = 1;
    } else {
      desiredMinerCount = Math.ceil(allWorkers.length * 0.2);
    }

    let desiredBuilderCount = Math.ceil(allWorkers.length * 0.4);
    let desiredHaulerCount = Math.ceil(allWorkers.length * 0.2);
    let desiredSupplyCount = Math.ceil(allWorkers.length * 0.2);

    while (workers.length > 0) {
      const miners = room.find(FIND_MY_CREEPS, {
        filter: (c: Creep): boolean => c.memory.role === "miner"
      });
      const builders = room.find(FIND_MY_CREEPS, {
        filter: (c: Creep): boolean => c.memory.role === "builder"
      });
      const suppliers = room.find(FIND_MY_CREEPS, {
        filter: (c: Creep): boolean => c.memory.role === "supplier"
      });
      const haulers = room.find(FIND_MY_CREEPS, {
        filter: (c: Creep): boolean => c.memory.role === "hauler"
      });
      const w = workers.pop();
      if (w) {
        console.log(`${miners.length} actual miners - ${desiredMinerCount} desired miners`);
        if (miners.length < desiredMinerCount) {
          w.memory.role = "miner";
          worker.queueTask(w, new WorkerTask(WorkerAction.perpetualHarvestEnergy));
          worker.completeTask(w);
          continue;
        }

        if (haulers.length < desiredHaulerCount) {
          const hungryContainers = room.find(FIND_MY_STRUCTURES, {
            filter: (s: AnyStructure): boolean => {
              if (s.structureType !== STRUCTURE_STORAGE && s.structureType !== STRUCTURE_CONTAINER) {
                return false;
              }
              if (isStoreStructure(s)) {
                if (s.store.getFreeCapacity() !== 0) {
                  return true;
                }
              } else {
                return false;
              }

              return false;
            }
          });

          const fedContainers = room.find(FIND_MY_STRUCTURES, {
            filter: (s: AnyStructure): boolean => {
              for (const id in haulers) {
                const haul = haulers[id];
                if (haul.memory.roleTarget) {
                  if (s.id === haul.memory.roleTarget) {
                    return true;
                  }
                }
              }
              return false;
            }
          });

          let haulStructures = difference(hungryContainers, fedContainers);
          if (haulStructures.length > 0) {
            let target = Random.Pick(haulStructures);
            w.memory.role = "hauler";
            w.memory.roleTarget = target.id;
            worker.queueTask(w, new WorkerTask(WorkerAction.storeEnergy, target.id));
            worker.completeTask(w);
            continue;
          }
        }

        if (suppliers.length < desiredSupplyCount) {
          // Find structures that need to be fed and pick one randomly to fill, and aren't currently assigned to already.
          const hungryStructures = room.find(FIND_MY_STRUCTURES, {
            filter: (s: AnyStructure): boolean => {
              if (s.structureType === STRUCTURE_STORAGE || s.structureType === STRUCTURE_CONTAINER) {
                return false;
              }
              if (isStoreStructure(s)) {
                return s.store.getFreeCapacity(RESOURCE_ENERGY) !== 0;
              } else {
                return false;
              }
            }
          });

          const alreadyFedStructures = room.find(FIND_MY_STRUCTURES, {
            filter: (s: AnyStructure): boolean => {
              for (const id in suppliers) {
                const sup = suppliers[id];
                if (sup.memory.roleTarget) {
                  if (s.id === sup.memory.roleTarget) {
                    return true;
                  }
                }
              }
              return false;
            }
          });

          let supplyStructures = difference(hungryStructures, alreadyFedStructures);

          if (supplyStructures.length > 0) {
            let s = Random.Pick(supplyStructures);
            w.memory.role = "supplier";
            w.memory.roleTarget = s.id;
            worker.queueTask(w, new WorkerTask(WorkerAction.supplyEnergy, s.id));
            worker.completeTask(w);
            continue;
          }
        }

        if (builders.length < desiredBuilderCount) {
          // Find structures that need to be fed and pick one randomly to fill, and aren't currently assigned to already.
          const hungryConstruction = room.find(FIND_MY_CONSTRUCTION_SITES);

          // const fedConstruction = room.find(FIND_MY_CONSTRUCTION_SITES, {
          //   filter: (s: ConstructionSite): boolean => {
          //     for (const id in builders) {
          //       const b = builders[id];
          //       if (b.memory.roleTarget) {
          //         if (s.id === b.memory.roleTarget) {
          //           return true;
          //         }
          //       }
          //     }
          //     return false;
          //   }
          // });

          // let buildSites = difference(hungryConstruction, fedConstruction);
          const buildSites = sortBy(
            hungryConstruction,
            (site: ConstructionSite): any => (site.progress / site.progressTotal) * -1
          );
          if (buildSites.length > 0) {
            let s = buildSites[0];
            w.memory.role = "builder";
            w.memory.roleTarget = s.id;
            worker.queueTask(w, new WorkerTask(WorkerAction.build, s.id));
            worker.completeTask(w);
            continue;
          }
        }

        // No work? Upgrade the controller!
        if (room.controller) {
          w.memory.role = "upgrader";
          w.memory.roleTarget = room.controller.id;
          worker.queueTask(w, new WorkerTask(WorkerAction.upgradeRoom, room.controller.id));
          worker.completeTask(w);
        }
      }
    }
  }

  tick(): void {
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (!room) {
        continue;
      }

      const roomWorkers = filter(
        Game.creeps,
        (c: Creep): boolean => c.room.name === room.name && c.memory.currentTask.action === WorkerAction.idle
      );

      console.log(`${roomWorkers.length} room workers available in ${room.name}`);

      if (room.controller) {
        switch (room.controller.level) {
          case 1:
            this.level1(room, roomWorkers);
            break;

          case 2:
            this.level2(room, roomWorkers);
            break;

          default:
            console.log("unsupported controller level!");
            this.level2(room, roomWorkers);
        }
      }

      // Execute the workers
      const roomCreeps = filter(Game.creeps, (c: Creep): boolean => c.room.name === room.name);
      for (const cId in roomCreeps) {
        let creep = roomCreeps[cId];
        worker.run(creep);
      }
    }
  }
}

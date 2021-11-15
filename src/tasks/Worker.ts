import { WorkerAction, WorkerTask } from "./WorkerTask";
import { Random } from "../utils/Random";
import { sortedPriorityQueue } from "../utils/Queue";
import { RoadConstructor } from "../constructor/Roads";

function unknownState(_x: never): never {
  throw new Error("unknown state");
}

function isStoreStructure(structure: AnyStructure): structure is AnyStoreStructure {
  return (structure as AnyStoreStructure).store !== undefined;
}

type MoveTarget = RoomObject & { id: string };

export class Worker {
  bodyParts: BodyPartConstant[] = [WORK, MOVE, CARRY];
  namePrefix: string = "Worker";
  role: string = "worker";
  roadController: RoadConstructor;

  constructor(roadController: RoadConstructor) {
    this.roadController = roadController;
  }

  parts(): BodyPartConstant[] {
    return this.bodyParts;
  }

  spawnName(): string {
    return this.namePrefix + Game.time;
  }

  spawn(spawn: StructureSpawn, opts?: SpawnOptions): void {
    opts = opts || {
      memory: {
        role: "idle",
        currentTask: new WorkerTask(WorkerAction.idle),
        nextTasks: [],
        taskQueue: sortedPriorityQueue<WorkerTask>()
      }
    };

    spawn.spawnCreep(this.parts(), this.spawnName(), opts);
  }

  // Queues a worker task
  queueTask(creep: Creep, nextTask: WorkerTask): void {
    creep.memory.nextTasks.push(nextTask);
  }

  // Replaces the current state with the new state, and pushes the current state into the next state
  injectTask(creep: Creep, newTask: WorkerTask): void {
    creep.memory.nextTasks.unshift(creep.memory.currentTask);
    creep.memory.currentTask = newTask;
  }

  // Pushes a task to the front of the queue
  pushTask(creep: Creep, newTask: WorkerTask): void {
    creep.memory.nextTasks.unshift(newTask);
  }

  // Updates the current task to target the provided target.
  targetTask(creep: Creep, target: MoveTarget): void {
    creep.memory.currentTask.targetId = target.id;
  }

  // Progresses the queue task to the next item. If there is no next item, begin idling.
  completeTask(creep: Creep): void {
    let nextTask = creep.memory.nextTasks.shift();
    if (nextTask) {
      console.log(
        `${creep.name} - Switching from ${WorkerAction[creep.memory.currentTask.action]} to ${
          WorkerAction[nextTask.action]
        }`
      );
      creep.memory.currentTask = nextTask;
    } else {
      creep.memory.currentTask = new WorkerTask(WorkerAction.idle);
    }
  }

  // Immediately moves the creep to the target. The current task is put at the front of the queue.
  queueMoveTask(creep: Creep, target: MoveTarget): void {
    // If we are already in the move state, ignore this command
    if (creep.memory.currentTask.action === WorkerAction.move) {
      return;
    }

    this.injectTask(creep, new WorkerTask(WorkerAction.move, target.id));
  }

  // Action implementations
  idle(creep: Creep, task: WorkerTask): void {
    // Reset our role once we are idle
    creep.memory.role = "idle";
    creep.memory.roleTarget = undefined;
    // If we have a next task, progress to it
    if (creep.memory.nextTasks.length > 0) {
      this.completeTask(creep);
      return;
    }
    creep.say("I AM IDLE!!!!");
  }

  move(creep: Creep, task: WorkerTask): void {
    if (!task.targetId) {
      console.log("unexpected move task with no target");
      this.completeTask(creep);
      return;
    }
    let target = Game.getObjectById(task.targetId) as MoveTarget;
    if (target) {
      if (creep.pos.isNearTo(target.pos)) {
        // We've reached our target, transition to next
        this.completeTask(creep);
        return;
      }
      const err = creep.moveTo(target, {
        visualizePathStyle: {
          stroke: "#ffffff"
        }
      });
      if (err === OK || err === ERR_TIRED) {
        this.roadController.shouldBuildAt(creep.pos);
      }

      return;
    }

    this.completeTask(creep);
  }

  harvestEnergy(creep: Creep, task: WorkerTask): void {
    if (!task.targetId) {
      this.pushTask(creep, new WorkerTask(WorkerAction.pickEnergySourceForHarvest));
      this.completeTask(creep);
      return;
    }

    if (creep.store.getFreeCapacity() === 0) {
      this.completeTask(creep);
      return;
    }

    let objectById = Game.getObjectById(task.targetId);
    if (objectById) {
      let target = objectById as Source;

      let err = creep.harvest(target);
      if (err) {
        if (err === ERR_NOT_IN_RANGE) {
          this.queueMoveTask(creep, target);
          return;
        }

        // We got an error, so pick a new energy source and try again
        this.pushTask(creep, new WorkerTask(WorkerAction.pickEnergySourceForHarvest));
        this.completeTask(creep);
        return;
      }

      // If we are full, complete the task
      if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        this.completeTask(creep);
      }
      return;
    }
  }

  perpetualHarvestEnergy(creep: Creep, task: WorkerTask): void {
    if (!task.targetId) {
      this.pushTask(creep, new WorkerTask(WorkerAction.pickEnergySourceForPerpetualHarvest));
      this.completeTask(creep);
      return;
    }

    let objectById = Game.getObjectById(task.targetId);
    if (objectById) {
      let target = objectById as Source;

      let err = creep.harvest(target);
      if (err) {
        if (err === ERR_NOT_IN_RANGE) {
          this.queueMoveTask(creep, target);
          return;
        }

        // We got an error, so pick a new energy source and try again
        this.pushTask(creep, new WorkerTask(WorkerAction.pickEnergySourceForHarvest));
        this.completeTask(creep);
        return;
      }

      return;
    }
  }

  fillCreepEnergy(creep: Creep, task: WorkerTask): void {
    if (creep.store.getFreeCapacity() === 0) {
      // We are full up, next task
      this.completeTask(creep);
      return;
    }

    // We need to find something to collect energy from
    let source = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (structure: AnyStructure): boolean =>
        (structure.structureType === STRUCTURE_STORAGE || structure.structureType === STRUCTURE_CONTAINER) &&
        structure.store.getUsedCapacity() > 50
    });
    if (source) {
      this.injectTask(creep, new WorkerTask(WorkerAction.withdrawEnergy, source.id));
      return;
    }

    // FIXME(jirwin): This causes creeps to stack up at drop miners...
    // let resource = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES);
    // if (resource) {
    //   this.injectTask(creep, new WorkerTask(WorkerAction.pickupEnergy, resource.id));
    //   return;
    // }

    console.log("no resources to pick up -- time to mine!");
    this.injectTask(creep, new WorkerTask(WorkerAction.harvestEnergy));
  }

  supplyEnergy(creep: Creep, task: WorkerTask): void {
    // We are out of energy, get more.
    if (creep.store.getFreeCapacity() !== 0) {
      this.injectTask(creep, new WorkerTask(WorkerAction.fillCreepEnergy));
      return;
    }

    if (task.targetId) {
      let objectById = Game.getObjectById(task.targetId);

      if (objectById) {
        let target = objectById as AnyStoreStructure;

        // Our target is full -- jobs finished
        if (target.store.getFreeCapacity() === 0) {
          this.completeTask(creep);
          return;
        }
        let err = creep.transfer(target, RESOURCE_ENERGY);
        if (err) {
          if (err === ERR_NOT_IN_RANGE) {
            this.queueMoveTask(creep, target);
            return;
          }

          // Some error, we're done here.
          this.completeTask(creep);
        }
      }
      this.completeTask(creep);
      return;
    }

    let fillTargets = creep.room.find(FIND_STRUCTURES, {
      filter: (structure: AnyStructure): boolean => {
        if (structure.structureType === STRUCTURE_CONTAINER || structure.structureType === STRUCTURE_STORAGE) {
          return false;
        }

        if (isStoreStructure(structure)) {
          return structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }

        return false;
      }
    });
    if (fillTargets.length > 0) {
      this.targetTask(creep, Random.Pick(fillTargets));
      return;
    }
  }

  build(creep: Creep, task: WorkerTask): void {
    // We are out of energy, get more.
    if (creep.store.getUsedCapacity() === 0) {
      this.injectTask(creep, new WorkerTask(WorkerAction.fillCreepEnergy));
      return;
    }

    if (task.targetId) {
      let constructTarget = Game.getObjectById(task.targetId);
      if (constructTarget) {
        let ctgt = constructTarget as ConstructionSite;
        if (ctgt.progress === ctgt.progressTotal) {
          this.completeTask(creep);
          return;
        }

        let err = creep.build(ctgt);
        if (err) {
          if (err === ERR_NOT_IN_RANGE) {
            this.queueMoveTask(creep, ctgt);
            return;
          }

          // We got some error. Complete this task
          this.completeTask(creep);
          return;
        }

        // Build until we are out of energy
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
          this.completeTask(creep);
          return;
        }
      } else {
        this.completeTask(creep);
        return;
      }
    }

    // Find the most completed construction site
    let constructTarget = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
    if (constructTarget) {
      this.targetTask(creep, constructTarget);
      return;
    }
  }

  // FIXME(jirwin): implement me
  repair(creep: Creep, task: WorkerTask): void {
    if (!task.targetId) {
      this.completeTask(creep);
      return;
    }

    // We are out of energy, get more.
    if (creep.store.getUsedCapacity() < 10) {
      this.injectTask(creep, new WorkerTask(WorkerAction.fillCreepEnergy));
      return;
    }

    let objectById = Game.getObjectById(task.targetId);
    if (objectById) {
      let target = objectById as AnyStructure;
      const err = creep.repair(target);
      if (err) {
        if (err === ERR_NOT_IN_RANGE) {
          this.queueMoveTask(creep, target);
          return;
        }

        this.completeTask(creep);
        return;
      }

      // repair the target until we are empty
      if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        this.completeTask(creep);
        return;
      }
    }
  }

  // 1. If we are completely empty, fill up on energy
  // 2. Upgrade the room until we are empty
  upgradeRoom(creep: Creep, task: WorkerTask): void {
    if (!task.targetId) {
      console.log("unexpected upgrade task with no task id");
      this.completeTask(creep);
      return;
    }

    // If we don't have any energy, go fill up first. If we have any, upgrade the room and complete the task when empty.
    if (creep.store.getUsedCapacity() === 0) {
      this.injectTask(creep, new WorkerTask(WorkerAction.fillCreepEnergy));
      return;
    }

    let objectById = Game.getObjectById(task.targetId);
    if (objectById) {
      let target = objectById as StructureController;
      const err = creep.upgradeController(target);
      if (err) {
        if (err === ERR_NOT_IN_RANGE) {
          this.queueMoveTask(creep, target);
          return;
        }
      }

      // upgrade the target until we are empty
      if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        this.completeTask(creep);
        return;
      }
    }
  }

  // FIXME(jirwin): implement targetless
  withdrawEnergy(creep: Creep, task: WorkerTask): void {
    if (!task.targetId) {
      console.log("unexpected withdraw energy with no target");
      this.completeTask(creep);
      return;
    }

    if (creep.store.getFreeCapacity() === 0) {
      this.completeTask(creep);
      return;
    }

    let objectById = Game.getObjectById(task.targetId);
    if (objectById) {
      let target = objectById as AnyStoreStructure;

      let err = creep.withdraw(target, RESOURCE_ENERGY);
      if (err) {
        if (err === ERR_NOT_IN_RANGE) {
          this.queueMoveTask(creep, target);
          return;
        }
        this.completeTask(creep);
        return;
      }
    } else {
      this.completeTask(creep);
      return;
    }
  }

  pickupEnergy(creep: Creep, task: WorkerTask): void {
    if (creep.store.getFreeCapacity() === 0) {
      this.completeTask(creep);
      return;
    }

    if (task.targetId) {
      let pickupTarget = Game.getObjectById(task.targetId);
      if (pickupTarget) {
        let tgt = pickupTarget as Resource;
        let err = creep.pickup(tgt);
        if (err) {
          if (err === ERR_NOT_IN_RANGE) {
            this.queueMoveTask(creep, tgt);
            return;
          }
          this.completeTask(creep);
          return;
        }
      } else {
        this.completeTask(creep);
        return;
      }
    }

    let resourceTarget = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES);
    if (resourceTarget) {
      this.targetTask(creep, resourceTarget);
      return;
    }
  }

  storeEnergy(creep: Creep, task: WorkerTask): void {
    // We don't have any energy so we should pick up more
    if (creep.store.getUsedCapacity() === 0) {
      this.injectTask(creep, new WorkerTask(WorkerAction.pickupEnergy));
      return;
    }

    if (task.targetId) {
      let objectById = Game.getObjectById(task.targetId);
      if (objectById) {
        let target = objectById as StructureStorage | StructureContainer;
        let err = creep.transfer(target, RESOURCE_ENERGY);
        if (err) {
          if (err === ERR_NOT_IN_RANGE) {
            this.queueMoveTask(creep, target);
            return;
          }

          // We have an error. Pick a new target and try again.
          this.queueTask(creep, new WorkerTask(WorkerAction.storeEnergy));
          this.completeTask(creep);
          return;
        }
      } else {
        // Our target doesn't exist anymore. Pick a new one and try again.
        this.queueTask(creep, new WorkerTask(WorkerAction.storeEnergy));
        this.completeTask(creep);
        return;
      }
    }

    let storeTargets = creep.room.find(FIND_STRUCTURES, {
      filter: (structure: AnyStructure): boolean => {
        if (structure.structureType === STRUCTURE_CONTAINER || structure.structureType === STRUCTURE_STORAGE) {
          return true;
        }

        if (isStoreStructure(structure)) {
          return structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }

        return false;
      }
    });
    if (storeTargets.length > 0) {
      this.targetTask(creep, Random.Pick(storeTargets));
      return;
    }
  }

  // Picks an energy source and pushes a task to harvest it
  pickEnergySourceForHarvest(creep: Creep, task: WorkerTask): void {
    let source = creep.pos.findClosestByPath(FIND_SOURCES);
    if (source) {
      this.pushTask(creep, new WorkerTask(WorkerAction.harvestEnergy, source.id));
      this.completeTask(creep);
      return;
    }
  }

  pickEnergySourceForPerpetualHarvest(creep: Creep, task: WorkerTask): void {
    let source = this.pickBestEnergySource(creep);
    if (source) {
      this.pushTask(creep, new WorkerTask(WorkerAction.perpetualHarvestEnergy, source.id));
      this.completeTask(creep);
      return;
    }
  }

  // The primary run function for the worker.
  run(creep: Creep): void {
    let task = creep.memory.currentTask;
    switch (creep.memory.currentTask.action) {
      case WorkerAction.idle:
        this.idle(creep, task);
        break;

      case WorkerAction.move:
        this.move(creep, task);
        break;

      case WorkerAction.harvestEnergy:
        this.harvestEnergy(creep, task);
        break;

      case WorkerAction.perpetualHarvestEnergy:
        this.perpetualHarvestEnergy(creep, task);
        break;

      case WorkerAction.storeEnergy:
        this.storeEnergy(creep, task);
        break;

      case WorkerAction.withdrawEnergy:
        this.withdrawEnergy(creep, task);
        break;

      case WorkerAction.pickupEnergy:
        this.pickupEnergy(creep, task);
        break;

      case WorkerAction.fillCreepEnergy:
        this.fillCreepEnergy(creep, task);
        break;

      case WorkerAction.supplyEnergy:
        this.supplyEnergy(creep, task);
        break;

      case WorkerAction.build:
        this.build(creep, task);
        break;

      case WorkerAction.repair:
        this.repair(creep, task);
        break;

      case WorkerAction.upgradeRoom:
        this.upgradeRoom(creep, task);
        break;

      case WorkerAction.pickEnergySourceForHarvest:
        this.pickEnergySourceForHarvest(creep, task);
        break;

      case WorkerAction.pickEnergySourceForPerpetualHarvest:
        this.pickEnergySourceForPerpetualHarvest(creep, task);
        break;

      default:
        unknownState(creep.memory.currentTask.action);
    }
  }

  private pickBestEnergySource(creep: Creep): Source | undefined {
    let sources = creep.room.find(FIND_SOURCES);
    let min = 100;
    let source: Source | undefined;

    for (const srcId in sources) {
      let src = sources[srcId];
      let nearby = src.pos.findInRange(FIND_MY_CREEPS, 1, {
        filter: (c: Creep): boolean => c.memory.role === "miner"
      });
      if (nearby.length <= min) {
        min = nearby.length;
        source = src;
      }
    }
    return source;
  }
}

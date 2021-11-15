import { PriorityQueue, sortedPriorityQueue } from "../utils/Queue";

const CONSTRUCTION_SITE_LIMIT = 100;
const EXISTING_CONSTRUCTION_SITE_THRESHOLD = 95;
const CONSTRUCTION_SITES_PER_ROOM_LIMIT = 4;

const structurePriority: BuildableStructureConstant[] = [
  STRUCTURE_SPAWN,
  STRUCTURE_STORAGE,
  STRUCTURE_TOWER,
  STRUCTURE_EXTENSION,
  STRUCTURE_CONTAINER,
  STRUCTURE_LINK,
  STRUCTURE_WALL,
  STRUCTURE_EXTRACTOR,
  STRUCTURE_TERMINAL,
  STRUCTURE_LAB,
  STRUCTURE_RAMPART,
  STRUCTURE_OBSERVER,
  STRUCTURE_NUKER,
  STRUCTURE_POWER_SPAWN,
  STRUCTURE_ROAD
];

export class ConstructTask {
  structure: BuildableStructureConstant;
  roomName: string;
  pos: RoomPosition;
  priority: number = 5;

  constructor(structure: BuildableStructureConstant, pos: RoomPosition) {
    this.structure = structure;
    this.roomName = pos.roomName;
    this.pos = pos;
    this.priority = structurePriority.indexOf(structure);
  }
}

type scheduledTask = {
  task: ConstructTask;
  idx: number;
};

export class ConstructorController {
  constructionSites: { [name: string]: ConstructionSite[] } = {};
  siteCount: number = 0;

  buildSiteCache(): void {
    this.siteCount = 0;
    for (const siteId in Game.constructionSites) {
      const site: ConstructionSite = Game.constructionSites[siteId];
      if (site && site.room) {
        this.siteCount++;
        const cSites: ConstructionSite[] = this.constructionSites[site.room.name] || [];
        cSites.push(site);
        this.constructionSites[site.room.name] = cSites;
      }
    }
  }

  // Returns a work queue for the room. If it doesn't exist, creates one.
  getWorkQueue(roomName: string): PriorityQueue<ConstructTask> {
    if (!Memory.constructionQueues) {
      Memory.constructionQueues = {};
    }

    return sortedPriorityQueue<ConstructTask>(Memory.constructionQueues[roomName]);
  }

  saveWorkQueue(roomName: string, queue: PriorityQueue<ConstructTask>) {
    let s = queue.filter((t: ConstructTask): boolean => true);
    Memory.constructionQueues[roomName] = s;
  }

  // Schedules a structure to be constructed. Returns true if the item was scheduled successfully
  schedule(task: ConstructTask): boolean {
    const workQueue = this.getWorkQueue(task.roomName);
    const scheduledTask = this.checkSchedule(task.pos);
    if (scheduledTask) {
      const stask: ConstructTask = scheduledTask.task;
      console.log(`scheduled task exists for ${stask.structure} at (${stask.pos.x}, ${stask.pos.y})`);

      if (scheduledTask.task.structure === STRUCTURE_ROAD) {
        console.log(`replacing scheduled road work at (${stask.pos.x},${stask.pos.y}) with ${task.structure}`);
        workQueue.remove(scheduledTask.idx);
        workQueue.insert(task);
        this.saveWorkQueue(task.roomName, workQueue);
        return true;
      }

      console.log(
        `work already scheduled at (${stask.pos.x},${stask.pos.y}). Not scheduling new ${task.structure} work.`
      );
      return false;
    }

    console.log(`scheduling build of ${task.structure} @ (${task.pos.x}, ${task.pos.y})`);
    workQueue.insert(task);

    this.saveWorkQueue(task.roomName, workQueue);
    return true;
  }

  // Check the schedule for a task at the provide position
  checkSchedule(pos: RoomPosition): scheduledTask | undefined {
    const workQueue = this.getWorkQueue(pos.roomName);
    // Look to see if any work is already scheduled at the current position
    let scheduledTask = workQueue.find((t: ConstructTask): boolean => {
      return t.roomName === pos.roomName && t.pos.x === pos.x && t.pos.y === pos.y;
    });

    if (scheduledTask) {
      console.log(`found scheduled task for ${scheduledTask.item.structure} @ (${pos.x},${pos.y})`);
      return {
        task: scheduledTask.item,
        idx: scheduledTask.idx
      };
    }

    return undefined;
  }

  getScheduled(room: Room): ConstructTask[] {
    const workQueue = this.getWorkQueue(room.name);

    return workQueue.filter((): boolean => true);
  }

  // Returns the construction sites for a given room
  getSitesForRoom(room: Room): ConstructionSite[] {
    if (!this.constructionSites[room.name]) {
      this.buildSiteCache();
    }
    return this.constructionSites[room.name] || [];
  }

  // Returns the number of construction sites across all rooms
  countAllSites(): number {
    if (!this.siteCount) {
      this.buildSiteCache();
    }
    return this.siteCount;
  }

  tick(): void {
    for (const rid in Game.rooms) {
      const room = Game.rooms[rid];
      const workQueue = this.getWorkQueue(room.name);

      // No work to do, move on
      if (workQueue.isEmpty()) {
        return;
      }

      // Do we have room to schedule more?
      const siteCount = this.countAllSites();
      const roomSites = this.getSitesForRoom(room);
      if (siteCount >= EXISTING_CONSTRUCTION_SITE_THRESHOLD || roomSites.length > CONSTRUCTION_SITES_PER_ROOM_LIMIT) {
        console.log("unable to build more construction sites due to limits");
        return;
      }

      let newSiteCount = 0;
      const delayedTasks: ConstructTask[] = [];

      while (
        siteCount + newSiteCount < CONSTRUCTION_SITE_LIMIT &&
        roomSites.length + newSiteCount < CONSTRUCTION_SITES_PER_ROOM_LIMIT
      ) {
        if (workQueue.isEmpty()) {
          break;
        }

        const task = workQueue.pop();
        if (task) {
          const room = Game.rooms[task.roomName];
          if (room) {
            const err = room.createConstructionSite(task.pos, task.structure);
            if (err !== OK) {
              console.log(`error ${err} while trying to create ${task.structure} @ (${task.pos.x}, ${task.pos.y})`);
              if (err === ERR_FULL || err === ERR_RCL_NOT_ENOUGH) {
                console.log(`cannot build this now, but can later. Requeuing.`);
                delayedTasks.push(task);
              }

              continue;
            }

            newSiteCount++;
            // If there is a road where we are building, destroy it
            const roadAtPoint = room
              .lookAt(task.pos)
              .find(
                (x: LookAtResult): boolean => (x.structure && x.structure.structureType === STRUCTURE_ROAD) || false
              );

            if (roadAtPoint && roadAtPoint.structure) {
              roadAtPoint.structure.destroy();
            }
          }
        }
      }

      // Requeue tasks that were delayed
      for (const i in delayedTasks) {
        const t = delayedTasks[i];
        workQueue.insert(t);
      }

      this.saveWorkQueue(room.name, workQueue);
    }
  }

  gc(): void {
    this.constructionSites = {};
    this.siteCount = 0;
  }
}

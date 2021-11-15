import { ConstructorController, ConstructTask } from "./ConstructorController";

export const VOTE_EXPIRATION = 100;
export const ELECTION_THRESHOLD = 5;

export class RoadConstructor {
  controller: ConstructorController;

  constructor(c: ConstructorController) {
    this.controller = c;
  }

  buildAt(target: RoomPosition): boolean {
    return this.controller.schedule(new ConstructTask(STRUCTURE_ROAD, target));
  }

  shouldBuildAt(target: RoomPosition): boolean {
    let room = Game.rooms[target.roomName];
    if (room) {
      if (room.controller) {
        if (room.controller.level < 2) {
          console.log(`room is level ${room.controller.level} so skipping building road`);
          return false;
        }

        if (!this.haveRoad(target) && this.voteForRoad(target, ELECTION_THRESHOLD, VOTE_EXPIRATION)) {
          return this.buildAt(target);
        }

        return false;
      }
    }
    return false;
  }

  haveRoad(target: RoomPosition): boolean {
    let room = Game.rooms[target.roomName];
    if (room) {
      const objects = room.lookAt(target);

      let results = objects.find((o: LookAtResult) => {
        return (
          (o.type === LOOK_CONSTRUCTION_SITES &&
            o.constructionSite &&
            o.constructionSite.structureType === STRUCTURE_ROAD) ||
          (o.type === LOOK_STRUCTURES && o.structure && o.structure.structureType === STRUCTURE_ROAD)
        );
      });

      return results !== undefined;
    }
    return false;
  }

  expireVotes(votes: number[], expiration: number): number[] {
    return votes.filter((t: number): boolean => t + expiration > Game.time);
  }

  voteForRoad(target: RoomPosition, voteThreshold: number, expiration: number): boolean {
    if (!Memory.roads) {
      Memory.roads = {};
    }
    const addr = `${target.roomName}-${target.x}-${target.y}`;
    let ballots = Memory.roads[addr];

    // No votes
    if (!ballots) {
      Memory.roads[addr] = [Game.time];
      return false;
    }

    // Expire old ballots
    Memory.roads[addr] = this.expireVotes(ballots, VOTE_EXPIRATION);
    Memory.roads[addr] = Memory.roads[addr].map(() => Game.time);
    Memory.roads[addr].push(Game.time);
    ballots = Memory.roads[addr];

    // If we have enough votes, return true so we build the road
    if (ballots.length >= voteThreshold) {
      delete Memory.roads[addr];
      return true;
    }

    return false;
  }

  connect(target: RoomPosition, destinations: RoomPosition[]): CostMatrix | undefined {
    if (destinations.length === 0) {
      return;
    }
    const that = this;

    for (const destId in destinations) {
      const pos = destinations[destId];
      const searchResult = PathFinder.search(
        target,
        { pos, range: 1 },
        {
          swampCost: 4,
          plainCost: 2,
          roomCallback(roomName: string): boolean | CostMatrix {
            const room = Game.rooms[roomName];
            if (!room) return false;

            let costs = new PathFinder.CostMatrix();

            room.find(FIND_STRUCTURES).forEach((s: AnyStructure) => {
              if (s.structureType === STRUCTURE_ROAD) {
                costs.set(s.pos.x, s.pos.y, 1);
              } else if (s.structureType !== STRUCTURE_CONTAINER && (s.structureType !== STRUCTURE_RAMPART || !s.my)) {
                costs.set(s.pos.x, s.pos.y, 0xff);
              }
            });
            room.find(FIND_MY_CONSTRUCTION_SITES).forEach((s: ConstructionSite) => {
              if (s.structureType === STRUCTURE_ROAD) {
                costs.set(s.pos.x, s.pos.y, 1);
              } else if (s.structureType !== STRUCTURE_CONTAINER && (s.structureType !== STRUCTURE_RAMPART || !s.my)) {
                costs.set(s.pos.x, s.pos.y, 0xff);
              }
            });

            that.controller.getScheduled(room).forEach((t: ConstructTask) => {
              const cost = t.structure === STRUCTURE_ROAD ? 1 : 0xff;
              costs.set(t.pos.x, t.pos.y, cost);
            });

            return costs;
          }
        }
      );

      searchResult.path.forEach((p: RoomPosition) => {
        if (this.haveRoad(p)) {
          return;
        }
        this.buildAt(p);
      });
    }

    return;
  }

  gc(force?: boolean): void {
    if (force || (Memory.roads && Game.time % 1000 === 0)) {
      for (const addr in Memory.roads) {
        Memory.roads[addr] = this.expireVotes(Memory.roads[addr], VOTE_EXPIRATION);
        if (Memory.roads[addr].length === 0) {
          delete Memory.roads[addr];
        }
      }
    }
  }
}

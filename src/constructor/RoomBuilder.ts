type AvoidOpts = {
  range?: number;
  resolveTo?: number;
  isCheckered?: boolean;
};

interface AvoidObj {
  range: number;
  type?: number;
  filter: (o: LookAtResult) => boolean;
}

export class AvoidStruct {
  structureType: string;
  range: number = 1;
  type?: number;
  isCheckered: boolean = false;

  constructor(structType: string, opts?: AvoidOpts) {
    this.structureType = structType;
    if (opts) {
      this.range = opts.range || 1;
      this.type = opts.resolveTo;
      this.isCheckered = opts.isCheckered || false;
    }
  }

  filter(o: LookAtResult): boolean {
    let res = o.type === LOOK_STRUCTURES && o.structure?.structureType === this.structureType;
    res = res || (o.type === LOOK_CONSTRUCTION_SITES && o.constructionSite?.structureType === this.structureType);
    return res;
  }
}

export class AvoidSource {
  range: number;
  filter: (o: LookAtResult) => boolean;

  constructor(range: number, f: (o: LookAtResult) => boolean) {
    this.range = range;
    this.filter = f;
  }
}

const FREE = 0,
  FREE_BUT_DISQUALIFIED = 1,
  OCCUPIED = 2,
  AVOID_AREA = 3;
const FREE_ENTRY = { type: FREE, range: 0 };
const DISQUALIFIED_ENTRY = { type: FREE_BUT_DISQUALIFIED, range: 0 };
const OCCUPIED_ENTRY = { type: OCCUPIED, range: 0 };

export const AvoidList: { [name: string]: AvoidObj } = {
  [STRUCTURE_ROAD]: new AvoidStruct(STRUCTURE_ROAD, { range: 0, resolveTo: FREE_BUT_DISQUALIFIED }),
  [STRUCTURE_SPAWN]: new AvoidStruct(STRUCTURE_SPAWN, { range: 1 }),
  [STRUCTURE_CONTROLLER]: new AvoidStruct(STRUCTURE_CONTROLLER, { range: 4 }),
  [STRUCTURE_EXTENSION]: new AvoidStruct(STRUCTURE_EXTENSION, { range: 1, isCheckered: true }),
  [STRUCTURE_CONTAINER]: new AvoidStruct(STRUCTURE_CONTAINER, { range: 2 }),
  [STRUCTURE_STORAGE]: new AvoidStruct(STRUCTURE_STORAGE, { range: 2 }),
  [STRUCTURE_TOWER]: new AvoidStruct(STRUCTURE_TOWER, { range: 7 }),
  [LOOK_SOURCES]: new AvoidSource(2, (o: LookAtResult) => o.type === LOOK_SOURCES)
};

export class RoomBuilding {
  public static isEdge(i: number, j: number, pos: RoomPosition, range: number): boolean {
    return Math.abs(j - pos.x) === range || Math.abs(i - pos.y) === range;
  }

  public static isCloseToRoomEdge(i: number, j: number): boolean {
    return i < 3 || j < 3 || i > 46 || j > 46;
  }

  public static getNearby(
    room: Room,
    pos: RoomPosition,
    range: number,
    asArray: boolean = true
  ): LookAtResultMatrix | LookAtResultWithPos[] {
    let top = this.boundCoords(pos.y - range),
      left = this.boundCoords(pos.x - range),
      bottom = this.boundCoords(pos.y + range),
      right = this.boundCoords(pos.x + range);

    if (asArray) {
      return room.lookAtArea(top, left, bottom, right, true);
    } else {
      return room.lookAtArea(top, left, bottom, right, false);
    }
  }

  public static isWallTerrain(pos: RoomPosition): boolean {
    const roomTerrain = Game.map.getRoomTerrain(pos.roomName);
    return roomTerrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL;
  }

  public static boundCoords(n: number): number {
    if (n < 2) return 2;
    if (n > 47) return 47;
    return n;
  }

  public static isCoordValid(n: number): boolean {
    return n === this.boundCoords(n);
  }

  public static isPosValid(x: number, y: number): boolean {
    return this.isCoordValid(x) && this.isCoordValid(y);
  }

  public static printMatrix(matrix: any, message: string, transformer?: (x: { type: number }) => number) {
    transformer = transformer || (x => x.type);
    if (message) {
      console.log(message);
    }
    let headerPrinted = false,
      header = [],
      row;
    for (let i in matrix) {
      if (!matrix[i]) continue;
      row = [];
      for (let j in matrix[i]) {
        header.push(j);
        let cell = matrix[i][j];
        if (!cell) continue;
        row.push(cell);
      }
      if (!headerPrinted) {
        console.log("    " + header.join(" "));
        headerPrinted = true;
      }
      console.log(i + ": " + row.map(transformer).join("  "));
    }
  }

  public static *FindFreePosNearby(
    target: RoomPosition,
    range: number,
    numOfFreeAdjSpaces: number = 3,
    avoidEachOtherRange: number = 3,
    avoidList: AvoidObj[] = [],
    avoidIsCheckered: boolean = false
  ): any {
    const room = Game.rooms[target.roomName];
    if (!room) {
      return;
    }
    const borderedRange = range + 1;

    avoidList.forEach((a: AvoidObj) => (a.type = a.type || AVOID_AREA));

    let matrix = this.getNearby(room, target, borderedRange, false) as any;

    for (let [j, i] of this.getCoordsWithinRange(target, borderedRange)) {
      let initialValue = FREE_ENTRY;
      if (this.isEdge(i, j, target, borderedRange) || this.isCloseToRoomEdge(i, j)) {
        // we want to mark the border as a DISQUALIFIED_ENTRY
        initialValue = DISQUALIFIED_ENTRY;
      }
      matrix[i][j] = matrix[i][j].reduce((res: { type: number; range: number }, o: LookAtResult) => {
        if (res.type !== AVOID_AREA) {
          if (o.type === LOOK_TERRAIN && o.terrain === "wall") {
            res = OCCUPIED_ENTRY;
          } else if (o.type === LOOK_STRUCTURES && o.structure?.structureType !== STRUCTURE_ROAD) {
            res = OCCUPIED_ENTRY;
          } else if (o.type === LOOK_CONSTRUCTION_SITES && o.constructionSite?.structureType !== STRUCTURE_ROAD) {
            res = OCCUPIED_ENTRY;
          }
        }

        avoidList.forEach((avoidEntry: AvoidObj) => {
          // Check for range, bc if two avoids match, take the bigger of the two
          if (avoidEntry.filter(o) && avoidEntry.range > res.range) {
            if (avoidEntry.type) {
              res = { type: avoidEntry.type, range: avoidEntry.range };
            }
          }
        });
        return res;
      }, initialValue);
    }

    this.printMatrix(matrix, "After processing terrain");

    // now that we've reduced. find the avoided areas, e.g. extensions, and tight spaces
    for (let [j, i] of this.getCoordsWithinRange(target, range)) {
      let coord = matrix[i][j];
      if (coord.type === AVOID_AREA) {
        let range = coord.range,
          isCheckered = coord.isCheckered;
        this.markNearby(matrix, i, j, [FREE_ENTRY], DISQUALIFIED_ENTRY, range, isCheckered);
      } else if (matrix[i][j].type === FREE) {
        // check candidate for tight spaces
        let occupiedList = [OCCUPIED, AVOID_AREA];
        let freeSpaces = this.countQualifiedSpacesInRange(matrix, i, j, 1, occupiedList, numOfFreeAdjSpaces, "type");
        if (numOfFreeAdjSpaces > freeSpaces) {
          matrix[i][j] = DISQUALIFIED_ENTRY;
        }
      }
    }

    this.printMatrix(matrix, "After marking avoid areas");

    // yield free spaces, starting from the target
    for (let [j, i] of this.getCoordsWithinRange(target, range)) {
      if (!matrix[i] || matrix[i][j] === undefined) continue;
      // console.log(`${i}, ${j} ${matrix[i][j].type}`);
      if (matrix[i][j] !== FREE_ENTRY) continue;

      // Swap i and j to be compatible with Screep convention
      let freePos = new RoomPosition(j, i, room.name),
        pathFinder = PathFinder.search(freePos, { pos: target, range: 1 }),
        path = pathFinder.path,
        distance = path.length;

      // Check path's distance < desired range, e.g. a wall between us, forcing us to go the long way
      if (distance > range) continue;

      yield freePos;

      // Update the matrix with the newly placed "thing"
      this.markNearby(matrix, i, j, [FREE_ENTRY], DISQUALIFIED_ENTRY, avoidEachOtherRange, avoidIsCheckered);
    }
  }

  public static *getCoordsWithinRange(origin: { x: number; y: number }, range: number) {
    const that = this;

    yield [origin.x, origin.y];

    function* getColumnSubsets(originX: number, ringX: number, originY: number, ringY: number) {
      let jLow = originY - ringY,
        jHi = originY + ringY;
      for (let i = originX - ringX; i <= originX + ringX; i++) {
        if (that.isPosValid(i, jLow)) {
          yield [i, jLow];
        }
        if (that.isPosValid(i, jHi)) {
          yield [i, jHi];
        }
      }
    }

    let ring = { x: 0, y: 1 };
    while (ring.y <= range && ring.x <= range) {
      for (let [i, j] of getColumnSubsets(origin.x, ring.x, origin.y, ring.y)) {
        yield [i, j];
      }
      ring.x += 1;
      if (ring.x > range) break;

      for (let [j, i] of getColumnSubsets(origin.y, ring.y, origin.x, ring.x)) {
        yield [i, j];
      }
      ring.y += 1;
    }
  }

  public static countQualifiedSpacesInRange(
    matrix: LookAtResultMatrix,
    x: number,
    y: number,
    range: number,
    dequalifiers: any[],
    maxCount: number = 0xff,
    field?: any
  ) {
    let qualifiedSpaces = 0;
    for (let [i, j] of this.getCoordsWithinRange({ x, y }, range)) {
      if (i === x && y === j) continue;
      if (!matrix[i] || matrix[i][j] === undefined) {
        qualifiedSpaces++;
      } else {
        let filters: LookAtResult[] = [];
        let cell = matrix[i][j];
        if (field) {
          filters.push(cell[field]);
        } else {
          filters.push(...cell);
        }
        if (!dequalifiers.includes(filters)) {
          qualifiedSpaces++;
        }
        if (qualifiedSpaces >= maxCount) return maxCount;
      }
    }
    return qualifiedSpaces;
  }

  public static markNearby(
    matrix: any,
    x: number,
    y: number,
    replacementMembers: { type: number; range: number }[],
    newValue: { type: number; range: number },
    range: number,
    isCheckered: boolean = false
  ) {
    for (let [i, j] of this.getCoordsWithinRange({ x, y }, range)) {
      if (!matrix[i] || matrix[i][j] === undefined || (x === j && y === i)) continue;
      const item = matrix[i][j];
      if (replacementMembers.includes(item)) {
        if (!isCheckered || !this.isCheckered([i, j], [x, y])) {
          matrix[i][j] = newValue;
        }
      }
    }
  }

  public static isCheckered([x, y]: [number, number], [xOrigin, yOrigin]: [number, number]) {
    return (x + xOrigin) % 2 === (y + yOrigin) % 2;
  }
}

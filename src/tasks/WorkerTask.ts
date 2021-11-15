export enum WorkerAction {
  idle,
  move,
  harvestEnergy,
  fillCreepEnergy,
  supplyEnergy,
  build,
  repair,
  upgradeRoom,
  withdrawEnergy,
  pickupEnergy,
  storeEnergy,
  pickEnergySourceForHarvest,
  perpetualHarvestEnergy,
  pickEnergySourceForPerpetualHarvest
}

export class WorkerTask {
  action: WorkerAction = WorkerAction.idle;
  targetId?: string;
  priority: number = 5;

  constructor(action: WorkerAction, targetId?: string, priority?: number) {
    this.action = action;
    this.targetId = targetId;
    this.priority = priority || 5;
  }
}

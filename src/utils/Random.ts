export class Random {
  public static Pick(collection: any[]): any {
    return collection[Math.floor(Math.random() * collection.length)];
  }

  public static Jitter(max: number, magnitude: number): number {
    const min = (1 - magnitude) * max;

    return Math.floor(Math.random() * (max - min)) + min;
  }
}

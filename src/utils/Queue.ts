interface Node<T> {
  priority: number;
  value: T;
}

export type QueueItem<T> = {
  item: T;
  idx: number;
};

interface HasPriority {
  priority: number;
}

export interface PriorityQueue<T extends HasPriority> {
  insert(item: T): void;

  load(items: T[]): void;

  peek(): T | undefined;

  pop(): T | undefined;

  size(): number;

  filter(f: (t: T) => boolean): T[];

  find(f: (t: T) => boolean): QueueItem<T> | undefined;

  remove(idx: number): boolean;

  isEmpty(): boolean;
}

class sortedPriorityQueueImpl<T extends HasPriority> implements PriorityQueue<T> {
  data: [number, T][] = [];

  insert(item: T): void {
    if (this.data.length === 0) {
      this.data.push([item.priority, item]);
      return;
    }

    for (let index = 0; index < this.data.length; index++) {
      if (index === this.data.length - 1) {
        this.data.push([item.priority, item]);
        return;
      }

      if (this.data[index][0] > item.priority) {
        this.data.splice(index, 0, [item.priority, item]);
        return;
      }
    }
  }

  load(items: T[]): void {
    this.data = [];
    for (const i in items) {
      const item = items[i];
      this.insert(item);
    }
  }

  filter(f: (t: T) => boolean): T[] {
    let results: T[] = [];

    for (const tId in this.data) {
      let task = this.data[tId][1];
      if (f(task)) {
        results.push(task);
      }
    }

    return results;
  }

  find(f: (t: T) => boolean): QueueItem<T> | undefined {
    let idx = 0;
    for (const tId in this.data) {
      let task = this.data[tId][1];
      if (f(task)) {
        return {
          item: task,
          idx: idx
        };
      }
      idx++;
    }

    return;
  }

  remove(idx: number): boolean {
    if (idx < 0 || idx > this.data.length - 1) {
      console.log(`${idx} is not a valid index`);
      return false;
    }
    this.data.splice(idx, 1);
    return true;
  }

  isEmpty(): boolean {
    return this.data.length === 0;
  }

  peek(): T | undefined {
    return this.data.length === 0 ? undefined : this.data[0][1];
  }

  pop(): T | undefined {
    let item = this.data.pop();
    if (!item) {
      return;
    }

    return item[1];
  }

  size(): number {
    return this.data.length;
  }
}

export const sortedPriorityQueue = <T extends HasPriority>(data?: T[]): PriorityQueue<T> => {
  const q = new sortedPriorityQueueImpl<T>();
  if (data) {
    q.load(data);
  }

  return q;
};

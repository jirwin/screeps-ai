interface Node<T> {
  priority: number;
  value: T;
}

export interface PriorityQueue<T> {
  insert(item: T, priority: number): void;

  peek(): T | undefined;

  pop(): T | undefined;

  size(): number;

  isEmpty(): boolean;
}

export const sortedPriorityQueue = <T>(): PriorityQueue<T> => {
  const data: [number, T][] = [];

  return {
    insert: (item, priority) => {
      if (data.length === 0) {
        data.push([priority, item]);
        return;
      }

      for (let index = 0; index < data.length; index++) {
        if (index === data.length - 1) {
          data.push([priority, item]);
          return;
        }

        if (data[index][0] > priority) {
          data.splice(index, 0, [priority, item]);
          return;
        }
      }
    },

    isEmpty: () => data.length === 0,

    peek: (): T | undefined => (data.length === 0 ? undefined : data[0][1]),

    pop: (): T | undefined => {
      let item = data.pop();
      if (!item) {
        return undefined;
      }

      return item[1];
    },

    size: () => data.length
  };
};

const heapPriorityQueue = <T>(): PriorityQueue<T> => {
  let heap: Node<T>[] = [];

  const parent = (index: number) => Math.floor((index - 1) / 2);
  const left = (index: number) => 2 * index + 1;
  const right = (index: number) => 2 * index + 2;
  const hasLeft = (index: number) => left(index) < heap.length;
  const hasRight = (index: number) => right(index) < heap.length;

  const swap = (a: number, b: number) => {
    const tmp = heap[a];
    heap[a] = heap[b];
    heap[b] = tmp;
  };

  return {
    isEmpty: () => heap.length === 0,

    peek: () => (heap.length === 0 ? undefined : heap[0].value),

    size: () => heap.length,

    pop: (): T | undefined => {
      if (heap.length === 0) {
        return undefined;
      }

      swap(0, heap.length - 1);
      const item = heap.pop();
      if (!item) {
        return undefined;
      }

      let current = 0;
      while (hasLeft(current)) {
        let smallerChild = left(current);
        if (hasRight(current) && heap[right(current)].priority < heap[left(current)].priority) {
          smallerChild = right(current);
        }

        if (heap[smallerChild].priority > heap[current].priority) {
          break;
        }

        swap(current, smallerChild);
        current = smallerChild;
      }

      return item.value;
    },

    insert: (item: T, priority: number): void => {
      heap.push({ priority: priority, value: item });

      let i = heap.length - 1;
      while (i > 0) {
        const p = parent(i);
        if (heap[p].priority < heap[i].priority) {
          break;
        }
        swap(i, p);
        i = p;
      }
    }
  };
};

/**
 * Generic, strongly-typed Min-Heap implementation for Top-K element selection.
 * Big-O:
 * - push: O(log K)
 * - pop: O(log K)
 * - peek: O(1)
 * - size: O(1)
 * Space: O(K) where K is the heap capacity
 */
export class MinHeap<T> {
  private readonly heap: T[] = [];
  private readonly comparator: (a: T, b: T) => number;

  /**
   * @param comparator Function returning negative if a < b, positive if a > b, 0 if equal.
   */
  constructor(comparator: (a: T, b: T) => number) {
    this.comparator = comparator;
  }

  public size(): number {
    return this.heap.length;
  }

  public isEmpty(): boolean {
    return this.heap.length === 0;
  }

  public peek(): T | undefined {
    return this.heap[0];
  }

  public push(item: T): void {
    this.heap.push(item);
    this.siftUp(this.heap.length - 1);
  }

  public pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const root = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0 && last !== undefined) {
      this.heap[0] = last;
      this.siftDown(0);
    }
    return root;
  }

  /**
   * Drains the heap into an array sorted in descending order (highest score first).
   * Big-O: O(K log K) time, O(K) space.
   */
  public toDescendingArray(): T[] {
    const result: T[] = [];
    while (!this.isEmpty()) {
      const item = this.pop();
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result.reverse();
  }

  private siftUp(index: number): void {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      const currentItem = this.heap[current];
      const parentItem = this.heap[parent];
      if (
        currentItem !== undefined &&
        parentItem !== undefined &&
        this.comparator(currentItem, parentItem) < 0
      ) {
        this.swap(current, parent);
        current = parent;
      } else {
        break;
      }
    }
  }

  private siftDown(index: number): void {
    let current = index;
    const length = this.heap.length;

    while (current * 2 + 1 < length) {
      const left = current * 2 + 1;
      const right = current * 2 + 2;
      let smallest = left;

      const leftItem = this.heap[left];
      const rightItem = this.heap[right];
      if (
        right < length &&
        leftItem !== undefined &&
        rightItem !== undefined &&
        this.comparator(rightItem, leftItem) < 0
      ) {
        smallest = right;
      }

      const smallestItem = this.heap[smallest];
      const currentItem = this.heap[current];
      if (
        smallestItem !== undefined &&
        currentItem !== undefined &&
        this.comparator(smallestItem, currentItem) < 0
      ) {
        this.swap(current, smallest);
        current = smallest;
      } else {
        break;
      }
    }
  }

  private swap(i: number, j: number): void {
    const temp = this.heap[i];
    const target = this.heap[j];
    if (temp !== undefined && target !== undefined) {
      this.heap[i] = target;
      this.heap[j] = temp;
    }
  }
}

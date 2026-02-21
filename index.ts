import { CString, type Pointer, read, ptr as pt, toBuffer } from 'bun:ffi';
import { endianness } from 'os';


function alignUp(n: number, alignment: number) {
  return (n + alignment - 1) & ~(alignment - 1);
}

const p = Symbol.for('p');
const o = Symbol.for('o');
const e = endianness();

type Writes = keyof Buffer;

const read2w = {
  "f32": `writeFloat${e}` as const,
  'f64': `writeDouble${e}` as const,
  'i16': `writeInt16${e}` as const,
  'u16': `writeUInt16${e}` as const,
  'i32': `writeInt32${e}` as const,
  'u32': `writeUInt32${e}` as const,
  'i64': `writeBigInt64${e}` as const,
  'u64': `writeBigUInt64${e}` as const,

  'intptr': `writeUInt32${e}` as const, // see if we can find the size to use
  'ptr': `writeBigUInt64${e}` as const, // see if we can find the size to use

  'i8': 'writeInt8' as const,
  'u8': 'writeUInt8' as const,
} satisfies Record<keyof typeof read, Writes>;

type Layout = {
  cursor: number
  alignment: number
}
const layoutMap = new WeakMap<Function, Layout>();

export abstract class CStruct {
  private [p]: Pointer;
  private [o]: number;


  private static getLayout(this: typeof CStruct): Layout {
    let layout = layoutMap.get(this);
    if (!layout) {
      layout = { cursor: 0, alignment: 1 };
      layoutMap.set(this, layout);
    }
    return layout;
  }

  static get size() {
    const { cursor, alignment } = this.getLayout();
    return alignUp(cursor, alignment);
  }

  static get alignement() {
    return this.getLayout().alignment;
  }

  static reader(ptr: Pointer, offset: number) {
    //@ts-ignore
    return new this(ptr, offset);
  }

  static alloc(): Pointer {
    const buff = Buffer.alloc(this.size);
    return pt(buff);
  }


  constructor(ptr: Pointer, offset = 0) {
    this[p] = ptr;
    this[o] = offset;
    Object.defineProperties(this, Object.getOwnPropertyDescriptors(Object.getPrototypeOf(this)))
  }
}

export function chars(length: number) {
  const alignment = 1;
  const size = length;
  const reader = (p: Pointer, offset: number) => {
    return new CString(p, offset).toString();
  }
  const writer = (v: string, p: Pointer, offset: number) => {
    toBuffer(p, offset, size).write(v.padEnd(length, '\0'));
  }

  const deco = function (target: CStruct, key: string) {
    const ctr = target.constructor as typeof CStruct;
    const layout = ctr["getLayout"]();
    const offset = alignUp(layout.cursor, alignment);

    layout.cursor = offset + size;
    layout.alignment = Math.max(layout.alignment, alignment);

    Object.defineProperty(target, key, {
      get() {
        return reader(this[p], offset + this[o]);
      },
      set(v: string) {
        writer(v, this[p], offset + this[o]);
      },
      enumerable: true,
    });
  };
  (deco as any).reader = reader;
  (deco as any).writer = writer;
  (deco as any).size = length;
  (deco as any).alignment = 1;

  return deco as TypedDecorator<string>;
}

export function struct<T extends typeof CStruct>(cls: T) {
  const reader = (p: Pointer, offset: number) => {
    return cls.reader(p, offset);
  }
  const deco = function (target: CStruct, key: string) {
    const ctr = target.constructor as typeof CStruct;
    const layout = ctr['getLayout']();

    const alignment = cls['getLayout']().alignment;
    const offset = alignUp(layout.cursor, alignment);

    layout.cursor = offset + cls.size;
    layout.alignment = Math.max(layout.alignment, alignment);

    Object.defineProperty(target, key, {
      get() {
        const ptr: Pointer = this[p];
        return reader(ptr, offset + this[o]);
      },
      set(v) {
        throw new Error("Can only write to fields");
      },
      enumerable: true,
    });
  };

  (deco as any).size = cls.size;
  (deco as any).alignment = cls['getLayout']().alignment;
  (deco as any).reader = reader;
  return deco as unknown as TypedDecorator<InstanceType<T>>;
}

export function array<T extends (typeof CStruct | TypedDecorator<any>)>(itemType: T, count: number) {

  const size = (itemType as any).size * count;
  const alignment = (itemType as any).alignment;

  let proxyMemo: any[];

  const reader = (ptr: Pointer, offset: number) => {
    if (proxyMemo) return proxyMemo;
    proxyMemo = new Proxy(Array(count), {
      get(target, p, receiver) {
        if (typeof p === "symbol" || Number.isNaN(Number(p))) {
          return target[p as any]
        };
        const i = Number(p);
        if (i > count - 1) {
          return undefined;
        }
        return (itemType as any).reader(ptr, offset + i * (itemType as any).size)
      },
      set(target, p, newValue, receiver) {
        const i = Number(p);
        if (i > count - 1) {
          return true;
        }
        (itemType as any).writer(newValue, ptr, offset + i * (itemType as any).size)
        return true
      },
    });
    // const arr = [];
    // for (let i = 0; i < count; i++) {
    //   arr.push((itemType as any).reader(ptr, offset + i * (itemType as any).size));
    // }
    return proxyMemo;
  };

  const writer = (v: any[], ptr: Pointer, offset: number) => {
    for (let i = 0; i < Math.min(v.length, count); i++) {
      (itemType as any).writer(v[i], ptr, offset + i * (itemType as any).size)
    }
  }

  const deco = function (target: CStruct, key: string) {
    const ctr = target.constructor as typeof CStruct;
    const layout = ctr['getLayout']();

    const offset = alignUp(layout.cursor, alignment);
    layout.cursor = offset + size;
    layout.alignment = Math.max(layout.alignment, alignment);

    Object.defineProperty(target, key, {
      get() {
        return reader(this[p], offset + this[o]);
      },
      set(v: any[]) {
        writer(v, this[p], offset + this[o])
      },
      enumerable: true,
    });
  };

  (deco as any).size = size;
  (deco as any).alignment = alignment;
  (deco as any).reader = reader;
  (deco as any).writer = writer;

  return deco as T extends typeof CStruct ? TypedDecorator<InstanceType<T>[]> :
    TypedDecorator<Extract<T>[]>;
}


export function ref<T extends (typeof CStruct | TypedDecorator<any>)>(type: T) {
  const SIZE = 8;
  const ALIGNMENT = 8;
  const reader = (ptr: Pointer, offset: number) => {
    const addr = read.ptr(ptr, offset);
    if (!addr) return null;
    return (type as any).reader(addr, 0)
  };

  const writer = (v: any, ptr: Pointer, offset: number) => {
    const addr = read.ptr(ptr, offset);
    (type as any).writer(v, addr, 0);
  };

  const deco = function (target: CStruct, key: string) {
    const ctr = target.constructor as typeof CStruct;
    const layout = ctr['getLayout']();

    const offset = alignUp(layout.cursor, ALIGNMENT);
    layout.cursor = offset + SIZE;
    layout.alignment = Math.max(layout.alignment, ALIGNMENT);
    Object.defineProperty(target, key, {
      get() {
        return reader(this[p], offset + this[o]);
      },
      set(v) {
        writer(v, this[p], offset + this[o])
      },
      enumerable: true,
    });

    Object.defineProperty(target, `$${key}`, {
      get() {
        return read.ptr(this[p], offset + this[o]);
      },
      set(v) {
        toBuffer(this[p], offset + this[o], SIZE)[read2w['ptr']](BigInt(v));
      },
      enumerable: false,
    })
  };
  (deco as any).size = SIZE;
  (deco as any).alignment = ALIGNMENT;
  (deco as any).reader = reader;
  (deco as any).writer = writer;


  return deco as T extends typeof CStruct ?
    TypedDecorator<InstanceType<T>> : T;
}

function stringDecorator() {
  const SIZE = 8;
  const ALIGNMENT = 8;
  const reader = (ptr: Pointer, offset: number) => {
    const addr = read.ptr(ptr, offset) as Pointer;
    if (!addr) return null;
    return new CString(addr, 0).toString()
  };

  const writer = (v: string, ptr: Pointer, offset: number) => {
    const toWrite = Buffer.from(`${v}\0`);
    const val = pt(toWrite)
    toBuffer(ptr, offset, SIZE)[read2w['ptr']](BigInt(val));
  };

  const deco = function (target: CStruct, key: string) {
    const ctr = target.constructor as typeof CStruct;
    const layout = ctr['getLayout']();

    const offset = alignUp(layout.cursor, ALIGNMENT);
    layout.cursor = offset + SIZE;
    layout.alignment = Math.max(layout.alignment, ALIGNMENT);

    Object.defineProperty(target, key, {
      get() {
        return reader(this[p], offset + this[o]);
      },
      set(v) {
        writer(v, this[p], offset + this[o])
      },
      enumerable: true,
    });
  };
  (deco as any).size = SIZE;
  (deco as any).alignment = ALIGNMENT;
  (deco as any).reader = reader;
  (deco as any).writer = writer;

  return deco as TypedDecorator<string>
}



function primitiveDecorator(
  size: number,
  readerKey: keyof typeof read,
  alignment = size
) {
  const r = read[readerKey];
  const reader = (p: Pointer, offset: number) => {
    return r(p, offset)
  }
  const writer = (v: any, p: Pointer, offset: number) => {
    toBuffer(p, offset, size)[read2w[readerKey]](v as never);
  }

  const deco = function (target: CStruct, key: string) {
    const ctr = target.constructor as typeof CStruct;
    const layout = ctr['getLayout']();

    const offset = alignUp(layout.cursor, alignment);
    layout.cursor = offset + size;
    layout.alignment = Math.max(layout.alignment, alignment);

    Object.defineProperty(target, key, {
      get() {
        return reader(this[p], offset + this[o]);
      },
      set(v) {
        writer(v, this[p], offset + this[o]);
      },
      enumerable: true,
    });
  };

  (deco as any).size = size;
  (deco as any).alignment = alignment;
  (deco as any).reader = reader;
  (deco as any).writer = writer;

  return deco;
}

export const i8 = primitiveDecorator(1, 'i8', 1) as TypedDecorator<number>;
export const u8 = primitiveDecorator(1, 'u8', 1) as TypedDecorator<number>;
export const i16 = primitiveDecorator(2, 'i16', 2) as TypedDecorator<number>;
export const u16 = primitiveDecorator(2, 'u16', 2) as TypedDecorator<number>;

export const i32 = primitiveDecorator(4, 'i32', 4) as TypedDecorator<number>;
export const u32 = primitiveDecorator(4, 'u32', 4) as TypedDecorator<number>;
export const f32 = primitiveDecorator(4, 'f32', 4) as TypedDecorator<number>;

export const i64 = primitiveDecorator(8, 'i64', 8) as TypedDecorator<number>;
export const u64 = primitiveDecorator(8, 'u64', 8) as TypedDecorator<number>;
export const f64 = primitiveDecorator(8, 'f64', 8) as TypedDecorator<number>;

export const ptr = primitiveDecorator(8, 'ptr', 8) as TypedDecorator<number>;

export const string = stringDecorator();


export const refPointer = ((a: CStruct, b: string) => { }) as <T extends CStruct, K extends keyof T>(target: T, key: K, ...this_pointer_doesnt_exist_in_this_struct: CheckRefPointer<T, K>) => void;


type CheckRefPointer<T, K extends keyof T> = K extends `$${infer U}` ? U extends keyof T ? [] : [U] : [K];
type Checks<T, K extends keyof T, Expected> = T[K] extends Expected ? [] : [Expected]
type TypedDecorator<Expected> = <T extends CStruct, K extends keyof T>(target: T, key: K, ...property_and_decorator_type_mismatch: Checks<T, K, Expected>) => void;
type Extract<T> = T extends TypedDecorator<infer U> ? U : never

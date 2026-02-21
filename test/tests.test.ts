
import { dlopen, type Pointer } from 'bun:ffi';
import { test, expect, beforeAll, describe, afterAll, } from 'bun:test'
import { CStruct, chars, array, i32, f32, u32, u16, struct, ref, string, refPointer, f64 } from '../index';


const {
  symbols: lib,
  close,
} = dlopen(`${import.meta.dir}/libtest.dylib`, {
  getStruct: {
    returns: 'pointer',
  },
  getOtherRefPtr: {
    returns: 'pointer'
  },
})

class Ref extends CStruct {
  @i32 prop!: number;
  @f32 pi!: number;
  @string greeting!: string;
}

class Nested extends CStruct {
  @i32 z!: number;
  @chars(5) text!: string;
  @array(u32, 3) list!: number[];
  @ref(Ref) someReference!: Ref;
}


class SomeStruct extends CStruct {
  @i32 a!: number;
  @u16 b!: number;
  @i32 c!: number;
  @struct(Nested) child!: Nested;
  @i32 k!: number;
  @ref(Ref) someReference!: Ref;
  /**
   * refPointer does nothing its just to add $someReference type
   * omitting this line does't change the runtime
   * omiting `@refPointer` will cause an error becaus of the way the
   * class is transiplied ts will try to recreate a property that has been
   * created by `@ref(Ref)` with  `configurable: false`
   * You can omit it if you don't need to access the pointer or 
   * access it like (instance as any).$someReference
   */
  @refPointer $someReference!: Pointer;
  @f64 f!: number;
}






describe('Struct', () => {
  let s: SomeStruct;
  let sp: Pointer;
  beforeAll(() => {
    sp = lib.getStruct()!
    s = new SomeStruct(sp);
  })
  test("can access direct fields", () => {
    expect(s.a).toEqual(1);
    expect(s.b).toEqual(2);
    expect(s.c).toEqual(5);
    expect(s.k).toEqual(69);
    expect(s.f).toBeCloseTo(1.23456789)
  })

  test('typechecks', () => {
    expect(() => {
      class T1 {
        // @ts-expect-error Doesn't extend CStruct
        @i32 num!: string;
      }
    }).toThrow()

    class T2 extends CStruct {
      // @ts-expect-error wrong type
      @i32 num!: string;
    }

    class T3 extends CStruct {
      @ref(i32) num!: number;
      // @ts-expect-error pointer nums doesn't exist
      @refPointer $nums!: Pointer
    }
  })

  test("can access inline structs", () => {
    expect(s.child.z).toEqual(6)
  })


  test("can access inline arrays", () => {
    expect([...s.child.list]).toEqual([3, 2, 1])
    s.child.list[0] = 2
    expect([...s.child.list]).toEqual([2, 2, 1])
    s.child.list[5] = 4
    expect([...s.child.list]).toEqual([2, 2, 1])
  })

  test("can access inlined strings", () => {
    expect(s.child.text).toEqual('abc');
  })

  test('can access reference structs', () => {
    expect(s.child.someReference.pi).toBeCloseTo(3.1415);
    expect(s.someReference.prop).toEqual(420);
  })

  test('fileds are enumerable', () => {
    expect(Object.keys(s)).toEqual(['a', 'b', 'c', 'child', 'k', 'someReference'])
    expect(s instanceof SomeStruct).toBe(true)
  })

  test('can have strings', () => {
    expect(s.someReference.greeting).toBe('Hello world');
  })

  test('can be stringified', () => {
    expect(JSON.stringify(s.someReference)).toEqual(`{"prop":420,"pi":3.1414999961853027,"greeting":"Hello world"}`);
  })

  test('can write to fields', () => {
    s.a = 10;
    s.child.z = 99;
    s.c = 9;
    s.child.text = 'ho'
    expect(s.a).toBe(10)
    expect(s.child.z).toBe(99)
    expect(s.c).toBe(9)
    expect(s.child.text).toBe('ho')
    s.child.text = '123456789'
    expect(s.child.text).toBe('12345') // no overflow
    s.child.list = [1, 2, 3]
    expect([...s.child.list]).toEqual([1, 2, 3])
    s.child.list = [7, 8, 9, 10];
    expect([...s.child.list]).toEqual([7, 8, 9]) // no overflow

    s.someReference.pi = 3;
    expect(s.someReference.pi).toEqual(3);
    expect(s.child.someReference.pi).toEqual(3); // they share refs

    s.someReference.greeting = 'this is some long text'
    expect(s.someReference.greeting).toEqual('this is some long text')

    const otherRef = lib.getOtherRefPtr()!;
    s.$someReference = otherRef;
    expect(s.someReference.pi).toBeCloseTo(6.2831)

    expect(s.child.someReference.pi).toBe(3) // this hasnt changed
  });

  test('can be allocated', () => {
    const ptr = Ref.alloc();
    const deref = new Ref(ptr);
    expect(deref.pi).toBe(0);
    deref.pi = 3.1415
    expect(deref.pi).toBeCloseTo(3.1415);
  })

  test('Can overwrite nested', () => {
    const n = Nested.new();
    n.text = 'abc'
    s.child = n;
    expect(s.child.text).toBe("abc")
  })
})



afterAll(() => {
  close();
})